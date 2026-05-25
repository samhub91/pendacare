'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { NotificationRow } from '@/lib/services/dashboardSharedService'
import { EmptyState } from './EmptyState'

interface NotificationListProps {
  notifications: NotificationRow[]
}

export function NotificationList({ notifications: initial }: NotificationListProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initial)
  const [markingId, setMarkingId] = useState<string | null>(null)

  async function markRead(id: string) {
    setMarkingId(id)
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          )
        )
        router.refresh()
      }
    } finally {
      setMarkingId(null)
    }
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="Alerts for your account will appear here."
      />
    )
  }

  return (
    <ul className="divide-y divide-gray-100">
      {notifications.map((n) => (
        <li
          key={n.id}
          className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className={n.read_at ? 'opacity-70' : ''}>
            <p className="font-medium text-gray-900">{n.title}</p>
            {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
            <p className="text-xs text-gray-400">
              {new Date(n.created_at).toLocaleString()}
              {n.read_at ? ' · Read' : ' · Unread'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!n.read_at && (
              <button
                type="button"
                disabled={markingId === n.id}
                onClick={() => markRead(n.id)}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                {markingId === n.id ? 'Saving…' : 'Mark read'}
              </button>
            )}
            {n.link_path && (
              <Link
                href={n.link_path}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Open
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
