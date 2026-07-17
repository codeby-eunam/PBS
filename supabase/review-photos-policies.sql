alter table public.review_photos enable row level security;

drop policy if exists "Anyone can read review photos" on public.review_photos;
create policy "Anyone can read review photos"
on public.review_photos for select
to anon, authenticated
using (true);

drop policy if exists "Users can create their own review photos" on public.review_photos;
create policy "Users can create their own review photos"
on public.review_photos for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.reviews
    where reviews.id = review_photos.review_id
      and reviews.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own review photos" on public.review_photos;
create policy "Users can delete their own review photos"
on public.review_photos for delete
to authenticated
using (user_id = auth.uid());
