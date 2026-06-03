-- 0007_merge_households.sql
-- Two households named "Home" exist (one per signed-up user). The historical
-- import attached all 247 consumed rows to sanae's household, but kiroz signs
-- in to his own → stats screen is empty. We commit to multi-tenancy now and
-- merge both users into one shared household.
--
-- Canonical : fdcefcef-d081-4215-8fe8-69538c4ff850 (sanae's — already holds data)
-- Doomed    : 4fc0acd7-4d29-4d64-ac49-70fe5540b980 (kiroz's — near-empty)

-- 1. Add kiroz as a member of the canonical household.
insert into household_members (household_id, user_id)
select 'fdcefcef-d081-4215-8fe8-69538c4ff850', '5a5f5f02-a0f2-413b-89d8-8f2e2941c979'
where not exists (
  select 1 from household_members
  where household_id = 'fdcefcef-d081-4215-8fe8-69538c4ff850'
    and user_id = '5a5f5f02-a0f2-413b-89d8-8f2e2941c979'
);

-- 2. Move any orphan data from the doomed household to the canonical one.
update pantry_items
   set household_id = 'fdcefcef-d081-4215-8fe8-69538c4ff850'
 where household_id = '4fc0acd7-4d29-4d64-ac49-70fe5540b980';

update receipts
   set household_id = 'fdcefcef-d081-4215-8fe8-69538c4ff850'
 where household_id = '4fc0acd7-4d29-4d64-ac49-70fe5540b980';

-- 3. Drop the duplicate household (cascade removes its membership row).
delete from households
 where id = '4fc0acd7-4d29-4d64-ac49-70fe5540b980';
