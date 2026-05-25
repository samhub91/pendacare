'use client'
// Admin schedules page — list and create schedules
// Requirements: 2.3, 3.1, 3.2, 3.3, 3.4

import { useState, useEffect } from 'react'

interface Schedule {
  id: string
  caregiver_id: string
  client_id: string
  date: string
  time: string
  duration_minutes: number
  status: string
  notes: string | null
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    caregiver_id: '',
    client_id: '',
    date: '',
    time: '',
    duration_minutes: 60,
    notes: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  type FormTextKey = 'caregiver_id' | 'client_id' | 'date' | 'time' | 'duration_minutes'
  const textFields: { label: string; key: FormTextKey; type: string }[] = [
    { label: 'Caregiver ID', key: 'caregiver_id', type: 'text' },
    { label: 'Client ID', key: 'client_id', type: 'text' },
    { label: 'Date', key: 'date', type: 'date' },
    { label: 'Time', key: 'time', type: 'time' },
    { label: 'Duration (minutes)', key: 'duration_minutes', type: 'number' },
  ]

  useEffect(() => {
    fetchSchedules()
  }, [])

  async function fetchSchedules() {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/schedules?start=${today}&end=2099-12-31`)
      if (!res.ok) throw new Error('Failed to load schedules')
      const data = await res.json()
      setSchedules(data.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duration_minutes: Number(form.duration_minutes) }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.conflicting_schedule_id
          ? `Conflict with schedule ${data.conflicting_schedule_id}`
          : data.error ?? 'Failed to create schedule'
        setFormError(msg)
        return
      }
      setForm({ caregiver_id: '', client_id: '', date: '', time: '', duration_minutes: 60, notes: '' })
      fetchSchedules()
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schedules</h1>

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Create Schedule</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {textFields.map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                required
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {formError && (
            <div role="alert" className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Creating…' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>

      {/* Schedule list */}
      {loading ? (
        <p className="text-gray-500">Loading schedules…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : schedules.length === 0 ? (
        <p className="text-gray-500">No upcoming schedules.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Time', 'Duration', 'Status', 'Caregiver', 'Client'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{s.date}</td>
                  <td className="px-4 py-3">{s.time}</td>
                  <td className="px-4 py-3">{s.duration_minutes}m</td>
                  <td className="px-4 py-3">
                    <span className="capitalize px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.caregiver_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.client_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
