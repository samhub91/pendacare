// PATCH  /api/reports/[id] — update report (lock check)
// DELETE /api/reports/[id] — delete report (lock check)
// Requirements: 9.2, 9.3, 15.3

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'

async function checkLock(id: string): Promise<{ locked: boolean; notFound: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('locked_at')
    .eq('id', id)
    .single()

  if (error || !data) return { locked: false, notFound: true }
  return { locked: !!data.locked_at, notFound: false }
}

export const PATCH = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const { locked, notFound } = await checkLock(id)

  if (notFound) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (locked) {
    return NextResponse.json(
      { error: 'Report is locked and cannot be modified' },
      { status: 423 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('reports')
    .update(body as Record<string, unknown>)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  await insertAuditLog({ actor_id: user.id, action: 'report.updated', resource: 'reports', resource_id: id, ip_address: ip })

  return NextResponse.json(data, { status: 200 })
}, ['admin', 'caregiver'])

export const DELETE = withAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const { locked, notFound } = await checkLock(id)

  if (notFound) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (locked) {
    return NextResponse.json(
      { error: 'Report is locked and cannot be modified' },
      { status: 423 }
    )
  }

  const { error } = await supabaseAdmin.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  await insertAuditLog({ actor_id: user.id, action: 'report.deleted', resource: 'reports', resource_id: id, ip_address: ip })

  return NextResponse.json({ success: true }, { status: 200 })
}, ['admin'])
