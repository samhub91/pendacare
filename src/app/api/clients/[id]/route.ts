// GET   /api/clients/[id] — get client profile
// PATCH /api/clients/[id] — update health info
// Requirements: 5.1–5.9, 11.1, 11.2

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import {
  getClientProfile,
  updateClientDemographics,
  updateHealthInfo,
} from '@/lib/services/clientProfileService'

const HealthInfoSchema = z.object({
  conditions: z.array(z.string()),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  mobility_level: z.enum(['independent', 'assisted', 'dependent']),
  notes: z.string(),
})

const DemographicsSchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  care_type: z.enum(['elderly', 'disability', 'childcare']).optional(),
  emergency_contact: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(1),
      relationship: z.string().min(1),
    })
    .nullable()
    .optional(),
  assigned_caregiver_id: z.string().uuid().nullable().optional(),
})

export const GET = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()!
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await getClientProfile(id, user, ip)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 200 })
})

export const PATCH = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()!

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  if (body && typeof body === 'object' && 'conditions' in body) {
    const parsed = HealthInfoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const result = await updateHealthInfo(id, parsed.data, user, ip)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result.data, { status: 200 })
  }

  const demo = DemographicsSchema.safeParse(body)
  if (!demo.success) {
    return NextResponse.json({ errors: demo.error.flatten().fieldErrors }, { status: 400 })
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await updateClientDemographics(id, demo.data, user, ip)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 200 })
}, ['admin', 'caregiver'])
