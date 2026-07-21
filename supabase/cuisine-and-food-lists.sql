-- Curated cuisine and food-category lists supplied by the user.
-- Apply after vendors.sql and decision-service.sql.
-- Idempotent: unrelated vendor metadata is preserved; only memberships of the
-- named curated lists are rebuilt.

begin;

create temporary table category_import (
  list_name text not null,
  metadata_column text not null check (metadata_column in ('cuisines', 'food_types', 'dietary_tags')),
  metadata_tag text not null,
  description text not null,
  vendor_names text[] not null
) on commit drop;

insert into category_import
  (list_name, metadata_column, metadata_tag, description, vendor_names)
values
  ('American Food', 'cuisines', 'American',
   'Vendors curated as American food based on the supplied lineup and menu descriptions.',
   array['BACON MANIA','BEIGNETS & PO BOYS','BLUE MAINE LOBSTER','BONE N MARROW','CA C''EST BON','CHEESY BOYS','CRUST & CRUNCH PIZZA','DEEP FRIED FANATICS','DRIPS CHEESECAKE','ELLIPSIS COOKIE CO','FAMOUS PUDN','FLAVORZ','GHOSTIX','GOURMET SOUL BBQ','GRILLED CHEESE GARDEN','J AND J LOUISIANA BBQ','NOLA OYSTERIA','ON A STICK','POTATO HUT','SEAFOOD BABEZ','SMASH KINGS','SMOKE AND SPOON','SOULLGOODEATS','SWEET ART COTTON CANDY','SWEET BALLS OF FRYER','TRUE CAJUN','WARTHOG BARBEQUE PIT RESTAURANT AND CATERING','WE BEE ROLLIN','WILLIE D''S','WUT-A-PICKLE','5ON95']::text[]),
  ('Chinese Food', 'cuisines', 'Chinese',
   'Vendors curated as Chinese food based on the supplied lineup and menu descriptions.',
   array['ALL DAT DUMPLING','ALL DAT NOODLE','DIM SUM MASTER','DRUNKEN DUMPLING','GREENSTEAMER','HGG TANGHULU','MAISON TANGHULU','MASTER HE','SAUTEED POTSTICKERS','TASTY TIME CHINESE BBQ','THE TOP RESTAURANT AND LOUNGE','YI FAN NOODLES']::text[]),
  ('Korean Food', 'cuisines', 'Korean',
   'Vendors curated as Korean food based on the supplied lineup and menu descriptions.',
   array['BINGSOO','GEN KOREAN BBQ','HOLY COW','KOCHI PO-CHA','MR. BULLY','SEATTLE KIMCHI','SEOUL AMIGOS','SNOWY VILLAGE','THE HWACHAE']::text[]),
  ('Japanese Food', 'cuisines', 'Japanese',
   'Vendors curated as Japanese food based on the supplied lineup and menu descriptions.',
   array['HOKKAIDO RAMEN SANTOUKA','SHI TAKOYAKI','SUSHI PIZZERIA','UNCLE TETSU','YAKITORI YADO']::text[]),
  ('Thai Food', 'cuisines', 'Thai',
   'Vendors curated as Thai food based on the supplied lineup and menu descriptions.',
   array['AMOUR','E-JAE PAK MOR','I-TIM TODD','LAMOON THAI TEA','PINK MANGO']::text[]),
  ('Vietnamese Food', 'cuisines', 'Vietnamese',
   'Vendors curated as Vietnamese food based on the supplied lineup and menu descriptions.',
   array['CHOPCHOP','CAPHETERIA','LE NOMADE','PAPA KITCHEN','36 STREETS VIETNAMESE COFFEE & TEA']::text[]),
  ('Filipino Food', 'cuisines', 'Filipino',
   'Vendors curated as Filipino food based on the supplied lineup and menu descriptions.',
   array['BOBAHOLIC CAFE','HOUSE OF UBE','LUMPIA BUCKET','MEKENI''S KITCHEN','NANA''S FOOD BITES','OAQUI 5 PANCIT AND LUMPIA','PINOY KITCHEN PANLASANG PINOY','SUITE J CATERING','SUGARMAMA SUGARCANE']::text[]),
  ('Indian Food', 'cuisines', 'Indian',
   'Vendors curated as Indian food based on the supplied lineup and menu descriptions.',
   array['CURRY LEAF']::text[]),
  ('Mexican & Latin American Food', 'cuisines', 'Mexican & Latin American',
   'Vendors curated as Mexican or Latin American food based on the supplied lineup and menu descriptions.',
   array['AGUAFRESCAQUEEN','BIRRIERIA MICHI','COCINA CASERA SOUTH AMERICAN RESTAURANT','GOURMET CHURROS','HUMOS BBQ','J&A ELOTERIA','LASCHELAGUAS','MEXICALI CANDY LLC','PUERTO RICAN FLAVOR','PUPUSERIA NATALIE','ROSAS CHURROS','TACOS EL YOYO']::text[]),
  ('Middle Eastern Food', 'cuisines', 'Middle Eastern',
   'Vendors curated as Middle Eastern food based on the supplied lineup and menu descriptions.',
   array['MEGA CHARCOAL BBQ','REEM''S KITCHEN']::text[]),
  ('African Food', 'cuisines', 'African',
   'Vendors curated as African food based on the supplied lineup and menu descriptions.',
   array['DIJAH''S KITCHEN','ETHIOPIAN BITES BY AHADU','JEREMY''S CHICKEN','PLATESOFSHADE']::text[]),
  ('Caribbean Food', 'cuisines', 'Caribbean',
   'Vendors curated as Caribbean food based on the supplied lineup and menu descriptions.',
   array['JAMAICAN JERK SHACK']::text[]),
  ('Hawaiian / Pacific Islander Food', 'cuisines', 'Hawaiian / Pacific Islander',
   'Vendors curated as Hawaiian or Pacific Islander food based on the supplied lineup and menu descriptions.',
   array['BIG ISLAND POKE & GRILL','GOOD VIBES CONCESSIONS','HANA HOU SHAVE ICE','HAWAIIAN HONEY CONES','NOODLE BOYS','PINEAPPLE BOYS']::text[]),
  ('Burmese Food', 'cuisines', 'Burmese',
   'Vendors curated as Burmese food based on the supplied lineup and menu descriptions.',
   array['INWA BURMESE CUISINE']::text[]),
  ('Fusion / Mixed Cuisine', 'cuisines', 'Fusion / Mixed',
   'Vendors with menus spanning multiple cuisines or fusion styles.',
   array['BITES AND CREAM','BLASIAN EATS','BONE N MARROW','C BAO','CHEESE WHEEL PASTA','FALLOW GROUND','GOLDEN CRISP CAKE','MOLLY KITCHEN','OH DANG']::text[]),

  ('Seafood', 'food_types', 'Seafood',
   'Vendors with one or more seafood menu items; not every item from each vendor is seafood.',
   array['AMOUR','ANCHOVIES AND SALT','BEIGNETS & PO BOYS','BIG ISLAND POKE & GRILL','BITES AND CREAM','BLASIAN EATS','BLUE MAINE LOBSTER','CHEESE WHEEL PASTA','CHOPCHOP','DIM SUM MASTER','FLAVORZ','LAMOON THAI TEA','LOBSTERHAUS','LUKE''S LOBSTER','MOLLY KITCHEN','NOLA OYSTERIA','NOODLE BOYS','PINEAPPLE BOYS','SEAFOOD BABEZ','SHI TAKOYAKI','SUSHI PIZZERIA']::text[]),
  ('BBQ / Grilled', 'food_types', 'BBQ / Grilled',
   'Vendors with barbecue, smoked, skewered, or grilled menu items.',
   array['ANCHOVIES AND SALT','GEN KOREAN BBQ','GOURMET SOUL BBQ','HUMOS BBQ','J AND J LOUISIANA BBQ','JEREMY''S CHICKEN','MEGA CHARCOAL BBQ','MEKENI''S KITCHEN','PINEAPPLE BOYS','SMOKE AND SPOON','TASTY TIME CHINESE BBQ','TRUE CAJUN','WARTHOG BARBEQUE PIT RESTAURANT AND CATERING','YAKITORI YADO']::text[]),
  ('Gluten-Free-Leaning', 'dietary_tags', 'gluten-free-leaning',
   'Estimated from menu names that appear to offer items without bread, batter, or noodles. This is not an allergen guarantee; ingredients, preparation, and cross-contact must be confirmed with the vendor.',
   array['BIG ISLAND POKE & GRILL','SEATTLE KIMCHI','MOLLY KITCHEN','MEGA CHARCOAL BBQ','SWEETLIPS','SUGARMAMA SUGARCANE','COCO LOCO']::text[]),
  ('Dairy-Free-Leaning', 'dietary_tags', 'dairy-free-leaning',
   'Estimated from menu names that appear to offer dairy-free items. This is not an allergen guarantee; ingredients, preparation, and cross-contact must be confirmed with the vendor.',
   array['BIG ISLAND POKE & GRILL','SEATTLE KIMCHI','MEGA CHARCOAL BBQ','SUGARMAMA SUGARCANE','AGUAFRESCAQUEEN','SWEETLIPS','HGG TANGHULU','MAISON TANGHULU']::text[]),
  ('Desserts & Sweets', 'food_types', 'Desserts & Sweets',
   'Vendors offering desserts, sweets, frozen treats, or baked goods.',
   array['BINGSOO','BOBAHOLIC CAFE','CAN CAKES','CHIMNEY CAKES','COCO LOCO','DELICIEUX','DRIPS CHEESECAKE','ELLIPSIS COOKIE CO','ETOILE FILANTE PATISSERIE','FAMOUS PUDN','GOURMET CHURROS','HANA HOU SHAVE ICE','HAWAIIAN HONEY CONES','HGG TANGHULU','HOUSE OF UBE','I-TIM TODD','MAISON TANGHULU','MORE PLEASE','ROSAS CHURROS','SNOWY VILLAGE','SWEET ART COTTON CANDY','SWEET BALLS OF FRYER','SWEETLIPS','UNCLE TETSU']::text[]),
  ('Beverages', 'food_types', 'Beverages',
   'Vendors offering coffee, tea, lemonade, aguas frescas, sugarcane drinks, or other beverages.',
   array['AGUAFRESCAQUEEN','BIG BABY BOTTLE','CAPHETERIA','CREAM & SODA','FALLOW GROUND','GROUNDS CREAM COFFEE','SPICE COFFEE- CAFE CALIENTE','SUGARMAMA SUGARCANE','THE HWACHAE','36 STREETS VIETNAMESE COFFEE & TEA']::text[]);

