-- Purchase-history fields. Lets us treat each pantry_items row as a record of
-- "the user bought X on day Y for €Z", so stats and the smart shopping list
-- have something to learn from.

-- Receipt-level metadata (extracted by the LLM)
alter table receipts add column if not exists purchased_at date;
alter table receipts add column if not exists total_amount numeric;

-- Item-level: price paid, when bought, normalized name for grouping across pack sizes
alter table pantry_items add column if not exists price numeric;
alter table pantry_items add column if not exists purchased_at date;
alter table pantry_items add column if not exists normalized_name text;

-- Lookup indexes for stats queries
create index if not exists pantry_items_household_normalized_idx
  on pantry_items(household_id, normalized_name);
create index if not exists pantry_items_household_purchased_at_idx
  on pantry_items(household_id, purchased_at);
