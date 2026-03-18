import fs from 'fs/promises';
import path from 'path';
import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews, refineSelectedNews, isDisplayReadyNews, isReaderFriendlySummary, isSummaryComplete, normalizeDisplaySummary } from './ai-summarizer.js';
import { checkSemanticDuplicate, scoreNews, selectTopNews } from './news-scorer.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import {
  getBeijingDateString,
  getBeijingDisplayDate,
  getBeijingDisplayDateTime,
  getEditionMeta,
  getPreviousEditionInfo,
  normalizeNewsEdition
} from './date-utils.js';

async function saveOutput(baseDir, filename, content) {
  const outputDir = path.join(baseDir, 'output');
  await fs.mkdir(outputDir, { recursive: true });

  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`💾 已保存: ${filepath}`);

  if (filename === 'latest.json' || filename.startsWith('latest-')) {
    const rootPath = path.join(baseDir, filename);
    await fs.writeFile(rootPath, content, 'utf-8');
    console.log(`💾 已保存: ${rootPath}`);
  }

  return filepath;
}

function flattenNewsItems(data) {
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

  return news;
}

async function loadPreviousEditionNews(baseDir, referenceDate = new Date(), edition = 'morning') {
  const primaryPrevious = getPreviousEditionInfo(referenceDate, edition);
  const fallbackDate = primaryPrevious.edition === 'afternoon'
    ? getPreviousEditionInfo(primaryPrevious.date, 'morning')
    : primaryPrevious;
  const candidateFiles = [
    path.join(baseDir, 'output', `news-${primaryPrevious.dateString}-${primaryPrevious.edition}.json`),
    path.join(baseDir, 'output', `news-${primaryPrevious.dateString}.json`),
    path.join(baseDir, 'output', `news-${fallbackDate.dateString}-${fallbackDate.edition}.json`),
    path.join(baseDir, 'output', `news-${fallbackDate.dateString}.json`)
  ];

  for (const filepath of candidateFiles) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);
      const news = flattenNewsItems(data);
      const filename = path.basename(filepath);
      console.log(`📅 加载上一版新闻: ${news.length} 条（${filename}）`);
      return {
        news,
        sourceFile: filename
      };
    } catch {
      // continue
    }
  }

  console.log('⚠️  未找到上一版新闻文件，跨版次去重功能未生效');
  return {
    news: [],
    sourceFile: ''
  };
}

function buildEditionOutputName(prefix, date, edition, extension) {
  return `${prefix}-${date}-${edition}.${extension}`;
}

function filterAgainstPreviousEdition(items, previousNews) {
  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(previousNews) || previousNews.length === 0) {
    return {
      kept: items || [],
      removed: []
    };
  }

  const removed = [];
  const kept = [];

  for (const item of items) {
    const duplicateCheck = checkSemanticDuplicate(item, previousNews);
    if (duplicateCheck.isDuplicate) {
      removed.push({
        title: item.title,
        source: item.source,
        reason: duplicateCheck.reason,
        matchedWith: duplicateCheck.matchedWith || ''
      });
    } else {
      kept.push(item);
    }
  }

  return { kept, removed };
}

function filterFinalIntegrity(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      kept: items || [],
      removed: []
    };
  }

  const kept = [];
  const removed = [];

  for (const item of items) {
    const integrityCheck = scoreNews(item, []);
    if (integrityCheck.isDuplicate) {
      removed.push({
        title: item.title,
        source: item.source,
        reason: integrityCheck.reason || '最终展示前一致性校验未通过'
      });
      continue;
    }

    kept.push(item);
  }

  return { kept, removed };
}

