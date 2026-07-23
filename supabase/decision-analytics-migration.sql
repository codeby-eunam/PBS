-- Decision analytics schema for pitch-deck KPIs.
-- Apply after vendors.sql and decision-service.sql.
-- Additive/idempotent: existing decision data is preserved.

create extension if not exists pgcrypto;

-- Fields that must be captured at decision start/completion rather than inferred
-- later from a list whose membership may change.
alter table public.decision_sessions
  add column if not exists initial_vendor_count integer,
  add column if not exists decision_method text,
  add column if not exists client_session_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table public.list_requests
  add column if not exists requested_category text;

alter table public.decision_reviews
  add column if not exists would_eat_again boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'decision_sessions_initial_vendor_count_check'
      and conrelid = 'public.decision_sessions'::regclass
  ) then
    alter table public.decision_sessions
      add constraint decision_sessions_initial_vendor_count_check
      check (initial_vendor_count is null or initial_vendor_count > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'decision_sessions_decision_method_check'
      and conrelid = 'public.decision_sessions'::regclass
  ) then
    alter table public.decision_sessions
      add constraint decision_sessions_decision_method_check
      check (decision_method is null or decision_method in
        ('single', 'swipe', 'tournament', 'swipe_then_tournament', 'choose_now'));
  end if;
end $$;

-- One row per browser visit. This is the denominator for bounce, completion,
-- return-user, and multiple-decision-session metrics.
create table if not exists public.analytics_sessions (
  id uuid primary key,
  anonymous_user_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  landing_path text,
  referrer text,
  user_agent text,
  decision_count integer not null default 0 check (decision_count >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  is_bounce boolean,
  metadata jsonb not null default '{}'::jsonb
);

-- Post-decision validation survey. Keep nullable optional answers distinct from
-- a negative response. Ease scores use a conventional 1-5 scale.
create table if not exists public.decision_validation_responses (
  id uuid primary key default gen_random_uuid(),
  decision_session_id uuid not null references public.decision_sessions(id) on delete cascade,
  anonymous_user_id uuid not null,
  ease_score smallint not null check (ease_score between 1 and 5),
  easier_than_usual text not null check (easier_than_usual in ('easier', 'same', 'harder')),
  would_use_again boolean,
  feedback text,
  created_at timestamptz not null default now(),
  unique (decision_session_id)
);

create index if not exists decision_sessions_started_idx
  on public.decision_sessions(started_at desc);
create index if not exists decision_sessions_completed_idx
  on public.decision_sessions(completed_at desc) where completed_at is not null;
create index if not exists decision_sessions_result_vendor_idx
  on public.decision_sessions(result_vendor_id) where result_vendor_id is not null;
create index if not exists decision_sessions_client_session_idx
  on public.decision_sessions(client_session_id);
create index if not exists decision_events_name_created_idx
  on public.decision_events(event_name, created_at desc);
create index if not exists decision_events_user_created_idx
  on public.decision_events(anonymous_user_id, created_at desc);
create index if not exists decision_events_session_created_idx
  on public.decision_events(session_id, created_at);
create index if not exists analytics_sessions_user_started_idx
  on public.analytics_sessions(anonymous_user_id, started_at desc);
create index if not exists validation_responses_created_idx
  on public.decision_validation_responses(created_at desc);

alter table public.analytics_sessions enable row level security;
alter table public.decision_validation_responses enable row level security;

drop policy if exists "Create analytics sessions" on public.analytics_sessions;
create policy "Create analytics sessions"
  on public.analytics_sessions for insert to anon, authenticated
  with check (completed_at is null and decision_count = 0 and event_count = 0);

drop policy if exists "Update analytics sessions" on public.analytics_sessions;
create policy "Update analytics sessions"
  on public.analytics_sessions for update to anon, authenticated
  using (true)
  with check (last_seen_at >= started_at);

drop policy if exists "Submit decision validation" on public.decision_validation_responses;
create policy "Submit decision validation"
  on public.decision_validation_responses for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.decision_sessions ds
      where ds.id = decision_session_id
        and ds.completed_at is not null
        and ds.anonymous_user_id = anonymous_user_id
    )
  );

