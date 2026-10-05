-- =========================================================
-- Security hardening — run in the Supabase SQL editor (after 013, or
-- after 012 if you skipped 013). Safe to run more than once.
-- =========================================================

-- ---------------------------------------------------------
-- 1. PRIVILEGE ESCALATION FIX (most important)
--
-- The original policy let any signed-in user UPDATE their own profile
-- row with no column restriction, i.e.
--     supabase.from('profiles').update({ is_admin: true }).eq('id', myId)
-- would have made them an admin. This site has no customer accounts and
-- no UI edits profiles, so nothing legitimate needs this policy.
-- Dropping it means NO client can change profiles at all; admins are
-- still created/changed by hand in the SQL editor / table editor
-- (which use the postgres role and bypass RLS).
-- ---------------------------------------------------------
drop policy if exists "Users can update own profile" on profiles;

-- Belt and braces: the API roles get no UPDATE privilege on profiles at
-- all, so even if someone re-adds a permissive policy later, is_admin
-- still can't be changed through the API.
revoke update on profiles from anon, authenticated;

-- ---------------------------------------------------------
-- 2. STORAGE BUCKET LIMITS
-- Server-side size + type limits so a bucket can't be filled with
-- arbitrary files (SVG/HTML are deliberately not allowed).
-- ---------------------------------------------------------
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'gallery';

update storage.buckets
set file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'receipts';

update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'event-posters';

-- ---------------------------------------------------------
-- 3. DATA-INTEGRITY CHECKS ON BOOKINGS
-- The API validates all of this too, but the database is the last line
-- of defence (e.g. against a leaked key or a future buggy route).
-- NOT VALID = enforced for new/updated rows without failing on any
-- old rows that predate the rule.
-- ---------------------------------------------------------
alter table bookings drop constraint if exists bookings_field_limits;
alter table bookings add constraint bookings_field_limits check (
  (guest_name  is null or char_length(guest_name)  <= 100) and
  (guest_phone is null or char_length(guest_phone) <= 30)  and
  (guest_email is null or char_length(guest_email) <= 254) and
  (rejection_reason is null or char_length(rejection_reason) <= 500) and
  amount >= 0
) not valid;

alter table bookings drop constraint if exists bookings_operating_hours;
alter table bookings add constraint bookings_operating_hours check (
  start_time >= time '09:00' and end_time <= time '24:00'
) not valid;

-- ---------------------------------------------------------
-- 4. GALLERY SANITY
-- ---------------------------------------------------------
alter table gallery_images drop constraint if exists gallery_price_nonnegative;
alter table gallery_images add constraint gallery_price_nonnegative
  check (price is null or (price >= 0 and price < 1000000)) not valid;

alter table gallery_images drop constraint if exists gallery_text_limits;
alter table gallery_images add constraint gallery_text_limits check (
  (caption is null or char_length(caption) <= 500) and
  (product_name is null or char_length(product_name) <= 120)
) not valid;
