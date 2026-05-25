#!/usr/bin/env node
/**
 * Seed random/mock operational data for seeded users (Connor Caregiver, Catherine Client, Fiona Family, Adeline Admin)
 * Usage: node scripts/seed-random-data.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'

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
const encKey = process.env.ENCRYPTION_KEY

if (!url || !serviceKey || !encKey) {
  console.error('Missing env configuration. Make sure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ENCRYPTION_KEY are defined in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// AES-256-GCM encryption helpers
function encryptText(content, key) {
  if (!content) return ''
  const keyBuf = Buffer.from(key, 'base64')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv)
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

async function getProfileByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()
  if (error) {
    console.error(`Error querying user ${email}:`, error.message)
  }
  return data
}

async function getCaregiverByUserId(userId) {
  const { data } = await supabase.from('caregivers').select('id').eq('user_id', userId).maybeSingle()
  return data?.id
}

async function getClientByUserId(userId) {
  const { data } = await supabase.from('clients').select('id').eq('user_id', userId).maybeSingle()
  return data?.id
}

async function main() {
  console.log('Querying seeded users...')

  const adminUser = await getProfileByEmail('admin@pendacare.com.au')
  const caregiverUser = await getProfileByEmail('caregiver@pendacare.com.au')
  const clientUser = await getProfileByEmail('client@pendacare.com.au')
  const familyUser = await getProfileByEmail('family@pendacare.com.au')

  if (!adminUser || !caregiverUser || !clientUser || !familyUser) {
    console.error('Seeded users not found in users table. Run seed-users.mjs first!')
    process.exit(1)
  }

  const caregiverId = await getCaregiverByUserId(caregiverUser.id)
  const clientId = await getClientByUserId(clientUser.id)

  if (!caregiverId || !clientId) {
    console.error('Caregiver or Client records not found in their respective tables.')
    process.exit(1)
  }

  // Update client to be assigned to this caregiver and set address coordinates
  console.log('Updating client assignment & coordinates...')
  const { error: clientUpdateErr } = await supabase
    .from('clients')
    .update({
      assigned_caregiver_id: caregiverId,
      latitude: -33.8688,
      longitude: 151.2093,
      formatted_address: '100 George St, Sydney NSW 2000, Australia',
    })
    .eq('id', clientId)

  if (clientUpdateErr) {
    console.error('Failed to update client details:', clientUpdateErr.message)
  }

  // Clear existing operational records to start fresh
  console.log('Cleaning up existing logs for Catherine Client...')
  await supabase.from('incidents').delete().eq('client_id', clientId)
  await supabase.from('medication_logs').delete().eq('caregiver_id', caregiverId)
  await supabase.from('reports').delete().eq('client_id', clientId)
  await supabase.from('schedules').delete().eq('client_id', clientId)
  await supabase.from('messages').delete().or(`sender_id.eq.${caregiverUser.id},receiver_id.eq.${caregiverUser.id}`)

  // Create Schedules
  console.log('Creating schedules (Yesterday, Today, Tomorrow)...')
  const todayDate = new Date().toISOString().split('T')[0]
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Yesterday schedule (Completed)
  const { data: schedYesterday, error: sErr1 } = await supabase
    .from('schedules')
    .insert({
      caregiver_id: caregiverId,
      client_id: clientId,
      date: yesterdayDate,
      time: '10:00:00',
      duration_minutes: 120,
      status: 'completed',
      notes: 'Standard morning mobility assistance and medication check-in.',
      created_by: adminUser.id,
      start_lat: -33.8687,
      start_lng: 151.2092,
      end_lat: -33.8689,
      end_lng: 151.2094,
      gps_verified: true,
    })
    .select()
    .single()

  if (sErr1) console.error('Failed to create yesterday schedule:', sErr1.message)

  // Today schedule (In Progress)
  const { data: schedToday, error: sErr2 } = await supabase
    .from('schedules')
    .insert({
      caregiver_id: caregiverId,
      client_id: clientId,
      date: todayDate,
      time: '14:30:00',
      duration_minutes: 90,
      status: 'in_progress',
      notes: 'Afternoon exercise and meal preparation support.',
      created_by: adminUser.id,
      start_lat: -33.8688,
      start_lng: 151.2093,
      gps_verified: true,
    })
    .select()
    .single()

  if (sErr2) console.error('Failed to create today schedule:', sErr2.message)

  // Tomorrow schedule (Confirmed/Scheduled)
  const { data: schedTomorrow, error: sErr3 } = await supabase
    .from('schedules')
    .insert({
      caregiver_id: caregiverId,
      client_id: clientId,
      date: tomorrowDate,
      time: '09:00:00',
      duration_minutes: 180,
      status: 'confirmed',
      notes: 'Escort to doctor appointment and shopping assistance.',
      created_by: adminUser.id,
    })
    .select()
    .single()

  if (sErr3) console.error('Failed to create tomorrow schedule:', sErr3.message)

  // Create medication logs for Yesterday
  if (schedYesterday) {
    console.log('Seeding medication logs for yesterday...')
    const { error: medLogsErr1 } = await supabase.from('medication_logs').insert([
      {
        schedule_id: schedYesterday.id,
        medication_name: 'Atorvastatin (Lipitor)',
        dosage: '20mg',
        scheduled_time: '10:30:00',
        administered_at: `${yesterdayDate}T10:32:00Z`,
        status: 'administered',
        caregiver_id: caregiverId,
        notes: 'Administered with water. No side effects observed.',
      },
      {
        schedule_id: schedYesterday.id,
        medication_name: 'Metformin',
        dosage: '500mg',
        scheduled_time: '11:00:00',
        administered_at: `${yesterdayDate}T11:05:00Z`,
        status: 'administered',
        caregiver_id: caregiverId,
        notes: 'Taken after breakfast.',
      }
    ])
    if (medLogsErr1) console.error('Failed to create yesterday med logs:', medLogsErr1.message)
  }

  // Create medication logs for Today
  if (schedToday) {
    console.log('Seeding medication logs for today...')
    const { error: medLogsErr2 } = await supabase.from('medication_logs').insert([
      {
        schedule_id: schedToday.id,
        medication_name: 'Aricept (Donepezil)',
        dosage: '10mg',
        scheduled_time: '15:00:00',
        administered_at: `${todayDate}T15:02:00Z`,
        status: 'administered',
        caregiver_id: caregiverId,
        notes: 'Routine memory support medication administered with lunch.',
      }
    ])
    if (medLogsErr2) console.error('Failed to create today med logs:', medLogsErr2.message)
  }

  // Create Caregiver Shift Report for Yesterday
  if (schedYesterday) {
    console.log('Seeding caregiver shift report...')
    const { error: reportErr } = await supabase.from('reports').insert({
      caregiver_id: caregiverId,
      client_id: clientId,
      schedule_id: schedYesterday.id,
      notes: 'Completed the 2-hour morning shift. Prompts given for light exercise. Checked blood pressure (125/80), which is normal. Prepared a healthy soup for lunch. Catherine was in pleasant spirits.',
      hours_worked: 2.00,
      feedback: 'Thank you Connor, Catherine mentioned she had a great day!',
      locked_at: `${yesterdayDate}T13:00:00Z`,
    })
    if (reportErr) console.error('Failed to create shift report:', reportErr.message)
  }

  // Create Incidents
  if (schedToday) {
    console.log('Seeding incident escalation record...')
    // Seed a HIGH severity incident to trigger the audit triggers and the notification trigger
    const { error: incidentErr } = await supabase.from('incidents').insert({
      client_id: clientId,
      caregiver_id: caregiverId,
      schedule_id: schedToday.id,
      title: 'Minor kitchen slip (no injury)',
      description: 'Catherine slipped slightly near the sink area due to a drop of water on the tile. The wall grab bar was used and I supported her balance immediately. No physical impact occurred. Catherine is calm and resting in the living room chair. Inspected left knee and arm, no bruises. Contacted family.',
      severity: 'high', // This should fire the db trigger to set escalated = true and add admin notification
      status: 'open',
    })

    if (incidentErr) console.log('Failed to create incident log:', incidentErr.message)
  }

  // Seed Encrypted Messages
  console.log('Seeding secure encrypted messages...')
  const messages = [
    {
      sender: caregiverUser,
      receiver: familyUser,
      text: 'Hello Fiona, I checked in with Catherine. She is feeling well today, and we completed the morning mobility routine.',
    },
    {
      sender: familyUser,
      receiver: caregiverUser,
      text: 'Thanks Connor! Please make sure she takes her memory medication at 3 PM.',
    },
    {
      sender: caregiverUser,
      receiver: familyUser,
      text: 'Understood. I just administered it and logged it in the MAR section.',
    },
    {
      sender: caregiverUser,
      receiver: adminUser,
      text: 'Hi Adeline, I had a slight check-in issue with the coordinates on George St but resolved it. The GPS location matched successfully.',
    },
    {
      sender: adminUser,
      receiver: caregiverUser,
      text: 'Thanks Connor, I see the verified GPS tag in your yesterday morning shift log. Looks great.',
    }
  ]

  for (const msg of messages) {
    const encryptedText = encryptText(msg.text, encKey)
    const { error: msgErr } = await supabase.from('messages').insert({
      sender_id: msg.sender.id,
      receiver_id: msg.receiver.id,
      content: encryptedText,
    })
    if (msgErr) console.error('Failed to insert message:', msgErr.message)
  }

  console.log('\n=======================================')
  console.log('Random operational data seeded successfully!')
  console.log('=======================================')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
