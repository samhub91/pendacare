// GET /auth/callback — exchange PKCE code from email links and set session cookies

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getAuthErrorMessage } from '@/lib/auth/errors'
import { getSiteUrl } from '@/lib/auth/siteUrl'

function siteOrigin(req: NextRequest): string {
  return getSiteUrl(req)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const origin = siteOrigin(req)

  if (!code) {
    const err =
      searchParams.get('error_description') ??
      searchParams.get('error')
    if (err) {
      const message = getAuthErrorMessage(
        err,
        'Password reset link failed. Request a new reset email.'
      )
      return NextResponse.redirect(
        new URL(
          `/reset-password?error=${encodeURIComponent(message)}`,
          origin
        )
      )
    }
    return NextResponse.redirect(new URL('/login', origin))
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const message = getAuthErrorMessage(
      error,
      'Password reset link expired or invalid. Request a new reset email.'
    )
    return NextResponse.redirect(
      new URL(
        `/reset-password?error=${encodeURIComponent(message)}`,
        origin
      )
    )
  }

  const res = NextResponse.redirect(new URL(next, origin))

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
