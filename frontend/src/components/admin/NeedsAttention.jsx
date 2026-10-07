import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import ReceiptViewerModal from './ReceiptViewerModal.jsx'
import RejectReasonModal from './RejectReasonModal.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import RiskFlags from './RiskFlags.jsx'
import { reviewBookingGroup } from '../../lib/api.js'
import { formatDay, formatTime, groupByBookingGroup, hoursSince } from './adminUtils.js'

const COLLAPSED_COUNT = 4

function waitLabel(hours) {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h waiting`
  return `${Math.floor(hours / 24)}d ${hours % 24}h waiting`
}

function toneFor(flags, hours) {
  if (Array.isArray(flags) && flags.some((f) => f?.severity === 'high')) return 'border-l-red-400'
  if (hours >= 24 || (Array.isArray(flags) && flags.length > 0)) return 'border-l-amber-400'
  return 'border-l-line'
}

// Every booking waiting for a human decision, oldest first. Bookings can be approved or
// rejected right here (same review call as the Bookings page).
export default function NeedsAttention({ bookings, loading, onChanged }) {
  const [showAll, setShowAll] = useState(false)
  const [viewingReceiptPath, setViewingReceiptPath] = useState(null)
  const [rejectingGroupId, setRejectingGroupId] = useState(null)
  const [approvingGroupId, setApprovingGroupId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')

  const items = useMemo(() => {
    return groupByBookingGroup(bookings)
      .map((group) => ({
        key: `b-${group[0].booking_group_id}`,
        createdAt: group[0].created_at,
        group,
      }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [bookings])

  const visible = showAll ? items : items.slice(0, COLLAPSED_COUNT)

  // Another admin (or device) may have already reviewed this booking — that comes back as a
  // 409/404. Not a real failure: just refresh so the list matches reality.
  async function handleReviewError(err, verb) {
    if (err.status === 409 || err.status === 404) {
      setError('This booking was already handled (probably from another device). The list has been refreshed.')
      await onChanged()
    } else {
      setError(`Could not ${verb} booking: ${err.message}`)
    }
  }

  async function approve(groupId) {
    setUpdatingId(groupId)
    setError('')
    try {
      await reviewBookingGroup(groupId, 'approve')
      setApprovingGroupId(null)
      await onChanged()
    } catch (err) {
      setApprovingGroupId(null)
      await handleReviewError(err, 'approve')
    }
    setUpdatingId(null)
  }

  async function reject(groupId, reason) {
    setUpdatingId(groupId)
    setError('')
    try {
      await reviewBookingGroup(groupId, 'reject', reason)
      setRejectingGroupId(null)
      await onChanged()
    } catch (err) {
      setRejectingGroupId(null)
      await handleReviewError(err, 'reject')
    }
    setUpdatingId(null)
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            Needs attention
            {items.length > 0 && (
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-spark px-2 text-xs font-bold text-white">
                {items.length}
              </span>
            )}
          </h2>
          <p className="text-xs text-ink/50">Oldest first. A pending receipt holds its court slot until it is reviewed.</p>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-5">
          <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <motion.path d="M7.5 12.5l3 3 6-6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.1 }} />
          </svg>
          <div>
            <p className="font-medium text-emerald-800">All caught up</p>
            <p className="text-xs text-emerald-700/80">No receipts are waiting for review.</p>
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {visible.map((item) => {
                const first = item.group[0]
                const record = first
                const hours = hoursSince(item.createdAt)
                const groupId = first.booking_group_id
                const busy = updatingId === groupId
                return (
                  <motion.li
                    key={item.key}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className={`rounded-xl border border-l-4 border-line bg-mist/50 p-4 ${toneFor(record.risk_flags, hours)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-court/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-court">
                            Booking
                          </span>
                          <span className={`text-xs font-medium ${hours >= 24 ? 'text-amber-700' : 'text-ink/50'}`}>
                            {waitLabel(hours)}
                          </span>
                        </div>
                        <p className="font-medium text-ink">
                          {first.guest_name || '—'}
                          <span className="ml-2 text-sm font-normal text-ink/50">{first.guest_phone}</span>
                        </p>
                        <p className="text-sm text-ink/70">
                          {formatDay(first.booking_date)} ·{' '}
                          {item.group.map((b) => `${b.courts?.name}: ${formatTime(b.start_time)}–${formatTime(b.end_time)}`).join(', ')}
                        </p>
                        {first.reference_code && <p className="text-xs text-ink/40">Ref: {first.reference_code}</p>}
                      </div>
                      <RiskFlags flags={record.risk_flags} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {record.receipt_path && (
                        <button
                          onClick={() => setViewingReceiptPath(record.receipt_path)}
                          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:bg-mist"
                        >
                          View receipt
                        </button>
                      )}
                      <button
                        onClick={() => setApprovingGroupId(groupId)}
                        disabled={busy}
                        className="rounded-lg bg-spark px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-spark/90 disabled:opacity-50"
                      >
                        {busy ? 'Working…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectingGroupId(groupId)}
                        disabled={busy}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <Link
                        to="/admin/bookings?status=pending"
                        className="ml-auto text-xs font-medium text-court underline-offset-2 hover:underline"
                      >
                        Open in Bookings →
                      </Link>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>

          {items.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 w-full rounded-lg border border-line py-2 text-xs font-medium text-ink/60 transition-colors hover:bg-mist"
            >
              {showAll ? 'Show less' : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}

      {viewingReceiptPath && <ReceiptViewerModal path={viewingReceiptPath} onClose={() => setViewingReceiptPath(null)} />}

      {approvingGroupId && (
        <ConfirmModal
          title="Approve this booking?"
          message="The customer will be emailed their confirmation."
          confirmLabel="Approve"
          busy={updatingId === approvingGroupId}
          onCancel={() => setApprovingGroupId(null)}
          onConfirm={() => approve(approvingGroupId)}
        />
      )}

      {rejectingGroupId && (
        <RejectReasonModal
          submitting={updatingId === rejectingGroupId}
          onCancel={() => setRejectingGroupId(null)}
          onConfirm={(reason) => reject(rejectingGroupId, reason)}
        />
      )}
    </section>
  )
}
