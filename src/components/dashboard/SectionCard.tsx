interface SectionCardProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  /** Visually emphasize section (e.g. alerts) */
  emphasis?: 'default' | 'alert'
  /** Stable id for aria-labelledby */
  headingId?: string
  /** Tailwind classes for the body wrapper (default padded) */
  bodyClassName?: string
}

export function SectionCard({
  title,
  description,
  children,
  className = '',
  emphasis = 'default',
  headingId = 'section-heading',
  bodyClassName = 'p-5',
}: SectionCardProps) {
  const border =
    emphasis === 'alert'
      ? 'border-amber-200 bg-amber-50/30'
      : 'border-gray-200 bg-white'

  return (
    <section
      className={`rounded-xl border shadow-sm ${border} ${className}`}
      aria-labelledby={headingId}
    >
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 id={headingId} className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
