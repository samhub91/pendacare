-- Migration 004: Embed role in JWT claims + modernise RLS policies
-- Uses custom_access_token_hook to inject role into every JWT
-- This eliminates subqueries in RLS and removes the need for admin-client workarounds

-- ============================================================
-- 1. Function: custom_access_token_hook
--    Supabase calls this on every token issue/refresh.
--    It adds { "user_role": "<role>" } to the JWT claims.
-- ============================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims   jsonb;
  user_role text;
BEGIN
  -- Fetch the role from public.users
  SELECT role INTO user_role
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', 'null');
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to supabase_auth_admin so the hook can call it
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================================
-- 2. Helper function: get current user's role from JWT
--    Usage in RLS: public.current_user_role() = 'admin'
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated, anon;

-- ============================================================
-- 3. Drop old RLS policies and replace with JWT-based ones
-- ============================================================

-- ── users ────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── caregivers ───────────────────────────────────────────────
DROP POLICY IF EXISTS caregivers_select ON public.caregivers;
DROP POLICY IF EXISTS caregivers_update_own ON public.caregivers;
DROP POLICY IF EXISTS caregivers_admin_insert ON public.caregivers;
DROP POLICY IF EXISTS caregivers_admin_delete ON public.caregivers;

CREATE POLICY caregivers_select ON public.caregivers
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY caregivers_update_own ON public.caregivers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY caregivers_admin_insert ON public.caregivers
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY caregivers_admin_delete ON public.caregivers
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ── clients ──────────────────────────────────────────────────
DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_admin_insert ON public.clients;
DROP POLICY IF EXISTS clients_admin_update ON public.clients;
DROP POLICY IF EXISTS clients_admin_delete ON public.clients;

CREATE POLICY clients_select ON public.clients
  FOR SELECT
  USING (
    public.current_user_role() = 'admin'
    OR user_id = auth.uid()
    OR assigned_caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    OR id IN (
      SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid()
    )
  );

CREATE POLICY clients_admin_insert ON public.clients
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY clients_admin_update ON public.clients
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY clients_admin_delete ON public.clients
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ── schedules ────────────────────────────────────────────────
DROP POLICY IF EXISTS schedules_select ON public.schedules;
DROP POLICY IF EXISTS schedules_admin_insert ON public.schedules;
DROP POLICY IF EXISTS schedules_admin_update ON public.schedules;
DROP POLICY IF EXISTS schedules_admin_delete ON public.schedules;

CREATE POLICY schedules_select ON public.schedules
  FOR SELECT
  USING (
    public.current_user_role() = 'admin'
    OR caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY schedules_admin_insert ON public.schedules
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY schedules_admin_update ON public.schedules
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY schedules_admin_delete ON public.schedules
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ── reports ──────────────────────────────────────────────────
DROP POLICY IF EXISTS reports_select ON public.reports;
DROP POLICY IF EXISTS reports_caregiver_insert ON public.reports;
DROP POLICY IF EXISTS reports_admin_update ON public.reports;
DROP POLICY IF EXISTS reports_admin_delete ON public.reports;

CREATE POLICY reports_select ON public.reports
  FOR SELECT
  USING (
    public.current_user_role() = 'admin'
    OR caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    OR client_id IN (
      SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid()
    )
  );

CREATE POLICY reports_caregiver_insert ON public.reports
  FOR INSERT
  WITH CHECK (
    caregiver_id IN (
      SELECT id FROM public.caregivers WHERE user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY reports_admin_update ON public.reports
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY reports_admin_delete ON public.reports
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ── messages ─────────────────────────────────────────────────
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY messages_select ON public.messages
  FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY messages_insert ON public.messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- ── audit_logs ───────────────────────────────────────────────
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT
  USING (public.current_user_role() = 'admin');

-- ── family_links ─────────────────────────────────────────────
DROP POLICY IF EXISTS family_links_select ON public.family_links;
DROP POLICY IF EXISTS family_links_admin_insert ON public.family_links;
DROP POLICY IF EXISTS family_links_admin_update ON public.family_links;
DROP POLICY IF EXISTS family_links_admin_delete ON public.family_links;

CREATE POLICY family_links_select ON public.family_links
  FOR SELECT
  USING (
    family_member_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY family_links_admin_insert ON public.family_links
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY family_links_admin_update ON public.family_links
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY family_links_admin_delete ON public.family_links
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ── health_info_history ──────────────────────────────────────
DROP POLICY IF EXISTS health_info_history_select ON public.health_info_history;
DROP POLICY IF EXISTS health_info_history_insert ON public.health_info_history;
DROP POLICY IF EXISTS health_info_history_admin_delete ON public.health_info_history;

CREATE POLICY health_info_history_select ON public.health_info_history
  FOR SELECT
  USING (
    public.current_user_role() = 'admin'
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR client_id IN (
      SELECT id FROM public.clients
      WHERE assigned_caregiver_id IN (
        SELECT id FROM public.caregivers WHERE user_id = auth.uid()
      )
    )
    OR client_id IN (
      SELECT client_id FROM public.family_links WHERE family_member_id = auth.uid()
    )
  );

CREATE POLICY health_info_history_insert ON public.health_info_history
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR client_id IN (
      SELECT id FROM public.clients
      WHERE assigned_caregiver_id IN (
        SELECT id FROM public.caregivers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY health_info_history_admin_delete ON public.health_info_history
  FOR DELETE
  USING (public.current_user_role() = 'admin');
