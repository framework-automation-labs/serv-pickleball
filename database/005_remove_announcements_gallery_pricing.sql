-- =========================================================
-- Remove Announcements + add pricing to Gallery — run after 004.
--
-- Announcements turned out to have no use for this site and are
-- being removed entirely.
--
-- Gallery is being repurposed to double as the merch/shop listing:
-- an admin uploads a photo with a caption (used as the description)
-- and, if it's an item for sale, a price. Items with a price show up
-- in the "Club Gear" section on the homepage; plain photos (no price)
-- don't.
-- =========================================================

drop table if exists announcements;

alter table gallery_images add column price numeric(10,2);
