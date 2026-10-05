import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import ReceiptViewerModal from '../../components/admin/ReceiptViewerModal.jsx'
import RejectReasonModal from '../../components/admin/RejectReasonModal.jsx'
import RiskFlags from '../../components/admin/RiskFlags.jsx'
import { reviewBookingGroup } from '../../lib/api.js'
import { supabase } from '../../lib/supabaseClient.js'

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'cancelled', 'completed']

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
}

const PAYMENT_STYLES = {
  unpaid: 'bg-red-50 text-red-700 border-red-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200',
}

function Badge({ value, styles }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[value] || ''}`}>
      {value}
    </span>
  )
}

function formatTime(timeStr) {
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:${mStr} ${period}`
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

// There's no payment gateway confirming anything automatically — a
// pending receipt occupies its time slot (nobody else can book it)
// until an admin approves or rejects it. This just surfaces how long
// one's been waiting, since nothing currently expires it on its own.
function hoursSince(timestamp) {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60))
}

// Groups the flat per-court/time-block rows back into one card per
// booking_group_id, since one GCash receipt can cover several blocks
// submitted together at checkout.
function groupByBookingGroup(bookings) {
  const groups = new Map()
  for (const b of bookings) {
    const key = b.booking_group_id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(b)
  }
  return [...groups.values()]
}

