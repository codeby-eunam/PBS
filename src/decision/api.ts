import { supabase } from "../lib/supabase";
import type { DecisionList, DecisionSession } from "./model";

export async function loadDecisionLists(): Promise<DecisionList[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id,name,description,tags,created_at,list_vendors(vendor_id,sort_order)")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    tags: row.tags ?? [],
    createdAt: row.created_at,
    vendorIds: (row.list_vendors ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((item: any) => item.vendor_id),
  }));
}
export async function submitListRequest(
  requestedName: string,
  searchQuery: string,
  anonymousUserId: string,
) {
  const { error } = await supabase
    .from("list_requests")
    .insert({
      requested_name: requestedName,
      search_query: searchQuery || null,
      anonymous_user_id: anonymousUserId,
    });
  if (error) throw error;
  await notifyFeedbackInbox({
    type: "list_request",
    listName: requestedName,
    message: searchQuery || requestedName,
  }).catch(() => {
    // The request is already safely stored. Email delivery must not encourage a duplicate retry.
  });
}

export async function notifyFeedbackInbox(input: {
  type: "list_feedback" | "list_request";
  listName: string;
  message: string;
  pageUrl?: string;
}) {
  const { error } = await supabase.functions.invoke("send-list-feedback", {
    body: input,
  });
  if (error) throw error;
}
export async function saveDecisionResult(
  session: DecisionSession,
  anonymousUserId: string,
  decisionMethod: "single" | "swipe" | "tournament" | "swipe_then_tournament" | "choose_now",
) {
  if (!session.resultVendorId || !session.resultMethod)
    throw new Error("A completed decision requires a winner and result method.");
  const { error } = await supabase.rpc("complete_decision_session", {
    p_session_id: session.id,
    p_anonymous_user_id: anonymousUserId,
    p_result_vendor_id: session.resultVendorId,
    p_result_method: session.resultMethod,
    p_decision_method: decisionMethod,
  });
  if (error) throw error;
}
export async function createDecisionSession(
  session: DecisionSession,
  anonymousUserId: string,
  clientSessionId: string,
  initialVendorCount: number,
  decisionMethod: "single" | "swipe" | "tournament",
) {
  const { error } = await supabase.rpc("start_decision_session", {
    p_session_id: session.id,
    p_anonymous_user_id: anonymousUserId,
    p_client_session_id: clientSessionId,
    p_list_id: session.listId,
    p_initial_vendor_count: initialVendorCount,
    p_decision_method: decisionMethod,
  });
  if (error) throw error;
}
export async function startAnalyticsSession(
  clientSessionId: string,
  anonymousUserId: string,
) {
  const { error } = await supabase.rpc("start_analytics_session", {
    p_session_id: clientSessionId,
    p_anonymous_user_id: anonymousUserId,
    p_landing_path: `${location.pathname}${location.search}`,
    p_referrer: document.referrer || null,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}
export async function recordAnalyticsActivity(
  clientSessionId: string,
  anonymousUserId: string,
  decisionStarted = false,
) {
  const { error } = await supabase.rpc("record_analytics_activity", {
    p_session_id: clientSessionId,
    p_anonymous_user_id: anonymousUserId,
    p_decision_started: decisionStarted,
  });
  if (error) throw error;
}
export async function completeAnalyticsSession(
  clientSessionId: string,
  anonymousUserId: string,
) {
  const { error } = await supabase.rpc("complete_analytics_session", {
    p_session_id: clientSessionId,
    p_anonymous_user_id: anonymousUserId,
  });
  if (error) throw error;
}
export async function trackEvent(
  eventName: string,
  anonymousUserId: string,
  context: {
    sessionId?: string;
    listId?: string;
    vendorId?: string;
    metadata?: object;
  } = {},
) {
  const { error } = await supabase
    .from("decision_events")
    .insert({
      anonymous_user_id: anonymousUserId,
      session_id: context.sessionId,
      list_id: context.listId,
      vendor_id: context.vendorId,
      event_name: eventName,
      metadata: context.metadata ?? {},
    });
  if (error) throw error;
}
export type ValidationResponse = {
  easeScore: 1 | 2 | 3 | 4 | 5;
  easierThanUsual: "easier" | "same" | "harder";
  wouldUseAgain?: boolean;
};
export async function submitValidationResponse(
  decisionSessionId: string,
  anonymousUserId: string,
  response: ValidationResponse,
) {
  const { error } = await supabase.rpc("submit_decision_validation", {
    p_decision_session_id: decisionSessionId,
    p_anonymous_user_id: anonymousUserId,
    p_ease_score: response.easeScore,
    p_easier_than_usual: response.easierThanUsual,
    p_would_use_again: response.wouldUseAgain ?? null,
  });
  if (error) throw error;
}
export type ReviewDraft = {
  recommendation: "recommend" | "not_recommend";
  menuName: string;
  reasons: string[];
  comment: string;
  price: string;
  visitedAt: string;
};
export async function submitReview(
  vendorId: string,
  anonymousUserId: string,
  draft: ReviewDraft,
  photos: File[],
) {
  const { data, error } = await supabase
    .from("decision_reviews")
    .insert({
      vendor_id: vendorId,
      anonymous_user_id: anonymousUserId,
      recommendation: draft.recommendation,
      menu_name: draft.menuName,
      reasons: draft.reasons,
      comment: draft.comment || null,
      price: draft.price || null,
      visited_at: draft.visitedAt || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  for (const photo of photos) {
    const path = `${data.id}/${crypto.randomUUID()}`;
    const uploaded = await supabase.storage
      .from("decision-review-photos")
      .upload(path, photo, { contentType: photo.type });
    if (uploaded.error) throw uploaded.error;
    const inserted = await supabase
      .from("decision_review_photos")
      .insert({
        review_id: data.id,
        storage_path: path,
        moderation_status: "pending",
      });
    if (inserted.error) throw inserted.error;
  }
}
export async function submitLineReport(
  vendorId: string,
  anonymousUserId: string,
  status: string,
  locationVerified: boolean,
) {
  const { error } = await supabase
    .from("decision_line_reports")
    .insert({
      vendor_id: vendorId,
      anonymous_user_id: anonymousUserId,
      status,
      location_verified: locationVerified,
    });
  if (error) throw error;
}
