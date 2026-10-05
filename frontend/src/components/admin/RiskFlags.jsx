const SEVERITY_STYLES = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
}

// These are advisory hints from a best-effort automated check — never
// a verdict. The label text itself says so; this just renders them.
export default function RiskFlags({ flags }) {
  if (!flags || flags.length === 0) {
    return <span className="text-xs text-ink/30">No flags</span>
  }
  return (
    <div className="flex flex-col gap-1">
      {flags.map((flag, i) => (
        <span
          key={i}
          title="Automated hint only — always confirm by eye"
          className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.low
          }`}
        >
          ⚠ {flag.label}
        </span>
      ))}
    </div>
  )
}
