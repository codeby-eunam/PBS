-- Create a curated list and connect existing vendors.
-- Replace the example name and vendor UUIDs before running.
with new_list as (
  insert into public.lists (name, description, tags, is_active)
  values (
    'Desserts',
    'Sweet vendors selected by the What Looks Good? team.',
    array['dessert', 'sweet'],
    true
  )
  returning id
)
insert into public.list_vendors (list_id, vendor_id, sort_order)
select new_list.id, selected.vendor_id, selected.sort_order
from new_list
cross join (
  values
    ('REPLACE_WITH_VENDOR_UUID_1'::uuid, 0),
    ('REPLACE_WITH_VENDOR_UUID_2'::uuid, 1)
) as selected(vendor_id, sort_order);

-- Find vendor UUIDs first:
-- select id, name, vendor_type from public.vendors where is_active order by name;
