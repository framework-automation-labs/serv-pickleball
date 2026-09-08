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

const RATE_PER_HOUR = 300

function todayISO() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
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
  const [selectedCourtId, setSelectedCourtId] = useState(null)
  const [availability, setAvailability] = useState([])
  const [rangeStart, setRangeStart] = useState(null)
  const [rangeEnd, setRangeEnd] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const slots = useMemo(() => generateHourSlots(), [])

  useEffect(() => {
    fetchCourts()
      .then((data) => {
        setCourts(data)
        if (data.length) setSelectedCourtId(data[0].id)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    setLoading(true)
    setRangeStart(null)
    setRangeEnd(null)
    fetchAvailability(date)
      .then(setAvailability)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [date])

  function clearSelection() {
    setRangeStart(null)
    setRangeEnd(null)
  }

  function handleSlotClick(hour) {
    if (isHourBooked(selectedCourtId, hour, availability)) return

    if (rangeStart === hour && rangeEnd === hour) {
      clearSelection()
      return
    }

    if (rangeStart === null || hour < rangeStart) {
      setRangeStart(hour)
      setRangeEnd(hour)
      return
    }

    for (let h = rangeStart; h <= hour; h++) {
      if (isHourBooked(selectedCourtId, h, availability)) {
        setRangeStart(hour)
        setRangeEnd(hour)
        return
      }
    }
    setRangeEnd(hour)
  }

  function isInRange(hour) {
    if (rangeStart === null || rangeEnd === null) return false
    return hour >= rangeStart && hour <= rangeEnd
  }

  const durationHours = rangeStart !== null ? rangeEnd - rangeStart + 1 : 0
  const totalPrice = durationHours * RATE_PER_HOUR

  function handleContinue() {
    navigate('/details', {
      state: {
        courtId: selectedCourtId,
        courtName: courts.find((c) => c.id === selectedCourtId)?.name,
        date,
        startHour: rangeStart,
        endHour: rangeEnd + 1,
        durationHours,
        totalPrice,
      },
    })
  }

  return (
    <div className="min-h-screen bg-mist pb-32">
      <div className="relative bg-court-dark px-6 py-8 sm:px-10">
        <BackButton variant="light" className="mb-4" to="/" />
        <img
          src="/serv-logo.png"
          alt="SERV Pickleball Club"
          className="absolute top-4 right-4 sm:top-6 sm:right-8 h-8 sm:h-20"
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
          <div className="flex gap-2 flex-wrap">
            {courts.map((court) => (
              <button
                key={court.id}
                onClick={() => {
                  setSelectedCourtId(court.id)
                  clearSelection()
                }}
                className={`px-4 py-2 rounded-full text-sm font-semibold font-display transition-colors ${
                  selectedCourtId === court.id
                    ? 'bg-court text-white'
                    : 'bg-mist text-ink/60 hover:bg-line'
                }`}
              >
                {court.name}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="bg-white rounded-2xl shadow-sm border border-line p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-xs font-semibold text-ink/60 uppercase tracking-wide">
              Available Times
            </label>
            {durationHours > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs font-semibold text-court hover:text-court-dark"
              >
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-ink/40 text-sm py-6 text-center">Loading availability…</p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedCourtId}-${date}`}
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-3 sm:grid-cols-5 gap-2"
              >
                {slots.map((hour) => {
                  const booked = isHourBooked(selectedCourtId, hour, availability)
                  const selected = isInRange(hour)
                  return (
                    <motion.button
                      key={hour}
                      variants={slotVariants}
                      whileTap={!booked ? { scale: 0.92 } : {}}
                      disabled={booked}
                      onClick={() => handleSlotClick(hour)}
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
      </div>

      <AnimatePresence>
        {durationHours > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-0 left-0 right-0 bg-court-dark px-4 py-4 sm:px-10"
          >
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-court-light text-sm">
                  {formatHour(rangeStart)} – {formatHour(rangeEnd + 1)} · {durationHours}{' '}
                  {durationHours === 1 ? 'hour' : 'hours'}
                </p>
                <p className="text-xl font-display font-bold text-white">₱{totalPrice}</p>
              </div>
              <button
                onClick={handleContinue}
                className="bg-spark text-white font-display font-semibold px-8 py-3 rounded-full hover:brightness-110 active:scale-[0.98] transition-all"
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