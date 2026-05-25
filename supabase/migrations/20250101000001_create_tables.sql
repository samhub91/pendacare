-- Migration 001: Create all tables for Pendacare
-- Requires: Supabase Auth (auth.users)
-- Uses IF NOT EXISTS to be idempotent

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- users
-- Extended profile linked to Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('admin', 'caregiver', 'client', 'family_member')),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  contact_info JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- caregivers
-- ============================================================
CREATE TABLE IF NOT EXISTS caregivers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  qualifications TEXT[],
  availability   JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  date_of_birth         DATE NOT NULL,
  care_type             TEXT NOT NULL CHECK (care_type IN ('elderly', 'disability', 'childcare')),
  health_info           JSONB,
  assigned_caregiver_id UUID REFERENCES caregivers(id) ON DELETE SET NULL,
  emergency_contact     JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id     UUID NOT NULL REFERENCES caregivers(id) ON DELETE RESTRICT,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_overlap UNIQUE (caregiver_id, date, time)
);

-- ============================================================
-- reports
-- hours_worked: 0.25-24 inclusive (Requirement 8.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE RESTRICT,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  schedule_id  UUID REFERENCES schedules(id) ON DELETE SET NULL,
  notes        TEXT NOT NULL,
  hours_worked NUMERIC(4, 2) NOT NULL
                 CHECK (hours_worked >= 0.25 AND hours_worked <= 24),
  feedback     TEXT,
  locked_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- messages
-- content stored as AES-256-GCM ciphertext (Requirement 6.2)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content     TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- audit_logs
-- Append-only; UPDATE/DELETE prevented via RLS (Requirement 10.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- family_links
-- ============================================================
CREATE TABLE IF NOT EXISTS family_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (family_member_id, client_id)
);

-- ============================================================
-- health_info_history
-- ============================================================
CREATE TABLE IF NOT EXISTS health_info_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  health_info JSONB NOT NULL,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes (Requirement 13.6)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedules_caregiver_date   ON schedules (caregiver_id, date);
CREATE INDEX IF NOT EXISTS idx_reports_client_created_at  ON reports   (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_created  ON messages  (receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_schedules_client_id        ON schedules (client_id);
CREATE INDEX IF NOT EXISTS idx_reports_caregiver_id       ON reports   (caregiver_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id        ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource        ON audit_logs (resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_family_links_client_id     ON family_links (client_id);
CREATE INDEX IF NOT EXISTS idx_health_info_history_client ON health_info_history (client_id, changed_at);
