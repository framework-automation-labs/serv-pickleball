import { supabase } from './supabaseClient'

const OPEN_HOUR = 9   // 9:00 AM
const CLOSE_HOUR = 24 // 12:00 Midnight

export async function fetchCourts() {
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .eq('status', 'active')
    .order('id')
  if (error) throw error
  return data
}

export async function fetchAvailability(date) {
  const [{ data: booked, error: bookedError }, { data: blocked, error: blockedError }] = await Promise.all([
    supabase.from('public_availability').select('*').eq('booking_date', date),
    supabase.from('blocked_slots').select('court_id, blocked_date, start_time, end_time').eq('blocked_date', date),
  ])
  if (bookedError) throw bookedError
  if (blockedError) throw blockedError

  const blockedAsAvailability = (blocked || []).map((b) => ({
    court_id: b.court_id,
    booking_date: b.blocked_date,
    start_time: b.start_time,
    end_time: b.end_time,
    status: 'blocked',
  }))

  return [...(booked || []), ...blockedAsAvailability]
}

export function generateHourSlots() {
  const slots = []
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) slots.push(h)
  return slots
}

export function formatHour(hour) {
  const h = hour % 24
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${period}`
}

// Current date + hour in the club's timezone (Philippines), matching what the backend checks.
export function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t).value
  return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

// A slot is closed once its start time has been reached (past dates are closed entirely).
export function isHourPast(date, hour, now = manilaNow()) {
  return date < now.today || (date === now.today && hour <= now.hour)
}

export function isHourBooked(courtId, hour, availability) {
  return availability.some((b) => {
    if (b.court_id !== courtId) return false
    const startHour = parseInt(b.start_time.split(':')[0], 10)
    const endHour = parseInt(b.end_time.split(':')[0], 10)
    return hour >= startHour && hour < endHour
  })
}

const API_URL = import.meta.env.VITE_API_URL || 'https://serv-pickleball-backend.onrender.com'

// Submits a booking (one or more court/time blocks) together with the
// GCash receipt screenshot. Returns { bookingGroupId, referenceCode }
// on success, or throws with a user-facing message on failure.
export async function submitBookingWithReceipt({ fullName, phone, email, bookings, receiptFile }) {
  const formData = new FormData()
  formData.append('payload', JSON.stringify({ fullName, phone, email, bookings }))
  formData.append('receipt', receiptFile)

  const res = await fetch(`${API_URL}/api/bookings`, { method: 'POST', body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not submit your booking. Please try again.')
  return data
}

export async function fetchBookingStatus(groupId) {
  const res = await fetch(`${API_URL}/api/bookings/${groupId}/status`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not load this booking.')
  return data
}

// Admin-only — approving/rejecting a receipt also sends the customer
// an email, so these go through the backend (which verifies the
// caller is really an admin) instead of a direct Supabase update.
async function authedPatch(path, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Your admin session has expired — please log in again.')

  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

// Moves one booked block to another court / date / start hour (admin only; the server
// enforces the 6-hour rule and refuses overlaps).
export function rescheduleBooking(bookingId, { courtId, date, startHour }) {
  return authedPatch(`/api/bookings/${bookingId}/reschedule`, { courtId, date, startHour })
}

export function reviewBookingGroup(groupId, action, reason) {
  return authedPatch(`/api/bookings/${groupId}/review`, { action, reason })
}
