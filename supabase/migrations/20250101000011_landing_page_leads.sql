-- Migration: Create Landing Page Leads Inquiries Table and Triggers
-- Requirements: Handles prospective NDIS/caregiving inquiries securely

-- 1. Create landing_leads table
CREATE TABLE IF NOT EXISTS public.landing_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  care_type   TEXT NOT NULL CHECK (care_type IN ('elderly', 'disability', 'childcare', 'other')),
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching and filtering leads by status and care type
CREATE INDEX IF NOT EXISTS idx_landing_leads_status    ON public.landing_leads(status);
CREATE INDEX IF NOT EXISTS idx_landing_leads_care_type ON public.landing_leads(care_type);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- 2. Define RLS Policies
-- Anyone can insert leads (so prospective clients can submit the contact form anonymously)
CREATE POLICY landing_leads_insert ON public.landing_leads
  FOR INSERT
  WITH CHECK (true);

-- Only admins can select, update, or delete lead submissions
CREATE POLICY landing_leads_admin ON public.landing_leads
  FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- 3. Bind automated database-level audit logging trigger
CREATE TRIGGER tr_audit_landing_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes();
