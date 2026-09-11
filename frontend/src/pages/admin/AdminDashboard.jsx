import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import StatsCard from '../../components/admin/StatsCard.jsx'
import { supabase } from '../../lib/supabaseClient.js'

function todayDateString() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadStats() {
      const today = todayDateString()

      const [activeCourts, todaysBookings, pendingBookings, totalBookings] = await Promise.all([
        supabase.from('courts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('booking_date', today)
          .neq('status', 'cancelled'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
      ])

      if (!active) return
      setStats({
        activeCourts: activeCourts.count ?? 0,
        todaysBookings: todaysBookings.count ?? 0,
        pendingBookings: pendingBookings.count ?? 0,
        totalBookings: totalBookings.count ?? 0,
      })
      setLoading(false)
    }

    loadStats()
    return () => {
      active = false
    }
  }, [])

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Today's Bookings" value={stats?.todaysBookings} loading={loading} />
        <StatsCard label="Pending Bookings" value={stats?.pendingBookings} loading={loading} />
        <StatsCard label="Active Courts" value={stats?.activeCourts} loading={loading} />
        <StatsCard label="Total Bookings" value={stats?.totalBookings} loading={loading} />
      </div>

      <div className="bg-white rounded-2xl border border-line px-6 py-8 text-center text-ink/50 text-sm">
        Booking management, events, and gallery tools live in the sidebar — each one's coming online next.
      </div>
    </AdminLayout>
  )
}
