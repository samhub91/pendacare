// POST /api/messages — send message
// GET  /api/messages — get conversation
// Requirements: 7.1, 7.3, 11.1, 11.2, 12.1, 12.4

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import { sendMessage, getConversation } from '@/lib/services/messagingService'

const SendMessageSchema = z.object({
  receiver_id: z.string().uuid('receiver_id must be a valid UUID'),
  content: z.string().min(1, 'content must not be empty'),
})

export const POST = withAuth(async (req, user) => {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await sendMessage(parsed.data, user, ip)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 201 })
})

export const GET = withAuth(async (req, user) => {
  const { searchParams } = req.nextUrl
  const partner_id = searchParams.get('partner_id')
  const cursor = searchParams.get('cursor') ?? undefined
  const page_size = parseInt(searchParams.get('page_size') ?? '20', 10)

  if (!partner_id) {
    return NextResponse.json({ error: 'partner_id is required' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await getConversation(
    user.id,
    partner_id,
    { cursor, page_size },
    user,
    ip
  )

  return NextResponse.json(result)
})
