import { useState } from 'react'
import { motion } from 'motion/react'
import { generateHourSlots, isHourPast } from '../../lib/api.js'
import {
  RESCHEDULE_MIN_HOURS,
  canReschedule,
  endHour,
  formatDay,
  formatHourShort,
  formatTime,
  localDateString,
  startHour,
} from './adminUtils.js'

const CELL_STYLES = {
  free: 'bg-mist border border-line/70',
  pending: 'bg-amber-100 border border-amber-300 text-amber-700',
  confirmed: 'bg-court border border-court text-white',
  blocked: 'bg-line/80 border border-line',
}

const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed' }

const hourLabel = (h) => formatTime(`${String(h % 24).padStart(2, '0')}:00:00`)

// One day at a glance: one row per active court, one cell per opening hour.
// Also hosts the reschedule flow:  Reschedule → pick a booked block → pick a free
// start time (optionally on another date) → confirm.
export default function CourtTimeline({ courts, bookings, blocked, date, loading, onDateChange, onReschedule }) {
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('off') // 'off' | 'pick' | 'place'
  const [moving, setMoving] = useState(null) // the booking row being moved
  const [target, setTarget] = useState(null) // { courtId, startHour }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const hours = generateHourSlots()
  const isToday = date === localDateString()
  const nowHour = isToday ? new Date().getHours() : -1
  const rescheduling = mode !== 'off'
  const duration = moving ? endHour(moving.end_time) - startHour(moving.start_time) : 0

  function cellFor(courtId, hour) {
    const booking = bookings.find(
      (b) => b.court_id === courtId && hour >= startHour(b.start_time) && hour < endHour(b.end_time),
    )
    if (booking) return { type: booking.status === 'pending' ? 'pending' : 'confirmed', booking }
    const isBlocked = blocked.some(
      (b) => b.court_id === courtId && hour >= startHour(b.start_time) && hour < endHour(b.end_time),
    )
    return { type: isBlocked ? 'blocked' : 'free' }
  }

  // Can the moving block start at `hour` on this court (on the date being shown)?
  // Its own current slot counts as free, so it can be nudged within itself.
  function isValidStart(courtId, hour) {
    if (!moving || hour + duration > 24) return false
    if (courtId === moving.court_id && date === moving.booking_date && hour === startHour(moving.start_time)) return false
    for (let h = hour; h < hour + duration; h++) {
      if (isHourPast(date, h)) return false
      const cell = cellFor(courtId, h)
      if (cell.type === 'blocked') return false
      if (cell.booking && cell.booking.id !== moving.id) return false
    }
    return true
  }

  const inTarget = (courtId, hour) =>
    target && target.courtId === courtId && hour >= target.startHour && hour < target.startHour + duration

  function startReschedule(booking = null) {
    setNotice('')
    setError('')
    setSelectedId(null)
    setTarget(null)
    setMoving(booking)
    setMode(booking ? 'place' : 'pick')
  }

  function exitReschedule() {
    setMode('off')
    setMoving(null)
    setTarget(null)
    setError('')
  }

  function changeDate(next) {
    if (!next) return
    setTarget(null)
    onDateChange?.(next)
  }

  async function confirmMove() {
    setBusy(true)
    setError('')
    try {
      await onReschedule(moving, { courtId: target.courtId, date, startHour: target.startHour })
      const courtName = courts.find((c) => c.id === target.courtId)?.name
      setNotice(
        `Moved ${moving.guest_name || 'booking'} to ${courtName}, ${formatDay(date)}, ${hourLabel(target.startHour)} – ${hourLabel(target.startHour + duration)}.`,
      )
      exitReschedule()
    } catch (err) {
      setError(err.message || 'Could not reschedule this booking.')
    }
    setBusy(false)
  }

  const selected = bookings.find((b) => b.id === selectedId) || null
  const gridStyle = { gridTemplateColumns: `6.5rem repeat(${hours.length}, minmax(2.25rem, 1fr))` }
  const eligibleCount = bookings.filter((b) => canReschedule(b)).length

  const fromCourt = moving ? courts.find((c) => c.id === moving.court_id) : null
  const toCourt = target ? courts.find((c) => c.id === target.courtId) : null
  const rateChanged =
    fromCourt && toCourt && Number(fromCourt.rate_per_hour) !== Number(toCourt.rate_per_hour)

  return (
    <section className="mb-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink">{isToday ? "Today's courts" : 'Court schedule'}</h2>
          <p className="text-xs text-ink/50">
            {formatDay(date)} · {rescheduling ? 'rescheduling' : 'tap a booked hour for details'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
            {[
              ['free', 'Free'],
              ['pending', 'Pending'],
              ['confirmed', 'Confirmed'],
              ['blocked', 'Blocked'],
            ].map(([type, label]) => (
              <li key={type} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${CELL_STYLES[type]}`} />
                {label}
              </li>
            ))}
          </ul>
          {onReschedule && (
            <button
              type="button"
              onClick={() => (rescheduling ? exitReschedule() : startReschedule())}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                rescheduling
                  ? 'border border-line bg-white text-ink/70 hover:bg-mist'
                  : 'bg-spark text-white hover:bg-spark/90'
              }`}
            >
              {rescheduling ? 'Cancel reschedule' : 'Reschedule'}
            </button>
          )}
        </div>
      </div>

      {notice && !rescheduling && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      )}

      {mode === 'pick' && (
        <div className="mb-4 rounded-xl border border-spark/30 bg-spark/5 px-4 py-3 text-sm text-ink/80">
          <p className="font-medium text-ink">Step 1 · Pick the booked time slot to move</p>
          <p className="text-xs text-ink/60">
            Highlighted slots can be rescheduled. Bookings starting in less than {RESCHEDULE_MIN_HOURS} hours (or
            already finished) can't be moved.
            {eligibleCount === 0 && !loading && ' None on this date can be moved.'}
          </p>
        </div>
      )}

      {mode === 'place' && moving && (
        <div className="mb-4 rounded-xl border border-spark/30 bg-spark/5 p-4 text-sm">
          <p className="font-medium text-ink">Step 2 · Pick the new time</p>
          <p className="mt-0.5 text-ink/70">
            Moving <span className="font-medium text-ink">{moving.guest_name || 'booking'}</span> ·{' '}
            {moving.courts?.name}, {formatDay(moving.booking_date)}, {formatTime(moving.start_time)} –{' '}
            {formatTime(moving.end_time)} ({duration}h)
          </p>
          <p className="mt-0.5 text-xs text-ink/50">
            Tap a highlighted green start time — it needs {duration} free {duration === 1 ? 'hour' : 'hours'} in a row.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="resched-date" className="mb-1 block text-xs font-medium text-ink/50">
                Move to date
              </label>
              <input
                id="resched-date"
                type="date"
                value={date}
                min={localDateString()}
                onChange={(e) => changeDate(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              />
            </div>
            <button
              type="button"
              onClick={() => startReschedule()}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-mist"
            >
              Pick a different booking
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-40 rounded-xl" />
      ) : courts.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/50">No active courts to show.</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[720px] space-y-1.5">
            <div className="grid items-end gap-1" style={gridStyle}>
              <span />
              {hours.map((h) => (
                <span
                  key={h}
                  className={`text-center text-[11px] font-medium ${h === nowHour ? 'text-spark' : 'text-ink/40'}`}
                >
                  {formatHourShort(h)}
                  <span className={`mx-auto mt-0.5 block h-1 w-1 rounded-full ${h === nowHour ? 'bg-spark' : 'bg-transparent'}`} />
                </span>
              ))}
            </div>

            {courts.map((court, rowIndex) => (
              <motion.div
                key={court.id}
                className="grid items-center gap-1"
                style={gridStyle}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: rowIndex * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="truncate pr-2 text-sm font-medium text-ink">{court.name}</span>
                {hours.map((h) => {
                  const cell = cellFor(court.id, h)
                  const label = `${court.name} ${formatHourShort(h)} ${cell.type}`
                  const isSelected = cell.booking && cell.booking.id === selectedId
                  const baseCls = `h-9 rounded-md text-[11px] font-semibold ${CELL_STYLES[cell.type]}`

                  // ----- Step 1: pick a booked block -----
                  if (mode === 'pick' && cell.booking) {
                    const ok = canReschedule(cell.booking)
                    return ok ? (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setMoving(cell.booking)
                          setTarget(null)
                          setMode('place')
                        }}
                        className={`${baseCls} animate-pulse ring-2 ring-spark ring-offset-1 transition-transform hover:scale-105`}
                        aria-label={`${label}, ${cell.booking.guest_name || 'guest'} — tap to reschedule`}
                      >
                        {(cell.booking.guest_name || '?').slice(0, 1).toUpperCase()}
                      </button>
                    ) : (
                      <div
                        key={h}
                        className={`${baseCls} flex cursor-not-allowed items-center justify-center opacity-35`}
                        title={`Can't reschedule — starts in less than ${RESCHEDULE_MIN_HOURS} hours or is finished`}
                        aria-label={`${label}, can't be rescheduled`}
                      >
                        {(cell.booking.guest_name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )
                  }

                  // ----- Step 2: pick the new start time -----
                  if (mode === 'place') {
                    if (cell.booking && cell.booking.id === moving.id) {
                      return (
                        <div
                          key={h}
                          className={`${baseCls} flex items-center justify-center outline-dashed outline-2 outline-offset-1 outline-spark`}
                          aria-label={`${label}, current slot`}
                        >
                          {(cell.booking.guest_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )
                    }
                    if (inTarget(court.id, h)) {
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setTarget(null)}
                          className="h-9 rounded-md border border-spark bg-spark text-[11px] font-semibold text-white"
                          aria-label={`${label}, new slot — tap to clear`}
                        >
                          ✓
                        </button>
                      )
                    }
                    if (!cell.booking && isValidStart(court.id, h)) {
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setTarget({ courtId: court.id, startHour: h })}
                          className="h-9 rounded-md border border-emerald-400 bg-emerald-50 text-[13px] font-semibold text-emerald-700 ring-2 ring-emerald-300/70 transition-transform hover:scale-105 hover:bg-emerald-100"
                          aria-label={`${label}, move here starting ${formatHourShort(h)}`}
                        >
                          +
                        </button>
                      )
                    }
                    return (
                      <div key={h} className={`${baseCls} flex items-center justify-center opacity-45`} aria-label={label}>
                        {cell.booking ? (cell.booking.guest_name || '?').slice(0, 1).toUpperCase() : ''}
                      </div>
                    )
                  }

                  // ----- Normal view -----
                  const cls = `${baseCls} ${isSelected ? 'ring-2 ring-spark ring-offset-1' : ''}`
                  if (!cell.booking) {
                    return <div key={h} className={cls} aria-label={label} />
                  }
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSelectedId(isSelected ? null : cell.booking.id)}
                      className={`${cls} transition-transform hover:scale-105`}
                      aria-label={`${label}, ${cell.booking.guest_name || 'guest'}`}
                    >
                      {(cell.booking.guest_name || '?').slice(0, 1).toUpperCase()}
                    </button>
                  )
                })}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm the move */}
      {mode === 'place' && moving && target && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl bg-mist px-4 py-3"
        >
          <p className="text-sm text-ink/80">
            <span className="font-medium text-ink">{moving.guest_name || 'Booking'}</span> will move from{' '}
            <span className="font-medium">
              {moving.courts?.name}, {formatDay(moving.booking_date)}, {formatTime(moving.start_time)} –{' '}
              {formatTime(moving.end_time)}
            </span>{' '}
            to{' '}
            <span className="font-medium text-ink">
              {toCourt?.name}, {formatDay(date)}, {hourLabel(target.startHour)} – {hourLabel(target.startHour + duration)}
            </span>
            .
          </p>
          {rateChanged && (
            <p className="mt-1 text-xs text-amber-700">
              This court's rate differs (₱{Number(fromCourt.rate_per_hour)} → ₱{Number(toCourt.rate_per_hour)}/hr). The
              amount the customer already paid stays the same.
            </p>
          )}
          {moving.guest_email && <p className="mt-1 text-xs text-ink/50">The customer will be emailed about the change.</p>}
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmMove}
              disabled={busy}
              className="rounded-lg bg-spark px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-spark/90 disabled:opacity-50"
            >
              {busy ? 'Moving…' : 'Confirm reschedule'}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
              disabled={busy}
              className="rounded-lg border border-line bg-white px-4 py-1.5 text-sm font-medium text-ink/70 hover:bg-mist disabled:opacity-50"
            >
              Choose another time
            </button>
          </div>
        </motion.div>
      )}

      {mode === 'place' && !target && error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Normal-view booking details */}
      {mode === 'off' && selected && (
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist px-4 py-3"
        >
          <div className="text-sm">
            <p className="font-medium text-ink">
              {selected.guest_name || '—'}
              <span className="ml-2 font-normal text-ink/50">{selected.guest_phone}</span>
            </p>
            <p className="text-ink/70">
              {selected.courts?.name}: {formatTime(selected.start_time)} – {formatTime(selected.end_time)} ·{' '}
              {STATUS_LABELS[selected.status] || selected.status}
              {selected.reference_code ? ` · Ref ${selected.reference_code}` : ''}
            </p>
          </div>
          {onReschedule &&
            (canReschedule(selected) ? (
              <button
                type="button"
                onClick={() => startReschedule(selected)}
                className="rounded-lg border border-spark px-3 py-1.5 text-xs font-medium text-spark hover:bg-spark/5"
              >
                Reschedule this booking
              </button>
            ) : (
              <span className="text-xs text-ink/40">
                Can't be rescheduled (needs {RESCHEDULE_MIN_HOURS}+ hours before start)
              </span>
            ))}
        </motion.div>
      )}
    </section>
  )
}
