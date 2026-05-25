-- Migration 010: Database-Level Automated Audit Triggers
-- Hardens compliance with international and Australian healthcare/privacy standards (APPs, Privacy Act 1988)

-- 1. Create a general database-level audit logging trigger function
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor_id UUID;
  rec_id UUID;
  meta JSONB;
BEGIN
  -- Determine current authenticated user id (if null, it falls back to empty/system)
  actor_id := auth.uid();
  
  -- Record the operation details and old/new states
  IF TG_OP = 'DELETE' THEN
    rec_id := OLD.id;
    meta := jsonb_build_object(
      'action_type', TG_OP,
      'deleted_values', to_jsonb(OLD)
    );
  ELSE
    rec_id := NEW.id;
    meta := jsonb_build_object(
      'action_type', TG_OP,
      'old_values', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      'new_values', to_jsonb(NEW)
    );
  END IF;

  -- Insert automated audit log entry
  INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, metadata)
  VALUES (
    actor_id,
    'db.' || lower(TG_OP),
    lower(TG_TABLE_NAME),
    rec_id,
    meta
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 2. Bind automatic audit triggers to high-security tables
-- Audit all client records additions, details modifications, or removals
CREATE OR REPLACE TRIGGER tr_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes();

-- Audit insertions or deletions on client health information history
CREATE OR REPLACE TRIGGER tr_audit_health_info_history
  AFTER INSERT OR DELETE ON public.health_info_history
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes();

-- Audit all clinical incidents logged or updated
CREATE OR REPLACE TRIGGER tr_audit_incidents
  AFTER INSERT OR UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes();
