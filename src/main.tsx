import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bookmark, Compass, Heart, User } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import * as AppModals from "./components/AppModals";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { VendorDetailScreen } from "./screens/VendorDetailScreen";
import { SwipeResultsScreen, SwipeScreen } from "./screens/SwipeScreen";
import { TournamentScreen } from "./screens/TournamentScreen";
import { ListScreen } from "./screens/ListScreen";
import {
  LikedScreen,
  ListsScreen,
  PicksScreen,
  ProfileScreen,
} from "./screens/DashboardScreens";
import {
  applyLineReport,
  findRecentDeviceReport,
  lineReportMessages,
  type WaitReport,
} from "./features/lineReports";
import { useVendorCatalog } from "./hooks/useVendorCatalog";
import { useVendorReviews } from "./hooks/useVendorReviews";
import { useGameFlow } from "./hooks/useGameFlow";
import { useRemoteLists } from "./hooks/useRemoteLists";
import { readStorage, usePersistentState, writeStorage } from "./lib/storage";
import { deleteVendorImage, uploadVendorImage } from "./lib/vendorImages";
import {
  cleanIssues,
  cleanLists,
  cleanReports,
  cleanStringArray,
} from "./lib/cacheNormalization";
import type { UserList, Vendor } from "./types";
import "./styles.css";
import "./refinements.css";

