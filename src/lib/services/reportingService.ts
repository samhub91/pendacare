// Reporting Service
// Requirements: 8.1–8.6, 9.1–9.5, 10.1, 10.2, 12.1–12.4

import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import {
  AuthenticatedUser,
  CreateReportInput,
  DateRange,
  MonthlySummary,
  PaginatedResponse,
  Report,
} from '@/lib/types'

const MAX_PAGE_SIZE = 100

type ServiceResult<T> = { data: T | null; error: string | null; status: number }

/**
 * Creates a visit report. Caregiver-only.
 * Validates hours_worked (0.25–24), verifies caregiver assignment.
 * Requirements: 8.1, 8.2, 8.3, 10.1
 */
export async function createReport(
  input: CreateReportInput,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<Report>> {
  // Caregiver-only (Requirement 8.2)
  if (actor.role !== 'caregiver') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  // Validate hours_worked (Requirement 8.3)
  if (
    typeof input.hours_worked !== 'number' ||
    input.hours_worked < 0.25 ||
    input.hours_worked > 24
  ) {
    return {
      data: null,
      error: 'hours_worked must be between 0.25 and 24 inclusive',
      status: 400,
    }
  }

  // Verify caregiver is assigned to this client (Requirement 8.1)
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('assigned_caregiver_id')
    .eq('id', input.client_id)
    .single()

  if (!client || client.assigned_caregiver_id !== actor.caregiverId) {
    return { data: null, error: 'Not assigned to this client', status: 403 }
  }

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .insert({
      caregiver_id: actor.caregiverId!,
      client_id: input.client_id,
      schedule_id: input.schedule_id ?? null,
      notes: input.notes,
      hours_worked: input.hours_worked,
      feedback: input.feedback ?? null,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'report.created',
    resource: 'reports',
    resource_id: report.id,
    ip_address: ipAddress,
  })

  return { data: report as Report, error: null, status: 201 }
}

/**
 * Returns reports for a caregiver, cursor-paginated (max 100).
 * Requirements: 8.5, 12.1–12.4
 */
export async function getReportsByCaregiver(
  caregiverId: string,
  dateRange: DateRange,
  actor: AuthenticatedUser,
  cursor?: string,
  pageSize = 20,
  ipAddress?: string
): Promise<PaginatedResponse<Report>> {
  const limit = Math.min(pageSize, MAX_PAGE_SIZE)

  let query = supabaseAdmin
    .from('reports')
    .select('*')
    .eq('caregiver_id', caregiverId)
    .gte('created_at', dateRange.start)
    .lte('created_at', dateRange.end)
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (cursor) query = query.gt('created_at', cursor)

  const { data, error } = await query
  if (error) return { data: [], next_cursor: null }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'reports.listed',
    resource: 'reports',
    ip_address: ipAddress,
  })

  const hasMore = data.length > limit
  const rows = hasMore ? data.slice(0, limit) : data
  return { data: rows as Report[], next_cursor: hasMore ? rows[rows.length - 1].created_at : null }
}

/**
 * Returns reports for a client. Accessible by admin and family_member.
 * Requirements: 8.4, 12.1–12.4
 */
export async function getReportsByClient(
  clientId: string,
  dateRange: DateRange,
  actor: AuthenticatedUser,
  cursor?: string,
  pageSize = 20,
  ipAddress?: string
): Promise<PaginatedResponse<Report>> {
  if (actor.role !== 'admin' && actor.role !== 'family_member') {
    return { data: [], next_cursor: null }
  }

  const limit = Math.min(pageSize, MAX_PAGE_SIZE)

  let query = supabaseAdmin
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', dateRange.start)
    .lte('created_at', dateRange.end)
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (cursor) query = query.gt('created_at', cursor)

  const { data, error } = await query
  if (error) return { data: [], next_cursor: null }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'reports.listed',
    resource: 'reports',
    metadata: { client_id: clientId },
    ip_address: ipAddress,
  })

  const hasMore = data.length > limit
  const rows = hasMore ? data.slice(0, limit) : data
  return { data: rows as Report[], next_cursor: hasMore ? rows[rows.length - 1].created_at : null }
}

/**
 * Generates a monthly summary for a client.
 * Requirements: 8.6
 */
export async function generateSummary(
  clientId: string,
  month: string, // YYYY-MM
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<MonthlySummary>> {
  const start = `${month}-01`
  const end = `${month}-31`

  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('*, caregivers(name)')
    .eq('client_id', clientId)
    .gte('created_at', start)
    .lte('created_at', end)

  if (error) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  const total_hours = reports.reduce((sum: number, r: Report) => sum + Number(r.hours_worked), 0)
  type ReportWithCaregiverJoin = Report & { caregivers?: { name?: string } | null }
  const caregiverNames = Array.from(
    new Set(
      reports
        .map((r: ReportWithCaregiverJoin) => r.caregivers?.name)
        .filter((n): n is string => Boolean(n))
    )
  )
  const highlights = reports
    .filter((r: Report) => r.feedback)
    .map((r: Report) => r.feedback as string)

  await insertAuditLog({
    actor_id: actor.id,
    action: 'reports.summary.generated',
    resource: 'reports',
    metadata: { client_id: clientId, month },
    ip_address: ipAddress,
  })

  return {
    data: {
      client_id: clientId,
      month,
      total_hours,
      visit_count: reports.length,
      caregivers: caregiverNames as string[],
      highlights,
    },
    error: null,
    status: 200,
  }
}
