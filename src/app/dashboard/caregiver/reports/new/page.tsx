// Caregiver — log visit report (wraps client form in Suspense for useSearchParams)
// Requirements: 2.4, 8.1, 8.3

import { Suspense } from 'react'
import { NewReportForm } from './NewReportForm'

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 h-8 w-48 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      }
    >
      <NewReportForm />
    </Suspense>
  )
}
