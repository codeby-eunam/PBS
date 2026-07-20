alter table public.review_photos enable row level security;

drop policy if exists "Anyone can read review photos" on public.review_photos;
drop policy if exists "Users can read their own review photos" on public.review_photos;
create policy "Users can read their own review photos"
on public.review_photos for select
to authenticated
using (user_id = auth.uid());

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

-- Clients can bypass browser validation. Serialize inserts per review so two
-- concurrent uploads cannot both pass the count check.
create or replace function public.enforce_review_photo_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.review_id::text, 0));
  if (select count(*) from public.review_photos where review_id = new.review_id) >= 3 then
    raise exception 'A review can have at most 3 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists review_photos_limit_trigger on public.review_photos;
create trigger review_photos_limit_trigger
before insert on public.review_photos
for each row execute function public.enforce_review_photo_limit();
