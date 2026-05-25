#!/usr/bin/env node
/**
 * Seed users for each role (admin, caregiver, client, family_member)
 * Usage: node scripts/seed-users.mjs
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const password = 'Password123!'
const usersToSeed = [
  {
    email: 'admin@pendacare.com.au',
    role: 'admin',
    name: 'Adeline Admin',
  },
  {
    email: 'caregiver@pendacare.com.au',
    role: 'caregiver',
    name: 'Connor Caregiver',
  },
  {
    email: 'client@pendacare.com.au',
    role: 'client',
    name: 'Catherine Client',
  },
  {
    email: 'family@pendacare.com.au',
    role: 'family_member',
    name: 'Fiona Family',
  },
]

async function seedUser(userData) {
  console.log(`Seeding user: ${userData.email} (${userData.role})...`)

  // Check if profile already exists in public.users
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', userData.email)
    .maybeSingle()

  let userId = existingProfile?.id

  if (!userId) {
    // Check if auth user exists
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === userData.email.toLowerCase()
    )

    if (authUser) {
      userId = authUser.id
      console.log(`User already exists in Auth, using ID: ${userId}`)
    } else {
      // Create user in Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: password,
        email_confirm: true,
      })

      if (authError) {
        console.error(`Auth creation failed for ${userData.email}:`, authError.message)
        return null
      }
      userId = authData.user.id
      console.log(`Created Auth user, ID: ${userId}`)
    }

    // Insert into public.users
    const { error: profileError } = await supabase.from('users').upsert({
      id: userId,
      role: userData.role,
      name: userData.name,
      email: userData.email,
    })

    if (profileError) {
      console.error(`Failed to insert/update profile for ${userData.email}:`, profileError.message)
      return null
    }
  } else {
    console.log(`Profile already exists with ID: ${userId}`)
  }

  // Handle role-specific profiles
  if (userData.role === 'caregiver') {
    const { data: existingCaregiver } = await supabase
      .from('caregivers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingCaregiver) {
      const { error: caregiverErr } = await supabase.from('caregivers').insert({
        user_id: userId,
        name: userData.name,
        qualifications: ['First Aid Certified', 'Certificate III in Individual Support'],
        availability: { monday: '9am-5pm', wednesday: '9am-5pm', friday: '9am-5pm' },
      })
      if (caregiverErr) {
        console.error(`Failed to seed caregiver details for ${userData.email}:`, caregiverErr.message)
      } else {
        console.log(`Caregiver record created.`)
      }
    }
  } else if (userData.role === 'client') {
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingClient) {
      const { error: clientErr } = await supabase.from('clients').insert({
        user_id: userId,
        name: userData.name,
        date_of_birth: '1945-05-15',
        care_type: 'elderly',
        health_info: { key_needs: 'Mobility support, light physiotherapy prompts' },
      })
      if (clientErr) {
        console.error(`Failed to seed client details for ${userData.email}:`, clientErr.message)
      } else {
        console.log(`Client record created.`)
      }
    }
  }

  return userId
}

async function main() {
  const ids = {}
  for (const user of usersToSeed) {
    const userId = await seedUser(user)
    if (userId) {
      ids[user.role] = userId
    }
  }

  // Establish family link if both client and family exist
  if (ids['client'] && ids['family_member']) {
    const { data: clientRecord } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', ids['client'])
      .maybeSingle()

    if (clientRecord) {
      const { data: existingLink } = await supabase
        .from('family_links')
        .select('id')
        .eq('family_member_id', ids['family_member'])
        .eq('client_id', clientRecord.id)
        .maybeSingle()

      if (!existingLink) {
        const { error: linkErr } = await supabase.from('family_links').insert({
          family_member_id: ids['family_member'],
          client_id: clientRecord.id,
        })
        if (linkErr) {
          console.error('Failed to link family member to client:', linkErr.message)
        } else {
          console.log(`Linked Fiona Family to Catherine Client profile.`)
        }
      }
    }
  }

  console.log('\n=======================================')
  console.log('Seeding completed successfully!')
  console.log('=======================================')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
