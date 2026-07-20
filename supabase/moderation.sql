create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('review', 'photo')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  ip_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists content_reports_ip_created_idx on public.content_reports (ip_hash, created_at desc);
create index if not exists content_reports_reporter_created_idx on public.content_reports (reporter_id, created_at desc);
create index if not exists content_reports_status_created_idx on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;
revoke insert, update, delete on public.content_reports from anon, authenticated;

drop policy if exists "Users can read their own content reports" on public.content_reports;
create policy "Users can read their own content reports"
on public.content_reports for select to authenticated
using (reporter_id = auth.uid());

-- Inserts intentionally happen only through the report-content Edge Function
-- with the service role. This keeps IP hashing and rate limits server-side.

create or replace function public.submit_content_report(
  p_reporter_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_ip_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner uuid;
  reports_from_ip bigint;
  reports_from_user bigint;
begin
  if p_target_type not in ('review', 'photo')
     or char_length(p_reason) not between 3 and 500 then
    return 'invalid';
  end if;

  -- Every caller acquires locks in the same order. Counts and insert are then
  -- one transaction, so concurrent requests cannot all pass the same limit.
  perform pg_advisory_xact_lock(hashtextextended('report-ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('report-user:' || p_reporter_id::text, 0));

  select count(*) into reports_from_ip
  from public.content_reports
  where ip_hash = p_ip_hash
    and created_at >= now() - interval '1 hour';

  select count(*) into reports_from_user
  from public.content_reports
  where reporter_id = p_reporter_id
    and created_at >= now() - interval '1 hour';

  if reports_from_ip >= 10 or reports_from_user >= 5 then
    return 'rate_limited';
  end if;

  if p_target_type = 'review' then
    select user_id into target_owner from public.reviews where id = p_target_id;
  else
    select user_id into target_owner from public.review_photos where id = p_target_id;
  end if;

  if target_owner is null then return 'not_found'; end if;
  if target_owner = p_reporter_id then return 'self_report'; end if;

  insert into public.content_reports (
    reporter_id, target_type, target_id, reason, ip_hash
  ) values (
    p_reporter_id, p_target_type, p_target_id, p_reason, p_ip_hash
  );
  return 'created';
exception
  when unique_violation then return 'duplicate';
end;
$$;

revoke all on function public.submit_content_report(uuid, text, uuid, text, text) from public;
grant execute on function public.submit_content_report(uuid, text, uuid, text, text) to service_role;
