// Family member dashboard — linked client's schedule, reports, monthly summary
// Requirements: 2.6, 8.4, 8.6

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSession } from '@/lib/auth/session'
import { getFamilyDashboardData } from '@/lib/services/dashboardFamilyService'
import { redirect } from 'next/navigation'
import {
  PageHeader,
  SectionCard,
  EmptyState,
  StatusBadge,
  NotificationList,
} from '@/components/dashboard'
import type { ScheduleStatus } from '@/lib/types'

export default async function FamilyDashboardPage() {
  const user = await getSession()
  if (!user || user.role !== 'family_member') redirect('/login')

  const data = await getFamilyDashboardData(user)

  if (!data) {
    return (
      <div>
        <PageHeader title="Family dashboard" description="Stay connected to your loved one’s care." />
        <EmptyState
          title="No linked client"
          description="Ask your administrator to link your account to a care recipient."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Care updates"
        description={
          data.clientName
            ? `Monitoring care for ${data.clientName}.`
            : 'Monitoring linked care recipient.'
        }
        action={{ label: 'Messages', href: '/dashboard/messages' }}
      />

      {data.noVisitsSoon && (
        <div
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          No visits scheduled in the next 7 days. If that looks wrong, contact your coordinator.
        </div>
      )}

      {data.summary && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <SectionCard title="Hours this month" headingId="fam-hours" className="!mb-0">
            <p className="text-3xl font-bold tabular-nums text-gray-900">
              {data.summary.total_hours.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">Total hours logged</p>
          </SectionCard>
          <SectionCard title="Visits" headingId="fam-visits" className="!mb-0">
            <p className="text-3xl font-bold tabular-nums text-gray-900">{data.summary.visit_count}</p>
            <p className="text-xs text-gray-500">From visit reports</p>
          </SectionCard>
          <SectionCard title="Caregivers" headingId="fam-cg" className="!mb-0">
            <p className="text-sm font-medium text-gray-900">
              {data.summary.caregivers.join(', ') || '—'}
            </p>
            <p className="text-xs text-gray-500">Active this month</p>
          </SectionCard>
        </div>
      )}

      {data.lastReport && (
        <SectionCard
          title="Latest visit report"
          description="Most recent notes from the care team."
          headingId="fam-last-report"
          className="mb-8"
        >
          <p className="text-sm font-medium text-gray-900">
            {format(parseISO(data.lastReport.created_at), 'EEEE d MMMM yyyy')} ·{' '}
            {data.lastReport.hours_worked}h
          </p>
          <p className="mt-2 text-sm text-gray-700">{data.lastReport.notes_preview}</p>
        </SectionCard>
      )}

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Upcoming visits"
          description="Scheduled care for your linked recipient."
          headingId="fam-upcoming"
        >
          {data.schedules.length === 0 ? (
            <EmptyState title="No upcoming visits" description="Visits will appear when scheduled." />
          ) : (
            <ul className="space-y-3">
              {data.schedules.map((s) => (
                <li
                  key={s.id}
                  className="relative border-l-2 border-blue-200 pl-4 before:absolute before:left-[-5px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-blue-500"
                >
                  <p className="font-medium text-gray-900">
                    {format(parseISO(s.date), 'EEE d MMM')} · {s.time}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.duration_minutes} min
                    {s.caregiver_name && ` · ${s.caregiver_name}`}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Care timeline"
          description="Upcoming visits and this month’s visit notes in one stream."
          headingId="fam-timeline"
        >
          {data.timeline.length === 0 ? (
            <EmptyState title="Nothing to show yet" description="Visits and reports will build this timeline." />
          ) : (
            <ul className="space-y-0">
              {data.timeline.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="relative border-l-2 border-gray-200 py-3 pl-5 last:pb-0 before:absolute before:left-[-5px] before:top-4 before:h-2 before:w-2 before:rounded-full before:bg-gray-400"
                >
                  {item.kind === 'visit' ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Visit
                      </p>
                      <p className="font-medium text-gray-900">
                        {item.date && format(parseISO(item.date), 'd MMM yyyy')} · {item.time}
                      </p>
                      {item.caregiver_name && (
                        <p className="text-xs text-gray-500">{item.caregiver_name}</p>
                      )}
                      {item.status && <StatusBadge status={item.status as ScheduleStatus} />}
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                        Visit report
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.created_at && format(parseISO(item.created_at), 'd MMM yyyy')} ·{' '}
                        {item.hours_worked}h
                      </p>
                      <p className="mt-1 text-sm text-gray-800">{item.notes}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Notifications" headingId="fam-notifications" className="mb-8">
        <NotificationList notifications={data.notifications} />
      </SectionCard>

      <p className="text-center text-sm text-gray-500">
        <Link href="/dashboard/messages" className="font-semibold text-blue-600 hover:text-blue-700">
          Open messages
        </Link>
        {data.unreadMessages > 0 && ` · ${data.unreadMessages} unread`}
      </p>
    </div>
  )
}
