// Shared dashboard helpers — unread messages, notifications
// Server-side only via supabaseAdmin

import { supabaseAdmin } from '@/lib/supabase/admin'

export interface NotificationRow {
  id: string
  title: string
  body: string | null
  type: string
  link_path: string | null
  read_at: string | null
  created_at: string
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .is('read_at', null)

  if (error) return 0
  return count ?? 0
}

export async function getNotificationsForUser(
  userId: string,
  limit = 8
): Promise<NotificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, title, body, type, link_path, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as NotificationRow[]
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<{ error: string | null; status: number }> {
  const { data: row, error: fetchError } = await supabaseAdmin
    .from('notifications')
    .select('id, user_id')
    .eq('id', notificationId)
    .single()

  if (fetchError || !row) {
    return { error: 'Notification not found', status: 404 }
  }
  if (row.user_id !== userId) {
    return { error: 'Forbidden', status: 403 }
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error) {
    return { error: 'Service temporarily unavailable', status: 503 }
  }
  return { error: null, status: 200 }
}
