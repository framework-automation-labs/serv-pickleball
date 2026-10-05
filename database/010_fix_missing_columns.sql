-- =========================================================
-- Fixes for two pre-existing gaps found during a codebase audit —
-- neither is new to this migration, both predate it:
--
-- 1. events.prize_breakdown: ManageEvents.jsx already has a full UI
--    for per-category entry fees (add/edit rows, category, entry_fee,
--    max_participants) and TournamentRegisterModal.jsx already reads
--    event.prize_breakdown to price registrations by category — but
--    no earlier migration ever created the column. Right now,
--    creating/editing a tournament with category pricing would fail
--    outright with a "column does not exist" error.
--
-- 2. bookings/tournament_registrations.amount trust: the tournament
--    registration route used to read `amount` straight from the
--    client's request body. Since there's no payment gateway, the
--    receipt review is the ONLY verification step — trusting a
--    client-supplied amount meant anyone could submit amount: 0 for a
--    paid tournament and skip the receipt requirement entirely,
--    getting auto-confirmed for free. Fixed in
--    backend/src/routes/tournamentRegistrations.js (amount is now
--    always computed server-side from events.entry_fee /
--    events.prize_breakdown) — no schema change needed for that part,
--    noted here for context.
-- =========================================================

alter table events add column prize_breakdown jsonb not null default '[]'::jsonb;

-- Expected shape (matches what ManageEvents.jsx already writes):
--   [{ "category": "Men's Doubles", "entry_fee": 300, "max_participants": 16 }, ...]
