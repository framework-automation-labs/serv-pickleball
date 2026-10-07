import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AdminAuthContext = createContext(undefined)

// Checks the profiles table for this user's is_admin flag.
// A valid Supabase session is NOT enough on its own — plenty of
// regular customers will have accounts once booking auth is added.
async function fetchIsAdmin(user) {
  if (!user) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.is_admin === true
}

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  // Id of the user we've already verified as admin. Supabase re-fires auth events
  // (SIGNED_IN / TOKEN_REFRESHED) every time the browser tab regains focus; for the
  // same user those must NOT flip `loading` back on, or the whole admin page is
  // swapped for the "Loading…" screen and remounts (which looked like a reload).
  const verifiedUserId = useRef(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      const admin = await fetchIsAdmin(initialSession?.user)
      if (!active) return
      verifiedUserId.current = admin ? initialSession.user.id : null
      setSession(initialSession)
      setIsAdmin(admin)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'INITIAL_SESSION') return // handled by getSession() above

      // Same, already-verified admin (tab refocus / token refresh): just keep the fresh
      // session object and leave the UI alone.
      if (newSession?.user && newSession.user.id === verifiedUserId.current) {
        setSession(newSession)
        return
      }

      // Different user or signed out: verify again. (Deferred — Supabase advises not
      // awaiting other Supabase calls inside this callback.)
      setTimeout(async () => {
        setLoading(true)
        const admin = await fetchIsAdmin(newSession?.user)
        if (!active) return
        verifiedUserId.current = admin ? newSession.user.id : null
        setSession(newSession)
        setIsAdmin(admin)
        setLoading(false)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Signs in, then verifies is_admin. Non-admin accounts (e.g. future
  // customer logins) are signed back out immediately — the admin area
  // should never leave a session open for a non-admin user.
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { error: 'Incorrect email or password.' }
    }

    const admin = await fetchIsAdmin(data.user)

    if (!admin) {
      await supabase.auth.signOut()
      return { error: 'This account is not authorized for admin access.' }
    }

    verifiedUserId.current = data.user.id
    setSession(data.session)
    setIsAdmin(true)
    return { error: null }
  }

  async function signOut() {
    verifiedUserId.current = null
    await supabase.auth.signOut()
    setSession(null)
    setIsAdmin(false)
  }

  return (
    <AdminAuthContext.Provider value={{ session, isAdmin, loading, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
