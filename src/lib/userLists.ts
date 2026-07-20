import { supabase } from "./supabase";
import type { UserList } from "../types";

export type ListStats = { totalFetches: number; listCount: number };

export async function syncRemoteList(userId: string, list: UserList) {
  if (!list.remoteId || list.fetched) return;

  const row = {
    id: list.remoteId,
    owner_id: userId,
    title: list.title,
    visibility: list.visibility,
  };
  const { error: insertError } = await supabase
    .from("user_lists")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) throw insertError;

  // Keep editable metadata synchronized whether the row was just created or
  // already existed. `ignoreDuplicates` avoids an expected 409 response.
  const { error: updateError } = await supabase
    .from("user_lists")
    .update({ title: list.title, visibility: list.visibility })
    .eq("id", list.remoteId)
    .eq("owner_id", userId);
  if (updateError) throw updateError;
}

export async function deleteRemoteList(remoteId: string) {
  const { error } = await supabase
    .from("user_lists")
    .delete()
    .eq("id", remoteId);
  if (error) throw error;
}

export async function fetchRemoteList(remoteId: string): Promise<number> {
  const { data, error } = await supabase.rpc("fetch_public_list", {
    p_list_id: remoteId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getMyListStats(userId: string): Promise<ListStats> {
  const { data, error } = await supabase
    .from("user_lists")
    .select("fetch_count")
    .eq("owner_id", userId);
  if (error) throw error;
  return {
    totalFetches: (data ?? []).reduce(
      (sum, row) => sum + Number(row.fetch_count ?? 0),
      0,
    ),
    listCount: data?.length ?? 0,
  };
}
