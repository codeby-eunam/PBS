-- Curated dietary lists based only on the supplied Bite of Seattle page/menu text.
-- This migration is idempotent: it preserves unrelated dietary tags and rebuilds
-- only the three lists named below.

begin;

create temporary table dietary_list_import (
  list_name text not null,
  vendor_name text not null,
  evidence text not null,
  needs_confirmation boolean not null default false,
  sort_order integer not null,
  primary key (list_name, vendor_name)
) on commit drop;

insert into dietary_list_import
  (list_name, vendor_name, evidence, needs_confirmation, sort_order)
values
  ('Halal', 'JEREMY''S CHICKEN', 'Explicit menu item: Smoked Halal Chicken', false, 0),

  ('Vegetarian-Friendly', 'ETHIOPIAN BITES BY AHADU', 'Explicit menu text: Ethiopian Vegetarian Dishes', false, 0),
  ('Vegetarian-Friendly', 'SEATTLE KIMCHI', 'Explicit menu item: Vegan Napa Cabbage Kimchi', false, 1),
  ('Vegetarian-Friendly', 'AGUAFRESCAQUEEN', 'Aguas Frescas, Mini Pancakes, Chocolate Covered Strawberries', false, 2),
  ('Vegetarian-Friendly', 'BIG BABY BOTTLE', 'Fresh Lemonade', false, 3),
  ('Vegetarian-Friendly', 'BOBAHOLIC CAFE', 'Croffles, Pandayaki', false, 4),
  ('Vegetarian-Friendly', 'C BAO', 'Belgian Pomme Frites', false, 5),
  ('Vegetarian-Friendly', 'CAN CAKES', 'Cake in a Can', false, 6),
  ('Vegetarian-Friendly', 'CHIMNEY CAKES', 'Chimney cakes', false, 7),
  ('Vegetarian-Friendly', 'COCO LOCO', 'Coconut Ice Cream, Coconut Smoothie, Mango Sticky Rice', false, 8),
  ('Vegetarian-Friendly', 'CREAM & SODA', 'Cream Soda, Dirty Soda', false, 9),
  ('Vegetarian-Friendly', 'CAPHETERIA', 'Teas and avocado smoothie', false, 10),
  ('Vegetarian-Friendly', 'DELICIEUX', 'Crepes', false, 11),
  ('Vegetarian-Friendly', 'DRIPS CHEESECAKE', 'Cheesecake and stuffed cookie', false, 12),
  ('Vegetarian-Friendly', 'ETOILE FILANTE PATISSERIE', 'Macaron and cakes', false, 13),
  ('Vegetarian-Friendly', 'FALLOW GROUND', 'Matcha drinks', false, 14),
  ('Vegetarian-Friendly', 'FAMOUS PUDN', 'Banana pudding', false, 15),
  ('Vegetarian-Friendly', 'GROUNDS CREAM COFFEE', 'Coffee drinks', false, 16),
  ('Vegetarian-Friendly', 'HANA HOU SHAVE ICE', 'Shaved ice and Halo-Halo', false, 17),
  ('Vegetarian-Friendly', 'HAWAIIAN HONEY CONES', 'Ice cream and honey cones', false, 18),
  ('Vegetarian-Friendly', 'HGG TANGHULU', 'Fruit tanghulu', false, 19),
  ('Vegetarian-Friendly', 'MAISON TANGHULU', 'Fruit tanghulu', false, 20),
  ('Vegetarian-Friendly', 'HOUSE OF UBE', 'Ube desserts', false, 21),
  ('Vegetarian-Friendly', 'I-TIM TODD', 'Fried ice cream', false, 22),
  ('Vegetarian-Friendly', 'J&A ELOTERIA', 'Kettle Corn and Fresh Squeezed Lemonade; confirm elote ingredients separately', true, 23),
  ('Vegetarian-Friendly', 'MORE PLEASE', 'Cookies, cakes, cinnamon rolls', false, 24),
  ('Vegetarian-Friendly', 'PENNY POP POPCORN', 'Popcorn', false, 25),
  ('Vegetarian-Friendly', 'PINK MANGO', 'Mango Sticky Rice and fruit smoothies', false, 26),
  ('Vegetarian-Friendly', 'ROSAS CHURROS', 'Stuffed churros', false, 27),
  ('Vegetarian-Friendly', 'BINGSOO', 'Bingsoo', false, 28),
  ('Vegetarian-Friendly', 'SNOWY VILLAGE', 'Bingsoo', false, 29),
  ('Vegetarian-Friendly', 'SPICE COFFEE- CAFE CALIENTE', 'Coffee', false, 30),
  ('Vegetarian-Friendly', 'SUGARMAMA SUGARCANE', 'Sugarcane drinks', false, 31),
  ('Vegetarian-Friendly', 'SWEET ART COTTON CANDY', 'Cotton candy', false, 32),
  ('Vegetarian-Friendly', 'SWEETLIPS', 'Shaved Frozen Fruit', false, 33),
  ('Vegetarian-Friendly', 'THE HWACHAE', 'Korean Fruit Punch', false, 34),
  ('Vegetarian-Friendly', 'UNCLE TETSU', 'Cookies and cheesecake tart', false, 35),
  ('Vegetarian-Friendly', '36 STREETS VIETNAMESE COFFEE & TEA', 'Coffee and tea', false, 36),

  ('Vegan-Friendly', 'SEATTLE KIMCHI', 'Explicit menu item: Vegan Napa Cabbage Kimchi', false, 0),
  ('Vegan-Friendly', 'SUGARMAMA SUGARCANE', 'Sugarcane juice', false, 1),
  ('Vegan-Friendly', 'SWEETLIPS', 'Shaved Frozen Fruit', false, 2),
  ('Vegan-Friendly', 'BIG BABY BOTTLE', 'Fresh Lemonade', false, 3),
  ('Vegan-Friendly', 'HGG TANGHULU', 'Fruit tanghulu; confirm coating contains no gelatin', true, 4),
  ('Vegan-Friendly', 'MAISON TANGHULU', 'Fruit tanghulu; confirm coating contains no gelatin', true, 5);

