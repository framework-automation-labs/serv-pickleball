-- =========================================================
-- Event posters — run after 006.
--
-- Tournaments (and other events) can now have a poster image,
-- uploaded from the admin dashboard when creating the event.
-- Mirrors the "gallery" bucket setup from migration 003.
-- =========================================================

alter table events add column poster_url text;
alter table events add column poster_path text;

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
