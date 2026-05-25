// Messages page — conversation list + chat window
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.6

import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { ChatWindow } from '@/components/messaging/ChatWindow'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader, SectionCard, EmptyState } from '@/components/dashboard'

type MessagesPageProps = {
  searchParams: { partner?: string }
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name, role')
    .neq('id', user.id)
    .order('name')
    .limit(50)

  const partnerId = searchParams.partner
  const partnerUser =
    partnerId && users?.length
      ? users.find((u) => u.id === partnerId)
      : undefined

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Messages"
        description="Secure messaging with your care team. Choose a contact to open the conversation."
      />

      <div className="grid min-h-[560px] flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-h-[320px] flex-col lg:min-h-[560px]">
        <SectionCard title="Contacts" description="People you can message." headingId="msg-contacts" bodyClassName="p-0 flex flex-col min-h-0 flex-1">
          <div className="flex max-h-[520px] flex-1 flex-col overflow-hidden">
            {!users || users.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No contacts yet"
                  description="When other users are added to the organisation, they will appear here."
                />
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/dashboard/messages?partner=${u.id}`}
                      className="flex items-center border-b border-gray-50 px-4 py-3 transition-colors hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="truncate text-xs capitalize text-gray-500">{u.role.replace('_', ' ')}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
        </div>

        <div className="flex min-h-[320px] flex-col rounded-xl border border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white lg:col-span-2">
          {partnerId && partnerUser ? (
            <div className="flex min-h-[320px] flex-1 flex-col p-4 lg:min-h-[560px]">
              <ChatWindow
                currentUserId={user.id}
                partnerId={partnerUser.id}
                partnerName={partnerUser.name ?? undefined}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-gray-700">Conversation</p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Select a contact from the list, or open a link with{' '}
                <span className="font-mono text-xs">?partner=</span> in the URL.
              </p>
              {partnerId && !partnerUser ? (
                <p className="mt-4 max-w-sm text-sm text-amber-700" role="status">
                  That contact is not available. Choose someone from the list.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
