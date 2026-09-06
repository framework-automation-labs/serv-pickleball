import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseClient.js'

const router = Router()

// GET /api/bookings/availability?date=2026-08-29
// Returns booked slots per court for a given date, so the frontend
// can grey out unavailable times.
router.get('/availability', async (req, res) => {
  const { date } = req.query
  if (!date) return res.status(400).json({ error: 'date is required' })

  const { data, error } = await supabaseAdmin
    .from('public_availability')
    .select('*')
    .eq('booking_date', date)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/bookings
// Only called AFTER payment succeeds (see payments.js webhook) —
// this route itself can also be locked down further later.
router.post('/', async (req, res) => {
  // TODO: validate req.body (court_id, user_id, booking_date, start_time, end_time)
  // TODO: insert into bookings table with status 'confirmed', payment_status 'paid'
  // The database EXCLUDE constraint will reject overlapping bookings automatically —
  // catch that error (Postgres code 23P01) and return a friendly message.
  res.status(501).json({ error: 'Not implemented yet' })
})

export default router
