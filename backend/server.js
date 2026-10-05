import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bookingsRouter from './src/routes/bookings.js'
import { expireStalePending } from './src/lib/staleCleanup.js'
import { apiLimiter } from './src/middleware/rateLimiter.js'

const app = express()

app.disable('x-powered-by')

// If you deploy behind a reverse proxy / PaaS (Render, Railway, Fly,
// Heroku, nginx...), set TRUST_PROXY=1 so rate limiting sees the real
// client IP instead of the proxy's IP (otherwise every visitor shares
// one rate-limit bucket, or the limiter can be spoofed via headers).
if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY)
  app.set('trust proxy', Number.isNaN(n) ? process.env.TRUST_PROXY : n)
}

// ALLOWED_ORIGINS is a comma-separated list of frontend origins, e.g.
//   ALLOWED_ORIGINS=https://yourusername.github.io
// (origin only — no path, no trailing slash).
// When it is empty the API fails CLOSED: only localhost origins are
// accepted (so local dev still works), never an arbitrary website.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

if (allowedOrigins.length === 0) {
  console.warn('[security] ALLOWED_ORIGINS is not set — only localhost origins can call this API. Set it before deploying.')
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true) // curl / server-to-server (no browser origin)
      if (allowedOrigins.length > 0) return cb(null, allowedOrigins.includes(origin))
      return cb(null, LOCALHOST_RE.test(origin))
    },
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
)

// Baseline security headers (this is a JSON/PDF API, so a locked-down
// policy is fine). Kept dependency-free on purpose.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  res.setHeader('Cache-Control', 'no-store')
  next()
})

// Tiny JSON bodies only — the booking payload is multipart (handled by
// multer with its own 8MB file limit), and the review endpoint sends a
// short JSON object.
app.use(express.json({ limit: '10kb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Global ceiling on API traffic per IP (stricter per-route limits live
// in middleware/rateLimiter.js).
app.use('/api', apiLimiter)

// Note: there is no payment-gateway route anymore. The client decided
// against PayMongo — customers pay via GCash and upload a receipt
// screenshot instead (see bookings.js),
// which an admin reviews in the dashboard.
app.use('/api/bookings', bookingsRouter)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

// Catches errors thrown by routes/middleware above (e.g. multer
// rejecting an oversized or non-image file) and returns clean JSON.
// Client-caused errors (4xx) keep their message; anything else is
// logged server-side and returned as a generic message so internals
// (SQL errors, stack details, file paths) never leak to the browser.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That image is too large (max 8MB).' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' })
  }

  const status = err.status || err.statusCode || 500
  if (status < 500 && (err.expose || err.name === 'MulterError')) {
    return res.status(status).json({ error: err.message })
  }

  console.error(err)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

// A stray unhandled promise rejection would otherwise terminate the
// process on modern Node and take the whole API offline.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`SERV backend running on http://localhost:${PORT}`)
})

// Sweeps for stale pending bookings once an hour. Only
// matters while this process stays running — if you deploy somewhere
// that spins the server down between requests (serverless), this
// won't fire; use a real scheduled job (e.g. Supabase pg_cron, or a
// hosted cron hitting a dedicated endpoint) there instead.
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000
setInterval(() => expireStalePending().catch((err) => console.error('[cleanup] failed:', err)), CLEANUP_INTERVAL_MS)
