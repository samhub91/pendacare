'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FamilyLinkRequest } from '@/lib/types'

export function FamilyLinkRequestQueue({ requests }: { requests: FamilyLinkRequest[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (requests.length === 0) {
    return (
      <p className="text-sm text-gray-500">No pending family link requests.</p>
    )
  }

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/family-link-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed')
        return
      }
      router.refresh()
    } catch {
      setError('Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <p className="font-medium text-gray-900">{r.client_email}</p>
              {r.recipient_name && (
                <p className="text-gray-600">Recipient: {r.recipient_name}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Requested {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => act(r.id, 'approve')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => act(r.id, 'reject')}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
