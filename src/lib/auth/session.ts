// Authentication helpers — session management via Supabase Auth
// Tokens stored in httpOnly, SameSite=Strict cookies (handled by @supabase/ssr)
// Requirements: 1.1, 1.6, 1.7, 1.8, 1.9

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AuthenticatedUser, UserRole } from '@/lib/types'

/**
 * Returns the authenticated app user, or null if unauthenticated.
 * Uses getUser() so the identity is verified with Supabase Auth (not cookie-only).
 */
export async function getSession(): Promise<AuthenticatedUser | null> {
  const supabase = createSupabaseServerClient()
  const { data: { user: authUser }, error } = await supabase.auth.getUser()

  if (error || !authUser) return null

  // Fetch the role from the public.users table
  const { data: userRow } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', authUser.id)
    .single()

  if (!userRow) return null

  const user: AuthenticatedUser = {
    id: authUser.id,
    email: authUser.email ?? '',
    name: (userRow as { name?: string }).name,
    role: userRow.role as UserRole,
  }

  // If caregiver, attach caregiverId
  if (user.role === 'caregiver') {
    const { data: caregiverRow } = await supabase
      .from('caregivers')
      .select('id')
      .eq('user_id', authUser.id)
      .single()
    if (caregiverRow) user.caregiverId = caregiverRow.id
  }

  return user
}

/**
 * Signs in with email and password.
 * Tokens are stored in httpOnly cookies by @supabase/ssr automatically.
 */
export async function signIn(email: string, password: string) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Signs out the current user and clears the session cookies.
 */
export async function signOut() {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Refreshes the access token using the stored refresh token.
 * Returns null if the refresh token is expired (caller should redirect to /login).
 */
export async function refreshSession() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.refreshSession()
  if (error) return null
  return data.session
}
