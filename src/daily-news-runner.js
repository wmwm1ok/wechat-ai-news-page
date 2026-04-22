import fs from 'fs/promises';
import path from 'path';
import { fetchAllNews } from './rss-fetcher.js';
import { summarizeNews, refineSelectedNews, isDisplayReadyNews, isReaderFriendlySummary, isReserveDisplayNews, isLastChanceDisplayNews, isSummaryComplete, normalizeDisplaySummary } from './ai-summarizer.js';
import { checkSemanticDuplicate, scoreNews, selectTopNews } from './news-scorer.js';
import { classifyNewsCategory } from './category-classifier.js';
import { generateHTML, generateWechatHTML } from './html-formatter.js';
import {
  getBeijingDateString,
  getBeijingDisplayDate,
  getBeijingDisplayDateTime,
  getEditionMeta
} from './date-utils.js';

async function saveOutput(baseDir, filename, content) {
  const outputDir = path.join(baseDir, 'output');
  await fs.mkdir(outputDir, { recursive: true });

  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`💾 已保存: ${filepath}`);

  if (filename === 'latest.json') {
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

async function loadPreviousDayNews(baseDir, referenceDate = new Date()) {
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = getBeijingDateString(yesterday);
  const candidateFiles = [
    path.join(baseDir, 'output', `news-${dateStr}.json`),
    path.join(baseDir, 'output', `news-${dateStr}-daily.json`)
  ];

  for (const filepath of candidateFiles) {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);
      const news = flattenNewsItems(data);
      const filename = path.basename(filepath);
      console.log(`📅 加载昨日新闻: ${news.length} 条（${filename}）`);
      return {
        news,
        sourceFile: filename
      };
    } catch {
      // continue
    }
  }

  console.log('⚠️  未找到前一天新闻文件，前一天去重功能未生效');
  return {
    news: [],
    sourceFile: ''
  };
}

function buildOutputName(prefix, date, extension) {
  return `${prefix}-${date}.${extension}`;
}

function isReusablePreviousDayDuplicate(duplicateCheck, item) {
  if (!item || item.selectionMode !== 'crossDayFallback' || !duplicateCheck?.isDuplicate) {
    return false;
  }

  const reason = String(duplicateCheck.reason || '');
  const confidence = Number(duplicateCheck.confidence || 0);

  if (reason === 'URL相同' || reason === '标题完全相同') {
    return false;
  }

  if (reason.startsWith('标题语义相似') && confidence >= 0.88) {
    return false;
  }

  return confidence < 0.88;
}

export function filterAgainstPreviousEdition(items, previousNews, targetCount = Array.isArray(items) ? items.length : 0) {
  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(previousNews) || previousNews.length === 0) {
    return {
      kept: items || [],
      removed: [],
      restored: [],
      reusableRemovedItems: []
    };
  }

  const removed = [];
  const reusableRemoved = [];
  const keptIndexes = new Set();

  for (const [index, item] of items.entries()) {
    const duplicateCheck = checkSemanticDuplicate(item, previousNews);
    if (duplicateCheck.isDuplicate) {
      const removal = {
        index,
        item,
        title: item.title,
        source: item.source,
        reason: duplicateCheck.reason,
        matchedWith: duplicateCheck.matchedWith || '',
        reusable: isReusablePreviousDayDuplicate(duplicateCheck, item)
      };
      removed.push(removal);
      if (removal.reusable) {
        reusableRemoved.push(removal);
      }
    } else {
      keptIndexes.add(index);
    }
  }

  const shortage = Math.max(0, targetCount - keptIndexes.size);
  if (shortage > 0 && reusableRemoved.length > 0) {
    for (const removal of reusableRemoved.slice(0, shortage)) {
      keptIndexes.add(removal.index);
    }
  }

  const kept = items.filter((_, index) => keptIndexes.has(index));
  const restored = reusableRemoved
    .filter(removal => keptIndexes.has(removal.index))
    .map(removal => ({
      title: removal.title,
      source: removal.source,
      reason: removal.reason,
      matchedWith: removal.matchedWith
    }));
  const finalRemoved = removed
    .filter(removal => !keptIndexes.has(removal.index))
    .map(removal => ({
      title: removal.title,
      source: removal.source,
      reason: removal.reason,
      matchedWith: removal.matchedWith
    }));

  return {
    kept,
    removed: finalRemoved,
    restored,
    reusableRemovedItems: reusableRemoved
      .filter(removal => !keptIndexes.has(removal.index))
      .map(removal => removal.item)
  };
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

