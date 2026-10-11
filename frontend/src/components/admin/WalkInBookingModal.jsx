import { useEffect, useMemo, useRef, useState } from 'react'
import { createWalkInBooking, fetchAvailability, formatHour, generateHourSlots, isHourBooked, isHourPassed } from '../../lib/api.js'
import { localDateString } from './adminUtils.js'

const HOURS = generateHourSlots()
const MAX_HOURS = 6 // same cap as an online booking
const METHODS = [
  ['cash', 'Cash'],
  ['gcash', 'GCash'],
  ['other', 'Other'],
]

const fieldCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court'
const labelCls = 'mb-1 block text-xs font-medium text-ink/50'

// Phone photos can be 5-10MB. Shrinking to ~1600px keeps the receipt readable, uploads fast on
// mobile data, and stays well under the server's 8MB limit. Falls back to the original file.
async function shrinkImage(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], 'payment-photo.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

// Admin enters a booking for someone paying at the courts: a new walk-in, or a player who is
// already playing and wants more time. Saved as confirmed + paid, with a photo of the payment.
export default function WalkInBookingModal({ courts, initial, onClose, onCreated }) {
  const today = localDateString()
  const [courtId, setCourtId] = useState(initial?.courtId ?? courts[0]?.id ?? '')
  const [date, setDate] = useState(initial?.date || today)
  const [startHour, setStartHour] = useState(initial?.startHour ?? null)
  const [hours, setHours] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [availability, setAvailability] = useState([])
  const [loadingAvail, setLoadingAvail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const court = courts.find((c) => c.id === Number(courtId))
  const rate = Number(court?.rate_per_hour) || 0

  // Load what is already booked / blocked on the chosen date.
  useEffect(() => {
    let cancelled = false
    setLoadingAvail(true)
    fetchAvailability(date)
      .then((rows) => !cancelled && setAvailability(rows))
      .catch(() => !cancelled && setAvailability([]))
      .finally(() => !cancelled && setLoadingAvail(false))
    return () => {
      cancelled = true
    }
  }, [date])

  // Start times that can actually be booked on this court/date.
  const freeStarts = useMemo(
    () => HOURS.filter((h) => !isHourPassed(date, h) && !isHourBooked(Number(courtId), h, availability)),
    [date, courtId, availability],
  )

  // Keep the chosen start valid when the court/date changes.
  useEffect(() => {
    if (loadingAvail) return
    if (startHour == null || !freeStarts.includes(startHour)) setStartHour(freeStarts[0] ?? null)
  }, [freeStarts, loadingAvail, startHour])

  // How many hours in a row are free from the chosen start.
  const maxHours = useMemo(() => {
    if (startHour == null) return 0
    let n = 0
    while (n < MAX_HOURS && startHour + n < 24 && freeStarts.includes(startHour + n)) n++
    return n
  }, [startHour, freeStarts])

  useEffect(() => {
    if (maxHours > 0 && hours > maxHours) setHours(maxHours)
  }, [maxHours, hours])

  // Price follows court + hours until the admin types their own amount.
  useEffect(() => {
    if (!amountTouched) setAmount(rate ? String(rate * hours) : '')
  }, [rate, hours, amountTouched])

  useEffect(() => {
    if (!photo) return setPreview('')
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setPhoto(await shrinkImage(file))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Enter the player’s name.')
    if (startHour == null || hours < 1) return setError('Pick a free start time.')
    if (amount === '' || Number.isNaN(Number(amount)) || Number(amount) < 0) return setError('Enter the amount received.')
    if (!photo) return setError('Take or attach a photo of the cash or the payment receipt.')

    setBusy(true)
    try {
      await createWalkInBooking({
        guestName: name.trim(),
        phone: phone.trim(),
        courtId: Number(courtId),
        date,
        startHour,
        hours,
        paymentMethod: method,
        amount: Number(amount),
        photo,
      })
      onCreated?.({ name: name.trim(), courtName: court?.name, date, startHour, hours })
    } catch (err) {
      setError(err.message || 'Could not save this booking.')
      setBusy(false)
    }
  }

  const endLabel = startHour != null ? formatHour(startHour + hours) : ''

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/60 px-4 py-6 sm:px-6" onClick={busy ? undefined : onClose}>
      <form
        onSubmit={submit}
        className="m-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-ink">Walk-in booking</h3>
          <button type="button" onClick={onClose} disabled={busy} className="text-sm text-ink/40 hover:text-ink">
            Close
          </button>
        </div>
        <p className="mb-4 text-xs text-ink/50">
          For a player paying at the courts, or someone already playing who wants more time. It is saved as confirmed
          and paid.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="wi-court" className={labelCls}>
              Court
            </label>
            <select id="wi-court" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={fieldCls}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wi-date" className={labelCls}>
              Date
            </label>
            <input
              id="wi-date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label htmlFor="wi-start" className={labelCls}>
              Start time
            </label>
            <select
              id="wi-start"
              value={startHour ?? ''}
              onChange={(e) => setStartHour(Number(e.target.value))}
              disabled={loadingAvail || freeStarts.length === 0}
              className={fieldCls}
            >
              {freeStarts.length === 0 && <option value="">{loadingAvail ? 'Loading…' : 'No free time'}</option>}
              {freeStarts.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wi-hours" className={labelCls}>
              Hours
            </label>
            <select
              id="wi-hours"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              disabled={maxHours === 0}
              className={fieldCls}
            >
              {Array.from({ length: Math.max(maxHours, 1) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} hour{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {startHour != null ? (
          <p className="mt-2 text-xs text-ink/50">
            {court?.name} · {formatHour(startHour)} – {endLabel}
          </p>
        ) : (
          !loadingAvail && <p className="mt-2 text-xs text-amber-700">Nothing is free on this court for that date.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="wi-name" className={labelCls}>
              Player name
            </label>
            <input
              id="wi-name"
              type="text"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className={fieldCls}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="wi-phone" className={labelCls}>
              Phone (optional)
            </label>
            <input
              id="wi-phone"
              type="tel"
              value={phone}
              maxLength={20}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
              className={fieldCls}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>Paid via</span>
            <div className="flex overflow-hidden rounded-lg border border-line text-sm font-medium" role="radiogroup">
              {METHODS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  onClick={() => setMethod(value)}
                  className={`flex-1 py-2 transition-colors ${
                    method === value ? 'bg-court text-white' : 'bg-white text-ink/60 hover:bg-mist'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="wi-amount" className={labelCls}>
              Amount received (₱)
            </label>
            <input
              id="wi-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setAmountTouched(true)
              }}
              className={fieldCls}
            />
            {rate > 0 && <p className="mt-1 text-[11px] text-ink/40">Court rate ₱{rate}/hr</p>}
          </div>
        </div>

        <div className="mt-4">
          <span className={labelCls}>Photo of the money or payment receipt</span>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
          {preview ? (
            <div className="flex items-center gap-3 rounded-lg border border-line p-2">
              <img src={preview} alt="Payment proof preview" className="h-20 w-20 rounded-md object-cover" />
              <div className="min-w-0 flex-1 text-xs text-ink/60">
                <p className="font-medium text-ink">Photo attached</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 font-medium text-court underline">
                  Retake / choose another
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-5 text-sm text-ink/60 transition-colors hover:bg-mist"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="font-medium text-ink">Take or attach a photo</span>
              <span className="text-xs text-ink/40">The cash, or the GCash / bank receipt</span>
            </button>
          )}
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-line py-2.5 font-medium text-ink/70 transition-colors hover:bg-mist disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || startHour == null}
            className="flex-1 rounded-lg bg-spark py-2.5 font-semibold text-white transition-colors hover:bg-spark/90 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save booking'}
          </button>
        </div>
      </form>
    </div>
  )
}
