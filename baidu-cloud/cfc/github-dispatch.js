function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function parseInputs() {
  const raw = process.env.GITHUB_WORKFLOW_INPUTS_JSON;
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
  const owner = requireEnv('GITHUB_OWNER');
  const repo = requireEnv('GITHUB_REPO');
  const workflowId = process.env.GITHUB_WORKFLOW_ID || 'daily-news.yml';
  const ref = process.env.GITHUB_REF || 'main';
  const token = requireEnv('GITHUB_TOKEN');
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
