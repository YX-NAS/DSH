# Agent Note: Session authentication gateway for remote Web deployments

Status: implemented

English | [中文](2026-08-16-session-auth-gateway.zh.md)

## Problem

The Harness Web server deliberately owns no TLS or authentication and keeps privileged configuration methods loopback-only. A public reverse proxy needs an authenticated browser identity before it can expose ordinary Agent execution or selectively grant remote configuration access. Browser Basic Auth supplies neither a product login page nor revocable sessions and logout.

## Decision

`apps/auth-gateway` is a loopback HTTP service consumed by Nginx `auth_request`. Nginx remains the only public listener and continues to proxy Harness HTTP and WebSocket traffic. Harness remains on `127.0.0.1:3080`, while the auth service defaults to `127.0.0.1:3081`.

The auth service verifies a scrypt password hash and issues an HMAC-signed `__Host-dsh_session` Cookie with a process-local session id. Every protected Nginx request sends its original Host, method, Origin, and Fetch Metadata to `/auth/check`; unsafe methods require the configured exact HTTPS origin. Logout uses POST, revokes the session id before clearing the Cookie, and redirects to the login page. Failed authentication is limited per normalized client IP and username with bounded in-memory storage.

Nginx grants loopback authority only to an anchored list of model configuration RPC paths after auth succeeds. It preserves the public Host and Origin for ordinary calls so Harness's own request-trust checks remain active. Server-desktop methods and Agent-preset authoring remain loopback-only.

## Alternatives considered

**Modify the Harness Web server to own users and sessions.** This couples deployment identity to the plugin carrier, conflicts with its explicit no-auth responsibility, and increases merge conflicts with the fast-moving upstream project.

**Keep Nginx Basic Auth.** Basic Auth is small but does not provide the requested form login, explicit logout, server-side revocation, CSRF checks, or failed-login policy.

**Rewrite every authenticated request as loopback.** Authentication would make that possible, but it would erase Harness's method-specific trust distinction and expose server-desktop operations unnecessary for a remote browser.

## Consequences

Remote deployments gain a replaceable authentication layer without changing the Agent runtime. Restarting the single auth process invalidates all sessions, which fails closed and requires users to log in again. The process-local registry does not support horizontal replicas.

Nginx owns upgraded WebSocket connections, so logout revokes every later HTTP request and reconnect but cannot actively close a socket copied outside the logged-in browser. The browser's logout navigation closes its page-owned connections. A future shared or multi-instance gateway must own the WebSocket proxy or add a shared connection-revocation channel.
