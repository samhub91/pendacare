-- Family link requests (family signup → admin approves → family_links row)

CREATE TABLE IF NOT EXISTS public.family_link_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_email      TEXT NOT NULL,
  recipient_name    TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_link_requests_status
  ON public.family_link_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_link_requests_pending_unique
  ON public.family_link_requests (family_member_id, client_email)
  WHERE status = 'pending';

ALTER TABLE public.family_link_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_link_requests_select_own_or_admin
  ON public.family_link_requests
  FOR SELECT
  USING (
    family_member_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY family_link_requests_insert_own_pending
  ON public.family_link_requests
  FOR INSERT
  WITH CHECK (
    family_member_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY family_link_requests_update_admin
  ON public.family_link_requests
  FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
