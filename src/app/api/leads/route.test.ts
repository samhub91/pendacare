import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { POST } from './route'

type InsertResult = { error: { message: string } | null }

interface MockSupabaseTable {
  insert: jest.Mock<Promise<InsertResult>, [Record<string, unknown>]>
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    body: '{bad json',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/leads', () => {
  let insert: MockSupabaseTable['insert']
  let from: jest.Mock<MockSupabaseTable, [string]>

  const validLead = {
    name: 'Avery Johnson',
    email: 'avery@example.com',
    phone: '+61 400 000 000',
    care_type: 'disability',
    message: 'We are looking for weekday support with transport and daily routines.',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    insert = jest.fn().mockResolvedValue({ error: null })
    from = jest.fn().mockReturnValue({ insert })
    ;(createSupabaseServerClient as jest.Mock).mockReturnValue({ from })
  })

  test('creates a lead for valid submissions', async () => {
    const res = await POST(makeRequest(validLead))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('landing_leads')
    expect(insert).toHaveBeenCalledWith({
      name: 'Avery Johnson',
      email: 'avery@example.com',
      phone: '+61 400 000 000',
      care_type: 'disability',
      message: 'We are looking for weekday support with transport and daily routines.',
    })
  })

  test('accepts other as a landing-only care type', async () => {
    const res = await POST(makeRequest({ ...validLead, care_type: 'other' }))

    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ care_type: 'other' }))
  })

  test('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonRequest())

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
    expect(from).not.toHaveBeenCalled()
  })

  test('returns field errors for invalid email', async () => {
    const res = await POST(makeRequest({ ...validLead, email: 'not-an-email' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.errors.email).toContain('Enter a valid email address')
    expect(from).not.toHaveBeenCalled()
  })

  test('returns field errors for missing required fields', async () => {
    const res = await POST(makeRequest({ care_type: 'elderly' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.errors.name).toBeDefined()
    expect(body.errors.email).toBeDefined()
    expect(body.errors.message).toBeDefined()
    expect(from).not.toHaveBeenCalled()
  })

  test('returns field errors for invalid care type', async () => {
    const res = await POST(makeRequest({ ...validLead, care_type: 'nursing' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.errors.care_type).toBeDefined()
    expect(from).not.toHaveBeenCalled()
  })

  test('returns 503 when Supabase insert fails', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'database unavailable' } })

    const res = await POST(makeRequest(validLead))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({
      error: 'We could not submit your inquiry right now. Please try again.',
    })
  })
})
