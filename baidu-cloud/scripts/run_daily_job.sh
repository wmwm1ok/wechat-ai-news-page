#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/wechat-ai-news"
CURRENT_DIR="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"
LOG_DIR="/var/log/wechat-ai-news"
RUN_TS="$(date '+%Y-%m-%d_%H-%M-%S')"
LOG_FILE="$LOG_DIR/run_$RUN_TS.log"

mkdir -p "$LOG_DIR"

cd "$CURRENT_DIR"

if [[ -f "$SHARED_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SHARED_DIR/.env"
  set +a
fi

{
  echo "[$(date '+%F %T')] starting job"
  npm ci
  node src/index.js
  "$CURRENT_DIR/baidu-cloud/scripts/sync_to_bos.sh"
  echo "[$(date '+%F %T')] job finished"
} | tee -a "$LOG_FILE"
