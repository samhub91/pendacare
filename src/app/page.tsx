import { getSession } from '@/lib/auth/session'
import { LandingPageClient } from './LandingPageClient'

const dashboardMap: Record<string, string> = {
  admin: '/dashboard/admin',
  caregiver: '/dashboard/caregiver',
  client: '/dashboard/client',
  family_member: '/dashboard/family',
}

export default async function RootPage() {
  const user = await getSession()
  const dashboardHref = user ? dashboardMap[user.role] ?? '/dashboard' : null

  return <LandingPageClient dashboardHref={dashboardHref} />
}
