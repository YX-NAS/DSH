import { URL } from 'node:url'

/** Runtime settings read from environment variables. */
export interface AuthConfig {
  host: string
  port: number
  publicOrigin: string
  username: string
  passwordHash: string
  sessionSecret: string
  sessionTtlSeconds: number
  maxSessions: number
  loginWindowSeconds: number
  loginMaxFailures: number
  loginMaxBuckets: number
  secureCookie: boolean
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (value === undefined || value === '') throw new Error(`${name} is required`)
  return value
}

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

/** Parse and validate auth service environment variables. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const publicOrigin = new URL(required(env, 'DSH_AUTH_PUBLIC_ORIGIN'))
  if (publicOrigin.pathname !== '/' || publicOrigin.search !== '' || publicOrigin.hash !== '') {
    throw new Error('DSH_AUTH_PUBLIC_ORIGIN must contain only scheme and authority')
  }
  const sessionSecret = required(env, 'DSH_AUTH_SESSION_SECRET')
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('DSH_AUTH_SESSION_SECRET must be at least 32 bytes')
  }
  const secureCookie = env.DSH_AUTH_SECURE_COOKIE !== 'false'
  if (secureCookie && publicOrigin.protocol !== 'https:') {
    throw new Error('secure cookies require an https DSH_AUTH_PUBLIC_ORIGIN')
  }
  const host = env.DSH_AUTH_HOST?.trim() || '127.0.0.1'
  if (host !== '127.0.0.1') throw new Error('DSH_AUTH_HOST must be 127.0.0.1')
  const port = positiveInteger(env, 'DSH_AUTH_PORT', 3081)
  if (port > 65_535) throw new Error('DSH_AUTH_PORT must be at most 65535')
  return {
    host,
    port,
    publicOrigin: publicOrigin.origin,
    username: required(env, 'DSH_AUTH_USERNAME'),
    passwordHash: required(env, 'DSH_AUTH_PASSWORD_HASH'),
    sessionSecret,
    sessionTtlSeconds: positiveInteger(env, 'DSH_AUTH_SESSION_TTL_SECONDS', 43_200),
    maxSessions: positiveInteger(env, 'DSH_AUTH_MAX_SESSIONS', 1_000),
    loginWindowSeconds: positiveInteger(env, 'DSH_AUTH_LOGIN_WINDOW_SECONDS', 900),
    loginMaxFailures: positiveInteger(env, 'DSH_AUTH_LOGIN_MAX_FAILURES', 5),
    loginMaxBuckets: positiveInteger(env, 'DSH_AUTH_LOGIN_MAX_BUCKETS', 10_000),
    secureCookie,
  }
}
