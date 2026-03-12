#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/baidu-cloud/dist/cfc-package"
ZIP_PATH="$ROOT_DIR/baidu-cloud/dist/wechat-cfc.zip"
CONFIG_PATH="$DIST_DIR/baidu-cloud/cfc/runtime-config.json"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/src" "$DIST_DIR/baidu-cloud/cfc"

cp "$ROOT_DIR/package.json" "$DIST_DIR/"
cp "$ROOT_DIR/package-lock.json" "$DIST_DIR/"
cp "$ROOT_DIR/index.html" "$DIST_DIR/"
cp "$ROOT_DIR/baidu-cloud/cfc/index.js" "$DIST_DIR/"
cp -R "$ROOT_DIR/src/"* "$DIST_DIR/src/"
cp -R "$ROOT_DIR/baidu-cloud/cfc/"* "$DIST_DIR/baidu-cloud/cfc/"

node - <<'NODE' > "$CONFIG_PATH"
const config = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  SERPER_API_KEY: process.env.SERPER_API_KEY || '',
  BOS_BUCKET: process.env.BOS_BUCKET || '',
  BOS_ENDPOINT: process.env.BOS_ENDPOINT || 'https://bj.bcebos.com',
  BCE_ACCESS_KEY_ID: process.env.BCE_ACCESS_KEY_ID || '',
  BCE_SECRET_ACCESS_KEY: process.env.BCE_SECRET_ACCESS_KEY || '',
  TARGET_NEWS_COUNT: process.env.TARGET_NEWS_COUNT || '14',
  CFC_FAST_MODE: process.env.CFC_FAST_MODE || 'true',
  CFC_SERPER_QUERY_LIMIT: process.env.CFC_SERPER_QUERY_LIMIT || '8',
  CFC_SERPER_RESULT_LIMIT: process.env.CFC_SERPER_RESULT_LIMIT || '6',
  DOMESTIC_SUMMARY_LIMIT: process.env.DOMESTIC_SUMMARY_LIMIT || '8',
  OVERSEAS_SUMMARY_LIMIT: process.env.OVERSEAS_SUMMARY_LIMIT || '16',
  SUMMARY_BATCH_SIZE: process.env.SUMMARY_BATCH_SIZE || '8',
  SELECTED_REFINE_LIMIT: process.env.SELECTED_REFINE_LIMIT || '6'
};

process.stdout.write(JSON.stringify(config, null, 2));
NODE

pushd "$DIST_DIR" >/dev/null
npm ci --omit=dev --cache .npm-cache
rm -rf .npm-cache
zip -qr "$ZIP_PATH" .
popd >/dev/null

echo "CFC 部署包已生成: $ZIP_PATH"
echo "CFC 运行配置文件已写入: $CONFIG_PATH"
