// Client dashboard — own schedule and assigned caregiver info
// Requirements: 2.5, 3.6

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getSession } from '@/lib/auth/session'
import { getClientDashboardData } from '@/lib/services/dashboardClientService'
import { redirect } from 'next/navigation'
import {
  PageHeader,
  SectionCard,
  EmptyState,
  StatusBadge,
  StatCard,
  NotificationList,
} from '@/components/dashboard'

export default async function ClientDashboardPage() {
  const user = await getSession()
  if (!user || user.role !== 'client') redirect('/login')

  const data = await getClientDashboardData(user)
  if (!data) {
    return (
      <div>
        <PageHeader title="My care" description="Your care team and upcoming visits." />
        <EmptyState
          title="Profile not found"
          description="Ask your coordinator to set up your client profile."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="My care"
        description="Your care team, upcoming visits, and recent updates."
        action={{ label: 'Messages', href: '/dashboard/messages' }}
      />

      {data.profileIncomplete && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Complete your profile</p>
          <p className="mt-1 text-amber-800">
            Add or confirm your emergency contact and personal details so your care team has accurate information.
          </p>
          <Link
            href="/dashboard/client/profile"
            className="mt-2 inline-block font-semibold text-amber-900 underline hover:no-underline"
          >
            Go to My profile
          </Link>
        </div>
      )}

      <div
        className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
        role="region"
        aria-label="Key metrics"
      >
        <StatCard
          label="Next visit"
          value={
            data.nextVisit
              ? data.daysUntilNext === 0
                ? 'Today'
                : data.daysUntilNext === 1
                  ? 'Tomorrow'
                  : `In ${data.daysUntilNext} days`
              : '—'
          }
          hint={
            data.nextVisit
              ? `${format(parseISO(data.nextVisit.date), 'd MMM')} at ${data.nextVisit.time}`
              : 'Nothing scheduled'
          }
        />
        <StatCard
          label="Visits this month"
          value={data.monthVisitCount}
          hint="Logged visit reports"
          variant="accent"
        />
        <StatCard
          label="Hours this month"
          value={data.monthHours.toFixed(1)}
          hint="Total care hours"
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SectionCard title="Care team" headingId="client-team">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Assigned caregiver</dt>
              <dd className="font-semibold text-gray-900">
                {data.caregiverName ?? 'Not yet assigned'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Care type</dt>
              <dd className="capitalize text-gray-900">{data.careType.replace('_', ' ')}</dd>
            </div>
          </dl>
        </SectionCard>

        {data.emergencyContact && (
          <SectionCard title="Emergency contact" headingId="client-emergency">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{data.emergencyContact.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900">{data.emergencyContact.phone}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Relationship</dt>
                <dd className="text-gray-900">{data.emergencyContact.relationship}</dd>
              </div>
            </dl>
          </SectionCard>
        )}

        <SectionCard title="Quick links" headingId="client-links">
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/messages"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Messages
              {data.unreadMessages > 0 && (
                <span className="ml-1 text-xs text-red-600">({data.unreadMessages} unread)</span>
              )}
            </Link>
            {data.assignedCaregiverUserId && (
              <Link
                href={`/dashboard/messages?partner=${encodeURIComponent(data.assignedCaregiverUserId)}`}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Message your caregiver
              </Link>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent care updates"
        description="Latest visit reports from your care team."
        headingId="client-reports"
        className="mb-8"
      >
        {data.recentReports.length === 0 ? (
          <EmptyState title="No reports yet" description="Visit notes will appear after your caregiver logs them." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.recentReports.map((r) => (
              <li key={r.id} className="py-3 first:pt-0">
                <p className="text-sm font-medium text-gray-900">
                  {format(parseISO(r.created_at), 'EEEE d MMMM yyyy')} · {r.hours_worked}h
                  {r.caregiver_name && (
                    <span className="font-normal text-gray-500"> · {r.caregiver_name}</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-gray-600">{r.notes_preview}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Upcoming schedule"
        description="Visits grouped by week (Monday start)."
        headingId="client-schedule"
        className="mb-8"
      >
        {data.weekKeys.length === 0 ? (
          <EmptyState
            title="No visits scheduled"
            description="Your coordinator will add visits here when they are planned."
          />
        ) : (
          <div className="space-y-8">
            {data.weekKeys.map((wk) => (
              <div key={wk}>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                  Week of {format(parseISO(wk), 'd MMMM yyyy')}
                </h3>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {data.schedulesByWeek.get(wk)!.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(s.date), 'EEE d MMM')} · {s.time}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.duration_minutes} minutes
                          {s.caregiver_name && ` · ${s.caregiver_name}`}
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Notifications" headingId="client-notifications">
        <NotificationList notifications={data.notifications} />
      </SectionCard>
    </div>
  )
}
