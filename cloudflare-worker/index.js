/**
 * Cloudflare Worker - 微信 API 代理
 * 
 * 作用：提供固定 IP 出口，避免 GitHub Actions IP 变化导致微信白名单问题
 * 部署后，将 Cloudflare IP 段添加到微信白名单即可
 */

// CORS 配置
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    
    try {
      // 路由：获取微信 access_token
      if (url.pathname === '/wechat/token') {
        return await handleGetToken(request, env);
      }
      
      // 路由：上传图文素材
      if (url.pathname === '/wechat/uploadnews') {
        return await handleUploadNews(request, env);
      }
      
      // 路由：发布图文消息
      if (url.pathname === '/wechat/publish') {
        return await handlePublish(request, env);
      }
      
      // 默认：返回说明
      return new Response(JSON.stringify({
        message: '微信 API 代理服务',
        endpoints: [
          'POST /wechat/token - 获取 access_token',
          'POST /wechat/uploadnews - 上传图文素材',
          'POST /wechat/publish - 发布图文消息'
        ]
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * 获取微信 access_token
 */
async function handleGetToken(request, env) {
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
 * 上传图文素材
 */
async function handleUploadNews(request, env) {
  const { access_token, articles } = await request.json();
  
  if (!access_token || !articles) {
    return jsonResponse({ error: '缺少 access_token 或 articles' }, 400);
  }
  
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
 * 发布图文消息（群发或发布）
 */
async function handlePublish(request, env) {
  const { access_token, media_id, type = 'publish' } = await request.json();
  
  if (!access_token || !media_id) {
    return jsonResponse({ error: '缺少 access_token 或 media_id' }, 400);
  }
  
  let apiUrl;
  let body;
  
  if (type === 'publish') {
    // 发布到公众号（不推送）
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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
