import { supabaseAdmin } from './supabaseClient.js'
import { sendMail } from './mailer.js'
import { rejectedEmail } from './emailTemplates.js'

// Without a payment gateway, a pending receipt is the ONLY thing
// holding a court slot — nothing else ever expires
// it. If an admin misses one (or it was junk/spam to begin with),
// it would otherwise sit there forever. This runs periodically (see
// server.js) and auto-rejects anything that's been pending too long.
const STALE_HOURS = Number(process.env.STALE_PENDING_HOURS) || 48

export async function expireStalePending() {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()
  const reason = `Automatically expired after ${STALE_HOURS}h with no admin review. Please submit a new booking if you still want this — and make sure to include a clear GCash receipt.`

  const { data: staleBookings, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', rejection_reason: reason })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('booking_group_id, guest_email, reference_code')

  if (bookingsError) console.error('[cleanup] failed to expire stale bookings:', bookingsError.message)

  // A booking_group_id can span several rows (multiple court/time
  // blocks under one receipt) — only email once per group.
  const emailedGroups = new Set()
  for (const b of staleBookings || []) {
    if (b.guest_email && !emailedGroups.has(b.booking_group_id)) {
      emailedGroups.add(b.booking_group_id)
      sendMail({
        to: b.guest_email,
        subject: `Update on your booking — ${b.reference_code}`,
        html: rejectedEmail({ referenceCode: b.reference_code, itemLabel: 'your court booking', reason }),
      })
    }
  }

  if ((staleBookings?.length || 0) > 0) {
    console.log(
      `[cleanup] auto-expired ${staleBookings.length} stale booking row(s), notified ${emailedGroups.size} customer(s)`
    )
  }
}
