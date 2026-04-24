import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, CONFIG, AI_KEYWORDS_CORE } from './config.js';

// 默认只抓最近 18 小时，覆盖早 8 点运行时的隔夜新闻，同时过滤掉“一天前”的旧闻。
const DEFAULT_FRESHNESS_HOURS = 18;
const MAX_FUTURE_SKEW_HOURS = 2;
const RSS_FETCH_CONCURRENCY = 4;
const NON_NEWS_URL_PATTERNS = [
  /\/video\//i,
  /\/live\//i,
  /\/podcast\//i,
  /\/webinar\//i,
  /\/event\//i,
  /\/activity\//i,
  /\/course\//i,
  /\/topic\//i
];
const NON_NEWS_TITLE_PATTERNS = [
  /视频/,
  /直播/,
  /回放/,
  /播客/,
  /峰会/,
  /大会/,
  /课程/,
  /公开课/,
  /训练营/,
  /活动报名/
];
const BROAD_OVERSEAS_SOURCES = new Set([
  'TechCrunch AI',
  'The Verge AI',
  'Wired AI',
  'Tech Xplore',
  'NVIDIA Blog',
  'VentureBeat AI',
  'Hugging Face Blog',
  'AWS Machine Learning Blog'
]);
const BROAD_SOURCE_BLOCK_PATTERNS = [
  /all the latest in/i,
  /\bthe latest in\b/i,
  /\b(?:newsletter|digest|roundup|brief|podcast|documentary|tutorial)\b/i,
  /\bhow to\b/i,
  /\b(?:music|artist|artists|advertising|ads?|porn|adult|viral)\b/i,
  /\b(?:crypto|cryptocurrency|bitcoin|forex|casino|gambling)\b/i,
  /\b(?:literature|literary|therapy|dating|romance|celebrity)\b/i,
  /\bpersonal advice\b/i,
  /\btech reporters?\b.*\bwrite\b/i
];
const INDUSTRY_ENTITY_PATTERNS = [
  /\b(?:openai|anthropic|google|deepmind|gemini|meta|microsoft|nvidia|apple|xai|softbank|sora|claude|suno|bluesky|openclaw|tiktok|siri)\b/i,
  /\b(?:hugging face|transformers|diffusers|gradio|bedrock|sagemaker|nova|llama|mistral|cohere|deepseek)\b/i,
  /\b(?:pentagon|white house)\b/i
];
const INDUSTRY_ACTION_PATTERNS = [
  /\b(?:app|api|sdk|model|models|agent|agents|chatbot|chatbots)\b/i,
  /\b(?:launch|launched|release|released|update|updated|introduce|introduces|introduced|unveil|unveils|unveiled|announce|announces|announced|reveal|reveals|revealed|debut|debuts|ship|ships|rolls out|open source|shutdown|shut down|killed|killing)\b/i,
  /\b(?:funding|fundraise|fundraises|raises|raise|loan|ipo|startup|enterprise|developer|developers)\b/i,
  /\b(?:judge|court|lawsuit|ban|blocked|policy|policies|regulation|regulatory|senators?)\b/i,
  /\b(?:robot|robots|robotics|benchmark|hardware|chip|chips|gpu|tpu|data centers?|energy)\b/i,
  /\b(?:autonomous|warehouse|throughput|neural network|memristor|research|geopolitics|training|inference|fine-tuning|fine tuning)\b/i,
  /\b(?:founder|co-founder|ceo|executive|leadership|resigns?|resigned|leaves?|left)\b/i
];
const AWS_HIGH_SIGNAL_PATTERNS = [
  /\b(?:bedrock|sagemaker|nova|titan|q developer|trainium|inferentia)\b/i,
  /\b(?:foundation models?|llms?|agents?|agentic|generative ai|model deployment|model training|inference)\b/i
];
const KR36_ROUNDUP_TITLE_PATTERNS = [
  /(?:8点|9点)\s*1氪/,
  /[，,].*[，,].*[，,]/
];
const KR36_ROUNDUP_SECTION_PATTERNS = [
  /今日热点导览/,
  /(?:大公司|新产品|投融资|今日观点|AI最前沿|酷产品|上市进行时|其他值得关注的新闻)\s*[：:]/
];
const KR36_ROUNDUP_SECTION_REGEX = /(?:大公司|新产品|投融资|今日观点|AI最前沿|酷产品|上市进行时|其他值得关注的新闻)\s*[：:]/g;
const MIT_DOWNLOAD_PATTERNS = [
  /\bthe download\b/i,
  /this is today['’]s edition of the download/i
];
const INFOQ_ROUNDUP_PATTERNS = [
  /AI周报/,
  /本周AI领域的重要进展包括/
];
const MULTI_TOPIC_ACTION_PATTERNS = [
  /发布/,
  /推出/,
  /上线/,
  /更新/,
  /完成/,
  /融资/,
  /收购/,
  /签订/,
  /签署/,
  /达成/,
  /商用/,
  /开源/,
  /曝光/
];
const ROUNDUP_ENTITY_PATTERNS = [
  { label: 'openai', pattern: /openai/i },
  { label: 'microsoft', pattern: /微软|microsoft/i },
  { label: 'google', pattern: /谷歌|google/i },
  { label: 'meta', pattern: /meta/i },
  { label: 'anthropic', pattern: /anthropic/i },
  { label: '阿里', pattern: /阿里|qwen/i },
  { label: '字节', pattern: /字节|豆包/i },
  { label: '百度', pattern: /百度|文心/i },
  { label: '腾讯', pattern: /腾讯|混元/i },
  { label: '荣耀', pattern: /荣耀/ },
  { label: '京东', pattern: /京东/ }
];
const DEDUPE_TITLE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'about', 'into', 'over', 'after', 'before', 'new', 'news',
  'ai', 'artificial', 'intelligence', 'model', 'models', 'tool', 'tools', 'platform', 'company',
  '发布', '推出', '上线', '更新', '开放', '宣布', '公司', '模型', '平台', '工具', '产品', '功能',
  '人工智能', '大模型', '智能体'
]);

