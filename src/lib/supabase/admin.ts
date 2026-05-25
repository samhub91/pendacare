// Supabase admin client — SERVER ONLY
// Uses the service role key which bypasses RLS.
// NEVER import this file in Client Components or expose it to the browser.
// Requirements: 1.1, 2.7

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key'

// Singleton — reuse across server-side invocations in the same process
export const supabaseAdmin = createClient(
  url,
  serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
