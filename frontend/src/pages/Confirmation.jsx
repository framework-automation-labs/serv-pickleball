import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchBookingStatus, formatHour } from '../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const STATUS_COPY = {
  pending: {
    title: 'Under Review',
    color: 'text-amber-600',
    body: "We've received your receipt. An admin will confirm your booking shortly — check back here anytime.",
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

  if (error) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-center">
        <p className="text-ink/50">Loading…</p>
      </div>
    )
  }

  const copy = STATUS_COPY[data.status]

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-md mx-auto text-center">
        <h1 className={`font-display font-bold text-2xl mb-2 ${copy.color}`}>{copy.title}</h1>
        <p className="text-ink/60 mb-6">{copy.body}</p>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-5 mb-6 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink/50">Reference</span>
            <span className="font-semibold text-ink">{data.referenceCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/50">Name</span>
            <span className="font-semibold text-ink">{data.guestName}</span>
          </div>
          {data.bookings.map((b, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-ink/50">{b.court}</span>
              <span className="font-semibold text-ink">
                {b.date} · {formatHour(parseInt(b.startTime, 10))}–{formatHour(parseInt(b.endTime, 10))}
              </span>
            </div>
          ))}
          <div className="border-t border-line pt-3 flex justify-between items-center">
            <span className="text-ink/50">Total</span>
            <span className="font-display font-bold text-lg text-court-dark">₱{data.totalAmount}</span>
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
            Download Receipt (PDF)
          </a>
        )}
      </div>
    </div>
  )
}
