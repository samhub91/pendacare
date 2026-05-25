// POST /api/reports — create report (caregiver only)
// GET  /api/reports — list reports
// Requirements: 8.1–8.5, 11.1, 11.2, 12.1, 12.4

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import { createReport, getReportsByCaregiver, getReportsByClient } from '@/lib/services/reportingService'

const CreateReportSchema = z.object({
  client_id: z.string().uuid(),
  schedule_id: z.string().uuid().optional(),
  notes: z.string().min(1, 'notes are required'),
  hours_worked: z.number().min(0.25).max(24),
  feedback: z.string().optional(),
})

export const POST = withAuth(async (req, user) => {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await createReport(
    { ...parsed.data, caregiver_id: user.caregiverId ?? '' },
    user,
    ip
  )

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 201 })
}, ['caregiver'])

export const GET = withAuth(async (req, user) => {
  const { searchParams } = req.nextUrl
  const caregiver_id = searchParams.get('caregiver_id')
  const client_id = searchParams.get('client_id')
  const start = searchParams.get('start') ?? '2000-01-01'
  const end = searchParams.get('end') ?? '2099-12-31'
  const cursor = searchParams.get('cursor') ?? undefined
  const page_size = parseInt(searchParams.get('page_size') ?? '20', 10)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  if (caregiver_id) {
    const result = await getReportsByCaregiver(caregiver_id, { start, end }, user, cursor, page_size, ip)
    return NextResponse.json(result)
  }

  if (client_id) {
    const result = await getReportsByClient(client_id, { start, end }, user, cursor, page_size, ip)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Provide caregiver_id or client_id' }, { status: 400 })
})
