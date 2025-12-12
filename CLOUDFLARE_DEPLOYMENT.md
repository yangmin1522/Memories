# Cloudflare Pages 部署指南

本指南会帮助你将 Christmas Memories 项目部署到 Cloudflare Pages 并绑定自定义域名。

## 前置条件

- ✅ 项目已推送到 GitHub（`https://github.com/yangmin1522/Memories`）
- ✅ 拥有 Cloudflare 账户（[注册地址](https://dash.cloudflare.com/sign-up)）
- 如果要绑定自定义域名，需要已在 Cloudflare 中添加并验证过该域名

## 步骤 1：在 Cloudflare Pages 中连接 GitHub

### 1.1 访问 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单找到 **"Pages"** → 点击 **"创建项目"** (Create a project)

### 1.2 连接 GitHub 仓库

1. 选择 **"连接到 Git"** (Connect to Git)
2. 选择 **GitHub** 为提供商
3. 点击 **"授权 Cloudflare"** (Authorize Cloudflare)
   - GitHub 会请求权限，点击 **"Authorize cloudflare"**
4. 选择你的 GitHub 账户（`yangmin1522`）
5. 在仓库列表中找到 **Memories** 并点击 **"连接"** (Connect)

### 1.3 配置构建设置

在"设置构建和部署"页面，填入以下信息：

| 字段 | 值 |
|------|-----|
| **项目名称** | `christmas-memories`（或你喜欢的名字） |
| **生产分支** | `main` |
| **构建命令** | 留空（此项目无需构建） |
| **构建输出目录** | `.`（项目根目录） |

其他选项保持默认，然后点击 **"保存和部署"** (Save and Deploy)。

### 1.4 首次部署

Cloudflare 会自动开始部署过程：
- 构建日志会实时显示
- 部署完成后会得到一个 `*.pages.dev` 子域名，例如 `christmas-memories.pages.dev`
- 访问该 URL 验证网站是否正常工作

## 步骤 2：绑定自定义域名（可选）

### 2.1 前提条件

- 你拥有一个域名（例如 `memories.example.com`）
- 该域名的 DNS 已由 Cloudflare 管理

**如果域名不在 Cloudflare 管理下：**
1. 在 Cloudflare Dashboard 中点击 **"添加站点"** (Add a site)
2. 输入你的域名
3. 选择免费计划
4. 按照提示修改域名的 DNS 命名服务器（NS 记录）到 Cloudflare 的值
5. 等待 DNS 生效（通常 5-48 小时）

### 2.2 在 Cloudflare Pages 中添加自定义域名

1. 在 Cloudflare Dashboard 中打开你的 Pages 项目
2. 点击 **"自定义域"** 标签 (Custom domain)
3. 点击 **"设置自定义域"** (Set up a custom domain)
4. 输入你的完整域名（例如 `memories.example.com`）
5. Cloudflare 会显示 DNS 信息
   - 如果域名已在 Cloudflare 管理，系统会自动创建 CNAME 或 ALIAS 记录
   - 如果域名在其他 DNS 提供商，参考下面的"外部 DNS 配置"章节

### 2.3 外部 DNS 配置（如果域名不在 Cloudflare）

如果你的域名 DNS 在其他提供商（GoDaddy、NameCheap 等）管理：

1. Cloudflare Pages 会告诉你需要添加的 DNS 记录（通常是 CNAME）：
   ```
   名称: memories           (或 @)
   类型: CNAME
   值: christmas-memories.pages.dev
   TTL: 自动
   ```
2. 登录你的域名提供商的 DNS 管理面板
3. 添加上述 CNAME 记录
4. 等待 DNS 生效（5 分钟至 48 小时）
5. 返回 Cloudflare Pages，点击 **"验证域名"** (Verify domain)

### 2.4 SSL/TLS 证书

- Cloudflare 会自动为你的域名颁发并管理 SSL 证书（Let's Encrypt）
- 访问 https://memories.example.com 时应该显示绿色的安全锁

## 步骤 3：配置和优化（可选）

### 3.1 构建监视和自动部署

配置完成后，每当你推送代码到 GitHub 的 `main` 分支：
1. GitHub 会触发 Cloudflare Pages 的 Webhook
2. 自动拉取最新代码
3. 自动部署到你的 Pages 项目

### 3.2 缓存和性能

在 Pages 项目设置中，可配置：
- **缓存行为** — 建议对 HTML 设置短缓存 (30 秒)，对 JS/CSS 设置长缓存 (1 年)
- **自动最小化** — 启用 JS 和 CSS 自动压缩

### 3.3 自定义 404 页面

在 Cloudflare 项目设置中指定一个 404 页面（可选）。此项目默认返回 `index.html` 以支持单页应用路由。

## 故障排查

### 网站显示 404

- ✅ 检查 Cloudflare Pages 的构建日志是否有错误
- ✅ 确认 `wrangler.toml` 和 `_routes.json` 配置正确
- ✅ 清除浏览器缓存后重新访问

### DNS 域名无法解析

- ✅ 等待 DNS 生效（可用 `nslookup` 或在线工具验证）
- ✅ 确认 CNAME 记录已正确添加到你的 DNS 提供商
- ✅ 在 Cloudflare Dashboard 检查域名状态是否为"活跃"(Active)

### 静态资源加载失败

- ✅ 检查浏览器开发者工具（F12）的 Network 标签，查看请求 URL
- ✅ 确认资源路径相对于根目录正确（例如 `christmas.css` 而非 `/christmas.css`）
- ✅ 如果使用 `importmap` 的 CDN 资源，确保能从你的域名访问

## 总结

| 步骤 | 耗时 | 自动化 |
|------|------|--------|
| 连接 GitHub 到 Cloudflare Pages | 5 分钟 | ✅ 一次配置 |
| 首次部署 | 1-2 分钟 | ✅ 自动 |
| 绑定自定义域名 | 5-10 分钟 | ❌ 手动（一次） |
| DNS 生效 | 5-48 小时 | 取决于 TTL |
| 后续推送自动部署 | 1-2 分钟 | ✅ 全自动 |

**部署完成后，你的站点将在以下地址可访问：**
- Cloudflare 自动分配：`https://christmas-memories.pages.dev`
- 自定义域名（如已配置）：`https://memories.example.com`

---

## 快速参考

### 本地测试（可选）
如果想在本地模拟 Cloudflare 环境，可使用 Wrangler CLI：

```bash
# 安装 Wrangler
npm install -g @cloudflare/wrangler

# 在项目根目录运行本地服务器
wrangler pages dev .

# 访问 http://localhost:8788
```

### 推送新代码
```bash
git add .
git commit -m "Update: feature description"
git push origin main
# Cloudflare 会自动检测并部署
```

### 查看部署状态
登录 Cloudflare Dashboard → Pages → 你的项目 → 可查看最近的部署历史和日志

---

有任何问题，欢迎参考 [Cloudflare Pages 官方文档](https://developers.cloudflare.com/pages/)。
