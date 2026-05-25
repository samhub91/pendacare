// Dashboard layout — Suspense shell while auth loads; pages use loading.tsx
// Requirements: 2.1, 2.3, 2.4, 2.5, 2.6

import { Suspense } from 'react'
import { DashboardLayoutSkeleton } from '@/components/dashboard/DashboardLoading'
import DashboardAuthenticatedLayout from './DashboardAuthenticatedLayout'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardLayoutSkeleton />}>
      <DashboardAuthenticatedLayout>{children}</DashboardAuthenticatedLayout>
    </Suspense>
  )
}