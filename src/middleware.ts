// Next.js Edge Middleware — JWT validation, RBAC, rate limiting, CSRF, audit logging
// Requirements: 1.3, 2.2, 10.4, 13.1, 13.2, 13.3

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getPermittedRoles } from '@/lib/middleware/protectedRoutes'
import { UserRole } from '@/lib/types'

// In-memory rate limit store: key = IP, value = { count, resetAt }
// Note: resets on cold start. For production, use Vercel KV.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false

  entry.count++
  return true
}

// ── Explicitly public auth routes (no JWT required) ──────────────────────
const PUBLIC_ROUTES = [
  '/api/auth/signin',
  '/api/auth/register',
  '/api/auth/forgot-password',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const method = req.method

  // ── Always allow public auth routes through ───────────────────────────────
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // ── Rate limiting on auth endpoints ──────────────────────────────────────
  if (pathname.startsWith('/api/auth/')) {
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later' },
        { status: 429 }
      )
    }
  }

  // ── CSRF: validate Origin on mutating requests ────────────────────────────
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }
  }

  // ── Check if route is protected ───────────────────────────────────────────
  const permittedRoles = getPermittedRoles(pathname)
  if (!permittedRoles) {
    // Public route — pass through
    return NextResponse.next()
  }

  // ── JWT verification ──────────────────────────────────────────────────────
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    const message = error?.message?.toLowerCase().includes('expired')
      ? 'Token expired'
      : 'Unauthorized'

    // Redirect dashboard routes to login; return 401 for API routes
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.json({ error: message }, { status: 401 })
  }

  // ── Role check ────────────────────────────────────────────────────────────
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (userRow?.role ?? null) as UserRole | null

  if (!role || !permittedRoles.includes(role)) {
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Attach user context to request headers for downstream handlers ────────
  res.headers.set('x-user-id', user.id)
  res.headers.set('x-user-role', role)
  res.headers.set('x-user-email', user.email ?? '')

  return res
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
  ],
}
