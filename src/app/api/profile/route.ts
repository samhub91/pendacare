// GET /api/profile — current user profile
// PATCH /api/profile — update current user profile

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { getMyProfile, updateMyProfile } from '@/lib/services/profileService'

export const GET = withAuth(async (_req, user) => {
  const result = await getMyProfile(user)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result.data, { status: 200 })
}, ['admin', 'caregiver', 'client', 'family_member'])

export const PATCH = withAuth(async (req, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await updateMyProfile(user, body as Record<string, unknown>)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result.data, { status: 200 })
}, ['caregiver', 'client', 'family_member'])
