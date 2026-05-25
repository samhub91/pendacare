// POST /api/leads - public landing page inquiry submissions

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LeadSubmissionSchema } from '@/lib/leads'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = LeadSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const lead = parsed.data
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('landing_leads').insert({
    name: lead.name,
    email: lead.email,
    phone: lead.phone || null,
    care_type: lead.care_type,
    message: lead.message,
  })

  if (error) {
    console.error('[leads] insert error:', error)
    return NextResponse.json(
      { error: 'We could not submit your inquiry right now. Please try again.' },
      { status: 503 }
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
