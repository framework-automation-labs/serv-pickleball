export default function StatsCard({ label, value, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-line px-5 py-4">
      <p className="text-sm text-ink/50 mb-1">{label}</p>
      <p className="font-display text-2xl text-ink">{loading ? '—' : value}</p>
    </div>
  )
}
