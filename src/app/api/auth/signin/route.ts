// POST /api/auth/signin
// Requirements: 1.1, 1.2, 1.9, 11.1, 11.2

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type JwtAccessPayload = {
  user_role?: string
}

function readUserRoleFromAccessToken(accessToken: string): string | null {
  try {
    const payloadJson = Buffer.from(accessToken.split('.')[1], 'base64').toString()
    const payload = JSON.parse(payloadJson) as JwtAccessPayload
    return typeof payload.user_role === 'string' ? payload.user_role : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SignInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email, password } = parsed.data

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookies) { cookies.forEach((c) => cookiesToSet.push(c)) },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // Role is embedded in the JWT via custom_access_token_hook.
  // Fall back to a direct DB query only if the hook isn't enabled yet.
  const roleFromJwt = data.session?.access_token
    ? readUserRoleFromAccessToken(data.session.access_token)
    : null

  let role = roleFromJwt

  if (!role) {
    // Fallback: query public.users using admin client (hook not yet enabled)
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()
    role = userRow?.role ?? null
  }

  if (!role) {
    return NextResponse.json(
      { error: 'User profile not found. Please contact support.' },
      { status: 401 }
    )
  }

  const res = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role,
    }
  }, { status: 200 })

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
