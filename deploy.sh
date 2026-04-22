#!/bin/bash

# AI 新闻自动发布系统 - GitHub 部署脚本

set -e

echo "🚀 AI 新闻自动发布系统 - 部署脚本"
echo "=================================="
echo ""

# 检查 gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ 请先安装 GitHub CLI: https://cli.github.com/"
    exit 1
fi

# 检查登录状态
if ! gh auth status &> /dev/null; then
    echo "❌ 请先登录 GitHub: gh auth login"
    exit 1
fi

# 获取用户名
USERNAME=$(gh api user -q '.login')
echo "✅ 已登录 GitHub: @$USERNAME"
echo ""

# 询问仓库名称
read -p "📦 请输入仓库名称 (默认: ai-news-wechat-publisher): " REPO_NAME
REPO_NAME=${REPO_NAME:-ai-news-wechat-publisher}

# 询问是否私有
read -p "🔒 是否创建为私有仓库? (y/N): " IS_PRIVATE
VISIBILITY="public"
if [[ $IS_PRIVATE =~ ^[Yy]$ ]]; then
    VISIBILITY="private"
fi

echo ""
echo "📋 配置信息:"
echo "   仓库名: $REPO_NAME"
echo "   可见性: $VISIBILITY"
echo ""

read -p "确认创建? (Y/n): " CONFIRM
if [[ $CONFIRM =~ ^[Nn]$ ]]; then
    echo "已取消"
    exit 0
fi

# 创建仓库
echo ""
echo "📦 创建 GitHub 仓库..."
if gh repo create "$REPO_NAME" --$VISIBILITY --source=. --remote=origin --push 2>/dev/null; then
    echo "✅ 仓库创建成功并推送代码"
else
    echo "⚠️  仓库可能已存在，尝试推送到现有仓库..."
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"
    git branch -M main
    git push -u origin main || git push -u origin master
fi

echo ""
echo "🔗 仓库地址: https://github.com/$USERNAME/$REPO_NAME"
echo ""

# 配置 Secrets
echo "🔐 现在配置必要的 Secrets..."
echo ""

read -p "请输入 DeepSeek API Key: " DEEPSEEK_KEY
if [ -n "$DEEPSEEK_KEY" ]; then
    gh secret set DEEPSEEK_API_KEY -b"$DEEPSEEK_KEY" -R "$USERNAME/$REPO_NAME"
    echo "✅ DEEPSEEK_API_KEY 已设置"
fi

read -p "请输入 Serper API Key (可选，直接回车跳过): " SERPER_KEY
if [ -n "$SERPER_KEY" ]; then
    gh secret set SERPER_API_KEY -b"$SERPER_KEY" -R "$USERNAME/$REPO_NAME"
    echo "✅ SERPER_API_KEY 已设置"
fi

echo ""
echo "✨ 部署完成！"
echo ""
echo "📋 后续步骤:"
echo "   1. 访问 https://github.com/$USERNAME/$REPO_NAME/actions"
echo "   2. 点击 'AI Daily News' → 'Run workflow'"
echo "   3. 等待任务完成后访问 GitHub Pages 页面检查结果"
echo ""
echo "📖 详细文档: https://github.com/$USERNAME/$REPO_NAME/blob/main/README.md"
echo ""
