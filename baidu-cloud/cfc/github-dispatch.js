import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimeConfigPath = path.join(__dirname, 'github-dispatch-config.json');

function loadRuntimeConfig() {
  try {
    if (!fs.existsSync(runtimeConfigPath)) {
      return {};
    }

    const raw = fs.readFileSync(runtimeConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    console.log('🔐 已加载 GitHub Dispatch 配置文件');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn(`⚠️ 读取 GitHub Dispatch 配置失败: ${error.message}`);
    return {};
  }
}

const runtimeConfig = loadRuntimeConfig();

function getConfig(name) {
  const value = process.env[name] || runtimeConfig[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function parseInputs() {
  const raw = process.env.GITHUB_WORKFLOW_INPUTS_JSON || runtimeConfig.GITHUB_WORKFLOW_INPUTS_JSON;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch (error) {
    throw new Error(`GITHUB_WORKFLOW_INPUTS_JSON 不是合法 JSON: ${error.message}`);
  }
}

export async function handler() {
  const owner = process.env.GITHUB_OWNER || runtimeConfig.GITHUB_OWNER || 'wmwm1ok';
  const repo = process.env.GITHUB_REPO || runtimeConfig.GITHUB_REPO || 'wechat-ai-news-page';
  const workflowId = process.env.GITHUB_WORKFLOW_ID || runtimeConfig.GITHUB_WORKFLOW_ID || 'daily-news.yml';
  const ref = process.env.GITHUB_REF || runtimeConfig.GITHUB_REF || 'main';
  const token = getConfig('GITHUB_TOKEN');
  const inputs = parseInputs();

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
  const body = {
    ref
  };

  if (inputs) {
    body.inputs = inputs;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub workflow_dispatch 失败: ${response.status} ${text}`);
  }

  console.log(`✅ 已触发 GitHub workflow_dispatch: ${owner}/${repo} ${workflowId} @ ${ref}`);

  return {
    ok: true,
    owner,
    repo,
    workflowId,
    ref,
    dispatchedAt: new Date().toISOString()
  };
}
