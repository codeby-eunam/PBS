-- Register the four client-generated system lists with stable UUIDs.
-- Apply after decision-service.sql. Safe to run more than once.

insert into public.lists (id, name, description, tags, is_active)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'ALL VENDORS',
    'Every active festival vendor.',
    array['all'],
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'ALL FOODS',
    'All food, drink, and dessert vendors.',
    array['all'],
    true
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'ALL GAMES',
    'Every game vendor at the festival.',
    array['all'],
    true
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'ALL SHOPPINGS',
    'Every shopping vendor at the festival.',
    array['all'],
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  tags = excluded.tags,
  is_active = excluded.is_active;

notify pgrst, 'reload schema';
