# Landing Page and Leads Implementation

## Overview

The public root route now serves a Pendacare landing page for prospective clients, families, and providers. Signed-in users remain supported through a dashboard call to action rather than an automatic redirect.

## Lead Submission Contract

`POST /api/leads` accepts JSON:

```json
{
  "name": "Avery Johnson",
  "email": "avery@example.com",
  "phone": "+61 400 000 000",
  "care_type": "disability",
  "message": "We are looking for weekday support."
}
```

Allowed `care_type` values are `elderly`, `disability`, `childcare`, and `other`. The `other` value is only for public landing inquiries and does not change the registered client `CareType` union.

## Database

The endpoint inserts into `public.landing_leads`, created by `supabase/migrations/20250101000011_landing_page_leads.sql`. The table has RLS enabled, anonymous insert access, and admin-scoped management policies.

`supabase/migrations/20260523184248_grant_landing_leads_api_access.sql` grants `INSERT` on `landing_leads` to `anon` and `authenticated` so PostgREST can expose the insert path while RLS continues to block reads and management actions.

## Verification

Use these checks after changes:

```bash
npm test -- --runInBand
npm run type-check
npm run lint
npm run dev
```

Manually verify `/`, `/privacy`, `/terms`, the budget estimator, lead form success and error states, and responsive layout.

Remote Supabase smoke test performed after the grant migration:

- Anonymous insert into `landing_leads`: passed.
- Service-role cleanup of the temporary smoke-test row: passed.