create temporary table category_vendor_import on commit drop as
select
  c.list_name,
  c.metadata_column,
  c.metadata_tag,
  c.description,
  names.vendor_name,
  names.sort_order - 1 as sort_order
from category_import c
cross join lateral unnest(c.vendor_names) with ordinality names(vendor_name, sort_order);

-- Resolve duplicate vendor names to one stable representative without deleting
-- catalog data. Prefer an active, menu-populated, recently updated row.
create temporary table category_vendor_resolved on commit drop as
select requested.vendor_name, chosen.id as vendor_id
from (select distinct vendor_name from category_vendor_import) requested
cross join lateral (
  select v.id
  from public.vendors v
  where lower(trim(v.name)) = lower(trim(requested.vendor_name))
  order by
    v.is_active desc,
    cardinality(coalesce(v.menu_items, '{}')) desc,
    v.updated_at desc nulls last,
    v.created_at asc nulls last,
    v.id
  limit 1
) chosen;

-- Abort before persistent changes when any supplied name is absent.
do $$
declare
  bad_names text;
begin
  select string_agg(i.vendor_name, ', ' order by i.vendor_name)
  into bad_names
  from (select distinct vendor_name from category_vendor_import) i
  left join category_vendor_resolved r on r.vendor_name = i.vendor_name
  where r.vendor_id is null;

  if bad_names is not null then
    raise exception 'Category list vendors not found: %', bad_names;
  end if;
