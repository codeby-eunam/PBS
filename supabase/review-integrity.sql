-- Apply in the Supabase SQL Editor before deploying the matching frontend.
-- A SECURITY DEFINER function keeps the photo-row and review-row deletes in
-- one PostgreSQL transaction while still enforcing ownership.
create or replace function public.delete_own_review(p_review_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  storage_paths text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.reviews
    where id = p_review_id and user_id = auth.uid()
  ) then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(storage_path), array[]::text[])
    into storage_paths
    from public.review_photos
    where review_id = p_review_id;

  delete from public.review_photos where review_id = p_review_id;
  delete from public.reviews where id = p_review_id and user_id = auth.uid();
  return storage_paths;
end;
$$;

revoke all on function public.delete_own_review(uuid) from public;
grant execute on function public.delete_own_review(uuid) to authenticated;
