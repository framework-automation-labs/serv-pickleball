import { motion } from 'motion/react'

const STEPS = ['Select', 'Details', 'Pay']
const EASE = [0.22, 1, 0.36, 1]

export default function StepProgress({ current = 1, dark = false }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        const done = i + 1 < current
        const active = i + 1 === current
        // The connector we just crossed to arrive on this page: the ball rolls along it.
        const justDone = i + 2 === current
        const arrived = active && current > 1
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <motion.span
              animate={arrived ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.35, delay: 0.5, ease: 'easeOut' }}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                done || active ? 'bg-spark text-white' : dark ? 'bg-white/15 text-white/60' : 'bg-line text-ink/50'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : i + 1}
            </motion.span>
            <span className={`text-xs font-semibold ${active ? (dark ? 'text-white' : 'text-ink') : dark ? 'text-white/50' : 'text-ink/40'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`relative h-0.5 flex-1 rounded ${dark ? 'bg-white/15' : 'bg-line'}`}>
                <motion.span
                  className="absolute inset-y-0 left-0 rounded bg-spark"
                  initial={{ width: done && !justDone ? '100%' : '0%' }}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.5, delay: justDone ? 0.1 : 0, ease: EASE }}
                />
                {justDone && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute top-1/2 -mt-1 -ml-1 h-2 w-2 rounded-full bg-spark shadow shadow-spark/40"
                    initial={{ left: '0%', y: 0, opacity: 0 }}
                    animate={{ left: '100%', y: [0, -8, 0], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
                  />
                )}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
