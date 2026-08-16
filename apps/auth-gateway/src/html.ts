function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

const STYLE = `
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;background:#0b0b0d;color:#f5f5f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,#24252a 0,#101114 45%,#08090b 100%)}
.card{width:min(420px,calc(100vw - 32px));padding:36px;border:1px solid #35363c;border-radius:22px;background:rgba(28,29,33,.94);box-shadow:0 28px 80px #0008}
.brand{font-size:13px;letter-spacing:.12em;color:#a7a9b2;text-transform:uppercase}.title{margin:12px 0 8px;font-size:30px}.hint{margin:0 0 26px;color:#aeb0b8;line-height:1.55}
label{display:block;margin:16px 0 7px;font-size:14px;color:#d9dae0}input{width:100%;padding:13px 14px;border:1px solid #494b54;border-radius:11px;background:#15161a;color:#fff;font:inherit;outline:none}input:focus{border-color:#8f92ff;box-shadow:0 0 0 3px #777aff28}
button,.button{display:block;width:100%;margin-top:24px;padding:13px 16px;border:0;border-radius:11px;background:#fff;color:#111;font:600 15px inherit;text-align:center;text-decoration:none;cursor:pointer}.secondary{background:#3a3b42;color:#fff}.error{margin:0 0 16px;padding:11px 13px;border-radius:10px;background:#4d2026;color:#ffb8c0;font-size:14px}
`

function page(title: string, body: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`
}

/** Render the login form. */
export function loginPage(returnTo: string, failed: boolean): string {
  const error = failed ? '<p class="error" role="alert">用户名或密码错误，请重试。</p>' : ''
  return page('登录 · DeepSeek Harness', `<main class="card"><div class="brand">DeepSeek Harness</div><h1 class="title">登录</h1><p class="hint">请输入部署管理员提供的账号和密码。</p>${error}<form method="post" action="/login"><input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}"><label for="username">用户名</label><input id="username" name="username" autocomplete="username" maxlength="128" required autofocus><label for="password">密码</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="1024" required><button type="submit">登录</button></form></main>`)
}

/** Render the explicit logout confirmation page. */
export function logoutPage(): string {
  return page('退出 · DeepSeek Harness', '<main class="card"><div class="brand">DeepSeek Harness</div><h1 class="title">退出登录</h1><p class="hint">退出后当前会话立即失效，需要重新登录才能访问服务。</p><form method="post" action="/logout"><button type="submit">确认退出</button></form><a class="button secondary" href="/">返回工作区</a></main>')
}
