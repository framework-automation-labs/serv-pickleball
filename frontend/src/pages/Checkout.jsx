import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatHour } from '../lib/api'
import BackButton from '../components/BackButton.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Checkout() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')

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

  async function handlePay() {
    setStatus('loading')
    try {
      const res = await fetch(`${API_URL}/api/payments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      if (res.status === 501) {
        setStatus('not-implemented')
        return
      }
      await res.json()
      setStatus('idle')
    } catch (err) {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-md mx-auto">
        <BackButton className="mb-4" />
          <h1 className="font-display font-bold text-2xl text-ink mb-6">Confirm & Pay</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-5 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink/50">Name</span>
            <span className="font-semibold text-ink">{state.fullName}</span>
            </div>
            <div className="flex justify-between">
            <span className="text-ink/50">Phone</span>
            <span className="font-semibold text-ink">{state.phone}</span>
            </div>
            <div className="flex justify-between">
            <span className="text-ink/50">Court</span>
            <span className="font-semibold text-ink">{courtName}</span>
            </div>
          <div className="flex justify-between">
            <span className="text-ink/50">Date</span>
            <span className="font-semibold text-ink">{date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/50">Time</span>
            <span className="font-semibold text-ink">
              {formatHour(startHour)} – {formatHour(endHour)} ({durationHours}h)
            </span>
          </div>
          <div className="border-t border-line pt-3 flex justify-between items-center">
            <span className="text-ink/50">Total</span>
            <span className="font-display font-bold text-xl text-court-dark">₱{totalPrice}</span>
          </div>
        </div>

        {status === 'not-implemented' && (
          <p className="text-amber-600 text-sm mb-4">
            Payment isn't wired up yet — expected at this stage.
          </p>
        )}
        {status === 'error' && (
          <p className="text-red-600 text-sm mb-4">Couldn't reach the backend. Is it running?</p>
        )}

        <button
          onClick={handlePay}
          disabled={status === 'loading'}
          className="w-full bg-spark text-ink font-display font-semibold py-3.5 rounded-full hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {status === 'loading' ? 'Processing…' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  )
}