function isCfcFastMode() {
  return process.env.CFC_FAST_MODE === 'true';
}

function getEnvNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getSerperQueryLimit(totalQueries) {
  return getEnvNumber(
    'SERPER_QUERY_LIMIT',
    getEnvNumber('CFC_SERPER_QUERY_LIMIT', isCfcFastMode() ? 8 : Math.min(18, totalQueries))
  );
}

function getSerperResultLimit() {
  return getEnvNumber(
    'SERPER_RESULT_LIMIT',
    getEnvNumber('CFC_SERPER_RESULT_LIMIT', isCfcFastMode() ? 6 : 8)
  );
}

function getFreshnessHours() {
  return getEnvNumber('NEWS_FRESHNESS_HOURS', DEFAULT_FRESHNESS_HOURS);
}

/**
 * 检查新闻是否与AI行业相关
 */
function isAIRelated(title, snippet = '') {
  const text = (title + ' ' + snippet).toLowerCase();
  
  for (const keyword of AI_KEYWORDS_CORE) {
    if (text.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});
const JIQIZHIXIN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Referer': 'https://www.jiqizhixin.com/articles'
};

export function parsePublishedAt(value, now = new Date()) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const directDate = new Date(raw);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const lower = raw.toLowerCase();
  if (/^(just now|now)$/i.test(lower)) {
    return new Date(now);
  }

  const relativeMatch = lower.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins|m|hour|hours|hr|hrs|h|day|days|d)\s*ago/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const unitHours = unit.startsWith('m') ? 1 / 60 : unit.startsWith('d') ? 24 : 1;
    return new Date(now.getTime() - amount * unitHours * 60 * 60 * 1000);
  }

  if (/^yesterday\b/i.test(lower)) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const chineseRelativeMatch = raw.match(/(\d+(?:\.\d+)?)\s*(分钟|小时|天)前/);
  if (chineseRelativeMatch) {
    const amount = Number(chineseRelativeMatch[1]);
    const unit = chineseRelativeMatch[2];
    const unitHours = unit === '分钟' ? 1 / 60 : unit === '天' ? 24 : 1;
    return new Date(now.getTime() - amount * unitHours * 60 * 60 * 1000);
  }

  return null;
}