function restoreReusablePreviousDayItems(items, reusableRemovedItems, targetCount) {
  if (!Array.isArray(items) || !Array.isArray(reusableRemovedItems) || items.length >= targetCount || reusableRemovedItems.length === 0) {
    return {
      kept: items || [],
      restored: []
    };
  }

  const keptKeys = new Set(items.map(item => item.url || item.title));
  const candidates = reusableRemovedItems.filter(item => !keptKeys.has(item.url || item.title));
  if (candidates.length === 0) {
    return {
      kept: items,
      restored: []
    };
  }

  const shortage = Math.max(0, targetCount - items.length);
  const integrityChecked = filterFinalIntegrity(candidates);
  const restored = integrityChecked.kept.slice(0, shortage);

  return {
    kept: [...items, ...restored],
    restored
  };
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
    news.category = classifyNewsCategory(news);
  }

  const grouped = {};
  for (const section of standardCategories) {
    grouped[section] = topNews.filter(item => item.category === section);
  }

  return grouped;
}

const FINAL_TOPIC_STOPWORDS = new Set([
  '发布', '推出', '上线', '更新', '开放', '新增', '宣布', '首个', '新版', '模型', '功能', '产品',
  '系统', '平台', '应用', '服务', '工具', '能力', '方案', 'ai', '人工智能', 'meta', 'google',
  'openai', 'anthropic', 'microsoft', 'github', 'copilot'
]);
const FINAL_TOPIC_ACTION_GROUPS = [
  ['发布', '推出', '上线', '更新', '开放'],
  ['融资', '募资', '领投', '跟投'],
  ['收购', '并购'],
  ['起诉', '诉讼', '索赔']
];

function extractFinalTopicSignals(title = '') {
  const normalized = String(title || '').toLowerCase();
  const matches = normalized.match(/[a-z0-9+-]+|[\u4e00-\u9fff]{2,8}/g) || [];
  return [...new Set(matches.filter(token => !FINAL_TOPIC_STOPWORDS.has(token) && token.length >= 2))];
}

function hasFinalTopicActionOverlap(itemA, itemB) {
  const textA = `${itemA?.title || ''} ${itemA?.summary || ''}`.toLowerCase();
  const textB = `${itemB?.title || ''} ${itemB?.summary || ''}`.toLowerCase();

  return FINAL_TOPIC_ACTION_GROUPS.some(group =>
    group.some(term => textA.includes(term.toLowerCase())) &&
    group.some(term => textB.includes(term.toLowerCase()))
  );
}

