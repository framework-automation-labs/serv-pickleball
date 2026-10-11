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
import ExcelJS from 'exceljs'
import { WALK_IN_PREFIX, WALK_IN_METHODS, isWalkIn, paymentMethodLabel } from '../lib/bookingMeta.js'
import { receivedEmail, confirmedEmail, rejectedEmail, rescheduledEmail, adminNewReceiptAlert } from '../lib/emailTemplates.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

const RATE_PER_HOUR = 300 // fallback only — each court's real rate is courts.rate_per_hour

// Must match frontend/src/lib/api.js (OPEN_HOUR / CLOSE_HOUR).
const OPEN_HOUR = 9
const CLOSE_HOUR = 24
const MAX_SLOTS_PER_SUBMISSION = 6
const MAX_ADVANCE_DAYS = 90
// Customer-facing reschedule POLICY (shown on the booking pages): a booking can be moved up to
// this many hours before it starts. The admin tools deliberately do NOT enforce it any more, so
// staff can move someone on the spot (e.g. switch courts mid-session). It is kept here only so
// admin overrides can be logged.
const RESCHEDULE_POLICY_HOURS = 6
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
  if (typeof email !== 'string' || !email.trim() || email.trim().length > 254 || !EMAIL_RE.test(email.trim())) {
    return 'Please enter a valid email address.'
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
//   payload: JSON string — { fullName, phone, email, bookings: [{courtId, date, startHour, endHour}] }
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
    const email = payload.email.trim()
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
//   body: { courtId, date: 'YYYY-MM-DD', startHour, sourceStartHour }
//
// Moves one hour from a booking block. Any unselected hours remain booked in place.
// Admins can move an hour at any time: the 6-hour customer policy is NOT enforced here. The only
// things that stop a move are an hour that has already finished (source or destination) and
// destination overlaps, which the database refuses (exclusion constraint / blocked-slot trigger).
router.patch(
  '/:bookingId/reschedule',
  adminLimiter,
  requireAdmin,
  wrap(async (req, res) => {
    const { bookingId } = req.params
    if (!UUID_RE.test(bookingId)) return res.status(404).json({ error: 'Booking not found.' })

    const { courtId, date, startHour, sourceStartHour } = req.body || {}
    const newCourtId = Number(courtId)
    if (!Number.isInteger(newCourtId) || newCourtId <= 0) return res.status(400).json({ error: 'Choose a valid court.' })
    if (!isRealDate(date)) return res.status(400).json({ error: 'Choose a valid date.' })
    if (!Number.isInteger(startHour)) return res.status(400).json({ error: 'Choose a valid start time.' })
    if (!Number.isInteger(sourceStartHour)) return res.status(400).json({ error: 'Choose the booking hour to move.' })

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

    const oldStartHour = parseInt(booking.start_time, 10)
    const oldEndHour = endHourOf(booking.end_time)
    if (sourceStartHour < oldStartHour || sourceStartHour + 1 > oldEndHour) {
      return res.status(409).json({ error: 'That booking hour has changed. Refresh the schedule and try again.' })
    }

    // An hour that has already finished can't be moved. Anything still ahead or in progress can,
    // however close it is: the 6-hour policy is not enforced for admins.
    const sourceStartMs = new Date(`${booking.booking_date}T${toTime(sourceStartHour)}+08:00`).getTime()
    const msUntilSource = sourceStartMs - Date.now()
    if (msUntilSource + 60 * 60 * 1000 <= 0) {
      return res.status(409).json({ error: 'That time slot has already passed, so it can\u2019t be moved.' })
    }
    if (msUntilSource < RESCHEDULE_POLICY_HOURS * 60 * 60 * 1000) {
      console.info(`[reschedule] admin ${req.adminUserId} moved booking ${bookingId} inside the ${RESCHEDULE_POLICY_HOURS}h policy window`)
    }

    const newEndHour = startHour + 1
    if (startHour < OPEN_HOUR || newEndHour > CLOSE_HOUR) {
      return res.status(400).json({ error: 'The new time must be between 9:00 AM and 12:00 midnight.' })
    }

    // The hour currently in progress is still open to admins; only hours that finished are closed.
    const { today, hour: nowHour } = manilaNow()
    if (date < today || (date === today && startHour < nowHour)) {
      return res.status(400).json({ error: 'You can\u2019t move a booking to a time that has already passed.' })
    }
    if (date > addDays(today, MAX_ADVANCE_DAYS)) {
      return res.status(400).json({ error: `Bookings can only be made up to ${MAX_ADVANCE_DAYS} days ahead.` })
    }
    if (newCourtId === booking.court_id && date === booking.booking_date && startHour === sourceStartHour) {
      return res.status(400).json({ error: 'That is the same time slot.' })
    }

    const { data: court } = await supabaseAdmin
      .from('courts')
      .select('id, name')
      .eq('id', newCourtId)
      .eq('status', 'active')
      .maybeSingle()
    if (!court) return res.status(400).json({ error: 'That court is not available.' })

    const { error: updateError } = await supabaseAdmin.rpc('reschedule_booking_hour', {
      p_booking_id: bookingId,
      p_expected_date: booking.booking_date,
      p_expected_start_time: booking.start_time,
      p_expected_end_time: booking.end_time,
      p_source_start_hour: sourceStartHour,
      p_new_court_id: newCourtId,
      p_new_date: date,
      p_new_start_hour: startHour,
    })

    if (updateError) {
      if (updateError.code === '23P01') {
        return res.status(409).json({ error: 'That time slot was just taken. Please pick another.' })
      }
      if (/blocked/i.test(updateError.message || '')) {
        return res.status(409).json({ error: 'That time slot is blocked and unavailable.' })
      }
      if (updateError.code === 'P0002') return res.status(404).json({ error: 'Booking not found.' })
      if (updateError.code === '40001') {
        return res.status(409).json({ error: 'That booking hour has changed. Refresh the schedule and try again.' })
      }
      console.error('[reschedule] update failed:', updateError)
      return res.status(500).json({ error: 'Could not reschedule this booking.' })
    }

    res.json({ ok: true })

    // Best-effort email after responding — must never throw out of the handler.
    try {
      if (!booking.guest_email) return
      const was = `${booking.courts?.name}, ${booking.booking_date}, ${hourLabel(sourceStartHour)} – ${hourLabel(sourceStartHour + 1)}`
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

// PATCH /api/bookings/:bookingId/remove-hour  (admin only)
//   body: { sourceStartHour }
//
// Frees ONE booked hour (e.g. a no-show or a mistake). A one-hour booking is deleted;
// in a longer block the hour is cut out and the remaining pieces stay booked. Unlike
// rescheduling there is no 6-hour rule — an admin can free a slot at any time. The
// customer is NOT emailed automatically.
router.patch(
  '/:bookingId/remove-hour',
  adminLimiter,
  requireAdmin,
  wrap(async (req, res) => {
    const { bookingId } = req.params
    if (!UUID_RE.test(bookingId)) return res.status(404).json({ error: 'Booking not found.' })

    const { sourceStartHour } = req.body || {}
    if (!Number.isInteger(sourceStartHour)) return res.status(400).json({ error: 'Choose the booking hour to remove.' })

    const { data: booking, error: findError } = await supabaseAdmin
      .from('bookings')
      .select('id, start_time, end_time, booking_date, status')
      .eq('id', bookingId)
      .maybeSingle()
    if (findError) {
      console.error('[remove-hour] lookup failed:', findError)
      return res.status(500).json({ error: 'Could not load this booking.' })
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found. Refresh the schedule and try again.' })
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'This booking is already cancelled.' })

    const { error: rpcError } = await supabaseAdmin.rpc('remove_booking_hour', {
      p_booking_id: bookingId,
      p_expected_date: booking.booking_date,
      p_expected_start_time: booking.start_time,
      p_expected_end_time: booking.end_time,
      p_source_start_hour: sourceStartHour,
    })

    if (rpcError) {
      if (rpcError.code === 'P0002') return res.status(404).json({ error: 'Booking not found. Refresh the schedule and try again.' })
      if (rpcError.code === '40001') {
        return res.status(409).json({ error: 'That booking hour has changed. Refresh the schedule and try again.' })
      }
      if (rpcError.code === '42883' || /remove_booking_hour/i.test(rpcError.message || '')) {
        console.error('[remove-hour] migration 018 not applied?', rpcError)
        return res.status(500).json({ error: 'Remove-hour is not set up yet (run database/018_remove_booking_hour.sql).' })
      }
      console.error('[remove-hour] failed:', rpcError)
      return res.status(500).json({ error: 'Could not remove this time slot.' })
    }

    res.json({ ok: true })
  })
)

// POST /api/bookings/walk-in  (admin only, multipart/form-data)
//   payload: JSON string — { guestName, phone?, courtId, date, startHour, hours, paymentMethod, amount? }
//   photo:   image file — photo of the cash or of the online payment receipt
//
// For people paying at the courts (a new walk-in, or a player who is already playing and wants
// more time). The booking is saved already confirmed + paid, since the admin collected the
// payment in person; nothing is emailed. The same overlap protection as online bookings applies
// (database exclusion constraint + blocked-slot trigger), so a taken slot is refused.
router.post(
  '/walk-in',
  adminLimiter,
  requireAdmin,
  upload.single('photo'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Please attach a photo of the cash or the payment receipt.' })
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

    const { guestName, phone, date, startHour, hours, paymentMethod } = payload
    const courtId = Number(payload.courtId)

    if (typeof guestName !== 'string' || !guestName.trim() || guestName.trim().length > 100) {
      return res.status(400).json({ error: 'Please enter the player’s name (max 100 characters).' })
    }
    const cleanPhone = typeof phone === 'string' ? phone.trim() : ''
    if (cleanPhone && !PHONE_RE.test(cleanPhone)) {
      return res.status(400).json({ error: 'That phone number does not look right. Leave it blank if you don’t have one.' })
    }
    if (!Number.isInteger(courtId) || courtId <= 0) return res.status(400).json({ error: 'Choose a valid court.' })
    if (!isRealDate(date)) return res.status(400).json({ error: 'Choose a valid date.' })
    if (!Number.isInteger(startHour) || !Number.isInteger(hours) || hours < 1 || hours > MAX_SLOTS_PER_SUBMISSION) {
      return res.status(400).json({ error: `Choose a start time and 1 to ${MAX_SLOTS_PER_SUBMISSION} hours.` })
    }
    const endHour = startHour + hours
    if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR) {
      return res.status(400).json({ error: 'Bookings must be between 9:00 AM and 12:00 midnight.' })
    }
    if (!WALK_IN_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Choose how the player paid (cash, GCash or other).' })
    }

    // Same rule as rescheduling: the hour in progress is still bookable, finished hours are not.
    const { today, hour: nowHour } = manilaNow()
    if (date < today || (date === today && startHour < nowHour)) {
      return res.status(400).json({ error: 'You can’t book a time that has already passed.' })
    }
    if (date > addDays(today, MAX_ADVANCE_DAYS)) {
      return res.status(400).json({ error: `Bookings can only be made up to ${MAX_ADVANCE_DAYS} days ahead.` })
    }

    const { hash, meta } = await analyzeReceipt(req.file.buffer)
    const format = meta && IMAGE_FORMATS[meta.format]
    if (!format) return res.status(400).json({ error: 'The photo must be a JPG, PNG, WebP, or GIF image.' })
    if (meta.width * meta.height > MAX_INPUT_PIXELS) {
      return res.status(400).json({ error: 'That image is too large. Please use a normal phone photo.' })
    }

    const { data: court, error: courtError } = await supabaseAdmin
      .from('courts')
      .select('id, rate_per_hour')
      .eq('id', courtId)
      .eq('status', 'active')
      .maybeSingle()
    if (courtError) {
      console.error('[walk-in] court lookup failed:', courtError)
      return res.status(500).json({ error: 'Could not save this booking. Please try again.' })
    }
    if (!court) return res.status(400).json({ error: 'That court is not available.' })

    // Default price = the court's rate; the admin may type what was actually collected.
    const expected = hours * (Number(court.rate_per_hour) || RATE_PER_HOUR)
    let amount = expected
    if (payload.amount != null && payload.amount !== '') {
      amount = Math.round(Number(payload.amount) * 100) / 100
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
        return res.status(400).json({ error: 'Enter a valid amount.' })
      }
    }

    const groupId = randomUUID()
    const referenceCode = generateReferenceCode(WALK_IN_PREFIX)
    const photoPath = `${groupId}.${format.ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('receipts')
      .upload(photoPath, req.file.buffer, { contentType: format.type })
    if (uploadError) {
      console.error('[walk-in] photo upload failed:', uploadError)
      return res.status(500).json({ error: 'Could not save the photo. Please try again.' })
    }

    const { error: insertError } = await supabaseAdmin.from('bookings').insert({
      court_id: courtId,
      guest_name: guestName.trim(),
      guest_phone: cleanPhone, // the table requires a value; '' = none given
      guest_email: null,
      booking_date: date,
      start_time: toTime(startHour),
      end_time: toTime(endHour),
      status: 'confirmed',
      payment_status: 'paid',
      amount,
      booking_group_id: groupId,
      receipt_path: photoPath,
      receipt_hash: hash,
      risk_flags: [],
      reference_code: referenceCode,
      payment_reference: paymentMethod,
    })

    if (insertError) {
      await supabaseAdmin.storage.from('receipts').remove([photoPath])
      if (insertError.code === '23P01') {
        return res.status(409).json({ error: 'That time is already booked on this court. Pick another time or court.' })
      }
      if (/blocked/i.test(insertError.message || '')) {
        return res.status(409).json({ error: 'That time slot is blocked and unavailable.' })
      }
      console.error('[walk-in] insert failed:', insertError)
      return res.status(500).json({ error: 'Could not save this booking. Please try again.' })
    }

    res.status(201).json({ bookingGroupId: groupId, referenceCode })
  })
)

// GET /api/bookings/export.xlsx?from=YYYY-MM-DD&to=YYYY-MM-DD  (admin only)
//
// Excel copy of the bookings for one day (to defaults to from) or a date range. One row per
// court/time block, all statuses included, plus a Summary sheet. Revenue only counts confirmed
// or completed bookings that are marked paid.
const MAX_EXPORT_DAYS = 366

router.get(
  '/export.xlsx',
  adminLimiter,
  requireAdmin,
  wrap(async (req, res) => {
    const from = req.query.from
    const to = req.query.to || from
    if (!isRealDate(from) || !isRealDate(to)) {
      return res.status(400).json({ error: 'Choose a valid date to export.' })
    }
    if (to < from) return res.status(400).json({ error: 'The end date can’t be before the start date.' })
    if (addDays(from, MAX_EXPORT_DAYS) < to) {
      return res.status(400).json({ error: `Export up to ${MAX_EXPORT_DAYS} days at a time.` })
    }

    // Supabase returns at most 1000 rows per request, so page through.
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('*, courts(name)')
        .gte('booking_date', from)
        .lte('booking_date', to)
        .order('booking_date')
        .order('start_time')
        .order('court_id')
        .range(offset, offset + 999)
      if (error) {
        console.error('[export] query failed:', error)
        return res.status(500).json({ error: 'Could not load bookings for the export.' })
      }
      rows.push(...data)
      if (data.length < 1000) break
    }

    const hoursOf = (b) => Math.max(0, endHourOf(b.end_time) - parseInt(b.start_time, 10))
    const startLabel = (t) => hourLabel(parseInt(t, 10))
    const endLabel = (t) => hourLabel(endHourOf(t))
    const bookedOn = (iso) =>
      new Date(iso).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    const countsAsRevenue = (b) => ['confirmed', 'completed'].includes(b.status) && b.payment_status === 'paid'

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SERV Pickleball Club'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Bookings', { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.columns = [
      { header: 'Date', key: 'date', width: 13, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Court', key: 'court', width: 16 },
      { header: 'Start', key: 'start', width: 11 },
      { header: 'End', key: 'end', width: 11 },
      { header: 'Hours', key: 'hours', width: 8 },
      { header: 'Customer', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Reference', key: 'ref', width: 16 },
      { header: 'Source', key: 'source', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Payment', key: 'payment', width: 10 },
      { header: 'Paid via', key: 'method', width: 12 },
      { header: 'Amount (₱)', key: 'amount', width: 13, style: { numFmt: '#,##0.00' } },
      { header: 'Proof photo', key: 'proof', width: 12 },
      { header: 'Booked on', key: 'created', width: 22 },
    ]

    for (const b of rows) {
      sheet.addRow({
        date: new Date(`${b.booking_date}T00:00:00Z`),
        court: b.courts?.name || '',
        start: startLabel(b.start_time),
        end: endLabel(b.end_time),
        hours: hoursOf(b),
        name: b.guest_name || '',
        phone: b.guest_phone || '',
        email: b.guest_email || '',
        ref: b.reference_code || '',
        source: isWalkIn(b) ? 'Walk-in' : 'Online',
        status: b.status,
        payment: b.payment_status,
        method: paymentMethodLabel(b),
        amount: Number(b.amount) || 0,
        proof: b.receipt_path ? 'Yes' : 'No',
        created: bookedOn(b.created_at),
      })
    }
    // Phone numbers like 0917... must stay text so Excel keeps the leading zero.
    sheet.getColumn('phone').numFmt = '@'

    const header = sheet.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } }
    header.alignment = { vertical: 'middle' }
    header.height = 22
    sheet.autoFilter = { from: 'A1', to: `P1` }

    const revenueRows = rows.filter(countsAsRevenue)
    const revenue = revenueRows.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
    const totalRow = sheet.addRow({
      name: 'TOTAL (confirmed / completed, paid)',
      hours: revenueRows.reduce((sum, b) => sum + hoursOf(b), 0),
      amount: revenue,
    })
    totalRow.font = { bold: true }
    totalRow.getCell('amount').border = { top: { style: 'thin' } }
    totalRow.getCell('hours').border = { top: { style: 'thin' } }

    // ---- Summary sheet: per court, plus paid-by method ----
    const summary = workbook.addWorksheet('Summary')
    ;[34, 12, 10, 16].forEach((width, i) => {
      summary.getColumn(i + 1).width = width
    })
    summary.getColumn(4).numFmt = '#,##0.00'
    summary.addRow([from === to ? `Bookings for ${from}` : `Bookings from ${from} to ${to}`]).font = { bold: true, size: 14 }
    summary.addRow([])
    const sectionHead = (labels) => {
      const r = summary.addRow(labels)
      r.font = { bold: true }
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF4' } }
    }

    sectionHead(['By court (confirmed / completed, paid)', 'Bookings', 'Hours', 'Amount (₱)'])
    const byCourt = new Map()
    for (const b of revenueRows) {
      const key = b.courts?.name || `Court ${b.court_id}`
      const cur = byCourt.get(key) || { bookings: 0, hours: 0, amount: 0 }
      cur.bookings += 1
      cur.hours += hoursOf(b)
      cur.amount += Number(b.amount) || 0
      byCourt.set(key, cur)
    }
    for (const [name, v] of [...byCourt].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
      summary.addRow([name, v.bookings, v.hours, v.amount])
    }
    summary.addRow([])

    sectionHead(['By payment method', 'Bookings', 'Hours', 'Amount (₱)'])
    const byMethod = new Map()
    for (const b of revenueRows) {
      const key = paymentMethodLabel(b)
      const cur = byMethod.get(key) || { bookings: 0, hours: 0, amount: 0 }
      cur.bookings += 1
      cur.hours += hoursOf(b)
      cur.amount += Number(b.amount) || 0
      byMethod.set(key, cur)
    }
    for (const [name, v] of byMethod) summary.addRow([name, v.bookings, v.hours, v.amount])
    summary.addRow([])

    const totals = summary.addRow(['TOTAL', revenueRows.length, revenueRows.reduce((s, b) => s + hoursOf(b), 0), revenue])
    totals.font = { bold: true }
    summary.addRow([])
    const countBy = (status) => rows.filter((b) => b.status === status).length
    summary.addRow([`Not counted above: ${countBy('pending')} pending, ${countBy('cancelled')} cancelled`]).font = {
      italic: true,
      color: { argb: 'FF666666' },
    }

    const filename = from === to ? `SERV-bookings-${from}.xlsx` : `SERV-bookings-${from}_to_${to}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await workbook.xlsx.write(res)
    res.end()
  })
)

export default router
