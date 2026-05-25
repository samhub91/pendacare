// Admin client detail page — profile, caregiver assignment, demographics edit
// Requirements: 2.3, 5.5, 5.10

import { getSession } from '@/lib/auth/session'
import { getClientProfile } from '@/lib/services/clientProfileService'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminClientEditor } from '@/components/admin/AdminClientEditor'

interface Props {
  params: { id: string }
}

export default async function AdminClientDetailPage({ params }: Props) {
  const user = await getSession()
  if (!user || user.role !== 'admin') redirect('/login')

  const [result, caregiversRes] = await Promise.all([
    getClientProfile(params.id, user),
    supabaseAdmin.from('caregivers').select('id, name').order('name'),
  ])

  if (result.error || !result.data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Client Profile</h1>
        <p className="text-red-600">{result.error ?? 'Client not found'}</p>
      </div>
    )
  }

  const client = result.data
  const caregivers = (caregiversRes.data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }))

  const assignedName = caregivers.find((c) => c.id === client.assigned_caregiver_id)?.name

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{client.name}</h1>

      <AdminClientEditor client={client} caregivers={caregivers} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500">Care Type</p>
            <p className="font-medium capitalize">{client.care_type}</p>
          </div>
          <div>
            <p className="text-gray-500">Date of Birth</p>
            <p className="font-medium">{client.date_of_birth}</p>
          </div>
          <div>
            <p className="text-gray-500">Assigned Caregiver</p>
            <p className="font-medium">{assignedName ?? 'None'}</p>
          </div>
        </div>
      </div>

      {client.health_info && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Health Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Conditions:</span> {client.health_info.conditions.join(', ') || '—'}</p>
            <p><span className="text-gray-500">Medications:</span> {client.health_info.medications.join(', ') || '—'}</p>
            <p><span className="text-gray-500">Allergies:</span> {client.health_info.allergies.join(', ') || '—'}</p>
            <p><span className="text-gray-500">Mobility:</span> <span className="capitalize">{client.health_info.mobility_level}</span></p>
            <p><span className="text-gray-500">Notes:</span> {client.health_info.notes || '—'}</p>
          </div>
        </div>
      )}

      {client.emergency_contact && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Emergency Contact</h2>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">Name:</span> {client.emergency_contact.name}</p>
            <p><span className="text-gray-500">Phone:</span> {client.emergency_contact.phone}</p>
            <p><span className="text-gray-500">Relationship:</span> {client.emergency_contact.relationship}</p>
          </div>
        </div>
      )}
    </div>
  )
}
