import { useEffect, useState } from 'react'
import Footer from '../components/Footer.jsx'
import TournamentRegisterModal from '../components/TournamentRegisterModal.jsx'
import { supabase } from '../lib/supabaseClient.js'

const STATUS_STYLES = {
  upcoming: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
}

function formatTime(timeStr) {
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:${mStr} ${period}`
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [registerEvent, setRegisterEvent] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true })
      setEvents(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-mist">
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-16">
        <h1 className="font-display font-bold text-3xl text-ink mb-1">Events</h1>
        <p className="text-ink/60 mb-8">Open plays, clinics, and tournaments at SERV Pickleball Club.</p>

        {loading ? (
          <p className="text-ink/50 text-sm">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="text-ink/50 text-sm">No events posted yet — check back soon.</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl border border-line p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-display font-semibold text-lg text-ink">{event.title}</h2>
                      {event.is_tournament && (
                        <span className="inline-block rounded-full border border-court/30 bg-court/10 text-court-dark px-2 py-0.5 text-xs font-medium">
                          Tournament
                        </span>
                      )}
                    </div>
                    <p className="text-ink/60 text-sm">
                      {event.event_date}
                      {event.start_time && (
                        <>
                          {' · '}
                          {formatTime(event.start_time)}
                          {event.end_time && ` – ${formatTime(event.end_time)}`}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[event.status]}`}
                  >
                    {event.status}
                  </span>
                </div>

                {event.description && <p className="text-ink/70 text-sm mt-3">{event.description}</p>}

                {event.is_tournament && event.status === 'upcoming' && (
                  <button
                    onClick={() => setRegisterEvent(event)}
                    className="mt-4 rounded-full bg-spark text-white font-display font-semibold text-sm px-5 py-2 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Register
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {registerEvent && (
        <TournamentRegisterModal event={registerEvent} onClose={() => setRegisterEvent(null)} />
      )}
    </div>
  )
}
