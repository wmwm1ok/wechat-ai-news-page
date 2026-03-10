# Cloudflare Worker - 微信 API 代理

为 GitHub Actions 提供固定 IP 出口，解决微信 IP 白名单问题。

## 🎯 原理

```
GitHub Actions (动态 IP) 
    ↓
Cloudflare Worker (固定 IP 段)
    ↓
微信 API
```

## 📝 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 部署 Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### 4. 获取 Worker URL

部署成功后会显示类似：
```
https://wechat-api-proxy.your-subdomain.workers.dev
```

### 5. 配置到主程序

将 Worker URL 添加到 GitHub Secrets：
- 名称：`WECHAT_PROXY_URL`
- 值：`https://wechat-api-proxy.your-subdomain.workers.dev`

### 6. 添加 IP 白名单

将以下 Cloudflare IP 段添加到微信公众号白名单：

```
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
```

完整列表：https://www.cloudflare.com/ips/

## 🔧 API 接口

### 获取 access_token
```bash
POST /wechat/token
Content-Type: application/json

{
  "appid": "your_appid",
  "secret": "your_secret"
}
```

### 上传图文素材
```bash
POST /wechat/uploadnews
Content-Type: application/json

{
  "access_token": "...",
  "articles": [...]
}
```

### 发布图文消息
```bash
POST /wechat/publish
Content-Type: application/json

{
  "access_token": "...",
  "media_id": "...",
  "type": "publish"  // "publish" 或 "mass"
}
```
