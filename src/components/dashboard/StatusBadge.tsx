import type { ScheduleStatus } from '@/lib/types'

const styles: Record<ScheduleStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  confirmed: 'bg-blue-50 text-blue-800 ring-blue-600/20',
  in_progress: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  completed: 'bg-green-50 text-green-800 ring-green-600/20',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-500/15',
}

export function StatusBadge({ status }: { status: ScheduleStatus }) {
  const label = status.replace('_', ' ')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles[status]}`}
    >
      {label}
    </span>
  )
}
