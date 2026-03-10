#!/usr/bin/env node

import Parser from 'rss-parser';
import { OVERSEAS_RSS_SOURCES, AI_KEYWORDS } from './src/config.js';

const rssParser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

function containsAIKeywords(text = '') {
  const lowerText = text.toLowerCase();
  return AI_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}

async function testRSS(source) {
  try {
    console.log(`\n📡 测试: ${source.name}`);
    console.log(`   URL: ${source.url}`);
    
    const feed = await rssParser.parseURL(source.url);
    const totalItems = feed.items.length;
    
    // 只取前5条检查
    const sample = feed.items.slice(0, 5).map(item => ({
      title: item.title || '',
      date: item.pubDate || item.isoDate || 'N/A'
    }));
    
    // AI相关过滤
    const aiItems = sample.filter(item => 
      containsAIKeywords(item.title)
    );
    
    console.log(`   ✅ 成功`);
    console.log(`   📊 总条目: ${totalItems}`);
    console.log(`   🤖 AI相关: ${aiItems.length}/5 (样本)`);
    
    if (aiItems.length > 0) {
      console.log('   📰 示例:');
      aiItems.slice(0, 2).forEach((item, i) => {
        console.log(`      ${i+1}. ${item.title.substring(0, 60)}...`);
      });
    }
    
    return { success: true, total: totalItems, aiCount: aiItems.length };
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🌍 海外 RSS 源测试');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const source of OVERSEAS_RSS_SOURCES) {
    const result = await testRSS(source);
    results.push({ name: source.name, ...result });
    
    // 延迟避免 rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  console.log(`\n✅ 成功: ${successCount}/${results.length}`);
  console.log(`❌ 失败: ${failCount}/${results.length}\n`);
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const detail = r.success ? `(AI: ${r.aiCount})` : `(${r.error})`;
    console.log(`${icon} ${r.name} ${detail}`);
  });
  
  if (failCount > 0) {
    console.log('\n⚠️  失败的源需要更换 URL 或移除');
    process.exit(1);
  } else {
    console.log('\n🎉 所有海外 RSS 源测试通过！');
    process.exit(0);
  }
}

main().catch(console.error);
