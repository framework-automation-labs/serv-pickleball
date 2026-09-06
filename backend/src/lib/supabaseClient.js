import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + service role key.'
  )
}

// Backend uses the SERVICE ROLE key — this bypasses Row Level Security,
// so it must never be exposed to the frontend or committed to git.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
