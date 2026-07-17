create table if not exists public.vendors (
  id uuid primary key,
  name text not null,
  vendor_type text not null check (vendor_type in ('food', 'drink', 'dessert', 'shopping', 'game')),
  cuisines text[] not null default '{}',
  food_types text[] not null default '{}',
  menu_items text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  description text,
  review_count integer not null default 0 check (review_count >= 0),
  review_snippets text[] not null default '{}',
  line_status text check (line_status is null or line_status in ('No line', 'Short', 'Busy', 'Very busy', 'Sold out')),
  instagram_url text,
  source text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` does not add columns to an existing table.
-- Add every column used below so older versions can be upgraded in place.
alter table public.vendors add column if not exists vendor_type text;
alter table public.vendors add column if not exists cuisines text[] not null default '{}';
alter table public.vendors add column if not exists food_types text[] not null default '{}';
alter table public.vendors add column if not exists menu_items text[] not null default '{}';
alter table public.vendors add column if not exists dietary_tags text[] not null default '{}';
alter table public.vendors add column if not exists description text;
alter table public.vendors add column if not exists review_count integer not null default 0;
alter table public.vendors add column if not exists review_snippets text[] not null default '{}';
alter table public.vendors add column if not exists line_status text;
alter table public.vendors add column if not exists instagram_url text;
alter table public.vendors add column if not exists source text not null default 'Bite of Seattle vendor data';
alter table public.vendors add column if not exists is_active boolean not null default true;
alter table public.vendors add column if not exists sort_order integer not null default 0;
alter table public.vendors add column if not exists created_at timestamptz not null default now();
alter table public.vendors add column if not exists updated_at timestamptz not null default now();

create index if not exists vendors_active_sort_order_idx
on public.vendors (is_active, sort_order);

alter table public.vendors enable row level security;

drop policy if exists "Anyone can read active vendors" on public.vendors;
create policy "Anyone can read active vendors"
on public.vendors for select
to anon, authenticated
using (is_active = true);

insert into public.vendors (
  id, name, vendor_type, cuisines, food_types, menu_items, dietary_tags,
  description, review_count, review_snippets, line_status, instagram_url,
  source, is_active, sort_order
) values
(
  '34763e14-767d-55fc-8b0f-6c734fd8bcde', 'Bacon Mania', 'food',
  array['American']::text[], array['Fast Food','Burgers']::text[], array['Burgers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 0
),
(
  '5453b02c-a5d8-5c65-88c0-bde9ed1519cc', 'Brick & Morty''s Burgers', 'food',
  array['American']::text[], array['Fast Food','Burgers']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 1
),
(
  'f28b6df0-e357-51af-8ff4-c38cd4fe3137', 'Smash Kings', 'food',
  array['American']::text[], array['Fast Food','Burgers']::text[], array['Burgers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 2
),
(
  '842ac032-f2dd-50b7-8bb2-2dce2f794de5', '5ON95', 'food',
  array['American']::text[], array['Fast Food','Burgers']::text[], array['Cheese Fries','Nuggets']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 3
),
(
  'cb9c0860-5e41-58fd-8394-c563be45e94f', 'Blue Maine Lobster', 'food',
  array[]::text[], array['Seafood']::text[], array['Lobster Roll']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 4
),
(
  '73a48a12-1e33-5346-85d5-60886dc8de7b', 'Lobsterhaus', 'food',
  array[]::text[], array['Seafood']::text[], array['Grilled Maine Lobster']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 5
),
(
  '08ed8199-5373-53ef-81a1-0e139f32a82b', 'Luke''s Lobster', 'food',
  array[]::text[], array['Seafood']::text[], array['Lobster Roll']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 6
),
(
  '50017e5d-96bb-5b0d-8e51-e534881f0930', 'Big Island Poke & Grill', 'food',
  array[]::text[], array['Seafood']::text[], array['Poke']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 7
),
(
  'a61afc83-0334-5b19-8b59-1890937cf90b', 'Blasian Eats', 'food',
  array[]::text[], array['Seafood']::text[], array['Seafood Boil']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 8
),
(
  '543b986c-0ee9-55cc-8cdc-753a75b4f480', 'Molly Kitchen', 'food',
  array[]::text[], array['Seafood']::text[], array['Seafood Skewers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 9
),
(
  '54ec4ce9-8bdd-5524-8fd0-d913eaa5f7e7', 'Seafood Babez', 'food',
  array[]::text[], array['Seafood']::text[], array['Seafood Boil']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 10
),
(
  'b85748f1-901b-5e3d-8a12-058007bc6783', 'NOLA Oysteria', 'food',
  array[]::text[], array['Seafood']::text[], array['Oysters']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 11
),
(
  '4971942f-05dd-58df-8769-c8415e6a357b', 'Anchovies and Salt', 'food',
  array[]::text[], array['Seafood']::text[], array['Shrimp Skewers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 12
),
(
  '862c7459-cd42-55b2-8437-951c842a9cab', 'Gen Korean BBQ', 'food',
  array['Korean']::text[], array['Korean Food']::text[], array['Galbi','Bulgogi Rice']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 13
),
(
  'b4ccec46-f6bf-5a04-8bba-f70bb1437a65', 'Holy Cow', 'food',
  array['Korean']::text[], array['Korean Food']::text[], array['Braised Short Ribs','Tteokbokki']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 14
),
(
  '22f85f27-12de-5dae-89b1-69ba83857413', 'Ghostix', 'food',
  array['Korean']::text[], array['Korean Food']::text[], array['Korean Corn Dogs']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 15
),
(
  'b62820b4-33a8-5e9d-8e10-9a6f4ef76129', 'Kochi Po-Cha', 'food',
  array['Korean']::text[], array['Korean Food']::text[], array['Fried Chicken','Hot Dogs']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 16
),
(
  '5c38b871-a7a7-514a-8c39-a36776a900e0', 'Seoul Amigos', 'food',
  array['Korean','Asian']::text[], array['Korean Food','Asian Street Food']::text[], array['BBQ Rice','Korean Burrito']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 17
),
(
  '0edd1ea1-19a3-5661-8543-c0879d4d1297', 'All Dat Noodle', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 18
),
(
  'a138b7aa-7c31-5979-8af9-46e4768bfbbd', 'All Dat Dumpling', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 19
),
(
  '0c594a83-c372-54f6-8408-e567482fcf82', 'Hokkaido Ramen Santouka', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Ramen']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 20
),
(
  'e2053e18-e29b-5a80-8cae-3b6ceb6d3c51', 'E-Jae Pak Mor', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Thai Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 21
),
(
  '6b770a94-e223-5bac-8bcc-c0f34930a7d3', 'Yi Fan Noodles', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Spicy Beef Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 22
),
(
  '6919a28f-1c83-5088-8beb-9c1b67523ee0', 'Noodle Boys', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Malasadas']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 23
),
(
  '148c8bc5-144b-521d-86a1-6b05e449a3a5', 'oh dang', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Stir-Fried Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 24
),
(
  '74d6b719-dbe4-525f-87f3-0ff9ac97cb66', 'Golden Crisp Cake', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Spicy Beef Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 25
),
(
  '9212d7c8-5e20-5089-8d31-408888c2afa9', 'Laschelaguas', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Birria Ramen']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 26
),
(
  'd35e34b4-598d-5470-8f83-5abdf9692d31', 'Master He', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Soup','Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 27
),
(
  'a1e190e9-cc0d-5122-8700-d492ff5643d3', 'Sauteed Potstickers', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Soup','Noodles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 28
),
(
  '0d89b9b5-8d26-540d-86c5-034c262ce53d', 'Dim Sum Master', 'food',
  array['Asian']::text[], array['Noodles','Ramen']::text[], array['Soup','Dumplings']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 29
),
(
  'd02eb5ac-f186-50f6-8df3-ae4d4c768243', 'GreenSteamer', 'food',
  array['Chinese','East Asian']::text[], array['Chinese BBQ','Dumplings']::text[], array['Dim Sum','Dumplings']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 30
),
(
  'd37af839-3fe6-59b0-832a-72ff2870c212', 'Tasty Time Chinese BBQ', 'food',
  array['Chinese','East Asian']::text[], array['Chinese BBQ','Dumplings']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 31
),
(
  '1dfd50df-cbb5-55f0-864d-504b9d11ec4d', 'Amour', 'food',
  array['Thai','Southeast Asian']::text[], array['Southeast Asian Food']::text[], array['Thai Food']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 32
),
(
  '4f885ff5-d8f6-5098-8ef8-948f3344da7e', 'Lamoon Thai Tea', 'drink',
  array['Thai','Southeast Asian']::text[], array['Southeast Asian Food','Non-Alcoholic Beverages']::text[], array['Thai Food','Thai Tea']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 33
),
(
  '7b396ca3-f0cb-5905-87e4-394e3099549b', 'Le Nomade', 'food',
  array['Thai','Southeast Asian']::text[], array['Southeast Asian Food']::text[], array['Vietnamese Banh Mi']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 34
),
(
  '2feff7a6-2546-5625-83c0-ec1498a56a7a', 'Saigon Station', 'food',
  array['Thai','Southeast Asian']::text[], array['Southeast Asian Food']::text[], array['Vietnamese Food']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 35
),
(
  'e595b8d4-6339-566a-8115-b994e6f1a393', 'ChopChop', 'food',
  array['Thai','Southeast Asian']::text[], array['Southeast Asian Food']::text[], array['Vietnamese Food']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 36
),
(
  '25d6c934-3550-53fe-8fb2-5a1413cb6013', 'Papa Kitchen', 'food',
  array['Thai','Southeast Asian']::text[], array['Southeast Asian Food']::text[], array['Vietnamese Sandwich']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 37
),
(
  '8087758b-77ae-5b8d-8843-1cf881174a3e', 'Bobaholic Cafe', 'food',
  array['Japanese','Asian Fusion']::text[], array['Japanese Food']::text[], array['Takoyaki']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 38
),
(
  'bf0221a1-a978-596c-8414-34e1266a597f', 'Shi Takoyaki', 'food',
  array['Japanese','Asian Fusion']::text[], array['Japanese Food']::text[], array['Takoyaki']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 39
),
(
  '0bf452d8-c4b3-5fcd-8318-a060d8436b4d', 'Masae''s Teriyaki', 'food',
  array['Japanese','Asian Fusion']::text[], array['Japanese Food']::text[], array['Teriyaki']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 40
),
(
  '9bb7dbfc-9575-5266-8e5a-441a3d5f77d9', 'Yakitori Yado', 'food',
  array['Japanese','Asian Fusion']::text[], array['Japanese Food']::text[], array['Yakitori Skewers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 41
),
(
  '9692b8b5-b05c-5fdd-8fb9-ea8e5c2dea38', 'Sushi Pizzeria', 'food',
  array['Japanese','Asian Fusion']::text[], array['Japanese Food']::text[], array['Sushi Pizza']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 42
),
(
  '129c3763-4584-58eb-8f4d-381c8ff2766d', 'Birrieria Michi', 'food',
  array['Mexican','Latin']::text[], array['Tacos','Latin Food']::text[], array['Birria Tacos']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 43
),
(
  '74e7d1cf-651c-5813-8251-463066943db5', 'Tacos El YoYo', 'food',
  array['Mexican','Latin']::text[], array['Tacos','Latin Food']::text[], array['Tacos','Quesadillas']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 44
),
(
  'ce786db6-9e82-52fe-8b27-762fac12fdb9', 'J&A Eloteria', 'food',
  array['Mexican','Latin']::text[], array['Tacos','Latin Food']::text[], array['Elote','Popcorn']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 45
),
(
  'b1ba20f1-cbd9-55da-8ee6-3c602d00a318', 'Puerto Rican Flavor', 'food',
  array['Mexican','Latin']::text[], array['Tacos','Latin Food']::text[], array['Puerto Rican Cuisine']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 46
),
(
  '727b287a-7f8b-5d4a-88b3-c91b48a6b776', 'Cocina Casera South American Restaurant', 'food',
  array['Mexican','Latin']::text[], array['Tacos','Latin Food']::text[], array['Arepas','Empanadas']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 47
),
(
  '622f6e3b-7da7-5ec2-816f-d7742b37d9d6', 'Gourmet Soul BBQ', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 48
),
(
  'acbaf3a9-f4de-51cb-8543-ee4935db0918', 'J and J Louisiana BBQ', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 49
),
(
  '98845e14-15dc-53ee-8b46-95f3bf21ca20', 'True Cajun', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array['Cajun Food']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 50
),
(
  '565a274c-3335-5852-8c4c-c03709dd13bd', 'HUMOS BBQ', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 51
),
(
  '312eb0a0-bb25-5fb7-8511-cd32c1fd2d1e', 'Mega Charcoal BBQ', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 52
),
(
  '9bfd365e-454c-5075-841a-3486bb94fb93', 'WARTHOG BARBEQUE PIT RESTAURANT AND CATERING', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 53
),
(
  '00371373-9c50-5b48-82e0-dcb1860dcd72', 'SMOKE AND SPOON', 'food',
  array[]::text[], array['BBQ','Grilled Meats']::text[], array['BBQ']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 54
),
(
  '0a267099-e271-5810-8b88-f483d8d4bc4e', 'Beignets & Gumbo', 'food',
  array['Cajun','Southern']::text[], array['Cajun Food','Southern Food']::text[], array['Louisiana Cuisine']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 55
),
(
  'c6f0eb9e-3881-5b0e-8115-7188d0ccb55d', 'More To Life Beignets', 'food',
  array['Cajun','Southern']::text[], array['Cajun Food','Southern Food']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 56
),
(
  'bcdc8e8a-5121-5037-8bdd-adb2fe85362b', 'Ca C''est Bon', 'food',
  array['Cajun','Southern']::text[], array['Cajun Food','Southern Food']::text[], array['Macaroni','Boudin']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 57
),
(
  'e51fdb29-312a-5d33-81f1-575bc67241bc', 'Cheese Wheel Pasta', 'food',
  array['Italian']::text[], array['Pasta']::text[], array['Pasta']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 58
),
(
  '95c32a49-7b70-534c-8563-cde8f26ca855', 'Lumpia Bucket', 'food',
  array['Italian']::text[], array['Pasta']::text[], array['Filipino Spaghetti']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 59
),
(
  '827f3395-17fc-5300-815a-38a5167f3b0f', 'Deep Fried Fanatics', 'food',
  array[]::text[], array['Pizza','Savory Pastries']::text[], array['Deep-Fried Pizza']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 60
),
(
  'b5916023-0594-5285-8287-e2ec7ee9ea17', 'Reem''s Kitchen', 'food',
  array['Middle Eastern']::text[], array['Middle Eastern Food']::text[], array['Knafeh']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 61
),
(
  '58789b01-081b-54e8-8529-e9ab34482b2b', 'Oaqui 5 Pancit and Lumpia', 'food',
  array['Filipino']::text[], array['Filipino Food']::text[], array['Pancit','Lumpia']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 62
),
(
  '12202407-da13-5140-8ea7-5352c949db3e', 'Jeremy''s Chicken', 'food',
  array['Filipino']::text[], array['Filipino Food']::text[], array['Jollof Rice','Halal Chicken']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 63
),
(
  'f0cd85de-1448-50a0-8d74-da6e430818d7', 'Suite J Catering', 'food',
  array['Filipino']::text[], array['Filipino Food']::text[], array['Filipino Cuisine']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 64
),
(
  'ca804582-b7cb-532c-8ca1-c728b5763034', 'Pinoy kitchen Panlasang pinoy llc', 'food',
  array['Filipino','Asian']::text[], array['Filipino Food','Asian Street Food']::text[], array['Spicy Teriyaki','Lumpia']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 65
),
(
  'e5ba072d-8324-5cda-8604-dc10570b6227', 'Ethiopian Bites by Ahadu', 'food',
  array['African']::text[], array['African Food']::text[], array['Ethiopian Cuisine']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 66
),
(
  'bc10f773-d7b8-5c74-83bc-af91ead5d2dd', 'Dijah''s Kitchen', 'food',
  array['African']::text[], array['African Food']::text[], array['Jollof Rice','Grilled Chicken']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 67
),
(
  'd7cb64b5-0a49-59e5-8580-1bb155a4dba9', 'Platesofshade', 'food',
  array['African']::text[], array['African Food']::text[], array['West African Cuisine']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 68
),
(
  'bb59f3a7-6300-5530-8bcf-56d59b4d1fbd', 'Jamaican Jerk Shack', 'food',
  array['West African','Caribbean']::text[], array['West African Food','Caribbean Food']::text[], array['Jamaican Cuisine']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 69
),
(
  '98b21684-629c-5598-87e3-5cd1e3544bd2', 'Flavorz', 'food',
  array['West African','Caribbean']::text[], array['West African Food','Caribbean Food']::text[], array['Oxtail Mac & Cheese']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 70
),
(
  '7cf4d70f-4448-51d9-8688-a03fe4f4bb9f', 'Nana''s Food Bites', 'food',
  array[]::text[], array['Soups','Stews']::text[], array[]::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 71
),
(
  '279601dd-66b7-5f4c-8e98-19d3cc96476d', 'Good Vibes Concessions', 'food',
  array[]::text[], array['Healthy Bowls']::text[], array['Rice Bowl']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 72
),
(
  '51a09ae2-42c1-59a7-8edf-1c6acd2cdb20', 'On A Stick', 'dessert',
  array[]::text[], array['Street Food','Casual','Dessert Street Food']::text[], array['Food on a Stick','Desserts on a Stick']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 73
),
(
  'd11e929e-0577-5207-88d9-c692aa59794e', 'Willie D''s', 'food',
  array[]::text[], array['Street Food','Casual']::text[], array['Turkey Legs']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 74
),
(
  'df7b3f4f-336f-51de-88fe-3660b29ada8f', 'Soullgoodeats', 'food',
  array[]::text[], array['Street Food','Casual']::text[], array['Stuffed Turkey Leg']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 75
),
(
  '62009e2b-8da7-5a9b-86ba-fcf16df1e59c', 'Bingsoo', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Korean Shaved Ice']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 76
),
(
  '7d0e323c-e174-50e4-8ce2-a08773b25046', 'Snowy Village', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Bingsoo']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 77
),
(
  '1c6f56a6-1919-5f2b-8c57-05972d030858', 'I-TIM TODD', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Fried Ice Cream']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 78
),
(
  'e1e3570c-8ee9-5c3a-86f8-b07f37c2f4ba', 'Hana Hou Shave Ice', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Hawaiian Shave Ice']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 79
),
(
  '66ce713c-7686-530d-8482-d6fd3d41bc4d', 'SweetLips', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Frozen Fruit']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 80
),
(
  '46bb0c46-3874-5590-842c-23da12bc9d1d', 'Go Go Mango', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Mango Ice Cream']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 81
),
(
  'd3ed555d-d527-5a39-8db2-b5fa01bf7e85', 'Grilled Cheese Garden', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Ice Cream']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 82
),
(
  'b02dd55b-7c30-5e01-8bb2-7524d773b7eb', 'The Hwachae', 'dessert',
  array[]::text[], array['Ice Cream','Frozen Desserts']::text[], array['Korean Fruit Punch']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 83
),
(
  '86271919-053e-5f36-8628-29c4e792ac7d', 'Ellipsis Cookie Co', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Cookies']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 84
),
(
  '814d4d45-faea-54fb-8e5c-487d2380c3bc', 'More Please', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Cookies','Cakes']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 85
),
(
  '1bcd7487-43f9-5ed2-86df-52515876a596', 'Delicieux', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Crepes']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 86
),
(
  '733bef30-2fa0-583f-8350-d33d1cb435fc', 'Drips Cheesecake', 'dessert',
  array[]::text[], array['Baked Goods','Pastries','Chocolate','Candy']::text[], array['Cheesecake','Chocolate Cheesecake']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 87
),
(
  '1ed0701a-658f-548f-832b-261e3e6e174f', 'Uncle Tetsu', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Cookies','Cheesecake']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 88
),
(
  '8c6cac55-c36f-53ae-8cbe-b14dbef1e694', 'Rosas Churros', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Churros']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 89
),
(
  '323cedbe-343d-526f-8c38-9a7ab2392683', 'Gourmet Churros', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Churros']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 90
),
(
  'b1cf41fb-5f4e-5fda-851a-cc40fd1ca311', 'Can Cakes', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Cake in a Can']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 91
),
(
  '18ec5b05-2196-526a-8bac-02e8aaa727ce', 'Etoile Filante Patisserie', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Macarons']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 92
),
(
  'e6b3389b-5995-5139-80a8-026234962fb2', 'House of Ube', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Ube Pandesal']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 93
),
(
  'ff980213-e06a-5287-8c60-8e71dfb56851', 'Hawaiian Honey Cones', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Ice Cream Cones']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 94
),
(
  'bb237962-edd0-5e38-8372-e114d55f6a0a', 'Chimney Cakes', 'dessert',
  array[]::text[], array['Baked Goods','Pastries']::text[], array['Hungarian Cakes']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 95
),
(
  '4e4b1ad8-88f2-5191-8031-f04cbef8521d', 'HGG TANGHULU', 'dessert',
  array[]::text[], array['Chocolate','Candy']::text[], array['Tanghulu']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 96
),
(
  '18034e58-cd30-5169-8855-67f32ba4e0a5', 'Maison Tanghulu', 'dessert',
  array[]::text[], array['Chocolate','Candy']::text[], array['Tanghulu']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 97
),
(
  '1f453b08-65c3-53e1-817c-497467590ba3', 'Mexicali Candy LLC', 'dessert',
  array[]::text[], array['Chocolate','Candy']::text[], array['Chamoy Candy']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 98
),
(
  '5b03754f-0936-566d-80e2-e727cacde3c2', 'Sweet Balls of Fryer', 'dessert',
  array[]::text[], array['Chocolate','Candy']::text[], array['Hot Cheeto Balls']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 99
),
(
  'aeaff114-6069-587c-8311-300a40678568', 'Sweet Art Cotton Candy', 'dessert',
  array[]::text[], array['Chocolate','Candy']::text[], array['Cotton Candy']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 100
),
(
  'b40fc919-83b9-5057-815e-add9d612a18c', 'Pineapple Boys', 'dessert',
  array[]::text[], array['Dessert Street Food']::text[], array['Mini Donuts']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 101
),
(
  '5e05f161-ecda-5594-8677-16a473e7ab8a', 'Mr. Bully', 'dessert',
  array[]::text[], array['Dessert Street Food']::text[], array['Taiyaki','Steamed Buns']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 102
),
(
  'e92dbc22-b79b-581e-80b7-1c1f246047a5', 'Big Baby Bottle', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Lemonade']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 103
),
(
  'c4c115ac-6d1a-5f62-8a1a-92d62d802760', '36 Streets Vietnamese Coffee & Tea', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Vietnamese Coffee']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 104
),
(
  '3d72c71f-95dd-5ac7-81dc-25e7738a8608', 'Fallow Ground', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Matcha Latte']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 105
),
(
  'baff4dee-c16b-510f-8f12-cdafa8d1570e', 'Grounds Cream Coffee', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Coffee']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 106
),
(
  'adbb1a92-a039-5784-816d-f9ce4f52ef2a', 'CÀPHÊTERIA', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Avocado Drinks']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 107
),
(
  '6f89595c-2c02-591e-85db-038d9c9d6d88', 'Cream & Soda', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Cream Soda']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 108
),
(
  '6eb0d5eb-0f1b-58be-88ed-46b5c2ad4cdb', 'Sugarmama Sugarcane', 'drink',
  array[]::text[], array['Non-Alcoholic Beverages']::text[], array['Sugarcane Juice']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 109
),
(
  '10e2bcde-1423-506f-81b9-ba762dc7c228', 'Murder Hornet Hot Sauce', 'food',
  array[]::text[], array['Sauces','Side Dishes']::text[], array['Hot Sauce']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 110
),
(
  '820b8799-65ca-54d6-8dfa-6654770d5251', 'Seattle Kimchi', 'food',
  array[]::text[], array['Sauces','Side Dishes']::text[], array['Kimchi']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 111
),
(
  '09e0c23b-780a-55e5-879e-5cb0bf202b02', 'Aihtnycity collection', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Apparel','Accessories']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 112
),
(
  'ea5aee97-9308-5a94-8a0b-a7a10c25682d', 'Anibolic Apparel', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Anime Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 113
),
(
  'fe4f8295-16c2-5fbc-8170-9ea4d802fe0d', 'AnnGoo Nails', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Nails']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 114
),
(
  '27fa64ea-df75-55d6-8577-ce88e8430f1b', 'AsianBobaGirl', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Candles','Pillows']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 115
),
(
  'a37f0494-5683-5243-8056-e87a10a7b06c', 'BARKS & CRAFTS', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Pet Accessories']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 116
),
(
  'e5238bf8-5285-5cf7-8e45-3142f84a90da', 'Bart Bridge', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Hats']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 117
),
(
  '42f59c7b-866e-5976-8c5b-e55cbfb71e56', 'Beyond Collectibles', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Figures']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 118
),
(
  '4ae1feef-7523-5a3b-8d07-4e346470c231', 'Bubblehead Caricatures', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Caricatures']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 119
),
(
  'fad43789-1308-595a-8248-ac2329532b0d', 'CandyWrap Island', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Handmade Goods']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 120
),
(
  'f64fd066-0ec9-501a-8f0a-4f32d8ad7d51', 'Charm Square Inc.', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Shoe Charms']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 121
),
(
  '8305fc35-5625-536d-8674-8d0484689552', 'Classy Chassis & Co.', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Cosmetics']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 122
),
(
  '89223ca4-f13d-54cc-8ec6-f033d2e6dad6', 'Cloris Creates', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Handmade Goods']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 123
),
(
  'e1697f31-25de-581c-88aa-f0775515c4ba', 'CNP Skulls', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Crystal Skulls']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 124
),
(
  '30b37c7f-74fb-5dce-8fbc-6dc811fd316a', 'DBC Customs LLC', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Vintage Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 125
),
(
  '22b930cf-e05c-52d3-8aaf-5fd8763bb6fb', 'Dos Casas Thrift', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Vintage Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 126
),
(
  '7fd1b8c3-8dab-567d-89b8-c3a27c33a82f', 'Eat Your Soup', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 127
),
(
  'ec4547f3-40c0-5671-86d4-42790e62efa3', 'Egg Atelier', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Crochet Goods']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 128
),
(
  '955cd2cc-3b80-5402-8088-c4cc332271f4', 'Eternal Wildflowers', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 129
),
(
  'bb585c24-75b8-5483-8600-e4d50e33750c', 'Fireflyslime', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Slime']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 130
),
(
  '4e111109-7cec-5411-8c98-7ba016e3e5d8', 'Flawlessly fused', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Permanent Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 131
),
(
  '2e434c17-fb2b-5433-8528-8c29c27b1625', 'Fleur Viviente', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 132
),
(
  '8b5056cc-4003-5e9e-8a9c-1e78cb690b9f', 'FUTURE BLOOM', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Premium Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 133
),
(
  '7e9e6de1-1f19-53f5-8790-f974d4d068ba', 'Gallery Panda', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Wall Art']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 134
),
(
  'e6041c5c-6520-5197-8084-174ef58fab26', 'Glimmish', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Hair Pins']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 135
),
(
  '2bd56de4-2109-57df-8da8-a9fd891ac528', 'Golden Luxe Jewels', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 136
),
(
  '19fc6d97-474f-57a7-8bfa-25ca1b23c1bf', 'Goozee Pins', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Enamel Pins']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 137
),
(
  'c627a1d3-ff39-5e92-8390-29b351642976', 'Grace in bloom', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Preserved Flowers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 138
),
(
  'e6b1a078-275d-56e5-8d8d-1a34012d2d8a', 'Handmade Botanic Lab', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Crochet Flowers']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 139
),
(
  'bc045d3f-9bc0-560a-8247-322d38dd667a', 'Henna by Mayra', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Henna Body Art']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 140
),
(
  '68e79f52-fe8f-50aa-8705-823cf66bf068', 'Hollywood Light Up Gear', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Ponchos']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 141
),
(
  '5a39c6d2-54df-512a-87ce-623a04366f7d', 'I Have Good Energy', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Perfume','Sprays']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 142
),
(
  'b04bc902-089c-5163-85a8-a30a54fcd83a', 'INDOCRAFT', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Hawaiian Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 143
),
(
  'b1954cb3-b663-5bbe-827a-a17b1749e8e5', 'Ingkarat Apparel', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Thai Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 144
),
(
  'bf3d4a45-ec51-54fa-88d4-3a593d6a2f5d', 'Jale', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Women’s Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 145
),
(
  '2381fafa-9f75-5e1c-83a9-94f741ae7400', 'JCMstore', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Balloons','Cards','Leis']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 146
),
(
  'e22ffd6d-9b19-5b93-895e-b77492ab42ef', 'Jewels LLC', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Vintage Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 147
),
(
  '5c513625-88b4-5405-8929-d1b72cad6167', 'King and Queen Things', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Shoe Charms']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 148
),
(
  '25cf6f4b-cd25-513d-821c-9b0da6c8e0d4', 'Kitty Korner', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Shoe Charms']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 149
),
(
  '0e1b002a-0a2f-5cf6-8afa-eda9fa113306', 'KRAFTTEE', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Crochet Dolls']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 150
),
(
  '98e6bed3-43da-555f-8c81-85e3b14fe2c5', 'Kwanjai California', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Crochet Goods']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 151
),
(
  'ae73a567-2bd7-56e9-80ba-632df254ac6b', 'LIDA ART', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Handmade Baskets']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 152
),
(
  'cec09a5e-0f53-50d6-80b5-788c312be5e9', 'Lola Inspired Creations', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Candles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 153
),
(
  '02f9698a-2a1d-5f5f-8437-0c6cd8297b40', 'Love Me Waist Beads', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Waist Beads']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 154
),
(
  'd2d4d281-3a37-54bc-847c-3df33b812e44', 'Lumini Jewelry', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 155
),
(
  '7e28bad1-24e0-5340-8667-50d4326141b3', 'Made Design Jewelry', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 156
),
(
  '07cebbc7-ca1d-5c6a-83e9-0ae452b44a76', 'Magnolia Lane Store', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Candles','Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 157
),
(
  '796a4e80-58cd-5f20-819f-deb7fc421da5', 'MIU CANDLES', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Candles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 158
),
(
  '94502ba8-d231-52cc-81ef-dfacbedc3275', 'MrSmellgoodTX', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Perfume']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 159
),
(
  '4fdcc641-410f-5359-8f62-acabe10f181d', 'Mystic Butterflies', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Framed Butterflies']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 160
),
(
  'f100890c-45d3-5134-8123-b1d3f17a6f86', 'Nailed It Day Studios', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Plush Toys']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 161
),
(
  'd7917249-7827-5e35-8389-868b4bb22b23', 'New London Enterprises', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['3D Prints']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 162
),
(
  '47f78171-dd2b-5be7-82c5-632e750eef2f', 'Oh My Gifts Shop', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Texture Art']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 163
),
(
  '40647d94-a6fd-5592-88c9-bbe0ec177ea6', 'Otaku Sugoi', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Anime Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 164
),
(
  'bbfb8bf5-249f-5bde-890c-811b29c2f938', 'Pacific Paradise Prints', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Fidgets']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 165
),
(
  '41a042ea-89e9-5440-8a07-c83f4e02c3c0', 'Party Animal', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Anime Accessories']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 166
),
(
  '6ce070c6-3e76-5974-8ba5-4cc1bc022726', 'Patchy Patchenstein', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Patches']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 167
),
(
  '379f3acc-be2d-58bd-8c91-5bd72d743964', 'PATTRASHOME', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Handmade Accessories']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 168
),
(
  '0e7c02f1-2d1d-5904-8fbe-268faf90ca26', 'Quite Bloom Studio', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Ceramics']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 169
),
(
  'd5cb4026-8e93-59ae-8973-57ca7a8c677f', 'Rickymakes', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Planters']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 170
),
(
  '2169c859-81ef-5a0d-8c9a-bbcd830f5bfc', 'Sacred Love LA', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Waist Beads']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 171
),
(
  'c278a7c0-3a0f-59e8-8eed-1bad3429dd0a', 'San Diego Crystals & Jewelry', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 172
),
(
  'ab6e63dd-5bf2-50ad-8b38-f475f02af6eb', 'Semper.Right.Designs', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Wallets']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 173
),
(
  '3e8ef970-c014-57c1-80a7-e6b6aa5b5f82', 'Sharp Henna', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Henna']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 174
),
(
  '1fdfd577-d328-56e5-8997-072962a71ccf', 'Simply Adorn Me', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Waist Beads']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 175
),
(
  '7a08aaf3-bd21-5df1-8573-1ec0b21b3270', 'SmallRiniLady', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Magnets','Pins']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 176
),
(
  '595582a8-82f1-5704-884b-788b65ab5ff1', 'Snickerdoodles Caricatures', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Caricatures']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 177
),
(
  '21952038-5055-552e-8f0a-37635a87f6c0', 'Snooker', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 178
),
(
  '345e5eb7-c247-5ec8-84f0-74f36a8dc53b', 'Sumac El Sol Handcrafted Textile Arts', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Handmade Textiles']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 179
),
(
  '626cad1b-d88f-59aa-87cb-746aa8f6588e', 'Tee No Evil', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Horror Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 180
),
(
  '5d18457d-0638-5fb3-83e1-20379302fa6f', 'The DLT Jewel Co.', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 181
),
(
  '600cffd6-5921-560e-8a8b-b4ff86f532a1', 'The DLT Jewel Co. LLC', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Jewelry']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 182
),
(
  '1648c2ba-e71d-5c1c-8695-2c67993ef29a', 'The Exaggerated View Caricature Company', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Caricatures']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 183
),
(
  'c62c8911-7ee3-50ff-811a-096418a75660', 'The Lucky Cuy', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Alpaca Plush']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 184
),
(
  '180dbb32-1a47-579c-8fe0-82c52d367166', 'Timestamp Portraits & Art Prints', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Custom Portraits']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 185
),
(
  'f46f64d9-caad-55d0-8d6c-a31d4d438788', 'Wook Pins', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Pins','Tapestries']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 186
),
(
  '0f828e63-88f8-5abc-8b0b-3b024d1a4aca', 'XALT STUDIO', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Handmade Accessories']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 187
),
(
  'c10c0723-0182-5ff9-8e4d-808e95a3699e', 'Yajai', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Plush Toys']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 188
),
(
  'adb3b62d-9a89-50b9-86e2-37a42e6d5e29', 'Zuri Handicrafts', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['African Apparel']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 189
),
(
  '49e0c1d2-40dd-5463-832a-436ed3525054', '& Mutts Co.', 'shopping',
  array[]::text[], array['Apparel','Accessories']::text[], array['Pet Accessories']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 190
),
(
  '65db46b5-2946-52fc-82f6-224a78cccddc', 'Amusy', 'game',
  array[]::text[], array['Games']::text[], array['Japanese Claw Machines']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 191
),
(
  '47a2aef4-7106-584e-8159-a013c7ef81ab', 'Yonkoma Strips', 'game',
  array[]::text[], array['Games']::text[], array['Photo Booth']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 192
),
(
  '7a1434b0-678e-5ea4-8e3e-1a8119e5686b', 'Stick Catching', 'game',
  array[]::text[], array['Games']::text[], array['Game']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 193
),
(
  '2b37b54f-fe9f-5534-8188-5905ef06557d', 'Waterballerz', 'game',
  array[]::text[], array['Games']::text[], array['Water Game']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 194
),
(
  '4696bf90-e5a0-59f5-8056-47bfb7a549ff', 'Waterballerz (Bungee Jump)', 'game',
  array[]::text[], array['Games']::text[], array['Bungee Jumping']::text[],
  array[]::text[], null, 0,
  array[]::text[], null, null,
  'User-provided Bite of Seattle vendor classification', true, 195
)
on conflict (id) do update set
  name = excluded.name,
  vendor_type = excluded.vendor_type,
  cuisines = excluded.cuisines,
  food_types = excluded.food_types,
  menu_items = excluded.menu_items,
  dietary_tags = excluded.dietary_tags,
  description = excluded.description,
  review_count = excluded.review_count,
  review_snippets = excluded.review_snippets,
  line_status = excluded.line_status,
  instagram_url = excluded.instagram_url,
  source = excluded.source,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

notify pgrst, 'reload schema';
