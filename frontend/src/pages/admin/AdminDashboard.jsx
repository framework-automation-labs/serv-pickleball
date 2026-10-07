import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import StatsCard from '../../components/admin/StatsCard.jsx'
import NeedsAttention from '../../components/admin/NeedsAttention.jsx'
import BookingTrend from '../../components/admin/BookingTrend.jsx'
import AnimatedNumber from '../../components/AnimatedNumber.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import { generateHourSlots } from '../../lib/api.js'
import {
  addDays,
  endHour,
  groupByBookingGroup,
  hoursSince,
  localDateString,
  startHour,
} from '../../components/admin/adminUtils.js'

const REFRESH_MS = 15000

const hoursOf = (b) => Math.max(0, endHour(b.end_time) - startHour(b.start_time))

function UtilizationCard({ pct, detail, loading }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="absolute inset-y-0 left-0 w-1 bg-ink" />
      <div className="flex items-center justify-between gap-3 pl-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Utilization today</p>
          <p className="font-display text-2xl text-ink sm:text-3xl">
            {loading ? (
              '—'
            ) : (
              <>
                <AnimatedNumber value={pct} />%
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-ink/45">{detail}</p>
        </div>
        <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="none" strokeWidth="5" className="stroke-line" />
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            strokeWidth="5"
            strokeLinecap={pct > 0 ? 'round' : 'butt'}
            className="stroke-spark"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: loading ? 0 : pct / 100 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Read-only queries (the same tables and joins the admin pages already read).
  const load = useCallback(async () => {
    const today = localDateString()
    const weekStart = localDateString(addDays(new Date(), -6))

    const [courtsRes, todayRes, blockedRes, weekRes, pendingBookingsRes] = await Promise.all([
      supabase.from('courts').select('id, name').eq('status', 'active').order('id'),
      supabase.from('bookings').select('*, courts(name)').eq('booking_date', today).neq('status', 'cancelled').order('start_time'),
      supabase.from('blocked_slots').select('court_id, start_time, end_time').eq('blocked_date', today),
      supabase
        .from('bookings')
        .select('booking_date, start_time, end_time')
        .gte('booking_date', weekStart)
        .lte('booking_date', today)
        .neq('status', 'cancelled'),
      supabase.from('bookings').select('*, courts(name)').eq('status', 'pending').order('created_at').limit(200),
    ])

    const failed = [courtsRes, todayRes, blockedRes, weekRes, pendingBookingsRes].some((r) => r.error)
    setError(failed ? 'Some dashboard data could not be loaded. Showing what is available.' : '')
    setData({
      today,
      courts: courtsRes.data || [],
      todayBookings: todayRes.data || [],
      blocked: blockedRes.data || [],
      week: weekRes.data || [],
      pendingBookings: pendingBookingsRes.data || [],
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [load])

  const stats = useMemo(() => {
    if (!data) return null
    const { courts, todayBookings, blocked, week, pendingBookings } = data
    const activeIds = new Set(courts.map((c) => c.id))
    const openHours = generateHourSlots().length

    const bookedHours = todayBookings.filter((b) => activeIds.has(b.court_id)).reduce((s, b) => s + hoursOf(b), 0)
    const blockedHours = blocked.filter((b) => activeIds.has(b.court_id)).reduce((s, b) => s + hoursOf(b), 0)
    const availableHours = Math.max(0, courts.length * openHours - blockedHours)
    const utilization = availableHours ? Math.min(100, Math.round((bookedHours / availableHours) * 100)) : 0

    const pendingCount = groupByBookingGroup(pendingBookings).length
    const oldestWait = pendingBookings.reduce((max, x) => Math.max(max, hoursSince(x.created_at)), 0)

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(), i - 6)
      const key = localDateString(d)
      return {
        key,
        hours: week.filter((b) => b.booking_date === key).reduce((s, b) => s + hoursOf(b), 0),
        label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
        isToday: i === 6,
      }
    })

    return {
      todayGroups: new Set(todayBookings.map((b) => b.booking_group_id)).size,
      bookedHours,
      availableHours,
      utilization,
      pendingCount,
      oldestWait,
      activeCourts: courts.length,
      openHours,
      days,
    }
  }, [data])

  return (
    <AdminLayout title="Dashboard">
      <NeedsAttention
        bookings={data?.pendingBookings || []}
        loading={loading}
        onChanged={load}
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatsCard
          label="Today's bookings"
          value={stats?.todayGroups}
          loading={loading}
          detail={stats ? `${stats.bookedHours} court-hours booked` : ''}
          accent="spark"
        />
        <StatsCard
          label="Pending review"
          value={stats?.pendingCount}
          loading={loading}
          detail={
            stats
              ? stats.pendingCount === 0
                ? 'All caught up'
                : stats.oldestWait >= 1
                ? `Oldest waiting ${stats.oldestWait}h`
                : 'Just arrived'
              : ''
          }
          accent="court"
        />
        <UtilizationCard
          pct={stats?.utilization ?? 0}
          loading={loading}
          detail={stats ? `${stats.bookedHours} of ${stats.availableHours} hours` : ''}
        />
        <StatsCard
          label="Active courts"
          value={stats?.activeCourts}
          loading={loading}
          detail={stats ? `${stats.openHours} open hours a day` : ''}
          accent="green"
        />
      </div>

      <BookingTrend days={stats?.days || []} loading={loading} />
    </AdminLayout>
  )
}