export function getNewsAgeHours(publishedAt, now = new Date()) {
  const pubDate = parsePublishedAt(publishedAt, now);
  if (!pubDate) return Infinity;
  return (now - pubDate) / (1000 * 60 * 60);
}

export function isFreshNews(publishedAt, now = new Date()) {
  const ageHours = getNewsAgeHours(publishedAt, now);
  return ageHours >= -MAX_FUTURE_SKEW_HOURS && ageHours <= getFreshnessHours();
}

function extractSnippet(item) {
  // 优先顺序：contentSnippet > summary > content > content:encoded
  let snippet = item.contentSnippet || item.summary || item.content || item['content:encoded'] || '';
  
  // 清理 CDATA 标记（有些 RSS 返回 <![CDATA[...]]> 或空的 <![CDATA[]>）
  snippet = snippet.replace(/^\s*<!\[CDATA\[\]\]>\s*$/i, '');
  snippet = snippet.replace(/^\s*<!\[CDATA\[(.*)\]\]>\s*$/is, '$1');
  snippet = snippet.trim();
  
  // 如果清理后为空，尝试从 content:encoded 提取（有些源 contentSnippet 为空但 content:encoded 有内容）
  if (!snippet && item['content:encoded']) {
    snippet = item['content:encoded']
      .replace(/^\s*<!\[CDATA\[/, '')
      .replace(/\]\]>\s*$/, '')
      .trim();
  }
  
  // 提取纯文本（移除 HTML 标签）
  snippet = snippet.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  return snippet;
}

function parseJiqizhixinPublishedAt(publishedAt) {
  const normalized = String(publishedAt || '').trim();
  const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    return normalized;
  }

  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00+08:00`;
}

export function normalizeJiqizhixinArticle(article, source) {
  return {
    title: article.title || '',
    url: `https://www.jiqizhixin.com/articles/${article.slug || article.id || ''}`,
    snippet: String(article.content || '').replace(/\s+/g, ' ').trim(),
    source: source.name,
    publishedAt: parseJiqizhixinPublishedAt(article.publishedAt),
    popularityScore: extractPopularityScore(article),
    region: '国内'
  };
}

export function isNewsLikeItem(item) {
  const url = String(item?.url || item?.link || '').trim();
  const title = String(item?.title || '').trim();

  if (NON_NEWS_URL_PATTERNS.some(pattern => pattern.test(url))) {
    return false;
  }

  if (NON_NEWS_TITLE_PATTERNS.some(pattern => pattern.test(title))) {
    return false;
  }

  return true;
}

function countPatternMatches(patterns, text) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function countDistinctEntities(text) {
  const normalized = String(text || '');
  const matched = ROUNDUP_ENTITY_PATTERNS
    .filter(item => item.pattern.test(normalized))
    .map(item => item.label);
  return new Set(matched).size;
}

function parsePopularityNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value || '').trim().toLowerCase().replace(/,/g, '');
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(亿|万|m|k)?/);
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === '亿' ? 100000000 : unit === '万' ? 10000 : unit === 'm' ? 1000000 : unit === 'k' ? 1000 : 1;
  return amount * multiplier;
}

function extractPopularityScore(item = {}) {
  const candidateFields = [
    'views',
    'viewCount',
    'readCount',
    'reads',
    'visits',
    'commentCount',
    'comments',
    'likeCount',
    'likes',
    'score'
  ];
  const values = candidateFields
    .map(field => parsePopularityNumber(item[field]))
    .filter(value => Number.isFinite(value) && value > 0);
  const raw = values.length > 0 ? Math.max(...values) : 0;

  if (raw >= 100000) return 8;
  if (raw >= 50000) return 6;
  if (raw >= 10000) return 4;
  if (raw >= 1000) return 2;
  return 0;
}

