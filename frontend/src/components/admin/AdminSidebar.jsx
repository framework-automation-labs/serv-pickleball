import { NavLink } from 'react-router-dom'
import usePendingCounts from './usePendingCounts.js'

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  bookings: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  courts: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14M3 12h18" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>
  ),
}

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: 'bookings', badge: 'bookings' },
  { to: '/admin/courts', label: 'Courts', icon: 'courts' },
  { to: '/admin/gallery', label: 'Gallery', icon: 'gallery' },
]

const logoUrl = `${import.meta.env.BASE_URL}serv-logo.png`

export default function AdminSidebar() {
  const counts = usePendingCounts()

  return (
    <aside className="w-full shrink-0 bg-court-dark text-court-light lg:w-56 lg:min-h-screen lg:flex lg:flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5 lg:block lg:px-5 lg:py-6">
        <div>
          <img src={logoUrl} alt="SERV Pickleball Club" className="h-8 lg:h-10 mb-1 lg:mb-2" />
          <p className="text-[0.65rem] uppercase tracking-widest text-spark font-semibold">Admin</p>
        </div>
        <span className="text-xs text-court-light/60 lg:hidden">SERV Pickleball</span>
      </div>

      <nav className="flex flex-1 gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible lg:py-4">
        {NAV_ITEMS.map((item) => {
          const count = item.badge ? counts[item.badge] : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-spark text-white' : 'text-court-light/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[18px] w-[18px] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {ICONS[item.icon]}
                  </svg>
                  <span>{item.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                        isActive ? 'bg-white text-spark' : 'bg-spark text-white'
                      }`}
                      aria-label={`${count} pending`}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
