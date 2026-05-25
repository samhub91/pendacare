-- Migration 002: Row Level Security policies for all Pendacare tables
-- Requirements: 2.7, 7.5, 10.3

-- ============================================================
-- Helper: role check shorthand
-- Usage: (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
-- ============================================================

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregivers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_info_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- users
-- - Users can read/update their own row
-- - Admins can read all rows
-- ============================================================
CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- caregivers
-- - Caregiver can read/update their own row (matched via user_id)
-- - Admins can read/write all rows
-- ============================================================
CREATE POLICY caregivers_select
  ON public.caregivers
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY caregivers_update_own
  ON public.caregivers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY caregivers_admin_insert
  ON public.caregivers
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY caregivers_admin_delete
  ON public.caregivers
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- clients
-- - Assigned caregiver can SELECT their assigned clients
-- - Client can SELECT their own row
-- - Family member can SELECT via family_links
-- - Admins can do all
-- ============================================================
CREATE POLICY clients_select
  ON public.clients
  FOR SELECT
  USING (
    -- Admin
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    -- Client viewing their own row
    OR user_id = auth.uid()
    -- Assigned caregiver
    OR assigned_caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    -- Family member linked to this client
    OR id IN (
      SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid()
    )
  );

CREATE POLICY clients_admin_insert
  ON public.clients
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY clients_admin_update
  ON public.clients
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY clients_admin_delete
  ON public.clients
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- schedules
-- - Caregiver can SELECT where caregiver_id matches their caregivers.id
-- - Client can SELECT where client_id matches their clients.id
-- - Admins can do all
-- ============================================================
CREATE POLICY schedules_select
  ON public.schedules
  FOR SELECT
  USING (
    -- Admin
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    -- Caregiver assigned to this schedule
    OR caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    -- Client assigned to this schedule
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY schedules_admin_insert
  ON public.schedules
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY schedules_admin_update
  ON public.schedules
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY schedules_admin_delete
  ON public.schedules
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- reports
-- - Caregiver can SELECT/INSERT where caregiver_id matches their caregivers.id
-- - Admin and family_member can SELECT
-- - Admins can do all
-- ============================================================
CREATE POLICY reports_select
  ON public.reports
  FOR SELECT
  USING (
    -- Admin
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    -- Caregiver who authored the report
    OR caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    -- Family member linked to the client in the report
    OR client_id IN (
      SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid()
    )
  );

CREATE POLICY reports_caregiver_insert
  ON public.reports
  FOR INSERT
  WITH CHECK (
    -- Caregiver inserting their own report
    caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY reports_admin_update
  ON public.reports
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY reports_admin_delete
  ON public.reports
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- messages
-- - Users can SELECT messages where sender_id or receiver_id = auth.uid()
-- - Users can INSERT messages where sender_id = auth.uid()
-- (Requirement 7.5)
-- ============================================================
CREATE POLICY messages_select
  ON public.messages
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
  );

CREATE POLICY messages_insert
  ON public.messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- No UPDATE or DELETE policies on messages (immutable once sent)

-- ============================================================
-- audit_logs
-- - INSERT only for authenticated users (service role writes via API)
-- - NO UPDATE or DELETE policy — append-only (Requirement 10.3)
-- ============================================================
CREATE POLICY audit_logs_insert
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can SELECT audit logs for compliance review
CREATE POLICY audit_logs_select_admin
  ON public.audit_logs
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- No UPDATE policy on audit_logs
-- No DELETE policy on audit_logs

-- ============================================================
-- family_links
-- - Family member can SELECT their own links
-- - Admins can do all
-- ============================================================
CREATE POLICY family_links_select
  ON public.family_links
  FOR SELECT
  USING (
    family_member_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY family_links_admin_insert
  ON public.family_links
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY family_links_admin_update
  ON public.family_links
  FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY family_links_admin_delete
  ON public.family_links
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- health_info_history
-- Same access pattern as clients table (Requirement 5.8)
-- - Assigned caregiver can SELECT
-- - Client can SELECT their own history
-- - Family member can SELECT via family_links
-- - Admins can do all
-- ============================================================
CREATE POLICY health_info_history_select
  ON public.health_info_history
  FOR SELECT
  USING (
    -- Admin
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    -- Client viewing their own history
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
    -- Assigned caregiver
    OR client_id IN (
      SELECT id FROM public.clients
      WHERE assigned_caregiver_id IN (
        SELECT id FROM public.caregivers WHERE user_id = auth.uid()
      )
    )
    -- Family member linked to this client
    OR client_id IN (
      SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid()
    )
  );

CREATE POLICY health_info_history_insert
  ON public.health_info_history
  FOR INSERT
  WITH CHECK (
    -- Assigned caregiver or admin can insert history entries
    client_id IN (
      SELECT id FROM public.clients
      WHERE assigned_caregiver_id IN (
        SELECT id FROM public.caregivers WHERE user_id = auth.uid()
      )
    )
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY health_info_history_admin_delete
  ON public.health_info_history
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );
