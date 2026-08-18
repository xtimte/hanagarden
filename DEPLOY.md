# 🚀 部署指南 — 番之庭 · Hanagarden

本项目是**纯静态站点**：服务器上不需要 Python / Node / 数据库，只需要一个能托管静态文件的 Web 服务器（Nginx / Caddy / 宝塔 / 对象存储均可）。

---

## 0️⃣ 两种部署包（在 `deploy/` 目录）

| 包 | 大小 | 封面来源 | 适用场景 |
| --- | --- | --- | --- |
| `hanagarden-full.zip` | ~512MB | 本地图片（1980 张随包） | 带宽充足 / 追求完整离线、不被第三方 CDN 影响 |
| `hanagarden-light.zip` | ~394KB | 热链 B站 CDN（图片带 `referrerpolicy="no-referrer"`，不会 403） | 小服务器 / 快速上线 / 流量敏感 |

> 热链模式的缺点：依赖 B站 CDN 存活与可访问性；但日常完全够用。

---

## 1️⃣ 方案 A：买一台云服务器（国内服务器推荐宝塔）

### 步骤
1. **购买服务器**：阿里云 / 腾讯云轻量应用服务器（2核2G 足够），系统选 **Ubuntu 22.04 / CentOS 7.9** 或 Windows Server；
   - ⚠️ **国内服务器 + 域名需要 ICP 备案**（阿里云/腾讯云控制台可免费办理，约 1~2 周）；不想备案就选香港/海外服务器（免备案，速度略慢）。
2. **装宝塔面板**（图形化，适合新手）：
   ```bash
   # 在服务器上执行（以官网最新命令为准）
   wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh
   ```
3. 宝塔面板 → **网站 → 添加站点**：填域名（如 `hanagarden.example.com`），PHP 版本选"纯静态"，自动创建 Nginx 站点；
4. **上传解压**：宝塔"文件"面板进入 `/www/wwwroot/你的域名/`，上传 zip 包 → 右键**解压** → 把解压出的文件移到站点根目录（`index.html` 必须在根目录）；
5. 若域名已解析到服务器 IP，浏览器访问即完成 🎉

### Nginx 配置（宝塔会自动生成基础配置，反爬虫部分按下方替换/合并）
> 完整可直接落地的配置文件见仓库根目录 **`nginx.conf.example`**（`deploy/nginx-hanagarden.conf` 随部署包提供），含注释。
> 宝塔操作：网站 → 设置 → 配置文件，替换 server 块内容；并在 `nginx.conf` 的 `http {}` 里加两行限速 zone（见配置顶部注释）。

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name hanagarden.example.com;      # 改成你的域名
    root /www/wwwroot/hanagarden.example.com;
    index index.html;

    charset utf-8;
    server_tokens off;                       # 隐藏 Nginx 版本号
    autoindex off;                           # 禁止目录列表

    # --- 基础安全：屏蔽敏感路径 ---
    location ~* (^|/)(\.git|\.env|\.svn|\.hg|\.DS_Store|Thumbs\.db)(/|$) { deny all; }
    location ~* \.(bak|sql|conf|log|old|swp)$ { deny all; }

    # --- 简单反爬虫：UA 黑名单（空 UA / 脚本工具 / AI 爬虫）---
    if ($http_user_agent ~* "(^$)|(python-requests|python-urllib|scrapy|aiohttp|httpx|libwww|wget|curl|okhttp|apache-httpclient|go-http-client|java/|node-fetch|axios)")
        { return 403; }
    if ($http_user_agent ~* "(GPTBot|ChatGPT-User|CCBot|ClaudeBot|anthropic-ai|Bytespider|PerplexityBot|omgili|PetalBot|DataForSeoBot|AhrefsBot|SemrushBot|MJ12bot|DotBot)")
        { return 403; }

    # --- 防盗链：图片只允许本站引用（直接访问/无 Referer 放行）---
    location ~* \.(jpg|jpeg|png|webp|gif|avif)$ {
        valid_referers none blocked server_names *.example.com example.com;
        if ($invalid_referer) { return 403; }
        expires 7d;
        add_header Cache-Control "public";
    }
    # --- 数据文件（js/ data/）防盗链 + 限速 ---
    location ~* ^/(js|data)/ {
        valid_referers none blocked server_names *.example.com example.com;
        if ($invalid_referer) { return 403; }
        limit_req zone=hanagarden_data burst=10 nodelay;   # 需在 http{} 定义 zone
    }

    # --- 全局限速（防 CC / 批量抓取）---
    location / {
        limit_req zone=hanagarden_static burst=30 nodelay; # 需在 http{} 定义 zone
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1k;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
}
```

---

## 2️⃣ 方案 B：海外服务器 + 手动 Nginx（免备案，通用）

```bash
# 1. 上传（本地执行，任选其一）
scp -r "deploy/hanagarden-light.zip" user@你的服务器IP:/var/www/

