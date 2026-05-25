'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { getAuthErrorMessage } from '@/lib/auth/errors'
import { LogoMark } from '@/components/brand/LogoMark'

type LinkStatus = 'checking' | 'ready' | 'error'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }
  const passwordStrong = Object.values(passwordChecks).every(Boolean)
  const passwordsMatch = password === confirmPassword
  const canSubmit =
    sessionReady &&
    passwordStrong &&
    passwordsMatch &&
    confirmPassword.length > 0 &&
    !loading

  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlErrorDescription = searchParams.get('error_description')
    const raw = urlErrorDescription ?? urlError
    if (raw) {
      const decoded = decodeURIComponent(raw.replace(/\+/g, ' '))
      setError(
        getAuthErrorMessage(
          decoded,
          'This reset link is invalid or expired. Request a new one below.'
        )
      )
      setLinkStatus('error')
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    function markReady() {
      if (!cancelled) {
        setSessionReady(true)
        setLinkStatus('ready')
        setError(null)
      }
    }

    function markError(err: unknown) {
      if (!cancelled) {
        setError(
          getAuthErrorMessage(
            err,
            'This reset link is invalid or expired. Request a new one below.'
          )
        )
        setLinkStatus('error')
        setSessionReady(false)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === 'PASSWORD_RECOVERY' ||
          event === 'SIGNED_IN' ||
          event === 'INITIAL_SESSION')
      ) {
        markReady()
      }
    })

    async function establishSession() {
      try {
        const qp = new URLSearchParams(window.location.search)
        const hashParams = window.location.hash
          ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
          : null

        const urlError =
          qp.get('error_description') ??
          qp.get('error') ??
          hashParams?.get('error_description') ??
          hashParams?.get('error')
        if (urlError) {
          markError(decodeURIComponent(urlError.replace(/\+/g, ' ')))
          return
        }

        const { data: { user: existing } } = await supabase.auth.getUser()
        if (existing) {
          markReady()
          return
        }

        const token_hash =
          qp.get('token_hash') ?? hashParams?.get('token_hash')
        if (token_hash) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash,
          })
          if (otpError) {
            markError(otpError)
          } else {
            markReady()
          }
          return
        }

        const code = qp.get('code')
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            markError(exchangeError)
          } else {
            markReady()
            window.history.replaceState({}, '', '/reset-password')
          }
          return
        }

        const access_token = hashParams?.get('access_token')
        const refresh_token = hashParams?.get('refresh_token')
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (sessionError) {
            markError(sessionError)
          } else {
            markReady()
            window.history.replaceState({}, '', '/reset-password')
          }
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 600))
        const { data: { user: afterInit } } = await supabase.auth.getUser()
        if (afterInit) {
          markReady()
          return
        }

        markError(
          'This reset link is invalid or has expired. Request a new one below.'
        )
      } catch {
        markError('Could not verify your reset link. Please request a new one.')
      }
    }

    establishSession()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleResend() {
    if (!resendEmail) return
    setResendStatus(null)
    setResendLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setResendStatus(
          getAuthErrorMessage(
            data.error ?? 'Failed to send reset email',
            'Failed to send reset email. Check Gmail SMTP in Supabase.'
          )
        )
      } else {
        setResendStatus('Reset email sent (if the address exists in our system).')
      }
    } catch {
      setResendStatus('Network error. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!sessionReady) {
      setError('Your reset link is not valid. Please request a new reset email.')
      return
    }
    if (!passwordStrong) {
      setError('Password does not meet the requirements below')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(getAuthErrorMessage(updateError, 'Failed to update password. Please try again.'))
        return
      }

      await supabase.auth.signOut()
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center group">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-lg overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform duration-200">
              <LogoMark />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Pendacare</h1>
          </Link>
          <p className="text-gray-500 mt-1 text-sm">Caregiving Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Password updated</h2>
              <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Set new password</h2>
              <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account</p>

              {linkStatus === 'checking' && (
                <div className="flex items-start gap-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                  <svg className="h-4 w-4 mt-0.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Verifying your reset link…
                </div>
              )}

              {linkStatus === 'ready' && (
                <div className="flex items-start gap-2.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
                  <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Reset link verified. Enter your new password below.
                </div>
              )}

              {linkStatus === 'error' && (
                <div className="mb-5 space-y-3">
                  {error && (
                    <div role="alert" className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}
                  <div className="text-sm text-gray-700">Request a new password reset link</div>
                  <div className="flex gap-2">
                    <input
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      disabled={resendLoading || !resendEmail}
                      onClick={handleResend}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {resendLoading ? 'Sending…' : 'Resend'}
                    </button>
                  </div>
                  {resendStatus && <p className="text-xs text-gray-600">{resendStatus}</p>}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null) }}
                      placeholder="Min. 8 characters"
                      disabled={!sessionReady}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
                    />
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {[
                        { label: 'At least 8 characters', met: passwordChecks.length },
                        { label: 'One uppercase letter', met: passwordChecks.uppercase },
                        { label: 'One lowercase letter', met: passwordChecks.lowercase },
                        { label: 'One number', met: passwordChecks.number },
                      ].map(({ label, met }) => (
                        <span key={label} className={`text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
                    placeholder="Re-enter your new password"
                    disabled={!sessionReady}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  >
                    {showPassword ? 'Hide passwords' : 'Show passwords'}
                  </button>
                </div>

                {error && linkStatus === 'ready' && (
                  <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-500/70 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-brand-600 font-medium">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Pendacare · Australian Healthcare Compliance
        </p>
      </div>
    </div>
  )
}

function ResetPasswordFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100/50 flex items-center justify-center p-4">
      <div className="text-sm font-semibold text-brand-700">Loading reset form...</div>
    </div>
  )
}
