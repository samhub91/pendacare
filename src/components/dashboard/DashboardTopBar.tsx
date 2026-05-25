import Link from 'next/link'
import type { UserRole } from '@/lib/types'
import { UnreadMessagesBadge } from './UnreadMessagesBadge'

interface DashboardTopBarProps {
  displayName: string
  email: string
  role: UserRole
  unreadMessages?: number
}

const roleHome: Record<UserRole, string> = {
  admin: '/dashboard/admin',
  caregiver: '/dashboard/caregiver',
  client: '/dashboard/client',
  family_member: '/dashboard/family',
}

export function DashboardTopBar({
  displayName,
  email,
  role,
  unreadMessages = 0,
}: DashboardTopBarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between gap-4 px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="truncate text-xs text-gray-500">{email}</p>
        </div>
        <nav className="flex shrink-0 items-center gap-2" aria-label="Quick links">
          <Link
            href={roleHome[role]}
            className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 sm:inline-flex focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Home
          </Link>
          <Link
            href="/dashboard/messages"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Messages
            <UnreadMessagesBadge count={unreadMessages} />
          </Link>
        </nav>
      </div>
    </header>
  )
}
