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
  user_id uuid not null references profiles(id),
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

-- Bookings: users see their own bookings; everyone can see confirmed/pending
-- bookings' TIME SLOTS ONLY is usually handled via a view (see below) —
-- direct table access is restricted to the owner + admins.
create policy "Users can view own bookings" on bookings
  for select using (auth.uid() = user_id);
create policy "Users can create own bookings" on bookings
  for insert with check (auth.uid() = user_id);
create policy "Admins can view all bookings" on bookings
  for select using (exists (select 1 from profiles where id = auth.uid() and is_admin));
create policy "Admins can update all bookings" on bookings
  for update using (exists (select 1 from profiles where id = auth.uid() and is_admin));

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
