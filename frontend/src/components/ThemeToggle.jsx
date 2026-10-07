import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'

const DARK_QUERY = '(prefers-color-scheme: dark)'

// The site always starts in whatever mode the visitor's phone or computer is using.
const systemPrefersDark = () => window.matchMedia(DARK_QUERY).matches

const STARS = [
  { left: 9, top: 8, size: 2.5 },
  { left: 21, top: 17, size: 2 },
  { left: 13, top: 21, size: 1.5 },
  { left: 31, top: 8, size: 1.5 },
]

// Floating day/night switch. Light = "Warm sand", dark = "Night court".
// The theme follows the device automatically (on load and live, if the device switches
// between light and dark while the page is open). Tapping the switch only overrides it
// for the current visit; nothing is saved, so the next visit follows the device again.
// The theme change expands as a circle from the switch where the browser supports it,
// and falls back to a soft color crossfade elsewhere.
export default function ThemeToggle() {
  const [dark, setDark] = useState(systemPrefersDark)
  const btnRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  // The switch is only shown on the home page. It stays mounted everywhere so the
  // chosen mode carries over to the other pages — it just isn't visible there.
  const isHome = pathname === '/'

  // Follow the device's light/dark setting live.
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = (e) => setDark(e.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    mq.addListener(onChange) // older Safari
    return () => mq.removeListener(onChange)
  }, [])

  // Remove the saved choice from the earlier version so nobody stays stuck on it.
  useEffect(() => {
    try {
      localStorage.removeItem('serv-theme')
    } catch {
      /* ignore */
    }
  }, [])

  // Keep <html> in sync (admin pages are always light).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark && !isAdmin)
  }, [dark, isAdmin])

  if (isAdmin || !isHome) return null

  function toggle() {
    const next = !dark
    const root = document.documentElement
    const apply = () => {
      root.classList.toggle('dark', next)
      setDark(next)
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      apply()
      return
    }

    if (!document.startViewTransition) {
      root.classList.add('theme-fade')
      apply()
      window.setTimeout(() => root.classList.remove('theme-fade'), 450)
      return
    }

    const rect = btnRef.current.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const transition = document.startViewTransition(() => {
      flushSync(apply)
    })
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => {})
  }

  return (
    <button
      ref={btnRef}
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
      }}
      className="fixed z-50 flex h-11 w-[68px] items-center justify-center rounded-full"
    >
      <span className="relative block h-[30px] w-[60px] overflow-hidden rounded-full bg-[#F3D9C6] shadow-[0_2px_10px_rgba(22,50,79,0.18)] ring-1 ring-[#16324F]/20 dark:ring-white/25">
        {/* night sky fades in over the day track */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 bg-[#0F2438]"
          initial={false}
          animate={{ opacity: dark ? 1 : 0 }}
          transition={{ duration: 0.45 }}
        >
          {STARS.map((star, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white"
              style={{ left: star.left, top: star.top, width: star.size, height: star.size }}
              animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0.3, 1, 0.3] }}
              transition={reduceMotion ? undefined : { duration: 2.2 + i * 0.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </motion.span>

        {/* knob with sun / moon */}
        <motion.span
          className="absolute left-[3px] top-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-[#FFFDFA] shadow-md"
          initial={false}
          animate={{ x: dark ? 30 : 0 }}
          whileTap={{ scaleX: 1.18 }}
          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
        >
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="absolute inset-0 m-auto h-4 w-4"
            fill="none"
            stroke="#E8735C"
            strokeWidth="2"
            strokeLinecap="round"
            initial={false}
            animate={dark ? { rotate: 90, scale: 0.3, opacity: 0 } : { rotate: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <circle cx="12" cy="12" r="4" fill="#E8735C" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </motion.svg>
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="absolute inset-0 m-auto h-4 w-4"
            initial={false}
            animate={dark ? { rotate: 0, scale: 1, opacity: 1 } : { rotate: -60, scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="#16324F" />
          </motion.svg>
        </motion.span>
      </span>
    </button>
  )
}
