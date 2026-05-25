import type { NextRequest } from 'next/server'

const PRODUCTION_SITE_URL = 'https://pendacare-fawn.vercel.app'

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

function isLocalhost(origin: string): boolean {
  return /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
}

/** Canonical app origin for auth redirect URLs */
export function getSiteUrl(req?: NextRequest): string {
  if (typeof window !== 'undefined') {
    return normalizeOrigin(window.location.origin)
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured && !(process.env.NODE_ENV === 'production' && isLocalhost(configured))) {
    return normalizeOrigin(configured)
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_SITE_URL
  }

  if (req) {
    const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'http'
    const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    if (forwardedHost) {
      return normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
    }
  }

  return 'http://localhost:3000'
}

/**
 * Where Supabase redirects after the user clicks the reset link in email.
 * Use /reset-password (not /auth/callback) so PKCE code exchange runs in the
 * same browser that stored the code verifier when the reset was requested.
 */
export function getPasswordResetRedirectUrl(req?: NextRequest): string {
  return `${getSiteUrl(req)}/reset-password`
}
