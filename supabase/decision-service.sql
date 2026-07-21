-- Additive schema for the decision-first app. Existing tables and policies are preserved.
create extension if not exists pgcrypto;

alter table public.vendors add column if not exists location_name text;
alter table public.vendors add column if not exists booth_number text;
alter table public.vendors add column if not exists zone text;
alter table public.vendors add column if not exists latitude double precision;
alter table public.vendors add column if not exists longitude double precision;
alter table public.vendors add column if not exists map_x double precision;
alter table public.vendors add column if not exists map_y double precision;
alter table public.vendors add column if not exists location_updated_at timestamptz;

create table if not exists public.lists (id uuid primary key default gen_random_uuid(), name text not null, description text not null default '', tags text[] not null default '{}', is_active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.list_vendors (id uuid primary key default gen_random_uuid(), list_id uuid not null references public.lists on delete cascade, vendor_id uuid not null references public.vendors on delete cascade, sort_order integer not null default 0, unique(list_id,vendor_id));
create table if not exists public.list_requests (id uuid primary key default gen_random_uuid(), requested_name text not null check(length(requested_name) between 1 and 160), search_query text, anonymous_user_id uuid not null, status text not null default 'pending' check(status in ('pending','reviewed','closed')), created_at timestamptz not null default now());
create table if not exists public.decision_sessions (id uuid primary key, anonymous_user_id uuid not null, list_id uuid references public.lists, started_at timestamptz not null default now(), completed_at timestamptz, result_vendor_id uuid references public.vendors, result_method text check(result_method in ('choose_now_from_swipe','choose_now_from_tournament','swipe_single_remaining','tournament_winner')));
create table if not exists public.swipe_decisions (id uuid primary key default gen_random_uuid(), session_id uuid not null references public.decision_sessions on delete cascade, vendor_id uuid not null references public.vendors, decision text not null check(decision in ('interested','not_for_me')), created_at timestamptz not null default now(), unique(session_id,vendor_id));
create table if not exists public.tournament_matches (id uuid primary key default gen_random_uuid(), session_id uuid not null references public.decision_sessions on delete cascade, round_number integer not null check(round_number > 0), left_vendor_id uuid not null references public.vendors, right_vendor_id uuid not null references public.vendors, winner_vendor_id uuid not null references public.vendors, created_at timestamptz not null default now());
create table if not exists public.decision_reviews (id uuid primary key default gen_random_uuid(), vendor_id uuid not null references public.vendors, anonymous_user_id uuid not null, recommendation text not null check(recommendation in ('recommend','not_recommend')), menu_name text not null check(length(menu_name) between 1 and 160), reasons text[] not null default '{}', comment text, price text, visited_at timestamptz, status text not null default 'pending' check(status in ('pending','approved','rejected')), created_at timestamptz not null default now());
create table if not exists public.decision_review_photos (id uuid primary key default gen_random_uuid(), review_id uuid not null references public.decision_reviews on delete cascade, storage_path text not null unique, moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected')), created_at timestamptz not null default now());
create table if not exists public.decision_line_reports (id uuid primary key default gen_random_uuid(), vendor_id uuid not null references public.vendors, anonymous_user_id uuid not null, status text not null check(status in ('No line','Short','Medium','Long','Sold out')), location_verified boolean not null default false check(location_verified), created_at timestamptz not null default now());
create table if not exists public.decision_events (id bigint generated always as identity primary key, anonymous_user_id uuid not null, session_id uuid, list_id uuid, vendor_id uuid, event_name text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());

create unique index if not exists list_requests_device_name_idx on public.list_requests(anonymous_user_id, lower(requested_name));
create index if not exists decision_reviews_device_vendor_idx on public.decision_reviews(anonymous_user_id,vendor_id,created_at desc);
create index if not exists decision_line_device_vendor_idx on public.decision_line_reports(anonymous_user_id,vendor_id,created_at desc);
create index if not exists decision_line_recent_idx on public.decision_line_reports(vendor_id,created_at desc) where location_verified;

alter table public.lists enable row level security; alter table public.list_vendors enable row level security; alter table public.list_requests enable row level security; alter table public.decision_sessions enable row level security; alter table public.swipe_decisions enable row level security; alter table public.tournament_matches enable row level security; alter table public.decision_reviews enable row level security; alter table public.decision_review_photos enable row level security; alter table public.decision_line_reports enable row level security; alter table public.decision_events enable row level security;

create policy "Read active decision lists" on public.lists for select to anon,authenticated using(is_active);
create policy "Read vendors in active lists" on public.list_vendors for select to anon,authenticated using(exists(select 1 from public.lists l where l.id=list_id and l.is_active));
create policy "Submit list requests" on public.list_requests for insert to anon,authenticated with check(status='pending');
create policy "Create decision sessions" on public.decision_sessions for insert to anon,authenticated with check(result_vendor_id is null and completed_at is null);
create policy "Complete decision sessions" on public.decision_sessions for update to anon,authenticated using(true) with check(result_vendor_id is not null and completed_at is not null);
create policy "Submit swipe decisions" on public.swipe_decisions for insert to anon,authenticated with check(true);
create policy "Submit tournament matches" on public.tournament_matches for insert to anon,authenticated with check(winner_vendor_id in (left_vendor_id,right_vendor_id));
create policy "Submit pending reviews" on public.decision_reviews for insert to anon,authenticated with check(status='pending');
create policy "Read approved reviews" on public.decision_reviews for select to anon,authenticated using(status='approved');
create policy "Submit pending review photos" on public.decision_review_photos for insert to anon,authenticated with check(moderation_status='pending');
create policy "Read approved review photos" on public.decision_review_photos for select to anon,authenticated using(moderation_status='approved');
create policy "Submit verified line reports" on public.decision_line_reports for insert to anon,authenticated with check(location_verified);
create policy "Read recent verified line reports" on public.decision_line_reports for select to anon,authenticated using(location_verified and created_at > now()-interval '30 minutes');
create policy "Submit decision events" on public.decision_events for insert to anon,authenticated with check(event_name in ('list_viewed','list_searched','list_search_no_result','list_requested','vendor_viewed','decision_started','swipe_interested','swipe_not_for_me','choose_now_swipe','swipe_completed','tournament_started','tournament_selection','choose_now_tournament','tournament_completed','result_viewed','directions_clicked','instagram_clicked','review_started','review_submitted','line_report_submitted'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('decision-review-photos','decision-review-photos',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Upload pending decision review photos" on storage.objects for insert to anon,authenticated with check(bucket_id='decision-review-photos');
-- No public Storage SELECT policy: approved photos should be exposed later through a signed-URL RPC/Edge Function.
notify pgrst, 'reload schema';