-- Fail before changing persistent data if a curated name is absent or ambiguous.
do $$
declare
  bad_names text;
begin
  select string_agg(i.vendor_name || ' (' || count_match || ' matches)', ', ' order by i.vendor_name)
  into bad_names
  from (
    select d.vendor_name, count(v.id) as count_match
    from (select distinct vendor_name from dietary_list_import) d
    left join public.vendors v on lower(trim(v.name)) = lower(trim(d.vendor_name))
    group by d.vendor_name
    having count(v.id) <> 1
  ) i;

  if bad_names is not null then
    raise exception 'Dietary list vendor matching failed: %', bad_names;
  end if;
end $$;

-- Merge filter tags without overwriting any existing classification.
with vendor_tags as (
  select
    v.id,
    array_agg(distinct
      case i.list_name
        when 'Halal' then 'halal'
        when 'Vegetarian-Friendly' then 'vegetarian-friendly'
        when 'Vegan-Friendly' then 'vegan-friendly'
      end
    ) || case when bool_or(i.needs_confirmation and i.list_name = 'Vegan-Friendly')
              then array['vegan-check-required']::text[] else '{}'::text[] end as tags
  from dietary_list_import i
  join public.vendors v on lower(trim(v.name)) = lower(trim(i.vendor_name))
  group by v.id
)
update public.vendors v
set dietary_tags = (
      select array_agg(distinct tag order by tag)
      from unnest(coalesce(v.dietary_tags, '{}') || vendor_tags.tags) tag
    ),
    updated_at = now()
from vendor_tags
where v.id = vendor_tags.id;

-- Create each curated list once, then keep its copy and membership current.
insert into public.lists (name, description, tags, is_active)
select x.name, x.description, x.tags, true
from (values
  ('Halal', 'Only vendors whose supplied page/menu text explicitly says Halal. Confirm preparation and cross-contact with the vendor.', array['halal']::text[]),
  ('Vegetarian-Friendly', 'Vendors explicitly described as vegetarian or showing at least one menu item with no listed meat, poultry, or seafood. Ingredients and cross-contact are not guaranteed.', array['vegetarian', 'dietary']::text[]),
  ('Vegan-Friendly', 'Limited list of menu items with no listed meat, seafood, dairy, or egg. Confirm ingredients with the vendor; tanghulu coating requires verification.', array['vegan', 'dietary']::text[])
) x(name, description, tags)
where not exists (select 1 from public.lists l where l.name = x.name);

update public.lists l
set description = x.description, tags = x.tags, is_active = true
from (values
  ('Halal', 'Only vendors whose supplied page/menu text explicitly says Halal. Confirm preparation and cross-contact with the vendor.', array['halal']::text[]),
  ('Vegetarian-Friendly', 'Vendors explicitly described as vegetarian or showing at least one menu item with no listed meat, poultry, or seafood. Ingredients and cross-contact are not guaranteed.', array['vegetarian', 'dietary']::text[]),
  ('Vegan-Friendly', 'Limited list of menu items with no listed meat, seafood, dairy, or egg. Confirm ingredients with the vendor; tanghulu coating requires verification.', array['vegan', 'dietary']::text[])
) x(name, description, tags)
where l.name = x.name;

do $$
declare
  duplicate_lists text;
begin
  select string_agg(name, ', ' order by name)
  into duplicate_lists
  from (
    select name
    from public.lists
    where name in ('Halal', 'Vegetarian-Friendly', 'Vegan-Friendly')
    group by name
    having count(*) <> 1
  ) duplicates;

  if duplicate_lists is not null then
    raise exception 'Expected exactly one curated list for: %', duplicate_lists;
  end if;
end $$;

delete from public.list_vendors lv
using public.lists l
where lv.list_id = l.id
  and l.name in ('Halal', 'Vegetarian-Friendly', 'Vegan-Friendly');

insert into public.list_vendors (list_id, vendor_id, sort_order)
select l.id, v.id, i.sort_order
from dietary_list_import i
join public.lists l on l.name = i.list_name
join public.vendors v on lower(trim(v.name)) = lower(trim(i.vendor_name));

commit;

-- Verification result: expected counts are Halal=1, Vegetarian-Friendly=37,
-- Vegan-Friendly=6. Evidence is retained below for review/auditing.
select l.name, count(lv.vendor_id) as vendor_count
from public.lists l
left join public.list_vendors lv on lv.list_id = l.id
where l.name in ('Halal', 'Vegetarian-Friendly', 'Vegan-Friendly')
group by l.id, l.name
order by l.name;

select name, dietary_tags
from public.vendors
where dietary_tags && array['halal', 'vegetarian-friendly', 'vegan-friendly']::text[]
order by name;
