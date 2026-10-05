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
