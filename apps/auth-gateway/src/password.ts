import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 32

/** Create a versioned scrypt password hash suitable for DSH_AUTH_PASSWORD_HASH. */
export function hashPassword(password: string, salt = randomBytes(16)): string {
  if (password.length === 0) throw new Error('password must not be empty')
  const digest = scryptSync(password, salt, KEY_LENGTH)
  return `scrypt-v1$${salt.toString('base64url')}$${digest.toString('base64url')}`
}

/** Verify a password without returning early on digest bytes. */
export function verifyPassword(password: string, encoded: string): boolean {
  const [version, saltText, digestText, extra] = encoded.split('$')
  if (version !== 'scrypt-v1' || saltText === undefined || digestText === undefined || extra !== undefined) {
    return false
  }
  try {
    const salt = Buffer.from(saltText, 'base64url')
    const expected = Buffer.from(digestText, 'base64url')
    if (salt.length < 16 || expected.length !== KEY_LENGTH) return false
    const actual = scryptSync(password, salt, expected.length)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
