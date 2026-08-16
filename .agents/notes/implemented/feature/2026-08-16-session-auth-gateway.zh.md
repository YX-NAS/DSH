# Agent Note: 远程 Web 部署的会话鉴权网关

Status: implemented

[English](2026-08-16-session-auth-gateway.md) | 中文

## 问题

Harness Web 服务器有意不负责 TLS 或鉴权，并使特权配置方法仅限回环访问。公网反向代理需要先确认浏览器身份，才能开放普通 Agent 执行或有选择地授予远程配置权限。浏览器 Basic Auth 既不提供产品登录页，也不支持可撤销会话和退出登录。

## 决策

`apps/auth-gateway` 是一个供 Nginx `auth_request` 调用的回环 HTTP 服务。Nginx 仍是唯一公网监听器，并继续代理 Harness HTTP 和 WebSocket 流量。Harness 保持在 `127.0.0.1:3080`，鉴权服务默认位于 `127.0.0.1:3081`。

鉴权服务校验 scrypt 密码哈希，并签发包含进程内会话 id 的 HMAC 签名 `__Host-dsh_session` Cookie。每个受保护的 Nginx 请求都会将原始 Host、方法、Origin 和 Fetch Metadata 传给 `/auth/check`；不安全方法要求使用配置的精确 HTTPS origin。退出使用 POST，先撤销会话 id，再清除 Cookie 并重定向到登录页。认证失败按规范化的客户端 IP 和用户名限速，限速状态具有内存上限。

Nginx 仅在鉴权成功后，向一组锚定的模型配置 RPC 路径授予回环权限。普通调用保留公网 Host 和 Origin，因此 Harness 自身的请求信任校验仍然生效。服务器桌面方法和 Agent 预设编辑仍只允许回环访问。

## 考虑过的替代方案

**修改 Harness Web 服务器，使其拥有用户和会话。** 这会把部署身份与插件载体耦合，违背载体明确的无鉴权职责，并增加与快速变化的上游项目合并时的冲突。

**保留 Nginx Basic Auth。** Basic Auth 足够简小，但不支持所需的表单登录、显式退出、服务端撤销、CSRF 校验或登录失败策略。

**将每个已鉴权请求改写为回环请求。** 鉴权使该方案在技术上可行，但会消除 Harness 针对不同方法的信任区分，并开放远程浏览器不需要的服务器桌面操作。

## 后果

远程部署获得可替换的鉴权层，且无需修改 Agent 运行时。重启单个鉴权进程会使所有会话失效，该行为以拒绝方式失败，并要求用户重新登录。进程内注册表不支持水平副本。

Nginx 拥有已升级的 WebSocket 连接，因此退出会撤销之后的每个 HTTP 请求和重连，但无法主动关闭已被复制到登录浏览器之外的 socket。浏览器退出导航会关闭它所拥有的连接。未来的共享或多实例网关必须拥有 WebSocket 代理，或添加共享的连接撤销通道。
