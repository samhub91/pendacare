// GET /api/admin/family-link-requests — pending link requests

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { listPendingFamilyLinkRequests } from '@/lib/services/familyLinkRequestService'

export const GET = withAuth(async () => {
  const data = await listPendingFamilyLinkRequests()
  return NextResponse.json({ data }, { status: 200 })
}, ['admin'])
