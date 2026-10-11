import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import CourtTimeline from '../../components/admin/CourtTimeline.jsx'
import ReceiptViewerModal from '../../components/admin/ReceiptViewerModal.jsx'
import RejectReasonModal from '../../components/admin/RejectReasonModal.jsx'
import ConfirmModal from '../../components/admin/ConfirmModal.jsx'
import RiskFlags from '../../components/admin/RiskFlags.jsx'
import WalkInBookingModal from '../../components/admin/WalkInBookingModal.jsx'
import { exportBookingsExcel, removeBookingHour, rescheduleBooking, reviewBookingGroup } from '../../lib/api.js'
import { supabase } from '../../lib/supabaseClient.js'
import {
  PAYMENT_METHOD_LABELS,
  formatDay,
  formatTime,
  groupByBookingGroup,
  hoursSince,
  isWalkIn,
  localDateString,
} from '../../components/admin/adminUtils.js'

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'cancelled', 'completed']
const REFRESH_MS = 15000 // keep several admin devices close to in sync
const PAGE_SIZE = 300 // rows (one row = one court/time block)

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

const isDateParam = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')

function Badge({ value, styles }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[value] || ''}`}>
      {value}
    </span>
  )
}

const fieldCls =
  'rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court'

// Four columns on desktop (no horizontal scrolling — the action buttons wrap inside their
// own column); each booking stacks into a card on phones.
const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1fr)_13rem] md:gap-x-5'

export default function ManageBookings() {
  // Links elsewhere can open this page with ?status=pending and/or ?date=YYYY-MM-DD
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date')
  const initialStatus = searchParams.get('status')

  const [view, setView] = useState('list') // 'list' | 'courts'
  // '' = every date (the default): all bookings, newest first.
  const [date, setDate] = useState(isDateParam(initialDate) ? initialDate : '')
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.includes(initialStatus) ? initialStatus : 'all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingGroupId, setUpdatingGroupId] = useState(null)
  const [viewingReceipt, setViewingReceipt] = useState(null) // { path, title }
  const [rejectingGroupId, setRejectingGroupId] = useState(null)
  const [deleting, setDeleting] = useState(null) // { groupId, receiptPath } awaiting confirmation

  // Court schedule view
  const [courtDate, setCourtDate] = useState(isDateParam(initialDate) ? initialDate : localDateString())
  const [schedule, setSchedule] = useState({ courts: [], bookings: [], blocked: [] })
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

  // Walk-in bookings entered at the courts
  const [activeCourts, setActiveCourts] = useState([])
  const [walkIn, setWalkIn] = useState(null) // null = closed, otherwise { courtId, date, startHour }
  const [walkInNotice, setWalkInNotice] = useState('')

  // Excel export
  const [exportFrom, setExportFrom] = useState(localDateString())
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function loadBookings({ silent = false } = {}) {
    if (!silent) setLoading(true)
    setError('')

    let query = supabase
      .from('bookings')
      .select('*, courts(name)')
      .order('created_at', { ascending: false }) // newest first
      .order('start_time')
      .limit(limit)

    if (date) query = query.eq('booking_date', date)
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

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
  }, [date, statusFilter, limit])

  useEffect(() => {
    supabase
      .from('courts')
      .select('id, name, rate_per_hour')
      .eq('status', 'active')
      .order('id')
      .then(({ data }) => setActiveCourts(data || []))
  }, [])

  // silent = background refresh: keep the grid on screen instead of flashing a skeleton
  // (which would also wipe a half-finished tap on a cell).
  async function loadSchedule({ silent = false } = {}) {
    if (!silent) setScheduleLoading(true)
    setScheduleError('')
    const [courtsRes, bookingsRes, blockedRes] = await Promise.all([
      supabase.from('courts').select('id, name, rate_per_hour').eq('status', 'active').order('id'),
      supabase.from('bookings').select('*, courts(name)').eq('booking_date', courtDate).neq('status', 'cancelled').order('start_time'),
      supabase.from('blocked_slots').select('court_id, start_time, end_time').eq('blocked_date', courtDate),
    ])
    if ([courtsRes, bookingsRes, blockedRes].some((r) => r.error)) {
      setScheduleError('Some of the court schedule could not be loaded.')
    }
    setSchedule({ courts: courtsRes.data || [], bookings: bookingsRes.data || [], blocked: blockedRes.data || [] })
    setScheduleLoading(false)
  }

  useEffect(() => {
    if (view === 'courts') loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, courtDate])

  useEffect(() => {
    function refreshVisibleBookings() {
      if (document.visibilityState !== 'visible') return
      loadBookings({ silent: true })
      if (view === 'courts') loadSchedule({ silent: true })
    }

    const timer = setInterval(refreshVisibleBookings, REFRESH_MS)
    document.addEventListener('visibilitychange', refreshVisibleBookings)
    window.addEventListener('focus', refreshVisibleBookings) // tablets: tab/app switch
    window.addEventListener('online', refreshVisibleBookings)
    window.addEventListener('pageshow', refreshVisibleBookings) // iOS back/forward + resume
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshVisibleBookings)
      window.removeEventListener('focus', refreshVisibleBookings)
      window.removeEventListener('online', refreshVisibleBookings)
      window.removeEventListener('pageshow', refreshVisibleBookings)
    }
    // Refresh uses the current list filters and schedule date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, statusFilter, limit, view, courtDate])

  function openWalkIn(prefill = {}) {
    setWalkInNotice('')
    setWalkIn({ courtId: prefill.courtId ?? activeCourts[0]?.id, date: prefill.date || localDateString(), startHour: prefill.startHour ?? null })
  }

  async function walkInCreated({ name, courtName, date: bookedDate, startHour, hours }) {
    setWalkIn(null)
    const pad = (h) => `${String(h % 24).padStart(2, '0')}:00:00`
    setWalkInNotice(
      `Saved: ${name}, ${courtName}, ${formatDay(bookedDate)}, ${formatTime(pad(startHour))} – ${formatTime(pad(startHour + hours))}.`,
    )
    if (view === 'courts') setCourtDate(bookedDate)
    await Promise.all([loadBookings({ silent: true }), view === 'courts' ? loadSchedule({ silent: true }) : null])
  }

  // Downloads an Excel copy of the bookings for the chosen day (or date range).
  async function downloadExport() {
    setExportError('')
    if (!exportFrom) return setExportError('Pick the date to export.')
    const to = exportTo || exportFrom
    if (to < exportFrom) return setExportError('The end date can’t be before the start date.')
    setExporting(true)
    try {
      const blob = await exportBookingsExcel(exportFrom, to)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exportFrom === to ? `SERV-bookings-${exportFrom}.xlsx` : `SERV-bookings-${exportFrom}_to_${to}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) {
      setExportError(err.message || 'Could not export the bookings.')
    }
    setExporting(false)
  }

  // Moves one booked block (admins can move any hour that hasn't finished), then refreshes both views.
  async function rescheduleBlock(booking, target) {
    await rescheduleBooking(booking.id, target)
    await Promise.all([loadSchedule({ silent: true }), loadBookings({ silent: true })])
  }

  // Frees one booked hour from the Courts table, then refreshes both views.
  async function removeHour(booking, hour) {
    await removeBookingHour(booking.id, hour)
    await Promise.all([loadSchedule({ silent: true }), loadBookings({ silent: true })])
  }

  // Applies to every row sharing this booking_group_id — a receipt
  // covers the whole group, so approval/rejection should too. Goes
  // through the backend (not a direct Supabase update) so it can also
  // email the customer — confirmed with the PDF attached, rejected
  // with the reason.
  // Another admin (or device) may have already reviewed this booking — the server answers
  // 409/404. That isn't a real failure: refresh so this list matches reality.
  async function handleReviewError(err, verb) {
    if (err.status === 409 || err.status === 404) {
      setError('This booking was already handled (probably from another device). The list has been refreshed.')
      await loadBookings({ silent: true })
    } else {
      setError(`Could not ${verb} booking: ${err.message}`)
    }
  }

  async function approveGroup(groupId) {
    setUpdatingGroupId(groupId)
    setError('')
    try {
      await reviewBookingGroup(groupId, 'approve')
      await loadBookings({ silent: true })
    } catch (err) {
      await handleReviewError(err, 'approve')
    }
    setUpdatingGroupId(null)
  }

  async function rejectGroup(groupId, reason) {
    setUpdatingGroupId(groupId)
    setError('')
    try {
      await reviewBookingGroup(groupId, 'reject', reason)
      await loadBookings({ silent: true })
    } catch (err) {
      await handleReviewError(err, 'reject')
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
      await loadBookings({ silent: true })
    }
    setUpdatingGroupId(null)
  }

  // For reviewed bookings (confirmed/cancelled/completed) that don't
  // need to sit in the list anymore. Not offered for 'pending' — those
  // should go through Approve/Reject first, so there's always a
  // record of what happened before a receipt disappears.
  async function deleteGroup(groupId, receiptPath) {
    setDeleting(null)
    setUpdatingGroupId(groupId)
    setError('')

    if (receiptPath) {
      await supabase.storage.from('receipts').remove([receiptPath]) // best-effort cleanup
    }

    const { error: deleteError } = await supabase.from('bookings').delete().eq('booking_group_id', groupId)

    if (deleteError) {
      setError(`Could not delete booking: ${deleteError.message}`)
    } else {
      await loadBookings({ silent: true })
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
      await loadBookings({ silent: true })
    }
    setUpdatingGroupId(null)
  }

  const groups = groupByBookingGroup(bookings).map((g) =>
    [...g].sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time)),
  )
  const mayHaveMore = bookings.length >= limit

  return (
    <AdminLayout title="Bookings">
      {/* View switch + walk-in */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-line bg-white p-1 text-sm font-medium" role="tablist">
        {[
          ['list', 'All bookings'],
          ['courts', 'Courts table'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`rounded-lg px-4 py-1.5 transition-colors ${
              view === key ? 'bg-court text-white' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => openWalkIn({ date: view === 'courts' ? courtDate : localDateString() })}
        disabled={activeCourts.length === 0}
        className="rounded-lg bg-spark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-spark/90 disabled:opacity-50"
      >
        + Walk-in booking
      </button>
      </div>

      {walkInNotice && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{walkInNotice}</p>
      )}

      {/* Excel export */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white px-4 py-3">
        <div className="mr-1 min-w-[10rem]">
          <p className="text-sm font-medium text-ink">Export to Excel</p>
          <p className="text-xs text-ink/50">A copy of the bookings for a day (or a range).</p>
        </div>
        <div>
          <label htmlFor="export-from" className="mb-1 block text-xs font-medium text-ink/50">
            Date
          </label>
          <input
            id="export-from"
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor="export-to" className="mb-1 block text-xs font-medium text-ink/50">
            To (optional)
          </label>
          <input
            id="export-to"
            type="date"
            value={exportTo}
            min={exportFrom || undefined}
            onChange={(e) => setExportTo(e.target.value)}
            className={fieldCls}
          />
        </div>
        <button
          type="button"
          onClick={downloadExport}
          disabled={exporting}
          className="rounded-lg border border-court px-4 py-1.5 text-sm font-medium text-court transition-colors hover:bg-court/5 disabled:opacity-50"
        >
          {exporting ? 'Preparing…' : 'Download Excel'}
        </button>
        {exportError && <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{exportError}</p>}
      </div>

      {view === 'courts' ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="court-date" className="mb-1 block text-xs font-medium text-ink/50">
                Date
              </label>
              <input
                id="court-date"
                type="date"
                value={courtDate}
                onChange={(e) => e.target.value && setCourtDate(e.target.value)}
                className={fieldCls}
              />
            </div>
            {courtDate !== localDateString() && (
              <button
                type="button"
                onClick={() => setCourtDate(localDateString())}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-mist"
              >
                Today
              </button>
            )}
          </div>
          {scheduleError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{scheduleError}</p>}
          <CourtTimeline
            courts={schedule.courts}
            bookings={schedule.bookings}
            blocked={schedule.blocked}
            date={courtDate}
            loading={scheduleLoading}
            onDateChange={setCourtDate}
            onReschedule={rescheduleBlock}
            onRemoveHour={removeHour}
            onWalkIn={openWalkIn}
          />
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="date" className="mb-1 block text-xs font-medium text-ink/50">
                Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldCls}
                />
                {date && (
                  <button
                    type="button"
                    onClick={() => setDate('')}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-mist"
                  >
                    All dates
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-xs font-medium text-ink/50">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${fieldCls} capitalize`}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s === 'all' ? 'All statuses' : s}
                  </option>
                ))}
              </select>
            </div>

            <p className="pb-2 text-xs text-ink/45">
              {date ? `Showing ${formatDay(date)}` : 'Showing all dates'} · newest first
            </p>
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {loading ? (
              <p className="px-6 py-10 text-center text-sm text-ink/50">Loading bookings…</p>
            ) : groups.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink/50">
                {date ? 'No bookings for this date.' : 'No bookings yet.'}
              </p>
            ) : (
              <>
                <div className={`hidden border-b border-line px-5 py-3 text-left text-sm font-medium text-ink/50 ${ROW_GRID}`}>
                  <span>Booking</span>
                  <span>Customer</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>

                <ul>
                  {groups.map((group) => {
                    const first = group[0]
                    const groupId = first.booking_group_id
                    const isPending = first.status === 'pending'
                    const isConfirmed = first.status === 'confirmed'
                    const busy = updatingGroupId === groupId
                    return (
                      <li key={groupId} className={`space-y-3 border-b border-line px-4 py-4 last:border-0 sm:px-5 md:space-y-0 ${ROW_GRID}`}>
                        {/* Booking */}
                        <div className="min-w-0 text-sm text-ink">
                          <p className="font-medium">{formatDay(first.booking_date)}</p>
                          {group.map((b) => (
                            <p key={b.id} className="text-ink/80">
                              {b.courts?.name}: {formatTime(b.start_time)} – {formatTime(b.end_time)}
                            </p>
                          ))}
                          <p className="mt-0.5 text-xs text-ink/40">
                            Booked {new Date(first.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>

                        {/* Customer */}
                        <div className="min-w-0 text-sm">
                          <p className="break-words text-ink">{first.guest_name || '—'}</p>
                          <p className="text-xs text-ink/50">{first.guest_phone || ''}</p>
                          {first.guest_email && <p className="break-all text-xs text-ink/40">{first.guest_email}</p>}
                          {first.reference_code && <p className="mt-0.5 text-xs text-ink/40">Ref: {first.reference_code}</p>}
                        </div>

                        {/* Status + payment + receipt */}
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge value={first.status} styles={STATUS_STYLES} />
                            <Badge value={first.payment_status} styles={PAYMENT_STYLES} />
                          </div>
                          {isPending && hoursSince(first.created_at) >= 24 && (
                            <p className="text-xs text-amber-600">
                              Waiting {hoursSince(first.created_at)}h — this slot is held until reviewed
                            </p>
                          )}
                          {first.status === 'cancelled' && first.rejection_reason && (
                            <p className="text-xs text-ink/40">{first.rejection_reason}</p>
                          )}
                          {isWalkIn(first) && (
                            <p className="text-xs font-medium text-ink/60">
                              Walk-in · {PAYMENT_METHOD_LABELS[first.payment_reference] || 'payment not recorded'}
                              {Number(first.amount) > 0 ? ` · ₱${Number(first.amount).toLocaleString()}` : ''}
                            </p>
                          )}
                          {first.receipt_path ? (
                            <>
                              <button
                                onClick={() =>
                                  setViewingReceipt({
                                    path: first.receipt_path,
                                    title: isWalkIn(first) ? 'Payment photo' : 'GCash Receipt',
                                  })
                                }
                                className="block text-xs font-medium text-court underline"
                              >
                                {isWalkIn(first) ? 'View payment photo' : 'View Receipt'}
                              </button>
                              {!isWalkIn(first) && <RiskFlags flags={first.risk_flags} />}
                            </>
                          ) : (
                            <span className="block text-xs text-ink/30">No photo attached</span>
                          )}
                        </div>

                        {/* Actions — always visible, wraps instead of scrolling */}
                        <div className="flex flex-wrap content-start gap-2 md:justify-end">
                          {isPending && (
                            <>
                              <button
                                onClick={() => approveGroup(groupId)}
                                disabled={busy}
                                className="rounded-lg bg-spark px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-spark/90 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectingGroupId(groupId)}
                                disabled={busy}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {isConfirmed && (
                            <>
                              <button
                                onClick={() => updateStatus(first, 'completed')}
                                disabled={busy}
                                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-mist disabled:opacity-50"
                              >
                                Mark Completed
                              </button>
                              <button
                                onClick={() => cancelConfirmedGroup(groupId)}
                                disabled={busy}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {!isPending && (
                            <button
                              onClick={() => setDeleting({ groupId, receiptPath: first.receipt_path })}
                              disabled={busy}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/40 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {mayHaveMore && (
                  <button
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                    className="w-full border-t border-line py-3 text-sm font-medium text-court hover:bg-mist"
                  >
                    Load older bookings
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {viewingReceipt && (
        <ReceiptViewerModal path={viewingReceipt.path} title={viewingReceipt.title} onClose={() => setViewingReceipt(null)} />
      )}

      {walkIn && (
        <WalkInBookingModal courts={activeCourts} initial={walkIn} onClose={() => setWalkIn(null)} onCreated={walkInCreated} />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this booking?"
          message="This permanently removes the booking and its receipt. It cannot be undone."
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteGroup(deleting.groupId, deleting.receiptPath)}
        />
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