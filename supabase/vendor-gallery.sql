-- Multiple admin-managed photos per vendor. Apply after vendor-images.sql.
create extension if not exists pgcrypto;

create table if not exists public.vendor_photos (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vendor_photos_active_order_idx
on public.vendor_photos(vendor_id, is_active, sort_order);

alter table public.vendor_photos enable row level security;

drop policy if exists "Public can read active vendor photos" on public.vendor_photos;
create policy "Public can read active vendor photos"
on public.vendor_photos for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can insert vendor photos" on public.vendor_photos;
create policy "Admins can insert vendor photos"
on public.vendor_photos for insert
to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update vendor photos" on public.vendor_photos;
create policy "Admins can update vendor photos"
on public.vendor_photos for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete vendor photos" on public.vendor_photos;
create policy "Admins can delete vendor photos"
on public.vendor_photos for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

notify pgrst, 'reload schema';
