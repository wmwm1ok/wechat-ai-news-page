/**
 * Cloudflare Worker - 微信 API 代理（适配未认证公众号）
 * 
 * 未认证公众号限制：
 * - 没有草稿箱 API
 * - 群发次数限制（订阅号每天1条，服务号每月4条）
 * - 使用基础素材接口
 */

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
 * 上传图文消息素材（使用永久素材接口，未认证公众号可用）
 */
async function handleUploadNews(request) {
  const { access_token, articles } = await request.json();
  
  if (!access_token || !articles) {
    return jsonResponse({ error: '缺少 access_token 或 articles' }, 400);
  }
  
  // 使用永久素材接口（未认证公众号可用）
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_news?access_token=${access_token}`,
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
 * 上传图文消息（使用 message/custom/send 预览方式）
 * 未认证公众号可以通过客服消息接口发送
 */
async function handlePreviewNews(request) {
  const { access_token, touser, mpnews } = await request.json();
  
  if (!access_token || !touser || !mpnews) {
    return jsonResponse({ error: '缺少必要参数' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser,
        msgtype: 'mpnews',
        mpnews
      })
    }
  );
  
  const data = await response.json();
  return jsonResponse(data);
}

/**
 * 群发预览（用于未认证公众号测试）
 */
async function handleMassPreview(request) {
  const { access_token, touser, media_id } = await request.json();
  
  if (!access_token || !touser || !media_id) {
    return jsonResponse({ error: '缺少必要参数' }, 400);
  }
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/mass/preview?access_token=${access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser,
        mpnews: { media_id },
        msgtype: 'mpnews'
      })
    }
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
    
    // 永久素材接口（未认证公众号可用）
    if (url.pathname === '/wechat/material/add_news') {
      return await handleUploadNews(request);
    }
    
    // 客服消息预览（未认证公众号可用）
    if (url.pathname === '/wechat/preview') {
      return await handlePreviewNews(request);
    }
    
    // 群发预览
    if (url.pathname === '/wechat/mass/preview') {
      return await handleMassPreview(request);
    }
    
    return jsonResponse({
      message: '微信 API 代理服务（未认证公众号版）',
      note: '未认证公众号限制：每天可群发1条（订阅号）',
      endpoints: [
        'POST /wechat/token - 获取 access_token',
        'POST /wechat/material/add_news - 上传图文素材',
        'POST /wechat/preview - 客服消息预览',
        'POST /wechat/mass/preview - 群发预览'
      ]
    });
    
  } catch (error) {
    return jsonResponse({
      error: error.message,
      stack: error.stack
    }, 500);
  }
}
