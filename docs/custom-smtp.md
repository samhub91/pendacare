# Custom SMTP for Pendacare (Supabase Auth)

Supabase sends password-reset, signup, and other auth emails. The **built-in** provider is rate-limited (~3 emails/hour) and only delivers to addresses on your Supabase **organization team**.

Custom SMTP fixes both: higher limits and emails to any user address.

Pendacare does **not** send auth mail from Next.js — configure SMTP in **Supabase only**. No app code changes are required after setup.

## Recommended: Resend

1. Create an account at [resend.com](https://resend.com).
2. Create an **API key** ([API Keys](https://resend.com/api-keys)).
3. **Sender address**
   - **Quick test:** use `onboarding@resend.dev` (Resend’s test sender; can only send to the email on your Resend account).
   - **Real use:** [verify a domain](https://resend.com/domains), then use e.g. `no-reply@yourdomain.com`.

### Resend SMTP values

| Field | Value |
|--------|--------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend **API key** |
| Sender email | e.g. `onboarding@resend.dev` or `no-reply@yourdomain.com` |
| Sender name | `Pendacare` |

## Option A — Supabase Dashboard (manual)

The dashboard does **not** show a top-level “SMTP” item. Use **Emails** instead:

1. In the left sidebar: **Authentication**
2. Click **Emails** (same section as Configuration, Rate Limits, etc.)
3. On that page, scroll to **SMTP Settings** (or **Custom SMTP**) and turn it **on**
4. Enter host, port, user, password, sender email, and sender name (table above)
5. **Save**

**Direct link** (opens the Emails / SMTP page):  
https://supabase.com/dashboard/project/ywtucabytahpgxznfcef/auth/smtp

If you only see email *templates* on the Emails page, scroll down — SMTP is below the templates.

6. Open [Authentication → Rate Limits](https://supabase.com/dashboard/project/ywtucabytahpgxznfcef/auth/rate-limits) and raise **Email sent** if needed (custom SMTP defaults to a higher cap, often 30/hour until you increase it).

## Option B — Script (from this repo)

1. Copy SMTP variables into `.env.local` (see `.env.local.example`).
2. Ensure `SUPABASE_ACCESS_TOKEN` is set ([account tokens](https://supabase.com/dashboard/account/tokens)).
3. Run:

```bash
npm run smtp:configure
```

## After SMTP is enabled

1. **Redirect URLs** (if not already set): [Authentication → URL Configuration](https://supabase.com/dashboard/project/ywtucabytahpgxznfcef/auth/url-configuration)
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - Your production URLs when you deploy
2. Test: [Forgot password](http://localhost:3000/forgot-password) → open the email link in the **same browser** you used to send it.  
   If you see a PKCE / “code challenge” error, see [password-reset-email.md](./password-reset-email.md).
3. Optional: customize templates under **Authentication → Email Templates**.

## Other providers

Any SMTP service works (SendGrid, Brevo, AWS SES, Postmark, etc.). Use their SMTP host, port, user, and password in the dashboard or script the same way.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Rate limit still appears | Wait for the old hourly window to pass; confirm custom SMTP is **saved** and a test shows “custom SMTP enabled” in the dashboard. |
| Email not received | Resend **Logs**; spam folder; test sender only sends to your Resend account email. |
| Reset link doesn’t work | Redirect URLs; open link in the same browser you used on forgot-password. |
