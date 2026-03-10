#!/usr/bin/env node

import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews } from './ai-summarizer.js';
import { selectTopNews } from './news-scorer.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import fs from 'fs/promises';
import path from 'path';

function getBeijingDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day
  };
}

function getBeijingDateString(date = new Date()) {
  const { year, month, day } = getBeijingDateParts(date);
  return `${year}-${month}-${day}`;
}

function getBeijingDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(date);
}

function getBeijingDisplayDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

async function saveOutput(filename, content) {
  const outputDir = 'output';
  await fs.mkdir(outputDir, { recursive: true });
  
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`💾 已保存: ${filepath}`);
  
  // latest.json 同时保存到根目录，供网站直接访问
  if (filename === 'latest.json') {
    await fs.writeFile(filename, content, 'utf-8');
    console.log(`💾 已保存: ${filename}`);
  }
  
  return filepath;
}

/**
 * 加载昨天的新闻（用于跨天去重）
 * 返回包含标题、URL、摘要的完整信息
 */
async function loadYesterdayNews() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = getBeijingDateString(yesterday);
    
    const filepath = path.join('output', `news-${dateStr}.json`);
    
    // 读取文件
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    
    // 从所有分类中提取完整新闻信息
    const news = [];
    for (const category of Object.values(data)) {
      if (Array.isArray(category)) {
        for (const item of category) {
          if (item.title) {
            news.push({
              title: item.title,
              url: item.url || '',
              summary: item.summary || '',
              source: item.source || ''
            });
          }
        }
      }
    }
    
    console.log(`📅 加载昨日新闻: ${news.length} 条（${dateStr}）`);
    return news;
  } catch (error) {
    // 文件不存在或读取失败，返回空数组
    console.log('⚠️  未找到昨日新闻文件，跨天去重功能未生效');
    console.log('   提示: 如使用 GitHub Actions 无需处理');
    console.log('   本地运行请先执行: git pull origin main');
    return [];
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 AI 新闻智能筛选系统 (专业版)');
  console.log('='.repeat(60) + '\n');
  
  // 检查 API Key
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ 缺少 DEEPSEEK_API_KEY');
    process.exit(1);
  }
  
  console.log('🔧 环境检查: DEEPSEEK_API_KEY ✅\n');
  
  // 1. 抓取新闻
  const news = await fetchAllNews();
  
  if (news.domestic.length === 0 && news.overseas.length === 0) {
    console.error('❌ 没有获取到任何新闻');
    process.exit(1);
  }
  
  console.log(`\n📊 抓取完成: 国内 ${news.domestic.length} 条, 海外 ${news.overseas.length} 条`);
  
  // 2. AI 总结和分类
  const allNews = await summarizeNews(news);
  
  console.log(`\n📝 AI总结完成: ${allNews.length} 条新闻`);
  
  // 3. 加载昨天的新闻（跨天去重）
  const yesterdayNews = await loadYesterdayNews();
  
  // 4. 质量评分和智能筛选（带上昨天新闻进行语义去重）
  console.log('\n🎯 开始质量评分...');
  const topNews = selectTopNews(allNews, 14, yesterdayNews);
  
  if (topNews.length === 0) {
    console.error('❌ 没有符合质量标准的新闻');
    process.exit(1);
  }
  
  // 5. 标准化分类并分组
  const standardCategories = ['产品发布与更新', '技术与研究', '投融资与并购', '政策与监管'];
  
  // 股市/行情关键词（用于二次检查分类）
  const stockKeywords = ['股市', '股指', '指数', '大盘', '收涨', '收跌', '涨停', '跌停', 'A股', '港股', '美股', '三大指数', '集体收涨', '集体下跌', '行情', '股价', '市值'];
  
  // 将非标准分类映射到标准分类
  for (const news of topNews) {
    // 先检查是否是股市新闻（二次保险）
    const isStockNews = stockKeywords.some(kw => news.title.includes(kw));
    
    if (isStockNews) {
      // 股市新闻除非是AI公司相关，否则标记为需要过滤
      const aiCompanyMentioned = ['英伟达', 'NVIDIA', '特斯拉', 'Tesla', '微软', 'Microsoft', '谷歌', 'Google', 'OpenAI', 'Meta', '苹果', 'Apple'].some(c => 
        news.title.includes(c)
      );
      if (!aiCompanyMentioned) {
        // 标记为低优先级，后续可以过滤
        news.category = '其他';
        continue;
      }
    }
    
    if (!standardCategories.includes(news.category)) {
      // 根据关键词映射
      const t = news.title.toLowerCase();
      if (t.includes('发布') || t.includes('上线') || t.includes('推出') || t.includes('推出') || t.includes('更新')) {
        news.category = '产品发布与更新';
      } else if (t.includes('融资') || t.includes('投资') || t.includes('收购') || t.includes('并购')) {
        news.category = '投融资与并购';
      } else if (t.includes('政策') || t.includes('监管') || t.includes('法规') || t.includes('合规')) {
        news.category = '政策与监管';
      } else if (t.includes('论文') || t.includes('研究') || t.includes('模型') || t.includes('算法') || t.includes('技术')) {
        news.category = '技术与研究';
      } else {
        // 默认分类，如果内容不够AI相关，也可以考虑过滤
        news.category = '技术与研究';
      }
    }
  }
  
  const grouped = {};
  for (const section of standardCategories) {
    grouped[section] = topNews.filter(n => n.category === section);
  }
  
  const totalNews = topNews.length;
  
  // 6. 生成 HTML
  const html = generateHTML(grouped);
  const wechatHtml = generateWechatHTML(grouped);
  
  const now = new Date();
  const date = getBeijingDateString(now);
  await saveOutput(`newsletter-${date}.html`, html);
  await saveOutput(`wechat-${date}.html`, wechatHtml);
  
  // 7. 生成 JSON
  const jsonData = {
    date: getBeijingDisplayDate(now),
    generatedAt: getBeijingDisplayDateTime(now),
    count: totalNews,
    articles: topNews.map(item => ({
      section: item.category,
      title: item.title,
      company: item.company || '',
      url: item.url || '',
      source: item.source,
      publishedAt: item.publishedAt,
      summary: item.summary,
      score: item.score,
      matchedKeywords: item.matchedKeywords
    }))
  };
  await saveOutput('latest.json', JSON.stringify(jsonData, null, 2));
  await saveOutput(`news-${date}.json`, JSON.stringify(grouped, null, 2));
  
  // 8. 统计输出
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 最终输出统计');
  console.log('='.repeat(60));
  console.log(`总计: ${totalNews} 条高质量新闻`);
  console.log('\n分类分布:');
  for (const [section, items] of Object.entries(grouped)) {
    if (items.length > 0) {
      const domestic = items.filter(i => i.region === '国内').length;
      const overseas = items.filter(i => i.region === '海外').length;
      console.log(`   ${section}: ${items.length} 条 (🇨🇳${domestic}/🇺🇸${overseas})`);
    }
  }
  
  console.log('\n✅ 全部完成！');
  console.log('='.repeat(60) + '\n');
}

main().catch(error => {
  console.error('\n❌ 错误:', error.message);
  process.exit(1);
});
