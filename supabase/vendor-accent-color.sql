-- Per-vendor accent color, extracted once from the vendor image (or a
-- branded fallback when no image exists / extraction fails).
alter table public.vendors add column if not exists accent_color text not null default '#B8532F';
alter table public.vendors add column if not exists accent_color_source text not null default 'fallback';
alter table public.vendors add column if not exists accent_color_updated_at timestamptz;

alter table public.vendors drop constraint if exists vendors_accent_color_source_check;
alter table public.vendors add constraint vendors_accent_color_source_check
  check (accent_color_source in ('image', 'fallback', 'manual'));

-- Re-grant the admin update column list to include the new columns
-- alongside image_path (see vendor-images.sql).
revoke update on public.vendors from authenticated;
grant update (image_path, accent_color, accent_color_source, accent_color_updated_at)
on public.vendors to authenticated;

notify pgrst, 'reload schema';
