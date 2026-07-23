import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Truck } from "lucide-react";
import type { Vendor } from "../types";
import { useVendorCatalog } from "../hooks/useVendorCatalog";
import { getVendorGalleryImages } from "../lib/vendors";
import { FALLBACK_ACCENT_COLOR, getReadableTextColor, withAlpha } from "../lib/accentColor";
import {
  advanceMatch,
  buildSystemLists,
  decisionStartMode,
  getAnonymousUserId,
  getClientSessionId,
  SESSION_KEY,
  startSession,
  type DecisionList,
  type DecisionSession,
  type ResultMethod,
} from "./model";
import {
  createDecisionSession,
  completeAnalyticsSession,
  loadDecisionLists,
  notifyFeedbackInbox,
  saveDecisionResult,
  startAnalyticsSession,
  submitLineReport,
  submitListRequest,
  submitReview,
  submitValidationResponse,
  trackEvent,
  type ReviewDraft,
} from "./api";
import "./decision.css";

const SWIPE_THRESHOLD = 100;
const SWIPE_EXIT_DISTANCE = 560;

const CATEGORY_EMOJI: Record<string, string> = {
  "American Food": "🇺🇸",
  "Chinese Food": "🇨🇳",
  "Korean Food": "🇰🇷",
  "Japanese Food": "🇯🇵",
  "Thai Food": "🇹🇭",
  "Vietnamese Food": "🇻🇳",
  "Filipino Food": "🇵🇭",
  "Indian Food": "🇮🇳",
  "Mexican & Latin American Food": "🇲🇽",
  "Middle Eastern Food": "🧆",
  "African Food": "🌍",
  "Caribbean Food": "🏝️",
  "Hawaiian / Pacific Islander Food": "🌺",
  "Burmese Food": "🇲🇲",
  "Fusion / Mixed Cuisine": "🔀",
  "Vegan-Friendly": "🌱",
  "Vegetarian-Friendly": "🥦",
  Halal: "☪️",
  Dessert: "🍰",
  "Desserts & Sweets": "🍰",
  "Spicy Food": "🌶️",
  "Kid-Friendly": "🎈",
  Drinks: "🥤",
  Beverages: "🥤",
  Seafood: "🦐",
  "BBQ / Grilled": "🍖",
  "Gluten-Free-Leaning": "🌾",
  "Dairy-Free-Leaning": "🥛",
};
const categoryEmoji = (list: DecisionList) => CATEGORY_EMOJI[list.name] ?? "🍴";

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
  const startInFlight = useRef(false);
  const finishInFlight = useRef(false);
  const anonymousId = useMemo(getAnonymousUserId, []);
  const clientSessionId = useMemo(getClientSessionId, []);
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
    void startAnalyticsSession(clientSessionId, anonymousId)
      .then(() =>
        trackEvent("session_started", anonymousId, {
          metadata: { clientSessionId },
        }),
      )
      .catch(() => {});
    const completeVisit = () => {
      void completeAnalyticsSession(clientSessionId, anonymousId).catch(
        () => {},
      );
    };
    addEventListener("pagehide", completeVisit);
    return () => {
      removeEventListener("pagehide", completeVisit);
    };
  }, [anonymousId, clientSessionId]);
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
  const finish = async (
    next: DecisionSession,
    vendorId: string,
    method: ResultMethod,
  ) => {
    if (finishInFlight.current) return;
    finishInFlight.current = true;
    const done = { ...next, resultVendorId: vendorId, resultMethod: method };
    const decisionMethod =
      done.vendorIds.length === 1
        ? "single"
        : method.startsWith("choose_now")
          ? "choose_now"
          : method === "swipe_single_remaining"
            ? "swipe"
            : done.vendorIds.length > 8
              ? "swipe_then_tournament"
              : "tournament";
    try {
      await saveDecisionResult(done, anonymousId, decisionMethod);
      updateSession(done);
      const completionEvent =
        method === "tournament_winner"
          ? "tournament_completed"
          : method === "swipe_single_remaining"
            ? "swipe_completed"
            : method === "choose_now_from_swipe"
              ? "choose_now_swipe"
              : "choose_now_tournament";
      void trackEvent(completionEvent, anonymousId, {
        sessionId: done.id,
        listId: done.listId,
        vendorId,
        metadata: { decisionMethod },
      }).catch(() => {});
      go(`/result/${vendorId}`);
    } catch {
      setMessage("We couldn't save your decision. Please try again.");
    } finally {
      finishInFlight.current = false;
    }
  };
  const start = async (selected: DecisionList) => {
    if (startInFlight.current) return;
    const vendorIds = selected.vendorIds.filter((id) => vendorMap.has(id));
    if (!vendorIds.length) {
      setMessage("No available vendors in this list.");
      return;
    }
    const next = startSession({ ...selected, vendorIds });
    const mode = decisionStartMode(vendorIds.length);
    startInFlight.current = true;
    try {
      await startAnalyticsSession(clientSessionId, anonymousId);
      await createDecisionSession(
        next,
        anonymousId,
        clientSessionId,
        vendorIds.length,
        mode,
      );
    } catch {
      setMessage("We couldn't start your decision. Please try again.");
      return;
    } finally {
      startInFlight.current = false;
    }
    updateSession(next);
    void trackEvent("decision_started", anonymousId, {
      sessionId: next.id,
      listId: selected.id,
      metadata: { initialVendorCount: vendorIds.length, decisionMethod: mode },
    }).catch(() => {});
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
      }).catch(() => {});
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
        vendorMap={vendorMap}
        onOpen={(id) => {
          void trackEvent("list_viewed", anonymousId, { listId: id }).catch(
            () => {},
          );
          go(`/lists/${id}`);
        }}
        onOpenVendor={(id) => go(`/vendors/${id}`)}
        onRequest={async (value, query) => {
          await submitListRequest(value, query, anonymousId);
          setMessage("Your request has been submitted.");
          void trackEvent("list_requested", anonymousId, {
            metadata: { query },
          }).catch(() => {});
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
        key={session!.swipeIndex}
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
          ).catch(() => {});
          if (next.swipeIndex < next.vendorIds.length)
            return updateSession(next);
          if (!interestedIds.length) return updateSession(next);
          if (interestedIds.length === 1)
            return void finish(next, interestedIds[0], "swipe_single_remaining");
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
          }).catch(() => {});
          go(`/lists/${session!.listId}/tournament`);
        }}
        onChoose={() =>
          confirm("End now and make this vendor your final pick?") &&
          void finish(session!, session!.vendorIds[session!.swipeIndex], "choose_now_from_swipe")
        }
        onStartTournament={() => {
          const interestedIds = session!.interestedIds;
          if (interestedIds.length === 1)
            return void finish(session!, interestedIds[0], "swipe_single_remaining");
          const tournament = {
            ...session!,
            tournamentRemaining: interestedIds,
            tournamentAdvancing: [],
            round: 1,
          };
          updateSession(tournament);
          void trackEvent("tournament_started", anonymousId, {
            sessionId: session!.id,
            listId: session!.listId,
          }).catch(() => {});
          go(`/lists/${session!.listId}/tournament`);
        }}
        onSkipAhead={() =>
          updateSession({
            ...session!,
            swipeIndex: Math.min(session!.swipeIndex + 10, session!.vendorIds.length - 1),
          })
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
          }).catch(() => {});
          if (next.resultVendorId)
            void finish(next, next.resultVendorId, "tournament_winner");
          else updateSession(next);
        }}
        onChoose={(id) => {
          if (confirm("End the match now and make this vendor your final pick?"))
            void finish(session!, id, "choose_now_from_tournament");
        }}
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
        decisionSessionId={
          session?.resultVendorId === vendor.id ? session.id : undefined
        }
        listId={
          session?.resultVendorId === vendor.id ? session.listId : undefined
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
                  void finish(session!, vendor.id, "choose_now_from_tournament"),
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
        <span className="decision-dates">Jul 24 – Jul 26</span>
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

type SortOrder = "featured" | "most-vendors" | "fewest-vendors" | "name";

function Home({
  lists,
  vendorMap,
  onOpen,
  onOpenVendor,
  onRequest,
}: {
  lists: DecisionList[];
  vendorMap: Map<string, Vendor>;
  onOpen: (id: string) => void;
  onOpenVendor: (id: string) => void;
  onRequest: (value: string, query: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("featured");
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");
  const search = query.toLowerCase().trim();
  const systemLists = lists.filter((list) => list.tags.includes("all"));
  const sortedOtherLists = [...lists.filter((list) => !list.tags.includes("all"))].sort(
    (a, b) => {
      if (sort === "most-vendors") return b.vendorIds.length - a.vendorIds.length;
      if (sort === "fewest-vendors") return a.vendorIds.length - b.vendorIds.length;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0;
    },
  );
  const browsing = !search;
  const matchedLists = search
    ? lists.filter((list) =>
        [list.name, list.description, ...list.tags].some((value) =>
          value.toLowerCase().includes(search),
        ),
      )
    : [];
  const allVendors = [...vendorMap.values()];
  const matchedByName = search
    ? allVendors.filter((vendor) => vendor.name.toLowerCase().includes(search))
    : [];
  const matchedByMenu = search
    ? allVendors.filter(
        (vendor) =>
          !matchedByName.includes(vendor) &&
          vendor.menuItems.some((item) => item.toLowerCase().includes(search)),
      )
    : [];
  const noResults =
    search &&
    !matchedLists.length &&
    !matchedByName.length &&
    !matchedByMenu.length;
  const submit = async (value: string) => {
    if (busy) return;
    if (!value.trim()) {
      setRequestStatus("Enter a list name or request first.");
      return;
    }
    setBusy(true);
    setRequestStatus("");
    try {
      await onRequest(value.trim(), query.trim());
      setRequest("");
      setRequestStatus("Your request has been submitted.");
    } catch {
      setRequestStatus("Your request could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const Card = ({ list }: { list: DecisionList }) => (
    <button
      className="decision-list-card"
      key={list.id}
      onClick={() => onOpen(list.id)}
    >
      <div className="decision-card-emoji" aria-hidden="true">
        {categoryEmoji(list)}
      </div>
      <span>{list.tags.slice(0, 2).join(" · ")}</span>
      <h2>{list.name}</h2>
      <b>{list.vendorIds.length} vendors →</b>
    </button>
  );
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
          placeholder="Burgers, vegetarian…"
        />
      </label>
      {browsing ? (
        <>
          {systemLists.length > 0 && (
            <div className="decision-quick-list">
              {systemLists.map((list) => (
                <button
                  key={list.id}
                  className="decision-quick-row"
                  onClick={() => onOpen(list.id)}
                >
                  <span>{list.name}</span>
                  <b>{list.vendorIds.length} →</b>
                </button>
              ))}
            </div>
          )}
          <div className="decision-section-header">
            <h3>Browse by category</h3>
            <label className="decision-sort">
              <span>Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
              >
                <option value="featured">Featured</option>
                <option value="most-vendors">Most vendors</option>
                <option value="fewest-vendors">Fewest vendors</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </label>
          </div>
          <div className="decision-grid">
            {sortedOtherLists.map((list) => (
              <Card key={list.id} list={list} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="decision-result-group">
            <h3 className="decision-section-header">Lists</h3>
            {matchedLists.length ? (
              <div className="decision-grid">
                {matchedLists.map((list) => (
                  <Card key={list.id} list={list} />
                ))}
              </div>
            ) : (
              <p className="decision-empty-note">No matching lists.</p>
            )}
          </div>
          <div className="decision-result-group">
            <h3 className="decision-section-header">Vendors</h3>
            {matchedByName.length ? (
              <div className="vendor-stack">
                {matchedByName.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onOpen={() => onOpenVendor(vendor.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="decision-empty-note">No matching vendors.</p>
            )}
          </div>
          <div className="decision-result-group">
            <h3 className="decision-section-header">Menu items</h3>
            {matchedByMenu.length ? (
              <div className="vendor-stack">
                {matchedByMenu.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onOpen={() => onOpenVendor(vendor.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="decision-empty-note">No matching menu items.</p>
            )}
          </div>
        </>
      )}
      {noResults && (
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
        <button disabled={busy}>{busy ? "Submitting…" : "Submit"}</button>
        {requestStatus && <small role="status">{requestStatus}</small>}
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
          Start Choosing
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
  onStartTournament,
  onSkipAhead,
  onExplore,
}: {
  session: DecisionSession;
  vendorMap: Map<string, Vendor>;
  onBack: () => void;
  onDecision: (interested: boolean) => void;
  onChoose: () => void;
  onStartTournament: () => void;
  onSkipAhead: () => void;
  onExplore: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<"like" | "skip" | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);

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

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (exiting) return;
    dragging.current = true;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    setDragX(event.clientX - startX.current);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX > SWIPE_THRESHOLD) {
      setExiting("like");
      setDragX(SWIPE_EXIT_DISTANCE);
      window.setTimeout(() => onDecision(true), 220);
    } else if (dragX < -SWIPE_THRESHOLD) {
      setExiting("skip");
      setDragX(-SWIPE_EXIT_DISTANCE);
      window.setTimeout(() => onDecision(false), 220);
    } else {
      setDragX(0);
    }
  };
  const rotation = dragX / 18;
  const likeOpacity = Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1);
  const skipOpacity = Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1);

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
      <article
        className="swipe-card"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition: dragging.current ? "none" : "transform .25s ease",
          touchAction: "pan-y",
        }}
      >
        <span className="swipe-badge swipe-badge-like" style={{ opacity: likeOpacity }}>
          Interested
        </span>
        <span className="swipe-badge swipe-badge-skip" style={{ opacity: skipOpacity }}>
          Not for me
        </span>
        <VendorGallery vendor={vendor} compact />
        <p className="eyebrow">
          {vendor.cuisines.join(" · ") || vendor.vendorType}
        </p>
        <h1>{vendor.name}</h1>
        <h3>
          {vendor.menuItems.slice(0, 2).join(" · ") || "Menu coming soon"}
        </h3>
        {vendor.description && <p>{vendor.description}</p>}
        <Location vendor={vendor} />
      </article>
      <p className="swipe-hint">
        ← Swipe left if not for you &nbsp;·&nbsp; Swipe right if interested →
      </p>
      <div className="swipe-secondary-actions">
        {session.interestedIds.length > 0 && (
          <button className="start-tournament-button" onClick={onStartTournament}>
            Start tournament now ({session.interestedIds.length})
          </button>
        )}
        {session.vendorIds.length - session.swipeIndex > 11 && (
          <button className="text-button" onClick={onSkipAhead}>Skip ahead 10</button>
        )}
        <button className="text-button danger-text-button" onClick={onChoose}>
          End here with this vendor…
        </button>
      </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => setSelectedId(null), [session.tournamentRemaining]);
  if (candidates.length < 2) return <State title="Preparing the next match…" />;

  const handleSelect = (id: string) => {
    if (selectedId) return;
    setSelectedId(id);
    window.setTimeout(() => onPick(id), 180);
  };

  return (
    <section className="decision-screen tournament-screen">
      <Back onClick={onBack} />
      <p className="eyebrow">Match · Round {session.round}</p>
      <h1>Choose one.</h1>
      <div className="match-grid">
        {candidates.map((v) => (
          <MatchPanel
            key={v.id}
            vendor={v}
            selected={selectedId === v.id}
            muted={selectedId !== null && selectedId !== v.id}
            onSelect={() => handleSelect(v.id)}
            onVendor={() => onVendor(v.id)}
            onChoose={() => onChoose(v.id)}
          />
        ))}
        <div
          className="match-vs"
          aria-hidden="true"
          style={
            {
              "--vs-a": candidates[0]?.accentColor || FALLBACK_ACCENT_COLOR,
              "--vs-b": candidates[1]?.accentColor || FALLBACK_ACCENT_COLOR,
            } as CSSProperties
          }
        >
          VS
        </div>
      </div>
    </section>
  );
}

function MatchPanel({
  vendor,
  selected,
  muted,
  onSelect,
  onVendor,
  onChoose,
}: {
  vendor: Vendor;
  selected: boolean;
  muted: boolean;
  onSelect: () => void;
  onVendor: () => void;
  onChoose: () => void;
}) {
  const accent = vendor.accentColor || FALLBACK_ACCENT_COLOR;
  const accentText = getReadableTextColor(accent);
  const category = vendor.cuisines.join(" · ") || vendor.vendorType;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };
  const withStop = (event: MouseEvent, action: () => void) => {
    event.stopPropagation();
    action();
  };

  return (
    <article
      className={`match-panel${selected ? " is-selected" : ""}${muted ? " is-muted" : ""}`}
      style={
        {
          "--accent": accent,
          "--accent-fg": accentText,
          "--accent-ring": withAlpha(accent, 0.35),
        } as CSSProperties
      }
      role="button"
      tabIndex={0}
      aria-label={`Choose ${vendor.name}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {vendor.featuredImageUrl ? (
        <img className="match-panel-image" src={vendor.featuredImageUrl} alt="" loading="eager" />
      ) : (
        <div className="match-panel-fallback">
          <Truck aria-hidden="true" />
          <span>Community photo needed</span>
        </div>
      )}
      <div className="match-panel-scrim" />
      <span className="match-panel-badge">{category}</span>
      <div className="match-panel-body">
        <h2>{vendor.name}</h2>
        <b>{vendor.menuItems.slice(0, 2).join(" · ") || "Menu coming soon"}</b>
        <button className="match-panel-link" onClick={(event) => withStop(event, onVendor)}>
          Vendor details
        </button>
      </div>
      <button
        className="match-panel-end text-button"
        onClick={(event) => withStop(event, onChoose)}
      >
        End match with this vendor…
      </button>
    </article>
  );
}

function Result({
  vendor,
  method,
  decisionSessionId,
  listId,
  anonymousId,
  onVendor,
  onExplore,
  onMessage,
}: {
  vendor: Vendor;
  method?: ResultMethod;
  decisionSessionId?: string;
  listId?: string;
  anonymousId: string;
  onVendor: () => void;
  onExplore: () => void;
  onMessage: (value: string) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const resultViewTracked = useRef(false);
  useEffect(() => {
    if (resultViewTracked.current) return;
    resultViewTracked.current = true;
    void trackEvent("result_viewed", anonymousId, {
      sessionId: decisionSessionId,
      listId,
      vendorId: vendor.id,
      metadata: { resultMethod: method ?? "shared_or_direct" },
    }).catch(() => {});
  }, [anonymousId, decisionSessionId, listId, method, vendor.id]);
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
        {resultMethodLabel(method)}
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
      {decisionSessionId && (
        <ValidationSurvey
          decisionSessionId={decisionSessionId}
          listId={listId}
          vendorId={vendor.id}
          anonymousId={anonymousId}
        />
      )}
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

function ValidationSurvey({
  decisionSessionId,
  listId,
  vendorId,
  anonymousId,
}: {
  decisionSessionId: string;
  listId?: string;
  vendorId: string;
  anonymousId: string;
}) {
  const [easeScore, setEaseScore] = useState<1 | 2 | 3 | 4 | 5>();
  const [comparison, setComparison] = useState<
    "easier" | "same" | "harder"
  >();
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (submitted)
    return (
      <section className="validation-survey validation-thanks" role="status">
        <h2>Thanks for your feedback</h2>
        <p>Your response helps us make choosing easier.</p>
      </section>
    );

  return (
    <form
      className="validation-survey"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!easeScore || !comparison || submitting) return;
        setSubmitting(true);
        setError("");
        try {
          await submitValidationResponse(decisionSessionId, anonymousId, {
            easeScore,
            easierThanUsual: comparison,
            wouldUseAgain,
          });
          setSubmitted(true);
          void trackEvent("validation_submitted", anonymousId, {
            sessionId: decisionSessionId,
            listId,
            vendorId,
            metadata: { easeScore, easierThanUsual: comparison, wouldUseAgain },
          }).catch(() => {});
        } catch {
          setError("Your response couldn't be saved. Please try again.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <p className="eyebrow">Two quick questions</p>
      <h2>Did Bite Picks make choosing easier?</h2>
      <fieldset>
        <legend>How easy was choosing today?</legend>
        <div className="validation-options five-point">
          {([1, 2, 3, 4, 5] as const).map((score) => (
            <button
              type="button"
              key={score}
              className={easeScore === score ? "active" : ""}
              aria-pressed={easeScore === score}
              onClick={() => setEaseScore(score)}
            >
              <b>{score}</b>
              <span>{score === 1 ? "Very hard" : score === 5 ? "Very easy" : ""}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Compared with your usual way, was this easier?</legend>
        <div className="validation-options">
          {(["easier", "same", "harder"] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={comparison === value ? "active" : ""}
              aria-pressed={comparison === value}
              onClick={() => setComparison(value)}
            >
              {value === "easier" ? "Easier" : value === "same" ? "About the same" : "Harder"}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Would you use this service again? <small>Optional</small></legend>
        <div className="validation-options">
          <button type="button" className={wouldUseAgain === true ? "active" : ""} aria-pressed={wouldUseAgain === true} onClick={() => setWouldUseAgain(true)}>Yes</button>
          <button type="button" className={wouldUseAgain === false ? "active" : ""} aria-pressed={wouldUseAgain === false} onClick={() => setWouldUseAgain(false)}>No</button>
        </div>
      </fieldset>
      {error && <p className="form-error">{error}</p>}
      <button className="decision-primary" disabled={!easeScore || !comparison || submitting}>
        {submitting ? "Submitting…" : "Submit Feedback"}
      </button>
    </form>
  );
}

function resultMethodLabel(method?: ResultMethod) {
  const labels: Record<ResultMethod, string> = {
    choose_now_from_swipe: "Picked early during swipe",
    choose_now_from_tournament: "Picked early during the match",
    swipe_single_remaining: "Selected from your interested vendors",
    tournament_winner: "Selected as the match winner",
  };
  return method ? labels[method] : "Shared pick";
}

function VendorDetails({
  vendor,
  onBack,
  decisionActions,
}: {
  vendor: Vendor;
  onBack: () => void;
  decisionActions?: { onChoose: () => void };
}) {
  return (
    <section className="decision-screen">
      <Back onClick={onBack} />
      <p className="eyebrow">Vendor details</p>
      <div className="vendor-title-row">
        <h1>{vendor.name}</h1>
        {vendor.instagramUrl && (
          <a className="vendor-instagram-link" href={vendor.instagramUrl} target="_blank" rel="noreferrer" aria-label={`Open ${vendor.name} on Instagram`} title="View on Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
        )}
      </div>
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
          <small>This is the only option in this list.</small>
        </div>
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
  const thumb = vendor.featuredImageUrl ?? vendor.galleryImageUrls?.[0];
  return (
    <article className="vendor-card">
      {thumb && (
        <img
          className="vendor-card-thumb"
          src={thumb}
          alt={`${vendor.name} food`}
          loading="lazy"
        />
      )}
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
  if (!known && !directions) return null;
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
          Booth locations will be added once the festival map is available
          (Jul 24–26).
        </span>
      )}
    </div>
  );
}
function useVendorImages(vendor: Vendor) {
  const initialImages =
    vendor.galleryImageUrls ??
    (vendor.featuredImageUrl ? [vendor.featuredImageUrl] : []);
  const [images, setImages] = useState(initialImages);
  useEffect(() => {
    let active = true;
    setImages(initialImages);
    void getVendorGalleryImages(vendor).then((next) => {
      if (active) setImages(next);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id, vendor.imagePath, vendor.galleryImageUrls, vendor.featuredImageUrl]);
  return images;
}
function VendorGallery({
  vendor,
  compact = false,
}: {
  vendor: Vendor;
  compact?: boolean;
}) {
  const images = useVendorImages(vendor);
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
          }).catch(() => {});
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
        <div className="visit-time-input" aria-label="Visit date and time">
          <input
            type="date"
            aria-label="Visit date"
            value={draft.visitedAt.slice(0, 10)}
            onChange={(e) => patch({ visitedAt: combineVisitDateTime(e.target.value, draft.visitedAt.slice(11, 16)) })}
          />
          <input
            type="time"
            aria-label="Visit time"
            value={draft.visitedAt.slice(11, 16)}
            onChange={(e) => patch({ visitedAt: combineVisitDateTime(draft.visitedAt.slice(0, 10), e.target.value) })}
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
            const selected = [...(e.target.files ?? [])];
            if (selected.length > 3) {
              setError("You can upload up to 3 photos.");
              e.target.value = "";
              return;
            }
            if (selected.some((f) => f.size > 5_000_000)) {
              setError("Each photo must be 5 MB or smaller.");
              e.target.value = "";
              return;
            }
            setError("");
            setPhotos(selected);
          }}
        />
      </label>
      <SelectedPhotoGrid files={photos} onRemove={(index) => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
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

function SelectedPhotoGrid({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  if (!files.length) return null;
  return (
    <div className="selected-photo-grid" aria-label={`${files.length} selected photos`}>
      {files.map((file, index) => (
        <figure key={`${file.name}-${file.lastModified}`}>
          <img src={previews[index]} alt={`Selected photo ${index + 1}`} />
          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => onRemove(index)}>×</button>
        </figure>
      ))}
    </div>
  );
}
function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function combineVisitDateTime(date: string, time: string) {
  if (!date && !time) return "";
  return `${date || localDateTimeValue(new Date()).slice(0, 10)}T${time || "12:00"}`;
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
