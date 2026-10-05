-- =========================================================
-- SERV Pickleball Club — Booking System Schema
-- Target: Supabase (Postgres)
-- =========================================================

-- Needed for the exclusion constraint below (lets us combine
-- an equality check on court_id with a range-overlap check)
create extension if not exists btree_gist;

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type payment_status as enum ('unpaid', 'paid', 'refunded');
create type court_status as enum ('active', 'maintenance');

-- ---------------------------------------------------------
-- PROFILES
-- Extends Supabase auth.users with the info you actually need
-- for a booking (name + phone number are essential for PH bookings)
-- ---------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- COURTS
-- ---------------------------------------------------------
create table courts (
  id serial primary key,
  name text not null,              -- e.g. "Court 1"
  status court_status not null default 'active',
  created_at timestamptz not null default now()
);

insert into courts (name) values ('Court 1'), ('Court 2'), ('Court 3');

-- ---------------------------------------------------------
-- BOOKINGS
-- ---------------------------------------------------------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  court_id int not null references courts(id),
  -- Nullable: only set when an ADMIN manually enters a walk-in booking
  -- from the dashboard. This site has no customer accounts — online
  -- bookings are guest checkout, so guest_name/guest_phone below hold
  -- the actual customer's contact info instead.
  user_id uuid references profiles(id),
  guest_name text,
  guest_phone text,
  guest_email text,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status booking_status not null default 'pending',
  payment_status payment_status not null default 'unpaid',
  amount numeric(10,2) not null default 300.00,
  payment_reference text,           -- PayMongo payment intent id, etc.
  created_at timestamptz not null default now(),

  -- generated column: turns date + start/end time into a single
  -- timestamp range, used by the exclusion constraint below
  time_range tsrange generated always as (
    tsrange(
      (booking_date + start_time)::timestamp,
      (booking_date + end_time)::timestamp,
      '[)'  -- inclusive start, exclusive end (so back-to-back bookings don't "overlap")
    )
  ) stored,

  constraint end_after_start check (end_time > start_time),
  constraint bookings_has_contact
    check (user_id is not null or (guest_name is not null and guest_phone is not null)),

  -- THE CORE FIX FOR DOUBLE-BOOKING:
  -- Postgres itself will reject any insert/update whose time_range
  -- overlaps an existing non-cancelled booking on the same court.
  -- This works at the database level, so it's safe even if two
  -- requests hit the server at the exact same millisecond.
  exclude using gist (
    court_id with =,
    time_range with &&
  ) where (status != 'cancelled')
);

create index idx_bookings_court_date on bookings (court_id, booking_date);
create index idx_bookings_user on bookings (user_id);
create index idx_bookings_guest_phone on bookings (guest_phone);

-- ---------------------------------------------------------
-- BLOCKED SLOTS
-- For admin-blocked time (maintenance, private events, walk-ins
-- manually entered by staff)
-- ---------------------------------------------------------
create table blocked_slots (
  id uuid primary key default gen_random_uuid(),
  court_id int not null references courts(id),
  blocked_date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz not null default now()
);

