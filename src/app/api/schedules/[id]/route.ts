// PATCH /api/schedules/[id] — update schedule status (admin only)
// Requirements: 3.4, 3.9, 11.1, 11.2

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import { updateScheduleStatus } from '@/lib/services/scheduleService'
import { ScheduleStatus } from '@/lib/types'

const PatchScheduleSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']),
})

export const PATCH = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').pop()!

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await updateScheduleStatus(id, parsed.data.status as ScheduleStatus, user, ip)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 200 })
}, ['admin', 'caregiver'])
