-- 0008_pantry_item_extras.sql
-- Powers Phase 6 (detail page) and Phase 8 (nutrition):
--   nutrition_data    — cached OpenFoodFacts snapshot, written lazily, never edited
--   note              — user-entered free-form note ("for Léo's lunch", allergies…)
--   initial_quantity  — quantity at insert time, so the detail page can show "3 of 10 left"
--                       without losing the original count once the user decrements quantity

alter table pantry_items add column if not exists nutrition_data jsonb;
alter table pantry_items add column if not exists note text;
alter table pantry_items add column if not exists initial_quantity numeric;

-- Backfill existing rows: treat current quantity as the initial.
update pantry_items
   set initial_quantity = quantity
 where initial_quantity is null;
