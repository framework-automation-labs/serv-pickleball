-- =========================================================
-- Events, Announcements, and Gallery — run this once in your
-- Supabase project's SQL editor (after 002_admin_management_policies.sql,
-- since this reuses the is_admin_user() function it defines).
-- =========================================================

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
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

-- Public site can list events; only admins can create/edit/delete
create policy "Anyone can view events" on events
  for select using (true);
create policy "Admins can manage events" on events
  for all using (is_admin_user()) with check (is_admin_user());

-- ---------------------------------------------------------
-- ANNOUNCEMENTS
-- Short news/notices for the homepage
-- ---------------------------------------------------------
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

-- Public only sees published ones; admins can see + manage everything
-- (the "manage" policy's is_admin_user() check also grants admins
-- SELECT on unpublished rows — Postgres OR's policies together)
create policy "Anyone can view published announcements" on announcements
  for select using (is_published = true);
create policy "Admins can manage announcements" on announcements
  for all using (is_admin_user()) with check (is_admin_user());

-- ---------------------------------------------------------
-- GALLERY
-- ---------------------------------------------------------
create table gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table gallery_images enable row level security;

create policy "Anyone can view gallery images" on gallery_images
  for select using (true);
create policy "Admins can manage gallery images" on gallery_images
  for all using (is_admin_user()) with check (is_admin_user());

-- Storage bucket for the actual image files (public read, admin write)
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
