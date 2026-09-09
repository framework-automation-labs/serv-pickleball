import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'

// Wrap any admin page with this. Redirects to the hidden login route
// if there's no session, or if the session belongs to a non-admin user.
export default function ProtectedAdminRoute({ children }) {
  const { session, isAdmin, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist">
        <p className="text-ink/50 text-sm">Loading…</p>
      </div>
    )
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}
