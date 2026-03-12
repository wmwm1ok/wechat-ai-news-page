#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/wechat-ai-news"
CURRENT_DIR="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行 setup_bcc.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y curl git rsync unzip nginx cron ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! id codex >/dev/null 2>&1; then
  useradd -m -s /bin/bash codex
fi

mkdir -p "$APP_ROOT" "$SHARED_DIR"
mkdir -p /var/log/wechat-ai-news

if [[ -d "$CURRENT_DIR" ]]; then
  chown -R codex:codex "$APP_ROOT"
fi

if [[ -f "$CURRENT_DIR/baidu-cloud/nginx/wechat-ai-news.conf" ]]; then
  cp "$CURRENT_DIR/baidu-cloud/nginx/wechat-ai-news.conf" /etc/nginx/sites-available/wechat-ai-news.conf
  ln -sf /etc/nginx/sites-available/wechat-ai-news.conf /etc/nginx/sites-enabled/wechat-ai-news.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
fi

systemctl enable cron
systemctl restart cron

echo "BCC 环境初始化完成。"
echo "接下来请配置："
echo "  $SHARED_DIR/.env"
echo "  $SHARED_DIR/bos.env"
echo
echo "如果你需要同步到 BOS，请按官方文档安装 bcecmd："
echo "  https://cloud.baidu.com/doc/BOS/s/Ejwvyqobd"
