import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export default function TournamentRegisterModal({ event, onClose }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [status, setStatus] = useState('idle') // idle | saving | done | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')
    setError('')

    const { error: insertError } = await supabase.from('tournament_registrations').insert({
      event_id: event.id,
      full_name: fullName.trim(),
      phone_number: phone.trim(),
      email: email.trim() || null,
      partner_name: partnerName.trim() || null,
    })

    if (insertError) {
      setStatus('error')
      setError(
        insertError.message.includes('row-level security')
          ? 'Registration for this tournament is no longer open.'
          : insertError.message
      )
      return
    }

    setStatus('done')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6 bg-ink/50" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'done' ? (
          <div className="text-center py-4">
            <p className="font-display text-lg text-ink mb-2">You're registered!</p>
            <p className="text-ink/60 text-sm mb-6">
              We'll reach out at {phone} with details for {event.title}.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-spark text-white font-semibold py-2.5 hover:bg-spark/90 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="font-display text-lg text-ink">Register for {event.title}</h2>
              <p className="text-ink/50 text-sm">{event.event_date}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Full Name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
                placeholder="Juan Dela Cruz"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Phone Number</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
                placeholder="09XX XXX XXXX"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/60 mb-1">Doubles Partner (optional)</label>
              <input
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-line text-ink/70 font-medium py-2.5 hover:bg-mist transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'saving'}
                className="flex-1 rounded-lg bg-spark text-white font-semibold py-2.5 hover:bg-spark/90 transition-colors disabled:opacity-60"
              >
                {status === 'saving' ? 'Registering…' : 'Register'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
