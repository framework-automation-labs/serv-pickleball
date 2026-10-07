-- =========================================================
-- Add the "Champions Court" — run in the Supabase SQL editor.
-- Safe to run more than once (it won't insert a duplicate).
--
-- PRICING: there is no per-court price in the database. Every booking
-- is charged the club-wide rate of PHP 300/hour (bookings.amount
-- defaults to 300.00, and the backend's RATE_PER_HOUR is 300), so the
-- Champions Court is 300/hour like the other courts. If it should ever
-- cost more, change RATE_PER_HOUR in backend/src/routes/bookings.js
-- and in frontend/src/pages/Booking.jsx — a court-level price would
-- need a new column on `courts`.
--
-- The booking page, admin Courts page (maintenance toggle, blocked
-- slots) and dashboard all read courts from this table, so no other
-- change is needed to make it bookable.
-- =========================================================
insert into courts (name)
select 'Champions Court'
where not exists (select 1 from courts where name = 'Champions Court');
