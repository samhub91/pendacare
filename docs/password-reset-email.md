# Password reset email (fix PKCE / “code challenge” errors)

## Why you see “code challenge does not match code verifier”

Supabase uses **PKCE** for reset links. When someone clicks **Send reset link**, a secret (`code_verifier`) is stored in **that browser only**. The email link contains a `code` that must be paired with that same secret.

The link fails if:

- The email is opened in a **different browser** (e.g. Gmail app vs Chrome)
- Cookies were cleared between sending and clicking
- A **new** reset was requested after the email was sent (old links die)
- The link went through `/auth/callback` on the server without the browser’s verifier cookie

Pendacare now redirects reset links to **`/reset-password`** in the browser (not `/auth/callback`).

If no reset email arrives at all, first check that the Supabase project is not paused. A paused project cannot send Auth emails.

## What users should do (quick fix)

1. On [Forgot password](http://localhost:3000/forgot-password), click **Send reset link**
2. Open the email and click the link **in the same browser** (same Chrome/Edge profile — not the phone mail app unless that’s the same browser you used)
3. Do not request multiple resets — use the **latest** email only

## Better fix: email template with `token_hash` (works across browsers)

This avoids PKCE for the click-from-email step.

1. Supabase → **Authentication** → **Emails** → **Reset password** (template)
2. Replace the reset link in the body with:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">
  Reset password
</a>
```

Or keep the default text but change the link URL to:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
```

`{{ .RedirectTo }}` is the `/reset-password` URL passed by `resetPasswordForEmail`.

3. Save the template
4. **Authentication** → **URL Configuration** — allow:
   - `http://localhost:3000/reset-password`
   - `https://pendacare-fawn.vercel.app/reset-password`
5. Request a **new** reset email and test

The app already calls `verifyOtp({ type: 'recovery', token_hash })` when those query params are present.

## Redirect URL in app

`getPasswordResetRedirectUrl()` returns:

```
http://localhost:3000/reset-password
```

In production it returns:

```
https://pendacare-fawn.vercel.app/reset-password
```

Set **Site URL** in Supabase to the production app URL and keep both local and production reset URLs in the redirect allow-list.
