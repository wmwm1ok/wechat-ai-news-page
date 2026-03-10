#!/usr/bin/env node

// 测试 Cloudflare Worker 连接

const PROXY_URL = (process.env.WECHAT_PROXY_URL || 'https://withered-cell-1281.wmwm1ok.workers.dev').replace('https://', 'http://');

console.log('测试 Cloudflare Worker 连接...');
console.log(`URL: ${PROXY_URL}`);
console.log('');

async function testFetch() {
  console.log('测试 1: 使用 fetch (如果可用)...');
  try {
    if (typeof fetch === 'undefined') {
      console.log('  fetch 不可用，跳过');
      return;
    }
    const res = await fetch(`${PROXY_URL}/wechat/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid: 'test', secret: 'test' })
    });
    const data = await res.json();
    console.log('  ✅ fetch 成功:', JSON.stringify(data).substring(0, 100));
  } catch (e) {
    console.log('  ❌ fetch 失败:', e.message);
  }
}

async function testHttps() {
  console.log('');
  console.log('测试 2: 使用 https 模块...');
  try {
    const https = await import('https');
    const url = new URL(`${PROXY_URL}/wechat/token`);
    const postData = JSON.stringify({ appid: 'test', secret: 'test' });
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('  ✅ https 成功:', data.substring(0, 100));
      });
    });
    
    req.on('error', (e) => {
      console.log('  ❌ https 失败:', e.message);
    });
    
    req.write(postData);
    req.end();
  } catch (e) {
    console.log('  ❌ https 失败:', e.message);
  }
}

async function testDNS() {
  console.log('');
  console.log('测试 3: DNS 解析...');
  try {
    const dns = await import('dns');
    const url = new URL(PROXY_URL);
    dns.lookup(url.hostname, (err, address) => {
      if (err) {
        console.log('  ❌ DNS 失败:', err.message);
      } else {
        console.log('  ✅ DNS 成功:', address);
      }
    });
  } catch (e) {
    console.log('  ❌ DNS 失败:', e.message);
  }
}

async function main() {
  await testFetch();
  await testHttps();
  await testDNS();
  
  setTimeout(() => {
    console.log('');
    console.log('测试完成');
    process.exit(0);
  }, 3000);
}

main();
