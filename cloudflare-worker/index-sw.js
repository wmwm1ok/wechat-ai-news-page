/**
 * Cloudflare Worker - 微信 API 代理 (Service Worker 格式)
 * 更新：使用新的草稿箱 API 替代已弃用的 add_news
 */

// CORS 配置
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

/**
 * 获取微信 access_token
 */
async function handleGetToken(request) {
  const { appid, secret } = await request.json();
  
  if (!appid || !secret) {
    return jsonResponse({ error: '缺少 appid 或 secret' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
  );
  
  const data = await response.json();
  return jsonResponse(data);
}

/**
 * 添加草稿（替代已弃用的 add_news）
 */
async function handleAddDraft(request) {
  const { access_token, articles } = await request.json();
  
  if (!access_token || !articles) {
    return jsonResponse({ error: '缺少 access_token 或 articles' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles })
    }
  );
  
  const data = await response.json();
  return jsonResponse(data);
}

/**
 * 发布草稿（群发或发布）
 */
async function handlePublish(request) {
  const { access_token, media_id, type = 'publish' } = await request.json();
  
  if (!access_token || !media_id) {
    return jsonResponse({ error: '缺少 access_token 或 media_id' }, 400);
  }
  
  let apiUrl;
  let body;
  
  if (type === 'publish') {
    // 发布到公众号（不推送）- 使用草稿发布接口
    apiUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${access_token}`;
    body = { media_id };
  } else {
    // 群发推送
    apiUrl = `https://api.weixin.qq.com/cgi-bin/message/mass/sendall?access_token=${access_token}`;
    body = {
      filter: { is_to_all: true },
      mpnews: { media_id },
      msgtype: 'mpnews',
      send_ignore_reprint: 0
    };
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return jsonResponse(data);
}

/**
 * 获取草稿列表（用于调试）
 */
async function handleGetDrafts(request) {
  const { access_token } = await request.json();
  
  if (!access_token) {
    return jsonResponse({ error: '缺少 access_token' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/count?access_token=${access_token}`
  );
  
  const data = await response.json();
  return jsonResponse(data);
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  
  try {
    if (url.pathname === '/wechat/token') {
      return await handleGetToken(request);
    }
    
    // 新的草稿箱 API
    if (url.pathname === '/wechat/draft/add') {
      return await handleAddDraft(request);
    }
    
    // 兼容旧路径，实际使用草稿接口
    if (url.pathname === '/wechat/uploadnews') {
      return await handleAddDraft(request);
    }
    
    if (url.pathname === '/wechat/publish') {
      return await handlePublish(request);
    }
    
    if (url.pathname === '/wechat/drafts') {
      return await handleGetDrafts(request);
    }
    
    return jsonResponse({
      message: '微信 API 代理服务（已更新为草稿箱 API）',
      endpoints: [
        'POST /wechat/token - 获取 access_token',
        'POST /wechat/draft/add - 添加草稿（新）',
        'POST /wechat/uploadnews - 添加草稿（兼容旧接口）',
        'POST /wechat/publish - 发布草稿',
        'POST /wechat/drafts - 获取草稿数量'
      ],
      note: '已弃用的 add_news API 已替换为 draft/add'
    });
    
  } catch (error) {
    return jsonResponse({
      error: error.message,
      stack: error.stack
    }, 500);
  }
}
