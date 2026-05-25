// POST /api/auth/forgot-password
// Sends a password reset email via Supabase Auth

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getPasswordResetRedirectUrl } from '@/lib/auth/siteUrl'

const Schema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach((c) => cookiesToSet.push(c))
        },
      },
    }
  )

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: getPasswordResetRedirectUrl(),
  })

  if (error) {
    // Log the Supabase error for debugging and return the message in development
    console.error('resetPasswordForEmail error:', error)
    const message = process.env.NODE_ENV === 'production' ? 'Failed to send reset email' : error.message
    // Detect rate-limit / throttling errors and return 429 so clients can react accordingly
    if (typeof message === 'string' && /rate|too many|throttl|limit/i.test(message)) {
      return NextResponse.json({ error: 'Email rate limit exceeded. Please wait a few minutes and try again.' }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Always return success to prevent email enumeration
  const res = NextResponse.json({ success: true }, { status: 200 })

  cookiesToSet.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, {
      ...options,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  })

  return res
}
