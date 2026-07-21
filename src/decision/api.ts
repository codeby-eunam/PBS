import { supabase } from "../lib/supabase";
import type { DecisionList, DecisionSession } from "./model";

export async function loadDecisionLists(): Promise<DecisionList[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id,name,description,tags,list_vendors(vendor_id,sort_order)")
    .eq("is_active", true)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    tags: row.tags ?? [],
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
) {
  const { error } = await supabase
    .from("decision_sessions")
    .upsert({
      id: session.id,
      anonymous_user_id: anonymousUserId,
      list_id: session.listId,
      completed_at: new Date().toISOString(),
      result_vendor_id: session.resultVendorId,
      result_method: session.resultMethod,
    });
  if (error) throw error;
}
export async function createDecisionSession(
  session: DecisionSession,
  anonymousUserId: string,
) {
  const { error } = await supabase
    .from("decision_sessions")
    .insert({
      id: session.id,
      anonymous_user_id: anonymousUserId,
      list_id: session.listId,
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
  void supabase
    .from("decision_events")
    .insert({
      anonymous_user_id: anonymousUserId,
      session_id: context.sessionId,
      list_id: context.listId,
      vendor_id: context.vendorId,
      event_name: eventName,
      metadata: context.metadata ?? {},
    });
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
