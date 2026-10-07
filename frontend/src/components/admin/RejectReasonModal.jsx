import { useState } from 'react'

export default function RejectReasonModal({ onCancel, onConfirm, submitting }) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/60 px-4 py-6 sm:px-6" onClick={onCancel}>
      <div className="m-auto bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-semibold text-ink mb-2">Reject this receipt?</h3>
        <p className="text-ink/50 text-sm mb-3">
          Let the customer know why, so they can fix it and resubmit if needed.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Amount doesn't match, receipt is blurry, wrong GCash number…"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-line text-ink/70 font-medium py-2 hover:bg-mist transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim() || 'Receipt could not be verified.')}
            disabled={submitting}
            className="flex-1 rounded-lg bg-red-600 text-white font-semibold py-2 hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
