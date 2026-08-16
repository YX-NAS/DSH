# DSH Auth Gateway

English | [中文](README.zh.md)

`@yx-nas/dsh-auth-gateway` provides a login page, server-tracked signed sessions, logout, CSRF checks, and failed-login rate limiting for an Nginx-fronted DeepSeek Harness Web deployment. The service binds to loopback and acts only as an Nginx `auth_request` backend; Nginx continues to proxy HTTP and WebSocket traffic to Harness.

## Configuration reference

| Environment variable | Required | Meaning |
|---|---:|---|
| `DSH_AUTH_PUBLIC_ORIGIN` | yes | Exact HTTPS origin presented to browsers, without a path |
| `DSH_AUTH_USERNAME` | yes | Login username |
| `DSH_AUTH_PASSWORD_HASH` | yes | `scrypt-v1` password hash produced by `hash-password` |
| `DSH_AUTH_SESSION_SECRET` | yes | Random session signing secret of at least 32 bytes |
| `DSH_AUTH_HOST` | no | Bind address, default `127.0.0.1` |
| `DSH_AUTH_PORT` | no | Bind port, default `3081` |
| `DSH_AUTH_SESSION_TTL_SECONDS` | no | Fixed session lifetime, default 43,200 seconds |
| `DSH_AUTH_MAX_SESSIONS` | no | Maximum active sessions, default 1,000; oldest sessions are evicted first |
| `DSH_AUTH_LOGIN_WINDOW_SECONDS` | no | Failed-login window, default 900 seconds |
| `DSH_AUTH_LOGIN_MAX_FAILURES` | no | Failures allowed per IP and username, default 5 |
| `DSH_AUTH_LOGIN_MAX_BUCKETS` | no | Maximum in-memory limiter keys, default 10,000 |
| `DSH_AUTH_SECURE_COOKIE` | no | Set to `false` only for loopback HTTP testing |

Generate a password hash without putting the password in the process list:

```sh
node apps/auth-gateway/lib/bin.js hash-password
```

Enter the password through standard input when prompted. Do not include it in the command line.

The production templates and ordered installation steps live in [`deploy/auth-gateway`](../../deploy/auth-gateway/README.md).

## Security behavior

The service issues a `__Host-dsh_session` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. Tokens carry a signed audience, issue time, expiry, username, and random session id. A process-local allowlist makes logout revoke the session immediately; restarting the auth service invalidates all active sessions.

Nginx supplies the original Host, method, Origin, and Fetch Metadata to `/auth/check`. Unsafe requests require the configured Origin, cross-site requests fail closed, and an unauthenticated request receives 401 for Nginx to redirect to `/login`. Login and logout are POST-only state changes and use the same exact-origin check.

## Known limitations

- Sessions are process-local, so this version supports one auth service instance and requires users to log in again after a restart.
- Nginx owns WebSocket proxying. Browser logout closes the application page and its sockets, while a socket already copied outside the browser is not actively terminated until its connection ends.
- The deployment opens remote model configuration methods only. Server-desktop operations such as opening a path or native directory picker remain loopback-only.
