import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import StatsCard from '../../components/admin/StatsCard.jsx'
import { supabase } from '../../lib/supabaseClient.js'

function todayDateString() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function displayDate() {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())
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
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-court-dark px-5 py-6 text-white shadow-sm sm:px-7 sm:py-7">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-court-light">Operations overview</p>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Keep the courts moving.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-court-light">
            A quick look at bookings and court activity for today.
          </p>
          <p className="mt-5 text-xs font-medium text-white/60">{displayDate()}</p>
        </div>
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[22px] border-spark/25 sm:h-64 sm:w-64" />
        <div className="absolute -bottom-24 right-20 h-40 w-40 rounded-full border-[14px] border-court-light/15" />
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatsCard label="Today's bookings" value={stats?.todaysBookings} loading={loading} detail="Active today" accent="spark" />
        <StatsCard label="Pending" value={stats?.pendingBookings} loading={loading} detail="Needs attention" accent="court" />
        <StatsCard label="Active courts" value={stats?.activeCourts} loading={loading} detail="Available inventory" accent="green" />
        <StatsCard label="Total bookings" value={stats?.totalBookings} loading={loading} detail="All time" accent="ink" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-court">Today at a glance</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">Booking activity</h3>
            </div>
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-ink/60">Live totals</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span className="text-ink/70">Today's confirmed and pending bookings</span>
                <span className="font-semibold text-ink">{loading ? '—' : stats.todaysBookings}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-mist">
                <div className="h-full rounded-full bg-spark transition-all" style={{ width: loading ? '0%' : `${Math.min(stats.todaysBookings * 10, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span className="text-ink/70">Bookings waiting for review</span>
                <span className="font-semibold text-ink">{loading ? '—' : stats.pendingBookings}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-mist">
                <div className="h-full rounded-full bg-court transition-all" style={{ width: loading ? '0%' : `${Math.min(stats.pendingBookings * 10, 100)}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-court">Quick access</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink">Manage SERV</h3>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Link to="/admin/bookings" className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-court hover:text-white">
              Review bookings <span aria-hidden="true">→</span>
            </Link>
            <Link to="/admin/gallery" className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-court hover:text-white">
              Update gallery <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
