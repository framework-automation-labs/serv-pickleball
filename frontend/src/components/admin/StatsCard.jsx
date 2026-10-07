import AnimatedNumber from '../AnimatedNumber.jsx'

export default function StatsCard({ label, value, loading, detail, accent = 'court' }) {
  const accentStyles = {
    court: 'bg-court',
    spark: 'bg-spark',
    green: 'bg-emerald-500',
    ink: 'bg-ink',
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className={`absolute inset-y-0 left-0 w-1 ${accentStyles[accent] || accentStyles.court}`} />
      <p className="mb-2 pl-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="pl-2 font-display text-2xl text-ink sm:text-3xl">
        {loading ? '—' : typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      {detail && <p className="mt-1 pl-2 text-xs text-ink/45">{detail}</p>}
    </div>
  )
}