async function loadYesterdayNews(baseDir, referenceDate = new Date()) {
  try {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = getBeijingDateString(yesterday);
    const filepath = path.join(baseDir, 'output', `news-${dateStr}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    const news = flattenNewsItems(data);

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

function getFinalCategoryPlan(targetCount) {
  const basePlan = [
    { category: '产品发布与更新', quota: 3 },
    { category: '技术与研究', quota: 3 },
    { category: '投融资与并购', quota: 2 },
    { category: '政策与监管', quota: 1 }
  ];

  if (targetCount >= 14) {
    return basePlan;
  }

  const scaledPlan = [
    { category: '产品发布与更新', quota: Math.max(1, Math.round(targetCount * 0.2)) },
    { category: '技术与研究', quota: Math.max(1, Math.round(targetCount * 0.2)) },
    { category: '投融资与并购', quota: Math.max(1, Math.round(targetCount * 0.15)) },
    { category: '政策与监管', quota: targetCount >= 6 ? 1 : 0 }
  ];

  let totalQuota = scaledPlan.reduce((sum, item) => sum + item.quota, 0);
  while (totalQuota > targetCount) {
    const shrinkable = [...scaledPlan].reverse().find(item => item.quota > (item.category === '政策与监管' ? 0 : 1));
    if (!shrinkable) break;
    shrinkable.quota -= 1;
    totalQuota -= 1;
  }

  return scaledPlan.filter(item => item.quota > 0);
}

export function selectBalancedFinalNews(candidates, targetCount) {
  if (!Array.isArray(candidates) || candidates.length <= targetCount) {
    return candidates || [];
  }

  const selected = [];
  const selectedKeys = new Set();
  const plan = getFinalCategoryPlan(targetCount);

  const trySelect = (item) => {
    const key = item.url || item.title;
    if (selectedKeys.has(key)) {
      return false;
    }

    selected.push(item);
    selectedKeys.add(key);
    return true;
  };

  for (const { category, quota } of plan) {
    let picked = 0;
    for (const item of candidates) {
      if (selected.length >= targetCount || picked >= quota) {
        break;
      }
      if (item.category !== category) {
        continue;
      }
      if (trySelect(item)) {
        picked += 1;
      }
    }
  }

  for (const item of candidates) {
    if (selected.length >= targetCount) {
      break;
    }
    trySelect(item);
  }

  return selected;
}

export async function runDailyNews(options = {}) {
  const {
    baseDir = process.cwd(),
    now = new Date(),
    targetCount = 14,
    edition: requestedEdition
  } = options;
  const edition = normalizeNewsEdition(requestedEdition || process.env.NEWS_EDITION, now);
  const editionMeta = getEditionMeta(edition, now);

  console.log('\n' + '='.repeat(60));
  console.log(`🚀 AI 新闻智能筛选系统 (专业版 · ${editionMeta.label})`);
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

  const previousEditionData = await loadPreviousEditionNews(baseDir, now, edition);
  const previousEditionNews = previousEditionData.news.length > 0
    ? previousEditionData.news
    : await loadYesterdayNews(baseDir, now);
  const candidateTargetCount = Math.max(targetCount + 8, Math.ceil(targetCount * 1.6));

  console.log('\n🎯 开始质量评分...');
  const selectedNews = selectTopNews(allNews, candidateTargetCount, previousEditionNews);
  const refinedNews = await refineSelectedNews(selectedNews);
  const normalizedRefinedNews = refinedNews.map(item => ({
    ...item,
    summary: normalizeDisplaySummary(item.summary)
  }));
  const previousEditionFiltered = filterAgainstPreviousEdition(normalizedRefinedNews, previousEditionNews);
  if (previousEditionFiltered.removed.length > 0) {
    console.log(`\n🧱 跨版次去重: 额外过滤 ${previousEditionFiltered.removed.length} 条与上一版重复的候选`);
  }
  const integrityFiltered = filterFinalIntegrity(previousEditionFiltered.kept);
  if (integrityFiltered.removed.length > 0) {
    console.log(`\n🧪 最终一致性过滤: 额外过滤 ${integrityFiltered.removed.length} 条标题与摘要不一致或相关性不足的候选`);
  }
  const filteredRefinedNews = integrityFiltered.kept;
  const displayReadyNews = filteredRefinedNews.filter(item => isDisplayReadyNews(item));
  const fallbackDisplayNews = filteredRefinedNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title)) &&
    isSummaryComplete(item.summary) &&
    isReaderFriendlySummary(item.summary)
  );
  const eligibleDisplayNews = [...displayReadyNews, ...fallbackDisplayNews];
  const topNews = selectBalancedFinalNews(eligibleDisplayNews, targetCount);
  const removedWeakSummaries = filteredRefinedNews.length - displayReadyNews.length;
  const fallbackDisplayCount = topNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title))
  ).length;
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
  const date = getBeijingDateString(now);
  const displayDate = getBeijingDisplayDate(now);
  const displayTitle = `${editionMeta.title}（${editionMeta.englishLabel}）`;
  const subtitle = `${displayDate} · 北京时间 ${editionMeta.releaseTime} 版`;
  const footerText = `${displayTitle} · ${displayDate}`;
  const html = generateHTML(grouped, { title: displayTitle, subtitle, footerText });
  const wechatHtml = generateWechatHTML(grouped, { title: displayTitle, subtitle, footerText });

  const newsletterPath = await saveOutput(baseDir, buildEditionOutputName('newsletter', date, edition, 'html'), html);
  const wechatPath = await saveOutput(baseDir, buildEditionOutputName('wechat', date, edition, 'html'), wechatHtml);

  const jsonData = {
    date: displayDate,
    edition,
    editionLabel: editionMeta.label,
    title: displayTitle,
    generatedAt: getBeijingDisplayDateTime(now),
    count: topNews.length,
    targetCount,
    diagnostics: {
      previousEditionFile: previousEditionData.sourceFile || '',
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
        previousEditionRemovedCount: previousEditionFiltered.removed.length,
        integrityRemovedCount: integrityFiltered.removed.length,
        postEditionFilterCount: filteredRefinedNews.length,
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

  const latestEditionOutputJsonPath = await saveOutput(baseDir, `latest-${edition}.json`, JSON.stringify(jsonData, null, 2));
  const latestOutputJsonPath = await saveOutput(baseDir, 'latest.json', JSON.stringify(jsonData, null, 2));
  const historyJsonPath = await saveOutput(baseDir, buildEditionOutputName('news', date, edition, 'json'), JSON.stringify(grouped, null, 2));

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
      latestEditionOutputJsonPath,
      historyJsonPath,
      newsletterPath,
      wechatPath
    }
  };
}
