export default function PolicyNotice({ className = '' }) {
  return (
    <div
      className={`flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="flex-shrink-0 mt-0.5"
      >
        <path
          d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p>
        <span className="font-semibold">Strict No-Cancellation Policy —</span> bookings cannot be
        refunded or cancelled once confirmed.
      </p>
    </div>
  )
}