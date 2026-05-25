// Client Profile Service
// Requirements: 5.1–5.10, 6.1, 10.1, 14.1

import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import { encryptHealthInfo, decryptHealthInfo } from '@/lib/crypto/encryption'
import {
  AuthenticatedUser,
  CareType,
  ClientProfile,
  EmergencyContact,
  HealthInfo,
} from '@/lib/types'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

type ServiceResult<T> = { data: T | null; error: string | null; status: number }

/**
 * Fetches a client profile with role-based access control and health_info decryption.
 * Requirements: 5.1–5.5, 5.7, 5.9, 14.1
 */
export async function getClientProfile(
  clientId: string,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<ClientProfile>> {
  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error || !client) {
    return { data: null, error: 'Client not found', status: 404 }
  }

  // Role-based access checks
  if (actor.role === 'caregiver') {
    if (client.assigned_caregiver_id !== actor.caregiverId) {
      await insertAuditLog({
        actor_id: actor.id,
        action: 'client.profile.access_denied',
        resource: 'clients',
        resource_id: clientId,
        ip_address: ipAddress,
      })
      return { data: null, error: 'Not assigned to this client', status: 403 }
    }
  } else if (actor.role === 'client') {
    if (client.user_id !== actor.id) {
      await insertAuditLog({
        actor_id: actor.id,
        action: 'client.profile.access_denied',
        resource: 'clients',
        resource_id: clientId,
        ip_address: ipAddress,
      })
      return { data: null, error: 'Cannot access another client\'s profile', status: 403 }
    }
  } else if (actor.role === 'family_member') {
    const { data: link } = await supabaseAdmin
      .from('family_links')
      .select('id')
      .eq('family_member_id', actor.id)
      .eq('client_id', clientId)
      .single()

    if (!link) {
      await insertAuditLog({
        actor_id: actor.id,
        action: 'client.profile.access_denied',
        resource: 'clients',
        resource_id: clientId,
        ip_address: ipAddress,
      })
      return { data: null, error: 'Not linked to this client', status: 403 }
    }
  }
  // admin: no additional check needed

  // Decrypt health_info
  let healthInfo: HealthInfo | null = null
  if (client.health_info) {
    try {
      healthInfo = decryptHealthInfo(client.health_info as string, ENCRYPTION_KEY)
    } catch {
      healthInfo = null
    }
  }

  // Audit log for successful access
  await insertAuditLog({
    actor_id: actor.id,
    action: 'client.profile.viewed',
    resource: 'clients',
    resource_id: clientId,
    ip_address: ipAddress,
  })

  const profile: ClientProfile = {
    ...client,
    health_info: healthInfo,
  }

  return { data: profile, error: null, status: 200 }
}

/**
 * Updates health_info with encryption and version history.
 * Requirements: 5.6, 5.7, 5.8, 6.1, 10.1
 */
export async function updateHealthInfo(
  clientId: string,
  info: HealthInfo,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<ClientProfile>> {
  if (actor.role !== 'admin' && actor.role !== 'caregiver') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  // Fetch current health_info for version history
  const { data: current } = await supabaseAdmin
    .from('clients')
    .select('health_info')
    .eq('id', clientId)
    .single()

  // Save previous version to history
  if (current?.health_info) {
    await supabaseAdmin.from('health_info_history').insert({
      client_id: clientId,
      health_info: current.health_info,
      changed_by: actor.id,
    })
  }

  // Encrypt new health_info
  const encrypted = encryptHealthInfo(info, ENCRYPTION_KEY)

  const { data: updated, error } = await supabaseAdmin
    .from('clients')
    .update({ health_info: encrypted, updated_at: new Date().toISOString() })
    .eq('id', clientId)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'client.health_info.updated',
    resource: 'clients',
    resource_id: clientId,
    ip_address: ipAddress,
  })

  return { data: { ...updated, health_info: info }, error: null, status: 200 }
}

/**
 * Updates client demographics (admin only).
 */
export async function updateClientDemographics(
  clientId: string,
  input: {
    date_of_birth?: string
    care_type?: CareType
    emergency_contact?: EmergencyContact | null
    assigned_caregiver_id?: string | null
  },
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<ClientProfile>> {
  if (actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.date_of_birth !== undefined) patch.date_of_birth = input.date_of_birth
  if (input.care_type !== undefined) patch.care_type = input.care_type
  if (input.emergency_contact !== undefined) patch.emergency_contact = input.emergency_contact
  if (input.assigned_caregiver_id !== undefined) {
    patch.assigned_caregiver_id = input.assigned_caregiver_id
  }

  const { data: updated, error } = await supabaseAdmin
    .from('clients')
    .update(patch)
    .eq('id', clientId)
    .select('*')
    .single()

  if (error || !updated) {
    return { data: null, error: 'Failed to update client', status: 503 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'client.demographics.updated',
    resource: 'clients',
    resource_id: clientId,
    ip_address: ipAddress,
  })

  let healthInfo: HealthInfo | null = null
  if (updated.health_info) {
    try {
      healthInfo = decryptHealthInfo(updated.health_info as string, ENCRYPTION_KEY)
    } catch {
      healthInfo = null
    }
  }

  return {
    data: { ...updated, health_info: healthInfo } as ClientProfile,
    error: null,
    status: 200,
  }
}

/**
 * Assigns a caregiver to a client. Admin-only.
 * Requirements: 5.10, 14.1
 */
export async function assignCaregiver(
  clientId: string,
  caregiverId: string,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<void>> {
  if (actor.role !== 'admin') {
    return { data: null, error: 'Forbidden', status: 403 }
  }

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ assigned_caregiver_id: caregiverId, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'client.caregiver.assigned',
    resource: 'clients',
    resource_id: clientId,
    metadata: { caregiverId },
    ip_address: ipAddress,
  })

  return { data: null, error: null, status: 200 }
}

/**
 * Uploads a document to Supabase Storage and returns a signed URL.
 * Returns error response (no URL) on storage failure.
 * Requirements: 5.10
 */
export async function uploadDocument(
  clientId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<{ signedUrl: string }>> {
  const path = `clients/${clientId}/${Date.now()}_${fileName}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(path, file, { contentType: mimeType })

  if (uploadError) {
    return { data: null, error: 'Document storage failed', status: 500 }
  }

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(path, 3600) // 1-hour expiry

  if (signError || !signedData?.signedUrl) {
    return { data: null, error: 'Failed to generate signed URL', status: 500 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'client.document.uploaded',
    resource: 'clients',
    resource_id: clientId,
    metadata: { fileName, path },
    ip_address: ipAddress,
  })

  return { data: { signedUrl: signedData.signedUrl }, error: null, status: 200 }
}
