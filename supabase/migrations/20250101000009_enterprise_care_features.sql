-- Migration 009: Enterprise Care Features (MAR, Geolocation coordinates, structured Incidents)
-- Requirements: Backward-compatible extensions for modern care platforms

-- 1. Geolocation Fields (EVV Coordinate Logging)
-- Extend clients table to support care delivery addresses
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS latitude          NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude         NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS formatted_address  TEXT;

-- Extend schedules table to track caregiver GPS coordinates at start and end of shifts
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS start_lat    NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS start_lng    NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS end_lat      NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS end_lng      NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS gps_verified  BOOLEAN DEFAULT FALSE;

-- 2. Medication Administration Records (MAR) Table
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  medication_name   TEXT NOT NULL,
  dosage            TEXT NOT NULL,
  scheduled_time    TIME NOT NULL,
  administered_at   TIMESTAMPTZ,
  status            TEXT NOT NULL CHECK (status IN ('administered', 'refused', 'missed')),
  caregiver_id      UUID REFERENCES public.caregivers(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_logs_schedule ON public.medication_logs(schedule_id);

-- 3. Incident Reporting & Escalation Table
CREATE TABLE IF NOT EXISTS public.incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  caregiver_id      UUID NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  schedule_id       UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_investigation', 'resolved')),
  escalated         BOOLEAN DEFAULT FALSE,
  escalated_at      TIMESTAMPTZ,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_client    ON public.incidents(client_id);
CREATE INDEX IF NOT EXISTS idx_incidents_caregiver ON public.incidents(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity  ON public.incidents(severity);

-- Enable Row-Level Security (RLS) on new tables
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents       ENABLE ROW LEVEL SECURITY;

-- 4. Row-Level Security (RLS) Policies
-- Medication logs: Caregivers can select/insert logs for their schedules; Clients/Family linked can view; Admins can do all
CREATE POLICY medication_logs_select ON public.medication_logs
  FOR SELECT
  USING (
    public.current_user_role() = 'admin'
    OR schedule_id IN (
      SELECT id FROM public.schedules 
      WHERE caregiver_id IN (SELECT id FROM public.caregivers WHERE user_id = auth.uid())
      OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      OR client_id IN (SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid())
    )
  );

CREATE POLICY medication_logs_insert ON public.medication_logs
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR schedule_id IN (
      SELECT id FROM public.schedules 
      WHERE caregiver_id IN (SELECT id FROM public.caregivers WHERE user_id = auth.uid())
    )
  );

-- Incident logs: Caregivers can insert reports for their clients and view their own; Clients/Family linked can view; Admins can do all
CREATE POLICY incidents_select ON public.incidents
  FOR SELECT
  USING (
    public.current_user_role() = 'admin'
    OR caregiver_id IN (SELECT id FROM public.caregivers WHERE user_id = auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR client_id IN (SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid())
  );

CREATE POLICY incidents_insert ON public.incidents
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR caregiver_id IN (SELECT id FROM public.caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY incidents_admin_update ON public.incidents
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- 5. Automated Notification Trigger for High/Critical Severity Incidents
-- Automatically inserts notifications for admins on severe incidents
CREATE OR REPLACE FUNCTION public.escalate_severity_incidents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  -- If severity is high or critical, trigger escalations
  IF NEW.severity IN ('high', 'critical') THEN
    NEW.escalated := TRUE;
    NEW.escalated_at := NOW();

    -- Insert notifications for all admins
    FOR admin_rec IN 
      SELECT id FROM public.users WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link_path)
      VALUES (
        admin_rec.id,
        'CRITICAL INCIDENT: ' || NEW.title,
        'A severity level ' || NEW.severity || ' incident was reported during care. Immediate attention is required.',
        'alert',
        '/dashboard/admin/incidents/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_escalate_incidents
  BEFORE INSERT OR UPDATE OF severity ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.escalate_severity_incidents();
