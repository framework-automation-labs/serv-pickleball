-- =========================================================
-- Remove the Events feature (client request) — run AFTER deploying
-- the updated frontend/backend, in the Supabase SQL editor.
--
-- The app no longer reads or writes any of this. Running it is
-- OPTIONAL and DESTRUCTIVE: it permanently deletes all events and all
-- tournament registrations (including their registration data).
-- If you may ever want that data again, export these tables first:
--   Table Editor -> events / tournament_registrations -> Export CSV
-- Skipping this migration is harmless; the tables just sit unused.
--
-- Not touched: bookings, courts, gallery, profiles, the private
-- "receipts" bucket (bookings still use it).
-- =========================================================

-- Registrations first (FK -> events), then events.
drop table if exists tournament_registrations cascade;
drop table if exists events cascade;
drop type if exists event_status;

-- Storage policies for the poster bucket.
drop policy if exists "Public can view event poster objects" on storage.objects;
drop policy if exists "Admins can upload event posters" on storage.objects;
drop policy if exists "Admins can delete event posters" on storage.objects;

-- NOTE: Supabase blocks deleting a storage bucket via SQL. To remove the
-- uploaded poster images, go to Storage -> "event-posters" -> empty the
-- bucket, then delete it. Also, any receipt images uploaded for tournament
-- registrations live in the "receipts" bucket; they're harmless to keep.
