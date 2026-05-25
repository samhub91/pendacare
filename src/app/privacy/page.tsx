import Link from 'next/link'
import { LogoMark } from '@/components/brand/LogoMark'

const sections = [
  {
    title: 'Information we handle',
    body: 'Pendacare may store account details, contact information, care schedules, reports, messages, family access requests, incident records, medication administration records, and operational audit events.',
  },
  {
    title: 'How information is used',
    body: 'Information is used to coordinate care, support families, manage provider workflows, protect client safety, respond to support requests, and maintain compliant operational records.',
  },
  {
    title: 'Access and permissions',
    body: 'Access is role-based. Administrators, caregivers, clients, and approved family members see different information according to their responsibilities and linked care relationships.',
  },
  {
    title: 'Security controls',
    body: 'Pendacare uses Supabase row-level security, server-side service credentials, audit logging, encrypted sensitive content, and secure authentication flows to reduce inappropriate access.',
  },
  {
    title: 'Retention and requests',
    body: 'Care records may be retained where required for operational, legal, safety, or compliance purposes. Clients and authorised representatives may request access, correction, or deletion where applicable.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">Privacy</p>
        <h1 className="mt-3 text-4xl font-bold">Pendacare Privacy Statement</h1>
        <p className="mt-5 text-base leading-8 text-gray-600">
          Pendacare is designed for sensitive care coordination. This statement explains the privacy posture built into the application and the kinds of information handled by the platform.
        </p>
        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{section.title}</h2>
              <p className="mt-3 leading-7 text-gray-600">{section.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          This page is operational product copy, not legal advice. Providers should review Pendacare with their own privacy, clinical governance, and compliance advisors before production use.
        </p>
      </section>
    </main>
  )
}

function Header() {
  return (
    <header className="border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="h-10 w-10 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <LogoMark size={40} />
          </span>
          <span className="text-lg font-bold text-brand-700">Pendacare</span>
        </Link>
        <Link href="/" className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:text-brand-700">
          Home
        </Link>
      </div>
    </header>
  )
}
