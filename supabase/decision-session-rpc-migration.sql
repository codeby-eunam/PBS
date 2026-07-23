-- Reliable start/completion writes for anonymous decision sessions.
-- Apply after decision-analytics-migration.sql. Safe to run repeatedly.

create or replace function public.start_decision_session(
  p_session_id uuid,
  p_anonymous_user_id uuid,
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

  insert into public.decision_sessions (
    id,
    anonymous_user_id,
    list_id,
    initial_vendor_count,
    decision_method
  ) values (
    p_session_id,
    p_anonymous_user_id,
    p_list_id,
    p_initial_vendor_count,
    p_decision_method
  );
end;
$$;

create or replace function public.complete_decision_session(
  p_session_id uuid,
  p_anonymous_user_id uuid,
  p_result_vendor_id uuid,
  p_result_method text,
  p_decision_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_result_method not in (
    'choose_now_from_swipe',
    'choose_now_from_tournament',
    'swipe_single_remaining',
    'tournament_winner'
  ) then
    raise exception 'Invalid result method' using errcode = '22023';
  end if;
  if p_decision_method not in (
    'single', 'swipe', 'tournament', 'swipe_then_tournament', 'choose_now'
  ) then
    raise exception 'Invalid decision method' using errcode = '22023';
  end if;

  update public.decision_sessions
  set
    completed_at = coalesce(completed_at, now()),
    result_vendor_id = p_result_vendor_id,
    result_method = p_result_method,
    decision_method = p_decision_method,
    updated_at = now()
  where id = p_session_id
    and anonymous_user_id = p_anonymous_user_id
    and (result_vendor_id is null or result_vendor_id = p_result_vendor_id);

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Decision session not found or already completed differently'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.start_decision_session(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.complete_decision_session(uuid, uuid, uuid, text, text) from public;
grant execute on function public.start_decision_session(uuid, uuid, uuid, integer, text)
  to anon, authenticated;
grant execute on function public.complete_decision_session(uuid, uuid, uuid, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
