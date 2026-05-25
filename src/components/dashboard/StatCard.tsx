interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  trend?: string
  variant?: 'default' | 'accent' | 'warning'
}

const variantRing: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'border-gray-200',
  accent: 'border-blue-200 bg-gradient-to-br from-blue-50/80 to-white',
  warning: 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-white',
}

export function StatCard({ label, value, hint, trend, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${variantRing[variant]}`}
      role="region"
      aria-label={label}
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {trend && <p className="mt-2 text-xs font-medium text-blue-700">{trend}</p>}
    </div>
  )
}
