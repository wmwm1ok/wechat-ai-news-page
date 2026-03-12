#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/baidu-cloud/dist/github-dispatch-package"
ZIP_PATH="$ROOT_DIR/baidu-cloud/dist/github-dispatch.zip"
CONFIG_PATH="$DIST_DIR/github-dispatch-config.json"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/baidu-cloud/cfc/github-dispatch.js" "$DIST_DIR/index.js"

cat > "$DIST_DIR/package.json" <<'JSON'
{
  "name": "github-dispatch-trigger",
  "version": "1.0.0",
  "type": "module"
}
JSON

node - <<'NODE' > "$CONFIG_PATH"
const config = {
  GITHUB_OWNER: process.env.GITHUB_OWNER || '',
  GITHUB_REPO: process.env.GITHUB_REPO || '',
  GITHUB_WORKFLOW_ID: process.env.GITHUB_WORKFLOW_ID || 'daily-news.yml',
  GITHUB_REF: process.env.GITHUB_REF || 'main',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_WORKFLOW_INPUTS_JSON: process.env.GITHUB_WORKFLOW_INPUTS_JSON || ''
};

process.stdout.write(JSON.stringify(config, null, 2));
NODE

pushd "$DIST_DIR" >/dev/null
zip -qr "$ZIP_PATH" .
popd >/dev/null

echo "GitHub Dispatch 部署包已生成: $ZIP_PATH"
echo "GitHub Dispatch 配置文件已写入: $CONFIG_PATH"
