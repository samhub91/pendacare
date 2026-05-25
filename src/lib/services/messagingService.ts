// Messaging Service
// Requirements: 7.1–7.7, 10.1, 10.2, 12.1–12.4

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { insertAuditLog } from '@/lib/audit/auditLog'
import { encryptMessage, decryptMessage } from '@/lib/crypto/encryption'
import {
  AuthenticatedUser,
  Message,
  PaginatedResponse,
  Pagination,
  SendMessageInput,
} from '@/lib/types'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const MAX_PAGE_SIZE = 100

type ServiceResult<T> = { data: T | null; error: string | null; status: number }

/**
 * Sends a message — encrypts content, inserts to DB, logs audit.
 * Rejects empty content (400).
 * Requirements: 7.1, 7.7, 10.1
 */
export async function sendMessage(
  input: SendMessageInput,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<ServiceResult<Message>> {
  // Reject empty content (Requirement 7.7)
  if (!input.content || input.content.trim().length === 0) {
    return { data: null, error: 'Message content must not be empty', status: 400 }
  }

  // Encrypt content before insert (Requirement 7.1, 6.2)
  let encrypted: string
  try {
    encrypted = encryptMessage(input.content, ENCRYPTION_KEY)
  } catch {
    return { data: null, error: 'Encryption failed', status: 500 }
  }

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      sender_id: actor.id,
      receiver_id: input.receiver_id,
      content: encrypted,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Service temporarily unavailable', status: 503 }
  }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'message.sent',
    resource: 'messages',
    resource_id: message.id,
    ip_address: ipAddress,
  })

  // Return with decrypted content for the caller
  return {
    data: { ...message, content: input.content } as Message,
    error: null,
    status: 201,
  }
}

/**
 * Returns conversation history between two users, cursor-paginated (max 100).
 * Only returns messages where actor is sender or receiver.
 * Decrypts content before returning.
 * Requirements: 7.3, 12.1–12.4
 */
export async function getConversation(
  userId1: string,
  userId2: string,
  pagination: Pagination,
  actor: AuthenticatedUser,
  ipAddress?: string
): Promise<PaginatedResponse<Message>> {
  // Enforce actor can only see their own messages (Requirement 7.3)
  if (actor.id !== userId1 && actor.id !== userId2) {
    return { data: [], next_cursor: null }
  }

  const limit = Math.min(pagination.page_size ?? 20, MAX_PAGE_SIZE)

  let query = supabaseAdmin
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
    )
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (pagination.cursor) {
    query = query.gt('created_at', pagination.cursor)
  }

  const { data, error } = await query
  if (error) return { data: [], next_cursor: null }

  await insertAuditLog({
    actor_id: actor.id,
    action: 'messages.conversation.viewed',
    resource: 'messages',
    ip_address: ipAddress,
  })

  const hasMore = data.length > limit
  const rows = hasMore ? data.slice(0, limit) : data

  // Decrypt content for each message
  const decrypted = rows.map((msg: Message) => {
    try {
      return { ...msg, content: decryptMessage(msg.content, ENCRYPTION_KEY) }
    } catch {
      return { ...msg, content: '' }
    }
  })

  return {
    data: decrypted as Message[],
    next_cursor: hasMore ? rows[rows.length - 1].created_at : null,
  }
}

/**
 * Marks a message as read by setting read_at to now.
 * Requirements: 7.4
 */
export async function markAsRead(
  messageId: string,
  userId: string
): Promise<{ error: string | null; status: number }> {
  const { error } = await supabaseAdmin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('receiver_id', userId) // only receiver can mark as read

  if (error) {
    return { error: 'Service temporarily unavailable', status: 503 }
  }

  return { error: null, status: 200 }
}

/**
 * Subscribes to incoming messages for a user via Supabase Realtime.
 * Returns an unsubscribe function.
 * Must be called from a browser/client context.
 * Requirements: 7.2, 7.6
 */
export function subscribeToMessages(
  userId: string,
  callback: (msg: Message) => void
): () => void {
  const supabase = createSupabaseBrowserClient()

  const channel = supabase
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => {
        const raw = payload.new as Message
        // Decrypt content — note: ENCRYPTION_KEY not available in browser
        // In production, the server should deliver decrypted content via a secure channel
        // For now, return the raw message and let the UI fetch decrypted content via API
        callback(raw as Message)
      }
    )
    .subscribe()

  // Return unsubscribe function (Requirement 7.6)
  return () => {
    supabase.removeChannel(channel)
  }
}
