import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import {
  reportIncident,
  resolveIncident,
  getIncidentsForClient,
  getOpenEscalatedIncidents,
} from '../incidentService'
import { AuthenticatedUser, CreateIncidentInput, ResolveIncidentInput } from '@/lib/types'

type SupabaseMockError = { message?: string; code?: string }
type SupabaseMockResult = { data: unknown; error: SupabaseMockError | null }
type QueryMethod = jest.Mock<MockQueryChain, unknown[]>

interface MockQueryChain {
  select: QueryMethod
  insert: QueryMethod
  update: QueryMethod
  eq: QueryMethod
  lt: QueryMethod
  limit: QueryMethod
  order: QueryMethod
  in: QueryMethod
  single: jest.Mock<Promise<SupabaseMockResult>, []>
  then: jest.Mock<Promise<unknown>, [onfulfilled: (value: SupabaseMockResult) => unknown]>
}

// Mock the audit log utility
jest.mock('@/lib/audit/auditLog', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
}))

describe('IncidentService', () => {
  let mockSingle: jest.Mock<Promise<SupabaseMockResult>, []>
  let mockQueryResult: SupabaseMockResult
  let mockQueryChain: MockQueryChain

  const adminActor: AuthenticatedUser = {
    id: 'admin-user-id',
    email: 'admin@pendacare.com.au',
    role: 'admin',
  }

  const caregiverActor: AuthenticatedUser = {
    id: 'caregiver-user-id',
    email: 'caregiver@pendacare.com.au',
    role: 'caregiver',
    caregiverId: 'caregiver-profile-id',
  }

  const clientActor: AuthenticatedUser = {
    id: 'client-user-id',
    email: 'client@pendacare.com.au',
    role: 'client',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockSingle = jest.fn()
    mockQueryResult = { data: null, error: null }

    mockQueryChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: mockSingle,
      then: jest.fn((onfulfilled) => {
        return Promise.resolve(mockQueryResult).then(onfulfilled)
      }),
    }

    // Set default behavior for supabaseAdmin.from
    ;(supabaseAdmin.from as jest.Mock).mockImplementation(() => mockQueryChain)
  })

  describe('reportIncident', () => {
    const validInput: CreateIncidentInput = {
      client_id: 'client-id-123',
      caregiver_id: 'caregiver-profile-id',
      title: 'Slip and fall in kitchen',
      description: 'Client slipped on wet tile but sustained no injuries.',
      severity: 'medium',
    }

    test('should prevent non-caregivers and non-admins from reporting incidents', async () => {
      const result = await reportIncident(validInput, clientActor)
      expect(result.status).toBe(403)
      expect(result.error).toBe('Forbidden')
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    test('should fail validation with invalid input fields', async () => {
      const invalidInput: CreateIncidentInput = {
        client_id: '',
        caregiver_id: '  ',
        title: '',
        description: '',
        severity: 'invalid-severity' as CreateIncidentInput['severity'],
      }

      const result = await reportIncident(invalidInput, caregiverActor)
      expect(result.status).toBe(400)
      expect(result.error).toContain('client_id is required')
      expect(result.error).toContain('title is required')
      expect(result.error).toContain('severity must be one of')
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    test('should return 404 if client not found for caregiver', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      const result = await reportIncident(validInput, caregiverActor)
      expect(result.status).toBe(404)
      expect(result.error).toBe('Client not found')
      expect(supabaseAdmin.from).toHaveBeenCalledWith('clients')
    })

    test('should return 403 if caregiver is not assigned to the client', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'client-id-123', assigned_caregiver_id: 'different-caregiver-id' },
        error: null,
      })

      const result = await reportIncident(validInput, caregiverActor)
      expect(result.status).toBe(403)
      expect(result.error).toBe('You are not the assigned caregiver for this client')
    })

    test('should successfully insert incident report for caregiver and create audit log', async () => {
      // 1. Mock client check
      mockSingle.mockResolvedValueOnce({
        data: { id: 'client-id-123', assigned_caregiver_id: 'caregiver-profile-id' },
        error: null,
      })

      // 2. Mock incident insertion
      const mockIncident = { id: 'new-incident-id', ...validInput, status: 'open' }
      mockSingle.mockResolvedValueOnce({
        data: mockIncident,
        error: null,
      })

      const result = await reportIncident(validInput, caregiverActor, '127.0.0.1')

      expect(result.status).toBe(201)
      expect(result.data).toEqual(mockIncident)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('incidents')
      expect(insertAuditLog).toHaveBeenCalledWith({
        actor_id: caregiverActor.id,
        action: 'incident.reported',
        resource: 'incidents',
        resource_id: 'new-incident-id',
        metadata: { severity: 'medium', client_id: 'client-id-123' },
        ip_address: '127.0.0.1',
      })
    })

    test('should successfully insert incident report for admin bypassing caregiver-client assignments', async () => {
      const mockIncident = { id: 'new-incident-id', ...validInput, status: 'open' }
      mockSingle.mockResolvedValueOnce({
        data: mockIncident,
        error: null,
      })

      const result = await reportIncident(validInput, adminActor)

      expect(result.status).toBe(201)
      expect(result.data).toEqual(mockIncident)
      // Admins bypass the client verification check (only call 'incidents' insert)
      expect(supabaseAdmin.from).toHaveBeenCalledTimes(1)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('incidents')
    })

    test('should return 503 if incident insertion fails', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'client-id-123', assigned_caregiver_id: 'caregiver-profile-id' },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database insert error' },
      })

      const result = await reportIncident(validInput, caregiverActor)
      expect(result.status).toBe(503)
      expect(result.error).toBe('Service temporarily unavailable')
    })
  })

  describe('resolveIncident', () => {
    const resolveInput: ResolveIncidentInput = {
      status: 'resolved',
      resolution_notes: 'Reviewed safety plan with family and client.',
    }

    test('should forbid non-admins from resolving incidents', async () => {
      const result = await resolveIncident('incident-123', resolveInput, caregiverActor)
      expect(result.status).toBe(403)
      expect(result.error).toBe('Forbidden')
    })

    test('should return 400 for invalid status', async () => {
      const result = await resolveIncident(
        'incident-123',
        { ...resolveInput, status: 'invalid-status' as ResolveIncidentInput['status'] },
        adminActor
      )
      expect(result.status).toBe(400)
      expect(result.error).toContain('status must be one of')
    })

    test('should return 400 if resolution notes are empty', async () => {
      const result = await resolveIncident(
        'incident-123',
        { ...resolveInput, resolution_notes: '   ' },
        adminActor
      )
      expect(result.status).toBe(400)
      expect(result.error).toContain('resolution_notes are required')
    })

    test('should update incident status and resolution notes and create audit log', async () => {
      const mockIncident = {
        id: 'incident-123',
        status: 'resolved',
        resolution_notes: resolveInput.resolution_notes,
      }
      mockSingle.mockResolvedValueOnce({
        data: mockIncident,
        error: null,
      })

      const result = await resolveIncident('incident-123', resolveInput, adminActor, '192.168.1.10')

      expect(result.status).toBe(200)
      expect(result.data).toEqual(mockIncident)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('incidents')
      expect(insertAuditLog).toHaveBeenCalledWith({
        actor_id: adminActor.id,
        action: 'incident.resolved',
        resource: 'incidents',
        resource_id: 'incident-123',
        metadata: {
          status: 'resolved',
          resolution_notes: 'Reviewed safety plan with family and client.',
        },
        ip_address: '192.168.1.10',
      })
    })

    test('should return 404 if incident does not exist', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      const result = await resolveIncident('incident-123', resolveInput, adminActor)
      expect(result.status).toBe(404)
      expect(result.error).toBe('Incident not found or service unavailable')
    })
  })

  describe('getIncidentsForClient', () => {
    test('should allow admins to view incidents without client validation', async () => {
      const mockIncidents = [{ id: 'inc-1' }, { id: 'inc-2' }]
      mockQueryResult = { data: mockIncidents, error: null }

      const result = await getIncidentsForClient('client-123', adminActor)

      expect(result.data).toEqual(mockIncidents)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('incidents')
    })

    test('should verify access for clients or family members before fetching incidents', async () => {
      // 1. Mock clients check (success)
      mockSingle.mockResolvedValueOnce({ data: { id: 'client-123' }, error: null })
      // 2. Mock list query
      const mockIncidents = [{ id: 'inc-1' }]
      mockQueryResult = { data: mockIncidents, error: null }

      const result = await getIncidentsForClient('client-123', clientActor)

      expect(result.data).toEqual(mockIncidents)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('clients')
      expect(supabaseAdmin.from).toHaveBeenCalledWith('incidents')
    })

    test('should block client if client profile check fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not authorized' } })

      const result = await getIncidentsForClient('client-123', clientActor)

      expect(result.data).toEqual([])
      expect(result.next_cursor).toBeNull()
    })
  })

  describe('getOpenEscalatedIncidents', () => {
    test('should forbid non-admins from getting open escalated incidents', async () => {
      const result = await getOpenEscalatedIncidents(caregiverActor)
      expect(result.data).toEqual([])
      expect(result.next_cursor).toBeNull()
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    test('should return open escalated incidents for admins', async () => {
      const mockEscalatedIncidents = [{ id: 'inc-1', escalated: true, status: 'open' }]
      mockQueryResult = { data: mockEscalatedIncidents, error: null }

      const result = await getOpenEscalatedIncidents(adminActor)

      expect(result.data).toEqual(mockEscalatedIncidents)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('incidents')
    })
  })
})
