#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const email = process.argv[2]
const password = process.argv[3]
if (!email || !password) {
  console.error('Usage: node scripts/set-user-password.mjs <email> <password>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!authUser) {
  console.error('Auth user not found:', email)
  process.exit(1)
}

const { error } = await supabase.auth.admin.updateUserById(authUser.id, { password })
if (error) {
  console.error('Failed:', error.message)
  process.exit(1)
}
console.log('Password updated for', email)