type Route = { name: string; id?: string };
type SaveRequest = {
  vendorIds: string[];
  sourceListId?: string;
  removeFromSource?: boolean;
  title: string;
};
type SnackbarState = { message: string; undo?: () => void };
const MAX_LOCAL_EVENTS = 200;
const starterLists = (vendors: Vendor[]) => ({
  starter: {
    id: "seattle-picks",
    title: "My Seattle Picks",
    description: "My favorite food vendors at Bite of Seattle.",
    vendorIds: [],
    visibility: "private",
    fetches: 0,
  } as UserList,
  publicLists: [
    {
      id: "spicy",
      title: "Seattle Flavor Tour",
      description: "Bold flavors from across the festival.",
      vendorIds: vendors
        .filter((v) =>
          v.foodTypes.some((x) =>
            ["Korean Food", "Tacos", "Ramen"].includes(x),
          ),
        )
        .slice(0, 10)
        .map((v) => v.id),
      visibility: "public",
      fetches: 0,
    },
    {
      id: "desserts",
      title: "Dessert Walk",
      description: "A sweet route through the festival.",
      vendorIds: vendors
        .filter((v) => v.vendorType === "dessert")
        .slice(0, 10)
        .map((v) => v.id),
      visibility: "public",
      fetches: 0,
    },
    {
      id: "play",
      title: "Shop & Play",
      description: "Shopping and games worth checking out.",
      vendorIds: vendors
        .filter((v) => v.vendorType === "shopping" || v.vendorType === "game")
        .slice(0, 10)
        .map((v) => v.id),
      visibility: "public",
      fetches: 0,
    },
  ] as UserList[],
});
let fallbackDeviceId: string | undefined;
const newDeviceId = () =>
  crypto.randomUUID?.() ??
  `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const getDeviceId = () => {
  try {
    const existing = localStorage.getItem("bos-device-id");
    if (existing) return existing;
    const id = newDeviceId();
    localStorage.setItem("bos-device-id", id);
    return id;
  } catch {
    return (fallbackDeviceId ??= newDeviceId());
  }
};
const eventTimeParts = (now = new Date()) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
const photoUploadsAreOpen = (now = new Date()) => {
  const parts = eventTimeParts(now);
  return (
    parts.year === 2026 &&
    parts.month === 7 &&
    parts.day >= 24 &&
    parts.day <= 26
  );
};
const lineReportsAreOpen = (now = new Date()) => {
  const parts = eventTimeParts(now);
  return (
    parts.year === 2026 &&
    parts.month === 7 &&
    parts.day >= 24 &&
    parts.day <= 26 &&
    parts.hour >= 11 &&
    parts.hour < 20
  );
};
const routeFromHash = (): Route => {
  const hash = location.hash.slice(1);
  for (const name of ["vendor", "list", "shared", "result"])
    if (hash.startsWith(name + "-"))
      return { name, id: hash.slice(name.length + 1) };
  return {
    name: [
      "discover",
      "lists",
      "picks",
      "profile",
      "liked",
      "swipe",
      "tournament",
    ].includes(hash)
      ? hash
      : "discover",
  };
};
const encodeSharedList = (list: UserList) =>
  btoa(
    encodeURIComponent(
      JSON.stringify({
        id: `shared-${list.id}`,
        title: list.title,
        description: list.description,
        vendorIds: list.vendorIds,
        visibility: list.visibility,
        fetches: list.fetches,
        remoteId: list.remoteId,
      }),
    ),
  );
const decodeSharedList = (value?: string): UserList | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(value || "")));
    return parsed &&
      typeof parsed.title === "string" &&
      Array.isArray(parsed.vendorIds)
      ? {
          id: String(parsed.id || "shared-list"),
          title: parsed.title,
          description: String(parsed.description || ""),
          vendorIds: parsed.vendorIds.filter(
            (id: unknown) => typeof id === "string",
          ),
          visibility: parsed.visibility === "public" ? "public" : "private",
          fetches: Number(parsed.fetches || 0),
          ...(typeof parsed.remoteId === "string"
            ? { remoteId: parsed.remoteId }
            : {}),
        }
      : null;
  } catch {
    return null;
  }
};

function App() {
  const { user, loading, requireAuth, signOut } = useAuth();
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [q, setQ] = useState("");
  const {
    vendors,
    vendorMap,
    total: vendorTotal,
    offset: vendorOffset,
    loading: vendorsLoading,
    loadingMore: vendorsLoadingMore,
    error: vendorsError,
    loadMore: loadRemainingVendors,
    setVendorImage,
  } = useVendorCatalog();
  const [visibleVendorCount, setVisibleVendorCount] = useState(10);
  const vendorLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [publicLists, setPublicLists] = usePersistentState<UserList[]>(
    "bos-public-lists",
    [],
    cleanLists,
  );
  const [lists, setListsState] = usePersistentState<UserList[]>(
    "bos-lists",
    [],
    cleanLists,
  );
  const setLists: React.Dispatch<React.SetStateAction<UserList[]>> = (
    update,
  ) => {
    if (user) setListsState(update);
    else requireAuth(() => setListsState(update));
  };
  const knownFetchedIds = useRef(
    new Set(lists.filter((l) => l.fetched).map((l) => l.id)),
  );
  const [liked, setLiked] = usePersistentState<string[]>(
    "bos-liked",
    [],
    cleanStringArray,
  );
  const [submitted, setSubmitted] = usePersistentState<Vendor[]>(
    "bos-submitted-v2",
    [],
    (value) =>
      Array.isArray(value)
        ? value.filter((v): v is Vendor =>
            Boolean(
              v &&
              typeof v === "object" &&
              (v as Vendor).isActive &&
              (v as Vendor).vendorType,
            ),
          )
        : [],
  );
  const [reports, setReports] = usePersistentState<
    Record<string, WaitReport[]>
  >("bos-line-history", {}, cleanReports);
  const deviceId = useRef(getDeviceId()).current;
  const {
    reviews,
    photos: communityPhotos,
    loading: reviewsLoading,
    errors: reviewLoadErrors,
    load: loadReviews,
    refresh: refreshVendorReviews,
  } = useVendorReviews();
  const [issues, setIssues] = usePersistentState<
    { vendorId: string; message: string; at: number }[]
  >("bos-issues", [], cleanIssues);
  const [played, setPlayed] = usePersistentState("bos-played", 0, (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : 0,
  );
  const [modal, setModal] = useState<
    "add" | "create-list" | "add-to-list" | "share" | "survey" | "manual" | null
  >(null);
  const [shareLabel, setShareLabel] = useState("");
  const [shareHash, setShareHash] = useState("#discover");
  const [manualList, setManualList] = useState<UserList | null>(null);
  const [saveRequest, setSaveRequest] = useState<SaveRequest | null>(null);
  const [recentListIds, setRecentListIds] = usePersistentState<string[]>(
    "bos-recent-lists",
    [],
    cleanStringArray,
  );
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const notifyListSync = useCallback(
    (message: string) => setSnackbar({ message }),
    [],
  );
  const {
    stats: listStats,
    recordFetch,
    removeRemote,
    ensureSynced,
  } = useRemoteLists({
    userId: user?.id,
    routeName: route.name,
    lists,
    setLists: setListsState,
    notify: notifyListSync,
  });
  const {
    swipeIds,
    swipeAt,
    swipeLiked,
    savedSwipe,
    setSwipeAt,
    setSwipeLiked,
    startSwipe,
    resetSwipe,
    saveSwipe,
    resumeSwipe,
    tourney,
    tourneyStart,
    tourneySource,
    tourneyPicks,
    winner,
    setWinner,
    startTournament,
    setTourney,
    setTourneyPicks,
  } = useGameFlow({
    vendorMap,
    navigate: (name) => {
      location.hash = name;
      setRoute({ name });
      scrollTo(0, 0);
    },
    track: (event, detail = "") => {
      const events = readStorage<
        { event: string; detail: string; at: number }[]
      >("bos-events", []);
      writeStorage(
        "bos-events",
        [...events, { event, detail, at: Date.now() }].slice(-MAX_LOCAL_EVENTS),
      );
    },
    notify: (message) => setSnackbar({ message }),
  });
  const [eventClock, setEventClock] = useState(() => new Date());
  const photoUploadsOpen = photoUploadsAreOpen(eventClock);
  const lineReportsOpen = lineReportsAreOpen(eventClock);
  const allVendors = vendors;
  useEffect(() => {
    const timer = window.setInterval(() => setEventClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!vendors.length) return;
    const defaults = starterLists(vendors);
    const validIds = new Set(vendors.map((v) => v.id));
    const fullyLoaded = vendorTotal > 0 && vendorOffset >= vendorTotal;
    const defaultPublicIds = new Set(
      defaults.publicLists.map((list) => list.id),
    );
    const defaultPublicTitles = new Set(
      defaults.publicLists.map((list) => list.title.toLocaleLowerCase()),
    );
    setListsState((current) => {
      const cleaned = current.filter(
        (list) =>
          !(
            list.vendorIds.length === 0 &&
            list.fetches === 0 &&
            defaultPublicTitles.has(list.title.trim().toLocaleLowerCase())
          ),
      );
      if (!cleaned.length) return [defaults.starter];
      return cleaned.map((list) =>
        fullyLoaded
          ? {
              ...list,
              vendorIds: list.vendorIds.filter((id) => validIds.has(id)),
            }
          : list,
      );
    });
    setPublicLists((current) => [
      ...defaults.publicLists,
      ...current
        .filter((list) => !defaultPublicIds.has(list.id))
        .map((list) =>
          fullyLoaded
            ? {
                ...list,
                vendorIds: list.vendorIds.filter((id) => validIds.has(id)),
              }
            : list,
        ),
    ]);
    if (fullyLoaded)
      setLiked((current) => current.filter((id) => validIds.has(id)));
  }, [vendors, vendorOffset, vendorTotal]);
  useEffect(() => {
    const node = vendorLoadMoreRef.current;
    if (!node || route.name !== "discover") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleVendorCount((current) =>
          Math.min(current + 10, Math.max(current, vendors.length)),
        );
        if (visibleVendorCount + 20 >= vendors.length) loadRemainingVendors();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    route.name,
    vendors.length,
    visibleVendorCount,
    vendorOffset,
    vendorTotal,
    vendorsLoadingMore,
  ]);
  useEffect(() => {
    setVisibleVendorCount(10);
  }, [q]);
  useEffect(() => {
    const ids =
      route.name === "discover"
        ? allVendors
            .filter(
              (vendor) =>
                !q.trim() ||
                [vendor.name, ...vendor.cuisines, ...vendor.foodTypes].some(
                  (value) =>
                    value
                      .toLocaleLowerCase()
                      .includes(q.trim().toLocaleLowerCase()),
                ),
            )
            .slice(0, visibleVendorCount)
            .map((vendor) => vendor.id)
        : route.name === "vendor" && route.id
          ? [route.id]
          : route.name === "swipe" && swipeIds[swipeAt]
            ? [swipeIds[swipeAt]]
            : route.name === "tournament"
              ? tourney.slice(0, 2)
              : [];
    void loadReviews(ids);
  }, [
    route.name,
    route.id,
    swipeIds,
    swipeAt,
    tourney,
    loadReviews,
    allVendors,
    q,
    visibleVendorCount,
  ]);
  useEffect(() => {
    const added = lists.filter(
      (l) => l.fetched && !knownFetchedIds.current.has(l.id),
    );
    if (added.length) {
      setPublicLists((current) =>
        current.map((publicList) => ({
          ...publicList,
          fetches:
            publicList.fetches +
            added.filter(
              (fetched) =>
                fetched.id.startsWith(`fetched-${publicList.id}`) ||
                fetched.title === `${publicList.title} Picks`,
            ).length,
        })),
      );
      added.forEach((l) => knownFetchedIds.current.add(l.id));
    }
  }, [lists]);
  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(() => setSnackbar(null), 3500);
    return () => clearTimeout(timer);
  }, [snackbar]);
  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash());
    addEventListener("hashchange", syncRoute);
    return () => removeEventListener("hashchange", syncRoute);
  }, []);
  const track = (event: string, detail = "") => {
    const events = readStorage<{ event: string; detail: string; at: number }[]>(
      "bos-events",
      [],
    );
    writeStorage(
      "bos-events",
      [...events, { event, detail, at: Date.now() }].slice(-MAX_LOCAL_EVENTS),
    );
  };
  const go = (name: string, id?: string) => {
    if (!user && ["picks", "profile", "liked"].includes(name)) {
      const target = { name, id };
      requireAuth(() => {
        location.hash = id ? `${name}-${id}` : name;
        setRoute(target);
        scrollTo(0, 0);
      });
      location.hash = "discover";
      setRoute({ name: "discover" });
      return;
    }
    track(name === "vendor" ? "vendor_view" : "page_view", id || name);
    if (["discover", "lists", "picks", "profile"].includes(name)) setQ("");
    location.hash = id ? `${name}-${id}` : name;
    setRoute({ name, id });
    scrollTo(0, 0);
  };
  useEffect(() => {
    if (
      !loading &&
      !user &&
      ["picks", "profile", "liked"].includes(route.name)
    ) {
      const target = route;
      requireAuth(() => {
        location.hash = target.id ? `${target.name}-${target.id}` : target.name;
        setRoute(target);
        scrollTo(0, 0);
      });
      location.hash = "discover";
      setRoute({ name: "discover" });
    }
  }, [loading, user, route.name, route.id, requireAuth]);
  const openSave = (
    vendorIds: string[],
    title = "Save to List",
    sourceListId?: string,
    removeFromSource = false,
  ) =>
    requireAuth(() =>
      setSaveRequest({ vendorIds, title, sourceListId, removeFromSource }),
    );
  const commitSave = (listId: string, createdTitle?: string) => {
    if (!saveRequest) return;
    const target = lists.find((l) => l.id === listId);
    const title = createdTitle || target?.title || "List";
    const existing = target?.vendorIds || [];
    const added = saveRequest.vendorIds.filter((id) => !existing.includes(id));
    if (!added.length) {
      setSnackbar({ message: "Already saved" });
      setSaveRequest(null);
      return;
    }
    const previousLists = lists;
    const previousRecent = recentListIds;
    setLists((x) =>
      x.map((l) =>
        l.id === listId
          ? {
              ...l,
              vendorIds: [
                ...new Set([...l.vendorIds, ...saveRequest.vendorIds]),
              ],
            }
          : saveRequest.removeFromSource && l.id === saveRequest.sourceListId
            ? {
                ...l,
                vendorIds: l.vendorIds.filter(
                  (id) => !saveRequest.vendorIds.includes(id),
                ),
              }
            : l,
      ),
    );
    setRecentListIds((x) =>
      [listId, ...x.filter((id) => id !== listId)].slice(0, 5),
    );
    setSnackbar({
      message: `Saved to "${title}"`,
      undo: () => {
        setLists(previousLists);
        setRecentListIds(previousRecent);
      },
    });
    track("save_vendor", saveRequest.vendorIds.join(","));
    setSaveRequest(null);
  };
  const createAndSave = (title: string) => {
    if (!saveRequest) return;
    const id = "list-" + Date.now();
    const previousLists = lists;
    const previousRecent = recentListIds;
    setLists((x) => [
      ...x.map((l) =>
        saveRequest.removeFromSource && l.id === saveRequest.sourceListId
          ? {
              ...l,
              vendorIds: l.vendorIds.filter(
                (vendorId) => !saveRequest.vendorIds.includes(vendorId),
              ),
            }
          : l,
      ),
      {
        id,
        remoteId: crypto.randomUUID(),
        title,
        description: "",
        vendorIds: saveRequest.vendorIds,
        visibility: "private",
        fetches: 0,
      },
    ]);
    setRecentListIds((x) => [id, ...x].slice(0, 5));
    setSnackbar({
      message: `Saved to "${title}"`,
      undo: () => {
        setLists(previousLists);
        setRecentListIds(previousRecent);
      },
    });
    track("save_vendor", saveRequest.vendorIds.join(","));
    setSaveRequest(null);
  };
  const createList = (input: {
    title: string;
    description: string;
    visibility: "public" | "private";
  }) => {
    const id = "list-" + Date.now();
    setLists((x) => [
      ...x,
      {
        id,
        remoteId: crypto.randomUUID(),
        ...input,
        vendorIds: [],
        fetches: 0,
      },
    ]);
    track("list_create", input.visibility);
    setModal(null);
    setSnackbar({ message: `Created "${input.title}"` });
    go("list", id);
  };
  const leaveTournament = () => {
    location.hash = tourneySource.hash;
    setRoute(routeFromHash());
    scrollTo(0, 0);
  };
  const openShare = (label: string, hash = location.hash || "#discover") => {
    setShareLabel(label);
    setShareHash(hash);
    setModal("share");
  };
  const patchList = (id: string, patch: Partial<UserList>) =>
    setLists((x) => x.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const withCurrentLine = (v: Vendor) => {
    const latest = (reports[v.id] || [])[0];
    return {
      ...v,
      lineStatus:
        latest && Date.now() - latest.at < 30 * 60 * 1000
          ? latest.status
          : v.lineStatus,
    };
  };
  const sharedList =
    route.name === "shared" ? decodeSharedList(route.id) : null;
  const currentList =
    sharedList ||
    [...(user ? lists : []), ...publicLists].find((x) => x.id === route.id);
  const vendor = route.id ? vendorMap.get(route.id) : undefined;
  useEffect(() => {
    if (
      !loading &&
      !user &&
      route.name === "list" &&
      lists.some((list) => list.id === route.id)
    ) {
      const target = route;
      requireAuth(() => {
        location.hash = `list-${target.id}`;
        setRoute(target);
        scrollTo(0, 0);
      });
      location.hash = "lists";
      setRoute({ name: "lists" });
    }
  }, [loading, user, route.name, route.id, lists, requireAuth]);
  let screen: React.ReactNode = null;

  if (route.name === "discover") {
    screen = (
      <DiscoverScreen
        vendors={allVendors}
        photos={communityPhotos}
        loading={vendorsLoading}
        loadingMore={vendorsLoadingMore}
        error={vendorsError}
        query={q}
        visibleCount={visibleVendorCount}
        loadMoreRef={vendorLoadMoreRef}
        lists={lists}
        signedIn={Boolean(user)}
        onQueryChange={(value) => {
          setQ(value);
          if (value) track("search", value);
        }}
        onVendorOpen={(id) => go("vendor", id)}
        onVendorSave={(id) => openSave([id])}
        onAddVendor={() => requireAuth(() => setModal("add"))}
      />
    );
  } else if (route.name === "vendor" && vendor) {
    const history = reports[vendor.id] || [];
    const ownRecent = findRecentDeviceReport(history, deviceId);
    const reportLine = (status: WaitReport["status"]) => {
      if (!lineReportsAreOpen()) {
        setSnackbar({ message: "Line updates are currently closed." });
        return;
      }
      const change = applyLineReport(history, deviceId, status);
      if (change.result !== "duplicate")
        setReports((current) => ({ ...current, [vendor.id]: change.history }));
      setSnackbar({ message: lineReportMessages[change.result] });
    };
    screen = (
      <VendorDetailScreen
        vendor={withCurrentLine(vendor)}
        onBack={() => go("discover")}
        saved={
          Boolean(user) &&
          lists.some((list) => list.vendorIds.includes(vendor.id))
        }
        onSave={() => openSave([vendor.id])}
        history={history}
        deviceId={deviceId}
        canUndoLineReport={Boolean(ownRecent)}
        onUndoLineReport={() =>
          setReports((current) => ({
            ...current,
            [vendor.id]: (current[vendor.id] || []).filter(
              (item) => item !== ownRecent,
            ),
          }))
        }
        reviews={reviews.filter((review) => review.vendor_id === vendor.id)}
        reviewsLoading={reviewsLoading}
        reviewsUnavailable={reviewLoadErrors.has(vendor.id)}
        onRefreshReviews={() => refreshVendorReviews(vendor.id)}
        onNotify={(message) => setSnackbar({ message })}
        photos={communityPhotos.filter((photo) => photo.vendorId === vendor.id)}
        photoUploadsOpen={photoUploadsOpen}
        lineReportsOpen={lineReportsOpen}
        onLineReport={reportLine}
        canManageImage={user?.app_metadata.role === "admin"}
        onImageUpload={async (file) => {
          const result = await uploadVendorImage(vendor.id, vendor.imagePath ?? null, file);
          setVendorImage(vendor.id, result.imagePath, result.publicUrl);
          setSnackbar({ message: "Vendor image updated." });
        }}
        onImageDelete={vendor.imagePath ? async () => {
          await deleteVendorImage(vendor.id, vendor.imagePath!);
          setVendorImage(vendor.id, null);
          setSnackbar({ message: "Vendor image deleted." });
        } : undefined}
        onReportIssue={(message) =>
          requireAuth(() =>
            setIssues((current) => [
              { vendorId: vendor.id, message, at: Date.now() },
              ...current,
            ]),
          )
        }
      />
    );
  } else if (route.name === "lists") {
    const visible = user
      ? [
          ...publicLists,
          ...lists.filter((list) => list.visibility === "public"),
        ]
      : publicLists;
    screen = (
      <ListsScreen
        lists={visible}
        query={q}
        loading={vendorsLoading}
        error={vendorsError}
        onQuery={setQ}
        onOpen={(id) => go("list", id)}
      />
    );
  } else if (route.name === "list" && currentList) {
    const owned = lists.some((list) => list.id === currentList.id);
    const items = currentList.vendorIds
      .map((id) => vendorMap.get(id))
      .filter(Boolean) as Vendor[];
    const moveVendor = (index: number, delta: number) => {
      const ids = [...currentList.vendorIds];
      const target = index + delta;
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      patchList(currentList.id, { vendorIds: ids });
    };
    screen = (
      <ListScreen
        list={currentList}
        vendors={items}
        owned={owned}
        onBack={() => go(owned ? "picks" : "lists")}
        onVendorOpen={(id) => go("vendor", id)}
        onRemoveVendor={(id) =>
          patchList(currentList.id, {
            vendorIds: currentList.vendorIds.filter((value) => value !== id),
          })
        }
        onMoveVendor={moveVendor}
        onPatch={(patch) => patchList(currentList.id, patch)}
        onAddVendors={() => {
          setManualList(currentList);
          setModal("add-to-list");
        }}
        onDelete={() => {
          void removeRemote(currentList).catch(() =>
            setSnackbar({ message: "Could not delete the Supabase list." }),
          );
          setLists((current) =>
            current.filter((list) => list.id !== currentList.id),
          );
          go("picks");
        }}
        onMoveList={() =>
          openSave(currentList.vendorIds, "Move List", currentList.id, true)
        }
        onCopyList={() => openSave(currentList.vendorIds, "Copy List")}
        onSwipe={() => startSwipe(items.map((item) => item.id))}
        onTournament={() => startTournament(items.map((item) => item.id))}
        onTastingList={() =>
          setLists((current) => [
            ...current,
            {
              ...currentList,
              id: "tasting-" + Date.now(),
              remoteId: crypto.randomUUID(),
              title: currentList.title + " Tasting List",
              visibility: "private",
              fetches: 0,
            },
          ])
        }
        onShare={() => {
          void ensureSynced(currentList)
            .then(() =>
              openShare(
                currentList.title,
                "#shared-" + encodeSharedList(currentList),
              ),
            )
            .catch(() =>
              setSnackbar({ message: "Could not prepare this list to share." }),
            );
        }}
        onFetchAll={() => {
          void recordFetch(currentList)
            .then((fetchCount) => {
              setPublicLists((current) =>
                current.map((list) =>
                  list.remoteId === currentList.remoteId
                    ? { ...list, fetches: fetchCount }
                    : list,
                ),
              );
              setLists((current) => {
                const fetchedId = "fetched-" + currentList.id;
                if (current.some((list) => list.id === fetchedId))
                  return current;
                return [
                  ...current,
                  {
                    ...currentList,
                    id: fetchedId,
                    fetched: true,
                    fetches: 0,
                  },
                ];
              });
              go("picks");
            })
            .catch(() =>
              setSnackbar({ message: "Could not fetch this list." }),
            );
        }}
        onPickManually={() => {
          setManualList(currentList);
          setModal("manual");
        }}
      />
    );
  } else if (route.name === "picks") {
    const history = readStorage<
      { event: string; detail: string; at: number }[]
    >("bos-events", [])
      .slice(-5)
      .reverse();
    screen = (
      <PicksScreen
        lists={lists}
        likedCount={liked.length}
        played={played}
        history={history}
        onOpen={(id) => go("list", id)}
        onLiked={() => go("liked")}
        onCreate={() => setModal("create-list")}
      />
    );
  } else if (route.name === "liked") {
    const items = liked
      .map((id) => vendorMap.get(id))
      .filter(Boolean) as Vendor[];
    screen = (
      <LikedScreen
        vendors={items}
        onBack={() => go("picks")}
        onOpen={(id) => go("vendor", id)}
        onRemove={(id) =>
          setLiked((current) => current.filter((value) => value !== id))
        }
        onSwipe={() => startSwipe(items.map((item) => item.id))}
        onTournament={() => startTournament(items.map((item) => item.id))}
        onMove={() =>
          openSave(
            items.map((item) => item.id),
            "Move Vendors",
          )
        }
      />
    );
  } else if (route.name === "profile") {
    screen = (
      <ProfileScreen
        displayName={String(user?.user_metadata.display_name || "Bite user")}
        userId={user?.user_metadata.user_id}
        totalFetches={listStats.totalFetches}
        listCount={listStats.listCount}
        likeCount={liked.length}
        played={played}
        publicLists={publicLists}
        submittedCount={submitted.length}
        flaggedCount={reviews.filter((review) => review.flagged).length}
        issueCount={issues.length}
        onOpen={(id) => go("list", id)}
        onLogout={() =>
          void signOut()
            .then(() => go("discover"))
            .catch(() => setSnackbar({ message: "Could not log out." }))
        }
      />
    );
  } else if (route.name === "swipe") {
    const raw = vendorMap.get(swipeIds[swipeAt]);
    const current = raw ? withCurrentLine(raw) : undefined;
    const resultIds = swipeLiked.filter((id) => vendorMap.has(id));
    const like = () => {
      if (!current) return;
      setLiked((items) =>
        items.includes(current.id) ? items : [...items, current.id],
      );
      setSwipeLiked((items) =>
        items.includes(current.id) ? items : [...items, current.id],
      );
      setSwipeAt((index) => index + 1);
    };
    screen = current ? (
      <SwipeScreen
        vendor={current}
        position={swipeAt + 1}
        total={swipeIds.length}
        reviews={reviews.filter((review) => review.vendor_id === current.id)}
        photos={communityPhotos.filter(
          (photo) => photo.vendorId === current.id,
        )}
        photosOpen={photoUploadsOpen}
        onBack={() => go("picks")}
        onSkip={() => setSwipeAt((index) => index + 1)}
        onLike={like}
        onSave={saveSwipe}
      />
    ) : (
      <SwipeResultsScreen
        vendors={resultIds.map((id) => vendorMap.get(id)!)}
        onMove={() => openSave(resultIds, "Move Vendors")}
        onTournament={() => startTournament(resultIds, "Swipe results")}
        onShare={() => openShare("My Liked Vendors")}
        onReset={resetSwipe}
      />
    );
  } else if (route.name === "tournament") {
    const leftRaw = vendorMap.get(tourney[0]);
    const rightRaw = vendorMap.get(tourney[1]);
    const left = leftRaw ? withCurrentLine(leftRaw) : undefined;
    const right = rightRaw ? withCurrentLine(rightRaw) : undefined;
    screen =
      left && right ? (
        <TournamentScreen
          left={left}
          right={right}
          leftReviews={reviews.filter((review) => review.vendor_id === left.id)}
          rightReviews={reviews.filter(
            (review) => review.vendor_id === right.id,
          )}
          picks={tourneyPicks}
          totalPicks={tourneyStart.length - 1}
          source={tourneySource.label}
          onPick={(id) => {
            setTourney([id, ...tourney.slice(2)]);
            setTourneyPicks((count) => count + 1);
          }}
          onExit={leaveTournament}
        />
      ) : (
        <div className="empty">
          <h1>You picked!</h1>
          <p>{vendorMap.get(tourney[0])?.name || "Your favorite"}</p>
          <button
            onClick={() => {
              setWinner(tourney[0]);
              setPlayed((count) => count + 1);
              go("result", tourney[0]);
            }}
          >
            View result
          </button>
        </div>
      );
  } else if (route.name === "result") {
    const result = winner
      ? vendorMap.get(winner)
      : route.id
        ? vendorMap.get(route.id)
        : undefined;
    screen = (
      <div className="result">
        <p>Tournament Winner</p>
        <h1>{result?.name}</h1>
        <button onClick={() => result && openSave([result.id])}>
          Save to List
        </button>
        <button
          onClick={() => startTournament(tourneyStart, tourneySource.label)}
        >
          Restart Tournament
        </button>
        <button onClick={leaveTournament}>Back</button>
      </div>
    );
  }
  const playable =
    route.name === "liked"
      ? liked.filter((id) => vendorMap.has(id))
      : route.name === "list" && currentList
        ? currentList.vendorIds.filter((id) => vendorMap.has(id))
        : [];
  const tab = ["discover", "lists", "picks", "profile"].includes(route.name)
    ? route.name
    : "";
  return (
    <main>
      <div className="brand">
        The Bite <span>July 24–26</span>
      </div>
      {playable.length > 0 && (
        <div className="list-play-actions">
          <button onClick={() => startSwipe(playable)}>Start Swipe</button>
          <button onClick={() => startTournament(playable)}>
            Start Tournament
          </button>
        </div>
      )}
      {savedSwipe &&
        route.name !== "swipe" &&
        savedSwipe.at < savedSwipe.ids.length && (
          <button className="resume-swipe" onClick={resumeSwipe}>
            Resume Swipe
          </button>
        )}
      <div className="screen">{screen}</div>
      {tab && <Nav active={tab} go={go} />}{" "}
      {saveRequest && (
        <AppModals.ListPickerModal
          title={saveRequest.title}
          lists={lists}
          recentIds={recentListIds}
          close={() => setSaveRequest(null)}
          select={commitSave}
          create={createAndSave}
          togglePin={(id) =>
            patchList(id, {
              pinned: !lists.find((list) => list.id === id)?.pinned,
            })
          }
        />
      )}{" "}
      {snackbar && (
        <Snackbar state={snackbar} close={() => setSnackbar(null)} />
      )}{" "}
      {modal === "create-list" && (
        <AppModals.CreateListModal
          close={() => setModal(null)}
          create={createList}
        />
      )}{" "}
      {modal === "add-to-list" && manualList && (
        <AppModals.VendorPickerModal
          vendors={allVendors.filter(
            (item) => !manualList.vendorIds.includes(item.id),
          )}
          close={() => setModal(null)}
          add={(ids) => {
            patchList(manualList.id, {
              vendorIds: [...manualList.vendorIds, ...ids],
            });
            setModal(null);
          }}
        />
      )}{" "}
      {modal === "add" && (
        <AppModals.AddVendorModal
          close={() => setModal(null)}
          add={(item) => {
            setSubmitted((current) => [...current, item]);
            setModal(null);
          }}
        />
      )}{" "}
      {modal === "share" && (
        <AppModals.ShareModalView
          label={shareLabel}
          hash={shareHash}
          close={() => setModal(null)}
          shared={() => setModal("survey")}
        />
      )}{" "}
      {modal === "survey" && (
        <AppModals.SurveyModal
          close={() => setModal(null)}
          answer={() => setModal(null)}
        />
      )}{" "}
      {modal === "manual" && manualList && (
        <AppModals.ManualFetchModal
          list={manualList}
          vendors={
            manualList.vendorIds
              .map((id) => vendorMap.get(id))
              .filter(Boolean) as Vendor[]
          }
          close={() => setModal(null)}
          fetch={(ids) => {
            void recordFetch(manualList)
              .then((fetchCount) => {
                setPublicLists((current) =>
                  current.map((list) =>
                    list.remoteId === manualList.remoteId
                      ? { ...list, fetches: fetchCount }
                      : list,
                  ),
                );
                setLists((current) => [
                  ...current,
                  {
                    ...manualList,
                    id: "manual-" + Date.now(),
                    title: manualList.title + " Picks",
                    vendorIds: ids,
                    fetched: true,
                    fetches: 0,
                  },
                ]);
                setModal(null);
                go("picks");
              })
              .catch(() =>
                setSnackbar({ message: "Could not fetch this list." }),
              );
          }}
        />
      )}
    </main>
  );
}

function Nav({ active, go }: { active: string; go: (x: string) => void }) {
  return (
    <nav>
      {[
        ["discover", Compass, "Discover"],
        ["lists", Bookmark, "Lists"],
        ["picks", Heart, "My Picks"],
        ["profile", User, "Profile"],
      ].map(([id, I, label]: any) => (
        <button
          key={id}
          className={active === id ? "active" : ""}
          onClick={() => go(id)}
        >
          <I />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
function Snackbar({
  state,
  close,
}: {
  state: SnackbarState;
  close: () => void;
}) {
  return (
    <div className="snackbar" role="status" aria-live="polite">
      <span>{state.message}</span>
      {state.undo && (
        <button
          onClick={() => {
            state.undo?.();
            close();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
