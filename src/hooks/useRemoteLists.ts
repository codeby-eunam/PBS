import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { UserList } from "../types";
import {
  deleteRemoteList,
  fetchRemoteList,
  getMyListStats,
  syncRemoteList,
  type ListStats,
} from "../lib/userLists";

const EMPTY_STATS: ListStats = { totalFetches: 0, listCount: 0 };

export function useRemoteLists({
  userId,
  routeName,
  lists,
  setLists,
  notify,
}: {
  userId?: string;
  routeName: string;
  lists: UserList[];
  setLists: Dispatch<SetStateAction<UserList[]>>;
  notify: (message: string) => void;
}) {
  const [stats, setStats] = useState<ListStats>(EMPTY_STATS);
  const synced = useRef(new Map<string, string>());

  useEffect(() => {
    if (!userId) {
      setStats(EMPTY_STATS);
      synced.current.clear();
      return;
    }
    if (lists.some((list) => !list.fetched && !list.remoteId)) {
      setLists((current) =>
        current.map((list) =>
          !list.fetched && !list.remoteId
            ? { ...list, remoteId: crypto.randomUUID() }
            : list,
        ),
      );
    }
  }, [lists, setLists, userId]);

  const refreshStats = useCallback(async () => {
    if (!userId) {
      setStats(EMPTY_STATS);
      return;
    }
    try {
      setStats(await getMyListStats(userId));
    } catch {
      notify("Could not load list statistics.");
    }
  }, [notify, userId]);

  useEffect(() => {
    if (!userId) return;
    for (const list of lists) {
      if (list.fetched || !list.remoteId) continue;
      const signature = `${list.title}\u0000${list.visibility}`;
      if (synced.current.get(list.remoteId) === signature) continue;
      synced.current.set(list.remoteId, signature);
      void syncRemoteList(userId, list)
        .then(() => {
          if (routeName === "profile") void refreshStats();
        })
        .catch(() => {
          synced.current.delete(list.remoteId!);
          notify(`Could not sync "${list.title}" to Supabase.`);
        });
    }
  }, [lists, notify, refreshStats, routeName, userId]);

  useEffect(() => {
    if (routeName === "profile") void refreshStats();
  }, [refreshStats, routeName, lists.length]);

  const recordFetch = useCallback(
    async (list: UserList) => {
      if (!list.remoteId) return list.fetches;
      const count = await fetchRemoteList(list.remoteId);
      await refreshStats();
      return count;
    },
    [refreshStats],
  );

  const removeRemote = useCallback(async (list: UserList) => {
    if (list.remoteId) await deleteRemoteList(list.remoteId);
  }, []);

  const ensureSynced = useCallback(
    async (list: UserList) => {
      if (userId && list.remoteId) await syncRemoteList(userId, list);
    },
    [userId],
  );

  return { stats, recordFetch, removeRemote, ensureSynced, refreshStats };
}
