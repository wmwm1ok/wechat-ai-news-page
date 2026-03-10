#!/bin/bash

# Cloudflare Worker 部署脚本

set -e

echo "🚀 Cloudflare Worker 部署脚本"
echo "==============================="
echo ""

# 检查 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "📦 正在安装 Wrangler CLI..."
    npm install -g wrangler
fi

echo "🔐 登录 Cloudflare..."
wrangler login

echo ""
echo "📝 部署 Worker..."
wrangler deploy

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 下一步："
echo "   1. 将 Worker URL 添加到 GitHub Secrets:"
echo "      名称: WECHAT_PROXY_URL"
echo ""
echo "   2. 将 Cloudflare IP 段添加到微信公众号白名单："
echo "      173.245.48.0/20"
echo "      103.21.244.0/22"
echo "      103.22.200.0/22"
echo "      ...（详见 cloudflare-worker/README.md）"
echo ""
echo "   3. 重新运行 GitHub Actions 工作流"
echo ""
