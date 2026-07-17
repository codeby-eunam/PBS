create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 30),
  created_at timestamptz not null default now(),
  constraint profiles_user_id_format check (
    user_id = lower(trim(user_id))
    and user_id ~ '^[a-z0-9_]{4,20}$'
  )
);

create unique index if not exists profiles_user_id_lower_unique
on public.profiles (lower(user_id));

alter table public.profiles enable row level security;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Keep auth.users and public.profiles consistent even if the client disconnects
-- immediately after sign-up.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'user_id' is not null
     and new.raw_user_meta_data ->> 'display_name' is not null then
    insert into public.profiles (id, user_id, display_name)
    values (
      new.id,
      new.raw_user_meta_data ->> 'user_id',
      new.raw_user_meta_data ->> 'display_name'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Backfill app users that were created before this migration was installed.
insert into public.profiles (id, user_id, display_name)
select
  id,
  raw_user_meta_data ->> 'user_id',
  raw_user_meta_data ->> 'display_name'
from auth.users
where raw_user_meta_data ->> 'user_id' is not null
  and raw_user_meta_data ->> 'display_name' is not null
on conflict (id) do nothing;

notify pgrst, 'reload schema';
