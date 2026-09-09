import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatHour } from '../lib/api'
import BackButton from '../components/BackButton.jsx'
import PolicyNotice from '../components/PolicyNotice.jsx'

export default function Details() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  if (!state || !state.bookings?.length) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-ink/60 mb-4">No booking selected.</p>
          <button onClick={() => navigate('/book')} className="text-court font-semibold underline">
            Go back to booking
          </button>
        </div>
      </div>
    )
  }

  const { date, bookings, totalHours, totalPrice } = state

  function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim() || !phone.trim()) {
      setError('Please fill in both fields.')
      return
    }
    navigate('/checkout', {
      state: { ...state, fullName: fullName.trim(), phone: phone.trim() },
    })
  }

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-md mx-auto">
        <BackButton className="mb-4" />
        <h1 className="font-display font-bold text-2xl text-ink mb-1">Your Details</h1>
        <p className="text-ink/50 text-sm mb-6">We'll use this to confirm your booking.</p>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-4 mb-4 text-sm space-y-1.5">
          <p className="text-ink/50 mb-1">{date}</p>
          {bookings.map((b, i) => (
            <p key={i} className="font-semibold text-ink">
              {b.courtName} · {formatHour(b.startHour)} – {formatHour(b.endHour)} ({b.hours}h)
            </p>
          ))}
          <div className="border-t border-line pt-2 mt-2 flex justify-between">
            <span className="text-ink/50">
              {totalHours} {totalHours === 1 ? 'hour' : 'hours'} total
            </span>
            <span className="font-display font-bold text-court-dark">₱{totalPrice}</span>
          </div>
        </div>

        <PolicyNotice className="mb-6" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className="w-full border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-court"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-court"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-spark text-white font-display font-semibold py-3.5 rounded-full hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Continue to Payment
          </button>
        </form>
      </div>
    </div>
  )
}