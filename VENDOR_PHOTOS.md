# Vendor photo workflow

The app supports one existing representative image plus any number of gallery images.

## Initial setup

Run these migrations in Supabase SQL Editor:

1. `supabase/vendor-images.sql`
2. `supabase/vendor-gallery.sql`

## Add photos manually

1. Open Supabase Storage and select the public `vendor-images` bucket.
2. Create or open a folder named with the vendor UUID.
3. Upload JPG, PNG, or WebP files. Each file must be 5 MB or smaller.
4. Copy each object's path, such as `VENDOR_UUID/photo-1.webp`.
5. Add one row per photo to `public.vendor_photos`:
   - `vendor_id`: vendor UUID
   - `storage_path`: copied object path
   - `alt_text`: short description of the food
   - `sort_order`: 0, 1, 2, ...
   - `is_active`: true

Example:

```sql
insert into public.vendor_photos
  (vendor_id, storage_path, alt_text, sort_order)
values
  ('VENDOR_UUID', 'VENDOR_UUID/photo-1.webp', 'Vendor signature dish', 0),
  ('VENDOR_UUID', 'VENDOR_UUID/photo-2.webp', 'Second menu item', 1);
```

Removing a database row hides the image from the app but does not remove the Storage object. Set `is_active` to false when a reversible hide is preferred.
