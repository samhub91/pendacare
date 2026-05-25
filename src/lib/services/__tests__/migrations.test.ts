import * as fs from 'fs'
import * as path from 'path'

describe('Database Migration Verifications', () => {
  const migrationsDir = path.join(__dirname, '../../../../supabase/migrations')

  test('Migration 009 should define tr_escalate_incidents trigger', () => {
    const migrationFile = path.join(migrationsDir, '20250101000009_enterprise_care_features.sql')
    expect(fs.existsSync(migrationFile)).toBe(true)

    const content = fs.readFileSync(migrationFile, 'utf8')

    // Verify critical SQL components for escalation trigger
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.escalate_severity_incidents()')
    expect(content).toContain('CREATE TRIGGER tr_escalate_incidents')
    expect(content).toContain('BEFORE INSERT OR UPDATE OF severity ON public.incidents')
    expect(content).toContain('EXECUTE FUNCTION public.escalate_severity_incidents()')
    expect(content).toContain('NEW.escalated := TRUE')
    expect(content).toContain('NEW.escalated_at := NOW()')
  })

  test('Migration 010 should define db-level audit triggers on sensitive tables', () => {
    const migrationFile = path.join(migrationsDir, '20250101000010_db_level_audit_triggers.sql')
    expect(fs.existsSync(migrationFile)).toBe(true)

    const content = fs.readFileSync(migrationFile, 'utf8')

    // Verify the auditing function
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()')
    expect(content).toContain('INSERT INTO public.audit_logs (actor_id, action, resource, resource_id, metadata)')

    // Verify clients audit trigger
    expect(content).toContain('CREATE OR REPLACE TRIGGER tr_audit_clients')
    expect(content).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.clients')
    expect(content).toContain('EXECUTE FUNCTION public.audit_sensitive_changes()')

    // Verify health info history audit trigger
    expect(content).toContain('CREATE OR REPLACE TRIGGER tr_audit_health_info_history')
    expect(content).toContain('AFTER INSERT OR DELETE ON public.health_info_history')

    // Verify incidents audit trigger
    expect(content).toContain('CREATE OR REPLACE TRIGGER tr_audit_incidents')
    expect(content).toContain('AFTER INSERT OR UPDATE ON public.incidents')
  })

  test('Migration 011 should define landing_leads table, RLS, and audit trigger', () => {
    const migrationFile = path.join(migrationsDir, '20250101000011_landing_page_leads.sql')
    expect(fs.existsSync(migrationFile)).toBe(true)

    const content = fs.readFileSync(migrationFile, 'utf8')

    // Verify table structure
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.landing_leads')
    expect(content).toContain('care_type   TEXT NOT NULL CHECK (care_type IN (\'elderly\', \'disability\', \'childcare\', \'other\'))')
    expect(content).toContain('status      TEXT NOT NULL DEFAULT \'pending\' CHECK (status IN (\'pending\', \'contacted\', \'archived\'))')

    // Verify RLS policies
    expect(content).toContain('ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY')
    expect(content).toContain('CREATE POLICY landing_leads_insert ON public.landing_leads')
    expect(content).toContain('CREATE POLICY landing_leads_admin ON public.landing_leads')

    // Verify audit trigger
    expect(content).toContain('CREATE TRIGGER tr_audit_landing_leads')
    expect(content).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.landing_leads')
    expect(content).toContain('EXECUTE FUNCTION public.audit_sensitive_changes()')
  })
})
