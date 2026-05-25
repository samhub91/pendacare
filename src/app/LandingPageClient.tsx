'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { LogoMark } from '@/components/brand/LogoMark'
import type { LeadCareType } from '@/lib/leads'

interface LandingPageClientProps {
  dashboardHref: string | null
}

const careTypes: Array<{ value: LeadCareType; label: string }> = [
  { value: 'elderly', label: 'Elderly care' },
  { value: 'disability', label: 'Disability support' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'other', label: 'Other support' },
]

const faqs = [
  {
    question: 'How does the Electronic Visit Verification (EVV) system work?',
    answer: 'Pendacare captures coordinate-based geolocation points during shift check-in and check-out. This ensures shift presence is verified and recorded transparently for operational and auditing compliance without requiring intrusive GPS tracking.',
  },
  {
    question: 'Can family members see updates and care summaries?',
    answer: 'Yes. Family member accounts can link to a client profile with administrator approval. Once approved, they can view daily care summaries, schedules, medication records, and exchange messages with caregivers.',
  },
  {
    question: 'How are sensitive medication logs (MAR) and health records secured?',
    answer: 'Pendacare employs strict database-level Row Level Security (RLS), encrypts sensitive health information, restricts access to authorised roles (caregivers, clients, family, admins), and records all sensitive changes to an unalterable audit log.',
  },
  {
    question: 'Can an organization manage multiple caregiver roles?',
    answer: 'Absolutely. Administrators can assign caregivers to specific clients, manage scheduling conflicts, review high-severity incidents, verify medication compliance, and download operational logs from a unified admin dashboard.',
  },
]

const complianceItems = [
  'Privacy Act 1988 & APP aligned records',
  'Strict Role-Based Access Controls (RBAC)',
  'Automatic Database Auditing Triggers',
  'NDIS Care Coordination Workflows',
]

