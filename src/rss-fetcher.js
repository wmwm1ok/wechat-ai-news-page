import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, CONFIG, AI_KEYWORDS_CORE } from './config.js';

// 延长至48小时，覆盖跨天发布的情况
const FRESHNESS_HOURS = 48;
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
const BROAD_OVERSEAS_SOURCES = new Set(['TechCrunch AI', 'The Verge AI', 'Wired AI', 'Tech Xplore']);
const BROAD_SOURCE_BLOCK_PATTERNS = [
  /all the latest in/i,
  /\bthe latest in\b/i,
  /\b(?:newsletter|digest|roundup|brief|podcast|documentary)\b/i,
  /\b(?:music|artist|artists|advertising|ads?|porn|adult|viral)\b/i,
  /\b(?:literature|literary|therapy|dating|romance|celebrity)\b/i,
  /\bpersonal advice\b/i,
  /\btech reporters?\b.*\bwrite\b/i
];
const INDUSTRY_ENTITY_PATTERNS = [
  /\b(?:openai|anthropic|google|gemini|meta|microsoft|nvidia|apple|xai|softbank|sora|claude|suno|bluesky|openclaw|tiktok|siri)\b/i,
  /\b(?:pentagon|white house)\b/i
];
const INDUSTRY_ACTION_PATTERNS = [
  /\b(?:app|api|sdk|model|models|agent|agents|chatbot|chatbots)\b/i,
  /\b(?:launch|release|released|update|updated|open source|shutdown|shut down|killed|killing)\b/i,
  /\b(?:funding|fundraise|loan|ipo|startup|enterprise|developer|developers)\b/i,
  /\b(?:judge|court|lawsuit|ban|blocked|policy|policies|regulation|regulatory|senators?)\b/i,
  /\b(?:robot|robots|robotics|benchmark|hardware|chip|chips|gpu|data centers?|energy)\b/i,
  /\b(?:autonomous|warehouse|throughput|neural network|memristor|research|geopolitics)\b/i,
  /\b(?:founder|co-founder|ceo|executive|leadership|resigns?|resigned|leaves?|left)\b/i
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

function isFreshNews(publishedAt) {
  if (!publishedAt) return true;
  
  const pubDate = new Date(publishedAt);
  const now = new Date();
  const diffHours = (now - pubDate) / (1000 * 60 * 60);
  
  return diffHours <= FRESHNESS_HOURS;
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

  return entityHits >= 1 && actionHits >= 1;
}

async function parseRSS(source) {
  try {
    console.log(`📡 ${source.name}`);
    const feed = await rssParser.parseURL(source.url);
    
    const items = feed.items
      .map(item => ({
        title: item.title || '',
        url: item.link || item.url || '',
        snippet: extractSnippet(item),
        source: source.name,
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        region: DOMESTIC_RSS_SOURCES.includes(source) ? '国内' : '海外'
      }))
      .filter(item => isNewsLikeItem(item))
      .filter(item => isFreshNews(item.publishedAt))
      .filter(item => isSourceQualifiedNewsItem(item, source.name))
      .filter(item => isAIRelated(item.title, item.snippet))  // 只保留AI相关新闻
      .slice(0, source.limit || 5);
    
    const filteredCount = feed.items.filter(item => isFreshNews(item.pubDate || item.isoDate)).length - items.length;
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
          if (item.title && item.link && !seenUrls.has(item.link)) {
            seenUrls.add(item.link);
            allNews.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet || '',
              source: item.source || 'Serper',
              publishedAt: item.date || new Date().toISOString(),
              region: '海外'
            });
          }
        }
      } catch (e) {}
      
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
  const seen = new Set();
  const result = [];
  
  for (const item of news) {
    const key = item.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

export async function fetchAllNews() {
  console.log('📰 抓取新闻中...\n');
  
  const domestic = [];
  const domesticSourceStats = [];
  for (const source of DOMESTIC_RSS_SOURCES) {
    const result = await parseRSS(source);
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
  for (const source of OVERSEAS_RSS_SOURCES) {
    const result = await parseRSS(source);
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
  
  console.log(`\n📊 去重后: 国内 ${uniqueDomestic.length}, 海外 ${uniqueOverseas.length}`);
  
  return {
    domestic: uniqueDomestic,
    overseas: uniqueOverseas,
    stats: {
      domesticBeforeDedup: domestic.length,
      overseasBeforeDedup: overseas.length,
      domesticAfterDedup: uniqueDomestic.length,
      overseasAfterDedup: uniqueOverseas.length,
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
