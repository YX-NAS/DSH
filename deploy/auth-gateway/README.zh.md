# 部署 DSH Auth Gateway

[English](README.md) | 中文

本教程从已经在 3080 端口以回环方式运行的 `dsh web` 服务和已配置 HTTPS 的 Nginx 虚拟主机开始，最终为每个 Harness HTTP 和 WebSocket 请求提供表单登录、会话鉴权和退出登录。

1. 从仓库根目录构建鉴权服务：

   ```sh
   pnpm --filter @yx-nas/dsh-auth-gateway build
   ```

2. 创建不可登录且锁定的 `dsh-auth` 系统用户。将 `apps/auth-gateway/lib` 和 `apps/auth-gateway/package.json` 复制到 `/opt/dsh-auth-gateway`，目录及文件由 `root:root` 持有，并确保 `dsh-auth` 与 Harness 服务用户均不可写。Harness 与鉴权网关必须使用不同用户运行。

3. 生成密码哈希和会话密钥。从标准输入读取密码，不要将其放入命令行或 Shell 历史。

   ```sh
   node /opt/dsh-auth-gateway/lib/bin.js hash-password
   openssl rand -base64 48
   ```

4. 将 `dsh-auth-gateway.env.example` 复制到 `/etc/dsh-auth-gateway.env`，替换每个占位符，将模式设为 `600`，并由 root 持有。systemd 会在切换至锁定服务用户前读取该文件。

5. 安装 `dsh-auth-gateway.service`，运行 `systemd-analyze verify`，然后启用服务。确认 `http://127.0.0.1:3081/health` 返回 `{"ok":true}`。

6. 使 `nginx.conf.example` 适配部署域名和证书路径。删除先前的 `auth_basic` 指令以及临时 settings/credentials 改写。重载 Nginx 前运行 `nginx -t`。

7. 验证公网行为：未鉴权页面重定向到 `/login`；有效登录可进入 Harness；`/logout` 使旧 Cookie 失效；重放该 Cookie 返回 401；模型设置能加载；未批准的特权方法仍返回 403。

云防火墙只应开放 Nginx 的 80 和 443 端口。3080 和 3081 必须仅限回环访问。
