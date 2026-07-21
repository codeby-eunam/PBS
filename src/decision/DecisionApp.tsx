import { useEffect, useMemo, useState } from "react";
import type { Vendor } from "../types";
import { useVendorCatalog } from "../hooks/useVendorCatalog";
import {
  advanceMatch,
  buildSystemLists,
  decisionStartMode,
  getAnonymousUserId,
  SESSION_KEY,
  startSession,
  type DecisionList,
  type DecisionSession,
  type ResultMethod,
} from "./model";
import {
  createDecisionSession,
  loadDecisionLists,
  notifyFeedbackInbox,
  saveDecisionResult,
  submitLineReport,
  submitListRequest,
  submitReview,
  trackEvent,
  type ReviewDraft,
} from "./api";
import "./decision.css";

type Route = {
  page: "home" | "list" | "swipe" | "tournament" | "result" | "vendor";
  id?: string;
};
const route = (): Route => {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "lists" && parts[2] === "swipe")
    return { page: "swipe", id: parts[1] };
  if (parts[0] === "lists" && parts[2] === "tournament")
    return { page: "tournament", id: parts[1] };
  if (parts[0] === "lists" && parts[1]) return { page: "list", id: parts[1] };
  if (parts[0] === "result" && parts[1])
    return { page: "result", id: parts[1] };
  if (parts[0] === "vendors" && parts[1])
    return { page: "vendor", id: parts[1] };
  return { page: "home" };
};
const loadSession = (): DecisionSession | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
};

