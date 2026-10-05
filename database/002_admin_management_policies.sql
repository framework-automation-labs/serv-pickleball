-- =========================================================
-- Admin management policies — run this once in your Supabase
-- project's SQL editor (Database > SQL Editor > New query).
--
-- Needed for the admin dashboard's Courts and Bookings pages:
--   1. courts had a SELECT policy for everyone, but no UPDATE
--      policy at all — an admin toggling a court to "maintenance"
--      would be silently rejected by RLS.
--   2. profiles only allowed a user to read their OWN row. The
--      bookings management page joins each booking to the
--      customer's profile (name + phone) so staff know who to
--      contact — without this, admins would see a null join for
--      every booking that isn't their own.
--
-- is_admin_user() is a SECURITY DEFINER function rather than an
-- inline subquery, per Supabase's guidance — a policy on `profiles`
-- that subqueries `profiles` directly can trigger recursive RLS
-- evaluation. The function runs with the privileges of its owner,
-- so it reads the profiles table without re-triggering RLS.
-- =========================================================

create or replace function is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create policy "Admins can update courts" on courts
  for update using (is_admin_user());

create policy "Admins can view all profiles" on profiles
  for select using (is_admin_user());
