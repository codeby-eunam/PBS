-- Community photo bucket and storage.objects policies.
-- Apply through the Supabase migration workflow before enabling uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-photos',
  'community-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read community photos" on storage.objects;
create policy "Public can read community photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'community-photos');

drop policy if exists "Users can upload community photos" on storage.objects;
create policy "Users can upload community photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists "Users can delete their community photos" on storage.objects;
create policy "Users can delete their community photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-photos'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);
