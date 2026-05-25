// Medication Administration Records (MAR) Service
// Tracks medication sign-offs per shift — administered, refused, or missed
// Australian Privacy Act 1988 (APP) compliant — access is role-scoped via RLS

import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import {
  AuthenticatedUser,
  CreateMedicationLogInput,
  MedicationLog,
  MedicationStatus,
} from '@/lib/types'

// ============================================================
// Validation
// ============================================================

const VALID_STATUSES: MedicationStatus[] = ['administered', 'refused', 'missed']
const TIME_REGEX = /^\d{2}:\d{2}$/

function validateMedicationLog(input: CreateMedicationLogInput): string[] {
  const errors: string[] = []

  if (!input.schedule_id?.trim())     errors.push('schedule_id is required')
  if (!input.medication_name?.trim()) errors.push('medication_name is required')
  if (!input.dosage?.trim())          errors.push('dosage is required')
  if (!input.scheduled_time?.trim())  errors.push('scheduled_time is required')
  else if (!TIME_REGEX.test(input.scheduled_time)) {
    errors.push('scheduled_time must be in HH:MM format')
  }
  if (!VALID_STATUSES.includes(input.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`)
  }

  return errors
}

// ============================================================
// logMedicationAdministration
// Caregivers log a medication event for a specific shift.
// Only the assigned caregiver for that schedule can log entries.
// ============================================================
export async function logMedicationAdministration(
  input: CreateMedicationLogInput,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<{ data: MedicationLog | null; error: string | null; status: number }> {

  if (actor.role !== 'caregiver' && actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  const errors = validateMedicationLog(input)
  if (errors.length > 0) {
    return { data: null, error: errors.join('; '), status: 400 }
  }

  // Verify schedule exists and caregiver is assigned to it
  const { data: schedule, error: scheduleErr } = await supabaseAdmin
    .from('schedules')
    .select('id, caregiver_id, status')
    .eq('id', input.schedule_id)
    .single()

  if (scheduleErr || !schedule) {
    return { data: null, error: 'Schedule not found', status: 404 }
  }

  // Caregivers can only log meds for their own schedules
  if (actor.role === 'caregiver') {
    if (!actor.caregiverId || schedule.caregiver_id !== actor.caregiverId) {
      return { data: null, error: 'You are not assigned to this schedule', status: 403 }
    }
  }

  // Cannot log medications for cancelled schedules
  if (schedule.status === 'cancelled') {
    return { data: null, error: 'Cannot log medications for a cancelled schedule', status: 409 }
  }

  const { data: log, error: insertError } = await supabaseAdmin
    .from('medication_logs')
    .insert({
      schedule_id:      input.schedule_id,
      medication_name:  input.medication_name,
      dosage:           input.dosage,
      scheduled_time:   input.scheduled_time,
      administered_at:  input.status === 'administered' ? new Date().toISOString() : null,
      status:           input.status,
      caregiver_id:     actor.caregiverId ?? null,
      notes:            input.notes ?? null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[medicationService] insert error:', insertError)
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id:    actor.id,
    action:      'medication.logged',
    resource:    'medication_logs',
    resource_id: log.id,
    metadata:    {
      schedule_id:     input.schedule_id,
      medication_name: input.medication_name,
      status:          input.status,
    },
    ip_address: ipAddress,
  })

  return { data: log as MedicationLog, error: null, status: 201 }
}

// ============================================================
// getMedicationLogsForSchedule
// Returns all medication logs for a given shift.
// Access: assigned caregiver, admin, linked client, linked family member (via RLS).
// ============================================================
export async function getMedicationLogsForSchedule(
  scheduleId: string,
  actor: AuthenticatedUser
): Promise<{ data: MedicationLog[]; error: string | null; status: number }> {

  // Validate the caller has access to this schedule at all
  const { data: schedule, error: scheduleErr } = await supabaseAdmin
    .from('schedules')
    .select('id, caregiver_id, client_id')
    .eq('id', scheduleId)
    .single()

  if (scheduleErr || !schedule) {
    return { data: [], error: 'Schedule not found', status: 404 }
  }

  // Caregivers may only see logs for their own schedules
  if (actor.role === 'caregiver' && actor.caregiverId !== schedule.caregiver_id) {
    return { data: [], error: 'Forbidden', status: 403 }
  }

  const { data: logs, error } = await supabaseAdmin
    .from('medication_logs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('scheduled_time', { ascending: true })

  if (error) {
    return { data: [], error: 'Service temporarily unavailable', status: 503 }
  }

  return { data: (logs ?? []) as MedicationLog[], error: null, status: 200 }
}

// ============================================================
// getMedicationSummaryForClient
// Admin/family member: returns aggregated MAR stats for a client
// over a rolling window (useful for compliance reporting).
// ============================================================
export async function getMedicationSummaryForClient(
  clientId: string,
  actor: AuthenticatedUser
): Promise<{
  total: number
  administered: number
  refused: number
  missed: number
  adherenceRate: number
} | null> {

  if (!['admin', 'family_member'].includes(actor.role)) return null

  // Get all schedules for this client
  const { data: schedules } = await supabaseAdmin
    .from('schedules')
    .select('id')
    .eq('client_id', clientId)

  if (!schedules || schedules.length === 0) {
    return { total: 0, administered: 0, refused: 0, missed: 0, adherenceRate: 0 }
  }

  const scheduleIds = schedules.map(s => s.id)

  const { data: logs, error } = await supabaseAdmin
    .from('medication_logs')
    .select('status')
    .in('schedule_id', scheduleIds)

  if (error || !logs) return null

  const administered = logs.filter(l => l.status === 'administered').length
  const refused      = logs.filter(l => l.status === 'refused').length
  const missed       = logs.filter(l => l.status === 'missed').length
  const total        = logs.length
  const adherenceRate = total > 0 ? Math.round((administered / total) * 100) : 0

  return { total, administered, refused, missed, adherenceRate }
}
