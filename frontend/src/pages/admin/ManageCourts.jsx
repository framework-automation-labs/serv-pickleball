import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { supabase } from '../../lib/supabaseClient.js'

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

export default function ManageCourts() {
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  async function loadCourts() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase.from('courts').select('*').order('id')

    if (fetchError) {
      setError('Could not load courts.')
    } else {
      setCourts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCourts()
  }, [])

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
    </AdminLayout>
  )
}
