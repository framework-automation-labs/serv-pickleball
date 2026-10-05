import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatHour, submitBookingWithReceipt } from '../lib/api'
import { GCASH_CONFIG } from '../lib/gcashConfig'
import BackButton from '../components/BackButton.jsx'

export default function Checkout() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [receiptFile, setReceiptFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  if (!state) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-ink/60 mb-4">No booking selected.</p>
          <button onClick={() => navigate('/book')} className="text-court font-semibold underline">
            Go back to booking
          </button>
        </div>
      </div>
    )
  }

  const { bookings, totalHours, totalPrice, fullName, phone, email } = state

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Please upload a JPG, PNG, WebP, or GIF screenshot.')
      setStatus('error')
      e.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('That image is too large (max 8MB).')
      setStatus('error')
      e.target.value = ''
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setError('')
    setStatus('idle')
    setReceiptFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!receiptFile) {
      setError('Please attach a screenshot of your GCash receipt.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setError('')

    try {
      const result = await submitBookingWithReceipt({
        fullName,
        phone,
        email,
        bookings: bookings.map((b) => ({
          courtId: b.courtId,
          date: b.date,
          startHour: b.startHour,
          endHour: b.endHour,
        })),
        receiptFile,
      })
      navigate(`/confirmation/${result.bookingGroupId}`)
    } catch (err) {
      setStatus('error')
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-md mx-auto">
        <BackButton className="mb-4" />
        <h1 className="font-display font-bold text-2xl text-ink mb-1">Pay via GCash</h1>
        <p className="text-ink/50 text-sm mb-6">
          Send payment, then upload your receipt screenshot. An admin will confirm your booking shortly.
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-5 mb-6 space-y-2 text-sm">
          <p className="font-semibold text-ink mb-1">{fullName}</p>
          {bookings.map((b, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-ink/50">{b.courtName}</span>
              <span className="font-semibold text-ink">
                {b.date} · {formatHour(b.startHour)}–{formatHour(b.endHour)}
              </span>
            </div>
          ))}
          <div className="border-t border-line pt-3 flex justify-between items-center">
            <span className="text-ink/50">Total ({totalHours}h)</span>
            <span className="font-display font-bold text-xl text-court-dark">₱{totalPrice}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-5 mb-6 text-center">
          <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">Send Payment To</p>
          {GCASH_CONFIG.gcashQrImage && (
            <img src={GCASH_CONFIG.gcashQrImage} alt="GCash QR code" className="w-40 h-40 mx-auto mb-3 rounded-lg border border-line" />
          )}
          <p className="font-display font-bold text-lg text-ink">{GCASH_CONFIG.accountName}</p>
          <p className="text-court-dark font-semibold">{GCASH_CONFIG.accountNumber}</p>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-ink/60 uppercase tracking-wide mb-2">
            Upload GCash Receipt
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-line hover:border-court transition-colors p-4 text-center"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Receipt preview" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <span className="text-ink/50 text-sm">Tap to choose a screenshot</span>
            )}
          </button>
        </div>

        {status === 'error' && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          className="w-full bg-spark text-ink font-display font-semibold py-3.5 rounded-full hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {status === 'loading' ? 'Submitting…' : 'Submit for Review'}
        </button>
      </div>
    </div>
  )
}
