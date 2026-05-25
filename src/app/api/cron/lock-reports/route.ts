// Cron handler: lock reports older than 24 hours
// Runs every hour via Vercel Cron (see vercel.json)
// Protected by CRON_SECRET bearer token
// Requirements: 9.1, 9.2, 9.3, 9.4, 9.5

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET bearer token
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fetch all eligible reports: locked_at IS NULL and created_at < cutoff
  const { data: eligible, error: fetchError } = await supabaseAdmin
    .from('reports')
    .select('id, created_at')
    .is('locked_at', null)
    .lt('created_at', cutoff)

  if (fetchError) {
    console.error('[CronLockReports] Failed to fetch eligible reports:', fetchError)
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  if (!eligible || eligible.length === 0) {
    // No eligible reports — do NOT create audit log entries (Requirement 9.4)
    return NextResponse.json({ locked: 0 })
  }

  const now = new Date().toISOString()
  let lockedCount = 0

  for (const report of eligible) {
    // Only update locked_at — no other fields (Requirement 9.3)
    const { error: updateError } = await supabaseAdmin
      .from('reports')
      .update({ locked_at: now })
      .eq('id', report.id)
      .is('locked_at', null) // double-check to avoid race conditions

    if (!updateError) {
      lockedCount++
      // One audit log entry per locked report (Requirement 9.4)
      await insertAuditLog({
        actor_id: null,
        action: 'report.locked',
        resource: 'reports',
        resource_id: report.id,
        metadata: { locked_at: now },
      })
    }
  }

  return NextResponse.json({ locked: lockedCount })
}
