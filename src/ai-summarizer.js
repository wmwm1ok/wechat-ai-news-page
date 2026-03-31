import axios from 'axios';
import { CONFIG } from './config.js';
import { classifyNewsCategory } from './category-classifier.js';

function isCfcFastMode() {
  return process.env.CFC_FAST_MODE === 'true';
}

function getEnvNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const KNOWN_AI_ENTITIES = [
  'openai', 'sora', 'runway', 'gen-4', 'gen4', 'seedance', 'google', 'gemini', 'anthropic',
  'claude', 'meta', 'llama', 'mistral', 'perplexity', 'nvidia', 'pika', 'veo', 'midjourney'
];

const COMPARISON_KEYWORDS = [
  '对比', '比较', '测评', '评测', '横评', '盘点', 'benchmark', 'benchmarks', 'vs', 'versus',
  'compare', 'comparison', 'review', 'head-to-head', 'battle', '基准测试'
];

const COMPARISON_DIMENSIONS = {
  'api': ['api', '接口', 'sdk', '调用'],
  'latency': ['latency', '延迟', '耗时', '速度', '响应时间'],
  'pricing': ['pricing', 'price', 'cost', '定价', '价格', '成本', '美元', '$'],
  'quality': ['质量', '画质', '一致性', '效果', '输出质量'],
  'resolution': ['分辨率', 'resolution', '1080p', '720p', '4k'],
  'duration': ['时长', 'duration', '秒', 'seconds', '视频长度'],
  'rate_limit': ['rate limit', '并发', '限流', '吞吐'],
  'developer': ['developer', '开发者', '集成', '部署', '生产环境']
};

const GENERIC_SUMMARY_PATTERNS = [
  /进行了(?:深入)?对比/,
  /内容涵盖/,
  /文章(?:对|主要对)/,
  /从.+方面/,
  /进行了(?:分析|介绍|梳理)/,
  /面向开发者的.+对比/,
  /值得关注/,
  /展开了.+比较/
];

const COMPARISON_CONCLUSION_KEYWORDS = [
  '更快', '更慢', '更便宜', '更贵', '更适合', '优势', '劣势', '高于', '低于', '领先',
  '落后', '胜出', '不占优', '更成熟', '更稳定', '更完整', '更激进', '结论', '原文未给出明确结论'
];

const STORY_KEYWORDS = [
  '创业者', '创始人', 'founder', 'profile', '人物', '故事', '靠', '借助', '副业', '创业',
  '热潮', 'side hustle', 'built with', 'using', '通过'
];

const ROUNDUP_KEYWORDS = [
  '简报', 'brief', 'download', 'digest', 'newsletter', 'roundup', 'round-up',
  '本期', '这期', 'weekly', '周报', '速览', '简讯', '精选'
];

const GENERIC_ARTICLE_PATTERNS = [
  /本期.+?(介绍|讨论|提到|聚焦|梳理|盘点)/,
  /文章(?:主要)?(?:介绍|讨论|提到|讲述|聚焦|梳理|分析)/,
  /简报(?:介绍|提到|讨论|聚焦)/,
  /报道(?:讲述|介绍)/,
  /围绕.+展开/,
  /探讨了/,
  /讲述了/,
  /介绍了.+如何/,
  /提到了.+竞赛/,
  /内容聚焦/
];

const CONCRETE_ACTION_KEYWORDS = [
  '发布', '推出', '上线', '开源', '收购', '融资', '训练', '采用', '实现', '使用',
  '比较', '测试', '支持', '接管', '自动完成', '部署', '生成', '改进', '节省',
  '提供', '搜索', '列出', '带动', '解释', '说明'
];

const PRODUCT_EXPLANATION_KEYWORDS = [
  '工具', '模型', '系统', '平台', '项目', '接口', '功能', '工作流', '机器人', '世界模型',
  '多模态', '嵌入模型', '强化学习', 'AI 工具', '开源工具'
];

const STORY_RESULT_KEYWORDS = [
  '接单', '承接', '副业', '收入', '获利', '赚钱', '项目', '客户', '订单', '变现'
];

const STORY_GENERIC_PATTERNS = [
  /借此机会/,
  /实现了.+梦想/,
  /开始尝试使用/
];

const READER_WARNING_PATTERNS = [
  /当前可确认/,
  /不做扩展解读/,
  /无法可靠提炼/,
  /正文不足/,
  /信息不足/,
  /当前抓取到的片段/,
  /不足以稳定/,
  /暂时无法生成可靠摘要/,
  /公开片段(?:显示)?(?:没有|未).*(?:细节|差异|结论|披露|展开|更多)/,
  /公开片段显示/,
  /^这期内容主要提到/,
  /讲的是个人或团队围绕 AI 工具展开实践/,
  /相关信息较少/
];

