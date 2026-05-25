// Admin dashboard overview
// Requirements: 2.3

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getAdminDashboardData } from '@/lib/services/dashboardAdminService'
import { listPendingFamilyLinkRequests } from '@/lib/services/familyLinkRequestService'
import { FamilyLinkRequestQueue } from '@/components/admin/FamilyLinkRequestQueue'
import {
  PageHeader,
  StatCard,
  SectionCard,
  EmptyState,
  NotificationList,
} from '@/components/dashboard'

export default async function AdminDashboardPage() {
  const user = await getSession()
  if (!user || user.role !== 'admin') redirect('/login')

  const [data, familyLinkRequests] = await Promise.all([
    getAdminDashboardData(user.id),
    listPendingFamilyLinkRequests(),
  ])
  const b = data.schedulesTodayBreakdown
  const hasAttention =
    data.attentionPendingToday.length > 0 ||
    data.attentionOldUnlockedReports.length > 0 ||
    data.completedWithoutReport.length > 0 ||
    data.unassignedClientCount > 0

  return (
    <div>
      <PageHeader
        title="Operations overview"
        description="Today’s coverage, exceptions, and recent activity across your organisation."
        action={{ label: 'Manage schedules', href: '/dashboard/admin/schedules' }}
      />

      <div
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6"
        role="region"
        aria-label="Key metrics"
      >
        <StatCard label="Total clients" value={data.clientCount} hint="Active in roster" />
        <StatCard label="Caregivers" value={data.caregiverCount} hint="Staff profiles" variant="accent" />
        <StatCard
          label="Unassigned clients"
          value={data.unassignedClientCount}
          hint="No caregiver on file"
          variant={data.unassignedClientCount > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Today’s visits" value={b.total} hint={`${b.confirmed + b.in_progress + b.completed} active or done`} />
        <StatCard
          label="Next 7 days"
          value={data.visitsNext7Days}
          hint="Scheduled visits (excl. cancelled)"
        />
        <StatCard
          label="Unlocked reports"
          value={data.unlockedReportsCount}
          hint="Awaiting lock / review"
          variant={data.unlockedReportsCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <SectionCard
        title="Week at a glance"
        description="Visit volume for the next seven days."
        headingId="heading-week"
        className="mb-6"
      >
        <div className="grid grid-cols-7 gap-2">
          {data.weekScheduleCounts.map(({ date, count }) => (
            <div
              key={date}
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-2 py-3 text-center"
            >
              <p className="text-[10px] font-medium uppercase text-gray-500">
                {format(parseISO(date), 'EEE')}
              </p>
              <p className="text-xs text-gray-600">{format(parseISO(date), 'd MMM')}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{count}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-6">
        {(
          [
            ['Pending', b.pending],
            ['Confirmed', b.confirmed],
            ['In progress', b.in_progress],
            ['Completed', b.completed],
            ['Cancelled', b.cancelled],
          ] as const
        ).map(([label, count]) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="text-lg font-bold tabular-nums text-gray-900">{count}</p>
          </div>
        ))}
      </div>

      <div
        className="mb-8 grid gap-6 lg:grid-cols-2"
        aria-live={hasAttention ? 'polite' : 'off'}
      >
        <SectionCard
          title="Needs attention"
          description="Exceptions that may need coordinator action."
          emphasis={hasAttention ? 'alert' : 'default'}
          headingId="heading-attention"
        >
          {!hasAttention ? (
            <EmptyState
              title="All clear"
              description="No pending visits today, no aged unlocked reports, and no missing visit reports."
            />
          ) : (
            <div className="space-y-6">
              {data.attentionPendingToday.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Pending visits today</h3>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {data.attentionPendingToday.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{s.client_name}</p>
                          <p className="text-xs text-gray-500">
                            {s.time} · {s.caregiver_name}
                          </p>
                        </div>
                        <Link
                          href="/dashboard/admin/schedules"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Schedules
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.completedWithoutReport.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    Completed visits, no report
                  </h3>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {data.completedWithoutReport.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{s.client_name}</p>
                          <p className="text-xs text-gray-500">
                            {s.date} · {s.time} · {s.caregiver_name}
                          </p>
                        </div>
                        <Link
                          href="/dashboard/admin/clients"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Clients
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.attentionOldUnlockedReports.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    Unlocked reports older than 3 days
                  </h3>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {data.attentionOldUnlockedReports.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{r.client_name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(r.created_at).toLocaleDateString()} · {r.hours_worked}h ·{' '}
                            {r.caregiver_name}
                          </p>
                        </div>
                        <Link
                          href="/dashboard/admin/clients"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Clients
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.unassignedClients.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Unassigned clients</h3>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {data.unassignedClients.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs capitalize text-gray-500">
                            {c.care_type.replace('_', ' ')}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/admin/clients/${c.id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Assign
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Shortcuts"
          description="Jump to common admin workflows."
          headingId="heading-shortcuts"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard/admin/schedules"
              className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-sm font-semibold text-gray-900 transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Schedules
              <p className="mt-1 text-xs font-normal text-gray-500">Create and update shifts</p>
            </Link>
            <Link
              href="/dashboard/admin/clients"
              className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-sm font-semibold text-gray-900 transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Clients
              <p className="mt-1 text-xs font-normal text-gray-500">Roster and assignments</p>
            </Link>
            <Link
              href="/dashboard/messages"
              className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-sm font-semibold text-gray-900 transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-2"
            >
              Messages
              <p className="mt-1 text-xs font-normal text-gray-500">
                Team inbox
                {data.unreadMessages > 0 && ` · ${data.unreadMessages} unread`}
              </p>
            </Link>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Family link requests"
        description="Approve or reject family members requesting access to a client’s care updates."
        headingId="heading-family-links"
        className="mb-8"
        emphasis={familyLinkRequests.length > 0 ? 'alert' : 'default'}
      >
        <FamilyLinkRequestQueue requests={familyLinkRequests} />
      </SectionCard>

      <SectionCard
        title="In-app notifications"
        description="Alerts addressed to you as an administrator."
        headingId="heading-notifications"
        className="mb-8"
      >
        <NotificationList notifications={data.notifications} />
      </SectionCard>

      <SectionCard
        title="Recent audit activity"
        description="Latest security-relevant actions (append-only log)."
        headingId="heading-audit"
      >
        {data.recentAudit.length === 0 ? (
          <EmptyState title="No audit entries yet" description="Actions will appear here as users use the system." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-4 font-medium">When</th>
                  <th className="pb-2 pr-4 font-medium">Action</th>
                  <th className="pb-2 pr-4 font-medium">Resource</th>
                  <th className="pb-2 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentAudit.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-gray-600">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-900">{a.action}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {a.resource}
                      {a.resource_id && (
                        <span className="ml-1 text-xs text-gray-400">{a.resource_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-600">{a.actor_email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
