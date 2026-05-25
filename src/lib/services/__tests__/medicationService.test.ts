import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertAuditLog } from '@/lib/audit/auditLog'
import {
  logMedicationAdministration,
  getMedicationLogsForSchedule,
  getMedicationSummaryForClient,
} from '../medicationService'
import { AuthenticatedUser, CreateMedicationLogInput } from '@/lib/types'

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

describe('MedicationService', () => {
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

  describe('logMedicationAdministration', () => {
    const validInput: CreateMedicationLogInput = {
      schedule_id: 'schedule-id-123',
      medication_name: 'Paracetamol',
      dosage: '500mg',
      scheduled_time: '08:00',
      status: 'administered',
      notes: 'Taken with water.',
    }

    test('should prevent non-caregivers and non-admins from logging medications', async () => {
      const result = await logMedicationAdministration(validInput, clientActor)
      expect(result.status).toBe(403)
      expect(result.error).toBe('Forbidden')
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    test('should fail validation with invalid input fields', async () => {
      const invalidInput: CreateMedicationLogInput = {
        schedule_id: '',
        medication_name: '  ',
        dosage: '',
        scheduled_time: '8:00', // invalid HH:MM format
        status: 'invalid-status' as CreateMedicationLogInput['status'],
      }

      const result = await logMedicationAdministration(invalidInput, caregiverActor)
      expect(result.status).toBe(400)
      expect(result.error).toContain('schedule_id is required')
      expect(result.error).toContain('medication_name is required')
      expect(result.error).toContain('scheduled_time must be in HH:MM format')
      expect(result.error).toContain('status must be one of')
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    test('should return 404 if schedule not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      const result = await logMedicationAdministration(validInput, caregiverActor)
      expect(result.status).toBe(404)
      expect(result.error).toBe('Schedule not found')
      expect(supabaseAdmin.from).toHaveBeenCalledWith('schedules')
    })

    test('should return 403 if caregiver is not assigned to the schedule', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-id-123', caregiver_id: 'different-caregiver-id', status: 'scheduled' },
        error: null,
      })

      const result = await logMedicationAdministration(validInput, caregiverActor)
      expect(result.status).toBe(403)
      expect(result.error).toBe('You are not assigned to this schedule')
    })

    test('should return 409 if schedule is cancelled', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-id-123', caregiver_id: 'caregiver-profile-id', status: 'cancelled' },
        error: null,
      })

      const result = await logMedicationAdministration(validInput, caregiverActor)
      expect(result.status).toBe(409)
      expect(result.error).toBe('Cannot log medications for a cancelled schedule')
    })

    test('should successfully log medication and create audit log for caregiver', async () => {
      // 1. Mock schedule check
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-id-123', caregiver_id: 'caregiver-profile-id', status: 'scheduled' },
        error: null,
      })

      // 2. Mock log insertion
      const mockLog = { id: 'new-log-id', ...validInput, caregiver_id: 'caregiver-profile-id' }
      mockSingle.mockResolvedValueOnce({
        data: mockLog,
        error: null,
      })

      const result = await logMedicationAdministration(validInput, caregiverActor, '127.0.0.1')

      expect(result.status).toBe(201)
      expect(result.data).toEqual(mockLog)
      expect(supabaseAdmin.from).toHaveBeenCalledWith('medication_logs')
      expect(insertAuditLog).toHaveBeenCalledWith({
        actor_id: caregiverActor.id,
        action: 'medication.logged',
        resource: 'medication_logs',
        resource_id: 'new-log-id',
        metadata: {
          schedule_id: 'schedule-id-123',
          medication_name: 'Paracetamol',
          status: 'administered',
        },
        ip_address: '127.0.0.1',
      })
    })

    test('should successfully log medication for admin bypassing schedule caregiver assignments', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-id-123', caregiver_id: 'different-caregiver-id', status: 'scheduled' },
        error: null,
      })

      const mockLog = { id: 'new-log-id', ...validInput, caregiver_id: null }
      mockSingle.mockResolvedValueOnce({
        data: mockLog,
        error: null,
      })

      const result = await logMedicationAdministration(validInput, adminActor)

      expect(result.status).toBe(201)
      expect(result.data).toEqual(mockLog)
    })
  })

  describe('getMedicationLogsForSchedule', () => {
    test('should return 404 if schedule does not exist', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      const result = await getMedicationLogsForSchedule('schedule-123', caregiverActor)
      expect(result.status).toBe(404)
      expect(result.error).toBe('Schedule not found')
      expect(result.data).toEqual([])
    })

    test('should return 403 if caregiver tries to access logs of a schedule assigned to someone else', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-123', caregiver_id: 'other-caregiver', client_id: 'client-1' },
        error: null,
      })

      const result = await getMedicationLogsForSchedule('schedule-123', caregiverActor)
      expect(result.status).toBe(403)
      expect(result.error).toBe('Forbidden')
      expect(result.data).toEqual([])
    })

    test('should return medication logs for assigned caregiver', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-123', caregiver_id: 'caregiver-profile-id', client_id: 'client-1' },
        error: null,
      })

      const mockLogs = [{ id: 'log-1', medication_name: 'Aspirin' }]
      mockQueryResult = { data: mockLogs, error: null }

      const result = await getMedicationLogsForSchedule('schedule-123', caregiverActor)

      expect(result.status).toBe(200)
      expect(result.data).toEqual(mockLogs)
    })

    test('should return medication logs for admins bypassing assignments', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'schedule-123', caregiver_id: 'other-caregiver', client_id: 'client-1' },
        error: null,
      })

      const mockLogs = [{ id: 'log-1', medication_name: 'Aspirin' }]
      mockQueryResult = { data: mockLogs, error: null }

      const result = await getMedicationLogsForSchedule('schedule-123', adminActor)

      expect(result.status).toBe(200)
      expect(result.data).toEqual(mockLogs)
    })
  })

  describe('getMedicationSummaryForClient', () => {
    test('should block non-admins and non-family members', async () => {
      const result = await getMedicationSummaryForClient('client-123', clientActor)
      expect(result).toBeNull()
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    test('should return 0 stats if client has no schedules', async () => {
      mockQueryResult = { data: [], error: null }

      const result = await getMedicationSummaryForClient('client-123', adminActor)

      expect(result).toEqual({
        total: 0,
        administered: 0,
        refused: 0,
        missed: 0,
        adherenceRate: 0,
      })
    })

    test('should calculate correct summary statistics and adherence rate', async () => {
      // 1. Mock fetch schedules
      mockQueryResult = {
        data: [{ id: 'sched-1' }, { id: 'sched-2' }],
        error: null,
      }

      // 2. Mock fetch logs for those schedules (nested call/mock override)
      // Since it's done via then/await chain, we update the mockQueryResult
      // after the first promise resolves.
      let calls = 0
      mockQueryChain.then = jest.fn((onfulfilled) => {
        calls++
        if (calls === 1) {
          return Promise.resolve({ data: [{ id: 'sched-1' }, { id: 'sched-2' }], error: null }).then(onfulfilled)
        } else {
          return Promise.resolve({
            data: [
              { status: 'administered' },
              { status: 'administered' },
              { status: 'refused' },
              { status: 'missed' },
            ],
            error: null,
          }).then(onfulfilled)
        }
      })

      const result = await getMedicationSummaryForClient('client-123', adminActor)

      expect(result).toEqual({
        total: 4,
        administered: 2,
        refused: 1,
        missed: 1,
        adherenceRate: 50, // 2 / 4 = 50%
      })
    })
  })
})
