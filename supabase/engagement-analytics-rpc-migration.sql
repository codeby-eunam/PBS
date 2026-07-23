-- Browser visit, return-user, bounce, and multi-decision session analytics.
-- Apply after decision-session-rpc-migration.sql. Safe to run repeatedly.

create or replace function public.start_analytics_session(
  p_session_id uuid,
  p_anonymous_user_id uuid,
  p_landing_path text default null,
  p_referrer text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_sessions (
    id, anonymous_user_id, landing_path, referrer, user_agent
  ) values (
    p_session_id,
    p_anonymous_user_id,
    left(p_landing_path, 500),
    left(p_referrer, 1000),
    left(p_user_agent, 1000)
  )
  on conflict (id) do update
  set
    last_seen_at = now(),
    completed_at = null,
    is_bounce = null
  where public.analytics_sessions.anonymous_user_id = excluded.anonymous_user_id;
end;
$$;

create or replace function public.record_analytics_activity(
  p_session_id uuid,
  p_anonymous_user_id uuid,
  p_decision_started boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.analytics_sessions
  set
    last_seen_at = now(),
    event_count = event_count + 1,
    decision_count = decision_count + case when p_decision_started then 1 else 0 end,
    is_bounce = false
  where id = p_session_id
    and anonymous_user_id = p_anonymous_user_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Analytics session not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.complete_analytics_session(
  p_session_id uuid,
  p_anonymous_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.analytics_sessions
  set
    last_seen_at = now(),
    completed_at = now(),
    is_bounce = (decision_count = 0)
  where id = p_session_id
    and anonymous_user_id = p_anonymous_user_id;
end;
$$;

-- Overload the existing start RPC so each decision is linked to its browser visit.
create or replace function public.start_decision_session(
  p_session_id uuid,
  p_anonymous_user_id uuid,
  p_client_session_id uuid,
  p_list_id uuid,
  p_initial_vendor_count integer,
  p_decision_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_initial_vendor_count <= 0 then
    raise exception 'Initial vendor count must be positive' using errcode = '22023';
  end if;
  if p_decision_method not in ('single', 'swipe', 'tournament') then
    raise exception 'Invalid initial decision method' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.analytics_sessions
    where id = p_client_session_id
      and anonymous_user_id = p_anonymous_user_id
  ) then
    raise exception 'Analytics session not found' using errcode = 'P0002';
  end if;

  insert into public.decision_sessions (
    id, anonymous_user_id, client_session_id, list_id,
    initial_vendor_count, decision_method
  ) values (
    p_session_id, p_anonymous_user_id, p_client_session_id, p_list_id,
    p_initial_vendor_count, p_decision_method
  );

  update public.analytics_sessions
  set
    last_seen_at = now(),
    event_count = event_count + 1,
    decision_count = decision_count + 1,
    is_bounce = false
  where id = p_client_session_id
    and anonymous_user_id = p_anonymous_user_id;
end;
$$;

create or replace view public.engagement_kpi_summary
with (security_invoker = true) as
with user_visits as (
  select anonymous_user_id, count(*) as visit_count
  from public.analytics_sessions
  group by anonymous_user_id
)
select
  count(*) as total_sessions,
  count(*) filter (where completed_at is not null) as completed_sessions,
  count(*) filter (where decision_count = 0) as bounced_sessions,
  round(100.0 * count(*) filter (where decision_count = 0)
    / nullif(count(*), 0), 1) as bounce_rate_pct,
  count(*) filter (where decision_count > 1) as multiple_decision_sessions,
  (select count(*) from user_visits where visit_count > 1) as return_users
from public.analytics_sessions;

revoke all on function public.start_analytics_session(uuid, uuid, text, text, text) from public;
revoke all on function public.record_analytics_activity(uuid, uuid, boolean) from public;
revoke all on function public.complete_analytics_session(uuid, uuid) from public;
revoke all on function public.start_decision_session(uuid, uuid, uuid, uuid, integer, text) from public;
grant execute on function public.start_analytics_session(uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.record_analytics_activity(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.complete_analytics_session(uuid, uuid) to anon, authenticated;
grant execute on function public.start_decision_session(uuid, uuid, uuid, uuid, integer, text) to anon, authenticated;
revoke all on public.engagement_kpi_summary from anon, authenticated;

notify pgrst, 'reload schema';
