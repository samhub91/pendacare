// POST /api/auth/refresh
// Requirements: 1.7, 1.8

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.refreshSession()

  if (error || !data.session) {
    // Refresh token expired — redirect to login (Requirement 1.8)
    return NextResponse.redirect(new URL('/login', _req.url))
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
