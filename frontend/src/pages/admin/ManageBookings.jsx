import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
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

export default function ManageBookings() {
  const [date, setDate] = useState(todayDateString())
  const [statusFilter, setStatusFilter] = useState('all')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  async function loadBookings() {
    setLoading(true)
    setError('')

    let query = supabase
      .from('bookings')
      .select('*, courts(name), profiles(full_name, phone_number)')
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

  async function updateStatus(booking, nextStatus) {
    setUpdatingId(booking.id)
    setError('')

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', booking.id)

    if (updateError) {
      setError(`Could not update booking: ${updateError.message}`)
    } else {
      setBookings((prev) =>
        statusFilter === 'all'
          ? prev.map((b) => (b.id === booking.id ? { ...b, status: nextStatus } : b))
          : prev.filter((b) => b.id !== booking.id)
      )
    }
    setUpdatingId(null)
  }

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
        ) : bookings.length === 0 ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">No bookings for this date.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Court</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Payment</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-6 py-4 text-ink whitespace-nowrap">
                    {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                  </td>
                  <td className="px-6 py-4 text-ink">{booking.courts?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <p className="text-ink">{booking.guest_name || booking.profiles?.full_name || '—'}</p>
                    <p className="text-ink/50 text-xs">{booking.guest_phone || booking.profiles?.phone_number || ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge value={booking.status} styles={STATUS_STYLES} />
                  </td>
                  <td className="px-6 py-4">
                    <Badge value={booking.payment_status} styles={PAYMENT_STYLES} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {booking.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(booking, 'confirmed')}
                          disabled={updatingId === booking.id}
                          className="rounded-lg bg-spark text-white text-xs font-medium px-3 py-1.5 hover:bg-spark/90 transition-colors disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      )}
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(booking, 'completed')}
                          disabled={updatingId === booking.id}
                          className="rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors disabled:opacity-50"
                        >
                          Mark Completed
                        </button>
                      )}
                      {(booking.status === 'pending' || booking.status === 'confirmed') && (
                        <button
                          onClick={() => updateStatus(booking, 'cancelled')}
                          disabled={updatingId === booking.id}
                          className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}
