import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'

export default function ReceiptViewerModal({ path, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: signError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 300) // 5 minutes — plenty for one review
      if (cancelled) return
      if (signError) setError('Could not load this receipt image.')
      else setUrl(data.signedUrl)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [path])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 bg-ink/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl p-4 max-w-lg w-full max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-display font-semibold text-ink">GCash Receipt</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-sm">
            Close
          </button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!error && !url && <p className="text-ink/40 text-sm">Loading…</p>}
        {url && <img src={url} alt="GCash receipt" className="w-full rounded-lg border border-line" />}
      </div>
    </div>
  )
}
