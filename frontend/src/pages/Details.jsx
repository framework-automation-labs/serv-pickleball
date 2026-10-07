import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { formatHour } from '../lib/api'
import BackButton from '../components/BackButton.jsx'
import StepProgress from '../components/StepProgress.jsx'
import PolicyNotice from '../components/PolicyNotice.jsx'

const inputCls =
  'w-full min-h-[44px] rounded-xl border border-line bg-card px-3.5 py-2.5 text-base transition-shadow focus:outline-none focus:ring-2 focus:ring-court'
const labelCls = 'mb-1.5 block text-sm font-medium text-ink/70'

export default function Details() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})

  if (!state || !Array.isArray(state.bookings)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 text-center">
        <div>
          <p className="mb-4 text-ink/60">No booking selected.</p>
          <button onClick={() => navigate('/book')} className="font-semibold text-link underline">
            Go back to booking
          </button>
        </div>
      </div>
    )
  }

  const { bookings, totalHours, totalPrice } = state

  function validate() {
    const e = {}
    if (!fullName.trim()) e.fullName = 'Enter your full name.'
    else if (fullName.trim().length > 100) e.fullName = 'Name is too long (max 100 characters).'
    const digits = phone.replace(/\D/g, '')
    if (!/^(09\d{9}|639\d{9})$/.test(digits)) e.phone = 'Enter a valid mobile number, like 0917 123 4567.'
    if (!email.trim()) e.email = 'Enter your email address.'
    else if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email.trim())) e.email = 'Enter a valid email address.'
    return e
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    navigate('/checkout', {
      state: { ...state, fullName: fullName.trim(), phone: phone.trim(), email: email.trim() },
    })
  }

  const err = (k) => errors[k] && <p className="mt-1 text-sm text-red-600">{errors[k]}</p>

  return (
    <div className="min-h-screen bg-mist px-5 py-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-md"
      >
        <BackButton className="mb-4" />
        <div className="mb-6">
          <StepProgress current={2} />
        </div>
        <h1 className="mb-1 font-display text-2xl font-bold text-ink">Your details</h1>
        <p className="mb-6 text-sm text-ink/50">We'll use these to confirm your booking.</p>

        <div className="mb-6 space-y-2 rounded-2xl border border-line bg-card p-4 text-sm shadow-sm">
          {bookings.map((b, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="font-semibold text-ink">{b.courtName}</span>
              <span className="text-right text-ink/60">
                {b.date} · {formatHour(b.startHour)} – {formatHour(b.endHour)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-ink/50">Total ({totalHours}h)</span>
            <span className="font-display text-lg font-bold text-heading">₱{totalPrice}</span>
          </div>
        </div>

        <PolicyNotice className="mb-6" />

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fullName" className={labelCls}>Full name</label>
            <input id="fullName" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" className={inputCls} />
            {err('fullName')}
          </div>
          <div>
            <label htmlFor="phone" className={labelCls}>Mobile number</label>
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0917 123 4567" className={inputCls} />
            {err('phone')}
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>
              Email <span className="font-normal text-ink/40">(required for booking updates and your receipt)</span>
            </label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@email.com" className={inputCls} />
            {err('email')}
          </div>
          <button
            type="submit"
            className="min-h-[48px] w-full rounded-full bg-spark font-display font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Continue to payment
          </button>
        </form>
      </motion.div>
    </div>
  )
}
