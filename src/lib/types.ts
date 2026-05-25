// Pendacare shared TypeScript types and enums
// Requirements: 2.1, 3.1, 5.1, 7.1, 8.1

// ============================================================
// Enums / Union Types
// ============================================================

export type UserRole = 'admin' | 'caregiver' | 'client' | 'family_member'

export type ScheduleStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type CareType = 'elderly' | 'disability' | 'childcare'

export type MobilityLevel = 'independent' | 'assisted' | 'dependent'

// ============================================================
// Auth
// ============================================================

export interface AuthenticatedUser {
  id: string
  email: string
  /** Display name from public.users */
  name?: string
  role: UserRole
  /** Set when role === 'caregiver' — the caregivers.id (not users.id) */
  caregiverId?: string
}

// ============================================================
// User
// ============================================================

export interface User {
  id: string
  role: UserRole
  name: string
  email: string
  contact_info: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ============================================================
// Health & Client
// ============================================================

export interface HealthInfo {
  conditions: string[]
  medications: string[]
  allergies: string[]
  mobility_level: MobilityLevel
  notes: string
}

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface ContactInfo {
  phone?: string
}

export interface CaregiverAvailability {
  notes?: string
  days?: string[]
}

export type FamilyLinkRequestStatus = 'pending' | 'approved' | 'rejected'

export interface FamilyLinkRequest {
  id: string
  family_member_id: string
  client_email: string
  recipient_name: string | null
  status: FamilyLinkRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface ClientProfile {
  id: string
  user_id: string | null
  name: string
  date_of_birth: string
  care_type: CareType
  health_info: HealthInfo | null
  assigned_caregiver_id: string | null
  emergency_contact: EmergencyContact | null
  created_at: string
  updated_at: string
}

// ============================================================
// Caregiver
// ============================================================

export interface Caregiver {
  id: string
  user_id: string | null
  name: string
  qualifications: string[] | null
  availability: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ============================================================
// Schedules
// ============================================================

export interface Schedule {
  id: string
  caregiver_id: string
  client_id: string
  date: string           // ISO 8601 date YYYY-MM-DD
  time: string           // HH:MM 24-hour
  duration_minutes: number
  status: ScheduleStatus
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Schedule row with joined client fields for dashboards */
export interface ScheduleWithClient extends Schedule {
  client_name: string
  care_type: CareType
}

export interface CreateScheduleInput {
  caregiver_id: string
  client_id: string
  date: string           // ISO 8601 date YYYY-MM-DD
  time: string           // HH:MM 24-hour
  duration_minutes: number
  notes?: string
}

// ============================================================
// Reports
// ============================================================

export interface Report {
  id: string
  caregiver_id: string
  client_id: string
  schedule_id: string | null
  notes: string
  hours_worked: number
  feedback: string | null
  locked_at: string | null
  created_at: string
}

export interface CreateReportInput {
  caregiver_id: string
  client_id: string
  schedule_id?: string
  notes: string
  hours_worked: number
  feedback?: string
}

export interface MonthlySummary {
  client_id: string
  month: string          // YYYY-MM
  total_hours: number
  visit_count: number
  caregivers: string[]
  highlights: string[]
}

// ============================================================
// Messages
// ============================================================

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string        // decrypted at the service layer before returning
  read_at: string | null
  created_at: string
}

export interface SendMessageInput {
  receiver_id: string
  content: string
}

// ============================================================
// Audit Log
// ============================================================

export interface AuditLogEntry {
  actor_id: string | null
  action: string         // e.g. 'schedule.created', 'client.profile.viewed'
  resource: string       // e.g. 'schedules', 'clients'
  resource_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
}

// ============================================================
// Pagination
// ============================================================

export interface Pagination {
  cursor?: string
  page_size?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  next_cursor: string | null
}

// ============================================================
// Utility
// ============================================================

export interface DateRange {
  start: string          // ISO 8601 date
  end: string            // ISO 8601 date
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

// ============================================================
// Incidents (Structured Incident Reporting)
// ============================================================

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus   = 'open' | 'under_investigation' | 'resolved'

export interface Incident {
  id:                string
  client_id:         string
  caregiver_id:      string
  schedule_id:       string | null
  title:             string
  description:       string
  severity:          IncidentSeverity
  status:            IncidentStatus
  escalated:         boolean
  escalated_at:      string | null
  resolution_notes:  string | null
  created_at:        string
  updated_at:        string
}

export interface CreateIncidentInput {
  client_id:    string
  caregiver_id: string
  schedule_id?: string
  title:        string
  description:  string
  severity:     IncidentSeverity
}

export interface ResolveIncidentInput {
  status:           IncidentStatus
  resolution_notes: string
}

// ============================================================
// Medication Administration Records (MAR)
// ============================================================

export type MedicationStatus = 'administered' | 'refused' | 'missed'

export interface MedicationLog {
  id:               string
  schedule_id:      string
  medication_name:  string
  dosage:           string
  scheduled_time:   string  // HH:MM
  administered_at:  string | null
  status:           MedicationStatus
  caregiver_id:     string | null
  notes:            string | null
  created_at:       string
}

export interface CreateMedicationLogInput {
  schedule_id:      string
  medication_name:  string
  dosage:           string
  scheduled_time:   string  // HH:MM
  status:           MedicationStatus
  notes?:           string
}
