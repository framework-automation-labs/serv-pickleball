import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'

// Number of bookings waiting for review, for the sidebar badges.
// Refreshes every 15 seconds and whenever the tab becomes visible again.
export default function usePendingCounts(intervalMs = 15000) {
  const [counts, setCounts] = useState({ bookings: 0 })

  useEffect(() => {
    let active = true

    async function load() {
      const bookingsRes = await supabase.from('bookings').select('booking_group_id').eq('status', 'pending')
      if (!active) return
      setCounts({
        bookings: bookingsRes.error ? 0 : new Set((bookingsRes.data || []).map((b) => b.booking_group_id)).size,
      })
    }

    load()
    const timer = setInterval(load, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])

  return counts
}
