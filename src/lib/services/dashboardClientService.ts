// Client dashboard aggregates — server-side only

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AuthenticatedUser, EmergencyContact, ScheduleStatus } from '@/lib/types'
import {
  getNotificationsForUser,
  getUnreadMessageCount,
  type NotificationRow,
} from '@/lib/services/dashboardSharedService'
import { todayIsoDate, addDaysIso } from '@/lib/services/dashboardQueryHelpers'
import { format, parseISO, startOfWeek } from 'date-fns'

export interface ClientRecentReport {
  id: string
  created_at: string
  hours_worked: number
  notes_preview: string
  caregiver_name: string | null
}

export interface ClientScheduleRow {
  id: string
  date: string
  time: string
  duration_minutes: number
  status: ScheduleStatus
  caregiver_name: string | null
}

export interface ClientDashboardData {
  clientId: string
  clientName: string
  profileIncomplete: boolean
  careType: string
  caregiverName: string | null
  assignedCaregiverUserId: string | null
  emergencyContact: EmergencyContact | null
  nextVisit: ClientScheduleRow | null
  daysUntilNext: number | null
  monthVisitCount: number
  monthHours: number
  unreadMessages: number
  recentReports: ClientRecentReport[]
  schedulesByWeek: Map<string, ClientScheduleRow[]>
  weekKeys: string[]
  notifications: NotificationRow[]
}

export async function getClientDashboardData(
  user: AuthenticatedUser
): Promise<ClientDashboardData | null> {
  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select(
      'id, name, care_type, date_of_birth, assigned_caregiver_id, emergency_contact, caregivers(name, user_id)'
    )
    .eq('user_id', user.id)
    .single()

  if (!clientRow) return null

  const today = todayIsoDate()
  const nextMonth = addDaysIso(today, 30)
  const currentMonth = today.slice(0, 7)

  const [schedulesRes, reportsRes, notifications, unreadMessages] = await Promise.all([
    supabaseAdmin
      .from('schedules')
      .select('id, date, time, duration_minutes, status, caregivers(name)')
      .eq('client_id', clientRow.id)
      .gte('date', today)
      .lte('date', nextMonth)
      .order('date')
      .order('time')
      .limit(40),
    supabaseAdmin
      .from('reports')
      .select('id, created_at, hours_worked, notes, caregivers(name)')
      .eq('client_id', clientRow.id)
      .gte('created_at', `${currentMonth}-01`)
      .lte('created_at', `${currentMonth}-31T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(5),
    getNotificationsForUser(user.id, 8),
    getUnreadMessageCount(user.id),
  ])

  type CgJoin = { name?: string; user_id?: string } | { name?: string; user_id?: string }[] | null
  const caregivers = clientRow.caregivers as CgJoin
  const caregiverName = Array.isArray(caregivers)
    ? caregivers[0]?.name ?? null
    : caregivers?.name ?? null
  const assignedCaregiverUserId = Array.isArray(caregivers)
    ? caregivers[0]?.user_id ?? null
    : caregivers?.user_id ?? null

  const list: ClientScheduleRow[] = (schedulesRes.data ?? []).map((s) => {
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

  const byWeek = new Map<string, ClientScheduleRow[]>()
  for (const s of list) {
    const wk = format(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    if (!byWeek.has(wk)) byWeek.set(wk, [])
    byWeek.get(wk)!.push(s)
  }
  const weekKeys = Array.from(byWeek.keys()).sort()

  const nextVisit = list[0] ?? null
  const daysUntilNext =
    nextVisit && nextVisit.date >= today
      ? Math.ceil(
          (parseISO(nextVisit.date).getTime() - parseISO(today).getTime()) / (24 * 60 * 60 * 1000)
        )
      : null

  const monthReports = await supabaseAdmin
    .from('reports')
    .select('hours_worked')
    .eq('client_id', clientRow.id)
    .gte('created_at', `${currentMonth}-01`)
    .lte('created_at', `${currentMonth}-31T23:59:59`)

  const monthHours = (monthReports.data ?? []).reduce(
    (sum, r) => sum + Number(r.hours_worked),
    0
  )

  const recentReports: ClientRecentReport[] = (reportsRes.data ?? []).map((r) => {
    const cg = r.caregivers as { name?: string } | { name?: string }[] | null
    const cgName = Array.isArray(cg) ? cg[0]?.name : cg?.name
    const notes = r.notes ?? ''
    return {
      id: r.id,
      created_at: r.created_at,
      hours_worked: Number(r.hours_worked),
      notes_preview: notes.length > 120 ? `${notes.slice(0, 120)}…` : notes,
      caregiver_name: cgName ?? null,
    }
  })

  const emergencyContact = clientRow.emergency_contact as EmergencyContact | null
  const profileIncomplete =
    clientRow.date_of_birth === '1990-01-01' ||
    !emergencyContact?.name ||
    !emergencyContact?.phone

  return {
    clientId: clientRow.id,
    clientName: clientRow.name,
    profileIncomplete,
    careType: clientRow.care_type,
    caregiverName,
    assignedCaregiverUserId,
    emergencyContact,
    nextVisit,
    daysUntilNext,
    monthVisitCount: monthReports.data?.length ?? 0,
    monthHours,
    unreadMessages,
    recentReports,
    schedulesByWeek: byWeek,
    weekKeys,
    notifications,
  }
}
