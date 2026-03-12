#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/wechat-ai-news"
CURRENT_DIR="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"
CFG_FILE="$SHARED_DIR/bos.env"

if [[ ! -f "$CFG_FILE" ]]; then
  echo "bos.env 未配置，跳过 BOS 同步"
  exit 0
fi

set -a
# shellcheck disable=SC1090
source "$CFG_FILE"
set +a

if [[ -z "${BOS_BUCKET:-}" || -z "${BOS_ENDPOINT:-}" || -z "${BCE_ACCESS_KEY_ID:-}" || -z "${BCE_SECRET_ACCESS_KEY:-}" ]]; then
  echo "bos.env 缺少必要变量，跳过 BOS 同步"
  exit 0
fi

if ! command -v bcecmd >/dev/null 2>&1; then
  echo "未安装 bcecmd，无法同步到 BOS"
  exit 1
fi

TMP_CFG="$(mktemp)"
trap 'rm -f "$TMP_CFG"' EXIT

cat > "$TMP_CFG" <<EOF
[BceClient]
ak = ${BCE_ACCESS_KEY_ID}
sk = ${BCE_SECRET_ACCESS_KEY}
endpoint = ${BOS_ENDPOINT}
EOF

export BCE_PYTHON_SDK_CONFIG="$TMP_CFG"

bcecmd bos sync "$CURRENT_DIR/output" "bos://${BOS_BUCKET}/output" --yes
bcecmd bos cp "$CURRENT_DIR/latest.json" "bos://${BOS_BUCKET}/latest.json" --yes
bcecmd bos cp "$CURRENT_DIR/index.html" "bos://${BOS_BUCKET}/index.html" --yes

if [[ -d "$CURRENT_DIR/docs" ]]; then
  bcecmd bos sync "$CURRENT_DIR/docs" "bos://${BOS_BUCKET}/docs" --yes
fi

echo "BOS 同步完成"