# 2. 服务器上解压
cd /var/www && unzip hanagarden-light.zip -d hanagarden

# 3. 安装并配置 Nginx
sudo apt update && sudo apt install -y nginx unzip
# 3.1 在 /etc/nginx/nginx.conf 的 http {} 块内加两行限速 zone：
#     limit_req_zone $binary_remote_addr zone=hanagarden_static:10m rate=10r/s;
#     limit_req_zone $binary_remote_addr zone=hanagarden_data:10m rate=5r/s;
# 3.2 上传完整反爬配置（本仓库 nginx.conf.example 已含全部内容）
sudo tee /etc/nginx/sites-available/hanagarden > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;                      # 或你的域名
    root /var/www/hanagarden;
    index index.html;
    charset utf-8;
    server_tokens off;
    autoindex off;

    location ~* (^|/)(\.git|\.env|\.svn|\.hg|\.DS_Store|Thumbs\.db)(/|$) { deny all; }
    location ~* \.(bak|sql|conf|log|old|swp)$ { deny all; }

    # 反爬虫：UA 黑名单
    if ($http_user_agent ~* "(^$)|(python-requests|python-urllib|scrapy|aiohttp|httpx|libwww|wget|curl|okhttp|apache-httpclient|go-http-client|java/|node-fetch|axios)")
        { return 403; }
    if ($http_user_agent ~* "(GPTBot|ChatGPT-User|CCBot|ClaudeBot|anthropic-ai|Bytespider|PerplexityBot|omgili|PetalBot|DataForSeoBot|AhrefsBot|SemrushBot|MJ12bot|DotBot)")
        { return 403; }

    # 防盗链 + 缓存
    location ~* \.(jpg|jpeg|png|webp|gif|avif)$ {
        valid_referers none blocked server_names *.example.com example.com;
        if ($invalid_referer) { return 403; }
        expires 7d;
        add_header Cache-Control "public";
    }
    location ~* ^/(js|data)/ {
        valid_referers none blocked server_names *.example.com example.com;
        if ($invalid_referer) { return 403; }
        limit_req zone=hanagarden_data burst=10 nodelay;
    }

    # 限速 + 单页回退
    location / {
        limit_req zone=hanagarden_static burst=30 nodelay;
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1k;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
}
EOF
sudo ln -s /etc/nginx/sites-available/hanagarden /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. 开启 HTTPS（免费证书）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

访问 `http://服务器IP` 或 `https://你的域名` 即完成。

---

## 3️⃣ 方案 C：免服务器托管（最省事）

适合访问量不大的个人站，**零运维**：

| 平台 | 特点 | 上传方式 |
| --- | --- | --- |
| **GitHub Pages** | 免费、全球 CDN，但国内访问不稳定 | 网页拖拽上传或 `git push` |
| **Cloudflare Pages** | 免费、自带 CDN + HTTPS，国内访问尚可 | 网页拖拽上传 zip 或连接 Git 仓库 |
| **Vercel / Netlify** | 免费、全球 CDN | 拖拽上传或 Git 集成 |
| **阿里云 OSS / 腾讯云 COS** | 国内访问快；开启"静态网站托管" | 控制台上传或 `ossutil` 同步 |

> 注意：GitHub Pages / Cloudflare Pages 等单文件上传上限一般是 25MB 左右，**请使用 `hanagarden-light.zip`（394KB）**；COS/OSS 无此限制，可传完整包。

---

