import { supabaseAdmin } from '../lib/supabaseClient.js'

// Protects endpoints that must only run for a logged-in admin — e.g.
// approving/rejecting a receipt, which also triggers an email to the
// customer. The frontend sends the admin's Supabase access token; we
// verify it server-side and re-check profiles.is_admin ourselves
// rather than trusting anything the client claims.
export async function requireAdmin(req, res, next) {
  try {
    await verify(req, res, next)
  } catch (err) {
    console.error('[requireAdmin]', err)
    res.status(500).json({ error: 'Could not verify your session.' })
  }
}

async function verify(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    // Log WHY Supabase refused the token (e.g. session_not_found = revoked by a logout on
    // another device, bad_jwt / jwt expired = stale token) — visible in the Render logs.
    console.warn('[requireAdmin] getUser failed:', userError?.status, userError?.code, userError?.message)

    // A network hiccup / Supabase 5xx / rate limit is NOT an invalid session — don't make
    // the admin think they're logged out (and don't trigger a sign-out on the client).
    const transient = userError && (userError.status === 0 || userError.status >= 500 || userError.status === 429)
    if (transient) {
      return res.status(503).json({ error: 'Could not reach the login service. Please try again in a moment.' })
    }
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return res.status(403).json({ error: 'Admin access required.' })
  }

  req.adminUserId = userData.user.id
  next()
}
