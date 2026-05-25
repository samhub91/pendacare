// Admin dashboard aggregates — server-side only via supabaseAdmin
// Requirements: 2.3, 10.4

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ScheduleStatus } from '@/lib/types'
import { subDays } from 'date-fns'
import {
  getNotificationsForUser,
  getUnreadMessageCount,
  type NotificationRow,
} from '@/lib/services/dashboardSharedService'
import {
  getCompletedSchedulesMissingReports,
  getWeekScheduleCounts,
  todayIsoDate,
  addDaysIso,
  type DayScheduleCount,
  type MissingReportShiftRow,
} from '@/lib/services/dashboardQueryHelpers'

export type { NotificationRow }

const REPORT_UNLOCKED_MAX_AGE_DAYS = 3

/** Shape returned by Supabase for schedules joined to clients/caregivers */
interface PendingScheduleJoinRow {
  id: string
  date: string
  time: string
  status: string
  clients: { name: string } | { name: string }[] | null
  caregivers: { name: string } | { name: string }[] | null
}

interface UnlockedReportJoinRow {
  id: string
  created_at: string
  hours_worked: number
  clients: { name: string } | { name: string }[] | null
  caregivers: { name: string } | { name: string }[] | null
}

function joinedName(rel: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!rel) return null
  if (Array.isArray(rel)) return rel[0]?.name ?? null
  return rel.name
}

export interface TodayScheduleStatusBreakdown {
  pending: number
  confirmed: number
  in_progress: number
  completed: number
  cancelled: number
  total: number
}

export interface AttentionScheduleRow {
  id: string
  date: string
  time: string
  status: ScheduleStatus
  client_name: string
  caregiver_name: string
}

export interface AttentionReportRow {
  id: string
  created_at: string
  hours_worked: number
  client_name: string
  caregiver_name: string
}

export interface AuditActivityRow {
  id: string
  action: string
  resource: string
  resource_id: string | null
  created_at: string
  actor_email: string | null
}

export interface UnassignedClientRow {
  id: string
  name: string
  care_type: string
}

export interface AdminDashboardData {
  clientCount: number
  caregiverCount: number
  unassignedClientCount: number
  visitsNext7Days: number
  schedulesTodayBreakdown: TodayScheduleStatusBreakdown
  unlockedReportsCount: number
  attentionPendingToday: AttentionScheduleRow[]
  attentionOldUnlockedReports: AttentionReportRow[]
  completedWithoutReport: MissingReportShiftRow[]
  unassignedClients: UnassignedClientRow[]
  weekScheduleCounts: DayScheduleCount[]
  recentAudit: AuditActivityRow[]
  notifications: NotificationRow[]
  unreadMessages: number
}

export async function getAdminDashboardData(adminUserId: string): Promise<AdminDashboardData> {
  const today = todayIsoDate()
  const weekEnd = addDaysIso(today, 6)
  const reportCutoff = subDays(new Date(), REPORT_UNLOCKED_MAX_AGE_DAYS).toISOString()

  const [
    clientsRes,
    caregiversRes,
    unassignedListRes,
    unassignedCountRes,
    schedulesTodayRes,
    unlockedReportsRes,
    pendingTodayRes,
    oldReportsRes,
    auditRes,
    notifications,
    unreadMessages,
    weekScheduleCounts,
    completedWithoutReport,
  ] = await Promise.all([
    supabaseAdmin.from('clients').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('caregivers').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('clients')
      .select('id, name, care_type')
      .is('assigned_caregiver_id', null)
      .order('name')
      .limit(8),
    supabaseAdmin
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .is('assigned_caregiver_id', null),
    supabaseAdmin.from('schedules').select('status').eq('date', today),
    supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).is('locked_at', null),
    supabaseAdmin
      .from('schedules')
      .select(
        `
        id,
        date,
        time,
        status,
        clients ( name ),
        caregivers ( name )
      `
      )
      .eq('date', today)
      .eq('status', 'pending')
      .order('time', { ascending: true })
      .limit(8),
    supabaseAdmin
      .from('reports')
      .select(
        `
        id,
        created_at,
        hours_worked,
        clients ( name ),
        caregivers ( name )
      `
      )
      .is('locked_at', null)
      .lt('created_at', reportCutoff)
      .order('created_at', { ascending: true })
      .limit(8),
    supabaseAdmin
      .from('audit_logs')
      .select('id, action, resource, resource_id, created_at, actor_id')
      .order('created_at', { ascending: false })
      .limit(12),
    getNotificationsForUser(adminUserId, 8),
    getUnreadMessageCount(adminUserId),
    getWeekScheduleCounts(today, weekEnd),
    getCompletedSchedulesMissingReports({ limit: 8 }),
  ])

  const breakdown: TodayScheduleStatusBreakdown = {
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
  }

  const statusKeys: ScheduleStatus[] = [
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
  ]

  for (const row of schedulesTodayRes.data ?? []) {
    const s = row.status as ScheduleStatus
    if (statusKeys.includes(s)) {
      breakdown[s] += 1
    }
    breakdown.total += 1
  }

  const actorIds = Array.from(
    new Set((auditRes.data ?? []).map((a) => a.actor_id).filter(Boolean))
  ) as string[]
  const actorEmails: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: usersRows } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', actorIds)
    for (const u of usersRows ?? []) {
      actorEmails[u.id] = u.email
    }
  }

  const attentionSchedules: AttentionScheduleRow[] = (
    (pendingTodayRes.data ?? []) as unknown as PendingScheduleJoinRow[]
  ).map((row) => ({
    id: row.id,
    date: row.date,
    time: row.time,
    status: row.status as ScheduleStatus,
    client_name: joinedName(row.clients) ?? 'Unknown client',
    caregiver_name: joinedName(row.caregivers) ?? 'Unknown caregiver',
  }))

  const attentionReports: AttentionReportRow[] = (
    (oldReportsRes.data ?? []) as unknown as UnlockedReportJoinRow[]
  ).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    hours_worked: Number(row.hours_worked),
    client_name: joinedName(row.clients) ?? 'Unknown client',
    caregiver_name: joinedName(row.caregivers) ?? 'Unknown caregiver',
  }))

  const recentAudit: AuditActivityRow[] = (auditRes.data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    resource: row.resource,
    resource_id: row.resource_id,
    created_at: row.created_at,
    actor_email: row.actor_id ? actorEmails[row.actor_id] ?? null : null,
  }))

  const unassignedClients: UnassignedClientRow[] = (unassignedListRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    care_type: c.care_type,
  }))

  const visitsNext7Days = weekScheduleCounts.reduce((sum, d) => sum + d.count, 0)

  return {
    clientCount: clientsRes.count ?? 0,
    caregiverCount: caregiversRes.count ?? 0,
    unassignedClientCount: unassignedCountRes.count ?? unassignedClients.length,
    visitsNext7Days,
    schedulesTodayBreakdown: breakdown,
    unlockedReportsCount: unlockedReportsRes.count ?? 0,
    attentionPendingToday: attentionSchedules,
    attentionOldUnlockedReports: attentionReports,
    completedWithoutReport,
    unassignedClients,
    weekScheduleCounts,
    recentAudit,
    notifications,
    unreadMessages,
  }
}