## 4️⃣ 更新数据（以后想刷新新番表时）

数据更新**不需要重装站点**，只需在本地重跑数据管道，然后增量上传 2 个文件：

```bash
# 本地：重新抓取（增量补封面可加 --covers-only）
python scripts/scrape_yuc.py
python scripts/build_data.py          # 本地封面模式（完整包站点）
# 或
python scripts/build_data.py --remote # 热链模式（轻量包站点）

# 上传到服务器（覆盖旧文件即可）
scp js/data.js user@IP:/var/www/hanagarden/js/
# 完整包站点还需同步新增封面：
scp -r data/covers/* user@IP:/var/www/hanagarden/data/covers/
```

浏览器强制刷新（Ctrl+Shift+R）即可看到新数据。

---

## 5️⃣ 常见问题

- **上传太慢**：完整包 512MB，建议走宝塔"压缩包上传"或 `scp`；着急上线直接用 light 包（394KB）；
- **国内访问慢 / 打不开**：检查域名备案是否完成；或改用 COS/OSS + CDN；
- **图片裂图**：light 模式依赖 B站 CDN，个别图可能失效 → 改用完整包；
- **修改站点名/配色**：改 `index.html` 与 `css/style.css` 后重新打包上传即可。

---

## 6️⃣ 反爬虫配置说明

> 完整配置文件：`nginx.conf.example`（仓库根目录 / 部署包内 `nginx-hanagarden.conf`）。
> 定位：**简单防护** —— 防"脚本批量扒图/扒数据、白嫖带宽"，不追求对抗专业爬虫（那需要 WAF/CDN 层面）。

### 各层防护的作用

| 配置 | 作用 | 说明 |
| --- | --- | --- |
| `server_tokens off` | 隐藏 Nginx 版本号 | 减少被针对性扫描的信息 |
| `autoindex off` | 禁止目录列表 | 防止别人浏览 `data/covers/` 全部图片清单 |
| 敏感路径 `deny all` | 屏蔽 `.git` / `.env` / 备份文件 | 防源码/配置泄露（git 仓库误传时兜底） |
| **UA 黑名单** | 屏蔽空 UA、脚本工具、AI 爬虫 | 拦截 `python-requests`、`scrapy`、`curl`、`wget`、`GPTBot`、`CCBot` 等；**搜索引擎蜘蛛默认放行** |
| **防盗链** | 图片与 `js/` `data/` 只允许本站域名引用 | 别人把图片/数据链接贴到别站直接 403；`none/blocked` 放行直接访问，不误伤正常用户 |
| **限速 `limit_req`** | 单 IP 请求速率限制 | 防 CC、防批量抓取：全站 10r/s、数据目录 5r/s（超限返回 503） |

### 验证方式（部署后）

```bash
# 1. 正常浏览器访问 → 200（放行）
# 2. 脚本抓取 → 403（UA 拦截）
curl -A "python-requests/2.31" https://你的域名/            # 期望 403
curl -A "" https://你的域名/                                 # 期望 403（空 UA）
# 3. 盗链 → 403（Referer 拦截）
curl -e "https://evil-site.com/" https://你的域名/data/covers/a.jpg   # 期望 403
curl -e "https://你的域名/" https://你的域名/data/covers/a.jpg         # 期望 200
# 4. 限速 → 503（连续快速请求）
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}\n" https://你的域名/; done
```

### 常见坑

- **用 IP 直接访问**：`valid_referers server_names` 匹配不到 IP，图片会 403 → 把 `*.example.com example.com` 换成 `~^https?://你的IP`；
- **宝塔面板**：`limit_req_zone` 两行要加在 `/www/server/nginx/conf/nginx.conf` 的 `http {}` 里，否则 `nginx -t` 报错；
- **误伤自己**：服务器上 `curl` 测试会 403（curl 在黑名单里），属预期行为；调试期可临时注释 UA 行；
- **想被搜索引擎收录**：删除"AI/SEO 爬虫"UA 那行即可（Googlebot/Bing/百度不在拦截列表）；
- **HTTPS 站点**：把 `listen 80` 段替换为宝塔/certbot 生成的 443 段，反爬虫的 location 规则原样保留。
