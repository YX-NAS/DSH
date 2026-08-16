import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { URLSearchParams } from 'node:url'
import type { AuthConfig } from './config.ts'
import { loginPage, logoutPage } from './html.ts'
import { verifyPassword } from './password.ts'
import { LoginRateLimiter } from './rate-limit.ts'
import { SessionStore } from './session.ts'

const COOKIE_NAME = '__Host-dsh_session'
const MAX_LOGIN_BODY_BYTES = 16 * 1024

function securityHeaders(res: ServerResponse): void {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
}

function cookieValue(req: IncomingMessage): string | undefined {
  const cookie = req.headers.cookie
  if (cookie === undefined) return undefined
  for (const field of cookie.split(';')) {
    const at = field.indexOf('=')
    if (at === -1) continue
    if (field.slice(0, at).trim() === COOKIE_NAME) return field.slice(at + 1).trim()
  }
  return undefined
}

function sessionCookie(token: string, config: AuthConfig): string {
  const secure = config.secureCookie ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${config.sessionTtlSeconds}${secure}`
}

function clearCookie(config: AuthConfig): string {
  const secure = config.secureCookie ? '; Secure' : ''
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
}

function safeReturnTo(value: string | null, config: AuthConfig): string {
  if (value === null || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')
    || /[\u0000-\u001F\u007F]/u.test(value)) return '/'
  const resolved = new URL(value, config.publicOrigin)
  if (resolved.origin !== config.publicOrigin || resolved.pathname === '/login'
    || resolved.pathname === '/logout') return '/'
  return `${resolved.pathname}${resolved.search}`
}

function clientAddress(req: IncomingMessage): string {
  const forwarded = req.headers['x-real-ip']
  return typeof forwarded === 'string' && forwarded.length <= 64
    ? forwarded
    : req.socket.remoteAddress ?? 'unknown'
}

function expectedAuthority(config: AuthConfig): string {
  return new URL(config.publicOrigin).host
}

function sameOriginRequest(req: IncomingMessage, config: AuthConfig): boolean {
  if (req.headers.host !== expectedAuthority(config)) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  return req.headers.origin === config.publicOrigin
}

function authSubrequestAllowed(req: IncomingMessage, config: AuthConfig): boolean {
  if (req.headers['x-original-host'] !== expectedAuthority(config)) return false
  const method = req.headers['x-original-method']
  const origin = req.headers['x-original-origin']
  const fetchSite = req.headers['x-original-sec-fetch-site']
  if (fetchSite === 'cross-site') return false
  if (method === 'GET' || method === 'HEAD') {
    return origin === undefined || origin === '' || origin === config.publicOrigin
  }
  return origin === config.publicOrigin
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams | undefined> {
  if (req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
    return undefined
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const value of req) {
    const chunk: unknown = value
    const buffer = Buffer.isBuffer(chunk)
      ? Buffer.from(chunk)
      : typeof chunk === 'string' ? Buffer.from(chunk) : undefined
    if (buffer === undefined) return undefined
    total += buffer.length
    if (total > MAX_LOGIN_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
}

/** Create the loopback authentication HTTP service used by Nginx auth_request. */
export function createAuthServer(config: AuthConfig): Server {
  const sessions = new SessionStore(
    config.sessionSecret, config.publicOrigin, config.sessionTtlSeconds, config.maxSessions,
  )
  const ipLimiter = new LoginRateLimiter(
    config.loginMaxFailures,
    config.loginWindowSeconds,
    config.loginMaxBuckets,
  )
  const identityLimiter = new LoginRateLimiter(
    config.loginMaxFailures,
    config.loginWindowSeconds,
    config.loginMaxBuckets,
  )

  return createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end('internal error')
    })
  })

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    securityHeaders(res)
    const url = new URL(req.url ?? '/', config.publicOrigin)

    if (req.method === 'GET' && url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end('{"ok":true}')
      return
    }

    if (req.method === 'GET' && url.pathname === '/login') {
      if (sessions.verify(cookieValue(req)) !== undefined) {
        res.writeHead(303, { Location: safeReturnTo(url.searchParams.get('returnTo'), config) })
        res.end()
        return
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(loginPage(safeReturnTo(url.searchParams.get('returnTo'), config), url.searchParams.get('failed') === '1'))
      return
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      if (!sameOriginRequest(req, config)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      const form = await readForm(req)
      if (form === undefined) {
        res.writeHead(400)
        res.end('bad request')
        return
      }
      const username = form.get('username') ?? ''
      const password = form.get('password') ?? ''
      const address = clientAddress(req)
      const identityKey = `${address}\u0000${username.toLowerCase()}`
      if (!ipLimiter.allows(address) || !identityLimiter.allows(identityKey)) {
        res.writeHead(429, { 'Retry-After': String(config.loginWindowSeconds) })
        res.end('too many attempts')
        return
      }
      const passwordValid = verifyPassword(password, config.passwordHash)
      const valid = username === config.username && passwordValid
      if (!valid) {
        ipLimiter.fail(address)
        identityLimiter.fail(identityKey)
        const returnTo = encodeURIComponent(safeReturnTo(form.get('returnTo'), config))
        res.writeHead(303, { Location: `/login?failed=1&returnTo=${returnTo}` })
        res.end()
        return
      }
      ipLimiter.succeed(address)
      identityLimiter.succeed(identityKey)
      const token = sessions.create(config.username)
      res.writeHead(303, {
        Location: safeReturnTo(form.get('returnTo'), config),
        'Set-Cookie': sessionCookie(token, config),
      })
      res.end()
      return
    }

    if (req.method === 'GET' && url.pathname === '/logout') {
      if (sessions.verify(cookieValue(req)) === undefined) {
        res.writeHead(303, { Location: '/login' })
        res.end()
        return
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(logoutPage())
      return
    }

    if (req.method === 'POST' && url.pathname === '/logout') {
      if (!sameOriginRequest(req, config)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      sessions.revoke(cookieValue(req))
      res.writeHead(303, { Location: '/login', 'Set-Cookie': clearCookie(config) })
      res.end()
      return
    }

    if (req.method === 'GET' && url.pathname === '/auth/check') {
      if (!authSubrequestAllowed(req, config)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      const username = sessions.verify(cookieValue(req))
      if (username === undefined) {
        res.writeHead(401)
        res.end()
        return
      }
      res.writeHead(204, { 'X-Authenticated-User': username })
      res.end()
      return
    }

    res.writeHead(404)
    res.end('not found')
  }
}
