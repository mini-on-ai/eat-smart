-- 0009_shopping_list_items.sql
-- Manual additions to the shopping list. The "smart" suggestions remain
-- computed client-side from purchase cadence; this table holds explicit user
-- picks (e.g. tapping "Ajouter à la liste" on an item detail page).
--
-- A unique constraint on (household_id, normalized_name) keeps the list de-duped
-- even if the same product is added twice from different rows.

create table if not exists shopping_list_items (
  id uuid default uuid_generate_v4() primary key,
  household_id uuid not null references households(id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  category_id int references item_categories(id) on delete set null,
  added_by uuid references auth.users(id),
  added_at timestamptz default now(),
  checked boolean default false,
  unique (household_id, normalized_name)
);

create index if not exists shopping_list_items_household_idx
  on shopping_list_items(household_id);

alter table shopping_list_items enable row level security;

drop policy if exists "members read shopping list" on shopping_list_items;
create policy "members read shopping list" on shopping_list_items
  for select using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

drop policy if exists "members write shopping list" on shopping_list_items;
create policy "members write shopping list" on shopping_list_items
  for all using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );
