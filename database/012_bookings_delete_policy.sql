-- =========================================================
-- Lets an admin delete a reviewed booking from the dashboard so old
-- confirmed/rejected receipts don't pile up forever. This mirrors the
-- "Admins can delete registrations" policy tournament_registrations
-- already had — bookings never got the equivalent.
-- =========================================================

create policy "Admins can delete bookings" on bookings
  for delete using (is_admin_user());
