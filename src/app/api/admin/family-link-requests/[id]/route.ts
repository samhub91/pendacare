// PATCH /api/admin/family-link-requests/[id] — approve or reject

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/withAuth'
import {
  approveFamilyLinkRequest,
  rejectFamilyLinkRequest,
} from '@/lib/services/familyLinkRequestService'

const PatchSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export const PATCH = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()!

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const result =
    parsed.data.action === 'approve'
      ? await approveFamilyLinkRequest(id, user)
      : await rejectFamilyLinkRequest(id, user)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 200 })
}, ['admin'])
