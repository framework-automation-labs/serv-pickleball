import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', end: true },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/courts', label: 'Courts' },
  { to: '/admin/gallery', label: 'Gallery' },
]

const logoUrl = `${import.meta.env.BASE_URL}serv-logo.png`

export default function AdminSidebar() {
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
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `block shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-spark text-white' : 'text-court-light/80 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
