import { useState } from "react";
import {
  cleanSwipeSession,
  type SwipeSession,
} from "../lib/cacheNormalization";
import { readStorage, removeStorage, writeStorage } from "../lib/storage";
import {
  advanceTournament,
  shuffleTournament,
  type TournamentBracket,
} from "../lib/tournament";
import type { Vendor } from "../types";

export function useGameFlow({
  vendorMap,
  navigate,
  track,
  notify,
}: {
  vendorMap: Map<string, Vendor>;
  navigate: (name: string) => void;
  track: (event: string, detail?: string) => void;
  notify: (message: string) => void;
}) {
  const [swipeIds, setSwipeIds] = useState<string[]>([]);
  const [swipeAt, setSwipeAt] = useState(0);
  const [swipeLiked, setSwipeLiked] = useState<string[]>([]);
  const [savedSwipe, setSavedSwipe] = useState<SwipeSession | null>(() =>
    cleanSwipeSession(readStorage("bos-swipe-progress", null)),
  );
  const [tournament, setTournament] = useState<TournamentBracket>({
    remaining: [],
    advancing: [],
  });
  const [tourneyStart, setTourneyStart] = useState<string[]>([]);
  const [tourneySource, setTourneySource] = useState({
    hash: "#picks",
    label: "Selected vendors",
  });
  const [tourneyPicks, setTourneyPicks] = useState(0);
  const [winner, setWinner] = useState<string>();
  const [singleVendorId, setSingleVendorId] = useState<string>();

  const startSwipe = (ids: string[]) => {
    const valid = ids.filter((id) => vendorMap.has(id));
    track("swipe_start", String(valid.length));
    setSwipeIds(valid);
    setSwipeLiked([]);
    setSwipeAt(0);
    navigate("swipe");
  };
  const resetSwipe = () => {
    removeStorage("bos-swipe-progress");
    setSavedSwipe(null);
    startSwipe(swipeIds);
  };
  const saveSwipe = () => {
    const session = {
      ids: swipeIds,
      at: swipeAt,
      liked: swipeLiked,
      savedAt: Date.now(),
    };
    writeStorage("bos-swipe-progress", session);
    setSavedSwipe(session);
    track("swipe_save", String(swipeAt));
    notify("Swipe progress saved");
  };
  const resumeSwipe = () => {
    if (!savedSwipe) return;
    const ids = savedSwipe.ids.filter((id) => vendorMap.has(id));
    setSwipeIds(ids);
    setSwipeAt(Math.min(savedSwipe.at, ids.length));
    setSwipeLiked(savedSwipe.liked.filter((id) => vendorMap.has(id)));
    track("swipe_resume", String(savedSwipe.at));
    navigate("swipe");
  };
  const startTournament = (ids: string[], label = "Selected vendors") => {
    const valid = [...new Set(ids.filter((id) => vendorMap.has(id)))];
    if (valid.length < 2) {
      notify("Choose at least 2 vendors to start a tournament");
      return;
    }
    track("tournament_start", String(valid.length));
    setTournament({ remaining: shuffleTournament(valid), advancing: [] });
    setTourneyStart(valid);
    setTourneySource({ hash: location.hash || "#picks", label });
    setTourneyPicks(0);
    setWinner(undefined);
    navigate("tournament");
  };
  const startListDecision = (ids: string[], label = "Selected vendors") => {
    const valid = [...new Set(ids.filter((id) => vendorMap.has(id)))];
    if (!valid.length) {
      notify("Add at least 1 vendor to start choosing");
      return;
    }
    if (valid.length === 1) {
      track("single_vendor_start", valid[0]);
      setSingleVendorId(valid[0]);
      setTourneyStart(valid);
      setTourneySource({ hash: location.hash || "#picks", label });
      setWinner(undefined);
      navigate("single-vendor");
      return;
    }
    if (valid.length <= 8) {
      startTournament(valid, label);
      return;
    }
    startSwipe(valid);
  };
  const pickTournament = (id: string) => {
    setTournament((current) => advanceTournament(current, id));
    setTourneyPicks((count) => count + 1);
  };

  return {
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
    tourney: tournament.remaining,
    tourneyStart,
    tourneySource,
    tourneyPicks,
    winner,
    setWinner,
    singleVendorId,
    startListDecision,
    startTournament,
    pickTournament,
  };
}
