// withAuth HOC — verifies Supabase JWT and enforces RBAC
// Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { AuthenticatedUser, UserRole } from '@/lib/types'

type AuthedHandler = (
  req: NextRequest,
  user: AuthenticatedUser
) => Promise<NextResponse>

/**
 * Wraps an API route handler with JWT verification and optional role check.
 * Returns 401 for missing/invalid/expired tokens.
 * Returns 403 for insufficient role.
 * Attaches decoded AuthenticatedUser to the handler on success.
 */
export function withAuth(
  handler: AuthedHandler,
  allowedRoles?: UserRole[]
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Build a server Supabase client that reads cookies from the request
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll() {
            // No-op in middleware context — cookies are set via response headers
          },
        },
      }
    )

    // Verify JWT
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      const message = error?.message?.toLowerCase().includes('expired')
        ? 'Token expired'
        : 'Unauthorized'
      return NextResponse.json({ error: message }, { status: 401 })
    }

    // Fetch role from public.users
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 401 })
    }

    const role = userRow.role as UserRole

    // RBAC check
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email ?? '',
      role,
    }

    // Attach caregiverId if caregiver
    if (role === 'caregiver') {
      const { data: caregiverRow } = await supabase
        .from('caregivers')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (caregiverRow) authenticatedUser.caregiverId = caregiverRow.id
    }

    return handler(req, authenticatedUser)
  }
}
