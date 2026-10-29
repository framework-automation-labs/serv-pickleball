import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCourts,
  fetchAvailability,
  generateHourSlots,
  formatHour,
  isHourBooked,
  isHourPast,
  manilaNow,
} from '../lib/api'
import BackButton from '../components/BackButton.jsx'
import DatePicker from '../components/DatePicker.jsx'
import PolicyNotice from '../components/PolicyNotice.jsx'
import StepProgress from '../components/StepProgress.jsx'
import { TimetableSkeleton } from '../components/Loader.jsx'
import AnimatedNumber from '../components/AnimatedNumber.jsx'

const assetUrl = (name) => `${import.meta.env.BASE_URL}${name}`

const DEFAULT_RATE = 300 // used only if a court has no rate set

const rateOf = (court) => Number(court?.rate_per_hour) || DEFAULT_RATE

function todayISO() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

function groupHours(hours) {
  const sorted = [...hours].sort((a, b) => a - b)
  const blocks = []
  let start = null
  let prev = null
  for (const h of sorted) {
    if (start === null) {
      start = h
      prev = h
      continue
    }
    if (h === prev + 1) {
      prev = h
      continue
    }
    blocks.push({ start, end: prev + 1 })
    start = h
    prev = h
  }
  if (start !== null) blocks.push({ start, end: prev + 1 })
  return blocks
}

// One subtle pulse on "Continue" when the bar appears.
const CONTINUE_PULSE = {
  scale: [1, 1.06, 1],
  transition: { delay: 0.4, duration: 0.5, ease: 'easeInOut' },
}

