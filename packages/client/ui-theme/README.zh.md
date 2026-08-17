# @deepseek-ai/dsh-client-ui-theme

[English](README.md) | 中文

产品主题包括浅色、深色、跟随系统、QQ 2008 经典蓝与“我的主题”。主题编辑器只允许修改 12 个白名单语义颜色 token，值必须为完整 `#RRGGBB`，不会解析或执行任意 CSS。“我的主题”还可使用不超过 512 KiB 的本地 PNG、JPEG 或 WebP 背景图，并调整图片透明度。任意 URL 与 SVG 会被拒绝；图片位于独立且不接收指针事件的背景层，不会改变正文透明度或交互。回环访问继续写入 Host 设置；远程访问仅写入当前域名的浏览器存储，避免扩大特权 settings API 的信任边界。

主题插件：基于 --dsw-* token 基础样式表（静态尺度 + 别名语义层）的 ThemeRuntime。该服务拥有实时主题偏好（`light`／`dark`／`system`／`qq2008`／`custom`），将 `system` 通过 `prefers-color-scheme` 解析为实际主题，并通过 `theme/change` 发布不可变快照；DOM 仍由 ui-layout 呈现器统一更新。回环浏览器通过 Host settings API 读写 `ui-theme`，默认存入 `$DSH_HOME/settings.yaml`。远程浏览器不能访问特权 settings API，因此经过校验的产品主题偏好和自定义色板保存在同源浏览器存储中。第三方注册主题仍是进程内扩展，不会进入产品 settings schema。该特权持久化边界由[Host settings 支撑的偏好决策](../../../.agents/notes/implemented/bug-fix/2026-08-06-host-backed-web-preferences.md)拥有。

当主机组合包含 HTTP 服务器时，主机侧紧接 `<body>` 起始标签注入同步引导代码。每份 index 响应会嵌入已注册的 Host 设置 `ui-theme.preference`，没有 settings provider 时则嵌入 `system`；浏览器按操作系统配色解析 `system`，随后在外壳加载页面渲染前设置 `color-scheme` 和 `body[data-ds-dark-theme]`。图片内容不会进入可执行的首屏引导 HTML，而是在客户端完成校验并激活主题后显示。不含 HTTP 服务器的组合不受影响，插件树激活后，ThemeRuntime 与 ui-layout 仍分别是客户端状态和后续 DOM 更新的权威来源。

`src/styles/` 下有五张样式表，全部由 web 壳的 `base.css` 导入：`base.css`、`design-platform.css`、`scrollbar.css`、`gradient-shadow-text.css` 与 `shiki.css`。`scrollbar.css` 是 `--dsw-alias-scrollbar-*` token 的唯一消费方，必须排在声明这些 token 的 `design-platform.css` 之后。

滚动条重新绑定约定：`scrollbar.css` 在 `body` 上把 `--dsh-scrollbar-thumb` 与 `--dsh-scrollbar-thumb-hover` 绑定到 l1（基础表面）token，两条渲染路径都读取这一组变量。高层级表面（菜单、浮层、对话框）在自己的容器上设置 `--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)` 与 `--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)`；一次重新绑定即可为引擎实际走的那条路径换色。这组变量的另一个合法目标是 `transparent`，即完全不绘制滑块——[ui-sidebar](../ui-sidebar/README.md) 在指针不在栏内时就这样重新绑定自己的列。绑回 l1 那组不算重新绑定，它只是重述基础表面的默认值。`--dsh-scrollbar-width` 镜像 WebKit 滚动条的布局宽度，供需要与占布局宽度的滚动条对齐的表面使用——[ui-conversation](../ui-conversation/README.md) 用它作为覆盖 composer 座位 `right` 偏移——scrollbar-styles 规格把它与镜像规则及消费者配对检查。

两条路径在构造上互斥。`scrollbar-width`／`scrollbar-color` 写在 `@supports not selector(::-webkit-scrollbar)` 之内，因为这两个属性中的任一个只要取非 `auto` 值，Chromium 与 Safari 就会丢弃该元素上的全部 `::-webkit-scrollbar*` 规则，`::-webkit-scrollbar-thumb:hover` 也在其中——若无条件地同时声明，`--dsh-scrollbar-thumb-hover` 在任何引擎上都不会被渲染。因此 Firefox 走标准属性，WebKit 系引擎走伪元素，hover token 只经由伪元素这条路径渲染。相关原理与实测计算值见[滚动条 Agent Note](../../../.agents/notes/implemented/bug-fix/2026-07-28-themed-scrollbars-and-reserved-gutter.md)。

## 模型体验

无。主题服务管理浏览器偏好；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **第三方主题是表层，不是产品**：注册主题意味着覆盖同名别名变量；目前不会验证一组覆盖是否完整。
- **token 样式表是颜色值的唯一权威来源**：会有意不补入 cssdesign 中缺失的值（例如设计中的 #4176E6 标签页蓝色）；一律采用最接近的语义 token。设计负责人批准的新增值是例外：须在同一变更中以一个静态尺度层级与一个语义别名的形式进入（`--dsw-static-blue-900` / `--dsw-alias-label-primary-bluish`）。
