create table if not exists public.user_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  visibility text not null default 'private'
    check (visibility in ('public', 'private')),
  fetch_count bigint not null default 0 check (fetch_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists user_lists_owner_created_idx
on public.user_lists (owner_id, created_at desc);

create table if not exists public.list_fetches (
  list_id uuid not null references public.user_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index if not exists list_fetches_user_fetched_idx
on public.list_fetches (user_id, fetched_at desc);

alter table public.user_lists enable row level security;
alter table public.list_fetches enable row level security;

drop policy if exists "Read own or public lists" on public.user_lists;
create policy "Read own or public lists"
on public.user_lists for select
using (owner_id = auth.uid() or visibility = 'public');

drop policy if exists "Create own lists" on public.user_lists;
create policy "Create own lists"
on public.user_lists for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Update own lists" on public.user_lists;
create policy "Update own lists"
on public.user_lists for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Delete own lists" on public.user_lists;
create policy "Delete own lists"
on public.user_lists for delete to authenticated
using (owner_id = auth.uid());

-- Clients may edit list metadata, but never the counter.
revoke insert, update on public.user_lists from authenticated;
grant select on public.user_lists to anon, authenticated;
grant insert (id, owner_id, title, visibility) on public.user_lists to authenticated;
grant update (title, visibility) on public.user_lists to authenticated;
grant delete on public.user_lists to authenticated;

create or replace function public.fetch_public_list(p_list_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_rows integer;
  result_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_lists
    where id = p_list_id and visibility = 'public'
  ) then
    raise exception 'Public list not found' using errcode = 'P0002';
  end if;

  -- Viewing or fetching your own list does not increase its public count.
  if exists (
    select 1 from public.user_lists
    where id = p_list_id and owner_id = auth.uid()
  ) then
    select fetch_count into result_count
    from public.user_lists where id = p_list_id;
    return result_count;
  end if;

  insert into public.list_fetches (list_id, user_id)
  values (p_list_id, auth.uid())
  on conflict (list_id, user_id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 1 then
    update public.user_lists
    set fetch_count = fetch_count + 1
    where id = p_list_id;
  end if;

  select fetch_count into result_count
  from public.user_lists where id = p_list_id;
  return result_count;
end;
$$;

revoke all on function public.fetch_public_list(uuid) from public;
grant execute on function public.fetch_public_list(uuid) to authenticated;

notify pgrst, 'reload schema';
