'use client'
// Real-time chat window component
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.6

import { useEffect, useRef, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read_at: string | null
  created_at: string
}

interface ChatWindowProps {
  currentUserId: string
  partnerId: string
  partnerName?: string
}

export function ChatWindow({ currentUserId, partnerId, partnerName }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (loadCursor?: string) => {
    const params = new URLSearchParams({ partner_id: partnerId, page_size: '20' })
    if (loadCursor) params.set('cursor', loadCursor)

    const res = await fetch(`/api/messages?${params}`)
    if (!res.ok) return

    const data = await res.json()
    setMessages((prev) => loadCursor ? [...data.data, ...prev] : data.data)
    setHasMore(!!data.next_cursor)
    setCursor(data.next_cursor)

    if (!loadCursor) {
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
    }
  }, [partnerId])

  // Load initial conversation
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Subscribe to real-time incoming messages
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`messages:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message
          if (newMsg.sender_id !== partnerId) return

          // Fetch decrypted version from API
          const res = await fetch(`/api/messages?partner_id=${partnerId}&page_size=1`)
          if (res.ok) {
            const data = await res.json()
            if (data.data?.[0]) {
              setMessages((prev) => {
                const exists = prev.find((m) => m.id === newMsg.id)
                return exists ? prev : [...prev, data.data[0]]
              })
            }
          }

          // Mark as read
          await fetch(`/api/messages/${newMsg.id}/read`, { method: 'PATCH' })
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, partnerId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_id: partnerId, content: input.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data])
        setInput('')
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="font-medium text-gray-900">{partnerName ?? 'Conversation'}</p>
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => loadMessages(cursor ?? undefined)}
          className="text-xs text-blue-600 hover:underline py-2 text-center"
        >
          Load earlier messages
        </button>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.content}
                <p className={`text-xs mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMine && msg.read_at && ' · Read'}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
