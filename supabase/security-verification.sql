-- Run after deploying all SQL files. Every row should return true.
select 'content_reports_rls' as check_name, relrowsecurity as passed
from pg_class where oid = 'public.content_reports'::regclass
union all
select 'review_photos_rls', relrowsecurity
from pg_class where oid = 'public.review_photos'::regclass
union all
select 'reviews_vendor_created_idx', to_regclass('public.reviews_vendor_created_idx') is not null
union all
select 'content_reports_ip_created_idx', to_regclass('public.content_reports_ip_created_idx') is not null
union all
select 'submit_content_report_function', to_regprocedure('public.submit_content_report(uuid,text,uuid,text,text)') is not null
union all
select 'delete_own_review_function', to_regprocedure('public.delete_own_review(uuid)') is not null
union all
select 'community_photos_bucket', exists (
  select 1 from storage.buckets
  where id = 'community-photos' and public and file_size_limit = 5242880
)
union all
select 'community_photos_upload_policy', exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users can upload community photos'
)
union all
select 'community_photos_delete_policy', exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users can delete their community photos'
)
union all
select 'vendor_images_bucket', exists (
  select 1 from storage.buckets
  where id = 'vendor-images' and public and file_size_limit = 5242880
)
union all
select 'vendor_images_admin_upload_policy', exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Admins can upload vendor images'
);
