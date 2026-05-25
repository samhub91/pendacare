'use client'
// Caregiver — log visit report form
// Requirements: 2.4, 8.1, 8.3

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({
    client_id: '',
    schedule_id: '',
    notes: '',
    hours_worked: '',
    feedback: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const cid = searchParams.get('client_id')
    const sid = searchParams.get('schedule_id')
    if (cid || sid) {
      setForm((f) => ({
        ...f,
        client_id: cid ?? f.client_id,
        schedule_id: sid ?? f.schedule_id,
      }))
    }
  }, [searchParams])

  function validate(): string | null {
    const hours = parseFloat(form.hours_worked)
    if (isNaN(hours) || hours < 0.25 || hours > 24) {
      return 'Hours worked must be between 0.25 and 24'
    }
    if (!form.client_id.trim()) return 'Client ID is required'
    if (!form.notes.trim()) return 'Notes are required'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        client_id: form.client_id,
        notes: form.notes,
        hours_worked: parseFloat(form.hours_worked),
      }
      if (form.schedule_id.trim()) body.schedule_id = form.schedule_id
      if (form.feedback.trim()) body.feedback = form.feedback

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit report')
        return
      }

      router.push('/dashboard/caregiver')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Log visit report</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
        aria-busy={submitting}
      >
        {[
          { label: 'Client ID', key: 'client_id', type: 'text', required: true },
          { label: 'Schedule ID (optional)', key: 'schedule_id', type: 'text', required: false },
          { label: 'Hours worked (0.25–24)', key: 'hours_worked', type: 'number', required: true },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
            <input
              type={type}
              step={key === 'hours_worked' ? '0.25' : undefined}
              required={required}
              disabled={submitting}
              value={(form as Record<string, string>)[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-70"
            />
          </div>
        ))}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Visit notes</label>
          <textarea
            required
            rows={4}
            disabled={submitting}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-70"
            placeholder="Describe the visit…"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Feedback (optional)</label>
          <textarea
            rows={2}
            disabled={submitting}
            value={form.feedback}
            onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:opacity-70"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {submitting && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          )}
          {submitting ? 'Submitting report…' : 'Submit report'}
        </button>
      </form>
    </div>
  )
}