const HTML_NOISE_BLOCKS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<style[^>]*>[\s\S]*?<\/style>/gi,
  /<noscript[^>]*>[\s\S]*?<\/noscript>/gi,
  /<svg[\s\S]*?<\/svg>/gi,
  /<nav[\s\S]*?<\/nav>/gi,
  /<footer[\s\S]*?<\/footer>/gi,
  /<header[\s\S]*?<\/header>/gi,
  /<aside[\s\S]*?<\/aside>/gi,
  /<form[\s\S]*?<\/form>/gi
];

const TEXT_NOISE_PATTERNS = [
  /雷峰网.*?您正在使用IE低版本浏览器/,
  /Copyright\s*[©©]/i,
  /联系我们/,
  /意见反馈/,
  /投稿/,
  /申请专栏作者/,
  /客户端下载/,
  /扫码/,
  /公众号/,
  /相关阅读/,
  /更多\s*>\s*/,
  /上一篇/,
  /下一篇/,
  /热门文章/,
  /推荐阅读/,
  /专题精选/,
  /账号设置/,
  /登录/,
  /注册/,
  /收藏/,
  /点赞/,
  /评论/,
  /分享/,
  /返回顶部/,
  /隐私政策/,
  /未经授权禁止转载/,
  /本文来源/,
  /本文作者/
];

const TRUNCATED_ENDING_PATTERNS = [
  /(?:拥有|发表|融资|募资|估值|达到|约|近|超|超过|新增|覆盖|支持|减少|增长|下降)\d+[。！？]$/u,
  /[0-9一二三四五六七八九十百千万两]+(?:余|多)?[。！？]$/u,
  /(?:以及|并|和|等|其中|包括|还有|分别为)[。！？]$/u
];

function hasTruncatedEnding(summary) {
  const trimmed = String(summary || '').trim();
  return TRUNCATED_ENDING_PATTERNS.some(pattern => pattern.test(trimmed));
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function countChineseChars(text) {
  return (String(text || '').match(/[\u4e00-\u9fff]/g) || []).length;
}

function countLatinChars(text) {
  return (String(text || '').match(/[A-Za-z]/g) || []).length;
}

function isMostlyChineseSummary(summary) {
  const normalized = decodeHtmlEntities(summary);
  const chineseCount = countChineseChars(normalized);
  const latinCount = countLatinChars(normalized);

  if (chineseCount < 18) {
    return false;
  }

  if (latinCount === 0) {
    return true;
  }

  return chineseCount >= latinCount * 0.8;
}

function trimAtNaturalBoundary(text, maxLength) {
  const normalized = String(text || '').trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const candidate = normalized.slice(0, maxLength + 1);
  const strongBreaks = ['。', '！', '？', '；', ';'];
  const clauseBreaks = ['，', ',', '、', '：', ':'];
  const minBoundaryIndex = Math.floor(maxLength * 0.55);

  const lastStrongBreak = Math.max(...strongBreaks.map(char => candidate.lastIndexOf(char)));
  if (lastStrongBreak >= minBoundaryIndex) {
    return candidate.slice(0, lastStrongBreak + 1).trim().replace(/[；;]$/u, '。');
  }

  const lastClauseBreak = Math.max(...clauseBreaks.map(char => candidate.lastIndexOf(char)));
  if (lastClauseBreak >= minBoundaryIndex) {
    return candidate.slice(0, lastClauseBreak).trim().replace(/[，,、：:\s]+$/u, '') + '。';
  }

  const lastSpace = candidate.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxLength * 0.7)) {
    return candidate.slice(0, lastSpace).trim().replace(/[A-Za-z0-9-]+$/u, '').trim().replace(/[，,；;：:、\s]+$/u, '') + '。';
  }

  return candidate.slice(0, maxLength).trim().replace(/[A-Za-z0-9-]+$/u, '').trim().replace(/[，,；;：:、\s]+$/u, '') + '。';
}

// 检测摘要是否完整（不以...结尾且以句号/感叹号/问号结尾）
export function isSummaryComplete(summary) {
  if (!summary || summary.length < 50) return false;
  
  const trimmed = decodeHtmlEntities(summary).trim();
  
  // 如果以...或…结尾，说明被截断了
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return false;
  if (hasTruncatedEnding(trimmed)) return false;
  
  // 如果以句子结束符结尾，认为是完整的
  const sentenceEndings = /[。！？]$/;
  return sentenceEndings.test(trimmed);
}

