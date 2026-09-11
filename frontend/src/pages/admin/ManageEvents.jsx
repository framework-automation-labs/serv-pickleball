import { Fragment, useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'

const STATUS_STYLES = {
  upcoming: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
}

const emptyForm = {
  title: '',
  description: '',
  event_date: '',
  start_time: '',
  end_time: '',
  is_tournament: false,
  max_participants: '',
}

export default function ManageEvents() {
  const { session } = useAdminAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  // Registrations panel, keyed by event id
  const [expandedEventId, setExpandedEventId] = useState(null)
  const [registrations, setRegistrations] = useState({})
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [deletingRegId, setDeletingRegId] = useState(null)

  async function loadEvents() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })

    if (fetchError) {
      setError('Could not load events.')
    } else {
      setEvents(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      is_tournament: form.is_tournament,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      created_by: session?.user?.id,
    })

    setSaving(false)

    if (insertError) {
      setError(`Could not create event: ${insertError.message}`)
      return
    }

    setForm(emptyForm)
    setShowForm(false)
    loadEvents()
  }

  async function updateStatus(event, nextStatus) {
    setUpdatingId(event.id)
    setError('')

    const { error: updateError } = await supabase
      .from('events')
      .update({ status: nextStatus })
      .eq('id', event.id)

    if (updateError) {
      setError(`Could not update event: ${updateError.message}`)
    } else {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: nextStatus } : e)))
    }
    setUpdatingId(null)
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Delete "${event.title}"? This can't be undone.`)) return

    setUpdatingId(event.id)
    setError('')

    const { error: deleteError } = await supabase.from('events').delete().eq('id', event.id)

    if (deleteError) {
      setError(`Could not delete event: ${deleteError.message}`)
      setUpdatingId(null)
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== event.id))
    }
  }

  async function toggleRegistrations(event) {
    if (expandedEventId === event.id) {
      setExpandedEventId(null)
      return
    }

    setExpandedEventId(event.id)

    if (registrations[event.id]) return // already fetched

    setLoadingRegs(true)
    const { data, error: fetchError } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(`Could not load registrations: ${fetchError.message}`)
    } else {
      setRegistrations((prev) => ({ ...prev, [event.id]: data }))
    }
    setLoadingRegs(false)
  }

  async function deleteRegistration(eventId, registration) {
    if (!window.confirm(`Remove ${registration.full_name}'s registration?`)) return

    setDeletingRegId(registration.id)
    const { error: deleteError } = await supabase
      .from('tournament_registrations')
      .delete()
      .eq('id', registration.id)

    if (deleteError) {
      setError(`Could not remove registration: ${deleteError.message}`)
    } else {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: prev[eventId].filter((r) => r.id !== registration.id),
      }))
    }
    setDeletingRegId(null)
  }

  return (
    <AdminLayout title="Events">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-2 hover:bg-spark/90 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Event'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-line px-6 py-6 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink/50 mb-1">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              placeholder="Weekend Open Play"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/50 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink/50 mb-1">Date</label>
              <input
                required
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/50 mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/50 mb-1">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.is_tournament}
                onChange={(e) => setForm({ ...form, is_tournament: e.target.checked })}
                className="rounded border-line"
              />
              This is a tournament (open registration)
            </label>

            {form.is_tournament && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-ink/50">Max participants</label>
                <input
                  type="number"
                  min="1"
                  value={form.max_participants}
                  onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
                  className="w-24 rounded-lg border border-line px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
                  placeholder="Optional"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-2 hover:bg-spark/90 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create Event'}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">No events yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="px-6 py-3 font-medium">Event</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <Fragment key={event.id}>
                  <tr className="border-b border-line last:border-0 align-top">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="text-ink font-medium">{event.title}</p>
                        {event.is_tournament && (
                          <span className="inline-block rounded-full border border-court/30 bg-court/10 text-court-dark px-2 py-0.5 text-xs font-medium">
                            Tournament
                          </span>
                        )}
                      </div>
                      {event.description && <p className="text-ink/50 text-xs mt-1 max-w-xs">{event.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-ink whitespace-nowrap">
                      {event.event_date}
                      {event.start_time && (
                        <span className="text-ink/50"> · {event.start_time.slice(0, 5)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[event.status]}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {event.is_tournament && (
                          <button
                            onClick={() => toggleRegistrations(event)}
                            className="rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors"
                          >
                            {expandedEventId === event.id ? 'Hide Registrations' : 'View Registrations'}
                          </button>
                        )}
                        {event.status === 'upcoming' && (
                          <button
                            onClick={() => updateStatus(event, 'cancelled')}
                            disabled={updatingId === event.id}
                            className="rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => deleteEvent(event)}
                          disabled={updatingId === event.id}
                          className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedEventId === event.id && (
                    <tr className="bg-mist/50">
                      <td colSpan={4} className="px-6 py-4">
                        {loadingRegs && !registrations[event.id] ? (
                          <p className="text-ink/50 text-sm">Loading registrations…</p>
                        ) : !registrations[event.id] || registrations[event.id].length === 0 ? (
                          <p className="text-ink/50 text-sm">No registrations yet.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-ink/50 mb-2">
                              {registrations[event.id].length}
                              {event.max_participants ? ` / ${event.max_participants}` : ''} registered
                            </p>
                            {registrations[event.id].map((reg) => (
                              <div
                                key={reg.id}
                                className="flex items-center justify-between bg-white rounded-lg border border-line px-4 py-2"
                              >
                                <div className="text-sm">
                                  <span className="text-ink font-medium">{reg.full_name}</span>
                                  <span className="text-ink/50"> · {reg.phone_number}</span>
                                  {reg.partner_name && (
                                    <span className="text-ink/50"> · Partner: {reg.partner_name}</span>
                                  )}
                                  {reg.email && <span className="text-ink/50"> · {reg.email}</span>}
                                </div>
                                <button
                                  onClick={() => deleteRegistration(event.id, reg)}
                                  disabled={deletingRegId === reg.id}
                                  className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}
