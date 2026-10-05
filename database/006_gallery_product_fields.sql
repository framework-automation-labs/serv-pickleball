-- =========================================================
-- Product name + availability for Gallery items — run after 005.
--
-- Gallery items marked for sale need a proper product name (separate
-- from the caption/description) and whether it's a pre-order or
-- already in stock, so the homepage can show the right label.
-- =========================================================

alter table gallery_images add column product_name text;
alter table gallery_images add column availability text
  check (availability in ('pre_order', 'in_stock'));
