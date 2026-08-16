interface FailureWindow {
  count: number
  startedAt: number
}

/** Fixed-window limiter for failed login attempts. */
export class LoginRateLimiter {
  private readonly failures = new Map<string, FailureWindow>()

  constructor(
    private readonly maxFailures: number,
    private readonly windowSeconds: number,
    private readonly maxBuckets: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Whether the client may attempt authentication. */
  allows(client: string): boolean {
    const current = this.current(client)
    return current === undefined || current.count < this.maxFailures
  }

  /** Record one failed attempt. */
  fail(client: string): void {
    const current = this.current(client)
    if (current === undefined) {
      this.prune()
      if (this.failures.size >= this.maxBuckets) {
        const oldest = this.failures.keys().next().value
        if (oldest !== undefined) this.failures.delete(oldest)
      }
      this.failures.set(client, { count: 1, startedAt: this.now() })
      return
    }
    current.count += 1
  }

  /** Clear failures after successful authentication. */
  succeed(client: string): void {
    this.failures.delete(client)
  }

  private current(client: string): FailureWindow | undefined {
    const current = this.failures.get(client)
    if (current === undefined) return undefined
    if (this.now() - current.startedAt >= this.windowSeconds * 1000) {
      this.failures.delete(client)
      return undefined
    }
    return current
  }

  private prune(): void {
    const cutoff = this.now() - this.windowSeconds * 1000
    for (const [client, window] of this.failures) {
      if (window.startedAt <= cutoff) this.failures.delete(client)
    }
  }
}
