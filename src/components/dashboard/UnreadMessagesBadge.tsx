interface UnreadMessagesBadgeProps {
  count: number
  className?: string
}

export function UnreadMessagesBadge({ count, className = '' }: UnreadMessagesBadgeProps) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${className}`}
      aria-label={`${count} unread messages`}
    >
      {label}
    </span>
  )
}
