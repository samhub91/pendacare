/** Canonical app origin for auth redirect URLs */
export function getSiteUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

/**
 * Where Supabase redirects after the user clicks the reset link in email.
 * Use /reset-password (not /auth/callback) so PKCE code exchange runs in the
 * same browser that stored the code verifier when the reset was requested.
 */
export function getPasswordResetRedirectUrl(): string {
  return `${getSiteUrl()}/reset-password`
}
