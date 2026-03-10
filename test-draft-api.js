#!/usr/bin/env node

// 测试微信草稿箱 API

import { CONFIG } from './src/config.js';
import { getAccessTokenViaProxy, uploadNewsMaterialViaProxy, publishViaProxy } from './src/wechat-proxy-client.js';

console.log('🧪 测试微信草稿箱 API');
console.log('====================');
console.log('');

const TEST_ARTICLE = {
  title: '测试文章 ' + new Date().toLocaleString('zh-CN'),
  content: '<p>这是一篇测试文章</p>',
  digest: '测试摘要',
  author: 'AI日报',
  thumbMediaId: '',
  showCoverPic: 0,
  needOpenComment: 1,
  onlyFansCanComment: 0
};

async function main() {
  try {
    // 1. 获取 access_token
    console.log('1️⃣ 获取 access_token...');
    const accessToken = await getAccessTokenViaProxy();
    console.log(`   Token: ${accessToken.substring(0, 10)}...`);
    console.log('');
    
    // 2. 添加草稿
    console.log('2️⃣ 添加草稿...');
    const mediaId = await uploadNewsMaterialViaProxy([TEST_ARTICLE], accessToken);
    console.log(`   Media ID: ${mediaId}`);
    console.log('');
    
    // 3. 发布草稿
    console.log('3️⃣ 发布草稿...');
    const result = await publishViaProxy(mediaId, accessToken, true);
    console.log(`   发布结果: ${JSON.stringify(result)}`);
    console.log('');
    
    console.log('✅ 所有测试通过！');
    
  } catch (error) {
    console.error('');
    console.error('❌ 测试失败:', error.message);
    console.error('');
    console.error('详细错误:');
    console.error(error);
    process.exit(1);
  }
}

main();
