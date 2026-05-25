import { getSession } from '@/lib/auth/session'
import { getMyProfile } from '@/lib/services/profileService'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard'
import { FamilyProfileForm } from '@/components/profile/ProfileForms'

export default async function FamilyProfilePage() {
  const user = await getSession()
  if (!user || user.role !== 'family_member') redirect('/login')

  const result = await getMyProfile(user)
  if (!result.data || result.data.role !== 'family_member') {
    return <p className="text-red-600">{result.error ?? 'Profile not found'}</p>
  }

  return (
    <div>
      <PageHeader title="My profile" description="Your contact details and family link requests." />
      <FamilyProfileForm initial={result.data} />
    </div>
  )
}
