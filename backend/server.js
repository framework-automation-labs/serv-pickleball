import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bookingsRouter from './src/routes/bookings.js'
import paymentsRouter from './src/routes/payments.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/bookings', bookingsRouter)
app.use('/api/payments', paymentsRouter)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`SERV backend running on http://localhost:${PORT}`)
})
