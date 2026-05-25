-- Expose landing lead submissions to Supabase Data API insert callers.
-- RLS still limits anonymous/authenticated users to INSERT only via
-- landing_leads_insert; admins manage records through the existing policy.

GRANT INSERT ON TABLE public.landing_leads TO anon, authenticated;
