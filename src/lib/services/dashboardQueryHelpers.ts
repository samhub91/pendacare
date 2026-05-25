// Shared dashboard query helpers (missing reports, name joins)

import { supabaseAdmin } from '@/lib/supabase/admin'
interface ScheduleJoinRow {
  id: string
  date: string
  time: string
  status: string
  client_id: string
  caregiver_id: string
  clients: { name: string } | { name: string }[] | null
  caregivers: { name: string } | { name: string }[] | null
}

export interface MissingReportShiftRow {
  id: string
  date: string
  time: string
  client_id: string
  client_name: string
  caregiver_name: string
}

function joinedName(rel: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!rel) return null
  if (Array.isArray(rel)) return rel[0]?.name ?? null
  return rel.name
}

/**
 * Completed schedules with no report linked via schedule_id.
 * Heuristic only — same-day unlinked reports may still exist.
 */
export async function getCompletedSchedulesMissingReports(options: {
  caregiverId?: string
  clientId?: string
  limit?: number
}): Promise<MissingReportShiftRow[]> {
  const limit = options.limit ?? 10

  let query = supabaseAdmin
    .from('schedules')
    .select(
      `
      id,
      date,
      time,
      status,
      client_id,
      caregiver_id,
      clients ( name ),
      caregivers ( name )
    `
    )
    .eq('status', 'completed')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(50)

  if (options.caregiverId) {
    query = query.eq('caregiver_id', options.caregiverId)
  }
  if (options.clientId) {
    query = query.eq('client_id', options.clientId)
  }

  const { data: schedules, error } = await query
  if (error || !schedules?.length) return []

  const scheduleIds = schedules.map((s) => s.id)
  const { data: reports } = await supabaseAdmin
    .from('reports')
    .select('schedule_id')
    .in('schedule_id', scheduleIds)

  const reportedIds = new Set(
    (reports ?? []).map((r) => r.schedule_id).filter(Boolean) as string[]
  )

  return (schedules as unknown as ScheduleJoinRow[])
    .filter((s) => !reportedIds.has(s.id))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      date: row.date,
      time: row.time,
      client_id: row.client_id,
      client_name: joinedName(row.clients) ?? 'Unknown client',
      caregiver_name: joinedName(row.caregivers) ?? 'Unknown caregiver',
    }))
}

export function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export interface DayScheduleCount {
  date: string
  count: number
}

export async function getWeekScheduleCounts(
  startDate: string,
  endDate: string
): Promise<DayScheduleCount[]> {
  const { data } = await supabaseAdmin
    .from('schedules')
    .select('date')
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled')

  const counts = new Map<string, number>()
  let d = startDate
  while (d <= endDate) {
    counts.set(d, 0)
    d = addDaysIso(d, 1)
  }
  for (const row of data ?? []) {
    const date = row.date as string
    if (counts.has(date)) {
      counts.set(date, (counts.get(date) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
}
