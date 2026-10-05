import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { generateHourSlots, formatHour } from '../../lib/api.js'
import { supabase } from '../../lib/supabaseClient.js'

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

function StatusBadge({ status }) {
  const styles =
    status === 'active'
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  )
}

const HOURS = generateHourSlots()

export default function ManageCourts() {
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const [blockedSlots, setBlockedSlots] = useState([])
  const [blockedLoading, setBlockedLoading] = useState(true)
  const [blockError, setBlockError] = useState('')
  const [newBlock, setNewBlock] = useState({
    courtId: '',
    date: todayDateString(),
    startHour: 9,
    endHour: 10,
    reason: '',
  })
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [deletingBlockId, setDeletingBlockId] = useState(null)

  async function loadCourts() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase.from('courts').select('*').order('id')

    if (fetchError) {
      setError('Could not load courts.')
    } else {
      setCourts(data)
      setNewBlock((prev) => (prev.courtId ? prev : { ...prev, courtId: data?.[0]?.id || '' }))
    }
    setLoading(false)
  }

  async function loadBlockedSlots() {
    setBlockedLoading(true)
    const { data, error: fetchError } = await supabase
      .from('blocked_slots')
      .select('*, courts(name)')
      .gte('blocked_date', todayDateString())
      .order('blocked_date')
      .order('start_time')

    if (fetchError) setBlockError('Could not load blocked time slots.')
    else setBlockedSlots(data)
    setBlockedLoading(false)
  }

  useEffect(() => {
    loadCourts()
    loadBlockedSlots()
  }, [])

  async function createBlockedSlot(e) {
    e.preventDefault()
    if (!newBlock.courtId || newBlock.endHour <= newBlock.startHour) {
      setBlockError('Please pick a court and a valid time range.')
      return
    }

    setCreatingBlock(true)
    setBlockError('')

    const { error: insertError } = await supabase.from('blocked_slots').insert({
      court_id: newBlock.courtId,
      blocked_date: newBlock.date,
      start_time: `${String(newBlock.startHour).padStart(2, '0')}:00:00`,
      end_time: `${String(newBlock.endHour).padStart(2, '0')}:00:00`,
      reason: newBlock.reason.trim() || null,
    })

    if (insertError) {
      setBlockError(insertError.message)
    } else {
      setNewBlock((prev) => ({ ...prev, reason: '' }))
      await loadBlockedSlots()
    }
    setCreatingBlock(false)
  }

  async function deleteBlockedSlot(id) {
    setDeletingBlockId(id)
    setBlockError('')
    const { error: deleteError } = await supabase.from('blocked_slots').delete().eq('id', id)
    if (deleteError) setBlockError(deleteError.message)
    else await loadBlockedSlots()
    setDeletingBlockId(null)
  }

  async function toggleStatus(court) {
    const nextStatus = court.status === 'active' ? 'maintenance' : 'active'
    setUpdatingId(court.id)
    setError('')

    const { error: updateError } = await supabase
      .from('courts')
      .update({ status: nextStatus })
      .eq('id', court.id)

    if (updateError) {
      setError(`Could not update ${court.name}: ${updateError.message}`)
    } else {
      setCourts((prev) => prev.map((c) => (c.id === court.id ? { ...c, status: nextStatus } : c)))
    }
    setUpdatingId(null)
  }

  return (
    <AdminLayout title="Courts">
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">Loading courts…</p>
        ) : courts.length === 0 ? (
          <p className="px-6 py-10 text-center text-ink/50 text-sm">No courts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="px-6 py-3 font-medium">Court</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 text-ink font-medium">{court.name}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={court.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleStatus(court)}
                      disabled={updatingId === court.id}
                      className="rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors disabled:opacity-50"
                    >
                      {updatingId === court.id
                        ? 'Updating…'
                        : court.status === 'active'
                          ? 'Mark for Maintenance'
                          : 'Mark Active'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="font-display font-semibold text-lg text-ink mt-8 mb-3">Blocked Time Slots</h2>
      <p className="text-ink/50 text-sm mb-4">
        Block off maintenance windows or private events — blocked times are greyed out on the booking
        page and the database refuses any booking that overlaps one.
      </p>

      {blockError && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{blockError}</p>}

      <form
        onSubmit={createBlockedSlot}
        className="bg-white rounded-2xl border border-line p-4 mb-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1">Court</label>
          <select
            value={newBlock.courtId}
            onChange={(e) => setNewBlock((prev) => ({ ...prev, courtId: e.target.value }))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
          >
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1">Date</label>
          <input
            type="date"
            value={newBlock.date}
            onChange={(e) => setNewBlock((prev) => ({ ...prev, date: e.target.value }))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1">From</label>
          <select
            value={newBlock.startHour}
            onChange={(e) => setNewBlock((prev) => ({ ...prev, startHour: Number(e.target.value) }))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1">To</label>
          <select
            value={newBlock.endHour}
            onChange={(e) => setNewBlock((prev) => ({ ...prev, endHour: Number(e.target.value) }))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
          >
            {[...HOURS, 24].map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-ink/50 mb-1">Reason (optional)</label>
          <input
            type="text"
            value={newBlock.reason}
            onChange={(e) => setNewBlock((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Net resurfacing, private event…"
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
        <button
          type="submit"
          disabled={creatingBlock}
          className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-1.5 hover:bg-spark/90 transition-colors disabled:opacity-50"
        >
          {creatingBlock ? 'Adding…' : 'Block This Time'}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        {blockedLoading ? (
          <p className="px-6 py-8 text-center text-ink/50 text-sm">Loading blocked slots…</p>
        ) : blockedSlots.length === 0 ? (
          <p className="px-6 py-8 text-center text-ink/50 text-sm">No upcoming blocked time slots.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="px-6 py-3 font-medium">Court</th>
                <th className="px-6 py-3 font-medium">When</th>
                <th className="px-6 py-3 font-medium">Reason</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedSlots.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 text-ink font-medium">{b.courts?.name}</td>
                  <td className="px-6 py-4 text-ink">
                    {b.blocked_date} · {formatHour(parseInt(b.start_time, 10))}–{formatHour(parseInt(b.end_time, 10))}
                  </td>
                  <td className="px-6 py-4 text-ink/50">{b.reason || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteBlockedSlot(b.id)}
                      disabled={deletingBlockId === b.id}
                      className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deletingBlockId === b.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}
