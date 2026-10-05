-- =========================================================
-- Tournament entry fee + payment-gated registration — run after 007.
--
-- Registrations should no longer be written directly by the browser —
-- payment must succeed FIRST (mirrors how bookings already work: the
-- backend, using the service role key, is the only thing that writes
-- the row, and only after a successful payment webhook).
-- =========================================================

alter table events add column entry_fee numeric(10,2) not null default 0;

alter table tournament_registrations add column payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid', 'paid'));
alter table tournament_registrations add column payment_reference text;
alter table tournament_registrations add column amount numeric(10,2);

-- Direct client-side registration is no longer allowed — the backend
-- (service role key, bypasses RLS) writes the row after payment
-- succeeds. Admins can still add a walk-in/manual registration
-- directly from the dashboard.
drop policy if exists "Anyone can register for open tournaments" on tournament_registrations;

create policy "Admins can create registrations" on tournament_registrations
  for insert with check (is_admin_user());
