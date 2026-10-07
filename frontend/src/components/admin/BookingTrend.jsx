import { motion } from 'motion/react'

// Booked court-hours for each of the last 7 days.
export default function BookingTrend({ days, loading }) {
  const max = Math.max(1, ...days.map((d) => d.hours))
  const total = days.reduce((sum, d) => sum + d.hours, 0)

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-ink">Last 7 days</h2>
          <p className="text-xs text-ink/50">Booked court-hours per day</p>
        </div>
        {!loading && <p className="text-xs text-ink/50">{total} hours total</p>}
      </div>

      {loading ? (
        <div className="skeleton h-36 rounded-xl" />
      ) : (
        <div className="flex h-36 items-end gap-2">
          {days.map((day, i) => (
            <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-medium text-ink/60">{day.hours}</span>
              <motion.div
                className={`w-full origin-bottom rounded-t-md ${day.isToday ? 'bg-spark' : 'bg-court/70'}`}
                style={{ height: `${Math.max(4, (day.hours / max) * 100)}%`, minHeight: 4 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className={`text-[11px] ${day.isToday ? 'font-semibold text-spark' : 'text-ink/40'}`}>{day.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
