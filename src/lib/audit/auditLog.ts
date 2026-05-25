// Audit log helper — append-only inserts to audit_logs table
// Requirements: 10.1, 10.2, 10.4, 10.5, 15.5

import { supabaseAdmin } from '@/lib/supabase/admin'
import { AuditLogEntry } from '@/lib/types'

/**
 * Inserts an audit log entry using the admin client (bypasses RLS for insert).
 * Swallows database errors — logs to console but never propagates to caller.
 * Requirements: 10.1, 10.5, 15.5
 */
export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: entry.actor_id,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? null,
      ip_address: entry.ip_address ?? null,
    })

    if (error) {
      // Log to application error log but do not propagate (Requirement 15.5)
      console.error('[AuditLog] Failed to insert audit log entry:', {
        error: error.message,
        entry,
      })
    }
  } catch (err) {
    console.error('[AuditLog] Unexpected error inserting audit log:', {
      error: err,
      entry,
    })
  }
}
