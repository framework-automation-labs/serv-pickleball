import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'

const emptyForm = { title: '', body: '' }

export default function ManageAnnouncements() {
  const { session } = useAdminAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  async function loadAnnouncements() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Could not load announcements.')
    } else {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('announcements').insert({
      title: form.title,
      body: form.body,
      created_by: session?.user?.id,
    })

    setSaving(false)

    if (insertError) {
      setError(`Could not create announcement: ${insertError.message}`)
      return
    }

    setForm(emptyForm)
    setShowForm(false)
    loadAnnouncements()
  }

  async function togglePublished(announcement) {
    setUpdatingId(announcement.id)
    setError('')

    const { error: updateError } = await supabase
      .from('announcements')
      .update({ is_published: !announcement.is_published })
      .eq('id', announcement.id)

    if (updateError) {
      setError(`Could not update announcement: ${updateError.message}`)
    } else {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcement.id ? { ...a, is_published: !a.is_published } : a))
      )
    }
    setUpdatingId(null)
  }

  async function deleteAnnouncement(announcement) {
    if (!window.confirm(`Delete "${announcement.title}"? This can't be undone.`)) return

    setUpdatingId(announcement.id)
    setError('')

    const { error: deleteError } = await supabase.from('announcements').delete().eq('id', announcement.id)

    if (deleteError) {
      setError(`Could not delete announcement: ${deleteError.message}`)
      setUpdatingId(null)
    } else {
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id))
    }
  }

  return (
    <AdminLayout title="Announcements">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-2 hover:bg-spark/90 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Announcement'}
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
              placeholder="Court 2 closed for resurfacing"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/50 mb-1">Message</label>
            <textarea
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-2 hover:bg-spark/90 transition-colors disabled:opacity-60"
          >
            {saving ? 'Posting…' : 'Post Announcement'}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="space-y-3">
        {loading ? (
          <p className="bg-white rounded-2xl border border-line px-6 py-10 text-center text-ink/50 text-sm">
            Loading announcements…
          </p>
        ) : announcements.length === 0 ? (
          <p className="bg-white rounded-2xl border border-line px-6 py-10 text-center text-ink/50 text-sm">
            No announcements yet.
          </p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-line px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-ink font-medium">{a.title}</p>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                        a.is_published
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {a.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-ink/70 text-sm">{a.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => togglePublished(a)}
                    disabled={updatingId === a.id}
                    className="rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors disabled:opacity-50"
                  >
                    {a.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => deleteAnnouncement(a)}
                    disabled={updatingId === a.id}
                    className="rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  )
}
