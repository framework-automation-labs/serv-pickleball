import { Routes, Route, Outlet } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PageTransition from './components/PageTransition.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Booking from './pages/Booking.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Checkout from './pages/Checkout.jsx'
import Details from './pages/Details.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import ManageBookings from './pages/admin/ManageBookings.jsx'
import ManageCourts from './pages/admin/ManageCourts.jsx'
import ManageGallery from './pages/admin/ManageGallery.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute.jsx'

export default function App() {
  return (
    <>
    <ThemeToggle />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<PageTransition><Booking /></PageTransition>} />
      <Route path="/details" element={<Details />} />
      <Route path="/checkout" element={<PageTransition><Checkout /></PageTransition>} />
      <Route path="/confirmation/:bookingId" element={<PageTransition><Confirmation /></PageTransition>} />

      {/* Not linked from any nav — only reachable by typing the URL. */}
      <Route
        path="/admin"
        element={
          <AdminAuthProvider>
            <Outlet />
          </AdminAuthProvider>
        }
      >
        <Route path="login" element={<AdminLogin />} />
        <Route
          path="dashboard"
          element={
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="bookings"
          element={
            <ProtectedAdminRoute>
              <ManageBookings />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="courts"
          element={
            <ProtectedAdminRoute>
              <ManageCourts />
            </ProtectedAdminRoute>
          }
        />
        <Route
          path="gallery"
          element={
            <ProtectedAdminRoute>
              <ManageGallery />
            </ProtectedAdminRoute>
          }
        />
      </Route>
    </Routes>
    </>
  )
}
