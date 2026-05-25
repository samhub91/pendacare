// Profile read/update for authenticated users by role

import { supabaseAdmin } from '@/lib/supabase/admin'
import type {
  AuthenticatedUser,
  CaregiverAvailability,
  CareType,
  ContactInfo,
  EmergencyContact,
} from '@/lib/types'
import { getFamilyLinkRequestsForUser } from '@/lib/services/familyLinkRequestService'

type ServiceResult<T> = { data: T | null; error: string | null; status: number }

export interface CaregiverProfileData {
  role: 'caregiver'
  name: string
  email: string
  contact_info: ContactInfo | null
  qualifications: string[]
  availability: CaregiverAvailability | null
}

export interface ClientProfileData {
  role: 'client'
  name: string
  email: string
  contact_info: ContactInfo | null
  client_id: string
  date_of_birth: string
  care_type: CareType
  emergency_contact: EmergencyContact | null
}

export interface FamilyProfileData {
  role: 'family_member'
  name: string
  email: string
  contact_info: ContactInfo | null
  link_requests: Awaited<ReturnType<typeof getFamilyLinkRequestsForUser>>
}

export type MyProfileData = CaregiverProfileData | ClientProfileData | FamilyProfileData

export async function getMyProfile(user: AuthenticatedUser): Promise<ServiceResult<MyProfileData>> {
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('name, email, contact_info')
    .eq('id', user.id)
    .single()

  if (!userRow) {
    return { data: null, error: 'Profile not found', status: 404 }
  }

  const contact_info = (userRow.contact_info as ContactInfo | null) ?? null

  if (user.role === 'caregiver' && user.caregiverId) {
    const { data: cg } = await supabaseAdmin
      .from('caregivers')
      .select('qualifications, availability')
      .eq('id', user.caregiverId)
      .single()

    return {
      data: {
        role: 'caregiver',
        name: userRow.name,
        email: userRow.email,
        contact_info,
        qualifications: cg?.qualifications ?? [],
        availability: (cg?.availability as CaregiverAvailability | null) ?? null,
      },
      error: null,
      status: 200,
    }
  }

  if (user.role === 'client') {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, date_of_birth, care_type, emergency_contact')
      .eq('user_id', user.id)
      .single()

    if (!client) {
      return { data: null, error: 'Client profile not found', status: 404 }
    }

    return {
      data: {
        role: 'client',
        name: userRow.name,
        email: userRow.email,
        contact_info,
        client_id: client.id,
        date_of_birth: client.date_of_birth,
        care_type: client.care_type as CareType,
        emergency_contact: client.emergency_contact as EmergencyContact | null,
      },
      error: null,
      status: 200,
    }
  }

  if (user.role === 'family_member') {
    const link_requests = await getFamilyLinkRequestsForUser(user.id)
    return {
      data: {
        role: 'family_member',
        name: userRow.name,
        email: userRow.email,
        contact_info,
        link_requests,
      },
      error: null,
      status: 200,
    }
  }

  return { data: null, error: 'Profile not available for this role', status: 403 }
}

function parseQualifications(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function updateMyProfile(
  user: AuthenticatedUser,
  body: Record<string, unknown>
): Promise<ServiceResult<MyProfileData>> {
  const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined
  const contact_info: ContactInfo = phone ? { phone } : {}

  await supabaseAdmin
    .from('users')
    .update({
      contact_info,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (user.role === 'caregiver' && user.caregiverId) {
    const qualifications =
      typeof body.qualifications === 'string'
        ? parseQualifications(body.qualifications)
        : undefined
    const availability_notes =
      typeof body.availability_notes === 'string' ? body.availability_notes.trim() : undefined

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (qualifications !== undefined) patch.qualifications = qualifications
    if (availability_notes !== undefined) {
      patch.availability = { notes: availability_notes }
    }

    if (Object.keys(patch).length > 1) {
      await supabaseAdmin.from('caregivers').update(patch).eq('id', user.caregiverId)
    }
  }

  if (user.role === 'client') {
    const emergency_contact =
      body.emergency_contact && typeof body.emergency_contact === 'object'
        ? (body.emergency_contact as EmergencyContact)
        : undefined

    if (emergency_contact) {
      await supabaseAdmin
        .from('clients')
        .update({
          emergency_contact,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }
  }

  return getMyProfile(user)
}
