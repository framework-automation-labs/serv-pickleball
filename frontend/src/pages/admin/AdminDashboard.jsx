import { useAdminAuth } from '../../context/AdminAuthContext.jsx'

// Placeholder landing page — confirms the auth flow works end to end.
// Sidebar/header/stats/routing for ManageBookings, ManageEvents, etc.
// come next.
export default function AdminDashboard() {
  const { session, signOut } = useAdminAuth()

  return (
    <div className="min-h-screen bg-mist px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl text-ink mb-2">Admin Dashboard</h1>
        <p className="text-ink/60 mb-6">Signed in as {session?.user?.email}</p>
        <button
          onClick={signOut}
          className="rounded-lg bg-court-dark text-white text-sm font-medium px-4 py-2 hover:bg-court transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
