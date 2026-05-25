// Family link requests — signup queue and admin approval

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AuthenticatedUser, FamilyLinkRequest } from '@/lib/types'

type ServiceResult<T> = { data: T | null; error: string | null; status: number }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function createFamilyLinkRequest(
  familyMemberId: string,
  clientEmail: string,
  recipientName?: string
): Promise<ServiceResult<FamilyLinkRequest>> {
  const email = normalizeEmail(clientEmail)

  const { data, error } = await supabaseAdmin
    .from('family_link_requests')
    .insert({
      family_member_id: familyMemberId,
      client_email: email,
      recipient_name: recipientName?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'You already have a pending request for this email', status: 409 }
    }
    return { data: null, error: 'Failed to submit link request', status: 503 }
  }

  return { data: data as FamilyLinkRequest, error: null, status: 201 }
}

export async function listPendingFamilyLinkRequests(): Promise<FamilyLinkRequest[]> {
  const { data } = await supabaseAdmin
    .from('family_link_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20)

  return (data ?? []) as FamilyLinkRequest[]
}

export async function getFamilyLinkRequestsForUser(
  familyMemberId: string
): Promise<FamilyLinkRequest[]> {
  const { data } = await supabaseAdmin
    .from('family_link_requests')
    .select('*')
    .eq('family_member_id', familyMemberId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (data ?? []) as FamilyLinkRequest[]
}

export async function approveFamilyLinkRequest(
  requestId: string,
  admin: AuthenticatedUser
): Promise<ServiceResult<FamilyLinkRequest>> {
  const { data: request, error: fetchError } = await supabaseAdmin
    .from('family_link_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    return { data: null, error: 'Request not found', status: 404 }
  }
  if (request.status !== 'pending') {
    return { data: null, error: 'Request is no longer pending', status: 400 }
  }

  const { data: clientUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', request.client_email)
    .eq('role', 'client')
    .maybeSingle()

  if (!clientUser) {
    return {
      data: null,
      error: 'No client account found with that email. Ask them to register as a client first.',
      status: 404,
    }
  }

  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('user_id', clientUser.id)
    .maybeSingle()

  if (!clientRow) {
    return { data: null, error: 'Client profile not found for that email', status: 404 }
  }

  const { error: linkError } = await supabaseAdmin.from('family_links').insert({
    family_member_id: request.family_member_id,
    client_id: clientRow.id,
  })

  if (linkError) {
    if (linkError.code === '23505') {
      return { data: null, error: 'This family member is already linked to that client', status: 409 }
    }
    return { data: null, error: 'Failed to create family link', status: 503 }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('family_link_requests')
    .update({
      status: 'approved',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single()

  if (updateError) {
    return { data: null, error: 'Failed to update request status', status: 503 }
  }

  return { data: updated as FamilyLinkRequest, error: null, status: 200 }
}

export async function rejectFamilyLinkRequest(
  requestId: string,
  admin: AuthenticatedUser
): Promise<ServiceResult<FamilyLinkRequest>> {
  const { data: updated, error } = await supabaseAdmin
    .from('family_link_requests')
    .update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !updated) {
    return { data: null, error: 'Request not found or not pending', status: 404 }
  }

  return { data: updated as FamilyLinkRequest, error: null, status: 200 }
}
