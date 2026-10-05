-- =========================================================
-- Fixes: "new row for relation tournament_registrations violates
-- check constraint tournament_registrations_category_valid"
--
-- This constraint isn't defined in any migration file (001-010) — it
-- only exists on the live database, most likely added by hand (or by
-- the Supabase table editor) at some point with a fixed list of
-- allowed categories, e.g. ('Beginner','Intermediate','Advanced').
--
-- That's incompatible with how the app actually works: categories are
-- free text an admin types into the Prize Breakdown builder per event
-- (ManageEvents.jsx) — there is no fixed list anywhere in the code.
-- Any category name that doesn't happen to match whatever the
-- constraint was created with (a typo, a new category, different
-- capitalization) gets rejected at the database level.
-- =========================================================

alter table tournament_registrations
  drop constraint if exists tournament_registrations_category_valid;
