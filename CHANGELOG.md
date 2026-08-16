# Changelog

## 0.1.2 - 2026-08-16

- Support privacy-oriented browsers that omit both `Origin` and same-origin Fetch Metadata on top-level form submissions.
- Continue rejecting mismatched origins, mismatched hosts, and requests explicitly marked cross-site.

## 0.1.1 - 2026-08-16

- Accept login and logout submissions without an `Origin` header only when Fetch Metadata explicitly proves the request is same-origin.
- Preserve rejection of cross-site and origin-unproven state-changing requests.

## 0.1.0 - 2026-08-16

- Add an Nginx-integrated login page and server-tracked signed sessions.
- Add POST-only logout with immediate session revocation.
- Add exact-origin CSRF checks, failed-login rate limiting, secure cookie attributes, and security response headers.
- Add production systemd, Nginx, and environment templates for loopback Harness deployments.
