import type { Vendor } from "../types";

export type ResultMethod =
  | "choose_now_from_swipe"
  | "choose_now_from_tournament"
  | "swipe_single_remaining"
  | "tournament_winner";
export type DecisionList = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  vendorIds: string[];
};
export type DecisionSession = {
  id: string;
  listId: string;
  vendorIds: string[];
  swipeIndex: number;
  interestedIds: string[];
  tournamentRemaining: string[];
  tournamentAdvancing: string[];
  round: number;
  resultVendorId?: string;
  resultMethod?: ResultMethod;
};
export const SESSION_KEY = "bos-decision-session-v2";
export const ANONYMOUS_ID_KEY = "bos-anonymous-user-id";
export const CLIENT_SESSION_ID_KEY = "bos-client-session-id";
export const SYSTEM_LIST_IDS = {
  allVendors: "00000000-0000-4000-8000-000000000001",
  allFoods: "00000000-0000-4000-8000-000000000002",
  allGames: "00000000-0000-4000-8000-000000000003",
  allShoppings: "00000000-0000-4000-8000-000000000004",
} as const;

export function decisionStartMode(vendorCount: number) {
  if (vendorCount === 1) return "single" as const;
  if (vendorCount <= 8) return "tournament" as const;
  return "swipe" as const;
}

export function getAnonymousUserId() {
  const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(ANONYMOUS_ID_KEY, id);
  return id;
}

export function getClientSessionId() {
  const existing = sessionStorage.getItem(CLIENT_SESSION_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(CLIENT_SESSION_ID_KEY, id);
  return id;
}

export function buildSystemLists(vendors: Vendor[]): DecisionList[] {
  const make = (
    id: string,
    name: string,
    description: string,
    selected: Vendor[],
  ): DecisionList => ({
    id,
    name,
    description,
    tags: ["all"],
    vendorIds: selected.map((vendor) => vendor.id),
  });
  return [
    make(
      SYSTEM_LIST_IDS.allVendors,
      "ALL VENDORS",
      "Every active festival vendor.",
      vendors,
    ),
    make(
      SYSTEM_LIST_IDS.allFoods,
      "ALL FOODS",
      "All food, drink, and dessert vendors.",
      vendors.filter((vendor) =>
        ["food", "drink", "dessert"].includes(vendor.vendorType),
      ),
    ),
    make(
      SYSTEM_LIST_IDS.allGames,
      "ALL GAMES",
      "Every game vendor at the festival.",
      vendors.filter((vendor) => vendor.vendorType === "game"),
    ),
    make(
      SYSTEM_LIST_IDS.allShoppings,
      "ALL SHOPPINGS",
      "Every shopping vendor at the festival.",
      vendors.filter((vendor) => vendor.vendorType === "shopping"),
    ),
  ];
}

export function startSession(list: DecisionList): DecisionSession {
  return {
    id: crypto.randomUUID(),
    listId: list.id,
    vendorIds: list.vendorIds,
    swipeIndex: 0,
    interestedIds: [],
    tournamentRemaining: [],
    tournamentAdvancing: [],
    round: 1,
  };
}

export function advanceMatch(
  session: DecisionSession,
  winnerId: string,
): DecisionSession {
  if (!session.tournamentRemaining.slice(0, 2).includes(winnerId))
    return session;
  const remaining = session.tournamentRemaining.slice(2);
  const advancing = [...session.tournamentAdvancing, winnerId];
  if (remaining.length >= 2)
    return {
      ...session,
      tournamentRemaining: remaining,
      tournamentAdvancing: advancing,
    };
  if (remaining.length === 1) advancing.push(remaining[0]);
  if (advancing.length === 1)
    return {
      ...session,
      tournamentRemaining: [],
      tournamentAdvancing: [],
      resultVendorId: advancing[0],
      resultMethod: "tournament_winner",
    };
  return {
    ...session,
    tournamentRemaining: advancing,
    tournamentAdvancing: [],
    round: session.round + 1,
  };
}
