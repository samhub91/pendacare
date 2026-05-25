#!/usr/bin/env node
/**
 * Create or promote an admin user (Auth + public.users).
 * Usage: node scripts/create-admin.mjs <email> <password> [displayName]
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

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

const email = process.argv[2]
const password = process.argv[3]
const name = process.argv[4] || 'Administrator'

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [displayName]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'admin', name })
      .eq('id', existingProfile.id)

    if (updateError) {
      console.error('Failed to promote existing user:', updateError.message)
      process.exit(1)
    }
    console.log(`Promoted existing user to admin: ${email} (${existingProfile.id})`)
    return
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    const already =
      authError.message?.includes('already been registered') ||
      authError.message?.includes('already registered')
    if (already) {
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const authUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      )
      if (!authUser) {
        console.error('User exists in Auth but could not be found:', authError.message)
        process.exit(1)
      }
      const { error: insertError } = await supabase.from('users').upsert({
        id: authUser.id,
        role: 'admin',
        name,
        email,
      })
      if (insertError) {
        console.error('Failed to create profile:', insertError.message)
        process.exit(1)
      }
      console.log(`Linked Auth user to admin profile: ${email} (${authUser.id})`)
      return
    }
    console.error('Auth create failed:', authError.message)
    process.exit(1)
  }

  if (!authData.user) {
    console.error('Auth create returned no user')
    process.exit(1)
  }

  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    role: 'admin',
    name,
    email,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.error('Profile insert failed (auth user rolled back):', profileError.message)
    process.exit(1)
  }

  console.log(`Admin created: ${email}`)
  console.log(`User id: ${authData.user.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
