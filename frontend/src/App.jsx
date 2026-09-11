import { Routes, Route, Outlet } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Booking from './pages/Booking.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Checkout from './pages/Checkout.jsx'
import Details from './pages/Details.jsx'
import Events from './pages/Events.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import ManageBookings from './pages/admin/ManageBookings.jsx'
import ManageEvents from './pages/admin/ManageEvents.jsx'
import ManageCourts from './pages/admin/ManageCourts.jsx'
import ManageAnnouncements from './pages/admin/ManageAnnouncements.jsx'
import ManageGallery from './pages/admin/ManageGallery.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Booking />} />
      <Route path="/details" element={<Details />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/confirmation/:bookingId" element={<Confirmation />} />
      <Route path="/events" element={<Events />} />

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
          path="events"
          element={
            <ProtectedAdminRoute>
              <ManageEvents />
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
          path="announcements"
          element={
            <ProtectedAdminRoute>
              <ManageAnnouncements />
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
  )
}
