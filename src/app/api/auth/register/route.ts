// POST /api/auth/register — role-specific signup (admin not allowed)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createFamilyLinkRequest } from '@/lib/services/familyLinkRequestService'
import type { CaregiverAvailability, ContactInfo, EmergencyContact } from '@/lib/types'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

const baseFields = {
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  phone: z.string().min(1, 'Phone number is required'),
}

const CaregiverRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('caregiver'),
  qualifications: z.string().optional(),
  availability_notes: z.string().optional(),
})

const ClientRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('client'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  care_type: z.enum(['elderly', 'disability', 'childcare']),
  emergency_contact: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    relationship: z.string().min(1),
  }),
})

const FamilyRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('family_member'),
  client_email: z.string().email('Enter the care recipient’s account email'),
  recipient_name: z.string().optional(),
})

const RegisterSchema = z.discriminatedUnion('role', [
  CaregiverRegisterSchema,
  ClientRegisterSchema,
  FamilyRegisterSchema,
])

function parseQualifications(text?: string): string[] {
  if (!text?.trim()) return []
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body && typeof body === 'object' && (body as { role?: string }).role === 'admin') {
    return NextResponse.json(
      { error: 'Administrator accounts cannot be created here. Contact your organisation.' },
      { status: 403 }
    )
  }

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid registration data' },
      { status: 400 }
    )
  }

  const data = parsed.data
  const contact_info: ContactInfo = { phone: data.phone.trim() }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    const message = authError?.message?.includes('already registered')
      ? 'An account with this email already exists'
      : 'Registration failed. Please try again.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const userId = authData.user.id

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: userId,
    role: data.role,
    name: data.name,
    email: data.email,
    contact_info,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: 'Failed to create user profile. Please try again.' },
      { status: 500 }
    )
  }

  try {
    if (data.role === 'caregiver') {
      const availability: CaregiverAvailability = {}
      if (data.availability_notes?.trim()) {
        availability.notes = data.availability_notes.trim()
      }
      const { error: caregiverError } = await supabaseAdmin.from('caregivers').insert({
        user_id: userId,
        name: data.name,
        qualifications: parseQualifications(data.qualifications),
        availability: Object.keys(availability).length > 0 ? availability : null,
      })
      if (caregiverError) throw caregiverError
    }

    if (data.role === 'client') {
      const { error: clientError } = await supabaseAdmin.from('clients').insert({
        user_id: userId,
        name: data.name,
        date_of_birth: data.date_of_birth,
        care_type: data.care_type,
        emergency_contact: data.emergency_contact as EmergencyContact,
      })
      if (clientError) throw clientError
    }

    if (data.role === 'family_member') {
      const linkResult = await createFamilyLinkRequest(
        userId,
        data.client_email,
        data.recipient_name
      )
      if (linkResult.error) throw new Error(linkResult.error)
    }
  } catch (err) {
    await supabaseAdmin.from('users').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
