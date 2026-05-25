// Async dashboard shell — auth + sidebar (suspended by parent layout)

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar'
import { DashboardRouteProgress } from '@/components/dashboard/DashboardRouteProgress'
import { getUnreadMessageCount } from '@/lib/services/dashboardSharedService'

export default async function DashboardAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()

  if (!user) {
    redirect('/login')
  }

  const displayName = user.name?.trim() || user.email.split('@')[0] || 'User'
  const unreadMessages = await getUnreadMessageCount(user.id)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        role={user.role}
        displayName={displayName}
        email={user.email}
        unreadMessages={unreadMessages}
      />
      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
        <DashboardRouteProgress />
        <DashboardTopBar
          displayName={displayName}
          email={user.email}
          role={user.role}
          unreadMessages={unreadMessages}
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
