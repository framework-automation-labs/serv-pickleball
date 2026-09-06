import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key.'
  )
}

// Frontend ALWAYS uses the anon key — never the service role key.
// Row Level Security policies (set up in serv_schema.sql) control
// what each user can actually see/do.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
