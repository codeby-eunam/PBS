-- Securely submit or update the post-decision validation survey.
-- Apply after decision-session-rpc-migration.sql. Safe to run repeatedly.

create or replace function public.submit_decision_validation(
  p_decision_session_id uuid,
  p_anonymous_user_id uuid,
  p_ease_score smallint,
  p_easier_than_usual text,
  p_would_use_again boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ease_score not between 1 and 5 then
    raise exception 'Ease score must be between 1 and 5' using errcode = '22023';
  end if;
  if p_easier_than_usual not in ('easier', 'same', 'harder') then
    raise exception 'Invalid comparison response' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.decision_sessions ds
    where ds.id = p_decision_session_id
      and ds.anonymous_user_id = p_anonymous_user_id
      and ds.completed_at is not null
  ) then
    raise exception 'Completed decision session not found' using errcode = 'P0002';
  end if;

  insert into public.decision_validation_responses (
    decision_session_id,
    anonymous_user_id,
    ease_score,
    easier_than_usual,
    would_use_again
  ) values (
    p_decision_session_id,
    p_anonymous_user_id,
    p_ease_score,
    p_easier_than_usual,
    p_would_use_again
  )
  on conflict (decision_session_id) do update
  set
    ease_score = excluded.ease_score,
    easier_than_usual = excluded.easier_than_usual,
    would_use_again = excluded.would_use_again
  where public.decision_validation_responses.anonymous_user_id = excluded.anonymous_user_id;
end;
$$;

revoke all on function public.submit_decision_validation(uuid, uuid, smallint, text, boolean)
  from public;
grant execute on function public.submit_decision_validation(uuid, uuid, smallint, text, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