function normalizeUrlForDedup(url = '') {
  try {
    const parsed = new URL(String(url || '').trim());
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.toLowerCase()}`;
  } catch {
    return String(url || '').trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

function normalizeTitleForDedup(title = '') {
  return String(title || '')
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[^\p{L}\p{N}\s+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTitleSignals(title = '') {
  const normalized = normalizeTitleForDedup(title);
  const tokens = normalized.match(/[a-z0-9+-]{2,}|[\u4e00-\u9fff]{2,8}/g) || [];
  return [...new Set(tokens.filter(token => !DEDUPE_TITLE_STOPWORDS.has(token)))];
}

function getSignalOverlap(aSignals, bSignals) {
  const shared = aSignals.filter(signal => bSignals.includes(signal));
  const maxSize = Math.max(aSignals.length, bSignals.length, 1);
  return {
    sharedCount: shared.length,
    ratio: shared.length / maxSize
  };
}

function areDuplicateNewsItems(a, b) {
  const aUrl = normalizeUrlForDedup(a.url || a.link);
  const bUrl = normalizeUrlForDedup(b.url || b.link);
  if (aUrl && bUrl && aUrl === bUrl) {
    return true;
  }

  const aTitle = normalizeTitleForDedup(a.title);
  const bTitle = normalizeTitleForDedup(b.title);
  if (aTitle && bTitle && aTitle === bTitle) {
    return true;
  }

  const aSignals = getTitleSignals(a.title);
  const bSignals = getTitleSignals(b.title);
  const { sharedCount, ratio } = getSignalOverlap(aSignals, bSignals);
  return sharedCount >= 3 && ratio >= 0.6;
}

function getSourceRank(source) {
  const rank = [
    'OpenAI News',
    'Google DeepMind Blog',
    'Google AI Blog',
    'NVIDIA Blog',
    'MIT Technology Review',
    '机器之心',
    '量子位',
    'InfoQ',
    'TechCrunch AI',
    'The Decoder',
    'Ars Technica',
    'The Verge AI',
    'VentureBeat AI',
    'Wired AI',
    '36氪',
    'Tech Xplore',
    'Apple ML Research',
    'Berkeley AI Research',
    'Hugging Face Blog',
    'AWS Machine Learning Blog'
  ];
  const index = rank.indexOf(source);
  return index === -1 ? rank.length : index;
}

function choosePreferredNewsItem(items) {
  return [...items].sort((a, b) => {
    const ageDelta = getNewsAgeHours(a.publishedAt) - getNewsAgeHours(b.publishedAt);
    if (Number.isFinite(ageDelta) && Math.abs(ageDelta) > 1) {
      return ageDelta;
    }

    const rankDelta = getSourceRank(a.source) - getSourceRank(b.source);
    if (rankDelta !== 0) return rankDelta;

    return String(b.snippet || '').length - String(a.snippet || '').length;
  })[0];
}

export function deduplicateNews(news) {
  const groups = [];

  for (const item of news) {
    const group = groups.find(candidate => candidate.items.some(existing => areDuplicateNewsItems(item, existing)));
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ items: [item] });
    }
  }

  return groups.map(group => {
    const preferred = choosePreferredNewsItem(group.items);
    const coverageSources = [...new Set(group.items.map(item => item.source).filter(Boolean))];
    const coverageTitles = [...new Set(group.items.map(item => item.title).filter(Boolean))];
    const popularityScore = Math.max(...group.items.map(item => Number(item.popularityScore || 0)), 0);

    return {
      ...preferred,
      coverageCount: coverageSources.length,
      coverageSources,
      coverageTitles,
      popularityScore
    };
  });
}

function isMultiTopicRoundupTitle(title = '') {
  const normalizedTitle = String(title || '').trim();
  const clauses = normalizedTitle.split(/[，,；;]/).map(part => part.trim()).filter(Boolean);
  if (clauses.length < 3) {
    return false;
  }

  const actionHits = countPatternMatches(MULTI_TOPIC_ACTION_PATTERNS, normalizedTitle);
  const entityCount = countDistinctEntities(normalizedTitle);
  return actionHits >= 2 && entityCount >= 2;
}

export function isSourceQualifiedNewsItem(item, sourceName = '') {
  if (sourceName === '36氪') {
    const title = `${item?.title || ''}`;
    const snippet = `${item?.snippet || ''}`;
    const roundupSectionHits = countPatternMatches(KR36_ROUNDUP_SECTION_PATTERNS, snippet)
      + (snippet.match(KR36_ROUNDUP_SECTION_REGEX) || []).length;

    if (
      KR36_ROUNDUP_TITLE_PATTERNS.some(pattern => pattern.test(title)) &&
      (roundupSectionHits >= 1 || title.split(/[，,]/).filter(Boolean).length >= 3)
    ) {
      return false;
    }

    if (roundupSectionHits >= 2) {
      return false;
    }
  }

  if (sourceName === 'MIT Technology Review') {
    const text = `${item?.title || ''} ${item?.snippet || ''}`;
    if (MIT_DOWNLOAD_PATTERNS.some(pattern => pattern.test(text))) {
      return false;
    }
  }

  if (sourceName === 'InfoQ') {
    const title = `${item?.title || ''}`;
    const snippet = `${item?.snippet || ''}`;
    if (
      INFOQ_ROUNDUP_PATTERNS.some(pattern => pattern.test(`${title} ${snippet}`)) &&
      title.split(/[，,]/).filter(Boolean).length >= 3
    ) {
      return false;
    }

    if (isMultiTopicRoundupTitle(title)) {
      return false;
    }
  }

  if (!BROAD_OVERSEAS_SOURCES.has(sourceName)) {
    return true;
  }

  const text = `${item?.title || ''} ${item?.snippet || ''} ${item?.url || item?.link || ''}`.toLowerCase();
  if (BROAD_SOURCE_BLOCK_PATTERNS.some(pattern => pattern.test(text))) {
    return false;
  }

  const entityHits = countPatternMatches(INDUSTRY_ENTITY_PATTERNS, text);
  const actionHits = countPatternMatches(INDUSTRY_ACTION_PATTERNS, text);

  if (sourceName === 'Tech Xplore') {
    return actionHits >= 1;
  }

  if (sourceName === 'TechCrunch AI') {
    return entityHits + actionHits >= 2;
  }

  if (sourceName === 'Wired AI') {
    return actionHits >= 2 || (entityHits >= 1 && actionHits >= 1);
  }

  if (sourceName === 'AWS Machine Learning Blog') {
    const highSignalHits = countPatternMatches(AWS_HIGH_SIGNAL_PATTERNS, text);
    return highSignalHits >= 1 && actionHits >= 1;
  }

  if (sourceName === 'Hugging Face Blog') {
    return entityHits >= 1 && actionHits >= 1;
  }

  return entityHits >= 1 && actionHits >= 1;
}

async function fetchJiqizhixinArticles(source) {
  console.log(`📡 ${source.name}`);

  const per = Math.max((source.limit || 5) * 4, 12);
  const response = await axios.get(source.url, {
    headers: JIQIZHIXIN_HEADERS,
    params: {
      sort: 'time',
      page: 1,
      per
    },
    timeout: 20000
  });

  const rawArticles = Array.isArray(response.data?.articles) ? response.data.articles : [];
  const items = rawArticles
    .map(article => normalizeJiqizhixinArticle(article, source))
    .filter(item => isNewsLikeItem(item))
    .filter(item => isFreshNews(item.publishedAt))
    .filter(item => isSourceQualifiedNewsItem(item, source.name))
    .filter(item => isAIRelated(item.title, item.snippet))
    .slice(0, source.limit || 5);

  const filteredCount = rawArticles.length - items.length;
  if (filteredCount > 0) {
    console.log(`   ✓ ${items.length} 条 (过滤掉 ${filteredCount} 条非AI或不合格新闻)`);
  } else {
    console.log(`   ✓ ${items.length} 条`);
  }

  return {
    source: source.name,
    ok: true,
    count: items.length,
    items
  };
}

async function parseRSS(source) {
  try {
    if (source.name === '机器之心') {
      return await fetchJiqizhixinArticles(source);
    }

    console.log(`📡 ${source.name}`);
    const feed = await rssParser.parseURL(source.url);
    
    const items = feed.items
      .map(item => ({
        title: item.title || '',
        url: item.link || item.url || '',
        snippet: extractSnippet(item),
        source: source.name,
        publishedAt: item.pubDate || item.isoDate || item.date || '',
        popularityScore: extractPopularityScore(item),
        region: DOMESTIC_RSS_SOURCES.includes(source) ? '国内' : '海外'
      }))
      .filter(item => isNewsLikeItem(item))
      .filter(item => isFreshNews(item.publishedAt))
      .filter(item => isSourceQualifiedNewsItem(item, source.name))
      .filter(item => isAIRelated(item.title, item.snippet))  // 只保留AI相关新闻
      .slice(0, source.limit || 5);
    
    const filteredCount = feed.items.filter(item => isFreshNews(item.pubDate || item.isoDate || item.date)).length - items.length;
    if (filteredCount > 0) {
      console.log(`   ✓ ${items.length} 条 (过滤掉 ${filteredCount} 条非AI新闻)`);
    } else {
      console.log(`   ✓ ${items.length} 条`);
    }
    return {
      source: source.name,
      ok: true,
      count: items.length,
      items
    };
  } catch (error) {
    console.error(`   ✗ 失败: ${error.message}`);
    return {
      source: source.name,
      ok: false,
      count: 0,
      error: error.message,
      items: []
    };
  }
}

async function fetchSourceGroup(sources, concurrency = RSS_FETCH_CONCURRENCY) {
  const results = new Array(sources.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, sources.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < sources.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await parseRSS(sources[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

async function fetchSerperNews() {
  if (!CONFIG.serper.apiKey) {
    console.log('📡 Serper API: ⚠️ 未配置 API Key');
    return {
      enabled: false,
      count: 0,
      queryCount: 0,
      resultLimit: 0,
      items: []
    };
  }
  
  try {
    console.log('📡 Serper API');
    
    // 用核心查询词覆盖主要海外 AI 动态，避免抓得过杂过多
    const queries = [
      'OpenAI GPT news',
      'OpenAI Sora video AI',
      'Google Gemini AI news', 
      'Anthropic Claude AI',
      'Meta AI Llama news',
      'NVIDIA AI chips news',
      'Microsoft Copilot AI',
      'AI startup funding',
      'artificial intelligence breakthrough',
      'AI research paper',
      'Elon Musk xAI Grok',
      'Apple Intelligence AI',
      'Amazon Bedrock AI',
      'AI regulation policy',
      'robotics humanoid AI',
      'self-driving autonomous vehicle',
      'Perplexity AI search',
      'Mistral AI France',
      'Cohere AI enterprise',
      'Stability AI image',
      'Runway ML video',
      'Hugging Face AI',
      'DeepMind Google AI',
      'Character AI chatbot',
      'AI agent enterprise software',
      'open source AI model release',
      'robotics foundation model',
      'AI semiconductor accelerator'
    ];
    const activeQueries = queries.slice(0, getSerperQueryLimit(queries.length));
    const resultLimit = getSerperResultLimit();
    
    const allNews = [];
    const seenUrls = new Set();
    
    for (const query of activeQueries) {
      try {
        const response = await axios.post('https://google.serper.dev/news', {
          q: query,
          gl: 'us',
          hl: 'en',
          tbs: 'qdr:d',
          num: resultLimit
        }, {
          headers: {
            'X-API-KEY': CONFIG.serper.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        });
        
        for (const item of response.data.news || []) {
          // 检查是否AI相关
          if (!isAIRelated(item.title, item.snippet)) {
            continue;
          }
          if (!isNewsLikeItem({ title: item.title, url: item.link })) {
            continue;
          }
          if (!isSourceQualifiedNewsItem({ title: item.title, snippet: item.snippet, url: item.link }, item.source || 'Serper')) {
            continue;
          }
          const publishedAt = parsePublishedAt(item.date)?.toISOString() || '';
          if (!isFreshNews(publishedAt)) {
            continue;
          }

          if (item.title && item.link && !seenUrls.has(item.link)) {
            seenUrls.add(item.link);
            allNews.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet || '',
              source: item.source || 'Serper',
              publishedAt,
              popularityScore: extractPopularityScore(item),
              region: '海外'
            });
          }
        }
      } catch (e) {
        if (process.env.DEBUG === 'true') {
          console.log(`   ⚠️ Serper 查询失败: ${query} (${e.message})`);
        }
      }
      
      await new Promise(r => setTimeout(r, isCfcFastMode() ? 80 : 200));
    }
    
    console.log(`   ✓ ${allNews.length} 条 (${activeQueries.length} 个查询，每个最多 ${resultLimit} 条)`);
    return {
      enabled: true,
      count: allNews.length,
      queryCount: activeQueries.length,
      resultLimit,
      items: allNews
    };
  } catch (error) {
    console.log(`   ✗ Serper 失败: ${error.message}`);
    return {
      enabled: true,
      count: 0,
      queryCount: 0,
      resultLimit: 0,
      error: error.message,
      items: []
    };
  }
}

function deduplicate(news) {
  return deduplicateNews(news);
}

export async function fetchAllNews() {
  console.log('📰 抓取新闻中...\n');
  
  const domestic = [];
  const domesticSourceStats = [];
  const domesticResults = await fetchSourceGroup(DOMESTIC_RSS_SOURCES);
  for (const result of domesticResults) {
    domesticSourceStats.push({
      source: result.source,
      ok: result.ok,
      count: result.count,
      error: result.error || null
    });
    domestic.push(...result.items);
  }
  
  const overseas = [];
  const overseasSourceStats = [];
  const overseasResults = await fetchSourceGroup(OVERSEAS_RSS_SOURCES);
  for (const result of overseasResults) {
    overseasSourceStats.push({
      source: result.source,
      ok: result.ok,
      count: result.count,
      error: result.error || null
    });
    overseas.push(...result.items);
  }
  
  const serperResult = await fetchSerperNews();
  overseas.push(...serperResult.items);
  
  const uniqueDomestic = deduplicate(domestic);
  const uniqueOverseas = deduplicate(overseas);
  const domesticHotGroups = uniqueDomestic.filter(item => item.coverageCount > 1).length;
  const overseasHotGroups = uniqueOverseas.filter(item => item.coverageCount > 1).length;
  
  console.log(`\n📊 去重后: 国内 ${uniqueDomestic.length}, 海外 ${uniqueOverseas.length}`);
  console.log(`   🔥 多源覆盖热点: 国内 ${domesticHotGroups}, 海外 ${overseasHotGroups}`);
  
  return {
    domestic: uniqueDomestic,
    overseas: uniqueOverseas,
    stats: {
      domesticBeforeDedup: domestic.length,
      overseasBeforeDedup: overseas.length,
      domesticAfterDedup: uniqueDomestic.length,
      overseasAfterDedup: uniqueOverseas.length,
      domesticHotGroups,
      overseasHotGroups,
      domesticSources: domesticSourceStats,
      overseasSources: overseasSourceStats,
      serper: {
        enabled: serperResult.enabled,
        count: serperResult.count,
        queryCount: serperResult.queryCount,
        resultLimit: serperResult.resultLimit,
        error: serperResult.error || null
      }
    }
  };
}
