// Protected route configuration — maps route patterns to permitted roles
// Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2

import { UserRole } from '@/lib/types'

export interface RouteConfig {
  pattern: RegExp
  roles: UserRole[]
}

/**
 * Route patterns and their permitted roles.
 * Evaluated in order — first match wins.
 */
export const protectedRoutes: RouteConfig[] = [
  // Auth routes — no role restriction (just needs valid JWT)
  { pattern: /^\/api\/auth\/refresh/, roles: ['admin', 'caregiver', 'client', 'family_member'] },
  { pattern: /^\/api\/auth\/signout/, roles: ['admin', 'caregiver', 'client', 'family_member'] },

  // Admin-only routes
  { pattern: /^\/api\/schedules$/, roles: ['admin'] },                          // POST
  { pattern: /^\/api\/clients\/[^/]+\/assign-caregiver/, roles: ['admin'] },
  { pattern: /^\/api\/admin\/family-link-requests/, roles: ['admin'] },
  { pattern: /^\/dashboard\/admin/, roles: ['admin'] },

  // Caregiver routes
  { pattern: /^\/api\/reports$/, roles: ['caregiver', 'admin'] },               // POST
  { pattern: /^\/dashboard\/caregiver/, roles: ['caregiver'] },

  // Client routes
  { pattern: /^\/dashboard\/client/, roles: ['client'] },

  // Family member routes
  { pattern: /^\/dashboard\/family/, roles: ['family_member'] },

  // Shared API routes (multiple roles)
  { pattern: /^\/api\/schedules\//, roles: ['admin', 'caregiver', 'client'] },  // GET, PATCH
  { pattern: /^\/api\/clients\//, roles: ['admin', 'caregiver', 'client', 'family_member'] },
  { pattern: /^\/api\/reports\//, roles: ['admin', 'caregiver', 'family_member'] },
  { pattern: /^\/api\/messages/, roles: ['admin', 'caregiver', 'client', 'family_member'] },
  { pattern: /^\/api\/notifications/, roles: ['admin', 'caregiver', 'client', 'family_member'] },
  { pattern: /^\/api\/profile/, roles: ['admin', 'caregiver', 'client', 'family_member'] },

  // Cron — protected by CRON_SECRET bearer token, not JWT roles
  { pattern: /^\/api\/cron\//, roles: ['admin'] },

  // Dashboard catch-all
  { pattern: /^\/dashboard/, roles: ['admin', 'caregiver', 'client', 'family_member'] },

  // API catch-all — only protect known API routes, not public auth endpoints
  { pattern: /^\/api\/(schedules|clients|reports|messages|notifications|profile|cron)/, roles: ['admin', 'caregiver', 'client', 'family_member'] },
]

/**
 * Returns the permitted roles for a given pathname, or null if the route is not protected.
 */
export function getPermittedRoles(pathname: string): UserRole[] | null {
  for (const route of protectedRoutes) {
    if (route.pattern.test(pathname)) {
      return route.roles
    }
  }
  return null
}
