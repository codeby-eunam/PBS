import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase", name), "utf8").toLowerCase();

describe("Supabase security contracts", () => {
  it("enables review RLS and exposes a bounded RPC", () => {
    const source = sql("reviews-policies.sql");
    expect(source).toContain(
      "alter table public.reviews enable row level security",
    );
    expect(source).toContain(
      "create or replace function public.get_vendor_reviews",
    );
    expect(source).toContain(
      "limit greatest(1, least(coalesce(p_limit, 30), 100))",
    );
    expect(source).toContain("security definer");
    expect(source).toContain("set search_path = ''");
    expect(source).toContain(
      "revoke all on function public.get_vendor_reviews",
    );
  });
  it("binds photo writes to the authenticated owner", () => {
    const rows = sql("review-photos-policies.sql");
    const storage = sql("storage-policies.sql");
    expect(rows).toContain("user_id = auth.uid()");
    expect(rows).toContain("reviews.user_id = auth.uid()");
    expect(storage).toContain("bucket_id = 'community-photos'");
    expect(storage).toContain(
      "(storage.foldername(name))[1] = auth.uid()::text",
    );
  });
  it("protects list fetch counters behind an authenticated RPC", () => {
    const source = sql("user-lists.sql");
    expect(source).toContain(
      "alter table public.user_lists enable row level security",
    );
    expect(source).toContain(
      "alter table public.list_fetches enable row level security",
    );
    expect(source).toContain("primary key (list_id, user_id)");
    expect(source).toContain(
      "create or replace function public.fetch_public_list",
    );
    expect(source).toContain("security definer");
    expect(source).toContain("set search_path = ''");
    expect(source).toContain(
      "revoke insert, update on public.user_lists from authenticated",
    );
    expect(source).toContain("grant update (title, visibility)");
    expect(source).toContain(
      "revoke all on function public.fetch_public_list(uuid) from public",
    );
  });
  it("restricts vendor image writes to administrators", () => {
    const source = sql("vendor-images.sql");
    expect(source).toContain("bucket_id = 'vendor-images'");
    expect(source).toContain("app_metadata' ->> 'role') = 'admin'");
    expect(source).toContain("grant update (image_path)");
  });
});
