import { getSession } from '@/lib/auth/session'
import { getMyProfile } from '@/lib/services/profileService'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard'
import { ClientProfileForm } from '@/components/profile/ProfileForms'

export default async function ClientProfilePage() {
  const user = await getSession()
  if (!user || user.role !== 'client') redirect('/login')

  const result = await getMyProfile(user)
  if (!result.data || result.data.role !== 'client') {
    return <p className="text-red-600">{result.error ?? 'Profile not found'}</p>
  }

  return (
    <div>
      <PageHeader title="My profile" description="Your contact and emergency details." />
      <ClientProfileForm initial={result.data} />
    </div>
  )
}
