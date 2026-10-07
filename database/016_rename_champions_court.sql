-- =========================================================
-- Court #4: "Champion's Court" (with the apostrophe), PHP 450/hour.
-- Run in the Supabase SQL editor. Safe to run more than once.
--
--  * Adds a per-court hourly rate (courts.rate_per_hour, default 300),
--    so Court 1-3 stay at PHP 300/hour.
--  * If 015 was already run, renames "Champions Court"; otherwise adds it.
--  * Sets Champion's Court to PHP 450/hour.
--
-- Run this BEFORE deploying the updated backend — it reads rate_per_hour.
-- =========================================================
alter table courts add column if not exists rate_per_hour numeric(10,2) not null default 300.00;

update courts set name = 'Champion''s Court' where name = 'Champions Court';

insert into courts (name)
select 'Champion''s Court'
where not exists (select 1 from courts where name = 'Champion''s Court');

update courts set rate_per_hour = 450.00 where name = 'Champion''s Court';
