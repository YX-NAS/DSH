# DSH Auth Gateway

[English](README.md) | 中文

`@yx-nas/dsh-auth-gateway` 为经 Nginx 反向代理的 DeepSeek Harness Web 部署提供登录页、服务端跟踪的签名会话、退出登录、CSRF 校验和登录失败限速。该服务仅监听回环地址并作为 Nginx `auth_request` 后端；HTTP 和 WebSocket 流量仍由 Nginx 代理到 Harness。

## 配置参考

| 环境变量 | 必需 | 含义 |
|---|---:|---|
| `DSH_AUTH_PUBLIC_ORIGIN` | 是 | 浏览器看到的精确 HTTPS origin，不含路径 |
| `DSH_AUTH_USERNAME` | 是 | 登录用户名 |
| `DSH_AUTH_PASSWORD_HASH` | 是 | 由 `hash-password` 生成的 `scrypt-v1` 密码哈希 |
| `DSH_AUTH_SESSION_SECRET` | 是 | 不少于 32 字节的随机会话签名密钥 |
| `DSH_AUTH_HOST` | 否 | 监听地址，默认 `127.0.0.1` |
| `DSH_AUTH_PORT` | 否 | 监听端口，默认 `3081` |
| `DSH_AUTH_SESSION_TTL_SECONDS` | 否 | 固定会话时长，默认 43,200 秒 |
| `DSH_AUTH_MAX_SESSIONS` | 否 | 活动会话上限，默认 1,000；优先淘汰最旧会话 |
| `DSH_AUTH_LOGIN_WINDOW_SECONDS` | 否 | 登录失败窗口，默认 900 秒 |
| `DSH_AUTH_LOGIN_MAX_FAILURES` | 否 | 每个 IP 和用户名可容许的失败次数，默认 5 |
| `DSH_AUTH_LOGIN_MAX_BUCKETS` | 否 | 内存限速键数上限，默认 10,000 |
| `DSH_AUTH_SECURE_COOKIE` | 否 | 仅回环 HTTP 测试时可设为 `false` |

以下命令从标准输入读取密码，避免密码出现在进程列表中：

```sh
node apps/auth-gateway/lib/bin.js hash-password
```

请按提示通过标准输入键入密码，不要把密码放入命令行。

生产配置模板和有序安装步骤位于 [`deploy/auth-gateway`](../../deploy/auth-gateway/README.md)。

## 安全行为

服务签发带有 `Secure`、`HttpOnly`、`SameSite=Strict` 和 `Path=/` 的 `__Host-dsh_session` Cookie。令牌包含已签名的 audience、签发时间、过期时间、用户名和随机会话 id。进程内 allowlist 使退出能立即撤销会话；重启鉴权服务会使所有现有会话失效。

Nginx 会把原始 Host、方法、Origin 和 Fetch Metadata 传给 `/auth/check`。不安全方法要求 Origin 与配置完全一致，跨站请求默认拒绝，未登录请求返回 401，供 Nginx 重定向至 `/login`。登录与退出只允许 POST 改变状态，并使用相同的精确同源校验。

## 已知限制

- 会话保存在单个进程中，因此此版本只支持一个鉴权服务实例，服务重启后需重新登录。
- Nginx 拥有 WebSocket 代理。浏览器退出会关闭应用页面及其 socket；已被复制到浏览器外的 socket 不会主动断开，直到连接自行结束。
- 部署只开放远程模型配置方法。打开路径、原生目录选择器等服务器桌面操作仍只允许回环访问。
