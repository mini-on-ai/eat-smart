-- eat-smart initial schema
-- Future-proofed for multi-user households even though v1 ships single-user.

create extension if not exists "pgcrypto";

------------------------------------------------------------------------------
-- Households
------------------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  timezone text not null default 'UTC',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  expo_push_token text,
  push_token_updated_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on household_members(user_id);

-- Helper: is the calling user a member of this household?
create or replace function is_member_of(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

------------------------------------------------------------------------------
-- Item categories (seed data; read-only for users)
------------------------------------------------------------------------------
create table item_categories (
  id serial primary key,
  name text not null unique,
  default_shelf_life_days int not null,
  icon text,
  locale_aliases text[] not null default '{}'
);

insert into item_categories (name, default_shelf_life_days, icon, locale_aliases) values
  ('Milk',           7,   'milk',         array['milk','lait']),
  ('Yogurt',         14,  'milk',         array['yogurt','yaourt']),
  ('Cheese (hard)',  30,  'cheese',       array['cheese','fromage']),
  ('Cheese (soft)',  10,  'cheese',       array['brie','camembert']),
  ('Eggs',           21,  'egg',          array['eggs','oeufs','œufs']),
  ('Bread',          5,   'bread',        array['bread','pain']),
  ('Meat (fresh)',   3,   'beef',         array['beef','pork','chicken','viande','poulet']),
  ('Fish (fresh)',   2,   'fish',         array['fish','poisson','salmon','saumon']),
  ('Leafy greens',   5,   'leaf',         array['lettuce','spinach','salade','epinards']),
  ('Fruit (soft)',   5,   'apple',        array['berries','peach','fraises']),
  ('Fruit (firm)',   14,  'apple',        array['apple','pomme','orange']),
  ('Vegetable',      10,  'carrot',       array['carrot','onion','potato','carotte']),
  ('Canned',         365, 'package',      array['can','canned','conserve']),
  ('Frozen',         180, 'snowflake',    array['frozen','surgele']),
  ('Pantry dry',     365, 'package',      array['rice','pasta','riz','pates']),
  ('Other',          14,  'package',      array[]::text[]);

------------------------------------------------------------------------------
-- Pantry items
------------------------------------------------------------------------------
create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category_id int references item_categories(id) on delete set null,
  quantity numeric not null default 1,
  unit text,
  added_at timestamptz not null default now(),
  expires_on date not null,
  status text not null default 'active' check (status in ('active','consumed','discarded','expired')),
  receipt_id uuid,
  added_by uuid not null references auth.users(id),
  notified_3d boolean not null default false,
  notified_1d boolean not null default false,
  notified_0d boolean not null default false
);

create index pantry_items_household_status_expires_idx
  on pantry_items(household_id, status, expires_on);

------------------------------------------------------------------------------
-- Receipts
------------------------------------------------------------------------------
create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  image_path text not null,
  scanned_at timestamptz not null default now(),
  scanned_by uuid not null references auth.users(id),
  raw_llm_response jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','discarded'))
);

alter table pantry_items
  add constraint pantry_items_receipt_id_fkey
  foreign key (receipt_id) references receipts(id) on delete set null;

------------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------------
alter table households          enable row level security;
alter table household_members   enable row level security;
alter table pantry_items        enable row level security;
alter table receipts            enable row level security;
alter table item_categories     enable row level security;

-- Anyone authenticated can read the category list.
create policy "categories: read all" on item_categories for select
  to authenticated using (true);

-- Households: visible to members; owner can create one (with themselves as creator).
create policy "households: select members" on households for select
  to authenticated using (is_member_of(id));

create policy "households: insert self" on households for insert
  to authenticated with check (created_by = auth.uid());

create policy "households: owner update" on households for update
  to authenticated using (is_member_of(id)) with check (is_member_of(id));

-- household_members: a row is visible if you're in that household.
create policy "members: select" on household_members for select
  to authenticated using (is_member_of(household_id));

create policy "members: insert self" on household_members for insert
  to authenticated with check (user_id = auth.uid());

create policy "members: update self" on household_members for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pantry items + receipts: household scoped.
create policy "pantry: select" on pantry_items for select
  to authenticated using (is_member_of(household_id));
create policy "pantry: insert" on pantry_items for insert
  to authenticated with check (is_member_of(household_id) and added_by = auth.uid());
create policy "pantry: update" on pantry_items for update
  to authenticated using (is_member_of(household_id)) with check (is_member_of(household_id));
create policy "pantry: delete" on pantry_items for delete
  to authenticated using (is_member_of(household_id));

create policy "receipts: select" on receipts for select
  to authenticated using (is_member_of(household_id));
create policy "receipts: insert" on receipts for insert
  to authenticated with check (is_member_of(household_id) and scanned_by = auth.uid());
create policy "receipts: update" on receipts for update
  to authenticated using (is_member_of(household_id)) with check (is_member_of(household_id));

------------------------------------------------------------------------------
-- Auto-create a one-person household for every new signup.
-- Future v2 will add an invite flow; this trigger stays in place.
------------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into households (created_by, name)
  values (new.id, 'Home')
  returning id into new_household_id;

  insert into household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
