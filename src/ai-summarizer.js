import axios from 'axios';
import { CONFIG } from './config.js';

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

async function summarizeSingle(item) {
  let content = item.snippet;
  let usedFullContent = false;
  
  // 检测RSS摘要是否完整
  if (!isSummaryComplete(content)) {
    console.log(`   ⚠️ RSS摘要不完整，尝试抓取全文...`);
    const fullContent = await fetchFullContent(item.url);
    if (fullContent) {
      content = fullContent;
      usedFullContent = true;
    }
  }
  
  const prompt = `为以下新闻写中文标题、摘要和分类。

【原文标题】${item.title}
${usedFullContent ? '【原文内容 - 基于此文总结】' : '【原文摘要 - 基于此内容总结】'}
${content.substring(0, 1500)}

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
5. 只输出JSON，不要其他内容`;

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
        summary: normalizeSummary(item.snippet),
        category: parsed.category || inferCategory(item.title),
        company: parsed.company || extractCompanyFromTitle(item.title)
      };
    }
    
    return {
      ...item,
      title: parsed.title_cn || item.title,
      summary: normalizeSummary(parsed.summary),
      category: parsed.category || inferCategory(item.title),
      company: parsed.company || extractCompanyFromTitle(item.title)
    };
  } catch (error) {
    return {
      ...item,
      summary: normalizeSummary(item.snippet),
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
      `[${idx+1}] 标题：${item.title}\n内容：${item.snippet?.substring(0, 300)}`
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
4. 只输出JSON`;

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
            summary: normalizeSummary(aiItem.summary),
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
  
  // 国内逐条总结
  const domesticSummaries = [];
  for (const item of domesticItems) {
    const summary = await summarizeSingle(item);
    domesticSummaries.push(summary);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 海外批量总结
  const overseasSummaries = await summarizeBatch(overseasItems);
  
  console.log(`   国内: ${domesticSummaries.length} 条`);
  console.log(`   海外: ${overseasSummaries.length} 条`);
  
  return [...domesticSummaries, ...overseasSummaries];
}