-- Replace the original event allow-list with the complete analytics contract.
drop policy if exists "Submit decision events" on public.decision_events;
create policy "Submit decision events"
  on public.decision_events for insert to anon, authenticated
  with check (event_name in (
    'session_started', 'session_completed',
    'list_viewed', 'list_searched', 'list_search_no_result', 'list_requested',
    'vendor_viewed', 'decision_started',
    'swipe_viewed', 'swipe_interested', 'swipe_not_for_me', 'swipe_completed',
    'tournament_started', 'tournament_selection', 'tournament_completed',
    'choose_now_swipe', 'choose_now_tournament',
    'result_viewed', 'directions_clicked', 'instagram_clicked',
    'review_started', 'review_submitted', 'line_report_submitted',
    'validation_submitted'
  ));

-- Pitch-deck KPI view: completion rate and decision duration are the primary KPI.
create or replace view public.decision_kpi_summary
with (security_invoker = true) as
select
  count(*) as decisions_started,
  count(*) filter (where completed_at is not null) as decisions_completed,
  round(
    100.0 * count(*) filter (where completed_at is not null)
    / nullif(count(*), 0), 1
  ) as completion_rate_pct,
  percentile_cont(0.5) within group (
    order by extract(epoch from (completed_at - started_at))
  ) filter (where completed_at is not null) as median_decision_seconds,
  avg(extract(epoch from (completed_at - started_at)))
    filter (where completed_at is not null) as average_decision_seconds
from public.decision_sessions;

create or replace view public.validation_kpi_summary
with (security_invoker = true) as
select
  count(*) as response_count,
  round(avg(ease_score)::numeric, 2) as average_ease_score,
  round(100.0 * count(*) filter (where easier_than_usual = 'easier')
    / nullif(count(*), 0), 1) as easier_than_usual_pct,
  round(100.0 * count(*) filter (where would_use_again is true)
    / nullif(count(*) filter (where would_use_again is not null), 0), 1)
    as would_use_again_pct
from public.decision_validation_responses;

create or replace view public.winner_vendor_ranking
with (security_invoker = true) as
select
  ds.result_vendor_id as vendor_id,
  v.name as vendor_name,
  count(*) as win_count,
  dense_rank() over (order by count(*) desc) as ranking
from public.decision_sessions ds
join public.vendors v on v.id = ds.result_vendor_id
where ds.completed_at is not null
group by ds.result_vendor_id, v.name;

create or replace view public.winner_category_ranking
with (security_invoker = true) as
select
  ds.list_id,
  l.name as category_name,
  count(*) as win_count,
  dense_rank() over (order by count(*) desc) as ranking
from public.decision_sessions ds
left join public.lists l on l.id = ds.list_id
where ds.completed_at is not null
group by ds.list_id, l.name;

create or replace view public.winner_cuisine_ranking
with (security_invoker = true) as
select
  cuisine,
  count(*) as win_count,
  dense_rank() over (order by count(*) desc) as ranking
from public.decision_sessions ds
join public.vendors v on v.id = ds.result_vendor_id
cross join lateral unnest(v.cuisines) as cuisine
where ds.completed_at is not null
group by cuisine;

create or replace view public.popular_lists
with (security_invoker = true) as
select
  l.id as list_id,
  l.name as list_name,
  count(e.id) filter (where e.event_name = 'list_viewed') as view_count,
  count(e.id) filter (where e.event_name = 'decision_started') as decision_start_count
from public.lists l
left join public.decision_events e on e.list_id = l.id
group by l.id, l.name;

create or replace view public.current_line_status
with (security_invoker = true) as
select distinct on (r.vendor_id)
  r.vendor_id,
  r.status as current_status,
  count(*) over (partition by r.vendor_id) as report_count,
  r.created_at as last_updated
from public.decision_line_reports r
where r.location_verified
  and r.created_at > now() - interval '30 minutes'
order by r.vendor_id, r.created_at desc;

-- Analytics views are intended for trusted dashboard/service-role queries only.
revoke all on public.decision_kpi_summary from anon, authenticated;
revoke all on public.validation_kpi_summary from anon, authenticated;
revoke all on public.winner_vendor_ranking from anon, authenticated;
revoke all on public.winner_category_ranking from anon, authenticated;
revoke all on public.winner_cuisine_ranking from anon, authenticated;
revoke all on public.popular_lists from anon, authenticated;

grant select on public.current_line_status to anon, authenticated;

notify pgrst, 'reload schema';
