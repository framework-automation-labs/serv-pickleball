import rateLimit from 'express-rate-limit'

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// Guards the public, unauthenticated POST endpoint (submitting a
// booking) against someone scripting a
// flood of fake submissions — each one uploads a file and locks a
// court slot until an admin reviews it, so this is worth
// throttling even for a small club.
export const submissionLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this device — please wait a bit and try again.' },
})

// Global per-IP ceiling for every /api route (calendar polling, status
// page refreshes, etc. all fit comfortably under this).
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
})

// PDF generation is CPU-heavy (PDFKit + QR rendering) and the endpoint
// is public, so it gets its own tighter limit.
export const pdfLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many receipt downloads — please try again shortly.' },
})

// Admin review endpoint: each call hits Supabase auth + sends email.
// Throttled to blunt a stolen/abused admin token or a brute-force loop.
export const adminLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin actions — please wait a moment.' },
})
