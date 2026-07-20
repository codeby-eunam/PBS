import type { LineStatus } from "../types";

export type WaitReport = {
  id?: string;
  deviceId?: string;
  status: Exclude<LineStatus, null | "Very busy">;
  at: number;
  photo: string | null;
};

export type LineReportResult = "added" | "updated" | "duplicate";

const UPDATE_WINDOW_MS = 3 * 60_000;
const HISTORY_LIMIT = 10;

export function applyLineReport(
  history: WaitReport[],
  deviceId: string,
  status: WaitReport["status"],
  now = Date.now(),
): { history: WaitReport[]; result: LineReportResult } {
  const ownIndex = history.findIndex(
    (item) => item.deviceId === deviceId && now - item.at < UPDATE_WINDOW_MS,
  );

  if (ownIndex < 0) {
    return {
      result: "added",
      history: [
        { id: crypto.randomUUID(), deviceId, status, photo: null, at: now },
        ...history,
      ].slice(0, HISTORY_LIMIT),
    };
  }

  if (history[ownIndex].status === status) {
    return { result: "duplicate", history };
  }

  const next = history.map((item, index) =>
    index === ownIndex ? { ...item, status, at: now } : item,
  );
  next.sort((left, right) => right.at - left.at);
  return { result: "updated", history: next };
}

export function findRecentDeviceReport(
  history: WaitReport[],
  deviceId: string,
  now = Date.now(),
): WaitReport | undefined {
  return history.find(
    (item) => item.deviceId === deviceId && now - item.at < UPDATE_WINDOW_MS,
  );
}

export const lineReportMessages: Record<LineReportResult, string> = {
  added: "Line status reported. You can change or undo it for 3 minutes.",
  updated: "Your recent line report was updated.",
  duplicate: "You already reported this status recently.",
};
