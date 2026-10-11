// Small helpers for telling online bookings apart from admin-entered walk-ins.
//
// Walk-ins reuse existing booking columns on purpose (no database migration needed, and the
// reschedule / remove-hour functions already copy these columns when they split a booking):
//   reference_code    -> 'WALK-XXXXXXXX'
//   payment_reference -> 'cash' | 'gcash' | 'other'  (how the walk-in paid)
//   receipt_path      -> the admin's photo of the cash / payment receipt

export const WALK_IN_PREFIX = 'WALK'
export const WALK_IN_METHODS = ['cash', 'gcash', 'other']

const METHOD_LABELS = { cash: 'Cash', gcash: 'GCash', other: 'Other' }

export function isWalkIn(booking) {
  return String(booking.reference_code || '').startsWith(`${WALK_IN_PREFIX}-`) || !booking.receipt_path
}

export function paymentMethodLabel(booking) {
  if (!isWalkIn(booking)) return 'GCash'
  return METHOD_LABELS[booking.payment_reference] || 'Not recorded'
}
