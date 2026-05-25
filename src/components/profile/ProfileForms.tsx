'use client'

import { useState } from 'react'
import type {
  CaregiverProfileData,
  ClientProfileData,
  FamilyProfileData,
} from '@/lib/services/profileService'
import type { FamilyLinkRequest } from '@/lib/types'

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function SaveBar({
  saving,
  saved,
  error,
  onSave,
}: {
  saving: boolean
  saved: boolean
  error: string | null
  onSave: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100 mt-6">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      {saved && <span className="text-sm text-green-600">Saved</span>}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}

export function CaregiverProfileForm({ initial }: { initial: CaregiverProfileData }) {
  const [phone, setPhone] = useState(initial.contact_info?.phone ?? '')
  const [qualifications, setQualifications] = useState(initial.qualifications.join('\n'))
  const [availabilityNotes, setAvailabilityNotes] = useState(initial.availability?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          qualifications,
          availability_notes: availabilityNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setSaved(true)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <Field label="Phone">
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Qualifications">
        <textarea
          rows={4}
          className={inputClass}
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          placeholder="One per line or comma-separated"
        />
      </Field>
      <Field label="Availability notes">
        <textarea
          rows={3}
          className={inputClass}
          value={availabilityNotes}
          onChange={(e) => setAvailabilityNotes(e.target.value)}
        />
      </Field>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  )
}

export function ClientProfileForm({ initial }: { initial: ClientProfileData }) {
  const ec = initial.emergency_contact
  const [phone, setPhone] = useState(initial.contact_info?.phone ?? '')
  const [emergencyName, setEmergencyName] = useState(ec?.name ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(ec?.phone ?? '')
  const [emergencyRelationship, setEmergencyRelationship] = useState(ec?.relationship ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          emergency_contact: {
            name: emergencyName,
            phone: emergencyPhone,
            relationship: emergencyRelationship,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setSaved(true)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm space-y-2">
        <p>
          <span className="text-gray-500">Date of birth:</span>{' '}
          <span className="font-medium">{initial.date_of_birth}</span>
        </p>
        <p>
          <span className="text-gray-500">Care type:</span>{' '}
          <span className="font-medium capitalize">{initial.care_type.replace('_', ' ')}</span>
        </p>
        <p className="text-xs text-gray-500">Contact your coordinator to change date of birth or care type.</p>
      </div>
      <Field label="Phone">
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <p className="text-sm font-medium text-gray-800 pt-2">Emergency contact</p>
      <Field label="Name">
        <input className={inputClass} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
      </Field>
      <Field label="Phone">
        <input className={inputClass} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
      </Field>
      <Field label="Relationship">
        <input
          className={inputClass}
          value={emergencyRelationship}
          onChange={(e) => setEmergencyRelationship(e.target.value)}
        />
      </Field>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  )
}

export function FamilyProfileForm({ initial }: { initial: FamilyProfileData }) {
  const [phone, setPhone] = useState(initial.contact_info?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
        return
      }
      setSaved(true)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <Field label="Phone">
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Link requests</h3>
        {initial.link_requests.length === 0 ? (
          <p className="text-sm text-gray-500">No link requests on file.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {initial.link_requests.map((r: FamilyLinkRequest) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">{r.client_email}</p>
                {r.recipient_name && <p className="text-gray-600">{r.recipient_name}</p>}
                <p className="text-xs capitalize text-gray-500 mt-1">{r.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
