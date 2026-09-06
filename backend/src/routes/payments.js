import { Router } from 'express'

const router = Router()

// POST /api/payments/create
// Creates a PayMongo payment intent/checkout session for a pending booking
// (court is NOT reserved yet at this point).
router.post('/create', async (req, res) => {
  // TODO: call PayMongo API to create a payment intent/checkout session
  // TODO: return the checkout URL / client key to the frontend
  res.status(501).json({ error: 'Not implemented yet' })
})

// POST /api/payments/webhook
// PayMongo calls this when payment succeeds/fails.
// ONLY on a successful payment event should you insert the row into `bookings`.
router.post('/webhook', async (req, res) => {
  // TODO: verify webhook signature
  // TODO: on payment.paid event -> insert booking as 'confirmed' + 'paid'
  res.sendStatus(200)
})

export default router
