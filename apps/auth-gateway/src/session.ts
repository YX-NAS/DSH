import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

interface SessionPayload {
  version: 1
  audience: string
  sid: string
  username: string
  issuedAt: number
  expiresAt: number
}

interface StoredSession {
  username: string
  expiresAt: number
}

/** Process-local session registry with HMAC-authenticated bearer cookies. */
export class SessionStore {
  private readonly sessions = new Map<string, StoredSession>()

  constructor(
    private readonly secret: string,
    private readonly audience: string,
    private readonly ttlSeconds: number,
    private readonly maxSessions: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Create one server-tracked session token. */
  create(username: string): string {
    this.prune()
    while (this.sessions.size >= this.maxSessions) {
      const oldestSid = this.sessions.keys().next().value
      if (oldestSid === undefined) break
      this.sessions.delete(oldestSid)
    }
    const issuedAt = Math.floor(this.now() / 1000)
    const payload: SessionPayload = {
      version: 1,
      audience: this.audience,
      sid: randomBytes(24).toString('base64url'),
      username,
      issuedAt,
      expiresAt: issuedAt + this.ttlSeconds,
    }
    this.sessions.set(payload.sid, { username, expiresAt: payload.expiresAt })
    return this.encode(payload)
  }

  /** Return the authenticated username for an active token. */
  verify(token: string | undefined): string | undefined {
    if (token === undefined || token.length > 2048) return undefined
    const [body, signature, extra] = token.split('.')
    if (body === undefined || signature === undefined || extra !== undefined) return undefined
    const expected = this.sign(body)
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      return undefined
    }
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>
      if (payload.version !== 1 || payload.audience !== this.audience
        || typeof payload.sid !== 'string' || typeof payload.username !== 'string'
        || typeof payload.issuedAt !== 'number' || typeof payload.expiresAt !== 'number') return undefined
      const now = Math.floor(this.now() / 1000)
      if (payload.expiresAt <= now || payload.issuedAt > now) {
        this.sessions.delete(payload.sid)
        return undefined
      }
      const stored = this.sessions.get(payload.sid)
      if (stored === undefined || stored.username !== payload.username || stored.expiresAt !== payload.expiresAt) {
        return undefined
      }
      return payload.username
    } catch {
      return undefined
    }
  }

  /** Revoke one token immediately. */
  revoke(token: string | undefined): void {
    if (token === undefined) return
    const body = token.split('.', 1)[0]
    if (body === undefined) return
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>
      if (typeof payload.sid === 'string') this.sessions.delete(payload.sid)
    } catch {
      // Malformed unauthenticated input has no session to revoke.
    }
  }

  private encode(payload: SessionPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return `${body}.${this.sign(body)}`
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url')
  }

  private prune(): void {
    const now = Math.floor(this.now() / 1000)
    for (const [sid, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(sid)
    }
  }
}
