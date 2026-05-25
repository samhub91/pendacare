// AES-256-GCM encryption/decryption utilities
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { HealthInfo } from '@/lib/types'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV recommended for GCM

/**
 * Returns the AES-256 key as a Buffer from a base64-encoded string.
 * Throws a descriptive error if the key is not exactly 32 bytes.
 */
function resolveKey(key: string): Buffer {
  const keyBuf = Buffer.from(key, 'base64')
  if (keyBuf.length !== 32) {
    throw new Error(
      `Invalid ENCRYPTION_KEY length: expected 32 bytes, got ${keyBuf.length}. ` +
      'Generate a valid key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    )
  }
  return keyBuf
}

/**
 * Encrypts a HealthInfo object using AES-256-GCM.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 * Does NOT mutate the input.
 * Requirements: 6.1, 6.5
 */
export function encryptHealthInfo(data: HealthInfo, key: string): string {
  const keyBuf = resolveKey(key)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv)

  const plaintext = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: base64(iv):base64(authTag):base64(ciphertext)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a ciphertext string produced by encryptHealthInfo.
 * Returns the original HealthInfo object.
 * Throws if the ciphertext is tampered or the key is wrong.
 * Requirements: 6.6
 */
export function decryptHealthInfo(ciphertext: string, key: string): HealthInfo {
  const keyBuf = resolveKey(key)
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:ciphertext')
  }

  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encryptedData = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, keyBuf, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as HealthInfo
}

/**
 * Encrypts a message string using AES-256-GCM.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 * Rejects empty content.
 * Requirements: 6.2, 7.7
 */
export function encryptMessage(content: string, key: string): string {
  if (!content || content.trim().length === 0) {
    throw new Error('Message content must not be empty')
  }

  const keyBuf = resolveKey(key)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv)

  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a message ciphertext produced by encryptMessage.
 * Returns the original plaintext string.
 * Throws if the ciphertext is tampered or the key is wrong.
 * Requirements: 6.6
 */
export function decryptMessage(ciphertext: string, key: string): string {
  const keyBuf = resolveKey(key)
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:ciphertext')
  }

  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encryptedData = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, keyBuf, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
  return decrypted.toString('utf8')
}
