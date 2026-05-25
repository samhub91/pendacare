// GET /api/reports/summary?client_id=&month=
// Requirements: 8.6, 11.1, 11.2

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { generateSummary } from '@/lib/services/reportingService'

export const GET = withAuth(async (req, user) => {
  const { searchParams } = req.nextUrl
  const client_id = searchParams.get('client_id')
  const month = searchParams.get('month') // YYYY-MM

  if (!client_id || !month) {
    return NextResponse.json({ error: 'client_id and month are required' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await generateSummary(client_id, month, user, ip)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 200 })
}, ['admin', 'family_member'])
