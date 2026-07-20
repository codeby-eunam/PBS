-- Admin-managed vendor images. Store only the Storage object path in vendors.
alter table public.vendors add column if not exists image_path text;

drop policy if exists "Admins can update vendor images" on public.vendors;
create policy "Admins can update vendor images"
on public.vendors for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke update on public.vendors from authenticated;
grant update (image_path) on public.vendors to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-images',
  'vendor-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read vendor images" on storage.objects;
create policy "Public can read vendor images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'vendor-images');

drop policy if exists "Admins can upload vendor images" on storage.objects;
create policy "Admins can upload vendor images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vendor-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "Admins can delete vendor images" on storage.objects;
create policy "Admins can delete vendor images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vendor-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

notify pgrst, 'reload schema';
