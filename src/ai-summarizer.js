import axios from 'axios';
import { CONFIG } from './config.js';

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

// 检测摘要是否完整（不以...结尾且以句号/感叹号/问号结尾）
function isSummaryComplete(summary) {
  if (!summary || summary.length < 50) return false;
  
  const trimmed = summary.trim();
  
  // 如果以...或…结尾，说明被截断了
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return false;
  
  // 如果以句子结束符结尾，认为是完整的
  const sentenceEndings = /[。！？]$/;
  return sentenceEndings.test(trimmed);
}

// 抓取网页全文
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
    
    // 简单的正文提取：移除script/style标签后提取文本
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 截取前2000字符（足够AI理解全文）
    text = text.substring(0, 2000);
    
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

function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('发布') || t.includes('上线') || t.includes('推出') || t.includes('更新') || t.includes('launch') || t.includes('release')) {
    return '产品发布与更新';
  }
  if (t.includes('融资') || t.includes('投资') || t.includes('并购') || t.includes('收购') || t.includes('fund') || t.includes('invest')) {
    return '投融资与并购';
  }
  if (t.includes('政策') || t.includes('监管') || t.includes('法规') || t.includes('版权') || t.includes('policy') || t.includes('regulation')) {
    return '政策与监管';
  }
  return '技术与研究';
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
  summary = summary.trim();
  
  // 检查是否以完整句子结尾（。！？）
  const sentenceEndings = /[。！？]$/;
  
  if (!sentenceEndings.test(summary)) {
    // 尝试在最后一个句子结束处截断（而不是在中间截断）
    const lastPeriod = Math.max(
      summary.lastIndexOf('。'),
      summary.lastIndexOf('！'),
      summary.lastIndexOf('？')
    );
    
    if (lastPeriod > 0) {
      // 保留到最后一个完整句子
      summary = summary.substring(0, lastPeriod + 1);
    }
    // 如果没有找到句子结束符，保留原文（可能是AI生成不完整，但不强行截断）
  }
  
  return summary;
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

  return hasKeyword || (entityCount >= 2 && dimensionCount >= 1);
}

export function isSpecificEnoughSummary(summary, sourceText = '', options = {}) {
  const normalized = normalizeSummary(summary || '');
  if (!normalized || normalized === '暂无摘要') return false;

  const genericHit = GENERIC_SUMMARY_PATTERNS.some(pattern => pattern.test(normalized));
  const numberCount = (normalized.match(/\d+\.?\d*/g) || []).length;
  const entityCount = countKnownEntities(normalized);
  const dimensionCount = extractComparisonDimensions(`${normalized} ${sourceText}`).length;
  const hasConclusion = COMPARISON_CONCLUSION_KEYWORDS.some(keyword => normalized.includes(keyword));

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

  return true;
}

function buildFallbackSummary(item, sourceText, options = {}) {
  const rawText = String(sourceText || item.snippet || '').trim();
  if (!rawText) return '当前抓取到的原文信息不足，暂时无法生成可靠摘要。';

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

    if (readableDimensions.length > 0) {
      return `原文围绕${item.title}展开对比，当前可确认的重点主要集中在${readableDimensions.join('、')}等维度，但抓取到的正文不足以支持更细的差异和结论，因此这里不做扩展解读。`;
    }

    return `原文是一篇对比或评测类文章，但当前抓取到的正文信息不足，无法可靠提炼出具体差异和结论，因此这里不做扩展解读。`;
  }

  return normalizeSummary(rawText);
}

async function getSummarySourceContent(item, options = {}) {
  let content = item.snippet || '';
  let usedFullContent = false;

  if (options.forceFullContent || !isSummaryComplete(content)) {
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
7. 禁止只写“进行了对比”“涵盖了多个方面”这种空泛表述` : ''}`;
}

async function summarizeSingle(item, options = {}) {
  const comparisonMode = options.comparisonMode === true;
  const { content, usedFullContent } = await getSummarySourceContent(item, {
    forceFullContent: options.forceFullContent === true || comparisonMode
  });
  
  const prompt = buildSingleSummaryPrompt(item, content, {
    comparisonMode,
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
        category: parsed.category || inferCategory(item.title),
        company: parsed.company || extractCompanyFromTitle(item.title)
      };
    }

    const normalizedSummary = normalizeSummary(parsed.summary);
    if (!isSpecificEnoughSummary(normalizedSummary, content, { comparisonMode })) {
      console.log(`   ⚠️ 摘要过于空泛，使用保守后备摘要`);
      return {
        ...item,
        title: parsed.title_cn || item.title,
        summary: buildFallbackSummary(item, content, { comparisonMode }),
        category: parsed.category || inferCategory(item.title),
        company: parsed.company || extractCompanyFromTitle(item.title)
      };
    }
    
    return {
      ...item,
      title: parsed.title_cn || item.title,
      summary: normalizedSummary,
      category: parsed.category || inferCategory(item.title),
      company: parsed.company || extractCompanyFromTitle(item.title)
    };
  } catch (error) {
    return {
      ...item,
      summary: buildFallbackSummary(item, content, { comparisonMode }),
      category: inferCategory(item.title),
      company: extractCompanyFromTitle(item.title)
    };
  }
}

async function summarizeBatch(items) {
  if (items.length === 0) return [];
  
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPrompt = batch.map((item, idx) => 
      `[${idx+1}] 标题：${item.title}\n内容：${item.snippet?.substring(0, 600)}`
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
          
          results.push({
            ...origItem,
            title: aiItem.title_cn || origItem.title,
            summary: isSpecificEnoughSummary(aiItem.summary, origItem.snippet)
              ? normalizeSummary(aiItem.summary)
              : buildFallbackSummary(origItem, origItem.snippet),
            category: aiItem.category || inferCategory(origItem.title),
            company: aiItem.company || extractCompanyFromTitle(origItem.title)
          });
        }
      }
    } catch (error) {
      for (const item of batch) {
        results.push({
          ...item,
          summary: normalizeSummary(item.snippet),
          category: inferCategory(item.title),
          company: extractCompanyFromTitle(item.title)
        });
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

export async function summarizeNews({ domestic, overseas }) {
  console.log('\n🤖 AI总结中...');
  
  // 限制数量
  const domesticItems = domestic.slice(0, 25);
  const overseasItems = overseas.slice(0, 35);
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
