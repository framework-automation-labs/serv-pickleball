import { useAdminAuth } from '../../context/AdminAuthContext.jsx'

export default function AdminHeader({ title }) {
  const { session, signOut } = useAdminAuth()

  return (
    <header className="flex items-center justify-between border-b border-line bg-white px-8 py-4">
      <h1 className="font-display text-xl text-ink">{title}</h1>

      <div className="flex items-center gap-4">
        <span className="text-sm text-ink/60">{session?.user?.email}</span>
        <button
          onClick={signOut}
          className="rounded-lg border border-line text-ink/70 text-sm font-medium px-3 py-1.5 hover:bg-mist transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}
