import { request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig, type AuthConfig } from '../src/config.ts'
import { hashPassword, verifyPassword } from '../src/password.ts'
import { SessionStore } from '../src/session.ts'
import { createAuthServer } from '../src/server.ts'

interface ResponseData {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

const config: AuthConfig = {
  host: '127.0.0.1',
  port: 0,
  publicOrigin: 'https://dsh.example.test',
  username: 'operator',
  passwordHash: hashPassword('correct horse battery staple', Buffer.alloc(16, 7)),
  sessionSecret: 'test-session-secret-that-is-longer-than-32-bytes',
  sessionTtlSeconds: 3600,
  maxSessions: 100,
  loginWindowSeconds: 900,
  loginMaxFailures: 2,
  loginMaxBuckets: 100,
  secureCookie: true,
}

describe('password hashing', () => {
  it('accepts the correct password and rejects malformed or incorrect hashes', () => {
    const encoded = hashPassword('a strong password', Buffer.alloc(16, 4))
    expect(verifyPassword('a strong password', encoded)).toBe(true)
    expect(verifyPassword('wrong password', encoded)).toBe(false)
    expect(verifyPassword('a strong password', 'bad')).toBe(false)
    expect(() => hashPassword('')).toThrow('password must not be empty')
  })
})

describe('configuration', () => {
  const validEnv = {
    DSH_AUTH_PUBLIC_ORIGIN: 'https://dsh.example.test',
    DSH_AUTH_USERNAME: 'operator',
    DSH_AUTH_PASSWORD_HASH: 'scrypt-v1$example$example',
    DSH_AUTH_SESSION_SECRET: 'x'.repeat(32),
  }

  it('loads secure loopback defaults and rejects unsafe deployment values', () => {
    expect(loadConfig(validEnv)).toMatchObject({ host: '127.0.0.1', port: 3081, secureCookie: true })
    expect(() => loadConfig({ ...validEnv, DSH_AUTH_HOST: '0.0.0.0' })).toThrow('must be 127.0.0.1')
    expect(() => loadConfig({ ...validEnv, DSH_AUTH_PUBLIC_ORIGIN: 'http://dsh.example.test' }))
      .toThrow('secure cookies require an https')
    expect(() => loadConfig({ ...validEnv, DSH_AUTH_SESSION_SECRET: 'short' })).toThrow('at least 32 bytes')
  })
})

describe('session tokens', () => {
  it('tracks, validates, expires, and revokes sessions', () => {
    let now = 1_000_000
    const sessions = new SessionStore('x'.repeat(32), 'https://dsh.example.test', 60, 100, () => now)
    const token = sessions.create('operator')
    expect(sessions.verify(token)).toBe('operator')
    expect(sessions.verify(`${token}x`)).toBeUndefined()
    sessions.revoke(token)
    expect(sessions.verify(token)).toBeUndefined()

    const expiring = sessions.create('operator')
    now += 61_000
    expect(sessions.verify(expiring)).toBeUndefined()
  })

  it('bounds active sessions by evicting the oldest entry', () => {
    const sessions = new SessionStore('x'.repeat(32), 'https://dsh.example.test', 60, 2)
    const oldest = sessions.create('operator')
    const current = sessions.create('operator')
    const newest = sessions.create('operator')
    expect(sessions.verify(oldest)).toBeUndefined()
    expect(sessions.verify(current)).toBe('operator')
    expect(sessions.verify(newest)).toBe('operator')
  })
})

describe('HTTP authentication service', () => {
  let server: ReturnType<typeof createAuthServer>
  let port: number

  beforeEach(async () => {
    server = createAuthServer(config)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    }))
  })

  function call(path: string, options: {
    method?: string
    headers?: Record<string, string>
    body?: string
  } = {}): Promise<ResponseData> {
    return new Promise((resolve, reject) => {
      const req = request({
        host: '127.0.0.1',
        port,
        path,
        method: options.method ?? 'GET',
        headers: options.headers,
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (value: unknown) => {
          if (Buffer.isBuffer(value)) chunks.push(Buffer.from(value))
          else if (typeof value === 'string') chunks.push(Buffer.from(value))
          else reject(new Error('response produced an unsupported chunk'))
        })
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      })
      req.on('error', reject)
      if (options.body !== undefined) req.end(options.body)
      else req.end()
    })
  }

  function loginHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Host: 'dsh.example.test',
      Origin: config.publicOrigin,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...extra,
    }
  }

  async function login(): Promise<string> {
    const response = await call('/login', {
      method: 'POST',
      headers: loginHeaders(),
      body: 'username=operator&password=correct+horse+battery+staple&returnTo=%2Fsettings',
    })
    expect(response.status).toBe(303)
    expect(response.headers.location).toBe('/settings')
    const setCookie = response.headers['set-cookie']?.[0]
    expect(setCookie).toContain('__Host-dsh_session=')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Secure')
    return setCookie?.split(';', 1)[0] ?? ''
  }

  it('renders login and logout pages with no-store security headers', async () => {
    const loginResponse = await call('/login?returnTo=%2Fworkspace')
    expect(loginResponse.status).toBe(200)
    expect(loginResponse.body).toContain('<h1 class="title">登录</h1>')
    expect(loginResponse.headers['cache-control']).toBe('no-store')
    expect(loginResponse.headers['content-security-policy']).toContain("frame-ancestors 'none'")

    const cookie = await login()
    const logoutResponse = await call('/logout', { headers: { Cookie: cookie } })
    expect(logoutResponse.status).toBe(200)
    expect(logoutResponse.body).toContain('确认退出')
  })

  it('rejects cross-site login and returns a generic error for bad credentials', async () => {
    const crossSite = await call('/login', {
      method: 'POST',
      headers: loginHeaders({ Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }),
      body: 'username=operator&password=wrong',
    })
    expect(crossSite.status).toBe(403)

    const failed = await call('/login', {
      method: 'POST',
      headers: loginHeaders(),
      body: 'username=operator&password=wrong',
    })
    expect(failed.status).toBe(303)
    expect(failed.headers.location).toContain('/login?failed=1')
  })

  it('rejects backslash and cross-origin return targets', async () => {
    const page = await call('/login?returnTo=%2F%5Cevil.example%2Fx')
    expect(page.body).toContain('name="returnTo" value="/"')
    const cookie = await login()
    const redirect = await call('/login?returnTo=%2F%5Cevil.example%2Fx', { headers: { Cookie: cookie } })
    expect(redirect.headers.location).toBe('/')
  })

  it('rate limits repeated failed logins by client and username', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await call('/login', {
        method: 'POST',
        headers: loginHeaders({ 'X-Real-IP': '203.0.113.7' }),
        body: 'username=operator&password=wrong',
      })
      expect(response.status).toBe(303)
    }
    const limited = await call('/login', {
      method: 'POST',
      headers: loginHeaders({ 'X-Real-IP': '203.0.113.7' }),
      body: 'username=operator&password=correct+horse+battery+staple',
    })
    expect(limited.status).toBe(429)
    expect(limited.headers['retry-after']).toBe('900')
  })

  it('rate limits by IP when an attacker rotates usernames', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await call('/login', {
        method: 'POST',
        headers: loginHeaders({ 'X-Real-IP': '203.0.113.8' }),
        body: `username=attacker-${attempt}&password=wrong`,
      })
      expect(response.status).toBe(303)
    }
    const limited = await call('/login', {
      method: 'POST',
      headers: loginHeaders({ 'X-Real-IP': '203.0.113.8' }),
      body: 'username=operator&password=correct+horse+battery+staple',
    })
    expect(limited.status).toBe(429)
  })

  it('authorizes same-origin Nginx subrequests and rejects missing, evil, or revoked sessions', async () => {
    const authHeaders = {
      'X-Original-Host': 'dsh.example.test',
      'X-Original-Method': 'POST',
      'X-Original-Origin': config.publicOrigin,
      'X-Original-Sec-Fetch-Site': 'same-origin',
    }
    expect((await call('/auth/check', { headers: authHeaders })).status).toBe(401)
    const cookie = await login()
    const accepted = await call('/auth/check', { headers: { ...authHeaders, Cookie: cookie } })
    expect(accepted.status).toBe(204)
    expect(accepted.headers['x-authenticated-user']).toBe('operator')

    const evil = await call('/auth/check', {
      headers: { ...authHeaders, Cookie: cookie, 'X-Original-Origin': 'https://evil.example' },
    })
    expect(evil.status).toBe(403)

    const logout = await call('/logout', {
      method: 'POST',
      headers: { ...loginHeaders(), Cookie: cookie },
      body: '',
    })
    expect(logout.status).toBe(303)
    expect(logout.headers['set-cookie']?.[0]).toContain('Max-Age=0')
    expect((await call('/auth/check', { headers: { ...authHeaders, Cookie: cookie } })).status).toBe(401)
  })

  it('permits safe navigation without Origin but rejects unsafe requests without Origin', async () => {
    const cookie = await login()
    const base = {
      Cookie: cookie,
      'X-Original-Host': 'dsh.example.test',
      'X-Original-Sec-Fetch-Site': 'same-origin',
    }
    expect((await call('/auth/check', { headers: { ...base, 'X-Original-Method': 'GET' } })).status).toBe(204)
    expect((await call('/auth/check', { headers: { ...base, 'X-Original-Method': 'POST' } })).status).toBe(403)
  })
})