end $$;

-- Merge classifications into the vendor catalog without deleting existing values.
with tags as (
  select v.id, array_agg(distinct i.metadata_tag) as values_to_add
  from category_vendor_import i
  join category_vendor_resolved r on r.vendor_name = i.vendor_name
  join public.vendors v on v.id = r.vendor_id
  where i.metadata_column = 'cuisines'
  group by v.id
)
update public.vendors v
set cuisines = (select array_agg(distinct x order by x) from unnest(coalesce(v.cuisines, '{}') || tags.values_to_add) x),
    updated_at = now()
from tags where v.id = tags.id;

with tags as (
  select v.id, array_agg(distinct i.metadata_tag) as values_to_add
  from category_vendor_import i
  join category_vendor_resolved r on r.vendor_name = i.vendor_name
  join public.vendors v on v.id = r.vendor_id
  where i.metadata_column = 'food_types'
  group by v.id
)
update public.vendors v
set food_types = (select array_agg(distinct x order by x) from unnest(coalesce(v.food_types, '{}') || tags.values_to_add) x),
    updated_at = now()
from tags where v.id = tags.id;

with tags as (
  select v.id, array_agg(distinct i.metadata_tag) as values_to_add
  from category_vendor_import i
  join category_vendor_resolved r on r.vendor_name = i.vendor_name
  join public.vendors v on v.id = r.vendor_id
  where i.metadata_column = 'dietary_tags'
  group by v.id
)
update public.vendors v
set dietary_tags = (select array_agg(distinct x order by x) from unnest(coalesce(v.dietary_tags, '{}') || tags.values_to_add) x),
    updated_at = now()
from tags where v.id = tags.id;

-- Create each list if missing and refresh its metadata.
insert into public.lists (name, description, tags, is_active)
select c.list_name, c.description, array[c.metadata_tag]::text[], true
from category_import c
where not exists (select 1 from public.lists l where l.name = c.list_name);

update public.lists l
set description = c.description,
    tags = array[c.metadata_tag]::text[],
    is_active = true
from category_import c
where l.name = c.list_name;

do $$
declare
  duplicate_lists text;
begin
  select string_agg(name, ', ' order by name)
  into duplicate_lists
  from (
    select l.name
    from public.lists l
    join category_import c on c.list_name = l.name
    group by l.name
    having count(*) <> 1
  ) duplicates;

  if duplicate_lists is not null then
    raise exception 'Expected exactly one curated list for: %', duplicate_lists;
  end if;
end $$;

delete from public.list_vendors lv
using public.lists l, category_import c
where lv.list_id = l.id and l.name = c.list_name;

insert into public.list_vendors (list_id, vendor_id, sort_order)
select l.id, v.id, i.sort_order
from category_vendor_import i
join public.lists l on l.name = i.list_name
join category_vendor_resolved r on r.vendor_name = i.vendor_name
join public.vendors v on v.id = r.vendor_id;

-- Verification: returns the final count for every curated list.
select l.name, count(lv.vendor_id) as vendor_count
from public.lists l
join category_import c on c.list_name = l.name
left join public.list_vendors lv on lv.list_id = l.id
group by l.id, l.name
order by l.name;

commit;
