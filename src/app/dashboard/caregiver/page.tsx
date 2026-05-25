// Caregiver dashboard — today's shifts and upcoming schedule
// Requirements: 2.4, 3.5

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSession } from '@/lib/auth/session'
import { getCaregiverDashboardData } from '@/lib/services/dashboardCaregiverService'
import { redirect } from 'next/navigation'
import {
  PageHeader,
  SectionCard,
  EmptyState,
  StatusBadge,
  StatCard,
  ShiftStatusActions,
  NotificationList,
} from '@/components/dashboard'

export default async function CaregiverDashboardPage() {
  const user = await getSession()
  if (!user || user.role !== 'caregiver' || !user.caregiverId) redirect('/login')

  const data = await getCaregiverDashboardData(user)
  if (!data) redirect('/login')

  return (
    <div>
      <PageHeader
        title="My shifts"
        description="Today’s visits and the week ahead — confirm, start, and complete visits in the field."
        action={{ label: 'Log report', href: '/dashboard/caregiver/reports/new' }}
      />

      <div
        className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        role="region"
        aria-label="Key metrics"
      >
        <StatCard label="Today’s shifts" value={data.todayShiftCount} hint="Scheduled for today" />
        <StatCard
          label="Hours this week"
          value={data.hoursThisWeek.toFixed(1)}
          hint="From logged reports"
          variant="accent"
        />
        <StatCard
          label="Reports due"
          value={data.reportsDueCount}
          hint="Completed visits without a linked report"
          variant={data.reportsDueCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Unread messages"
          value={data.unreadMessages}
          hint="In your inbox"
          variant={data.unreadMessages > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Today" description="Shifts scheduled for today." headingId="cg-today">
          {data.todaySchedules.length === 0 ? (
            <EmptyState title="No shifts today" description="Check back when new visits are scheduled for you." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.todaySchedules.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{s.client_name}</p>
                    <p className="text-sm text-gray-600">
                      {s.time} · {s.duration_minutes} min ·{' '}
                      <span className="capitalize text-gray-500">{s.care_type.replace('_', ' ')}</span>
                    </p>
                    {(s.started_at || s.completed_at) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.started_at && `Started ${new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        {s.started_at && s.completed_at && ' · '}
                        {s.completed_at && `Completed ${new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <StatusBadge status={s.status} />
                      {(s.status === 'completed' ||
                        s.status === 'confirmed' ||
                        s.status === 'in_progress') && (
                        <Link
                          href={`/dashboard/caregiver/reports/new?client_id=${encodeURIComponent(s.client_id)}&schedule_id=${encodeURIComponent(s.id)}`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Log report
                        </Link>
                      )}
                    </div>
                    <ShiftStatusActions scheduleId={s.id} status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Next 7 days"
          description="Upcoming visits after today."
          headingId="cg-week"
        >
          {data.upcomingWeek.length === 0 ? (
            <EmptyState title="No upcoming shifts" description="You’re all set for the next week." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.upcomingWeek.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{s.client_name}</p>
                    <p className="text-sm text-gray-600">
                      {format(parseISO(s.date), 'EEE d MMM')} · {s.time} · {s.duration_minutes} min
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Needs report"
        description="Completed visits with no report linked to the schedule yet."
        headingId="cg-reports-due"
        className="mb-8"
        emphasis={data.shiftsNeedingReport.length > 0 ? 'alert' : 'default'}
      >
        {data.shiftsNeedingReport.length === 0 ? (
          <EmptyState title="All caught up" description="Every completed visit has a linked report." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.shiftsNeedingReport.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{s.client_name}</p>
                  <p className="text-xs text-gray-500">
                    {s.date} · {s.time}
                  </p>
                </div>
                <Link
                  href={`/dashboard/caregiver/reports/new?client_id=${encodeURIComponent(s.client_id)}&schedule_id=${encodeURIComponent(s.id)}`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Log report
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Alerts for your account."
        headingId="cg-notifications"
      >
        <NotificationList notifications={data.notifications} />
      </SectionCard>
    </div>
  )
}