function isFinalTopicVariant(item, selectedItem) {
  if (!item || !selectedItem) {
    return false;
  }

  const itemSignals = extractFinalTopicSignals(item.title);
  const selectedSignals = extractFinalTopicSignals(selectedItem.title);
  const sharedSignals = itemSignals.filter(signal => selectedSignals.includes(signal));

  if (sharedSignals.length < 2) {
    return false;
  }

  return hasFinalTopicActionOverlap(item, selectedItem);
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

    if (selected.some(selectedItem => isFinalTopicVariant(item, selectedItem))) {
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
    targetCount = 14
  } = options;
  const editionMeta = getEditionMeta('daily', now);

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

  const previousDayData = await loadPreviousDayNews(baseDir, now);
  const previousDayNews = previousDayData.news;
  const candidateTargetCount = Math.max(targetCount + 12, Math.ceil(targetCount * 2.2));

  console.log('\n🎯 开始质量评分...');
  const selectedNews = selectTopNews(allNews, candidateTargetCount, previousDayNews);
  const refinedNews = await refineSelectedNews(selectedNews);
  const normalizedRefinedNews = refinedNews.map(item => ({
    ...item,
    summary: normalizeDisplaySummary(item.summary),
    category: classifyNewsCategory({
      ...item,
      summary: normalizeDisplaySummary(item.summary)
    })
  }));
  const previousDayFiltered = filterAgainstPreviousEdition(normalizedRefinedNews, previousDayNews, targetCount);
  if (previousDayFiltered.removed.length > 0) {
    console.log(`\n🧱 前一天去重: 额外过滤 ${previousDayFiltered.removed.length} 条与前一天重复的候选`);
  }
  if (previousDayFiltered.restored.length > 0) {
    console.log(`\n🪜 前一天回补: 在版面不足时恢复 ${previousDayFiltered.restored.length} 条前一天重复候选`);
  }
  const integrityFiltered = filterFinalIntegrity(previousDayFiltered.kept);
  if (integrityFiltered.removed.length > 0) {
    console.log(`\n🧪 最终一致性过滤: 额外过滤 ${integrityFiltered.removed.length} 条标题与摘要不一致或相关性不足的候选`);
  }
  const latePreviousDayRestore = restoreReusablePreviousDayItems(
    integrityFiltered.kept,
    previousDayFiltered.reusableRemovedItems,
    targetCount
  );
  if (latePreviousDayRestore.restored.length > 0) {
    console.log(`\n🪫 末端回补: 在最终候选仍不足时，额外恢复 ${latePreviousDayRestore.restored.length} 条前一天候补`);
  }
  const filteredRefinedNews = latePreviousDayRestore.kept;
  const displayReadyNews = filteredRefinedNews.filter(item => isDisplayReadyNews(item));
  const fallbackDisplayNews = filteredRefinedNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title)) &&
    isSummaryComplete(item.summary) &&
    isReaderFriendlySummary(item.summary)
  );
  const reserveDisplayNews = filteredRefinedNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title)) &&
    !fallbackDisplayNews.some(fallbackItem => (fallbackItem.url || fallbackItem.title) === (item.url || item.title)) &&
    isReserveDisplayNews(item)
  );
  const lastChanceDisplayNews = filteredRefinedNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title)) &&
    !fallbackDisplayNews.some(fallbackItem => (fallbackItem.url || fallbackItem.title) === (item.url || item.title)) &&
    !reserveDisplayNews.some(reserveItem => (reserveItem.url || reserveItem.title) === (item.url || item.title)) &&
    isLastChanceDisplayNews(item)
  );
  const eligibleDisplayNews = [...displayReadyNews, ...fallbackDisplayNews, ...reserveDisplayNews, ...lastChanceDisplayNews];
  const topNews = selectBalancedFinalNews(eligibleDisplayNews, targetCount);
  const removedWeakSummaries = filteredRefinedNews.length - displayReadyNews.length;
  const fallbackDisplayCount = topNews.filter(item =>
    !displayReadyNews.some(readyItem => (readyItem.url || readyItem.title) === (item.url || item.title))
    && fallbackDisplayNews.some(fallbackItem => (fallbackItem.url || fallbackItem.title) === (item.url || item.title))
  ).length;
  const reserveDisplayCount = topNews.filter(item =>
    reserveDisplayNews.some(reserveItem => (reserveItem.url || reserveItem.title) === (item.url || item.title))
  ).length;
  const lastChanceDisplayCount = topNews.filter(item =>
    lastChanceDisplayNews.some(lastChanceItem => (lastChanceItem.url || lastChanceItem.title) === (item.url || item.title))
  ).length;
  if (removedWeakSummaries > 0) {
    console.log(`\n🧽 摘要净化: 过滤掉 ${removedWeakSummaries} 条不适合直接展示给读者的摘要`);
  }
  if (fallbackDisplayCount > 0) {
    console.log(`\n🩹 展示补位: 使用 ${fallbackDisplayCount} 条较弱但可读的摘要补足版面`);
  }
  if (reserveDisplayCount > 0) {
    console.log(`\n🪜 保底补位: 使用 ${reserveDisplayCount} 条候补摘要尽量凑满版面`);
  }
  if (lastChanceDisplayCount > 0) {
    console.log(`\n🧰 最终补位: 使用 ${lastChanceDisplayCount} 条边缘候选补足版面`);
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
  const displayTitle = `${editionMeta.title}-${displayDate}`;
  const subtitle = `${displayDate} · 北京时间 ${editionMeta.releaseTime} 更新`;
  const footerText = `${displayTitle} · ${displayDate}`;
  const html = generateHTML(grouped, { title: displayTitle, subtitle, footerText });
  const wechatHtml = generateWechatHTML(grouped, { title: displayTitle, subtitle, footerText });

  const newsletterPath = await saveOutput(baseDir, buildOutputName('newsletter', date, 'html'), html);
  const wechatPath = await saveOutput(baseDir, buildOutputName('wechat', date, 'html'), wechatHtml);

  const jsonData = {
    date: displayDate,
    title: displayTitle,
    generatedAt: getBeijingDisplayDateTime(now),
    count: topNews.length,
    targetCount,
    diagnostics: {
      previousDayFile: previousDayData.sourceFile || '',
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
        previousDayRemovedCount: previousDayFiltered.removed.length,
        previousDayRestoredCount: previousDayFiltered.restored.length,
        previousDayLateRestoredCount: latePreviousDayRestore.restored.length,
        integrityRemovedCount: integrityFiltered.removed.length,
        postPreviousDayFilterCount: filteredRefinedNews.length,
        displayReadyCount: displayReadyNews.length,
        fallbackDisplayCount,
        reserveDisplayCount,
        lastChanceDisplayCount,
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
  const historyJsonPath = await saveOutput(baseDir, buildOutputName('news', date, 'json'), JSON.stringify(grouped, null, 2));

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