-- Trigger to also prevent bookings from overlapping a blocked slot
-- (exclusion constraints can't span two tables, so this needs a trigger)
create or replace function check_blocked_slot_conflict()
returns trigger as $$
begin
  if exists (
    select 1 from blocked_slots b
    where b.court_id = new.court_id
      and b.blocked_date = new.booking_date
      and (new.start_time, new.end_time) overlaps (b.start_time, b.end_time)
  ) then
    raise exception 'This time slot is blocked and unavailable for booking.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_check_blocked_slot
before insert or update on bookings
for each row execute function check_blocked_slot_conflict();

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table profiles enable row level security;
alter table bookings enable row level security;
alter table blocked_slots enable row level security;
alter table courts enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Courts: anyone (even logged out) can view courts, to show the booking grid
create policy "Anyone can view courts" on courts
  for select using (true);

-- Bookings: created by the backend (service role key, bypasses RLS)
-- only after payment succeeds — there is no logged-in customer to
-- scope an "own bookings" policy to. Admins can also enter walk-ins
-- directly from the dashboard.
create policy "Admins can view all bookings" on bookings
  for select using (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "Admins can update all bookings" on bookings
  for update using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- SECURITY DEFINER function for admin checks that need to run FROM
-- WITHIN a policy on the profiles table itself (see below) — an inline
-- subquery on profiles there would risk recursive RLS evaluation.
-- Runs with the privileges of its owner, so it bypasses RLS internally.
create or replace function is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- Courts: admins can toggle a court's status (e.g. into "maintenance")
create policy "Admins can update courts" on courts
  for update using (is_admin_user());

-- Bookings: admins can enter walk-in bookings directly from the dashboard
create policy "Admins can create bookings" on bookings
  for insert with check (is_admin_user());

-- Profiles: admins can view any profile (needed to show the customer's
-- name/phone when managing someone else's booking)
create policy "Admins can view all profiles" on profiles
  for select using (is_admin_user());

-- Blocked slots: viewable by anyone (needed to grey out the calendar),
-- only admins can create/edit
create policy "Anyone can view blocked slots" on blocked_slots
  for select using (true);
create policy "Admins can manage blocked slots" on blocked_slots
  for all using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- ---------------------------------------------------------
-- PUBLIC AVAILABILITY VIEW
-- Frontend should query THIS, not the bookings table directly —
-- it exposes only what's needed to render the calendar (no user
-- names/phone numbers), and works for logged-out visitors too.
-- ---------------------------------------------------------
create view public_availability as
select court_id, booking_date, start_time, end_time, status
from bookings
where status in ('pending', 'confirmed');

grant select on public_availability to anon, authenticated;

-- ---------------------------------------------------------
-- EVENTS
-- Tournaments, open plays, clinics, etc.
-- ---------------------------------------------------------
create type event_status as enum ('upcoming', 'cancelled', 'completed');

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  status event_status not null default 'upcoming',
  -- Only tournaments accept registrations (see tournament_registrations
  -- below) — open plays, clinics, etc. are informational-only events.
  is_tournament boolean not null default false,
  max_participants int,
  -- Entry fee for tournaments (0 = free). Registration is gated on
  -- payment succeeding — see tournament_registrations below.
  entry_fee numeric(10,2) not null default 0,
  poster_url text,
  poster_path text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "Anyone can view events" on events
  for select using (true);
create policy "Admins can manage events" on events
  for all using (is_admin_user()) with check (is_admin_user());

-- ---------------------------------------------------------
-- TOURNAMENT REGISTRATION
-- Only for events marked is_tournament. Customers register with just
-- name/phone/email — this site has no customer accounts. Payment for
-- the entry fee must succeed BEFORE the row is written (mirrors
-- bookings: only the backend, via the service role key, writes the
-- row, after a successful payment webhook) — there is no direct
-- client-side insert policy.
-- ---------------------------------------------------------
create table tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  full_name text not null,
  phone_number text not null,
  email text,
  partner_name text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  payment_reference text,
  amount numeric(10,2),
  created_at timestamptz not null default now()
);

alter table tournament_registrations enable row level security;

-- No public SELECT or INSERT — registrants can't look each other up,
-- and the browser can't write a row directly. Only admins (managing
-- the tournament, or entering a walk-in registration) can.
create policy "Admins can view registrations" on tournament_registrations
  for select using (is_admin_user());
create policy "Admins can create registrations" on tournament_registrations
  for insert with check (is_admin_user());
create policy "Admins can delete registrations" on tournament_registrations
  for delete using (is_admin_user());

-- ---------------------------------------------------------
-- GALLERY
-- Doubles as the merch/shop listing: an item with a price shows up
-- in the "Club Gear" section on the homepage (caption = description).
-- Plain photos (no price) are just gallery photos.
-- ---------------------------------------------------------
create table gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null,
  caption text,
  product_name text,
  price numeric(10,2),
  availability text check (availability in ('pre_order', 'in_stock')),
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table gallery_images enable row level security;

create policy "Anyone can view gallery images" on gallery_images
  for select using (true);
create policy "Admins can manage gallery images" on gallery_images
  for all using (is_admin_user()) with check (is_admin_user());

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "Public can view gallery bucket objects"
on storage.objects for select
using (bucket_id = 'gallery');

create policy "Admins can upload gallery images"
on storage.objects for insert
with check (bucket_id = 'gallery' and is_admin_user());

create policy "Admins can delete gallery images"
on storage.objects for delete
using (bucket_id = 'gallery' and is_admin_user());

-- Poster images for events (mirrors the gallery bucket above)
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

create policy "Public can view event poster objects"
on storage.objects for select
using (bucket_id = 'event-posters');

create policy "Admins can upload event posters"
on storage.objects for insert
with check (bucket_id = 'event-posters' and is_admin_user());

create policy "Admins can delete event posters"
on storage.objects for delete
using (bucket_id = 'event-posters' and is_admin_user());
