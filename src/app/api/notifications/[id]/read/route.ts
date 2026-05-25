// PATCH /api/notifications/[id]/read — mark notification as read
// Requirements: 11.1, 11.2

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { markNotificationRead } from '@/lib/services/dashboardSharedService'

export const PATCH = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()!
  const result = await markNotificationRead(id, user.id)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}, ['admin', 'caregiver', 'client', 'family_member'])
