export function BallLoader({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10" role="status" aria-label={label}>
      <span className="ball block h-5 w-5 rounded-full bg-spark" />
      <span className="h-1 w-8 rounded-full bg-ink/10" />
    </div>
  )
}

export function SlotSkeleton({ count = 15 }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-11 rounded-xl" />
      ))}
    </div>
  )
}

export function TimetableSkeleton({ cols = 4, rows = 8 }) {
  const gridStyle = { gridTemplateColumns: `3.5rem repeat(${cols}, minmax(0, 1fr))` }
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid items-center gap-2" style={gridStyle}>
          <div className="skeleton ml-auto h-3 w-10 rounded" />
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton h-11 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}
