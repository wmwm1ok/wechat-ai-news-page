import fs from 'fs/promises';
import path from 'path';
import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews, refineSelectedNews, isDisplayReadyNews, isReaderFriendlySummary, normalizeDisplaySummary } from './ai-summarizer.js';
import { selectTopNews } from './news-scorer.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import {
  getBeijingDateString,
  getBeijingDisplayDate,
  getBeijingDisplayDateTime
} from './date-utils.js';

async function saveOutput(baseDir, filename, content) {
  const outputDir = path.join(baseDir, 'output');
  await fs.mkdir(outputDir, { recursive: true });

  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`💾 已保存: ${filepath}`);

  if (filename === 'latest.json') {
    const latestPath = path.join(baseDir, filename);
    await fs.writeFile(latestPath, content, 'utf-8');
    console.log(`💾 已保存: ${latestPath}`);
  }

  return filepath;
}

async function loadYesterdayNews(baseDir, referenceDate = new Date()) {
  try {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = getBeijingDateString(yesterday);
    const filepath = path.join(baseDir, 'output', `news-${dateStr}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);

    const news = [];
    for (const category of Object.values(data)) {
      if (!Array.isArray(category)) {
        continue;
      }

      for (const item of category) {
        if (!item.title) {
          continue;
        }

        news.push({
          title: item.title,
          url: item.url || '',
          summary: item.summary || '',
          source: item.source || ''
        });
      }
    }

    console.log(`📅 加载昨日新闻: ${news.length} 条（${dateStr}）`);
    return news;
  } catch {
    console.log('⚠️  未找到昨日新闻文件，跨天去重功能未生效');
    return [];
  }
}

function normalizeCategories(topNews) {
  const standardCategories = ['产品发布与更新', '技术与研究', '投融资与并购', '政策与监管'];
  const stockKeywords = ['股市', '股指', '指数', '大盘', '收涨', '收跌', '涨停', '跌停', 'A股', '港股', '美股', '三大指数', '集体收涨', '集体下跌', '行情', '股价', '市值'];

  for (const news of topNews) {
    const isStockNews = stockKeywords.some(kw => news.title.includes(kw));

    if (isStockNews) {
      const aiCompanyMentioned = ['英伟达', 'NVIDIA', '特斯拉', 'Tesla', '微软', 'Microsoft', '谷歌', 'Google', 'OpenAI', 'Meta', '苹果', 'Apple'].some(company =>
        news.title.includes(company)
      );
      if (!aiCompanyMentioned) {
        news.category = '其他';
        continue;
      }
    }

    if (standardCategories.includes(news.category)) {
      continue;
    }

    const title = news.title.toLowerCase();
    if (title.includes('发布') || title.includes('上线') || title.includes('推出') || title.includes('更新')) {
      news.category = '产品发布与更新';
    } else if (title.includes('融资') || title.includes('投资') || title.includes('收购') || title.includes('并购')) {
      news.category = '投融资与并购';
    } else if (title.includes('政策') || title.includes('监管') || title.includes('法规') || title.includes('合规')) {
      news.category = '政策与监管';
    } else {
      news.category = '技术与研究';
    }
  }

  const grouped = {};
  for (const section of standardCategories) {
    grouped[section] = topNews.filter(item => item.category === section);
  }

  return grouped;
}

export async function runDailyNews(options = {}) {
  const {
    baseDir = process.cwd(),
    now = new Date(),
    targetCount = 14
  } = options;

  console.log('\n' + '='.repeat(60));
  console.log('🚀 AI 新闻智能筛选系统 (专业版)');
  console.log('='.repeat(60) + '\n');

  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('缺少 DEEPSEEK_API_KEY');
  }

  console.log('🔧 环境检查: DEEPSEEK_API_KEY ✅\n');

  const news = await fetchAllNews();
  if (news.domestic.length === 0 && news.overseas.length === 0) {
    throw new Error('没有获取到任何新闻');
  }

  console.log(`\n📊 抓取完成: 国内 ${news.domestic.length} 条, 海外 ${news.overseas.length} 条`);

  const allNews = await summarizeNews(news);
  console.log(`\n📝 AI总结完成: ${allNews.length} 条新闻`);

  const yesterdayNews = await loadYesterdayNews(baseDir, now);
  const candidateTargetCount = Math.max(targetCount + 8, Math.ceil(targetCount * 1.6));

  console.log('\n🎯 开始质量评分...');
  const selectedNews = selectTopNews(allNews, candidateTargetCount, yesterdayNews);
  const refinedNews = await refineSelectedNews(selectedNews);
  const normalizedRefinedNews = refinedNews.map(item => ({
    ...item,
    summary: normalizeDisplaySummary(item.summary)
  }));
  const displayReadyNews = normalizedRefinedNews.filter(item => isDisplayReadyNews(item));
  const fallbackDisplayNews = normalizedRefinedNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title)) &&
    isReaderFriendlySummary(item.summary)
  );
  const topNews = [...displayReadyNews, ...fallbackDisplayNews].slice(0, targetCount);
  const removedWeakSummaries = refinedNews.length - displayReadyNews.length;
  const fallbackDisplayCount = Math.max(0, topNews.length - displayReadyNews.length);
  if (removedWeakSummaries > 0) {
    console.log(`\n🧽 摘要净化: 过滤掉 ${removedWeakSummaries} 条不适合直接展示给读者的摘要`);
  }
  if (fallbackDisplayCount > 0) {
    console.log(`\n🩹 展示补位: 使用 ${fallbackDisplayCount} 条较弱但可读的摘要补足版面`);
  }
  if (topNews.length === 0) {
    throw new Error('没有符合质量标准的新闻');
  }

  if (topNews.length < targetCount) {
    console.log(`\n⚠️ 最终展示条数不足: 目标 ${targetCount} 条，实际 ${topNews.length} 条`);
  }

  const grouped = normalizeCategories(topNews);
  const html = generateHTML(grouped);
  const wechatHtml = generateWechatHTML(grouped);
  const date = getBeijingDateString(now);

  const newsletterPath = await saveOutput(baseDir, `newsletter-${date}.html`, html);
  const wechatPath = await saveOutput(baseDir, `wechat-${date}.html`, wechatHtml);

  const jsonData = {
    date: getBeijingDisplayDate(now),
    generatedAt: getBeijingDisplayDateTime(now),
    count: topNews.length,
    targetCount,
    diagnostics: {
      targetCount,
      candidateTargetCount,
      fetch: news.stats,
      summarize: {
        totalSummarized: allNews.length
      },
      scoring: {
        totalInput: selectedNews.diagnostics?.totalInput || allNews.length,
        totalScored: selectedNews.diagnostics?.totalScored || 0,
        strictScoredCount: selectedNews.diagnostics?.strictScoredCount || 0,
        relaxedCandidateCount: selectedNews.diagnostics?.relaxedCandidateCount || 0,
        relaxedUsedForSelection: selectedNews.diagnostics?.relaxedUsedForSelection || false,
        weakSummaryCount: selectedNews.diagnostics?.weakSummaryCount || 0,
        selectedCandidateCount: selectedNews.length,
        duplicateCount: selectedNews.diagnostics?.duplicateCount || 0,
        crossDayDuplicateCount: selectedNews.diagnostics?.crossDayDuplicateCount || 0,
        lowQualityCount: selectedNews.diagnostics?.lowQualityCount || 0,
        domesticAvailable: selectedNews.diagnostics?.domesticAvailable || 0,
        overseasAvailable: selectedNews.diagnostics?.overseasAvailable || 0,
        sourceCount: selectedNews.diagnostics?.sourceCount || {}
      },
      display: {
        refinedCount: refinedNews.length,
        displayReadyCount: displayReadyNews.length,
        fallbackDisplayCount,
        removedWeakSummaries,
        shortage: Math.max(0, targetCount - topNews.length)
      }
    },
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

  const latestOutputJsonPath = await saveOutput(baseDir, 'latest.json', JSON.stringify(jsonData, null, 2));
  const historyJsonPath = await saveOutput(baseDir, `news-${date}.json`, JSON.stringify(grouped, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 最终输出统计');
  console.log('='.repeat(60));
  console.log(`总计: ${topNews.length} 条高质量新闻`);
  console.log('\n分类分布:');
  for (const [section, items] of Object.entries(grouped)) {
    if (items.length === 0) {
      continue;
    }

    const domestic = items.filter(item => item.region === '国内').length;
    const overseas = items.filter(item => item.region === '海外').length;
    console.log(`   ${section}: ${items.length} 条 (🇨🇳${domestic}/🇺🇸${overseas})`);
  }

  console.log('\n✅ 全部完成！');
  console.log('='.repeat(60) + '\n');

  return {
    baseDir,
    date,
    generatedAt: jsonData.generatedAt,
    totalNews: topNews.length,
    files: {
      latestJsonPath: path.join(baseDir, 'latest.json'),
      latestOutputJsonPath,
      historyJsonPath,
      newsletterPath,
      wechatPath
    }
  };
}
