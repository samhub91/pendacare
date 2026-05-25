'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CareType, ClientProfile, EmergencyContact } from '@/lib/types'

interface CaregiverOption {
  id: string
  name: string
}

interface Props {
  client: ClientProfile
  caregivers: CaregiverOption[]
}

export function AdminClientEditor({ client, caregivers }: Props) {
  const router = useRouter()
  const ec = client.emergency_contact
  const [dateOfBirth, setDateOfBirth] = useState(client.date_of_birth)
  const [careType, setCareType] = useState<CareType>(client.care_type)
  const [assignedCaregiverId, setAssignedCaregiverId] = useState(client.assigned_caregiver_id ?? '')
  const [emergencyName, setEmergencyName] = useState(ec?.name ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(ec?.phone ?? '')
  const [emergencyRelationship, setEmergencyRelationship] = useState(ec?.relationship ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const emergency_contact: EmergencyContact | null =
      emergencyName && emergencyPhone && emergencyRelationship
        ? {
            name: emergencyName,
            phone: emergencyPhone,
            relationship: emergencyRelationship,
          }
        : null

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_of_birth: dateOfBirth,
          care_type: careType,
          emergency_contact,
          assigned_caregiver_id: assignedCaregiverId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4 max-w-lg">
      <h2 className="text-lg font-semibold text-gray-800">Edit client details</h2>
      <label className="block text-sm">
        <span className="font-medium text-gray-700">Date of birth</span>
        <input
          type="date"
          className={`${inputClass} mt-1`}
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-700">Care type</span>
        <select
          className={`${inputClass} mt-1`}
          value={careType}
          onChange={(e) => setCareType(e.target.value as CareType)}
        >
          <option value="elderly">Elderly</option>
          <option value="disability">Disability</option>
          <option value="childcare">Childcare</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-700">Assigned caregiver</span>
        <select
          className={`${inputClass} mt-1`}
          value={assignedCaregiverId}
          onChange={(e) => setAssignedCaregiverId(e.target.value)}
        >
          <option value="">None</option>
          {caregivers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm font-medium text-gray-800 pt-2">Emergency contact</p>
      <label className="block text-sm">
        <span className="text-gray-600">Name</span>
        <input className={`${inputClass} mt-1`} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">Phone</span>
        <input className={`${inputClass} mt-1`} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">Relationship</span>
        <input
          className={`${inputClass} mt-1`}
          value={emergencyRelationship}
          onChange={(e) => setEmergencyRelationship(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