export default function Booking() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [courts, setCourts] = useState([])
  const [availability, setAvailability] = useState([])
  const [selections, setSelections] = useState({}) // { [courtId]: number[] }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const slots = useMemo(() => generateHourSlots(), [])
  // Re-checked every 30s so slots close on their own while the page is open.
  const [now, setNow] = useState(manilaNow)
  useEffect(() => {
    const t = setInterval(() => setNow(manilaNow()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetchCourts()
      .then(setCourts)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    setLoading(true)
    setSelections({})
    fetchAvailability(date)
      .then(setAvailability)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [date])

  // Drop any selected hour that has just passed.
  useEffect(() => {
    setSelections((prev) => {
      let changed = false
      const next = {}
      for (const [courtId, hrs] of Object.entries(prev)) {
        const keep = hrs.filter((h) => !isHourPast(date, h, now))
        if (keep.length !== hrs.length) changed = true
        if (keep.length) next[courtId] = keep
      }
      return changed ? next : prev
    })
  }, [now, date])

  function toggleHour(courtId, hour) {
    if (isHourPast(date, hour, now)) return
    if (isHourBooked(courtId, hour, availability)) return
    setSelections((prev) => {
      const current = prev[courtId] || []
      const updated = current.includes(hour)
        ? current.filter((h) => h !== hour)
        : [...current, hour].sort((a, b) => a - b)
      const next = { ...prev }
      if (updated.length === 0) delete next[courtId]
      else next[courtId] = updated
      return next
    })
  }

  const totalHours = Object.values(selections).reduce((sum, hrs) => sum + hrs.length, 0)
  const totalPrice = Object.entries(selections).reduce(
    (sum, [courtId, hrs]) => sum + hrs.length * rateOf(courts.find((c) => c.id === Number(courtId))),
    0,
  )
  const lowestRate = courts.length ? Math.min(...courts.map(rateOf)) : DEFAULT_RATE
  const hasMixedRates = courts.some((c) => rateOf(c) !== lowestRate)
  const hasSelection = totalHours > 0
  // Times are rows, courts are columns — same layout as the admin schedule, no sideways scrolling.
  const gridStyle = { gridTemplateColumns: `3.5rem repeat(${courts.length || 4}, minmax(0, 1fr))` }

  function handleContinue() {
    const bookings = Object.entries(selections).flatMap(([courtId, hours]) => {
      const court = courts.find((c) => c.id === Number(courtId))
      return groupHours(hours).map((block) => ({
        courtId: Number(courtId),
        courtName: court?.name,
        date,
        startHour: block.start,
        endHour: block.end,
        hours: block.end - block.start,
      }))
    })

    // Show the bookings in the order they'll be played (date, then time), not grouped by court.
    bookings.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startHour - b.startHour || a.courtId - b.courtId,
    )

    navigate('/details', {
      state: { date, bookings, totalHours, totalPrice },
    })
  }

  return (
    <div className="min-h-screen bg-mist pb-32">
      <div className="relative bg-court-dark px-6 py-8 sm:px-10">
        <BackButton variant="light" className="mb-4" to="/" />
        <img
          src={assetUrl('serv-logo.png')}
          alt="SERV Pickleball Club"
          className="absolute top-4 right-4 sm:top-6 sm:right-8 h-8 sm:h-10"
        />
        <h1 className="font-display font-bold text-3xl text-white mb-1">Book a Court</h1>
        <p className="mb-5 text-court-light">
          {hasMixedRates ? 'From ' : ''}₱{lowestRate}/hr · 9:00 AM – 12:00 Midnight
        </p>
        <div className="max-w-md"><StepProgress current={1} dark /></div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 mt-6">
        <div className="bg-card rounded-2xl shadow-sm border border-line p-4 sm:p-6 mb-6">
          <label className="block text-xs font-semibold text-ink/60 uppercase tracking-wide mb-2">
            Date
          </label>
          <DatePicker value={date} onChange={setDate} />
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="bg-card rounded-2xl shadow-sm border border-line p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-ink/60 uppercase tracking-wide">
              Available Times
            </label>
            {hasSelection && (
              <button
                onClick={() => setSelections({})}
                className="text-xs font-semibold text-link hover:text-heading"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border-2 border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/60" />Available</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-spark" />Selected</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border-2 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/60" />Taken</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-line" />Closed</span>
          </div>
          <p className="text-xs text-ink/40 mb-4">
            Tap any open slot to pick it. You can book several hours and more than one court — they don't need to be back-to-back.
          </p>

          {loading || courts.length === 0 ? (
            <TimetableSkeleton cols={courts.length || 4} />
          ) : (
            <div role="group" aria-label="Court timetable" key={date}>
              {/* Court names stay pinned while the times scroll underneath. */}
              <div
                className="sticky top-0 z-10 -mx-3 grid items-end gap-2 bg-card px-3 pb-2 pt-1 shadow-[0_6px_6px_-6px_rgb(0_0_0/0.15)]"
                style={gridStyle}
              >
                <span />
                {courts.map((court) => {
                  const count = (selections[court.id] || []).length
                  return (
                    <div key={court.id} className="flex min-w-0 flex-col items-center text-center" title={court.name}>
                      <span className="font-display text-xs font-semibold leading-tight text-ink sm:text-sm">
                        {court.name}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium leading-none text-ink/45 sm:text-xs">
                        ₱{rateOf(court)}/hr
                      </span>
                      <span className="mt-1 flex h-4 items-center">
                        {count > 0 && (
                          <motion.span
                            key={count}
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-spark px-1 text-[10px] font-bold text-white"
                          >
                            {count}
                          </motion.span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-1.5">
                {slots.map((hour, rowIndex) => {
                  const past = isHourPast(date, hour, now)
                  return (
                    <motion.div
                      key={hour}
                      className="grid items-center gap-2"
                      style={gridStyle}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: rowIndex * 0.02, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span
                        className={`-ml-2 flex flex-col items-start text-[10px] font-semibold leading-[1.15] sm:ml-0 sm:text-[11px] ${
                          past ? 'text-ink/25' : 'text-ink/60'
                        }`}
                      >
                        <span>{formatHour(hour)}</span>
                        <span className="font-normal text-ink/35">to</span>
                        <span>{formatHour(hour + 1)}</span>
                      </span>
                      {courts.map((court) => {
                        const taken = !past && isHourBooked(court.id, hour, availability)
                        const booked = past || taken
                        const selected = (selections[court.id] || []).includes(hour)
                        const label = `${court.name}, ${formatHour(hour)} to ${formatHour(hour + 1)}, ${
                          booked ? (past ? 'closed' : 'taken') : selected ? 'selected' : 'available'
                        }`
                        return (
                          <motion.button
                            key={court.id}
                            type="button"
                            whileTap={!booked ? { scale: 0.92 } : {}}
                            disabled={booked}
                            aria-pressed={booked ? undefined : selected}
                            aria-label={label}
                            onClick={() => toggleHour(court.id, hour)}
                            className={`relative flex h-11 items-center justify-center rounded-lg border-2 text-[10px] font-semibold transition-colors sm:text-xs ${
                              past
                                ? 'cursor-not-allowed border-transparent bg-line/70'
                                : taken
                                ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-600 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300'
                                : selected
                                ? 'border-spark bg-spark text-sm font-bold text-white shadow-md shadow-spark/30'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:border-emerald-500'
                            }`}
                          >
                            {taken && 'Taken'}
                            {!booked && !selected && 'Available'}
                            {selected && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                                aria-hidden="true"
                              >
                                ✓
                              </motion.span>
                            )}
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <PolicyNotice />
      </div>

      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-court-dark px-4 py-4 sm:px-10"
          >
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-court-light text-sm truncate">
                  {totalHours} {totalHours === 1 ? 'hour' : 'hours'} across{' '}
                  {Object.keys(selections).length}{' '}
                  {Object.keys(selections).length === 1 ? 'court' : 'courts'}
                </p>
                <p className="text-xl font-display font-bold text-white tabular-nums">
                  ₱<AnimatedNumber value={totalPrice} />
                </p>
              </div>
              <motion.button
                onClick={handleContinue}
                animate={CONTINUE_PULSE}
                whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
                className="flex-shrink-0 bg-spark text-white font-display font-semibold px-8 py-3 rounded-full hover:brightness-110 transition-[filter]"
              >
                Continue
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}