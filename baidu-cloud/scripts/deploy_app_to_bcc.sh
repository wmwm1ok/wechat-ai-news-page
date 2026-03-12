#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: ./deploy_app_to_bcc.sh <user@host>"
  exit 1
fi

TARGET="$1"
APP_ROOT="/opt/wechat-ai-news"

rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".env" \
  ./ "$TARGET:$APP_ROOT/current/"

ssh "$TARGET" "sudo chown -R \$(whoami):\$(id -gn) $APP_ROOT/current"

echo "代码已同步到 $TARGET:$APP_ROOT/current"
