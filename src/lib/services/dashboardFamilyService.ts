// Family dashboard aggregates — server-side only

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AuthenticatedUser, ScheduleStatus } from '@/lib/types'
import { generateSummary, getReportsByClient } from '@/lib/services/reportingService'
import {
  getNotificationsForUser,
  getUnreadMessageCount,
  type NotificationRow,
} from '@/lib/services/dashboardSharedService'
import { todayIsoDate } from '@/lib/services/dashboardQueryHelpers'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { MonthlySummary } from '@/lib/types'

export interface FamilyScheduleRow {
  id: string
  date: string
  time: string
  duration_minutes: number
  status: ScheduleStatus
  caregiver_name: string | null
}

export interface FamilyTimelineEntry {
  kind: 'visit' | 'report'
  id: string
  sortKey: string
  date?: string
  time?: string
  duration_minutes?: number
  status?: string
  caregiver_name?: string | null
  created_at?: string
  notes?: string
  hours_worked?: number
}

export interface FamilyDashboardData {
  clientId: string
  clientName: string | null
  careType: string | null
  schedules: FamilyScheduleRow[]
  summary: MonthlySummary | null
  lastReport: { id: string; created_at: string; hours_worked: number; notes_preview: string } | null
  timeline: FamilyTimelineEntry[]
  noVisitsSoon: boolean
  unreadMessages: number
  notifications: NotificationRow[]
}

export async function getFamilyDashboardData(
  user: AuthenticatedUser
): Promise<FamilyDashboardData | null> {
  const { data: link } = await supabaseAdmin
    .from('family_links')
    .select('client_id, clients(id, name, care_type)')
    .eq('family_member_id', user.id)
    .single()

  if (!link) return null

  const client = (link as { clients?: { id?: string; name?: string; care_type?: string } }).clients
  const clientId = link.client_id
  const today = todayIsoDate()
  const currentMonth = today.slice(0, 7)

  const [schedulesRes, reportsRes, summaryRes, notifications, unreadMessages] =
    await Promise.all([
      supabaseAdmin
        .from('schedules')
        .select('id, date, time, duration_minutes, status, caregivers(name)')
        .eq('client_id', clientId)
        .gte('date', today)
        .order('date')
        .order('time')
        .limit(15),
      getReportsByClient(
        clientId,
        { start: `${currentMonth}-01`, end: `${currentMonth}-31` },
        user
      ),
      generateSummary(clientId, currentMonth, user),
      getNotificationsForUser(user.id, 8),
      getUnreadMessageCount(user.id),
    ])

  const schedules: FamilyScheduleRow[] = (schedulesRes.data ?? []).map((s) => {
    const cg = s.caregivers as { name?: string } | { name?: string }[] | null
    const cgName = Array.isArray(cg) ? cg[0]?.name : cg?.name
    return {
      id: s.id,
      date: s.date,
      time: s.time,
      duration_minutes: s.duration_minutes,
      status: s.status as ScheduleStatus,
      caregiver_name: cgName ?? null,
    }
  })

  const reports = reportsRes.data ?? []
  const summary = summaryRes.data

  const nextSeven = schedules.filter(
    (s) => differenceInCalendarDays(parseISO(s.date), parseISO(today)) <= 7
  )
  const noVisitsSoon = nextSeven.length === 0 && schedules.length > 0

  const lastReportRow = reports[0]
  const lastReport = lastReportRow
    ? {
        id: lastReportRow.id,
        created_at: lastReportRow.created_at,
        hours_worked: Number(lastReportRow.hours_worked),
        notes_preview:
          lastReportRow.notes.length > 120
            ? `${lastReportRow.notes.slice(0, 120)}…`
            : lastReportRow.notes,
      }
    : null

  const timeline: FamilyTimelineEntry[] = [
    ...schedules.map((s) => ({
      kind: 'visit' as const,
      id: s.id,
      sortKey: `${s.date}T${s.time.length === 5 ? s.time + ':00' : s.time}`,
      date: s.date,
      time: s.time,
      duration_minutes: s.duration_minutes,
      status: s.status,
      caregiver_name: s.caregiver_name,
    })),
    ...reports.map((r) => ({
      kind: 'report' as const,
      id: r.id,
      sortKey: r.created_at,
      created_at: r.created_at,
      notes: r.notes,
      hours_worked: r.hours_worked,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return {
    clientId,
    clientName: client?.name ?? null,
    careType: client?.care_type ?? null,
    schedules,
    summary,
    lastReport,
    timeline,
    noVisitsSoon,
    unreadMessages,
    notifications,
  }
}
