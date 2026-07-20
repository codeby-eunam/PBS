import type { WaitReport } from "../features/lineReports";
import type { UserList } from "../types";

export type SwipeSession = {
  ids: string[];
  at: number;
  liked: string[];
  savedAt: number;
};
export type VendorIssue = { vendorId: string; message: string; at: number };

export const cleanStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && item.length > 0,
          ),
        ),
      ]
    : [];

export function cleanLists(value: unknown): UserList[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const list = item as Record<string, unknown>;
    if (typeof list.id !== "string" || typeof list.title !== "string")
      return [];
    return [
      {
        id: list.id,
        ...(typeof list.remoteId === "string"
          ? { remoteId: list.remoteId }
          : {}),
        title: list.title,
        description:
          typeof list.description === "string" ? list.description : "",
        vendorIds: cleanStringArray(list.vendorIds),
        visibility:
          list.visibility === "public"
            ? ("public" as const)
            : ("private" as const),
        fetches:
          typeof list.fetches === "number" && Number.isFinite(list.fetches)
            ? list.fetches
            : 0,
        ...(typeof list.fetched === "boolean" ? { fetched: list.fetched } : {}),
        ...(typeof list.pinned === "boolean" ? { pinned: list.pinned } : {}),
      },
    ];
  });
}

export function cleanReports(value: unknown): Record<string, WaitReport[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const statuses = new Set(["No line", "Short", "Busy", "Sold out"]);
  return Object.fromEntries(
    Object.entries(value).flatMap(([vendorId, items]) => {
      if (!vendorId || !Array.isArray(items)) return [];
      const reports = items
        .flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const report = item as Record<string, unknown>;
          if (
            !statuses.has(String(report.status)) ||
            typeof report.at !== "number" ||
            !Number.isFinite(report.at) ||
            report.at <= 0
          )
            return [];
          return [
            {
              ...(typeof report.id === "string" ? { id: report.id } : {}),
              ...(typeof report.deviceId === "string"
                ? { deviceId: report.deviceId }
                : {}),
              status: report.status as WaitReport["status"],
              at: report.at,
              photo: typeof report.photo === "string" ? report.photo : null,
            },
          ];
        })
        .sort((left, right) => right.at - left.at)
        .slice(0, 10);
      return reports.length ? [[vendorId, reports] as const] : [];
    }),
  );
}

export const cleanIssues = (value: unknown): VendorIssue[] =>
  Array.isArray(value)
    ? value
        .flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const issue = item as Record<string, unknown>;
          return typeof issue.vendorId === "string" &&
            typeof issue.message === "string" &&
            typeof issue.at === "number" &&
            Number.isFinite(issue.at)
            ? [
                {
                  vendorId: issue.vendorId,
                  message: issue.message,
                  at: issue.at,
                },
              ]
            : [];
        })
        .slice(0, 200)
    : [];

export function cleanSwipeSession(value: unknown): SwipeSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Record<string, unknown>;
  if (
    typeof session.at !== "number" ||
    !Number.isInteger(session.at) ||
    session.at < 0 ||
    typeof session.savedAt !== "number" ||
    !Number.isFinite(session.savedAt)
  )
    return null;
  const ids = cleanStringArray(session.ids);
  return {
    ids,
    at: Math.min(session.at, ids.length),
    liked: cleanStringArray(session.liked).filter((id) => ids.includes(id)),
    savedAt: session.savedAt,
  };
}
