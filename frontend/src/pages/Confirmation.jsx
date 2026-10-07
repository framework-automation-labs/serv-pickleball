import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { BallLoader } from '../components/Loader.jsx'
import { API_URL, fetchBookingStatus, formatHour } from '../lib/api'

const STATUS_COPY = {
  pending: {
    title: 'Under Review',
    color: 'text-amber-600',
    body: "We've received your receipt. An admin will confirm your booking shortly",
  },
  confirmed: {
    title: 'Booking Confirmed!',
    color: 'text-green-600',
    body: 'Your payment has been verified. Download your receipt below and bring it to the courts.',
  },
  rejected: {
    title: "We Couldn't Confirm This Booking",
    color: 'text-red-600',
    body: 'Please contact the club or submit a new booking with a valid receipt.',
  },
}

const TONES = {
  pending: { bg: 'bg-amber-100', ring: 'bg-amber-400', stroke: '#D97706' },
  confirmed: { bg: 'bg-green-100', ring: 'bg-green-400', stroke: '#16A34A' },
  rejected: { bg: 'bg-red-100', ring: 'bg-red-400', stroke: '#DC2626' },
}

const draw = (delay = 0.15, duration = 0.5) => ({
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { duration, delay, ease: 'easeOut' },
})

// Animated status badge: pulsing ring while pending, drawn check + ball bounce when confirmed.
function StatusIcon({ status }) {
  const tone = TONES[status] || TONES.pending
  const confirmed = status === 'confirmed'
  return (
    <div className="relative mx-auto mb-4 h-16 w-16" aria-hidden="true">
      {status === 'pending' && (
        <motion.span
          className={`absolute inset-0 rounded-full ${tone.ring}`}
          animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <motion.div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${tone.bg}`}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={confirmed ? { scale: 1, opacity: 1, y: [0, -14, 0] } : { scale: 1, opacity: 1 }}
        transition={{
          scale: { type: 'spring', stiffness: 420, damping: 18 },
          opacity: { duration: 0.2 },
          y: { delay: 0.8, duration: 0.5, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] },
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke={tone.stroke}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {status === 'confirmed' && <motion.path d="M5 12.5l4.5 4.5L19 7.5" {...draw(0.25, 0.45)} />}
          {status === 'rejected' && <motion.path d="M7 7l10 10M17 7L7 17" {...draw(0.25, 0.4)} />}
          {status === 'pending' && (
            <>
              <motion.circle cx="12" cy="12" r="9" {...draw(0.1, 0.6)} />
              <motion.path d="M12 7v5l3 2" {...draw(0.5, 0.4)} />
            </>
          )}
        </svg>
      </motion.div>
    </div>
  )
}

export default function Confirmation() {
  const { bookingId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchBookingStatus(bookingId)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    const interval = setInterval(load, 15000) // poll while pending
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [bookingId])

  const isPending = data?.status === 'pending'

  if (error) {
    return (
      <div className="min-h-screen bg-mist px-6 py-10 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-10">
        <BallLoader label="Loading your booking" />
      </div>
    )
  }

  const copy = STATUS_COPY[data.status]

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-md mx-auto text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={data.status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <StatusIcon status={data.status} />
            <h1 className={`font-display font-bold text-2xl mb-2 ${copy.color}`}>{copy.title}</h1>
            <p className="text-ink/60 mb-6">{copy.body}</p>
          </motion.div>
        </AnimatePresence>

        {isPending && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm text-sky-900">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p>
              <span className="font-semibold">No need to rush.</span> You can wait on this screen and your
              receipt will appear here once the admin approves. We'll also email you when it's approved.
            </p>
          </div>
        )}

        <div className="bg-card rounded-2xl shadow-sm border border-line p-5 mb-6 text-left space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-ink/50">Reference</span>
            <span className="text-right font-semibold text-ink">{data.referenceCode}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ink/50">Name</span>
            <span className="text-right font-semibold text-ink">{data.guestName}</span>
          </div>
          {data.bookings.map((b, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-ink/50">{b.court}</span>
              <span className="text-right font-semibold text-ink">
                {b.date} · {formatHour(parseInt(b.startTime, 10))}–{formatHour(parseInt(b.endTime, 10))}
              </span>
            </div>
          ))}
          <div className="border-t border-line pt-3 flex justify-between items-center">
            <span className="text-ink/50">Total</span>
            <span className="font-display font-bold text-lg text-heading">₱{data.totalAmount}</span>
          </div>
        </div>

        {data.status === 'rejected' && data.rejectionReason && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mb-6">{data.rejectionReason}</p>
        )}

        {data.status === 'confirmed' && (
          <a
            href={`${API_URL}/api/bookings/${bookingId}/receipt.pdf`}
            className="inline-block w-full bg-spark text-white font-display font-semibold py-3.5 rounded-full hover:brightness-95 active:scale-[0.98] transition-all"
          >
            Tap to See and Screenshot Receipt (PDF)
          </a>
        )}

        {(data.status === 'confirmed' || data.status === 'rejected') && (
          <Link
            to="/"
            className={`inline-block w-full font-display font-semibold py-3.5 rounded-full active:scale-[0.98] transition-all ${
              data.status === 'confirmed'
                ? 'mt-3 border-2 border-court text-heading hover:bg-card'
                : 'bg-spark text-white hover:brightness-95'
            }`}
          >
            Back to Home
          </Link>
        )}
      </div>
    </div>
  )
}
