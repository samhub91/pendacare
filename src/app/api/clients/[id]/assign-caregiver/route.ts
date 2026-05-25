// POST /api/clients/[id]/assign-caregiver — admin only
// Requirements: 5.10, 11.1, 11.2

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import { assignCaregiver } from '@/lib/services/clientProfileService'

const AssignSchema = z.object({
  caregiver_id: z.string().uuid('caregiver_id must be a valid UUID'),
})

export const POST = withAuth(async (req, user) => {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean)
  const clientId = parts[parts.indexOf('clients') + 1]

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await assignCaregiver(clientId, parsed.data.caregiver_id, user, ip)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}, ['admin'])
