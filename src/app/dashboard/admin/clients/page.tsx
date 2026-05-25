// Admin clients list page
// Requirements: 2.3, 5.5, 5.10

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminClientsPage() {
  const user = await getSession()
  if (!user || user.role !== 'admin') redirect('/login')

  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, care_type, date_of_birth, assigned_caregiver_id')
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Clients</h1>
      {!clients || clients.length === 0 ? (
        <p className="text-gray-500">No clients found.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Care Type', 'Date of Birth', 'Assigned Caregiver', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 capitalize">{c.care_type}</td>
                  <td className="px-4 py-3">{c.date_of_birth}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {c.assigned_caregiver_id ? `${c.assigned_caregiver_id.slice(0, 8)}…` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/clients/${c.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