export default function ManageBookings() {
  const [date, setDate] = useState(todayDateString())
  const [statusFilter, setStatusFilter] = useState('all')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingGroupId, setUpdatingGroupId] = useState(null)
  const [viewingReceiptPath, setViewingReceiptPath] = useState(null)
  const [rejectingGroupId, setRejectingGroupId] = useState(null)

  async function loadBookings() {
    setLoading(true)
    setError('')

    let query = supabase
      .from('bookings')
      .select('*, courts(name)')
      .eq('booking_date', date)
      .order('start_time')

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError('Could not load bookings.')
    } else {
      setBookings(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, statusFilter])

  // Applies to every row sharing this booking_group_id — a receipt
  // covers the whole group, so approval/rejection should too. Goes
  // through the backend (not a direct Supabase update) so it can also
  // email the customer — confirmed with the PDF attached, rejected
  // with the reason.
  async function approveGroup(groupId) {
    setUpdatingGroupId(groupId)
    setError('')
    try {
      await reviewBookingGroup(groupId, 'approve')
      await loadBookings()
    } catch (err) {
      setError(`Could not approve booking: ${err.message}`)
    }
    setUpdatingGroupId(null)
  }

  async function rejectGroup(groupId, reason) {
    setUpdatingGroupId(groupId)
    setError('')
    try {
      await reviewBookingGroup(groupId, 'reject', reason)
      await loadBookings()
    } catch (err) {
      setError(`Could not reject booking: ${err.message}`)
    }
    setUpdatingGroupId(null)
    setRejectingGroupId(null)
  }

  // Cancelling an already-confirmed booking (not part of the receipt
  // review flow) stays a direct Supabase update — no rejection email,
  // since the customer already has their confirmed-booking email.
  async function cancelConfirmedGroup(groupId) {
    setUpdatingGroupId(groupId)
    setError('')

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', rejection_reason: 'Cancelled by admin.' })
      .eq('booking_group_id', groupId)

    if (updateError) {
      setError(`Could not cancel booking: ${updateError.message}`)
    } else {
      await loadBookings()
    }
    setUpdatingGroupId(null)
  }

  // For reviewed bookings (confirmed/cancelled/completed) that don't
  // need to sit in the list anymore. Not offered for 'pending' — those
  // should go through Approve/Reject first, so there's always a
  // record of what happened before a receipt disappears.
  async function deleteGroup(groupId, receiptPath) {
    if (!window.confirm('Delete this booking permanently? This cannot be undone.')) return

    setUpdatingGroupId(groupId)
    setError('')

    if (receiptPath) {
      await supabase.storage.from('receipts').remove([receiptPath]) // best-effort cleanup
    }

    const { error: deleteError } = await supabase.from('bookings').delete().eq('booking_group_id', groupId)

    if (deleteError) {
      setError(`Could not delete booking: ${deleteError.message}`)
    } else {
      await loadBookings()
    }
    setUpdatingGroupId(null)
  }

  async function updateStatus(booking, nextStatus) {
    setUpdatingGroupId(booking.booking_group_id)
    setError('')

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', booking.id)

    if (updateError) {
      setError(`Could not update booking: ${updateError.message}`)
    } else {
      await loadBookings()
    }
    setUpdatingGroupId(null)
  }

  const groups = groupByBookingGroup(bookings)

  return (
    <AdminLayout title="Bookings">
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label htmlFor="date" className="block text-xs font-medium text-ink/50 mb-1">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-xs font-medium text-ink/50 mb-1">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink capitalize focus:outline-none focus:ring-2 focus:ring-court"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s === 'all' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">Loading bookings…</p>
        ) : groups.length === 0 ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">No bookings for this date.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Payment</th>
                <th className="px-6 py-3 font-medium">Receipt</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const first = group[0]
                const groupId = first.booking_group_id
                const isPending = first.status === 'pending'
                const isConfirmed = first.status === 'confirmed'
                return (
                  <tr key={groupId} className="border-b border-line last:border-0 align-top">
                    <td className="px-6 py-4 text-ink whitespace-nowrap">
                      {group.map((b) => (
                        <p key={b.id}>
                          {b.courts?.name}: {formatTime(b.start_time)} – {formatTime(b.end_time)}
                        </p>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-ink">{first.guest_name || '—'}</p>
                      <p className="text-ink/50 text-xs">{first.guest_phone || ''}</p>
                      {first.guest_email && <p className="text-ink/40 text-xs">{first.guest_email}</p>}
                      {first.reference_code && (
                        <p className="text-ink/40 text-xs mt-0.5">Ref: {first.reference_code}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge value={first.status} styles={STATUS_STYLES} />
                      {isPending && hoursSince(first.created_at) >= 24 && (
                        <p className="text-amber-600 text-xs mt-1">
                          Waiting {hoursSince(first.created_at)}h — this slot is held until reviewed
                        </p>
                      )}
                      {first.status === 'cancelled' && first.rejection_reason && (
                        <p className="text-ink/40 text-xs mt-1 max-w-[14rem]">{first.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge value={first.payment_status} styles={PAYMENT_STYLES} />
                    </td>
                    <td className="px-6 py-4">
                      {first.receipt_path ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => setViewingReceiptPath(first.receipt_path)}
                            className="text-court font-medium text-xs underline"
                          >
                            View Receipt
                          </button>
                          <RiskFlags flags={first.risk_flags} />
                        </div>
                      ) : (
                        <span className="text-xs text-ink/30">Admin-entered (walk-in)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {isPending && (
                          <>
                            <button
                              onClick={() => approveGroup(groupId)}
                              disabled={updatingGroupId === groupId}
                              className="rounded-lg bg-spark text-white text-xs font-medium px-3 py-1.5 hover:bg-spark/90 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingGroupId(groupId)}
                              disabled={updatingGroupId === groupId}
                              className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isConfirmed && (
                          <>
                            <button
                              onClick={() => updateStatus(first, 'completed')}
                              disabled={updatingGroupId === groupId}
                              className="rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors disabled:opacity-50"
                            >
                              Mark Completed
                            </button>
                            <button
                              onClick={() => cancelConfirmedGroup(groupId)}
                              disabled={updatingGroupId === groupId}
                              className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {!isPending && (
                          <button
                            onClick={() => deleteGroup(groupId, first.receipt_path)}
                            disabled={updatingGroupId === groupId}
                            className="rounded-lg border border-line text-ink/40 text-xs font-medium px-3 py-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {viewingReceiptPath && (
        <ReceiptViewerModal path={viewingReceiptPath} onClose={() => setViewingReceiptPath(null)} />
      )}

      {rejectingGroupId && (
        <RejectReasonModal
          submitting={updatingGroupId === rejectingGroupId}
          onCancel={() => setRejectingGroupId(null)}
          onConfirm={(reason) => rejectGroup(rejectingGroupId, reason)}
        />
      )}
    </AdminLayout>
  )
}
