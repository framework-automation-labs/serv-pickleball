import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toISO(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date(value + 'T00:00:00')))
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const thisMonthStart = startOfMonth(today)
  const selectedDate = new Date(value + 'T00:00:00')

  const firstDay = startOfMonth(viewDate)
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const startOffset = firstDay.getDay()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))

  const canGoPrev = !isSameMonth(viewDate, thisMonthStart)

  function goPrevMonth() {
    if (canGoPrev) setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }
  function goNextMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }
  function handlePick(d) {
    onChange(toISO(d))
    setOpen(false)
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-line rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:border-court transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
        {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 mt-2 bg-white rounded-xl shadow-lg border border-line p-4 w-72"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={goPrevMonth}
                disabled={!canGoPrev}
                className="p-1 rounded-full hover:bg-mist disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous month"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="font-display font-semibold text-sm text-ink">{monthLabel}</p>
              <button onClick={goNextMonth} className="p-1 rounded-full hover:bg-mist" aria-label="Next month">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <p key={w} className="text-center text-[10px] font-semibold text-ink/40 uppercase">
                  {w}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const disabled = d < todayStart
                const isSelected = toISO(d) === value
                const isToday = toISO(d) === toISO(today)
                return (
                  <button
                    key={i}
                    disabled={disabled}
                    onClick={() => handlePick(d)}
                    className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                      disabled
                        ? 'text-ink/20 cursor-not-allowed'
                        : isSelected
                        ? 'bg-court text-white font-semibold'
                        : isToday
                        ? 'bg-mist text-court font-semibold'
                        : 'text-ink/70 hover:bg-mist'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}