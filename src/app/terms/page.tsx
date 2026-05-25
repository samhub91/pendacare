import Link from 'next/link'
import { LogoMark } from '@/components/brand/LogoMark'

const sections = [
  {
    title: 'Appropriate use',
    body: 'Pendacare is intended for care coordination, administrative workflows, communication, reporting, and record keeping. Users must enter accurate information and use access only for authorised care responsibilities.',
  },
  {
    title: 'Clinical responsibility',
    body: 'Pendacare supports documentation and coordination. It does not replace professional judgement, emergency response procedures, clinical supervision, or provider compliance obligations.',
  },
  {
    title: 'Accounts and roles',
    body: 'Administrators manage organisational access. Caregivers, clients, and family members are responsible for keeping credentials secure and reporting suspicious or incorrect access promptly.',
  },
  {
    title: 'Data and availability',
    body: 'The application depends on configured Supabase services, authentication, database access, and hosting. Providers should maintain their own operational continuity, data review, and incident response procedures.',
  },
  {
    title: 'Compliance review',
    body: 'Organisations using Pendacare should confirm that workflows, consent practices, retention rules, and family access settings match their Privacy Act, NDIS, employment, and healthcare governance obligations.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">Terms</p>
        <h1 className="mt-3 text-4xl font-bold">Pendacare Terms of Use</h1>
        <p className="mt-5 text-base leading-8 text-gray-600">
          These terms describe the intended operating boundaries for Pendacare as a caregiving management system.
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
          This page is implementation-ready product copy and should be reviewed by qualified legal and compliance advisors before public launch.
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
