import { useAdminAuth } from '../../context/AdminAuthContext.jsx'

export default function AdminHeader({ title }) {
  const { session, signOut } = useAdminAuth()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-4 sm:px-6 lg:px-8">
      <h1 className="font-display text-lg sm:text-xl text-ink">{title}</h1>

      <div className="flex items-center gap-2 sm:gap-4">
        <span className="hidden sm:block max-w-[14rem] truncate text-sm text-ink/60">{session?.user?.email}</span>
        <button
          onClick={signOut}
          className="rounded-lg border border-line text-ink/70 text-xs sm:text-sm font-medium px-2.5 py-1.5 sm:px-3 hover:bg-mist transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}
