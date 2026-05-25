// POST /api/clients/[id]/documents — upload document
// Requirements: 5.10, 11.1, 11.2

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { uploadDocument } from '@/lib/services/clientProfileService'

export const POST = withAuth(async (req, user) => {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean)
  const clientId = parts[parts.indexOf('clients') + 1]

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  const result = await uploadDocument(clientId, buffer, file.name, file.type, user, ip)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data, { status: 200 })
}, ['admin', 'caregiver'])
