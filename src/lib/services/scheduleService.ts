// Scheduling service
// Requirements: 3.1–3.9, 4.1–4.5, 8.1, 11.3, 11.4, 12.1–12.4

import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import {
  AuthenticatedUser,
  CareType,
  CreateScheduleInput,
  DateRange,
  PaginatedResponse,
  Schedule,
  ScheduleStatus,
  ScheduleWithClient,
  ValidationResult,
} from '@/lib/types'
import { isValid, parseISO, isBefore, startOfToday } from 'date-fns'

const MAX_PAGE_SIZE = 100

// ============================================================
// Pure validation — no DB calls, no mutations (Requirements 11.3, 11.4)
// ============================================================

/**
 * Validates a CreateScheduleInput object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Never mutates input. Never performs DB calls.
 * Requirements: 3.7, 3.8, 11.3, 11.4
 */
export function validateScheduleInput(input: CreateScheduleInput): ValidationResult {
  const errors: string[] = []

  if (!input.caregiver_id || typeof input.caregiver_id !== 'string' || input.caregiver_id.trim() === '') {
    errors.push('caregiver_id is required')
  }
  if (!input.client_id || typeof input.client_id !== 'string' || input.client_id.trim() === '') {
    errors.push('client_id is required')
  }

  // Date validation — must be present, valid ISO date, and not in the past
  if (!input.date) {
    errors.push('date is required')
  } else {
    const parsed = parseISO(input.date)
    if (!isValid(parsed)) {
      errors.push('date must be a valid ISO 8601 date (YYYY-MM-DD)')
    } else if (isBefore(parsed, startOfToday())) {
      errors.push('date must not be in the past')
    }
  }

  // Time validation — HH:MM 24-hour format
  if (!input.time) {
    errors.push('time is required')
  } else if (!/^\d{2}:\d{2}$/.test(input.time)) {
    errors.push('time must be in HH:MM 24-hour format')
  }

  // Duration validation — must be > 0
  if (input.duration_minutes === undefined || input.duration_minutes === null) {
    errors.push('duration_minutes is required')
  } else if (typeof input.duration_minutes !== 'number' || input.duration_minutes <= 0) {
    errors.push('duration_minutes must be a positive number')
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

/**
 * Detects whether a candidate schedule overlaps with any existing schedules.
 * Pure function — no mutations, no DB calls.
 * Two windows overlap if one starts before the other ends.
 * Adjacent windows (one ends exactly when the next begins) do NOT conflict.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export function detectScheduleConflict(
  existing: Schedule[],
  candidate: CreateScheduleInput
): boolean {
  const [candH, candM] = candidate.time.split(':').map(Number)
  const candStart = candH * 60 + candM
  const candEnd = candStart + candidate.duration_minutes

  for (const shift of existing) {
    const [shiftH, shiftM] = shift.time.split(':').map(Number)
    const shiftStart = shiftH * 60 + shiftM
    const shiftEnd = shiftStart + shift.duration_minutes

    // Overlap: candStart < shiftEnd AND shiftStart < candEnd
    if (candStart < shiftEnd && shiftStart < candEnd) {
      return true
    }
  }

  return false
}

// ============================================================
// DB operations
// ============================================================

/**
 * Creates a new schedule. Admin-only.
 * Validates input, checks for conflicts, inserts row, broadcasts Realtime event, logs audit.
 * Requirements: 3.1, 3.2, 3.3, 3.9, 12.1
 */
export async function createSchedule(
  input: CreateScheduleInput,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<{ data: Schedule | null; error: string | null; status: number; conflicting_schedule_id?: string }> {
  // Admin-only (Requirement 3.3)
  if (actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  // Validate input
  const validation = validateScheduleInput(input)
  if (!validation.valid) {
    return { data: null, error: validation.errors!.join('; '), status: 400 }
  }

  // Fetch existing schedules for conflict detection
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('caregiver_id', input.caregiver_id)
    .eq('date', input.date)

  if (fetchError) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  // Conflict detection
  if (detectScheduleConflict(existing ?? [], input)) {
    // Find the conflicting schedule id
    const [candH, candM] = input.time.split(':').map(Number)
    const candStart = candH * 60 + candM
    const candEnd = candStart + input.duration_minutes

    const conflicting = (existing ?? []).find((shift) => {
      const [h, m] = shift.time.split(':').map(Number)
      const s = h * 60 + m
      const e = s + shift.duration_minutes
      return candStart < e && s < candEnd
    })

    return {
      data: null,
      error: 'Caregiver has an overlapping shift',
      status: 409,
      conflicting_schedule_id: conflicting?.id,
    }
  }

  // Insert schedule
  const { data: schedule, error: insertError } = await supabaseAdmin
    .from('schedules')
    .insert({
      caregiver_id: input.caregiver_id,
      client_id: input.client_id,
      date: input.date,
      time: input.time,
      duration_minutes: input.duration_minutes,
      notes: input.notes ?? null,
      status: 'pending',
      created_by: actor.id,
    })
    .select()
    .single()

  if (insertError) {
    // Handle unique constraint violation (concurrent insert)
    if (insertError.code === '23505') {
      return { data: null, error: 'Caregiver has an overlapping shift', status: 409 }
    }
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  // Broadcast Realtime event (best-effort)
  await supabaseAdmin
    .channel(`caregiver:${input.caregiver_id}`)
    .send({
      type: 'broadcast',
      event: 'schedule.created',
      payload: schedule,
    })
    .catch(() => { /* non-fatal */ })

  // Audit log
  await insertAuditLog({
    actor_id: actor.id,
    action: 'schedule.created',
    resource: 'schedules',
    resource_id: schedule.id,
    ip_address: ipAddress,
  })

  return { data: schedule as Schedule, error: null, status: 201 }
}

const CAREGIVER_STATUS_TRANSITIONS: Record<ScheduleStatus, ScheduleStatus[]> = {
  pending: ['confirmed'],
  confirmed: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}

/**
 * Updates a schedule's status.
 * Admin: any valid status. Caregiver: own shifts, allowed transitions only (sets started_at / completed_at).
 * Requirements: 3.4, 3.9
 */
export async function updateScheduleStatus(
  id: string,
  status: ScheduleStatus,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<{ data: Schedule | null; error: string | null; status: number }> {
  const validStatuses: ScheduleStatus[] = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    return { data: null, error: `Invalid status: ${status}`, status: 400 }
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { data: null, error: 'Schedule not found', status: 404 }
  }

  const current = existing.status as ScheduleStatus

  if (actor.role === 'caregiver') {
    if (!actor.caregiverId || existing.caregiver_id !== actor.caregiverId) {
      return { data: null, error: 'Forbidden', status: 403 }
    }
    const allowed = CAREGIVER_STATUS_TRANSITIONS[current] ?? []
    if (!allowed.includes(status)) {
      return {
        data: null,
        error: `Cannot change status from ${current} to ${status}`,
        status: 400,
      }
    }
  } else if (actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  }
  if (status === 'in_progress') {
    patch.started_at = now
  }
  if (status === 'completed') {
    patch.completed_at = now
  }

  const { data: schedule, error } = await supabaseAdmin
    .from('schedules')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'schedule.updated',
    resource: 'schedules',
    resource_id: id,
    metadata: { status, from: current },
    ip_address: ipAddress,
  })

  return { data: schedule as Schedule, error: null, status: 200 }
}

/**
 * Returns schedules for a caregiver within a date range, cursor-paginated.
 * Requirements: 3.5, 12.1–12.4
 */
export async function getSchedulesForCaregiver(
  caregiverId: string,
  dateRange: DateRange,
  actor: AuthenticatedUser,
  cursor?: string,
  pageSize = 20
): Promise<PaginatedResponse<Schedule>> {
  const limit = Math.min(pageSize, MAX_PAGE_SIZE)

  let query = supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('caregiver_id', caregiverId)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (cursor) {
    query = query.gt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) return { data: [], next_cursor: null }

  const hasMore = data.length > limit
  const rows = hasMore ? data.slice(0, limit) : data
  const next_cursor = hasMore ? rows[rows.length - 1].created_at : null

  return { data: rows as Schedule[], next_cursor }
}

/**
 * Returns schedules for a client within a date range, cursor-paginated.
 * Requirements: 3.6, 12.1–12.4
 */
export async function getSchedulesForClient(
  clientId: string,
  dateRange: DateRange,
  actor: AuthenticatedUser,
  cursor?: string,
  pageSize = 20
): Promise<PaginatedResponse<Schedule>> {
  const limit = Math.min(pageSize, MAX_PAGE_SIZE)

  let query = supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (cursor) {
    query = query.gt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) return { data: [], next_cursor: null }

  const hasMore = data.length > limit
  const rows = hasMore ? data.slice(0, limit) : data
  const next_cursor = hasMore ? rows[rows.length - 1].created_at : null

  return { data: rows as Schedule[], next_cursor }
}

/**
 * Schedules for a caregiver with client name and care type (dashboards).
 * Caregiver may only read their own shifts; admin may read any caregiverId.
 */
export async function getSchedulesForCaregiverWithClients(
  caregiverId: string,
  dateRange: DateRange,
  actor: AuthenticatedUser
): Promise<ScheduleWithClient[]> {
  if (actor.role !== 'admin' && actor.caregiverId !== caregiverId) {
    return []
  }

  const { data, error } = await supabaseAdmin
    .from('schedules')
    .select(
      `
      id,
      caregiver_id,
      client_id,
      date,
      time,
      duration_minutes,
      status,
      notes,
      started_at,
      completed_at,
      created_by,
      created_at,
      updated_at,
      clients ( name, care_type )
    `
    )
    .eq('caregiver_id', caregiverId)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(100)

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => {
    const clients = row.clients as { name?: string; care_type?: string } | null
    return {
      id: row.id as string,
      caregiver_id: row.caregiver_id as string,
      client_id: row.client_id as string,
      date: row.date as string,
      time: row.time as string,
      duration_minutes: row.duration_minutes as number,
      status: row.status as ScheduleStatus,
      notes: row.notes as string | null,
      started_at: (row.started_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
      created_by: row.created_by as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      client_name: clients?.name ?? 'Client',
      care_type: (clients?.care_type ?? 'elderly') as CareType,
    }
  })
}
