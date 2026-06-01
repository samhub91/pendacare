#!/usr/bin/env node
/**
 * Apply custom SMTP settings to Supabase Auth via the Management API.
 * Reads pendacare/.env.local — see .env.local.example (SMTP section).
 *
 * Usage: npm run smtp:configure
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env.local')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(envPath)

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing ${name} in .env.local`)
    process.exit(1)
  }
  return v
}

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (m) return m[1]
  console.error('Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

function appSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pendacare-fawn.vercel.app').replace(
    /\/+$/,
    ''
  )
}

async function main() {
  const token = requireEnv('SUPABASE_ACCESS_TOKEN')
  const ref = projectRef()
  const siteUrl = appSiteUrl()

  const body = {
    external_email_enabled: true,
    site_url: siteUrl,
    uri_allow_list: [
      'http://localhost:3000/auth/callback',
      'http://localhost:3000/reset-password',
      `${siteUrl}/auth/callback`,
      `${siteUrl}/reset-password`,
    ].join(','),
    mailer_templates_recovery_content:
      '<h2>Reset your password</h2>\n\n' +
      '<p>We received a request to reset your password. Follow the link below to choose a new one.</p>\n' +
      '<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>\n\n' +
      "<p>If you didn't request this, you can safely ignore this email.</p>",
    smtp_admin_email: requireEnv('SMTP_ADMIN_EMAIL'),
    smtp_sender_name: process.env.SMTP_SENDER_NAME ?? 'Pendacare',
    smtp_host: requireEnv('SMTP_HOST'),
    smtp_port: Number(process.env.SMTP_PORT ?? '465'),
    smtp_user: requireEnv('SMTP_USER'),
    smtp_pass: requireEnv('SMTP_PASS'),
  }

  if (process.env.SMTP_MAX_FREQUENCY) {
    body.smtp_max_frequency = Number(process.env.SMTP_MAX_FREQUENCY)
  }
  if (process.env.RATE_LIMIT_EMAIL_SENT) {
    body.rate_limit_email_sent = Number(process.env.RATE_LIMIT_EMAIL_SENT)
  }

  console.log(`Configuring SMTP for project ${ref}…`)
  console.log(`  Host: ${body.smtp_host}:${body.smtp_port}`)
  console.log(`  From: ${body.smtp_sender_name} <${body.smtp_admin_email}>`)
  console.log(`  Site URL: ${body.site_url}`)
  console.log(`  Redirects: ${body.uri_allow_list}`)

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    console.error('Failed to configure SMTP:', res.status, json)
    process.exit(1)
  }

  console.log('Custom SMTP enabled successfully.')
  console.log('Password reset template now uses RedirectTo + token_hash.')
  console.log(
    'Next: raise limits at https://supabase.com/dashboard/project/' +
      ref +
      '/auth/rate-limits'
  )
  console.log('Then test forgot-password on your app.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
