-- Reconcile the Supabase vendor catalog with the Bite of Seattle lineup.
-- Safe to run repeatedly: deletes target exact names and inserts only missing names.

begin;

-- Exact normalized-name matching intentionally preserves similarly named vendors,
-- including "The DLT Jewel Co." (without "LLC").
delete from public.vendors
where lower(btrim(name)) in (
  'brick & morty''s burgers',
  'saigon station',
  'masae''s teriyaki',
  'beignets & gumbo',
  'more to life beignets',
  'jewels llc',
  'simply adorn me',
  'the dlt jewel co. llc'
);

with desired_vendors(name, vendor_type, list_order) as (
  values
    ('Aguafrescaqueen', 'food', 1),
    ('Beignets & Po Boys', 'food', 2),
    ('Bites and Cream', 'food', 3),
    ('Bone N Marrow', 'food', 4),
    ('C Bao', 'food', 5),
    ('Cheesy Boys', 'food', 6),
    ('Coco Loco', 'food', 7),
    ('Crust & Crunch Pizza', 'food', 8),
    ('Curry Leaf', 'food', 9),
    ('Drunken Dumpling', 'food', 10),
    ('Famous Pudn', 'food', 11),
    ('Inwa Burmese Cuisine', 'food', 12),
    ('Mekeni''s Kitchen', 'food', 13),
    ('Penny Pop Popcorn', 'food', 14),
    ('Pink Mango', 'food', 15),
    ('Potato Hut', 'food', 16),
    ('Pupuseria Natalie', 'food', 17),
    ('Spice Coffee - Cafe Caliente', 'food', 18),
    ('The Top Restaurant and Lounge', 'food', 19),
    ('We Bee Rollin', 'food', 20),
    ('Wut-A-Pickle', 'food', 21),
    ('Customs by Jazz', 'shopping', 22),
    ('Mistura Woodcoholics', 'shopping', 23),
    ('Richard Jahn Art Gallery', 'shopping', 24),
    ('Soupermandoo', 'shopping', 25),
    ('Urban Jungle', 'shopping', 26)
),
current_sort as (
  select coalesce(max(sort_order), -1) as max_sort_order
  from public.vendors
)
insert into public.vendors (
  id,
  name,
  vendor_type,
  source,
  is_active,
  sort_order
)
select
  gen_random_uuid(),
  desired.name,
  desired.vendor_type,
  'Bite of Seattle lineup reconciliation',
  true,
  current_sort.max_sort_order + desired.list_order
from desired_vendors as desired
cross join current_sort
where not exists (
  select 1
  from public.vendors as existing
  where lower(btrim(existing.name)) = lower(btrim(desired.name))
);

commit;

-- Verification result: should return 26 rows after a successful run.
select name, vendor_type, is_active, sort_order
from public.vendors
where lower(btrim(name)) in (
  'aguafrescaqueen',
  'beignets & po boys',
  'bites and cream',
  'bone n marrow',
  'c bao',
  'cheesy boys',
  'coco loco',
  'crust & crunch pizza',
  'curry leaf',
  'drunken dumpling',
  'famous pudn',
  'inwa burmese cuisine',
  'mekeni''s kitchen',
  'penny pop popcorn',
  'pink mango',
  'potato hut',
  'pupuseria natalie',
  'spice coffee - cafe caliente',
  'the top restaurant and lounge',
  'we bee rollin',
  'wut-a-pickle',
  'customs by jazz',
  'mistura woodcoholics',
  'richard jahn art gallery',
  'soupermandoo',
  'urban jungle'
)
order by sort_order, name;
