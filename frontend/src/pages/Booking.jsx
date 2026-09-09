import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCourts,
  fetchAvailability,
  generateHourSlots,
  formatHour,
  isHourBooked,
} from '../lib/api'
import BackButton from '../components/BackButton.jsx'
import DatePicker from '../components/DatePicker.jsx'
import PolicyNotice from '../components/PolicyNotice.jsx'

const RATE_PER_HOUR = 300

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

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
}
const slotVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
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

  function toggleHour(hour) {
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
  const totalPrice = totalHours * RATE_PER_HOUR
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

    navigate('/details', {
      state: { date, bookings, totalHours, totalPrice },
    })
  }

  return (
    <div className="min-h-screen bg-mist pb-32">
      <div className="relative bg-court-dark px-6 py-8 sm:px-10">
        <BackButton variant="light" className="mb-4" to="/" />
        <img
          src="/serv-logo.png"
          alt="SERV Pickleball Club"
          className="absolute top-4 right-4 sm:top-6 sm:right-8 h-8 sm:h-10"
        />
        <h1 className="font-display font-bold text-3xl text-white mb-1">Book a Court</h1>
        <p className="text-court-light">₱{RATE_PER_HOUR}/hr · 9:00 AM – 12:00 Midnight</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-line p-4 sm:p-6 mb-6">
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
                  className={`relative px-4 py-2 rounded-full text-sm font-semibold font-display transition-colors ${
                    activeCourtId === court.id
                      ? 'bg-court text-white'
                      : 'bg-mist text-ink/60 hover:bg-line'
                  }`}
                >
                  {court.name}
                  {count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-spark text-white text-[11px] font-bold">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="bg-white rounded-2xl shadow-sm border border-line p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-ink/60 uppercase tracking-wide">
              Available Times — {courts.find((c) => c.id === activeCourtId)?.name}
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
                className="text-xs font-semibold text-court hover:text-court-dark"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-ink/40 mb-4">
            Tap as many time slots as you like — they don't need to be back-to-back.
          </p>

          {loading ? (
            <p className="text-ink/40 text-sm py-6 text-center">Loading availability…</p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCourtId}-${date}`}
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-3 sm:grid-cols-5 gap-2"
              >
                {slots.map((hour) => {
                  const booked = isHourBooked(activeCourtId, hour, availability)
                  const selected = activeHours.includes(hour)
                  return (
                    <motion.button
                      key={hour}
                      variants={slotVariants}
                      whileTap={!booked ? { scale: 0.92 } : {}}
                      disabled={booked}
                      onClick={() => toggleHour(hour)}
                      className={`py-3 rounded-xl text-sm font-semibold font-display border-2 transition-colors ${
                        booked
                          ? 'bg-mist text-ink/20 border-mist cursor-not-allowed line-through'
                          : selected
                          ? 'bg-spark text-white border-spark shadow-md shadow-spark/30'
                          : 'bg-white text-ink/70 border-line hover:border-court'
                      }`}
                    >
                      {formatHour(hour)}
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
            className="fixed bottom-0 left-0 right-0 bg-court-dark px-4 py-4 sm:px-10"
          >
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-court-light text-sm truncate">
                  {totalHours} {totalHours === 1 ? 'hour' : 'hours'} across{' '}
                  {Object.keys(selections).length}{' '}
                  {Object.keys(selections).length === 1 ? 'court' : 'courts'}
                </p>
                <p className="text-xl font-display font-bold text-white">₱{totalPrice}</p>
              </div>
              <button
                onClick={handleContinue}
                className="flex-shrink-0 bg-spark text-white font-display font-semibold px-8 py-3 rounded-full hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}