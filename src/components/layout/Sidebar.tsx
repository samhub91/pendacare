'use client'
// Sidebar with role-based navigation
// Requirements: 2.1, 2.3, 2.4, 2.5, 2.6

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { UserRole } from '@/lib/types'
import { UnreadMessagesBadge } from '@/components/dashboard/UnreadMessagesBadge'
import { LogoMark } from '@/components/brand/LogoMark'

interface NavItem {
  label: string
  href: string
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { label: 'Overview',    href: '/dashboard/admin',              roles: ['admin'] },
  { label: 'Schedules',   href: '/dashboard/admin/schedules',    roles: ['admin'] },
  { label: 'Clients',     href: '/dashboard/admin/clients',      roles: ['admin'] },
  { label: 'My Shifts',   href: '/dashboard/caregiver',          roles: ['caregiver'] },
  { label: 'Log Report',  href: '/dashboard/caregiver/reports/new', roles: ['caregiver'] },
  { label: 'My profile',  href: '/dashboard/caregiver/profile',  roles: ['caregiver'] },
  { label: 'My Schedule', href: '/dashboard/client',             roles: ['client'] },
  { label: 'My profile',  href: '/dashboard/client/profile',     roles: ['client'] },
  { label: 'Care Updates',href: '/dashboard/family',             roles: ['family_member'] },
  { label: 'My profile',  href: '/dashboard/family/profile',     roles: ['family_member'] },
  { label: 'Messages',    href: '/dashboard/messages',           roles: ['admin', 'caregiver', 'client', 'family_member'] },
]

interface SidebarProps {
  role: UserRole
  displayName: string
  email: string
  unreadMessages?: number
}

export function Sidebar({ role, displayName, email, unreadMessages = 0 }: SidebarProps) {
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  const filtered = navItems.filter((item) => item.roles.includes(role))

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-3 mb-3 group hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-200">
            <LogoMark size={40} />
          </div>
          <span className="text-lg font-bold text-brand-600">Pendacare</span>
        </Link>
        <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{email}</p>
        <span className="inline-block mt-1.5 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full capitalize">
          {role.replace('_', ' ')}
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {filtered.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span>{item.label}</span>
              {item.href === '/dashboard/messages' && (
                <UnreadMessagesBadge count={unreadMessages} />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
