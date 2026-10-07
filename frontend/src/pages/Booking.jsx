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
import { SlotSkeleton } from '../components/Loader.jsx'
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

// Slots ripple in diagonally from the top-left. Taken slots only fade (no movement) so they stay calm.
const gridVariants = {
  hidden: {},
  show: {},
  exit: { opacity: 0, transition: { duration: 0.12 } },
}
const slotVariants = {
  hidden: ({ booked }) => (booked ? { opacity: 0 } : { opacity: 0, y: 8 }),
  show: ({ booked, delay }) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: booked ? 0.25 : 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
}
// One subtle pulse on "Continue" when the bar appears.
const CONTINUE_PULSE = {
  scale: [1, 1.06, 1],
  transition: { delay: 0.4, duration: 0.5, ease: 'easeInOut' },
}

function useGridCols() {
  const query = '(min-width: 640px)'
  const [cols, setCols] = useState(() => (window.matchMedia(query).matches ? 5 : 3))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setCols(e.matches ? 5 : 3)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return cols
}

export default function Booking() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [courts, setCourts] = useState([])
  const [activeCourtId, setActiveCourtId] = useState(null)
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
  const cols = useGridCols()

  useEffect(() => {
    fetchCourts()
      .then((data) => {
        setCourts(data)
        if (data.length) setActiveCourtId(data[0].id)
      })
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

  function toggleHour(hour) {
    if (isHourPast(date, hour, now)) return
    if (isHourBooked(activeCourtId, hour, availability)) return
    setSelections((prev) => {
      const current = prev[activeCourtId] || []
      const updated = current.includes(hour)
        ? current.filter((h) => h !== hour)
        : [...current, hour].sort((a, b) => a - b)
      const next = { ...prev }
      if (updated.length === 0) delete next[activeCourtId]
      else next[activeCourtId] = updated
      return next
    })
  }

  const activeHours = selections[activeCourtId] || []
  const totalHours = Object.values(selections).reduce((sum, hrs) => sum + hrs.length, 0)
  const totalPrice = Object.entries(selections).reduce(
    (sum, [courtId, hrs]) => sum + hrs.length * rateOf(courts.find((c) => c.id === Number(courtId))),
    0,
  )
  const activeCourt = courts.find((c) => c.id === activeCourtId)
  const lowestRate = courts.length ? Math.min(...courts.map(rateOf)) : DEFAULT_RATE
  const hasMixedRates = courts.some((c) => rateOf(c) !== lowestRate)
  const hasSelection = totalHours > 0

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

          <label className="block text-xs font-semibold text-ink/60 uppercase tracking-wide mb-2 mt-5">
            Court
          </label>
          <p className="text-xs text-ink/40 mb-2">
            Tap a court to select its times. You can book more than one court.
          </p>
          <div className="flex gap-2 flex-wrap">
            {courts.map((court) => {
              const count = (selections[court.id] || []).length
              return (
                <button
                  key={court.id}
                  onClick={() => setActiveCourtId(court.id)}
                  className={`relative px-4 py-2 rounded-full text-sm font-semibold font-display bg-mist transition-colors ${
                    activeCourtId === court.id ? 'text-white' : 'text-ink/60 hover:bg-line'
                  }`}
                >
                  {activeCourtId === court.id && (
                    <motion.span
                      layoutId="court-pill"
                      style={{ borderRadius: 9999 }}
                      className="absolute inset-0 bg-court"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{court.name}</span>
                  {rateOf(court) !== lowestRate && (
                    <span className="relative z-10 ml-1.5 text-xs font-medium opacity-70">₱{rateOf(court)}/hr</span>
                  )}
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                      className="relative z-10 ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-spark text-white text-[11px] font-bold"
                    >
                      {count}
                    </motion.span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="bg-card rounded-2xl shadow-sm border border-line p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-ink/60 uppercase tracking-wide">
              Available Times — {activeCourt?.name}
              {activeCourt && <span className="ml-1.5 normal-case tracking-normal text-ink/40">· ₱{rateOf(activeCourt)}/hr</span>}
            </label>
            {activeHours.length > 0 && (
              <button
                onClick={() =>
                  setSelections((prev) => {
                    const next = { ...prev }
                    delete next[activeCourtId]
                    return next
                  })
                }
                className="text-xs font-semibold text-link hover:text-heading"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border-2 border-line bg-card" />Available</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-spark" />Selected</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-line" />Taken / Closed</span>
          </div>
          <p className="text-xs text-ink/40 mb-4">
            Tap as many time slots as you like — they don't need to be back-to-back.
          </p>

          {loading ? (
            <SlotSkeleton />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCourtId}-${date}`}
                variants={gridVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="grid grid-cols-3 sm:grid-cols-5 gap-2"
              >
                {slots.map((hour, i) => {
                  const past = isHourPast(date, hour, now)
                  const booked = past || isHourBooked(activeCourtId, hour, availability)
                  const selected = activeHours.includes(hour)
                  const delay = (Math.floor(i / cols) + (i % cols)) * 0.035
                  return (
                    <motion.button
                      key={hour}
                      variants={slotVariants}
                      custom={{ booked, delay }}
                      whileTap={!booked ? { scale: 0.92 } : {}}
                      disabled={booked}
                      onClick={() => toggleHour(hour)}
                      className={`relative min-h-[44px] py-3 rounded-xl text-sm font-semibold font-display border-2 transition-colors ${
                        booked
                          ? 'bg-line/70 text-ink/30 border-transparent cursor-not-allowed line-through'
                          : selected
                          ? 'bg-spark text-white border-spark shadow-md shadow-spark/30'
                          : 'bg-card text-ink/70 border-line hover:border-court'
                      }`}
                    >
                      <motion.span
                        key={selected ? 'on' : 'off'}
                        initial={selected ? { scale: 0.85 } : false}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                        className="inline-block"
                      >
                        {formatHour(hour)} – {formatHour(hour + 1)}
                      </motion.span>
                      {selected && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                          className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-spark shadow"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
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
            className="fixed bottom-0 left-0 right-0 bg-court-dark px-4 py-4 sm:px-10"
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