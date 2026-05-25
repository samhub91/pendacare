// Incident Reporting Service
// Handles structured clinical incident reporting, automatic escalation, and resolution workflows
// Australian Privacy Act 1988 (APP) compliant — all access is role-scoped via RLS

import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import {
  AuthenticatedUser,
  CreateIncidentInput,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  PaginatedResponse,
  ResolveIncidentInput,
} from '@/lib/types'

const MAX_PAGE_SIZE = 100

// ============================================================
// Validation
// ============================================================

const VALID_SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical']
const VALID_STATUSES: IncidentStatus[]     = ['open', 'under_investigation', 'resolved']

function validateIncidentInput(input: CreateIncidentInput): string[] {
  const errors: string[] = []

  if (!input.client_id?.trim())    errors.push('client_id is required')
  if (!input.caregiver_id?.trim()) errors.push('caregiver_id is required')
  if (!input.title?.trim())        errors.push('title is required')
  if (!input.description?.trim())  errors.push('description is required')
  if (!VALID_SEVERITIES.includes(input.severity)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`)
  }

  return errors
}

// ============================================================
// reportIncident
// Caregivers can file incidents against their own clients.
// High/critical severity incidents automatically trigger escalation
// notifications to all admins via a DB-level trigger (tr_escalate_incidents).
// ============================================================
export async function reportIncident(
  input: CreateIncidentInput,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<{ data: Incident | null; error: string | null; status: number }> {

  // Only caregivers and admins can report incidents
  if (actor.role !== 'caregiver' && actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  const errors = validateIncidentInput(input)
  if (errors.length > 0) {
    return { data: null, error: errors.join('; '), status: 400 }
  }

  // Caregivers can only file incidents against their own assigned clients
  if (actor.role === 'caregiver') {
    if (!actor.caregiverId) {
      return { data: null, error: 'Caregiver profile not found', status: 403 }
    }

    // Verify that this caregiver is indeed assigned to this client
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, assigned_caregiver_id')
      .eq('id', input.client_id)
      .single()

    if (clientErr || !client) {
      return { data: null, error: 'Client not found', status: 404 }
    }

    if (client.assigned_caregiver_id !== actor.caregiverId) {
      return { data: null, error: 'You are not the assigned caregiver for this client', status: 403 }
    }

    // Force caregiver_id to the authenticated caregiver's own profile id
    input = { ...input, caregiver_id: actor.caregiverId }
  }

  const { data: incident, error: insertError } = await supabaseAdmin
    .from('incidents')
    .insert({
      client_id:    input.client_id,
      caregiver_id: input.caregiver_id,
      schedule_id:  input.schedule_id ?? null,
      title:        input.title,
      description:  input.description,
      severity:     input.severity,
      status:       'open',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[incidentService] insert error:', insertError)
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id:    actor.id,
    action:      'incident.reported',
    resource:    'incidents',
    resource_id: incident.id,
    metadata:    { severity: input.severity, client_id: input.client_id },
    ip_address:  ipAddress,
  })

  return { data: incident as Incident, error: null, status: 201 }
}

// ============================================================
// resolveIncident
// Admin-only — updates status and sets resolution notes.
// ============================================================
export async function resolveIncident(
  incidentId: string,
  input: ResolveIncidentInput,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<{ data: Incident | null; error: string | null; status: number }> {

  if (actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  if (!VALID_STATUSES.includes(input.status)) {
    return { data: null, error: `status must be one of: ${VALID_STATUSES.join(', ')}`, status: 400 }
  }

  if (!input.resolution_notes?.trim()) {
    return { data: null, error: 'resolution_notes are required when resolving an incident', status: 400 }
  }

  const { data: incident, error } = await supabaseAdmin
    .from('incidents')
    .update({
      status:           input.status,
      resolution_notes: input.resolution_notes,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', incidentId)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Incident not found or service unavailable', status: error.code === 'PGRST116' ? 404 : 503 }
  }

  await insertAuditLog({
    actor_id:    actor.id,
    action:      'incident.resolved',
    resource:    'incidents',
    resource_id: incidentId,
    metadata:    { status: input.status, resolution_notes: input.resolution_notes },
    ip_address:  ipAddress,
  })

  return { data: incident as Incident, error: null, status: 200 }
}

// ============================================================
// getIncidentsForClient
// Admin, assigned caregiver, client, and linked family member can view.
// ============================================================
export async function getIncidentsForClient(
  clientId: string,
  actor: AuthenticatedUser,
  cursor?: string,
  pageSize = 20
): Promise<PaginatedResponse<Incident>> {
  const limit = Math.min(pageSize, MAX_PAGE_SIZE)

  // Family members and clients cannot see other clients' incidents (enforced also by RLS)
  if (actor.role === 'client' || actor.role === 'family_member') {
    const { data: accessCheck } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single()

    if (!accessCheck) return { data: [], next_cursor: null }
  }

  let query = supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error || !data) return { data: [], next_cursor: null }

  const hasMore     = data.length > limit
  const rows        = hasMore ? data.slice(0, limit) : data
  const next_cursor = hasMore ? rows[rows.length - 1].created_at : null

  return { data: rows as Incident[], next_cursor }
}

// ============================================================
// getOpenEscalatedIncidents
// Admin-only — returns all open, escalated incidents for the operations dashboard.
// ============================================================
export async function getOpenEscalatedIncidents(
  actor: AuthenticatedUser,
  cursor?: string,
  pageSize = 50
): Promise<PaginatedResponse<Incident>> {
  if (actor.role !== 'admin') return { data: [], next_cursor: null }

  const limit = Math.min(pageSize, MAX_PAGE_SIZE)

  let query = supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('escalated', true)
    .in('status', ['open', 'under_investigation'])
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error || !data) return { data: [], next_cursor: null }

  const hasMore     = data.length > limit
  const rows        = hasMore ? data.slice(0, limit) : data
  const next_cursor = hasMore ? rows[rows.length - 1].created_at : null

  return { data: rows as Incident[], next_cursor }
}
