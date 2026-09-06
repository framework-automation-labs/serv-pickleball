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
  const { data, error } = await supabase
    .from('public_availability')
    .select('*')
    .eq('booking_date', date)
  if (error) throw error
  return data
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

export function isHourBooked(courtId, hour, availability) {
  return availability.some((b) => {
    if (b.court_id !== courtId) return false
    const startHour = parseInt(b.start_time.split(':')[0], 10)
    const endHour = parseInt(b.end_time.split(':')[0], 10)
    return hour >= startHour && hour < endHour
  })
}