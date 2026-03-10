import Parser from 'rss-parser';
import axios from 'axios';
import { DOMESTIC_RSS_SOURCES, OVERSEAS_RSS_SOURCES, CONFIG, AI_KEYWORDS_CORE } from './config.js';

// 延长至48小时，覆盖跨天发布的情况
const FRESHNESS_HOURS = 48;

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
      .filter(item => isFreshNews(item.publishedAt))
      .filter(item => isAIRelated(item.title, item.snippet))  // 只保留AI相关新闻
      .slice(0, source.limit || 5);
    
    const filteredCount = feed.items.filter(item => isFreshNews(item.pubDate || item.isoDate)).length - items.length;
    if (filteredCount > 0) {
      console.log(`   ✓ ${items.length} 条 (过滤掉 ${filteredCount} 条非AI新闻)`);
    } else {
      console.log(`   ✓ ${items.length} 条`);
    }
    return items;
  } catch (error) {
    console.error(`   ✗ 失败: ${error.message}`);
    return [];
  }
}

async function fetchSerperNews() {
  if (!CONFIG.serper.apiKey) {
    console.log('📡 Serper API: ⚠️ 未配置 API Key');
    return [];
  }
  
  try {
    console.log('📡 Serper API');
    
    // 大量查询词确保海外新闻充足
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
      'Replika AI companion'
    ];
    
    const allNews = [];
    const seenUrls = new Set();
    
    for (const query of queries) {
      try {
        const response = await axios.post('https://google.serper.dev/news', {
          q: query,
          gl: 'us',
          hl: 'en',
          tbs: 'qdr:d',
          num: 10  // 每查询词最多10条
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
      
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`   ✓ ${allNews.length} 条`);
    return allNews;
  } catch (error) {
    return [];
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
  for (const source of DOMESTIC_RSS_SOURCES) {
    const items = await parseRSS(source);
    domestic.push(...items);
  }
  
  const overseas = [];
  for (const source of OVERSEAS_RSS_SOURCES) {
    const items = await parseRSS(source);
    overseas.push(...items);
  }
  
  const serperNews = await fetchSerperNews();
  overseas.push(...serperNews);
  
  const uniqueDomestic = deduplicate(domestic);
  const uniqueOverseas = deduplicate(overseas);
  
  console.log(`\n📊 去重后: 国内 ${uniqueDomestic.length}, 海外 ${uniqueOverseas.length}`);
  
  return {
    domestic: uniqueDomestic,
    overseas: uniqueOverseas
  };
}