export function LandingPageClient({ dashboardHref }: LandingPageClientProps) {
  const [hours, setHours] = useState(15)
  const [rate, setRate] = useState(72)
  const [openFaq, setOpenFaq] = useState(0)
  const [previewTab, setPreviewTab] = useState<'evv' | 'mar' | 'incidents'>('evv')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    care_type: 'elderly' as LeadCareType,
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const estimate = useMemo(() => {
    const weekly = hours * rate
    return {
      weekly,
      monthly: Math.round(weekly * 4.33),
      annual: Math.round(weekly * 52),
    }
  }, [hours, rate])

  const careIntensity = useMemo(() => {
    if (hours < 12) {
      return {
        level: 'Standard Support',
        description: 'Perfect for scheduled wellness check-ins, medication prompts, and light housekeeping.',
        colorClass: 'bg-emerald-500',
        widthClass: 'w-1/3',
      }
    } else if (hours >= 12 && hours < 30) {
      return {
        level: 'Enhanced Care',
        description: 'Ideal for daily physical support, active personal care, and regular therapy exercises.',
        colorClass: 'bg-brand-500',
        widthClass: 'w-2/3',
      }
    } else {
      return {
        level: 'Comprehensive Support',
        description: 'Designed for high-intensity support, multiple daily rosters, and clinical coordination needs.',
        colorClass: 'bg-brand-700',
        widthClass: 'w-full',
      }
    }
  }, [hours])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        const firstError = data.errors
          ? Object.values(data.errors).flat().filter(Boolean)[0]
          : data.error
        setStatus({
          kind: 'error',
          message: typeof firstError === 'string' ? firstError : 'Please check the form inputs and try again.',
        })
        return
      }

      setStatus({ kind: 'success', message: 'Thank you! The Pendacare team will reach out to you shortly.' })
      setForm({ name: '', email: '', phone: '', care_type: 'elderly', message: '' })
    } catch {
      setStatus({ kind: 'error', message: 'A connection error occurred. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fbf6] text-gray-900 selection:bg-brand-200 selection:text-brand-700">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm transition-transform duration-300 group-hover:scale-105">
              <LogoMark size={32} />
            </span>
            <span className="text-xl font-bold tracking-tight text-brand-700">Pendacare</span>
          </Link>
          
          <div className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#features" className="transition-colors duration-200 hover:text-brand-700">Platform Features</a>
            <a href="#preview" className="transition-colors duration-200 hover:text-brand-700">Live Preview</a>
            <a href="#estimator" className="transition-colors duration-200 hover:text-brand-700">NDIS Estimator</a>
            <a href="#contact" className="transition-colors duration-200 hover:text-brand-700">Contact Us</a>
          </div>

          <div className="flex items-center gap-3">
            {dashboardHref ? (
              <Link href={dashboardHref} className="rounded-full bg-brand-700 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-brand-600 hover:shadow-lg transition-all duration-200">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors duration-200">
                  Sign in
                </Link>
                <Link href="/register" className="rounded-full bg-brand-700 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-brand-600 hover:shadow-lg transition-all duration-200">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f8fbf6] py-16 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center rounded-full border border-brand-200 bg-brand-50/60 px-4 py-1.5 text-xs font-semibold text-brand-700 uppercase tracking-wider">
              NDIS Compliant Care Management
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] text-gray-900 sm:text-5xl lg:text-6xl tracking-tight">
              Accountability and trust in every care shift.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Manage EVV rosters, Medication Records (MAR), high-priority incident escalations, and secure family updates in a beautiful, compliant hub built for modern care providers.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="rounded-full bg-brand-700 px-8 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-700/30 transition-all duration-200">
                Request Service Info
              </a>
              <Link href={dashboardHref ?? '/login'} className="rounded-full border border-gray-300 bg-white px-8 py-3.5 text-center text-sm font-bold text-gray-700 shadow-sm hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-all duration-200">
                {dashboardHref ? 'Go to Dashboard' : 'Explore Platform'}
              </Link>
            </div>
            
            <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6">
              {[
                ['4 Role Scopes', 'Tailored portals'],
                ['Real-time EVV', 'Coordinate validation'],
                ['Audit Triggers', 'Secure compliance'],
              ].map(([value, label]) => (
                <div key={label} className="border-l-2 border-brand-500/30 pl-4">
                  <dt className="text-2xl font-bold text-brand-700">{value}</dt>
                  <dd className="text-xs text-gray-500 mt-1">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative hidden min-h-[460px] lg:block">
            <div className="absolute inset-0 -mr-6 rounded-[2.5rem] bg-gradient-to-tr from-brand-100 to-emerald-50/50 transform translate-x-4 translate-y-4" />
            <div className="relative h-[480px] w-full overflow-hidden rounded-[2.5rem] border border-brand-100/50 bg-white shadow-2xl">
              <Image
                src="/elderly-care.png"
                alt="Professional, caring support for elderly client"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 600px"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Shift Active</span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-gray-900">Jane Doe checked in at Arthur Pendragon</p>
                <p className="mt-0.5 text-xs text-gray-600">Location verified via coordinates [-33.8688, 151.2093]</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Features Section */}
      <section id="features" className="bg-[#f2f7ef] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="relative h-[480px] w-full overflow-hidden rounded-3xl border border-brand-100/50 bg-white shadow-xl">
              <Image
                src="/disability-care.png"
                alt="Empowering disability support worker and client"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 600px"
              />
            </div>
            
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Platform Features</p>
              <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
                Designed for high-trust Australian care agencies.
              </h2>
              <p className="mt-4 text-base text-gray-600 leading-relaxed">
                Empower your administrators, caregivers, clients, and family members with tools designed specifically to meet compliance guidelines, record medication accurately, and verify visits.
              </p>
              
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  ['Caregiver Roster & EVV', 'Verify caregiver presence with secure geolocation check-ins and structured shift reports.'],
                  ['Family Transparency Portal', 'Provide family members access to shift calendars, messaging, and health updates.'],
                  ['Medication Auditing (MAR)', 'Maintain zero-error medication safety logs with detailed administration history.'],
                  ['Instant Escalations', 'Auto-escalate high-severity incidents to dashboard alerts and email notifications.'],
                ].map(([title, description]) => (
                  <article key={title} className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                    <h3 className="font-bold text-gray-900 text-base">{title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive App Previewer (Tabbed Showcase) */}
      <section id="preview" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Interactive Preview</p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
              See how Pendacare works in real-time.
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Toggle the screens below to preview key features of our care coordination and compliance portal.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="mt-10 flex justify-center border-b border-gray-100">
            <div className="flex gap-2 sm:gap-6">
              {[
                { id: 'evv' as const, label: 'Visit Verification (EVV)' },
                { id: 'mar' as const, label: 'Medication Logs (MAR)' },
                { id: 'incidents' as const, label: 'Incident Escalation' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPreviewTab(tab.id)}
                  className={`border-b-2 px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                    previewTab === tab.id
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-500 hover:text-gray-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Screen Container */}
          <div className="mt-8 mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-gray-50 p-3 shadow-xl sm:p-5">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              
              {/* Fake Browser/App Header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-[#f8fbf6] px-5 py-3 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="font-medium tracking-wide">PENDACARE CLOUD - PORTAL PREVIEW</div>
                <div className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">SECURE SSL</div>
              </div>

              {/* Tab Content 1: EVV */}
              {previewTab === 'evv' && (
                <div className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Shift Verification Log</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Electronic Visit Verification (EVV) coordinates check-in</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      GPS Proximity Match
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Assigned Caregiver</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">Jane Doe, AIN</p>
                      <p className="text-[11px] text-gray-600">ID: PC-8041</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Scheduled Hours</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">14:30 – 16:30</p>
                      <p className="text-[11px] text-emerald-700 font-medium">On-Time Check-In</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Client / Recipient</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">Arthur Pendragon</p>
                      <p className="text-[11px] text-gray-600">Sydney Metro East</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-brand-800">Verified Geolocation Coordinates</h5>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-xs text-gray-700">
                        Latitude: <span className="font-bold text-gray-950">-33.8688</span> | Longitude: <span className="font-bold text-gray-950">151.2093</span>
                      </div>
                      <div className="text-xs font-bold text-brand-700">
                        ✓ Registered inside 100m client threshold
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content 2: MAR */}
              {previewTab === 'mar' && (
                <div className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Medication Administration Record (MAR)</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Shift compliance & health professional auditing logs</p>
                    </div>
                    <div className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
                      Compliance Rating: 98.7%
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold">
                          <th className="p-3">Medication</th>
                          <th className="p-3">Dosage</th>
                          <th className="p-3">Schedule</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Verification Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        <tr>
                          <td className="p-3 font-bold text-gray-950">Atorvastatin</td>
                          <td className="p-3">20mg Oral</td>
                          <td className="p-3">Daily (18:00)</td>
                          <td className="p-3">
                            <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-100">Administered</span>
                          </td>
                          <td className="p-3 text-[11px] text-gray-500">Logged by Jane D. at 18:02 (E-Signature Verified)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-gray-950">Metformin</td>
                          <td className="p-3">500mg Oral</td>
                          <td className="p-3">Breakfast (08:00)</td>
                          <td className="p-3">
                            <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-100">Administered</span>
                          </td>
                          <td className="p-3 text-[11px] text-gray-500">Logged by Jane D. at 08:05 (E-Signature Verified)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-gray-950">Donepezil</td>
                          <td className="p-3">10mg Oral</td>
                          <td className="p-3">Bedtime (20:00)</td>
                          <td className="p-3">
                            <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 border border-amber-100">Scheduled</span>
                          </td>
                          <td className="p-3 text-[11px] text-gray-500">Pending caregiver bedtime check-in</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab Content 3: Incidents */}
              {previewTab === 'incidents' && (
                <div className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Incident Escalation Center</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Automated high-priority alert dispatch & tracking</p>
                    </div>
                    <span className="rounded bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                      Escalation Trigger Active
                    </span>
                  </div>

                  <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50/20 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">SEVERITY: HIGH</span>
                          <span className="text-xs text-gray-500">Today at 15:12</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-gray-950">Minor slip near kitchen entrance</p>
                        <p className="mt-1 text-xs text-gray-700 leading-relaxed">
                          Client slipped while reaching for cupboard. Assistive railing safely broke the fall. Checked for bruising, no injuries reported. Client is calm and resting in armchair.
                        </p>
                      </div>
                      <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded">
                        Status: Pending Admin Action
                      </div>
                    </div>

                    <div className="mt-5 border-t border-rose-100/50 pt-4 text-xs text-gray-600">
                      <p className="flex items-center gap-2 font-bold text-rose-800">
                        ⚠️ Database Action:
                      </p>
                      <p className="mt-1">
                        - System automatically set <code className="rounded bg-rose-50 px-1 font-mono text-[11px]">escalated := TRUE</code> based on severity trigger.
                      </p>
                      <p className="mt-0.5">
                        - Notifications broadcast to all Organization Administrators and linked family account (Morgana P.).
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* NDIS Budget & Care Estimator Section */}
      <section id="estimator" className="bg-[#f8fbf6] py-20 border-t border-gray-100">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Care Hours Estimator</p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
              Model support hours before making commitments.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Adjust care duration and hourly rate to compute estimated budget allocations. View recommended care intensities configured to assist NDIS support plan designs.
            </p>
            
            <div className="mt-8 space-y-8">
              <div>
                <div className="flex justify-between text-sm font-bold text-gray-700">
                  <span>Weekly Support Hours</span>
                  <span className="text-brand-700 bg-brand-50 px-3 py-0.5 rounded-full border border-brand-100">{hours} hours / week</span>
                </div>
                <input
                  type="range"
                  suppressHydrationWarning
                  min="2"
                  max="60"
                  value={hours}
                  onChange={(event) => setHours(Number(event.target.value))}
                  className="mt-3 w-full h-2 rounded-lg bg-gray-200 appearance-none cursor-pointer accent-brand-700 focus:outline-none"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1 font-medium">
                  <span>2 hours</span>
                  <span>15 hours</span>
                  <span>30 hours</span>
                  <span>45 hours</span>
                  <span>60 hours</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm font-bold text-gray-700">
                  <span>Estimated Hourly Rate</span>
                  <span className="text-brand-700 bg-brand-50 px-3 py-0.5 rounded-full border border-brand-100">${rate} / hour</span>
                </div>
                <input
                  type="range"
                  suppressHydrationWarning
                  min="45"
                  max="120"
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  className="mt-3 w-full h-2 rounded-lg bg-gray-200 appearance-none cursor-pointer accent-brand-700 focus:outline-none"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1 font-medium">
                  <span>$45</span>
                  <span>$60</span>
                  <span>$80</span>
                  <span>$100</span>
                  <span>$120</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-gray-900 p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-40 w-40 bg-brand-600/10 rounded-full blur-3xl" />
            <p className="text-xs font-bold uppercase tracking-wider text-brand-300">Total Care Estimate</p>
            <p className="mt-4 text-5xl font-extrabold tracking-tight text-white">${estimate.weekly.toLocaleString()}</p>
            <p className="mt-1.5 text-xs text-gray-400">Estimated cost per week</p>

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
              <div>
                <p className="text-xs text-gray-400">Monthly Average</p>
                <p className="mt-1 text-2xl font-bold text-white">${estimate.monthly.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Annual Run-Rate</p>
                <p className="mt-1 text-2xl font-bold text-brand-300">${estimate.annual.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-brand-300">NDIS Support Category</span>
                <span className="rounded bg-brand-800/80 px-2 py-0.5 font-semibold text-white">{careIntensity.level}</span>
              </div>
              <p className="mt-2 text-xs text-gray-300 leading-relaxed">
                {careIntensity.description}
              </p>
              <div className="mt-3.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${careIntensity.colorClass} ${careIntensity.widthClass} transition-all duration-300`} />
              </div>
            </div>

            <p className="mt-6 text-[10px] leading-relaxed text-gray-400 italic">
              * Note: NDIS Price Guide caps, regional modifiers, travel, and complex scheduling rules can impact final rates. Consult your local provider for a formal Service Agreement.
            </p>
          </div>
        </div>
      </section>

      {/* Inquiry and Contact Section */}
      <section id="contact" className="bg-[#eef5ec] py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Contact Us</p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
              Start a care inquiry today.
            </h2>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              Fill out the form to request a callback or program consultation. A Pendacare team member will assess your requirements and discuss support matching.
            </p>
            
            <div className="mt-8 grid gap-3">
              {complianceItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white px-4 py-3 text-xs font-semibold text-gray-800 shadow-sm">
                  <svg className="h-4 w-4 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-white bg-white p-6 shadow-xl sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name">
                <input
                  suppressHydrationWarning
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all duration-200"
                />
              </Field>
              <Field label="Email Address">
                <input
                  suppressHydrationWarning
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                  placeholder="e.g. sarah@example.com.au"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all duration-200"
                />
              </Field>
              <Field label="Contact Phone">
                <input
                  suppressHydrationWarning
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="e.g. 0400 000 000"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all duration-200"
                />
              </Field>
              <Field label="Support Program">
                <select
                  suppressHydrationWarning
                  value={form.care_type}
                  onChange={(event) => setForm((current) => ({ ...current, care_type: event.target.value as LeadCareType }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none bg-white transition-all duration-200"
                >
                  {careTypes.map((careType) => (
                    <option key={careType.value} value={careType.value}>
                      {careType.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            
            <Field label="How can Pendacare support you?" className="mt-4">
              <textarea
                suppressHydrationWarning
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                required
                rows={4}
                placeholder="Please describe care requirements, active NDIS plans, or scheduling preferences..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all duration-200"
              />
            </Field>

            {status && (
              <div
                role="alert"
                className={`mt-4 rounded-xl px-4 py-3 text-xs font-semibold ${
                  status.kind === 'success'
                    ? 'border border-green-200 bg-green-50 text-green-800'
                    : 'border border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-full bg-brand-700 px-6 py-3.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              {submitting ? 'Submitting Inquiry...' : 'Submit Care Inquiry'}
            </button>
          </form>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Frequently Asked Questions</p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 tracking-tight">Care teams need clarity.</h2>
            <p className="mt-3 text-sm text-gray-500">Find answers to common questions about NDIS compliance, coordinates, and family sharing.</p>
          </div>
          
          <div className="divide-y divide-gray-150 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div key={faq.question} className="transition-colors duration-200 hover:bg-[#f8fbf6]/30">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold text-gray-900"
                  >
                    <span className="text-sm sm:text-base">{faq.question}</span>
                    <span className={`text-xl font-medium text-brand-700 select-none transform transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-40 border-t border-gray-100 bg-gray-50/50' : 'max-h-0'}`}>
                    <p className="px-6 py-4 text-xs leading-relaxed text-gray-600 sm:text-sm">{faq.answer}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-[#f8fbf6] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-brand-100 bg-white">
                <LogoMark size={24} />
              </span>
              <span className="text-base font-bold text-brand-700">Pendacare</span>
            </div>
            
            <p className="text-xs text-gray-500 order-last sm:order-none">
              © {new Date().getFullYear()} Pendacare Pty Ltd. Proudly supporting NDIS providers across Australia.
            </p>
            
            <div className="flex gap-6 text-xs font-semibold text-gray-600">
              <Link href="/privacy" className="hover:text-brand-700 transition-colors duration-200">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-brand-700 transition-colors duration-200">Terms of Use</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  )
}