export function DecisionApp() {
  const catalog = useVendorCatalog();
  const [currentRoute, setCurrentRoute] = useState(route);
  const [remoteLists, setRemoteLists] = useState<DecisionList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [session, setSession] = useState<DecisionSession | null>(loadSession);
  const [message, setMessage] = useState("");
  const anonymousId = useMemo(getAnonymousUserId, []);
  const systemLists = buildSystemLists(catalog.vendors);
  const systemIds = new Set(systemLists.map((list) => list.id));
  const lists = [
    ...systemLists,
    ...remoteLists.filter(
      (list) => list.id !== "under-15" && !systemIds.has(list.id),
    ),
  ];
  const vendorMap = useMemo(
    () => new Map(catalog.vendors.map((v) => [v.id, v])),
    [catalog.vendors],
  );
  const go = (path: string) => {
    history.pushState({}, "", path);
    setCurrentRoute(route());
    scrollTo(0, 0);
  };
  const updateSession = (next: DecisionSession) => {
    setSession(next);
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };
  useEffect(() => {
    const pop = () => setCurrentRoute(route());
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    loadDecisionLists()
      .then(setRemoteLists)
      .catch(() => {})
      .finally(() => setListsLoading(false));
  }, []);
  useEffect(() => {
    if (
      !catalog.loading &&
      !catalog.loadingMore &&
      !catalog.error &&
      catalog.offset < catalog.total
    ) {
      catalog.loadMore();
    }
  }, [
    catalog.loading,
    catalog.loadingMore,
    catalog.error,
    catalog.offset,
    catalog.total,
    catalog.loadMore,
  ]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const list = lists.find((item) => item.id === currentRoute.id);
  const finish = (
    next: DecisionSession,
    vendorId: string,
    method: ResultMethod,
  ) => {
    const done = { ...next, resultVendorId: vendorId, resultMethod: method };
    updateSession(done);
    void saveDecisionResult(done, anonymousId).catch(() => {});
    go(`/result/${vendorId}`);
  };
  const start = (selected: DecisionList) => {
    const vendorIds = selected.vendorIds.filter((id) => vendorMap.has(id));
    if (!vendorIds.length) {
      setMessage("No available vendors in this list.");
      return;
    }
    const next = startSession({ ...selected, vendorIds });
    updateSession(next);
    void createDecisionSession(next, anonymousId).catch(() => {});
    void trackEvent("decision_started", anonymousId, {
      sessionId: next.id,
      listId: selected.id,
    });
    const mode = decisionStartMode(vendorIds.length);
    if (mode === "single") {
      go(`/vendors/${vendorIds[0]}`);
      return;
    }
    if (mode === "tournament") {
      const tournament = {
        ...next,
        tournamentRemaining: vendorIds,
        tournamentAdvancing: [],
        round: 1,
      };
      updateSession(tournament);
      void trackEvent("tournament_started", anonymousId, {
        sessionId: next.id,
        listId: selected.id,
      });
      go(`/lists/${selected.id}/tournament`);
      return;
    }
    go(`/lists/${selected.id}/swipe`);
  };

  let screen: React.ReactNode;
  if (
    catalog.loading ||
    (!catalog.error && catalog.offset < catalog.total) ||
    (listsLoading && !catalog.vendors.length)
  )
    screen = <State title="Loading lists…" />;
  else if (catalog.error && !catalog.vendors.length)
    screen = (
      <State
        title="We couldn't load vendors."
        detail="Check the connection and try again."
        action={() => location.reload()}
        actionLabel="Try Again"
      />
    );
  else if (currentRoute.page === "home")
    screen = (
      <Home
        lists={lists}
        onOpen={(id) => {
          void trackEvent("list_viewed", anonymousId, { listId: id });
          go(`/lists/${id}`);
        }}
        onRequest={async (value, query) => {
          await submitListRequest(value, query, anonymousId);
          setMessage("Your request has been submitted.");
          void trackEvent("list_requested", anonymousId, {
            metadata: { query },
          });
        }}
      />
    );
  else if (currentRoute.page === "list" && list)
    screen = (
      <ListDetail
        list={list}
        vendors={
          list.vendorIds
            .map((id) => vendorMap.get(id))
            .filter(Boolean) as Vendor[]
        }
        onBack={() => go("/")}
        onStart={() => start(list)}
        onVendor={(id) => go(`/vendors/${id}`)}
      />
    );
  else if (currentRoute.page === "swipe" && session?.listId === currentRoute.id)
    screen = (
      <Swipe
        session={session!}
        vendorMap={vendorMap}
        onBack={() => go(`/lists/${session!.listId}`)}
        onDecision={(interested) => {
          const vendorId = session!.vendorIds[session!.swipeIndex];
          const interestedIds = interested
            ? [...session!.interestedIds, vendorId]
            : session!.interestedIds;
          const next = {
            ...session!,
            interestedIds,
            swipeIndex: session!.swipeIndex + 1,
          };
          void trackEvent(
            interested ? "swipe_interested" : "swipe_not_for_me",
            anonymousId,
            { sessionId: session!.id, listId: session!.listId, vendorId },
          );
          if (next.swipeIndex < next.vendorIds.length)
            return updateSession(next);
          if (!interestedIds.length) return updateSession(next);
          if (interestedIds.length === 1)
            return finish(next, interestedIds[0], "swipe_single_remaining");
          const tournament = {
            ...next,
            tournamentRemaining: interestedIds,
            tournamentAdvancing: [],
            round: 1,
          };
          updateSession(tournament);
          void trackEvent("tournament_started", anonymousId, {
            sessionId: session!.id,
            listId: session!.listId,
          });
          go(`/lists/${session!.listId}/tournament`);
        }}
        onChoose={() =>
          finish(
            session!,
            session!.vendorIds[session!.swipeIndex],
            "choose_now_from_swipe",
          )
        }
        onExplore={() => go("/")}
      />
    );
  else if (
    currentRoute.page === "tournament" &&
    session?.listId === currentRoute.id
  )
    screen = (
      <Tournament
        session={session!}
        vendorMap={vendorMap}
        onBack={() =>
          go(
            session!.vendorIds.length <= 8
              ? `/lists/${session!.listId}`
              : `/lists/${session!.listId}/swipe`,
          )
        }
        onPick={(id) => {
          const next = advanceMatch(session!, id);
          void trackEvent("tournament_selection", anonymousId, {
            sessionId: session!.id,
            listId: session!.listId,
            vendorId: id,
          });
          if (next.resultVendorId)
            finish(next, next.resultVendorId, "tournament_winner");
          else updateSession(next);
        }}
        onChoose={(id) => finish(session!, id, "choose_now_from_tournament")}
        onVendor={(id) => go(`/vendors/${id}`)}
      />
    );
  else if (currentRoute.page === "result") {
    const vendor = vendorMap.get(currentRoute.id || "");
    screen = vendor ? (
      <Result
        vendor={vendor}
        method={
          session?.resultVendorId === vendor.id
            ? session.resultMethod
            : undefined
        }
        anonymousId={anonymousId}
        onVendor={() => go(`/vendors/${vendor.id}`)}
        onExplore={() => go("/")}
        onMessage={setMessage}
      />
    ) : (
      <State
        title="Result not found."
        action={() => go("/")}
        actionLabel="Explore Other Lists"
      />
    );
  } else if (currentRoute.page === "vendor") {
    const vendor = vendorMap.get(currentRoute.id || "");
    const isSingleDecision =
      vendor &&
      session?.vendorIds.length === 1 &&
      session.vendorIds[0] === vendor.id &&
      !session.resultVendorId;
    screen = vendor ? (
      <VendorDetails
        vendor={vendor}
        onBack={() =>
          isSingleDecision ? go(`/lists/${session!.listId}`) : history.back()
        }
        decisionActions={
          isSingleDecision
            ? {
                onChoose: () =>
                  finish(session!, vendor.id, "choose_now_from_tournament"),
                onPass: () => {
                  void trackEvent("single_vendor_passed", anonymousId, {
                    sessionId: session!.id,
                    listId: session!.listId,
                    vendorId: vendor.id,
                  });
                  go(`/lists/${session!.listId}`);
                },
              }
            : undefined
        }
      />
    ) : (
      <State
        title="Vendor not found."
        action={() => go("/")}
        actionLabel="Explore Lists"
      />
    );
  } else
    screen = (
      <State
        title="This decision session is unavailable."
        detail="Start again from a list."
        action={() => go("/")}
        actionLabel="Explore Other Lists"
      />
    );

  return (
    <main className="decision-app">
      <header className="decision-brand" onClick={() => go("/")}>
        <b>BITE PICKS</b>
        <span>Decide where to eat</span>
      </header>
      {screen}
      {message && (
        <div className="decision-toast" role="status">
          {message}
        </div>
      )}
    </main>
  );
}

function Home({
  lists,
  onOpen,
  onRequest,
}: {
  lists: DecisionList[];
  onOpen: (id: string) => void;
  onRequest: (value: string, query: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = lists.filter((list) =>
    [list.name, list.description, ...list.tags].some((value) =>
      value.toLowerCase().includes(query.toLowerCase().trim()),
    ),
  );
  const submit = async (value: string) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onRequest(value.trim(), query.trim());
      setRequest("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="decision-screen">
      <div className="decision-hero">
        <p>Your next meal, decided.</p>
        <h1>What sounds good?</h1>
      </div>
      <label className="decision-search">
        <span>Search lists</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Burgers, vegetarian, under $15…"
        />
      </label>
      <div className="decision-grid">
        {filtered.map((list) => (
          <button
            className="decision-list-card"
            key={list.id}
            onClick={() => onOpen(list.id)}
          >
            <span>{list.tags.slice(0, 2).join(" · ")}</span>
            <h2>{list.name}</h2>
            <p>{list.description}</p>
            <b>{list.vendorIds.length} vendors →</b>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="decision-empty">
          <h2>No lists found.</h2>
          <button onClick={() => submit(query)}>Request “{query}” list</button>
        </div>
      )}
      <form
        className="decision-request"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(request);
        }}
      >
        <h2>Can't find what you're looking for?</h2>
        <p>Request a list you want to explore.</p>
        <input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="List name or request"
        />
        <button disabled={!request.trim() || busy}>Submit</button>
      </form>
    </section>
  );
}

function ListDetail({
  list,
  vendors,
  onBack,
  onStart,
  onVendor,
}: {
  list: DecisionList;
  vendors: Vendor[];
  onBack: () => void;
  onStart: () => void;
  onVendor: (id: string) => void;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  return (
    <section className="decision-screen list-detail-screen">
      <div className="list-detail-toolbar">
        <Back onClick={onBack} />
        <button
          className="list-feedback-button"
          type="button"
          onClick={() => setFeedbackOpen((open) => !open)}
        >
          Send feedback
        </button>
      </div>
      <p className="eyebrow">{vendors.length} vendors</p>
      <h1>{list.name}</h1>
      <p className="lede">{list.description}</p>
      <aside className="list-disclaimer">
        These lists were inferred from menu names and may not be fully accurate.
        Please use them with caution. To suggest a correction, use the button in
        the upper-right corner.
      </aside>
      {feedbackOpen && (
        <form
          className="list-feedback-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!feedback.trim() || feedbackBusy) return;
            setFeedbackBusy(true);
            setFeedbackStatus("");
            try {
              await notifyFeedbackInbox({
                type: "list_feedback",
                listName: list.name,
                message: feedback.trim(),
                pageUrl: location.href,
              });
              setFeedback("");
              setFeedbackStatus("Your feedback has been sent.");
            } catch {
              setFeedbackStatus(
                "Feedback could not be sent. Please try again.",
              );
            } finally {
              setFeedbackBusy(false);
            }
          }}
        >
          <label>
            Suggest a correction
            <textarea
              required
              maxLength={2000}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us what should be corrected."
            />
          </label>
          <button
            className="decision-primary"
            disabled={feedbackBusy || !feedback.trim()}
          >
            {feedbackBusy ? "Sending…" : "Send"}
          </button>
          {feedbackStatus && <small role="status">{feedbackStatus}</small>}
        </form>
      )}
      <div className="vendor-stack">
        {vendors.map((v) => (
          <VendorCard key={v.id} vendor={v} onOpen={() => onVendor(v.id)} />
        ))}
      </div>
      <div className="decision-sticky">
        <button
          className="decision-primary"
          disabled={!vendors.length}
          onClick={onStart}
        >
          Start
        </button>
        {!vendors.length && <small>No available vendors in this list.</small>}
      </div>
    </section>
  );
}

function Swipe({
  session,
  vendorMap,
  onBack,
  onDecision,
  onChoose,
  onExplore,
}: {
  session: DecisionSession;
  vendorMap: Map<string, Vendor>;
  onBack: () => void;
  onDecision: (interested: boolean) => void;
  onChoose: () => void;
  onExplore: () => void;
}) {
  if (session.swipeIndex >= session.vendorIds.length)
    return (
      <State
        title="No matches this time."
        detail="Try another list and keep exploring."
        action={onExplore}
        actionLabel="Explore Other Lists"
      />
    );
  const vendor = vendorMap.get(session.vendorIds[session.swipeIndex]);
  if (!vendor)
    return (
      <State
        title="Vendor unavailable."
        action={() => onDecision(false)}
        actionLabel="Continue"
      />
    );
  return (
    <section className="decision-screen">
      <Back onClick={onBack} />
      <div className="decision-progress">
        <span>
          {session.swipeIndex + 1} of {session.vendorIds.length}
        </span>
        <span>{session.interestedIds.length} interested</span>
      </div>
      <progress value={session.swipeIndex + 1} max={session.vendorIds.length} />
      <article className="swipe-card">
        <VendorGallery vendor={vendor} compact />
        <p className="eyebrow">
          {vendor.cuisines.join(" · ") || vendor.vendorType}
        </p>
        <h1>{vendor.name}</h1>
        <h3>
          {vendor.menuItems.slice(0, 2).join(" · ") || "Menu coming soon"}
        </h3>
        <p>
          {vendor.description || "A Bite of Seattle vendor worth a quick look."}
        </p>
        <Location vendor={vendor} />
      </article>
      <div className="three-actions">
        <button onClick={() => onDecision(false)}>Not for me</button>
        <button className="decision-primary" onClick={() => onDecision(true)}>
          Interested
        </button>
      </div>
      <button className="text-button" onClick={onChoose}>
        Choose Now
      </button>
    </section>
  );
}

function Tournament({
  session,
  vendorMap,
  onBack,
  onPick,
  onChoose,
  onVendor,
}: {
  session: DecisionSession;
  vendorMap: Map<string, Vendor>;
  onBack: () => void;
  onPick: (id: string) => void;
  onChoose: (id: string) => void;
  onVendor: (id: string) => void;
}) {
  const candidates = session.tournamentRemaining
    .slice(0, 2)
    .map((id) => vendorMap.get(id))
    .filter(Boolean) as Vendor[];
  if (candidates.length < 2) return <State title="Preparing the next match…" />;
  return (
    <section className="decision-screen">
      <Back onClick={onBack} />
      <p className="eyebrow">Tournament · Round {session.round}</p>
      <h1>Choose one.</h1>
      <div className="match-grid">
        {candidates.map((v) => (
          <article key={v.id}>
            <p>{v.cuisines.join(" · ") || v.vendorType}</p>
            <h2>{v.name}</h2>
            <b>{v.menuItems.slice(0, 2).join(" · ") || "Menu coming soon"}</b>
            <Location vendor={v} />
            <button onClick={() => onVendor(v.id)}>Vendor details</button>
            <button className="decision-primary" onClick={() => onPick(v.id)}>
              Choose {v.name}
            </button>
            <button className="text-button" onClick={() => onChoose(v.id)}>
              Choose Now
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Result({
  vendor,
  method,
  anonymousId,
  onVendor,
  onExplore,
  onMessage,
}: {
  vendor: Vendor;
  method?: ResultMethod;
  anonymousId: string;
  onVendor: () => void;
  onExplore: () => void;
  onMessage: (value: string) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  return (
    <section className="decision-screen result-screen">
      <p className="eyebrow">Your pick</p>
      <div className="winner-mark">✓</div>
      <h1>{vendor.name}</h1>
      <VendorGallery vendor={vendor} />
      <p className="lede">
        {vendor.cuisines.join(" · ")} · {vendor.foodTypes.join(" · ")}
      </p>
      <h3>{vendor.menuItems.join(" · ") || "Menu coming soon"}</h3>
      <p>{vendor.description}</p>
      <Location vendor={vendor} directions />
      <p className="result-method">
        Chosen via {method?.replaceAll("_", " ") || "direct link"}
      </p>
      <div className="result-actions">
        {vendor.latitude != null && vendor.longitude != null && (
          <a
            className="decision-primary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${vendor.latitude},${vendor.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Get Directions
          </a>
        )}
        <button onClick={onVendor}>View Vendor Details</button>
        <button onClick={() => setReviewing(true)}>Add Review</button>
        <button onClick={onExplore}>Explore Other Lists</button>
      </div>
      {reviewing && (
        <ReviewForm
          vendor={vendor}
          anonymousId={anonymousId}
          onDone={() => {
            setReviewing(false);
            onMessage("Thanks — your review was submitted.");
          }}
        />
      )}
    </section>
  );
}
function VendorDetails({
  vendor,
  onBack,
  decisionActions,
}: {
  vendor: Vendor;
  onBack: () => void;
  decisionActions?: { onChoose: () => void; onPass: () => void };
}) {
  return (
    <section className="decision-screen">
      <Back onClick={onBack} />
      <p className="eyebrow">Vendor details</p>
      <h1>{vendor.name}</h1>
      <VendorGallery vendor={vendor} />
      <p className="lede">
        {vendor.cuisines.join(" · ")} · {vendor.foodTypes.join(" · ")}
      </p>
      <h2>Menu</h2>
      <ul>
        {vendor.menuItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{vendor.description || "More details are coming soon."}</p>
      <Location vendor={vendor} />
      {decisionActions && (
        <div className="three-actions">
          <button className="decision-primary" onClick={decisionActions.onChoose}>
            Choose
          </button>
          <button onClick={decisionActions.onPass}>Pass</button>
        </div>
      )}
      {vendor.instagramUrl && (
        <a href={vendor.instagramUrl} target="_blank" rel="noreferrer">
          View Instagram
        </a>
      )}
      <LineReporter vendor={vendor} />
    </section>
  );
}

function VendorCard({
  vendor,
  onOpen,
}: {
  vendor: Vendor;
  onOpen: () => void;
}) {
  return (
    <article className="vendor-card">
      <div>
        <span>{vendor.cuisines.join(" · ") || vendor.vendorType}</span>
        <h2>{vendor.name}</h2>
        <p>{vendor.foodTypes.join(" · ")}</p>
        <b>{vendor.menuItems.slice(0, 2).join(" · ") || "Menu coming soon"}</b>
        <Location vendor={vendor} />
      </div>
      <button onClick={onOpen}>Details</button>
    </article>
  );
}
function Location({
  vendor,
  directions = false,
}: {
  vendor: Vendor;
  directions?: boolean;
}) {
  const known = vendor.locationName || vendor.boothNumber || vendor.zone;
  return (
    <div className="location">
      <b>
        {known
          ? [
              vendor.locationName,
              vendor.zone,
              vendor.boothNumber && `Booth ${vendor.boothNumber}`,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Location coming soon"}
      </b>
      {!known && directions && (
        <span>
          Location will be updated when the festival map is available.
        </span>
      )}
    </div>
  );
}
function VendorGallery({
  vendor,
  compact = false,
}: {
  vendor: Vendor;
  compact?: boolean;
}) {
  const images =
    vendor.galleryImageUrls ??
    (vendor.featuredImageUrl ? [vendor.featuredImageUrl] : []);
  if (!images.length) return null;
  return (
    <div className={compact ? "vendor-gallery compact" : "vendor-gallery"}>
      {images.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={`${vendor.name} food ${index + 1}`}
          loading={index ? "lazy" : "eager"}
        />
      ))}
    </div>
  );
}
function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="decision-back" onClick={onClick}>
      ← Back
    </button>
  );
}
function State({
  title,
  detail,
  action,
  actionLabel,
}: {
  title: string;
  detail?: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <section className="decision-state">
      <h1>{title}</h1>
      {detail && <p>{detail}</p>}
      {action && (
        <button className="decision-primary" onClick={action}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

const positive = [
  "Great taste",
  "Good portion",
  "Good value",
  "Fast service",
  "Friendly service",
  "Worth the wait",
  "Good for sharing",
  "Would eat again",
];
const negative = [
  "Too expensive",
  "Small portion",
  "Long wait",
  "Not worth the wait",
  "Taste was not for me",
  "Food was cold",
  "Order issue",
  "Would not choose again",
];
function ReviewForm({
  vendor,
  anonymousId,
  onDone,
}: {
  vendor: Vendor;
  anonymousId: string;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<ReviewDraft>({
    recommendation: "recommend",
    menuName: "",
    reasons: [],
    comment: "",
    price: "",
    visitedAt: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reasons = draft.recommendation === "recommend" ? positive : negative;
  const patch = (value: Partial<ReviewDraft>) =>
    setDraft((d) => ({ ...d, ...value }));
  return (
    <form
      className="review-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await submitReview(vendor.id, anonymousId, draft, photos);
          void trackEvent("review_submitted", anonymousId, {
            vendorId: vendor.id,
          });
          onDone();
        } catch {
          setError("Review could not be submitted. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Add Review</h2>
      <div className="toggle">
        <button
          type="button"
          className={draft.recommendation === "recommend" ? "active" : ""}
          onClick={() => patch({ recommendation: "recommend", reasons: [] })}
        >
          Recommend
        </button>
        <button
          type="button"
          className={draft.recommendation === "not_recommend" ? "active" : ""}
          onClick={() =>
            patch({ recommendation: "not_recommend", reasons: [] })
          }
        >
          Not Recommend
        </button>
      </div>
      <label>
        What did you try?
        <input
          required
          value={draft.menuName}
          onChange={(e) => patch({ menuName: e.target.value })}
        />
      </label>
      <div className="reason-grid">
        {reasons.map((reason) => (
          <label key={reason}>
            <input
              type="checkbox"
              checked={draft.reasons.includes(reason)}
              onChange={() =>
                patch({
                  reasons: draft.reasons.includes(reason)
                    ? draft.reasons.filter((r) => r !== reason)
                    : [...draft.reasons, reason],
                })
              }
            />
            {reason}
          </label>
        ))}
      </div>
      <label>
        Short comment
        <textarea
          value={draft.comment}
          onChange={(e) => patch({ comment: e.target.value })}
        />
      </label>
      <label>
        Price
        <input
          value={draft.price}
          onChange={(e) => patch({ price: e.target.value })}
        />
      </label>
      <label>
        Visit time
        <div className="visit-time-input">
          <input
            type="datetime-local"
            value={draft.visitedAt}
            onChange={(e) => patch({ visitedAt: e.target.value })}
          />
          <button
            type="button"
            onClick={() => patch({ visitedAt: localDateTimeValue(new Date()) })}
          >
            Now
          </button>
        </div>
      </label>
      <label>
        Photos (up to 3)
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const selected = [...(e.target.files ?? [])].slice(0, 3);
            if (selected.some((f) => f.size > 5_000_000)) {
              setError("Each photo must be 5 MB or smaller.");
              return;
            }
            setPhotos(selected);
          }}
        />
      </label>
      <small>
        Upload only photos you took yourself. Do not upload identifiable people
        without permission. Photos may be reviewed before display.
      </small>
      {error && <p className="form-error">{error}</p>}
      <button className="decision-primary" disabled={busy}>
        {busy ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function LineReporter({ vendor }: { vendor: Vendor }) {
  const anonymousId = useMemo(getAnonymousUserId, []);
  const [message, setMessage] = useState("");
  const report = (status: string) => {
    if (!navigator.geolocation)
      return setMessage("Location permission is required to report a line.");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (position.coords.accuracy > 200)
          return setMessage(
            "Location accuracy is too low. Move closer and try again.",
          );
        if (vendor.latitude == null || vendor.longitude == null)
          return setMessage(
            "Line reporting will open when vendor locations are available.",
          );
        const distance = Math.hypot(
          (position.coords.latitude - vendor.latitude) * 111000,
          (position.coords.longitude - vendor.longitude) * 85000,
        );
        if (distance > 500)
          return setMessage(
            "You need to be near the festival to report a line.",
          );
        try {
          await submitLineReport(vendor.id, anonymousId, status, true);
          setMessage("Line status submitted.");
        } catch {
          setMessage("Could not submit the report.");
        }
      },
      () => setMessage("Location permission is required to report a line."),
      { enableHighAccuracy: true },
    );
  };
  return (
    <section className="line-panel">
      <h2>Current line</h2>
      <p>{vendor.lineStatus || "Not enough recent reports"}</p>
      <div>
        {["No line", "Short", "Medium", "Long", "Sold out"].map((status) => (
          <button key={status} onClick={() => report(status)}>
            {status}
          </button>
        ))}
      </div>
      {message && <small>{message}</small>}
    </section>
  );
}
