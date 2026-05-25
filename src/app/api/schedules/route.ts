// POST /api/schedules — create schedule (admin only)
// GET  /api/schedules — list schedules (caregiver or client)
// Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 11.1, 11.2, 12.1, 12.4

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import {
  createSchedule,
  getSchedulesForCaregiver,
  getSchedulesForClient,
} from '@/lib/services/scheduleService'

const CreateScheduleSchema = z.object({
  caregiver_id: z.string().uuid('caregiver_id must be a valid UUID'),
  client_id: z.string().uuid('client_id must be a valid UUID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM'),
  duration_minutes: z.number().int().positive('duration_minutes must be positive'),
  notes: z.string().optional(),
})

export const POST = withAuth(async (req, user) => {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await createSchedule(parsed.data, user, ip)

  if (result.error) {
    const body: Record<string, unknown> = { error: result.error }
    if (result.conflicting_schedule_id) body.conflicting_schedule_id = result.conflicting_schedule_id
    return NextResponse.json(body, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 201 })
}, ['admin'])

export const GET = withAuth(async (req, user) => {
  const { searchParams } = req.nextUrl
  const caregiver_id = searchParams.get('caregiver_id')
  const client_id = searchParams.get('client_id')
  const start = searchParams.get('start') ?? new Date().toISOString().split('T')[0]
  const end = searchParams.get('end') ?? '2099-12-31'
  const cursor = searchParams.get('cursor') ?? undefined
  const page_size = parseInt(searchParams.get('page_size') ?? '20', 10)

  if (caregiver_id) {
    const result = await getSchedulesForCaregiver(
      caregiver_id, { start, end }, user, cursor, page_size
    )
    return NextResponse.json(result)
  }

  if (client_id) {
    const result = await getSchedulesForClient(
      client_id, { start, end }, user, cursor, page_size
    )
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Provide caregiver_id or client_id' }, { status: 400 })
}, ['admin', 'caregiver', 'client'])
