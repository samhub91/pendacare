'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogoMark } from '@/components/brand/LogoMark'

type RegisterRole = 'caregiver' | 'client' | 'family_member'

const ROLES: { value: RegisterRole; label: string; desc: string }[] = [
  { value: 'caregiver', label: 'Caregiver', desc: 'Deliver care and log visit reports' },
  { value: 'client', label: 'Client / Patient', desc: 'View your care schedule and profile' },
  { value: 'family_member', label: 'Family Member', desc: 'Monitor care for a loved one' },
]

const CARE_TYPES = [
  { value: 'elderly', label: 'Elderly care' },
  { value: 'disability', label: 'Disability support' },
  { value: 'childcare', label: 'Childcare' },
] as const

const STEP_LABELS = ['Your role', 'Account', 'Your details']

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [role, setRole] = useState<RegisterRole | ''>('')
  const [account, setAccount] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  })
  const [caregiverDetails, setCaregiverDetails] = useState({
    qualifications: '',
    availability_notes: '',
  })
  const [clientDetails, setClientDetails] = useState({
    date_of_birth: '',
    care_type: 'elderly' as 'elderly' | 'disability' | 'childcare',
    emergency_name: '',
    emergency_phone: '',
    emergency_relationship: '',
  })
  const [familyDetails, setFamilyDetails] = useState({
    client_email: '',
    recipient_name: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const passwordChecks = {
    length: account.password.length >= 8,
    uppercase: /[A-Z]/.test(account.password),
    lowercase: /[a-z]/.test(account.password),
    number: /[0-9]/.test(account.password),
  }
  const passwordStrong = Object.values(passwordChecks).every(Boolean)

  function validateStep1(): string | null {
    if (!role) return 'Please select your role'
    return null
  }

  function validateStep2(): string | null {
    if (!account.name.trim()) return 'Full name is required'
    if (!account.email.trim()) return 'Email address is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) return 'Enter a valid email address'
    if (!account.phone.trim()) return 'Phone number is required'
    if (!passwordStrong) return 'Password does not meet the requirements below'
    if (account.password !== account.confirmPassword) return 'Passwords do not match'
    return null
  }

  function validateStep3(): string | null {
    if (role === 'client') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(clientDetails.date_of_birth)) {
        return 'Date of birth is required (YYYY-MM-DD)'
      }
      if (!clientDetails.emergency_name.trim()) return 'Emergency contact name is required'
      if (!clientDetails.emergency_phone.trim()) return 'Emergency contact phone is required'
      if (!clientDetails.emergency_relationship.trim()) return 'Emergency contact relationship is required'
    }
    if (role === 'family_member') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(familyDetails.client_email)) {
        return 'Enter the care recipient’s account email'
      }
    }
    return null
  }

  function buildPayload() {
    const base = {
      name: account.name.trim(),
      email: account.email.trim(),
      password: account.password,
      phone: account.phone.trim(),
      role,
    }
    if (role === 'caregiver') {
      return {
        ...base,
        qualifications: caregiverDetails.qualifications,
        availability_notes: caregiverDetails.availability_notes,
      }
    }
    if (role === 'client') {
      return {
        ...base,
        date_of_birth: clientDetails.date_of_birth,
        care_type: clientDetails.care_type,
        emergency_contact: {
          name: clientDetails.emergency_name.trim(),
          phone: clientDetails.emergency_phone.trim(),
          relationship: clientDetails.emergency_relationship.trim(),
        },
      }
    }
    return {
      ...base,
      client_email: familyDetails.client_email.trim(),
      recipient_name: familyDetails.recipient_name.trim() || undefined,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateStep3()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.')
        return
      }
      router.push('/login?registered=1')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center group">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-lg overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform duration-200">
              <LogoMark />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Pendacare</h1>
          </Link>
          <p className="text-gray-500 mt-1 text-sm">Caregiving Management System</p>
        </div>

        <div className="flex items-center gap-2 mb-6 px-1">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              <span className={`text-xs font-medium truncate ${step >= s ? 'text-brand-600' : 'text-gray-400'}`}>
                {STEP_LABELS[i]}
              </span>
              {s < 3 && (
                <div className={`flex-1 h-0.5 rounded min-w-[8px] ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Choose your role</h2>
              <p className="text-sm text-gray-500 mb-4">This determines what you can access in Pendacare.</p>
              <p className="text-xs text-gray-500 mb-6 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                Administrator accounts are created by your organisation.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const err = validateStep1()
                  if (err) {
                    setError(err)
                    return
                  }
                  setError(null)
                  setStep(2)
                }}
                className="space-y-3"
              >
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      role === r.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => {
                        setRole(r.value)
                        setError(null)
                      }}
                      className="mt-0.5 accent-brand-600"
                    />
                    <div>
                      <p className={`text-sm font-semibold ${role === r.value ? 'text-brand-700' : 'text-gray-800'}`}>
                        {r.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </div>
                  </label>
                ))}
                {error && <Alert>{error}</Alert>}
                <button type="submit" className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm">
                  Continue
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h2>
              <p className="text-sm text-gray-500 mb-6">Your login details and contact phone.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const err = validateStep2()
                  if (err) {
                    setError(err)
                    return
                  }
                  setError(null)
                  setStep(3)
                }}
                className="space-y-4"
              >
                <Field label="Full name">
                  <input
                    type="text"
                    required
                    value={account.name}
                    onChange={(e) => setAccount((a) => ({ ...a, name: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Email address">
                  <input
                    type="email"
                    required
                    value={account.email}
                    onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    required
                    value={account.phone}
                    onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Password">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={account.password}
                    onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                    className={inputClass}
                  />
                  {account.password.length > 0 && (
                    <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                      <li className={passwordChecks.length ? 'text-green-600' : ''}>At least 8 characters</li>
                      <li className={passwordChecks.uppercase ? 'text-green-600' : ''}>One uppercase letter</li>
                      <li className={passwordChecks.lowercase ? 'text-green-600' : ''}>One lowercase letter</li>
                      <li className={passwordChecks.number ? 'text-green-600' : ''}>One number</li>
                    </ul>
                  )}
                </Field>
                <Field label="Confirm password">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={account.confirmPassword}
                    onChange={(e) => setAccount((a) => ({ ...a, confirmPassword: e.target.value }))}
                    className={inputClass}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                    Show passwords
                  </label>
                </Field>
                {error && <Alert>{error}</Alert>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700">
                    Back
                  </button>
                  <button type="submit" className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold">
                    Continue
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 3 && role && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Your details</h2>
              <p className="text-sm text-gray-500 mb-6">
                {role === 'caregiver' && 'Tell us about your qualifications and availability.'}
                {role === 'client' && 'Help your care team prepare with accurate profile information.'}
                {role === 'family_member' && 'Request access to your loved one’s care updates.'}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                {role === 'caregiver' && (
                  <>
                    <Field label="Qualifications (optional)">
                      <textarea
                        rows={3}
                        value={caregiverDetails.qualifications}
                        onChange={(e) =>
                          setCaregiverDetails((d) => ({ ...d, qualifications: e.target.value }))
                        }
                        placeholder="One per line or comma-separated"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Availability notes (optional)">
                      <textarea
                        rows={2}
                        value={caregiverDetails.availability_notes}
                        onChange={(e) =>
                          setCaregiverDetails((d) => ({ ...d, availability_notes: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                  </>
                )}
                {role === 'client' && (
                  <>
                    <Field label="Date of birth">
                      <input
                        type="date"
                        required
                        value={clientDetails.date_of_birth}
                        onChange={(e) =>
                          setClientDetails((d) => ({ ...d, date_of_birth: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Care type">
                      <select
                        value={clientDetails.care_type}
                        onChange={(e) =>
                          setClientDetails((d) => ({
                            ...d,
                            care_type: e.target.value as typeof d.care_type,
                          }))
                        }
                        className={inputClass}
                      >
                        {CARE_TYPES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="text-sm font-medium text-gray-700 pt-2">Emergency contact</p>
                    <Field label="Name">
                      <input
                        required
                        value={clientDetails.emergency_name}
                        onChange={(e) =>
                          setClientDetails((d) => ({ ...d, emergency_name: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        required
                        value={clientDetails.emergency_phone}
                        onChange={(e) =>
                          setClientDetails((d) => ({ ...d, emergency_phone: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Relationship">
                      <input
                        required
                        value={clientDetails.emergency_relationship}
                        onChange={(e) =>
                          setClientDetails((d) => ({ ...d, emergency_relationship: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                  </>
                )}
                {role === 'family_member' && (
                  <>
                    <Field label="Care recipient’s account email">
                      <input
                        type="email"
                        required
                        value={familyDetails.client_email}
                        onChange={(e) =>
                          setFamilyDetails((d) => ({ ...d, client_email: e.target.value }))
                        }
                        placeholder="The email they used to register as a client"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Their name (optional)">
                      <input
                        value={familyDetails.recipient_name}
                        onChange={(e) =>
                          setFamilyDetails((d) => ({ ...d, recipient_name: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <p className="text-xs text-gray-500 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
                      An administrator will review your request and link your account when approved.
                    </p>
                  </>
                )}
                {error && <Alert>{error}</Alert>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-brand-600 disabled:bg-brand-500/70 text-white rounded-xl text-sm font-semibold"
                  >
                    {loading ? 'Creating…' : 'Create account'}
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400">Already have an account?</span>
            </div>
          </div>
          <Link
            href="/login"
            className="w-full flex items-center justify-center py-2.5 border border-gray-300 hover:border-brand-500 text-gray-700 font-semibold rounded-xl text-sm"
          >
            Sign in instead
          </Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      {children}
    </div>
  )
}
