// Shared loading UI for dashboard routes (Next.js loading.tsx + Suspense fallbacks)

type DashboardLoadingVariant = 'page' | 'form' | 'messages'

interface DashboardLoadingProps {
  variant?: DashboardLoadingVariant
  label?: string
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} aria-hidden="true" />
}

function LoadingSpinner() {
  return (
    <div
      className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600"
      role="presentation"
      aria-hidden="true"
    />
  )
}

export function DashboardLoading({
  variant = 'page',
  label = 'Loading your dashboard…',
}: DashboardLoadingProps) {
  return (
    <div
      className="flex min-h-[min(420px,60vh)] flex-col"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="mb-8 flex items-center gap-4">
        <LoadingSpinner />
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Fetching your latest data — this usually takes a few seconds.
          </p>
        </div>
      </div>

      {variant === 'form' && (
        <div className="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-11 w-32" />
        </div>
      )}

      {variant === 'messages' && (
        <div className="grid min-h-[480px] grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <Skeleton className="mb-4 h-5 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 lg:col-span-2">
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      )}

      {variant === 'page' && (
        <>
          <div className="mb-8">
            <Skeleton className="mb-2 h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <Skeleton className="mb-3 h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <Skeleton className="mb-4 h-5 w-40" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <Skeleton className="mb-4 h-5 w-36" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-gray-50" aria-busy="true" aria-label="Loading dashboard">
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="border-b border-gray-100 p-6">
          <Skeleton className="mb-2 h-6 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <main className="flex-1 p-6 lg:p-8">
          <DashboardLoading />
        </main>
      </div>
    </div>
  )
}
