import { getSession } from '@/lib/auth/session'
import { getMyProfile } from '@/lib/services/profileService'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard'
import { CaregiverProfileForm } from '@/components/profile/ProfileForms'

export default async function CaregiverProfilePage() {
  const user = await getSession()
  if (!user || user.role !== 'caregiver') redirect('/login')

  const result = await getMyProfile(user)
  if (!result.data || result.data.role !== 'caregiver') {
    return <p className="text-red-600">{result.error ?? 'Profile not found'}</p>
  }

  return (
    <div>
      <PageHeader title="My profile" description="Contact details, qualifications, and availability." />
      <CaregiverProfileForm initial={result.data} />
    </div>
  )
}
