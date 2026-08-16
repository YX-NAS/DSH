# Deploy the DSH Auth Gateway

English | [中文](README.zh.md)

This tutorial starts with an existing loopback `dsh web` service on port 3080 and an HTTPS Nginx virtual host. It ends with form login, session authentication, and logout in front of every Harness HTTP and WebSocket request.

1. Build the auth service from the repository root:

   ```sh
   pnpm --filter @yx-nas/dsh-auth-gateway build
   ```

2. Create a locked `dsh-auth` system account with no login shell. Copy `apps/auth-gateway/lib` and `apps/auth-gateway/package.json` to `/opt/dsh-auth-gateway`, owned by `root:root` and not writable by `dsh-auth` or the Harness service account. Harness and the auth gateway must run under different users.

3. Generate a password hash and a session secret. Read the password from standard input; do not put it on a command line or in shell history.

   ```sh
   node /opt/dsh-auth-gateway/lib/bin.js hash-password
   openssl rand -base64 48
   ```

4. Copy `dsh-auth-gateway.env.example` to `/etc/dsh-auth-gateway.env`, replace every placeholder, set mode `600`, and keep the file owned by root. systemd reads the file before changing to the locked service user.

5. Install `dsh-auth-gateway.service`, run `systemd-analyze verify`, then enable the service. Verify `http://127.0.0.1:3081/health` returns `{"ok":true}`.

6. Adapt `nginx.conf.example` to the deployment domain and certificate paths. Remove any previous `auth_basic` directives and any temporary settings/credentials rewrite. Run `nginx -t` before reloading Nginx.

7. Verify the public behavior: an unauthenticated page redirects to `/login`; a valid login reaches Harness; `/logout` invalidates the old cookie; replaying that cookie receives 401; model settings load; an unapproved privileged method remains 403.

Only Nginx ports 80 and 443 belong in the cloud firewall. Ports 3080 and 3081 must remain loopback-only.
