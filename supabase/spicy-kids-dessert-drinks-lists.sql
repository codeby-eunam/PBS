-- Additional curated discovery lists supplied by the user.
-- Apply after vendors.sql and decision-service.sql.
-- Idempotent: existing vendor tags are preserved and only these four list
-- memberships are rebuilt.

begin;

create temporary table discovery_category_import (
  list_name text not null primary key,
  metadata_tag text not null,
  description text not null,
  vendor_names text[] not null
) on commit drop;

insert into discovery_category_import
  (list_name, metadata_tag, description, vendor_names)
values
  ('Spicy Food', 'Spicy Food',
   'Vendors with at least one menu item described with chili, hot, buffalo, Cajun, jerk, curry, or another potentially spicy flavor. Spice levels vary; confirm with the vendor.',
   array[
     'ALL DAT NOODLE','BIG ISLAND POKE & GRILL','BLASIAN EATS',
     'BLUE MAINE LOBSTER','CA C''EST BON','CHEESY BOYS','CURRY LEAF',
     'DIJAH''S KITCHEN','E-JAE PAK MOR','ETHIOPIAN BITES BY AHADU',
     'FLAVORZ','GHOSTIX','HOLY COW','JAMAICAN JERK SHACK',
     'MEXICALI CANDY LLC','MURDER HORNET HOT SAUCE','PLATESOFSHADE',
     'SEAFOOD BABEZ','SWEET BALLS OF FRYER','TRUE CAJUN','YI FAN NOODLES'
   ]::text[]),

  ('Kid-Friendly', 'Kid-Friendly',
   'Menu-based suggestions that may appeal to children, such as pancakes, fries, pizza, desserts, lemonade, and familiar snacks. This does not guarantee ingredients, allergen safety, portion size, or individual preference.',
   array[
     'AGUAFRESCAQUEEN','BIG BABY BOTTLE','BINGSOO','C BAO','CAN CAKES',
     'CHEESY BOYS','CHIMNEY CAKES','CRUST & CRUNCH PIZZA','DRIPS CHEESECAKE',
     'GHOSTIX','GRILLED CHEESE GARDEN','HANA HOU SHAVE ICE',
     'HAWAIIAN HONEY CONES','I-TIM TODD','MORE PLEASE','ON A STICK',
     'PENNY POP POPCORN','POTATO HUT','ROSAS CHURROS','SMASH KINGS',
     'SNOWY VILLAGE','SWEET ART COTTON CANDY','UNCLE TETSU',
     'WE BEE ROLLIN','WILLIE D''S'
   ]::text[]),

  ('Dessert', 'Dessert',
   'Vendors offering desserts, sweets, frozen treats, or baked goods.',
   array[
     'BINGSOO','BOBAHOLIC CAFE','CAN CAKES','CHIMNEY CAKES','COCO LOCO',
     'DELICIEUX','DRIPS CHEESECAKE','ELLIPSIS COOKIE CO',
     'ETOILE FILANTE PATISSERIE','FAMOUS PUDN','GOURMET CHURROS',
     'HANA HOU SHAVE ICE','HAWAIIAN HONEY CONES','HGG TANGHULU',
     'HOUSE OF UBE','I-TIM TODD','MAISON TANGHULU','MORE PLEASE',
     'ROSAS CHURROS','SNOWY VILLAGE','SWEET ART COTTON CANDY',
     'SWEET BALLS OF FRYER','SWEETLIPS','UNCLE TETSU'
   ]::text[]),

  ('Drinks', 'Drinks',
   'Vendors offering coffee, tea, lemonade, aguas frescas, smoothies, sugarcane drinks, fruit punch, or other beverages.',
   array[
     'AGUAFRESCAQUEEN','BIG BABY BOTTLE','CAPHETERIA','COCO LOCO',
     'CREAM & SODA','FALLOW GROUND','GROUNDS CREAM COFFEE','LASCHELAGUAS',
     'PINK MANGO','SPICE COFFEE- CAFE CALIENTE','SUGARMAMA SUGARCANE',
     'THE HWACHAE','YAKITORI YADO','36 STREETS VIETNAMESE COFFEE & TEA'
   ]::text[]);

create temporary table discovery_vendor_import on commit drop as
select
  c.list_name,
  c.metadata_tag,
  c.description,
  names.vendor_name,
  names.sort_order - 1 as sort_order
from discovery_category_import c
cross join lateral unnest(c.vendor_names)
  with ordinality names(vendor_name, sort_order);

-- Abort before persistent changes if a vendor name is absent or ambiguous.
do $$
declare
  bad_names text;
begin
  select string_agg(
    vendor_name || ' (' || match_count || ' matches)',
    ', ' order by vendor_name
  )
  into bad_names
  from (
    select i.vendor_name, count(v.id) as match_count
    from (select distinct vendor_name from discovery_vendor_import) i
    left join public.vendors v
      on lower(trim(v.name)) = lower(trim(i.vendor_name))
    group by i.vendor_name
    having count(v.id) <> 1
  ) unmatched;

  if bad_names is not null then
    raise exception 'Discovery list vendor matching failed: %', bad_names;
  end if;
end $$;

-- Merge discovery classifications into food_types without deleting old tags.
with tags as (
  select v.id, array_agg(distinct i.metadata_tag) as values_to_add
  from discovery_vendor_import i
  join public.vendors v
    on lower(trim(v.name)) = lower(trim(i.vendor_name))
  group by v.id
)
update public.vendors v
set food_types = (
      select array_agg(distinct tag order by tag)
      from unnest(coalesce(v.food_types, '{}') || tags.values_to_add) tag
    ),
    updated_at = now()
from tags
where v.id = tags.id;

-- Create the four lists once and refresh their metadata on later runs.
insert into public.lists (name, description, tags, is_active)
select c.list_name, c.description, array[c.metadata_tag]::text[], true
from discovery_category_import c
where not exists (
  select 1 from public.lists l where l.name = c.list_name
);

update public.lists l
set description = c.description,
    tags = array[c.metadata_tag]::text[],
    is_active = true
from discovery_category_import c
where l.name = c.list_name;

-- Duplicate list names would make membership ambiguous, so fail safely.
do $$
declare
  duplicate_lists text;
begin
  select string_agg(name, ', ' order by name)
  into duplicate_lists
  from (
    select l.name
    from public.lists l
    join discovery_category_import c on c.list_name = l.name
    group by l.name
    having count(*) <> 1
  ) duplicates;

  if duplicate_lists is not null then
    raise exception 'Expected exactly one curated list for: %', duplicate_lists;
  end if;
end $$;

delete from public.list_vendors lv
using public.lists l, discovery_category_import c
where lv.list_id = l.id
  and l.name = c.list_name;

insert into public.list_vendors (list_id, vendor_id, sort_order)
select l.id, v.id, i.sort_order
from discovery_vendor_import i
join public.lists l on l.name = i.list_name
join public.vendors v
  on lower(trim(v.name)) = lower(trim(i.vendor_name));

-- Expected counts: Dessert=24, Drinks=14, Kid-Friendly=25, Spicy Food=21.
select l.name, count(lv.vendor_id) as vendor_count
from public.lists l
join discovery_category_import c on c.list_name = l.name
left join public.list_vendors lv on lv.list_id = l.id
group by l.id, l.name
order by l.name;

commit;
