'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ScheduleStatus } from '@/lib/types'

interface ShiftStatusActionsProps {
  scheduleId: string
  status: ScheduleStatus
}

export function ShiftStatusActions({ scheduleId, status }: ShiftStatusActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(next: ScheduleStatus) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not update visit status')
        return
      }
      router.refresh()
    } catch {
      setError('Could not update visit status')
    } finally {
      setLoading(false)
    }
  }

  const btn =
    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {status === 'pending' && (
          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('confirmed')}
            className={`${btn} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}
          >
            Confirm
          </button>
        )}
        {status === 'confirmed' && (
          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('in_progress')}
            className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}
          >
            Start visit
          </button>
        )}
        {status === 'in_progress' && (
          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus('completed')}
            className={`${btn} bg-green-600 text-white hover:bg-green-700`}
          >
            Complete visit
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
