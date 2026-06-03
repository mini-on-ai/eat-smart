-- 0010_fix_shopping_list_rls.sql
-- The original FOR ALL USING (...) policy works for SELECT/UPDATE/DELETE but
-- PostgreSQL requires an explicit WITH CHECK clause for INSERT to be permitted.
-- Drop and recreate the write policy with both clauses.

drop policy if exists "members write shopping list" on shopping_list_items;

-- SELECT / UPDATE / DELETE — filtered by household membership (USING)
-- INSERT — new row must also belong to one of the current user's households (WITH CHECK)
create policy "members write shopping list" on shopping_list_items
  for all
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );
