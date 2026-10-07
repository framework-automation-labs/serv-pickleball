import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../lib/supabaseClient.js'
import { analyzeReceipt, MAX_INPUT_PIXELS } from '../lib/receiptAnalysis.js'
import { generateReferenceCode } from '../lib/referenceCode.js'
import { buildReceiptPdf, streamReceiptPdf } from '../lib/receiptPdf.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { submissionLimiter, pdfLimiter, adminLimiter } from '../middleware/rateLimiter.js'
import { sendMail } from '../lib/mailer.js'
import { receivedEmail, confirmedEmail, rejectedEmail, rescheduledEmail, adminNewReceiptAlert } from '../lib/emailTemplates.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

const RATE_PER_HOUR = 300 // fallback only — each court's real rate is courts.rate_per_hour

// Must match frontend/src/lib/api.js (OPEN_HOUR / CLOSE_HOUR).
const OPEN_HOUR = 9
const CLOSE_HOUR = 24
const MAX_SLOTS_PER_SUBMISSION = 6
const MAX_ADVANCE_DAYS = 90
// Reschedule policy: a booking can only be moved while its start is at least this far away.
const RESCHEDULE_MIN_HOURS = 6
// Without a payment gateway a pending receipt holds a slot until an
// admin reviews it — cap how many unreviewed submissions one phone
// number can have open at once so a single person can't lock the calendar.
const MAX_PENDING_GROUPS_PER_PHONE = 3

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/

// Extension + content-type come from what sharp actually DECODED, never
// from the client-supplied filename or mimetype.
const IMAGE_FORMATS = {
  jpeg: { ext: 'jpg', type: 'image/jpeg' },
  png: { ext: 'png', type: 'image/png' },
  webp: { ext: 'webp', type: 'image/webp' },
  gif: { ext: 'gif', type: 'image/gif' },
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5 }, // 8MB — plenty for a screenshot
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      const err = new Error('Receipt must be an image file.')
      err.status = 400
      err.expose = true
      return cb(err)
    }
    cb(null, true)
  },
})

const router = Router()

// Express 4 does not catch rejected promises from async handlers — an
// unhandled rejection would crash the process (a one-request DoS).
// Every async route is wrapped so errors reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function toTime(hour) {
  return `${String(hour).padStart(2, '0')}:00:00`
}

function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t).value
  return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

// Returns an error string, or null if the whole payload is acceptable.
function validatePayload({ fullName, phone, email, bookings }) {
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) {
    return 'Please enter a valid name (max 100 characters).'
  }
  if (typeof phone !== 'string' || !PHONE_RE.test(phone.trim())) {
    return 'Please enter a valid phone number.'
  }
  if (email != null && email !== '') {
    if (typeof email !== 'string' || email.trim().length > 254 || !EMAIL_RE.test(email.trim())) {
      return 'Please enter a valid email address.'
    }
  }
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return 'Missing court selection.'
  }
  if (bookings.length > MAX_SLOTS_PER_SUBMISSION) {
    return `You can book at most ${MAX_SLOTS_PER_SUBMISSION} time blocks at once.`
  }

  const { today, hour: nowHour } = manilaNow()
  const lastDate = addDays(today, MAX_ADVANCE_DAYS)

  for (const b of bookings) {
    if (!b || typeof b !== 'object') return 'One of the selected time slots is invalid.'
    const courtId = Number(b.courtId)
    const { startHour, endHour } = b
    if (!Number.isInteger(courtId) || courtId <= 0) return 'One of the selected courts is invalid.'
    if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return 'One of the selected time slots is invalid.'
    if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR || endHour <= startHour) {
      return 'Bookings must be between 9:00 AM and 12:00 midnight.'
    }
    if (!isRealDate(b.date)) return 'One of the selected dates is invalid.'
    if (b.date < today || (b.date === today && startHour <= nowHour)) {
      return 'You can\u2019t book a time that has already passed.'
    }
    if (b.date > lastDate) return `Bookings can only be made up to ${MAX_ADVANCE_DAYS} days ahead.`
  }
  return null
}

// GET /api/bookings/availability?date=2026-08-29
// Returns booked AND admin-blocked slots per court for a given date,
// so the frontend can grey out unavailable times. The database
// already refuses an overlapping booking either way (exclusion
// constraint for bookings, a trigger for blocked_slots) — this is
// what makes the calendar reflect that up front instead of the
// customer finding out only after submitting a receipt.
router.get(
  '/availability',
  wrap(async (req, res) => {
    const { date } = req.query
    if (!isRealDate(date)) return res.status(400).json({ error: 'date must be a valid YYYY-MM-DD value.' })

    const [{ data: bookedData, error: bookedError }, { data: blockedData, error: blockedError }] = await Promise.all([
      supabaseAdmin.from('public_availability').select('*').eq('booking_date', date),
      supabaseAdmin.from('blocked_slots').select('court_id, blocked_date, start_time, end_time').eq('blocked_date', date),
    ])

    if (bookedError || blockedError) {
      console.error('[availability]', bookedError || blockedError)
      return res.status(500).json({ error: 'Could not load availability.' })
    }

    const blockedAsAvailability = (blockedData || []).map((b) => ({
      court_id: b.court_id,
      booking_date: b.blocked_date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: 'blocked',
    }))

    res.json([...(bookedData || []), ...blockedAsAvailability])
  })
)

// POST /api/bookings  (multipart/form-data)
//   payload: JSON string — { fullName, phone, email?, bookings: [{courtId, date, startHour, endHour}] }
//   receipt: image file — the GCash payment screenshot
//
// Writes the booking(s) immediately with status 'pending' — nothing
// is confirmed until an admin reviews the receipt in the dashboard.
// One receipt can cover several court/time blocks (booking_group_id
// ties them together) since the booking page allows picking more than
// one slot before checking out.
router.post(
  '/',
  submissionLimiter,
  upload.single('receipt'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Please attach a screenshot of your GCash receipt.' })
    }

    let payload
    try {
      payload = JSON.parse(req.body.payload || '{}')
    } catch {
      return res.status(400).json({ error: 'Invalid booking details.' })
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ error: 'Invalid booking details.' })
    }

    const validationError = validatePayload(payload)
    if (validationError) return res.status(400).json({ error: validationError })

    const fullName = payload.fullName.trim()
    const phone = payload.phone.trim()
    const email = payload.email ? payload.email.trim() : null
    const { bookings } = payload

    // The client-declared mimetype is untrusted — only accept files that
    // really decode as one of the allowed image formats.
    const { hash, flags, meta } = await analyzeReceipt(req.file.buffer)
    const format = meta && IMAGE_FORMATS[meta.format]
    if (!format) {
      return res.status(400).json({ error: 'Receipt must be a JPG, PNG, WebP, or GIF image.' })
    }
    if (meta.width * meta.height > MAX_INPUT_PIXELS) {
      return res.status(400).json({ error: 'That image is too large. Please upload a normal screenshot.' })
    }

    // Every court must exist and be open for booking (a court in
    // "maintenance" shouldn't be bookable by calling the API directly).
    const courtIds = [...new Set(bookings.map((b) => Number(b.courtId)))]
    const { data: courts, error: courtsError } = await supabaseAdmin
      .from('courts')
      .select('id, rate_per_hour')
      .in('id', courtIds)
      .eq('status', 'active')
    if (courtsError) {
      console.error('[bookings] court lookup failed:', courtsError)
      return res.status(500).json({ error: 'Could not submit your booking. Please try again.' })
    }
    if ((courts || []).length !== courtIds.length) {
      return res.status(400).json({ error: 'One of the selected courts is not available.' })
    }

    // Price comes from the court's own hourly rate (never from the client).
    const rateByCourt = new Map(courts.map((c) => [c.id, Number(c.rate_per_hour) || RATE_PER_HOUR]))

    // Limit how many unreviewed submissions a single phone number can
    // have open at once (each one holds court slots until reviewed).
    const { data: openRows } = await supabaseAdmin
      .from('bookings')
      .select('booking_group_id')
      .eq('guest_phone', phone)
      .eq('status', 'pending')
    const openGroups = new Set((openRows || []).map((r) => r.booking_group_id))
    if (openGroups.size >= MAX_PENDING_GROUPS_PER_PHONE) {
      return res.status(429).json({
        error: 'You already have several bookings waiting for review. Please wait for them to be confirmed first.',
      })
    }

    const { data: dupBooking } = await supabaseAdmin.from('bookings').select('id').eq('receipt_hash', hash).limit(1)
    if (dupBooking && dupBooking.length) {
      flags.push({
        code: 'duplicate_receipt',
        label: 'This exact receipt image was already submitted with an earlier booking',
        severity: 'high',
      })
    }

    const groupId = randomUUID()
    const referenceCode = generateReferenceCode('SERV')
    const receiptPath = `${groupId}.${format.ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('receipts')
      .upload(receiptPath, req.file.buffer, { contentType: format.type })
    if (uploadError) {
      console.error('[bookings] receipt upload failed:', uploadError)
      return res.status(500).json({ error: 'Could not save your receipt. Please try again.' })
    }

    const rows = bookings.map((b) => ({
      court_id: Number(b.courtId),
      guest_name: fullName,
      guest_phone: phone,
      guest_email: email,
      booking_date: b.date,
      start_time: toTime(b.startHour),
      end_time: toTime(b.endHour),
      status: 'pending',
      payment_status: 'unpaid',
      amount: (b.endHour - b.startHour) * rateByCourt.get(Number(b.courtId)),
      booking_group_id: groupId,
      receipt_path: receiptPath,
      receipt_hash: hash,
      risk_flags: flags,
      reference_code: referenceCode,
    }))

    const { error: insertError } = await supabaseAdmin.from('bookings').insert(rows)
    if (insertError) {
      await supabaseAdmin.storage.from('receipts').remove([receiptPath])
      // Postgres exclusion-constraint violation = overlapping time slot
      if (insertError.code === '23P01') {
        return res.status(409).json({ error: 'One of these time slots was just booked by someone else. Please pick another.' })
      }
      console.error('[bookings] insert failed:', insertError)
      return res.status(500).json({ error: 'Could not submit your booking. Please try again.' })
    }

    res.status(201).json({ bookingGroupId: groupId, referenceCode })

    // Fire-and-forget — the customer already has their response; a slow
    // or failing email shouldn't hold up the API or fail the booking.
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0)
    const itemLabel = `court booking (${bookings.length} slot${bookings.length > 1 ? 's' : ''})`

    sendMail({
      to: email,
      subject: `We received your receipt — ${referenceCode}`,
      html: receivedEmail({ referenceCode, itemLabel }),
    })

    if (ADMIN_NOTIFICATION_EMAIL) {
      sendMail({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `New GCash receipt — ${referenceCode}`,
        html: adminNewReceiptAlert({
          itemLabel,
          guestName: fullName,
          referenceCode,
          amount: totalAmount.toLocaleString(),
          flagCount: flags.length,
          reviewUrl: `${FRONTEND_URL}/admin/bookings`,
        }),
      })
    }
  })
)

// GET /api/bookings/:groupId/status  (public — groupId is an unguessable UUID)
// Powers the customer-facing confirmation page.
router.get(
  '/:groupId/status',
  wrap(async (req, res) => {
    if (!UUID_RE.test(req.params.groupId)) return res.status(404).json({ error: 'Booking not found.' })

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('booking_date, start_time, end_time, status, amount, rejection_reason, reference_code, guest_name, courts(name)')
      .eq('booking_group_id', req.params.groupId)
      .order('booking_date')
      .order('start_time')

    if (error) {
      console.error('[status]', error)
      return res.status(500).json({ error: 'Could not load this booking.' })
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Booking not found.' })

    const status = data.some((b) => b.status === 'cancelled')
      ? 'rejected'
      : data.every((b) => b.status === 'confirmed')
        ? 'confirmed'
        : 'pending'

    res.json({
      referenceCode: data[0].reference_code,
      guestName: data[0].guest_name,
      status,
      rejectionReason: data.find((b) => b.rejection_reason)?.rejection_reason || null,
      totalAmount: data.reduce((sum, b) => sum + Number(b.amount), 0),
      bookings: data.map((b) => ({
        court: b.courts?.name,
        date: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
      })),
    })
  })
)

// GET /api/bookings/:groupId/receipt.pdf  (public — same unguessable groupId)
// Only works once every block in the group is admin-confirmed.
router.get(
  '/:groupId/receipt.pdf',
  pdfLimiter,
  wrap(async (req, res) => {
    if (!UUID_RE.test(req.params.groupId)) return res.status(404).json({ error: 'Booking not found.' })

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('booking_date, start_time, end_time, status, amount, reference_code, guest_name, courts(name)')
      .eq('booking_group_id', req.params.groupId)
      .order('booking_date')
      .order('start_time')

    if (error) {
      console.error('[receipt.pdf]', error)
      return res.status(500).json({ error: 'Could not load this booking.' })
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Booking not found.' })
    if (!data.every((b) => b.status === 'confirmed')) {
      return res.status(409).json({ error: 'This booking is not confirmed yet.' })
    }

    const total = data.reduce((sum, b) => sum + Number(b.amount), 0)

    await streamReceiptPdf(res, {
      referenceCode: data[0].reference_code,
      guestName: data[0].guest_name,
      heading: 'COURT BOOKING CONFIRMED',
      lines: data.map((b) => `${b.courts?.name} — ${b.booking_date}, ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`),
      totalLabel: `Total Paid: \u20b1${total.toLocaleString()}`,
      verifyPath: `/confirmation/${req.params.groupId}`,
      filenameSuffix: 'Booking',
    })
  })
)

// PATCH /api/bookings/:groupId/review  (admin only)
//   body: { action: 'approve' | 'reject', reason? }
//
// The only path that flips a pending group to confirmed/cancelled —
// moved server-side (rather than a direct Supabase update from the
// dashboard) specifically so it can email the customer as a side
// effect: confirmed emails get the PDF receipt attached, rejected
// emails include the admin's reason. Manually cancelling an
// already-confirmed booking still goes through the admin's direct
// Supabase update, unchanged.
//
// Only groups that are still 'pending' can be reviewed. Without that
// guard a (replayed or mistaken) request could resurrect a cancelled
// booking — silently bypassing the overlap protection — or re-send
// confirmation emails for something already reviewed.
router.patch(
  '/:groupId/review',
  adminLimiter,
  requireAdmin,
  wrap(async (req, res) => {
    const { groupId } = req.params
    if (!UUID_RE.test(groupId)) return res.status(404).json({ error: 'Booking not found.' })

    const { action, reason } = req.body || {}
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'." })
    }
    if (reason != null && (typeof reason !== 'string' || reason.length > 500)) {
      return res.status(400).json({ error: 'Reason must be text of at most 500 characters.' })
    }

    const updates =
      action === 'approve'
        ? { status: 'confirmed', payment_status: 'paid' }
        : { status: 'cancelled', rejection_reason: reason?.trim() || 'Receipt could not be verified.' }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updates)
      .eq('booking_group_id', groupId)
      .eq('status', 'pending')
      .select('booking_date, start_time, end_time, amount, reference_code, guest_name, guest_email, courts(name)')

    if (error) {
      console.error('[review]', error)
      return res.status(500).json({ error: 'Could not update this booking.' })
    }
    if (!data || data.length === 0) {
      const { data: existing } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('booking_group_id', groupId)
        .limit(1)
      return existing && existing.length
        ? res.status(409).json({ error: 'This booking has already been reviewed.' })
        : res.status(404).json({ error: 'Booking not found.' })
    }

    res.json({ ok: true })

    // Emails are best-effort and happen AFTER the response — they must
    // never throw out of this handler (nothing is awaiting it anymore).
    try {
      const guestEmail = data[0].guest_email
      if (!guestEmail) return

      const itemLabel = 'your court booking'
      const verifyUrl = `${FRONTEND_URL}/confirmation/${groupId}`

      if (action === 'approve') {
        const total = data.reduce((sum, b) => sum + Number(b.amount), 0)
        const pdfBuffer = await buildReceiptPdf({
          referenceCode: data[0].reference_code,
          guestName: data[0].guest_name,
          heading: 'COURT BOOKING CONFIRMED',
          lines: [...data]
            .sort((a, b) => `${a.booking_date} ${a.start_time}`.localeCompare(`${b.booking_date} ${b.start_time}`))
            .map((b) => `${b.courts?.name} — ${b.booking_date}, ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`),
          totalLabel: `Total Paid: \u20b1${total.toLocaleString()}`,
          verifyPath: `/confirmation/${groupId}`,
        })

        sendMail({
          to: guestEmail,
          subject: `Booking confirmed — ${data[0].reference_code}`,
          html: confirmedEmail({
            referenceCode: data[0].reference_code,
            itemLabel,
            totalLabel: `Total Paid: \u20b1${total.toLocaleString()}`,
            verifyUrl,
          }),
          attachments: [{ filename: `SERV-Receipt-${data[0].reference_code}.pdf`, content: pdfBuffer }],
        })
      } else {
        sendMail({
          to: guestEmail,
          subject: `Update on your booking — ${data[0].reference_code}`,
          html: rejectedEmail({ referenceCode: data[0].reference_code, itemLabel, reason: updates.rejection_reason }),
        })
      }
    } catch (err) {
      console.error('[review] post-review email failed:', err)
    }
  })
)

const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h % 24 >= 12 ? 'PM' : 'AM'}`
const endHourOf = (t) => (parseInt(t, 10) === 0 ? 24 : parseInt(t, 10))

// PATCH /api/bookings/:bookingId/reschedule  (admin only)
//   body: { courtId, date: 'YYYY-MM-DD', startHour }
//
// Moves ONE court/time block to another court, date and/or start hour, keeping its
// length. Rules: only pending/confirmed blocks, only while the ORIGINAL start is
// at least 6 hours away, and never into the past. Overlaps with other bookings or
// blocked slots are still refused by the database itself (exclusion constraint /
// blocked-slot trigger), so two admins can't double-book each other.
router.patch(
  '/:bookingId/reschedule',
  adminLimiter,
  requireAdmin,
  wrap(async (req, res) => {
    const { bookingId } = req.params
    if (!UUID_RE.test(bookingId)) return res.status(404).json({ error: 'Booking not found.' })

    const { courtId, date, startHour } = req.body || {}
    const newCourtId = Number(courtId)
    if (!Number.isInteger(newCourtId) || newCourtId <= 0) return res.status(400).json({ error: 'Choose a valid court.' })
    if (!isRealDate(date)) return res.status(400).json({ error: 'Choose a valid date.' })
    if (!Number.isInteger(startHour)) return res.status(400).json({ error: 'Choose a valid start time.' })

    const { data: booking, error: findError } = await supabaseAdmin
      .from('bookings')
      .select('id, court_id, booking_date, start_time, end_time, status, reference_code, guest_email, courts(name)')
      .eq('id', bookingId)
      .maybeSingle()
    if (findError) {
      console.error('[reschedule] lookup failed:', findError)
      return res.status(500).json({ error: 'Could not load this booking.' })
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found.' })
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(409).json({ error: 'Only pending or confirmed bookings can be rescheduled.' })
    }

    // 6-hour rule, measured from the booking's current start (Philippine time, UTC+8).
    const originalStart = new Date(`${booking.booking_date}T${booking.start_time.slice(0, 8)}+08:00`).getTime()
    if (originalStart - Date.now() < RESCHEDULE_MIN_HOURS * 60 * 60 * 1000) {
      return res.status(409).json({
        error: `Rescheduling is only available up to ${RESCHEDULE_MIN_HOURS} hours before the reservation.`,
      })
    }

    const oldStartHour = parseInt(booking.start_time, 10)
    const duration = endHourOf(booking.end_time) - oldStartHour
    const newEndHour = startHour + duration
    if (startHour < OPEN_HOUR || newEndHour > CLOSE_HOUR) {
      return res.status(400).json({ error: 'The new time must be between 9:00 AM and 12:00 midnight.' })
    }

    const { today, hour: nowHour } = manilaNow()
    if (date < today || (date === today && startHour <= nowHour)) {
      return res.status(400).json({ error: 'You can\u2019t move a booking to a time that has already passed.' })
    }
    if (date > addDays(today, MAX_ADVANCE_DAYS)) {
      return res.status(400).json({ error: `Bookings can only be made up to ${MAX_ADVANCE_DAYS} days ahead.` })
    }
    if (newCourtId === booking.court_id && date === booking.booking_date && startHour === oldStartHour) {
      return res.status(400).json({ error: 'That is the same time slot.' })
    }

    const { data: court } = await supabaseAdmin
      .from('courts')
      .select('id, name')
      .eq('id', newCourtId)
      .eq('status', 'active')
      .maybeSingle()
    if (!court) return res.status(400).json({ error: 'That court is not available.' })

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ court_id: newCourtId, booking_date: date, start_time: toTime(startHour), end_time: toTime(newEndHour) })
      .eq('id', bookingId)

    if (updateError) {
      if (updateError.code === '23P01') {
        return res.status(409).json({ error: 'That time slot was just taken. Please pick another.' })
      }
      if (/blocked/i.test(updateError.message || '')) {
        return res.status(409).json({ error: 'That time slot is blocked and unavailable.' })
      }
      console.error('[reschedule] update failed:', updateError)
      return res.status(500).json({ error: 'Could not reschedule this booking.' })
    }

    res.json({ ok: true })

    // Best-effort email after responding — must never throw out of the handler.
    try {
      if (!booking.guest_email) return
      const was = `${booking.courts?.name}, ${booking.booking_date}, ${hourLabel(oldStartHour)} – ${hourLabel(endHourOf(booking.end_time))}`
      const now = `${court.name}, ${date}, ${hourLabel(startHour)} – ${hourLabel(newEndHour)}`
      const { data: grp } = await supabaseAdmin.from('bookings').select('booking_group_id').eq('id', bookingId).maybeSingle()
      sendMail({
        to: booking.guest_email,
        subject: `Your booking was rescheduled — ${booking.reference_code}`,
        html: rescheduledEmail({
          referenceCode: booking.reference_code,
          itemLabel: 'your court booking',
          was,
          now,
          verifyUrl: `${FRONTEND_URL}/confirmation/${grp?.booking_group_id}`,
        }),
      })
    } catch (err) {
      console.error('[reschedule] email failed:', err)
    }
  })
)

export default router