// 抓取网页全文
export function extractMainTextFromHtml(html) {
  let cleaned = String(html || '');
  for (const pattern of HTML_NOISE_BLOCKS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned
    .replace(/<\/(p|div|section|article|h1|h2|h3|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  let paragraphs = cleaned
    .split(/\n+/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(part => part.length >= 30);

  paragraphs = paragraphs.filter(part => !TEXT_NOISE_PATTERNS.some(pattern => pattern.test(part)));

  const scored = paragraphs
    .map(part => {
      const sentenceCount = (part.match(/[。！？.!?]/g) || []).length;
      const punctuationCount = (part.match(/[，,；;：:]/g) || []).length;
      const hasAiKeywords = /(AI|人工智能|模型|工具|系统|平台|OpenAI|Google|百度|量子位|OpenClaw|Gemini|Claude|机器人|世界模型|强化学习)/i.test(part);
      const penalty =
        (/(登录|注册|评论|点赞|分享|联系我们|版权|隐私|推荐|更多|专题|扫码|下载客户端|上一篇|下一篇)/.test(part) ? 4 : 0) +
        (/-->|&nbsp;/.test(part) ? 4 : 0);
      const score = part.length + sentenceCount * 20 + punctuationCount * 4 + (hasAiKeywords ? 40 : 0) - penalty * 30;

      return { part, score };
    })
    .sort((a, b) => b.score - a.score);

  const bestParagraphs = scored
    .filter(item => item.score > 40)
    .slice(0, 6)
    .map(item => item.part);

  const joined = (bestParagraphs.length > 0 ? bestParagraphs : paragraphs.slice(0, 4)).join('\n');
  return joined.replace(/\s+/g, ' ').trim().substring(0, 2200);
}

async function fetchFullContent(url) {
  try {
    console.log(`   🔍 抓取全文: ${url.substring(0, 60)}...`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      maxRedirects: 5
    });
    
    const html = response.data;
    const text = extractMainTextFromHtml(html);
    
    console.log(`   ✅ 抓取成功: ${text.length} 字符`);
    return text;
  } catch (error) {
    console.log(`   ⚠️ 抓取失败: ${error.message}`);
    return null;
  }
}

async function callDeepSeek(prompt) {
  try {
    const response = await axios.post(
      CONFIG.deepseek.apiUrl,
      {
        model: CONFIG.deepseek.model,
        messages: [
          { role: 'system', content: '你是AI新闻编辑，输出严格JSON。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000  // 增加token确保摘要完整
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    const content = response.data.choices[0]?.message?.content || '';
    return content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } catch (error) {
    console.error('DeepSeek API 调用失败:', error.message);
    throw error;
  }
}

function inferCategory(title, summary = '', category = '') {
  return classifyNewsCategory({ title, summary, category });
}

function extractCompanyFromTitle(title) {
  if (!title) return '';
  const companies = ['字节','豆包','百度','阿里','腾讯','智谱','月之暗面','Kimi','MiniMax','稀宇',
    'OpenAI','Google','Meta','Anthropic','Microsoft','Amazon','Apple','NVIDIA','xAI','Grok','ChatGPT','Claude','Gemini','Llama','Perplexity','Mistral',
    'Adobe','Salesforce','Oracle','IBM','Intel','AMD','Samsung','Sony','Tesla'];
  const t = title.toLowerCase();
  for (const c of companies) {
    if (t.includes(c.toLowerCase())) return c;
  }
  return '';
}

function normalizeSummary(summary) {
  if (!summary) return '暂无摘要';
  summary = decodeHtmlEntities(summary).replace(/\s+/g, ' ').trim();
  const truncatedEnding = hasTruncatedEnding(summary);
  
  // 检查是否以完整句子结尾（。！？）
  const sentenceEndings = /[。！？]$/;
  
  if (!sentenceEndings.test(summary) || truncatedEnding) {
    const trimmingTarget = truncatedEnding ? summary.slice(0, -1) : summary;
    // 先尝试在强停顿处截断（句号/问号/感叹号/分号）
    const lastStrongBreak = Math.max(
      trimmingTarget.lastIndexOf('。'),
      trimmingTarget.lastIndexOf('！'),
      trimmingTarget.lastIndexOf('？'),
      trimmingTarget.lastIndexOf('；'),
      trimmingTarget.lastIndexOf(';')
    );
    
    if (lastStrongBreak > 0) {
      summary = trimmingTarget.substring(0, lastStrongBreak + 1).replace(/[；;]$/u, '。');
    } else {
      const lastClauseBreak = Math.max(
        trimmingTarget.lastIndexOf('，'),
        trimmingTarget.lastIndexOf(','),
        trimmingTarget.lastIndexOf('、'),
        trimmingTarget.lastIndexOf('：'),
        trimmingTarget.lastIndexOf(':')
      );

      if (lastClauseBreak > Math.floor(summary.length * 0.55)) {
        summary = trimmingTarget.substring(0, lastClauseBreak).replace(/[，,、：:\s]+$/u, '') + '。';
      }
    }
  }
  
  return summary;
}

export function normalizeDisplaySummary(summary, options = {}) {
  const minLength = options.minLength || 90;
  const maxLength = options.maxLength || 150;
  const normalized = normalizeSummary(summary || '');

  if (!normalized || normalized === '暂无摘要') {
    return normalized;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentences = normalized
    .split(/(?<=[。！？])/)
    .map(part => part.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return trimAtNaturalBoundary(normalized, maxLength);
  }

  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > maxLength) {
      break;
    }
    result += sentence;
  }

  if (result.length >= minLength) {
    return result;
  }

  return trimAtNaturalBoundary(normalized, maxLength);
}

function countKnownEntities(text) {
  const lower = String(text || '').toLowerCase();
  return KNOWN_AI_ENTITIES.filter(entity => lower.includes(entity)).length;
}

function extractComparisonDimensions(text) {
  const lower = String(text || '').toLowerCase();
  const dimensions = [];

  for (const [label, keywords] of Object.entries(COMPARISON_DIMENSIONS)) {
    if (keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
      dimensions.push(label);
    }
  }

  return dimensions;
}

export function isComparisonArticle(item) {
  const text = `${item?.title || ''} ${item?.snippet || ''}`;
  const lower = text.toLowerCase();
  const hasKeyword = COMPARISON_KEYWORDS.some(keyword => lower.includes(keyword));
  const entityCount = countKnownEntities(text);
  const dimensionCount = extractComparisonDimensions(text).length;

  return (hasKeyword && dimensionCount >= 1) || (entityCount >= 3 && dimensionCount >= 2);
}

export function detectArticleMode(item) {
  if (isComparisonArticle(item)) {
    return 'comparison';
  }

  const text = `${item?.title || ''} ${item?.snippet || ''}`.toLowerCase();

  if (ROUNDUP_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'roundup';
  }

  if (STORY_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'story';
  }

  return 'default';
}

function countConcreteSignals(text) {
  const normalized = String(text || '');
  const numberCount = (normalized.match(/\d+\.?\d*/g) || []).length;
  const actionCount = CONCRETE_ACTION_KEYWORDS.filter(keyword => normalized.includes(keyword)).length;
  const productCount = PRODUCT_EXPLANATION_KEYWORDS.filter(keyword => normalized.includes(keyword)).length;

  return {
    numberCount,
    actionCount,
    productCount
  };
}

function extractTopicsFromTitle(title) {
  const tail = String(title || '')
    .replace(/^[^:：]+[:：]\s*/, '')
    .replace(/[《》]/g, '')
    .trim();

  return tail
    .split(/[、,，；;]|以及|与|and/gi)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function makeReaderFriendlySentence(text) {
  return normalizeSummary(String(text || '').replace(/^本期/, '这期').replace(/^文章/, '原文'));
}

export function isReaderFriendlySummary(summary) {
  const normalized = normalizeSummary(summary || '');
  if (!normalized || normalized === '暂无摘要') {
    return false;
  }

  return !READER_WARNING_PATTERNS.some(pattern => pattern.test(normalized)) && isMostlyChineseSummary(normalized);
}

export function isDisplayReadyNews(item) {
  if (!item || !item.summary) {
    return false;
  }

  const articleMode = detectArticleMode(item);
  const comparisonMode = articleMode === 'comparison';
  const sourceContext = `${item.title || ''} ${item.snippet || ''}`.trim();

  return (
    isSummaryComplete(item.summary) &&
    isReaderFriendlySummary(item.summary) &&
    isSpecificEnoughSummary(item.summary, sourceContext, { comparisonMode, articleMode })
  );
}

export function isReserveDisplayNews(item) {
  if (!item || !item.summary) {
    return false;
  }

  const normalized = normalizeDisplaySummary(item.summary, {
    minLength: 70,
    maxLength: 160
  });

  if (!normalized || normalized === '暂无摘要' || !isMostlyChineseSummary(normalized)) {
    return false;
  }

  const sourceContext = `${item.title || ''} ${item.snippet || ''}`.trim();
  const entityCount = countKnownEntities(`${item.title || ''} ${normalized}`);
  const { numberCount, actionCount, productCount } = countConcreteSignals(normalized);
  const articleMode = detectArticleMode(item);
  const comparisonMode = articleMode === 'comparison';
  const signalScore = entityCount + numberCount + actionCount + productCount;

  return (
    signalScore >= 3 &&
    (
      isSummaryComplete(normalized) ||
      isSpecificEnoughSummary(normalized, sourceContext, { comparisonMode, articleMode })
    )
  );
}

export function isLastChanceDisplayNews(item) {
  if (!item || !item.summary) {
    return false;
  }

  const normalized = normalizeDisplaySummary(item.summary, {
    minLength: 55,
    maxLength: 160
  });

  if (!normalized || normalized === '暂无摘要' || normalized.length < 55) {
    return false;
  }

  if (!isReaderFriendlySummary(normalized)) {
    return false;
  }

  const entityCount = countKnownEntities(`${item.title || ''} ${normalized}`);
  const { numberCount, actionCount, productCount } = countConcreteSignals(normalized);
  const signalScore = entityCount + numberCount + actionCount + productCount;

  return signalScore >= 2 || Number(item.score || 0) >= 18;
}

export function isSpecificEnoughSummary(summary, sourceText = '', options = {}) {
  const normalized = normalizeSummary(summary || '');
  if (!normalized || normalized === '暂无摘要') return false;

  const genericHit = GENERIC_SUMMARY_PATTERNS.some(pattern => pattern.test(normalized));
  const entityCount = countKnownEntities(normalized);
  const dimensionCount = extractComparisonDimensions(`${normalized} ${sourceText}`).length;
  const hasConclusion = COMPARISON_CONCLUSION_KEYWORDS.some(keyword => normalized.includes(keyword));
  const articleGenericHit = GENERIC_ARTICLE_PATTERNS.some(pattern => pattern.test(normalized));
  const { numberCount, actionCount, productCount } = countConcreteSignals(normalized);
  const articleMode = options.articleMode || 'default';

  if (options.comparisonMode) {
    const hasEnoughSignals = entityCount >= 2 && dimensionCount >= 2;
    if (!hasEnoughSignals) return false;
    if (!hasConclusion && numberCount < 2) return false;
    if (genericHit && !hasConclusion) return false;
    return true;
  }

  if (genericHit && numberCount + entityCount + dimensionCount < 3) {
    return false;
  }

  if (articleMode === 'story') {
    const hasEnoughStorySignals = actionCount >= 1 && (productCount >= 1 || entityCount >= 1);
    if (!hasEnoughStorySignals) return false;
    const hasConcreteStoryResult = STORY_RESULT_KEYWORDS.some(keyword => normalized.includes(keyword));
    if (!hasConcreteStoryResult) return false;
    if (articleGenericHit && numberCount + actionCount + productCount + entityCount < 4) return false;
    if (STORY_GENERIC_PATTERNS.some(pattern => pattern.test(normalized)) && numberCount + actionCount + productCount + entityCount < 5) return false;
  }

  if (articleMode === 'roundup') {
    const hasEnoughRoundupSignals = (numberCount >= 1 || entityCount >= 2 || productCount >= 1) && actionCount >= 1;
    if (!hasEnoughRoundupSignals) return false;
    if (articleGenericHit) return false;
  }

  return true;
}

function buildFallbackSummary(item, sourceText, options = {}) {
  const rawText = String(sourceText || item.snippet || '').trim();
  const normalizedRawText = makeReaderFriendlySentence(rawText);
  if (!rawText) {
    return `${item.title}相关信息较少，当前公开片段未披露更多细节。`;
  }

  if (options.comparisonMode) {
    const dimensions = extractComparisonDimensions(rawText);
    const dimensionLabels = {
      api: 'API 形态',
      latency: '延迟',
      pricing: '定价',
      quality: '输出质量',
      resolution: '分辨率',
      duration: '视频时长',
      rate_limit: '并发与限流',
      developer: '开发者集成'
    };
    const readableDimensions = dimensions
      .map(dimension => dimensionLabels[dimension] || dimension)
      .slice(0, 4);

    if (normalizedRawText && !GENERIC_ARTICLE_PATTERNS.some(pattern => pattern.test(normalizedRawText))) {
      return normalizedRawText;
    }

    if (readableDimensions.length > 0) {
      return `原文把${item.title}放在一起比较，重点涉及${readableDimensions.join('、')}等维度，但公开片段没有披露更完整的差异和最终结论。`;
    }

    return `${item.title}是一篇对比或评测类内容，公开片段显示文章围绕多项能力差异展开，但没有披露更完整的测试结果。`;
  }

  if (options.articleMode === 'roundup') {
    const topics = extractTopicsFromTitle(item.title);
    if (topics.length > 0) {
      return `这期内容主要提到${topics.join('、')}。${normalizedRawText && !GENERIC_ARTICLE_PATTERNS.some(pattern => pattern.test(normalizedRawText)) ? normalizedRawText : '公开片段没有展开更多细节。'}`;
    }

    return normalizedRawText || `${item.title}是一篇简报或综述类内容，公开片段没有展开更多细节。`;
  }

  if (options.articleMode === 'story') {
    if (normalizedRawText && !GENERIC_ARTICLE_PATTERNS.some(pattern => pattern.test(normalizedRawText))) {
      return normalizedRawText;
    }

    return `${item.title}讲的是个人或团队围绕 AI 工具展开实践，公开片段显示主角借助相关工具承接任务或尝试创业。`;
  }

  return normalizedRawText;
}

function getSelectedRefineLimit(totalItems) {
  const envLimit = Number(process.env.SELECTED_REFINE_LIMIT);
  if (Number.isFinite(envLimit) && envLimit >= 0) {
    return Math.min(envLimit, totalItems);
  }

  return isCfcFastMode() ? Math.min(6, totalItems) : totalItems;
}

async function getSummarySourceContent(item, options = {}) {
  let content = item.snippet || '';
  let usedFullContent = false;
  const fastMode = isCfcFastMode();

  if ((options.forceFullContent || !isSummaryComplete(content)) && !(fastMode && options.allowFastSkip !== false)) {
    console.log(`   ⚠️ ${options.forceFullContent ? '命中复杂文章，强制抓取全文...' : 'RSS摘要不完整，尝试抓取全文...'}`);
    const fullContent = await fetchFullContent(item.url);
    if (fullContent) {
      content = fullContent;
      usedFullContent = true;
    }
  }

  return {
    content,
    usedFullContent
  };
}

function buildSingleSummaryPrompt(item, content, options = {}) {
  const comparisonMode = options.comparisonMode === true;
  const articleMode = options.articleMode || 'default';

  return `为以下新闻写中文标题、摘要和分类。

【原文标题】${item.title}
${options.usedFullContent ? '【原文内容 - 基于此文总结】' : '【原文摘要 - 基于此内容总结】'}
${content.substring(0, 2000)}

输出JSON：
{"title_cn":"中文标题","summary":"摘要","category":"技术与研究","company":"公司名"}

【绝对禁止 - 违反会导致错误信息】
1. 禁止编造原文没有的事实、数字、公司名称
2. 禁止添加原文未提及的技术细节或功能描述
3. 禁止推测原文没有的未来计划或影响
4. 如果原文信息不完整，如实反映，不要脑补
5. 只总结原文明确提及的内容

【强制规则】
1. category只能是以下4个之一：
   - "产品发布与更新" → 新产品发布、功能更新
   - "技术与研究" → 技术突破、论文、研究成果
   - "投融资与并购" → 融资、投资、收购
   - "政策与监管" → 政策法规、监管动态
2. summary要求：
   - 严格基于原文内容进行总结，字数200-400字
   - 用自己的话重述原文事实，不要复制原文片段
   - 只写原文明确提到的信息，不确定的内容不写
   - 3-4个完整句子，结尾必须是句号
3. company必须从标题提取原文提到的公司名，没有就空字符串
4. title_cn基于原标题改写，保留核心事实，不要添加原标题没有的信息
5. 只输出JSON，不要其他内容
${comparisonMode ? `6. 这是对比/评测类文章，摘要必须明确写出：
   - 比较对象是谁
   - 比较维度是什么（如 API、延迟、价格、质量、开发者集成）
   - 原文明确给出的结论；如果原文没有明确结论，要直接写“原文未给出明确结论”
7. 禁止只写“进行了对比”“涵盖了多个方面”这种空泛表述` : ''}
${articleMode === 'story' ? `6. 这是人物/创业故事类文章，摘要必须写出：
   - 主角具体用了什么工具、产品或项目
   - 这个工具或项目能做什么
   - 他因此获得了什么结果或机会
7. 禁止只写“讲述创业故事”“借助热潮创业”这种空话` : ''}
${articleMode === 'roundup' ? `6. 这是简报/综述类文章，摘要必须写出：
   - 文章实际列举了哪 2-3 个主题或观点
   - 每个主题的具体内容是什么
7. 禁止只写“本期简报介绍了什么”“讨论了多个话题”这种空话` : ''}`;
}

async function summarizeSingle(item, options = {}) {
  const comparisonMode = options.comparisonMode === true;
  const articleMode = options.articleMode || detectArticleMode(item);
  const { content, usedFullContent } = await getSummarySourceContent(item, {
    forceFullContent: options.forceFullContent === true || comparisonMode
  });
  
  const prompt = buildSingleSummaryPrompt(item, content, {
    comparisonMode,
    articleMode,
    usedFullContent
  });

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    
    // 简单验证：检查AI输出是否包含原文没有的数字（可能编造）
    const aiSummary = parsed.summary || '';
    const originalNumbers = content.match(/\d+\.?\d*/g) || [];
    const aiNumbers = aiSummary.match(/\d+\.?\d*/g) || [];
    
    // 如果AI出现了原文没有的数字，使用原文摘要作为后备
    const hasFabricatedNumbers = aiNumbers.some(n => !originalNumbers.includes(n));
    if (hasFabricatedNumbers && aiNumbers.length > originalNumbers.length) {
      console.log(`   ⚠️ 检测到AI可能编造数字，使用原文摘要`);
      return {
        ...item,
        title: parsed.title_cn || item.title,
        summary: buildFallbackSummary(item, item.snippet || content, { comparisonMode }),
        category: inferCategory(parsed.title_cn || item.title, buildFallbackSummary(item, item.snippet || content, { comparisonMode }), parsed.category),
        company: parsed.company || extractCompanyFromTitle(item.title)
      };
    }

    const normalizedSummary = normalizeSummary(parsed.summary);
    if (!isSpecificEnoughSummary(normalizedSummary, content, { comparisonMode, articleMode })) {
      console.log(`   ⚠️ 摘要过于空泛，使用保守后备摘要`);
      return {
        ...item,
        title: parsed.title_cn || item.title,
        summary: buildFallbackSummary(item, content, { comparisonMode, articleMode }),
        category: inferCategory(parsed.title_cn || item.title, buildFallbackSummary(item, content, { comparisonMode, articleMode }), parsed.category),
        company: parsed.company || extractCompanyFromTitle(item.title)
      };
    }
    
    return {
      ...item,
      title: parsed.title_cn || item.title,
      summary: normalizedSummary,
      category: inferCategory(parsed.title_cn || item.title, normalizedSummary, parsed.category),
      company: parsed.company || extractCompanyFromTitle(item.title)
    };
  } catch (error) {
    const fallbackSummary = buildFallbackSummary(item, content, { comparisonMode, articleMode });
    return {
      ...item,
      summary: fallbackSummary,
      category: inferCategory(item.title, fallbackSummary),
      company: extractCompanyFromTitle(item.title)
    };
  }
}

async function refineSingleSelected(item) {
  const articleMode = detectArticleMode(item);
  const comparisonMode = articleMode === 'comparison';
  const { content } = await getSummarySourceContent(item, {
    forceFullContent: true,
    allowFastSkip: false
  });

  const prompt = `请基于原文内容，重写这条 AI 新闻摘要，让它更具体、更易懂。

【新闻标题】
${item.title}

【当前摘要】
${item.summary || '暂无摘要'}

【原文内容】
${String(content || item.snippet || '').substring(0, 2200)}

输出 JSON：
{"summary":"更具体的新摘要"}

要求：
1. 只输出 JSON
2. 摘要使用中文，110-170 字
3. 必须写出 2-3 个具体信息点，不能只写泛泛概述
4. 如果原文讲的是方法/研究，要写出它具体做了什么、解决什么问题
5. 如果原文讲的是公司/产品，要写出发布了什么、核心变化是什么
6. 不允许编造原文没有的数字、结论和细节
7. ${comparisonMode ? '如果是对比/评测文章，必须写出比较对象、比较维度和明确结论；没有结论就直说原文未给出明确结论。' : '如果原文信息有限，就明确说明信息有限，但仍尽量保留已有具体点。'}
8. ${articleMode === 'story' ? '如果是人物/创业故事类，必须写清楚主角用了什么工具或项目、它能做什么、以及最终带来了什么结果。' : '不是人物/创业故事类就忽略这一条。'}
9. ${articleMode === 'roundup' ? '如果是简报/综述类，必须写出文中列举的 2-3 个具体主题，不能只写“本期简报介绍了什么”。' : '不是简报/综述类就忽略这一条。'}`;

  try {
    const response = await callDeepSeek(prompt);
    const parsed = JSON.parse(response);
    const refinedSummary = normalizeDisplaySummary(parsed.summary);

    if (!isSpecificEnoughSummary(refinedSummary, content, { comparisonMode, articleMode })) {
      return {
        ...item,
        summary: buildFallbackSummary(item, content, { comparisonMode, articleMode })
      };
    }

    return {
      ...item,
      summary: refinedSummary
    };
  } catch (error) {
    return {
      ...item,
      summary: buildFallbackSummary(item, content, { comparisonMode, articleMode })
    };
  }
}

async function summarizeBatch(items) {
  if (items.length === 0) return [];
  
  const batchSize = getEnvNumber('SUMMARY_BATCH_SIZE', isCfcFastMode() ? 8 : 5);
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPrompt = batch.map((item, idx) => 
      `[${idx+1}] 标题：${item.title}\n内容：${item.snippet?.substring(0, isCfcFastMode() ? 360 : 600)}`
    ).join('\n\n');
    
    const prompt = `为以下${batch.length}条新闻写中文标题和摘要。

${batchPrompt}

输出JSON数组：
[{"title_cn":"中文标题","summary":"摘要","category":"技术与研究","company":"公司名"}]

【绝对禁止 - 违反会导致错误信息】
1. 禁止编造原文没有的事实、数字、公司名称
2. 禁止添加原文未提及的技术细节
3. 禁止推测原文没有的未来计划
4. 只总结原文明确提及的内容

【强制规则】
1. category只能是这4个之一："产品发布与更新"、"技术与研究"、"投融资与并购"、"政策与监管"
2. summary要求：
   - 严格基于原文内容进行总结，200-400字
   - 用自己的话重述原文明确提到的事实
   - 不确定的内容不写，不脑补
   - 3-4个完整句子，结尾必须是句号
3. company必须从标题提取原文提到的公司名
4. 禁止只写“文章对X进行了对比/介绍/分析”这类空话，摘要里必须包含原文中的具体对象、动作或指标
5. 只输出JSON`;

    try {
      const response = await callDeepSeek(prompt);
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        for (let j = 0; j < batch.length; j++) {
          const origItem = batch[j];
          const aiItem = parsed[j] || {};
          const summary = isSpecificEnoughSummary(aiItem.summary, origItem.snippet)
            ? normalizeSummary(aiItem.summary)
            : buildFallbackSummary(origItem, origItem.snippet);
          
          results.push({
            ...origItem,
            title: aiItem.title_cn || origItem.title,
            summary,
            category: inferCategory(aiItem.title_cn || origItem.title, summary, aiItem.category),
            company: aiItem.company || extractCompanyFromTitle(origItem.title)
          });
        }
      }
    } catch (error) {
      for (const item of batch) {
        const summary = normalizeSummary(item.snippet);
        results.push({
          ...item,
          summary,
          category: inferCategory(item.title, summary),
          company: extractCompanyFromTitle(item.title)
        });
      }
    }
    
    await new Promise(r => setTimeout(r, isCfcFastMode() ? 120 : 500));
  }
  
  return results;
}

export async function summarizeNews({ domestic, overseas }) {
  console.log('\n🤖 AI总结中...');
  const fastMode = isCfcFastMode();

  const domesticItems = domestic.slice(0, getEnvNumber('DOMESTIC_SUMMARY_LIMIT', fastMode ? 8 : 36));
  const overseasItems = overseas.slice(0, getEnvNumber('OVERSEAS_SUMMARY_LIMIT', fastMode ? 16 : 60));

  if (fastMode) {
    console.log('   ⚡ CFC 快速模式已启用：批量摘要、减少全文抓取、压缩候选数量');
    const [domesticSummaries, overseasSummaries] = await Promise.all([
      summarizeBatch(domesticItems),
      summarizeBatch(overseasItems)
    ]);

    console.log(`   国内: ${domesticSummaries.length} 条 (批量)`);
    console.log(`   海外: ${overseasSummaries.length} 条 (批量)`);
    return [...domesticSummaries, ...overseasSummaries];
  }

  const overseasComparisonItems = overseasItems.filter(isComparisonArticle);
  const overseasBatchItems = overseasItems.filter(item => !isComparisonArticle(item));
  
  // 国内逐条总结
  const domesticSummaries = [];
  for (const item of domesticItems) {
    const summary = await summarizeSingle(item);
    domesticSummaries.push(summary);
    await new Promise(r => setTimeout(r, 300));
  }
  
  const overseasComparisonSummaries = [];
  for (const item of overseasComparisonItems) {
    console.log(`   🧪 对比类文章走单条总结: ${item.title.slice(0, 60)}...`);
    const summary = await summarizeSingle(item, {
      comparisonMode: true,
      forceFullContent: true
    });
    overseasComparisonSummaries.push(summary);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 海外普通新闻批量总结
  const overseasBatchSummaries = await summarizeBatch(overseasBatchItems);
  const overseasSummaries = [...overseasComparisonSummaries, ...overseasBatchSummaries];
  
  console.log(`   国内: ${domesticSummaries.length} 条`);
  console.log(`   海外: ${overseasSummaries.length} 条 (单条 ${overseasComparisonSummaries.length} / 批量 ${overseasBatchSummaries.length})`);
  
  return [...domesticSummaries, ...overseasSummaries];
}

export async function refineSelectedNews(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const refineLimit = getSelectedRefineLimit(items.length);
  const refined = [];

  console.log(`\n🪄 入选新闻精修中... (${refineLimit}/${items.length})`);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (index >= refineLimit) {
      refined.push(item);
      continue;
    }

    console.log(`   ✨ 精修: ${item.title.slice(0, 56)}...`);
    refined.push(await refineSingleSelected(item));
    await new Promise(resolve => setTimeout(resolve, isCfcFastMode() ? 120 : 250));
  }

  return refined;
}
