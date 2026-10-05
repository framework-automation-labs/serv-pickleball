import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatHour } from '../lib/api'
import BackButton from '../components/BackButton.jsx'

export default function Details() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  if (!state) {
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

  const { courtName, date, startHour, endHour, durationHours, totalPrice } = state

  function handleSubmit(e) {
    e.preventDefault()
    const emailOk = !email.trim() || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email.trim())
    const phoneOk = /^[0-9+()\-\s]{7,20}$/.test(phone.trim())
    if (!fullName.trim() || fullName.trim().length > 100 || !phoneOk || !emailOk) {
      setError('Please enter your name, a valid phone number, and (optionally) a valid email address.')
      return
    }
    navigate('/checkout', {
      state: { ...state, fullName: fullName.trim(), phone: phone.trim(), email: email.trim() },
    })
  }

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-md mx-auto">
        <BackButton className="mb-4" />
        <h1 className="font-display font-bold text-2xl text-ink mb-1">Your Details</h1>
        <p className="text-ink/50 text-sm mb-6">We'll use this to confirm your booking.</p>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-4 mb-6 text-sm">
          <p className="font-semibold text-ink">{courtName}</p>
          <p className="text-ink/60">
            {date} · {formatHour(startHour)} – {formatHour(endHour)} ({durationHours}h) · ₱{totalPrice}
          </p>
        </div>

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
              maxLength={100}
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
              maxLength={20}
              className="w-full border border-line rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-court"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1">
              Email <span className="normal-case font-normal text-ink/40">(optional — to get your receipt by email)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@email.com"
              maxLength={254}
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