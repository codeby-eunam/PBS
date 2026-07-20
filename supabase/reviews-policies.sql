alter table public.reviews enable row level security;

create index if not exists reviews_vendor_created_idx
on public.reviews (vendor_id, created_at desc);

drop policy if exists "Anyone can read reviews" on public.reviews;
drop policy if exists "Users can read their own reviews" on public.reviews;
create policy "Users can read their own reviews"
on public.reviews for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their own reviews" on public.reviews;
create policy "Users can create their own reviews"
on public.reviews for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Users can update their own reviews"
on public.reviews for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Users can delete their own reviews"
on public.reviews for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.get_vendor_reviews(
  p_vendor_id uuid,
  p_limit integer default 30
)
returns table (
  id uuid,
  vendor_id uuid,
  recommend boolean,
  menu_name text,
  price text,
  reason text,
  comment text,
  line_status text,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean,
  photos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.vendor_id,
    r.recommend,
    r.menu_name,
    r.price,
    r.reason,
    r.comment,
    r.line_status::text,
    r.created_at,
    r.updated_at,
    coalesce(r.user_id = auth.uid(), false) as is_owner,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'review_id', p.review_id,
        'storage_path', p.storage_path,
        'created_at', p.created_at
      ) order by p.created_at)
      from public.review_photos p
      where p.review_id = r.id
    ), '[]'::jsonb) as photos
  from public.reviews r
  where r.vendor_id = p_vendor_id
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.get_vendor_reviews(uuid, integer) from public;
grant execute on function public.get_vendor_reviews(uuid, integer) to anon, authenticated;
