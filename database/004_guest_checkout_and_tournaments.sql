-- =========================================================
-- Guest checkout + tournament registration — run after 001-003.
--
-- This site has NO customer accounts, only admins log in. The booking
-- flow (Details.jsx -> Checkout.jsx) already collects fullName/phone
-- as a guest, with no auth step anywhere. The original schema's
-- bookings.user_id being NOT NULL / tied to profiles was a leftover
-- from an "everyone has an account" assumption that doesn't match how
-- the site actually works — this migration corrects it.
-- =========================================================

-- These policies assumed a logged-in customer inserting their own
-- booking (auth.uid() = user_id). That flow doesn't exist — bookings
-- are created by the backend (service role key, bypasses RLS) only
-- after payment succeeds. Replaced below with an admin-only insert
-- policy for walk-ins entered from the dashboard.
drop policy if exists "Users can view own bookings" on bookings;
drop policy if exists "Users can create own bookings" on bookings;

-- user_id is now nullable — only set when an ADMIN manually enters a
-- walk-in booking. guest_name / guest_phone / guest_email hold the
-- actual customer's info for the normal online-booking case.
alter table bookings alter column user_id drop not null;
alter table bookings add column guest_name text;
alter table bookings add column guest_phone text;
alter table bookings add column guest_email text;

alter table bookings add constraint bookings_has_contact
  check (user_id is not null or (guest_name is not null and guest_phone is not null));

create index idx_bookings_guest_phone on bookings (guest_phone);

create policy "Admins can create bookings" on bookings
  for insert with check (is_admin_user());

-- ---------------------------------------------------------
-- TOURNAMENT REGISTRATION
-- Only events marked is_tournament accept registrations. Customers
-- register with just name/phone/email — no account needed.
-- ---------------------------------------------------------
alter table events add column is_tournament boolean not null default false;
alter table events add column max_participants int;

create table tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  full_name text not null,
  phone_number text not null,
  email text,
  partner_name text,
  created_at timestamptz not null default now()
);

alter table tournament_registrations enable row level security;

-- Anyone can register, but ONLY for events that are actually open
-- tournaments — enforced at the database level (not just hidden in
-- the UI), so it can't be bypassed by calling the API directly.
create policy "Anyone can register for open tournaments" on tournament_registrations
  for insert with check (
    exists (
      select 1 from events e
      where e.id = event_id and e.is_tournament and e.status = 'upcoming'
    )
  );

-- No public SELECT — registrants can't look each other up. Only
-- admins (managing the tournament) can see who's registered.
create policy "Admins can view registrations" on tournament_registrations
  for select using (is_admin_user());
create policy "Admins can delete registrations" on tournament_registrations
  for delete using (is_admin_user());
