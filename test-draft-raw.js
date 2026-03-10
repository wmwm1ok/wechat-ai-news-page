#!/usr/bin/env node

// 直接测试微信草稿箱 API

import http from 'http';

const PROXY_URL = (process.env.WECHAT_PROXY_URL || '').replace(/^https:\/\//, 'http://');
const WECHAT_APPID = process.env.WECHAT_APPID;
const WECHAT_SECRET = process.env.WECHAT_SECRET;

function httpPost(urlPath, data, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${PROXY_URL}${urlPath}`);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: 80,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeout
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`解析失败: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🧪 测试微信草稿箱 API');
  console.log('====================');
  console.log(`Proxy: ${PROXY_URL}`);
  console.log(`AppID: ${WECHAT_APPID?.substring(0, 10)}...`);
  console.log('');
  
  try {
    // 1. 获取 token
    console.log('1️⃣ 获取 access_token...');
    const tokenRes = await httpPost('/wechat/token', {
      appid: WECHAT_APPID,
      secret: WECHAT_SECRET
    });
    
    if (!tokenRes.access_token) {
      console.error('❌ 获取 token 失败:', tokenRes);
      process.exit(1);
    }
    
    const accessToken = tokenRes.access_token;
    console.log(`✅ 获取成功`);
    console.log('');
    
    // 2. 添加草稿（简化字段）
    console.log('2️⃣ 调用 draft/add（简化字段）...');
    
    // 方法 A: 最简字段
    const articleA = {
      title: '测试文章 A ' + Date.now(),
      content: '<p>测试内容</p>'
    };
    
    console.log('   请求:', JSON.stringify({ articles: [articleA] }));
    
    const draftResA = await httpPost('/wechat/draft/add', {
      access_token: accessToken,
      articles: [articleA]
    });
    
    console.log('   响应:', JSON.stringify(draftResA, null, 2));
    
    if (draftResA.media_id) {
      console.log(`✅ 草稿 A 创建成功: ${draftResA.media_id}`);
    } else {
      console.log('❌ 草稿 A 创建失败');
      
      // 方法 B: 带更多字段
      console.log('');
      console.log('2️⃣-B 调用 draft/add（完整字段，无 thumb_media_id）...');
      
      const articleB = {
        title: '测试文章 B ' + Date.now(),
        author: 'AI日报',
        digest: '测试摘要',
        content: '<p>测试内容</p>',
        content_source_url: '',
        need_open_comment: 1,
        only_fans_can_comment: 0
      };
      
      const draftResB = await httpPost('/wechat/draft/add', {
        access_token: accessToken,
        articles: [articleB]
      });
      
      console.log('   响应:', JSON.stringify(draftResB, null, 2));
      
      if (draftResB.media_id) {
        console.log(`✅ 草稿 B 创建成功: ${draftResB.media_id}`);
      } else {
        console.log('❌ 草稿 B 也创建失败');
      }
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

main();
