// Caregiver dashboard aggregates — server-side only

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AuthenticatedUser } from '@/lib/types'
import {
  getNotificationsForUser,
  getUnreadMessageCount,
  type NotificationRow,
} from '@/lib/services/dashboardSharedService'
import {
  getCompletedSchedulesMissingReports,
  todayIsoDate,
  addDaysIso,
  type MissingReportShiftRow,
} from '@/lib/services/dashboardQueryHelpers'
import { getSchedulesForCaregiverWithClients } from '@/lib/services/scheduleService'

export interface CaregiverDashboardData {
  todayShiftCount: number
  hoursThisWeek: number
  reportsDueCount: number
  unreadMessages: number
  todaySchedules: Awaited<ReturnType<typeof getSchedulesForCaregiverWithClients>>
  upcomingWeek: Awaited<ReturnType<typeof getSchedulesForCaregiverWithClients>>
  shiftsNeedingReport: MissingReportShiftRow[]
  notifications: NotificationRow[]
}

export async function getCaregiverDashboardData(
  user: AuthenticatedUser
): Promise<CaregiverDashboardData | null> {
  if (!user.caregiverId) return null

  const today = todayIsoDate()
  const weekEnd = addDaysIso(today, 7)
  const weekStart = addDaysIso(today, -6)

  const [schedules, shiftsNeedingReport, notifications, unreadMessages, hoursRes] =
    await Promise.all([
      getSchedulesForCaregiverWithClients(
        user.caregiverId,
        { start: today, end: weekEnd },
        user
      ),
      getCompletedSchedulesMissingReports({
        caregiverId: user.caregiverId,
        limit: 8,
      }),
      getNotificationsForUser(user.id, 8),
      getUnreadMessageCount(user.id),
      supabaseAdmin
        .from('reports')
        .select('hours_worked')
        .eq('caregiver_id', user.caregiverId)
        .gte('created_at', `${weekStart}T00:00:00`)
        .lte('created_at', `${weekEnd}T23:59:59`),
    ])

  const todaySchedules = schedules.filter((s) => s.date === today)
  const upcomingWeek = schedules.filter((s) => s.date > today && s.date <= weekEnd)

  const hoursThisWeek = (hoursRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.hours_worked),
    0
  )

  return {
    todayShiftCount: todaySchedules.length,
    hoursThisWeek,
    reportsDueCount: shiftsNeedingReport.length,
    unreadMessages,
    todaySchedules,
    upcomingWeek,
    shiftsNeedingReport,
    notifications,
  }
}
