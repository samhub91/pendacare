'use client'
// Thin top bar while navigating between dashboard routes

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function DashboardRouteProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(false)
  }, [pathname])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) {
        return
      }
      const href = anchor.getAttribute('href')
      if (!href?.startsWith('/dashboard')) return
      try {
        const next = new URL(href, window.location.origin).pathname
        if (next !== pathname) setActive(true)
      } catch {
        /* ignore malformed href */
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname])

  if (!active) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-blue-100"
      role="progressbar"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="dashboard-route-progress-bar h-full w-1/3 bg-blue-600" />
    </div>
  )
}
