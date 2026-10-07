// In-page replacement for window.confirm(). Native confirm dialogs are silently
// suppressed (returning "cancel") by many tablet browsers, and auto-dismissed when the
// tab loses focus — which made Approve/Delete look dead. This always renders.
export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', tone = 'primary', busy, onCancel, onConfirm }) {
  const confirmCls = tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-spark hover:bg-spark/90'

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/60 px-4 py-6 sm:px-6" onClick={onCancel}>
      <div className="m-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 font-display font-semibold text-ink">{title}</h3>
        <p className="mb-4 text-sm text-ink/60">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-line py-2.5 font-medium text-ink/70 transition-colors hover:bg-mist"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-lg py-2.5 font-semibold text-white transition-colors disabled:opacity-60 ${confirmCls}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
