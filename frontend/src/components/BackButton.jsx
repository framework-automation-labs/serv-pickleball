import { useNavigate } from 'react-router-dom'

export default function BackButton({ to, variant = 'dark', className = '' }) {
  const navigate = useNavigate()

  function handleClick() {
    if (to) navigate(to)
    else navigate(-1)
  }

  const colorClasses =
    variant === 'light' ? 'text-white/80 hover:text-white' : 'text-ink/60 hover:text-ink'

  return (
    <button
      onClick={handleClick}
      aria-label="Go back"
      className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${colorClasses} ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  )
}