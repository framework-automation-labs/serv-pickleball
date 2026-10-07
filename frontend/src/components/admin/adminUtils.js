// Small helpers shared by the admin dashboard pieces. Display / date math only.

// Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date, which is
// "yesterday" in the Philippines between 12:00 AM and 8:00 AM).
export function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function hoursSince(timestamp) {
  return Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60)))
}

// 'HH:MM:SS' -> hour number. An end time of 00:00 / 24:00 means midnight (hour 24).
export function startHour(timeStr) {
  return parseInt(timeStr.split(':')[0], 10)
}
export function endHour(timeStr) {
  const h = parseInt(timeStr.split(':')[0], 10)
  return h === 0 ? 24 : h
}

export function formatTime(timeStr) {
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10) % 24
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:${mStr} ${period}`
}

export function formatHourShort(hour) {
  const h = hour % 24
  return `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'P' : 'A'}`
}

export function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// One receipt can cover several court/time rows, so group them back together.
export function groupByBookingGroup(bookings) {
  const groups = new Map()
  for (const b of bookings) {
    const key = b.booking_group_id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(b)
  }
  return [...groups.values()]
}

// Reschedule policy: only while the booking's current start is at least this far away.
export const RESCHEDULE_MIN_HOURS = 6

// The club runs on Philippine time (UTC+8), so build the real instant from that.
export function bookingStartMs(booking) {
  return new Date(`${booking.booking_date}T${booking.start_time.slice(0, 8)}+08:00`).getTime()
}

export function canReschedule(booking, now = Date.now()) {
  return (
    ['pending', 'confirmed'].includes(booking.status) &&
    bookingStartMs(booking) - now >= RESCHEDULE_MIN_HOURS * 60 * 60 * 1000
  )
}
