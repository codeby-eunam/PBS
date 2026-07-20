create table if not exists public.vendors (
  id uuid primary key,
  name text not null,
  vendor_type text not null check (vendor_type in ('food', 'drink', 'dessert', 'shopping', 'game')),
  cuisines text[] not null default '{}',
  food_types text[] not null default '{}',
  menu_items text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  description text,
  review_count integer not null default 0 check (review_count >= 0),
  review_snippets text[] not null default '{}',
  line_status text check (line_status is null or line_status in ('No line', 'Short', 'Busy', 'Very busy', 'Sold out')),
  instagram_url text,
  source text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` does not add columns to an existing table.
-- Add every column used by the app so older versions can be upgraded in place.
alter table public.vendors add column if not exists vendor_type text;
alter table public.vendors add column if not exists cuisines text[] not null default '{}';
alter table public.vendors add column if not exists food_types text[] not null default '{}';
alter table public.vendors add column if not exists menu_items text[] not null default '{}';
alter table public.vendors add column if not exists dietary_tags text[] not null default '{}';
alter table public.vendors add column if not exists description text;
alter table public.vendors add column if not exists review_count integer not null default 0;
alter table public.vendors add column if not exists review_snippets text[] not null default '{}';
alter table public.vendors add column if not exists line_status text;
alter table public.vendors add column if not exists instagram_url text;
alter table public.vendors add column if not exists source text not null default 'Bite of Seattle vendor data';
alter table public.vendors add column if not exists is_active boolean not null default true;
alter table public.vendors add column if not exists sort_order integer not null default 0;
alter table public.vendors add column if not exists created_at timestamptz not null default now();
alter table public.vendors add column if not exists updated_at timestamptz not null default now();

create index if not exists vendors_active_sort_order_idx
on public.vendors (is_active, sort_order);

alter table public.vendors enable row level security;

drop policy if exists "Anyone can read active vendors" on public.vendors;
create policy "Anyone can read active vendors"
on public.vendors for select
to anon, authenticated
using (is_active = true);

notify pgrst, 'reload schema';
