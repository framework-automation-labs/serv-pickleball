-- =========================================================
-- GCash manual-receipt review — run after 008.
--
-- The client decided against a payment gateway (PayMongo). Instead:
--   1. Customer pays via GCash and uploads a screenshot of the receipt.
--   2. The backend saves it to a PRIVATE storage bucket and runs a few
--      lightweight, best-effort checks (duplicate-image detection,
--      edited-in-Photoshop/GIMP metadata, a basic Error Level Analysis
--      pass) and stores the results as advisory flags.
--   3. An admin looks at the receipt + flags and approves or rejects —
--      the automated checks never approve/reject anything by themselves.
--   4. Once approved, the customer can download a PDF receipt with a
--      QR code that links back to their (public, unguessable-URL)
--      confirmation page, so staff at the courts can scan it to verify.
-- =========================================================

-- ---------------------------------------------------------
-- BOOKINGS
-- booking_group_id lets one GCash payment/receipt cover several
-- court/time blocks submitted together (Booking.jsx allows picking
-- more than one court or time range before checking out).
-- ---------------------------------------------------------
alter table bookings add column booking_group_id uuid not null default gen_random_uuid();
alter table bookings add column receipt_path text;
alter table bookings add column receipt_hash text;
alter table bookings add column risk_flags jsonb not null default '[]'::jsonb;
alter table bookings add column rejection_reason text;
alter table bookings add column reference_code text;

create index idx_bookings_group on bookings (booking_group_id);
create index idx_bookings_receipt_hash on bookings (receipt_hash);

-- ---------------------------------------------------------
-- TOURNAMENT REGISTRATIONS
-- Was payment_status-only (unpaid/paid, flipped by the PayMongo
-- webhook). Now needs its own pending/confirmed/rejected review state,
-- same shape as bookings.status.
-- ---------------------------------------------------------
alter table tournament_registrations add column status text not null default 'pending'
  check (status in ('pending', 'confirmed', 'rejected'));
alter table tournament_registrations add column receipt_path text;
alter table tournament_registrations add column receipt_hash text;
alter table tournament_registrations add column risk_flags jsonb not null default '[]'::jsonb;
alter table tournament_registrations add column rejection_reason text;
alter table tournament_registrations add column reference_code text;

create index idx_registrations_receipt_hash on tournament_registrations (receipt_hash);

-- These two are pre-existing gaps, not new to this migration: the
-- admin dashboard (ManageEvents.jsx) already reads/writes
-- registration.category and .checked_in/.checked_in_at, and the
-- registration form already submits a category — but no earlier
-- migration ever added the columns. It went unnoticed because the
-- old PayMongo flow never actually completed an insert (it stopped at
-- an unimplemented payment stub), so these writes never ran for real.
alter table tournament_registrations add column category text;
alter table tournament_registrations add column checked_in boolean not null default false;
alter table tournament_registrations add column checked_in_at timestamptz;

-- Admins reviewing a registration (approve/reject) need UPDATE, which
-- migration 008 never granted (only insert/select/delete).
create policy "Admins can update registrations" on tournament_registrations
  for update using (is_admin_user());

-- ---------------------------------------------------------
-- RECEIPTS STORAGE BUCKET
-- PRIVATE (unlike gallery/event-posters) — receipts contain a
-- customer's GCash transaction details, so only admins can view them,
-- via short-lived signed URLs from the dashboard. The browser never
-- uploads directly to this bucket; only the backend (service role,
-- bypasses RLS) writes to it, right after running the checks above.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Admins can view receipt objects"
on storage.objects for select
using (bucket_id = 'receipts' and is_admin_user());

create policy "Admins can delete receipt objects"
on storage.objects for delete
using (bucket_id = 'receipts' and is_admin_user());

-- ---------------------------------------------------------
-- payments.js / PayMongo is no longer used — bookings and
-- registrations now go through POST /api/bookings and
-- POST /api/tournament-registrations directly (multipart, with the
-- receipt file attached). The old "Admins can create registrations"
-- insert policy from 008 still applies (service role bypasses it
-- anyway) and is left in place for admin-entered walk-ins.
-- ---------------------------------------------------------
