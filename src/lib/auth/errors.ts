const PKCE_MISMATCH_HELP =
  'This reset link must be opened in the same browser where you clicked "Send reset link". ' +
  'Or request a new link after your admin updates the Supabase "Reset password" email template ' +
  '(see docs/password-reset-email.md).'

function isPkceVerifierMismatch(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('code challenge') ||
    lower.includes('code verifier') ||
    lower.includes('pkce')
  )
}

/** Turn Supabase Auth (or API) errors into a user-visible string. */
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (error == null) return fallback
  if (typeof error === 'string') {
    const trimmed = error.trim()
    if (!trimmed || trimmed === '{}') return fallback
    if (isPkceVerifierMismatch(trimmed)) return PKCE_MISMATCH_HELP
    return trimmed
  }
  if (typeof error !== 'object') return fallback

  const e = error as Record<string, unknown>

  const message = typeof e.message === 'string' ? e.message.trim() : ''
  if (message && message !== '{}') {
    if (isPkceVerifierMismatch(message)) return PKCE_MISMATCH_HELP
    return message
  }

  const msg = typeof e.msg === 'string' ? e.msg.trim() : ''
  if (msg && msg !== '{}') {
    if (isPkceVerifierMismatch(msg)) return PKCE_MISMATCH_HELP
    return msg
  }

  const description =
    typeof e.error_description === 'string' ? e.error_description.trim() : ''
  if (description && description !== '{}') return description

  if (typeof e.error === 'string' && e.error.trim()) return e.error.trim()

  const code = typeof e.code === 'string' ? e.code : undefined
  if (code) {
    const byCode: Record<string, string> = {
      over_email_send_rate_limit:
        'Email rate limit exceeded. Please wait a few minutes and try again.',
      email_address_invalid: 'That email address is not valid.',
      email_address_not_authorized:
        'This email cannot receive messages yet. Configure custom SMTP in Supabase.',
      validation_failed: 'Please check the email address and try again.',
    }
    if (byCode[code]) return byCode[code]
    return `Authentication error (${code}). Check Supabase Auth logs.`
  }

  return fallback
}
