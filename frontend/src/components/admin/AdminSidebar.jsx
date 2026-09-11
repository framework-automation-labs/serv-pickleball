import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', end: true },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/courts', label: 'Courts' },
  { to: '/admin/announcements', label: 'Announcements' },
  { to: '/admin/gallery', label: 'Gallery' },
]

export default function AdminSidebar() {
  return (
    <aside className="w-56 shrink-0 bg-court-dark text-court-light min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-white/10">
        <img src="/serv-logo.png" alt="SERV Pickleball Club" className="h-10 mb-2" />
        <p className="text-xs uppercase tracking-widest text-spark font-semibold">Admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
