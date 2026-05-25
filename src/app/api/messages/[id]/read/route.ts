// PATCH /api/messages/[id]/read — mark message as read
// Requirements: 7.4, 11.1, 11.2

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { markAsRead } from '@/lib/services/messagingService'

export const PATCH = withAuth(async (req, user) => {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean)
  const messageId = parts[parts.indexOf('messages') + 1]

  const result = await markAsRead(messageId, user.id)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true }, { status: 200 })
})
