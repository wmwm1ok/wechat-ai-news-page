/**
 * 新闻去重引擎 - 语义指纹 + 多维度相似度
 * 防止同一事件被多个源重复报道
 */

// 实体词典 - 动态提取 + 静态补充
const ENTITY_PATTERNS = {
  // 公司/组织名（英文）
  companyEn: /\b(OpenAI|Anthropic|Google|Meta|Microsoft|NVIDIA|Amazon|Apple|Intel|AMD|Salesforce|Adobe|IBM|Oracle|DeepMind|Stability AI|Hugging Face|Midjourney|Runway|Character\.AI|Cohere|Adept|Inflection|xAI|OpenClaw|Perplexity|Scale AI|DataBricks|Snowflake|Pinecone|Weaviate|Chroma|LangChain|LlamaIndex|CrewAI|AutoGPT|BabyAGI)\b/gi,
  
  // 公司/组织名（中文）
  companyZh: /(字节跳动|字节|阿里巴巴|阿里|腾讯|百度|华为|小米|美团|滴滴|京东|网易|快手|拼多多|商汤|旷视|依图|云从|科大讯飞|讯飞|智谱|月之暗面|MiniMax|零一万物|百川智能|面壁智能|深度求索|DeepSeek|澜舟科技|思必驰|云知声|第四范式|出门问问|循环智能|智源研究院|清华|北大|中科院|MIT|斯坦福|Google|OpenAI|Meta|微软|英伟达|极佳视界)/g,
  
  // 产品/模型名
  product: /\b(GPT-[45]|GPT-4o|Claude [34]|Gemini [12]\.5|Gemini Pro|Llama [23]|Mistral|Mixtral|Phi-[34]|Stable Diffusion|Midjourney|DALL-E [23]|Sora|Whisper|Embeddings|GPTs|Assistants API|Function Calling|RAG|LangChain|LlamaIndex|AutoGPT|vLLM|TensorRT|Triton|ONNX|PyTorch|TensorFlow|JAX|Keras|Hugging Face|Transformers|BERT|RoBERTa|T5|GPT-2|GPT-3|PaLM|LaMDA|GLaM|Chinchilla|Gopher|MT-NLG|Jurassic|Bloom|GPT-Neo|GPT-J|OPT|LLaMA|Alpaca|Vicuna|WizardLM|Guanaco|MPT|Falcon|RedPajama|Dolly|StableLM|OpenLLaMA|Qwen|Baichuan|ChatGLM|InternLM|Yi|DeepSeek|Skywork|BlueLM|Chinese-LLaMA|Chinese-Alpaca|ChatYuan|CPM|EVA|Pangu|Ernie|Wudao|GLM)\b/gi,
  
  // 人名（知名AI研究者/创业者）- 支持英文名+空格组合
  person: /\b([A-Z][a-z]+\s[A-Z][a-z]+|Sam\s+Altman|Greg\s+Brockman|Ilya\s+Sutskever|Andrej\s+Karpathy|Demis\s+Hassabis|Shane\s+Legg|Mustafa\s+Suleyman|Yann\s+LeCun|Yoshua\s+Bengio|Geoffrey\s+Hinton|Andrew\s+Ng|Fei-Fei\s+Li|Jeff\s+Dean|Kai-Fu\s+Lee|李飞飞|Karpathy|Altman|Brockman|Sutskever|Hassabis|LeCun|Bengio|Hinton|Musk|Elon\s+Musk|Satya\s+Nadella|Sundar\s+Pichai|Mark\s+Zuckerberg|Larry\s+Page|Sergey\s+Brin|Tim\s+Cook|Jensen\s+Huang|黄仁勋|Bill\s+Gates|Dario\s+Amodei|Daniela\s+Amodei|Emad\s+Mostaque|Noam\s+Shazeer|Aidan\s+Gomez|Lukasz\s+Kaiser|Jakob\s+Uszkoreit|Ashish\s+Vaswani|AlexNet|ResNet|Transformer|BERT|GPT|AlphaGo|AlphaFold)\b/gi,
  
  // 动作/事件类型 - 包含同义词组
  action: /(创始人|CEO|CTO|首席|总裁|副总裁|主管|负责人|加入|加盟|入职|回归|重返|离职|离开|退出|离职|解雇|开除|罢免|解聘|辞退|裁员|任命|聘请|招募|招聘|收购|并购|合并|吞并|投资|融资|募资|筹资|上市|IPO|定增|增发|路演|发布|推出|上线|开源|开放|公测|内测|更新|升级|迭代|修复|优化|改进|支持|实现|完成|达成|突破|创新|首次|首个|第一|最大|最快|最强|领先|超越|击败|战胜|起诉|诉讼|被告|原告|禁令|监管|监管|处罚|罚款|审查|调查|合作|联手|结盟|联盟|战略|独家|授权|许可|专利|侵权|违约|裁员|扩招|招聘|校招|社招)/g,
  
  // 技术术语（用于研究类文章）
  tech: /(论文|arXiv|发表|提出|方法|模型|架构|算法|训练|推理|微调|对齐|安全|幻觉|偏见|评估|基准|评测|SOTA|state.?of.?the.?art|准确率|精度|召回率|F1|BLEU|ROUGE|Perplexity|困惑度|参数|规模|数据|数据集|语料|知识图谱|多模态|视觉|语音|自然语言|NLP|CV|ASR|TTS|LLM|大模型|基础模型|FM|AGI|AI|神经网络|深度学习|机器学习|强化学习|RLHF|DPO|PPO|监督学习|自监督|无监督|对比学习|掩码|注意力|Attention|Transformer|CNN|RNN|LSTM|GRU|Diffusion|扩散模型|GAN|VAE|Flow|ODE|SDE|NeRF|3D|生成式|Generative)/gi,
  
  // 金额/规模（投融资相关）
  financial: /(\d+\.?\d*\s*[亿万千百]\s*[美元|美金|元|人民币|USDT|BTC|ETH]|\d+\.?\d*\s*[MBKTK]\s*[轮轮轮轮]|种子轮|天使轮|A轮|B轮|C轮|D轮|E轮|F轮|Pre-IPO|IPO|定增|并购|M&A)/g
};

// 动作同义词映射 - 将不同表述映射到同一概念
const ACTION_SYNONYMS = {
  // 雇佣/加入类
  '加入': 'hire', '加盟': 'hire', '入职': 'hire', '回归': 'hire', '重返': 'hire', '招聘': 'hire', '聘请': 'hire', '任命': 'hire', '招募': 'hire',
  // 离职/解雇类  
  '离职': 'leave', '离开': 'leave', '退出': 'leave', '离职': 'leave', '解雇': 'leave', '开除': 'leave', '罢免': 'leave', '解聘': 'leave', '辞退': 'leave', '裁员': 'leave',
  // 收购类
  '收购': 'acquire', '并购': 'acquire', '合并': 'acquire', '吞并': 'acquire',
  // 投资类
  '投资': 'invest', '融资': 'invest', '募资': 'invest', '筹资': 'invest',
  // 发布类
  '发布': 'release', '推出': 'release', '上线': 'release', '开源': 'release', '开放': 'release', '公测': 'release', '内测': 'release',
  // 更新类
  '更新': 'update', '升级': 'update', '迭代': 'update', '修复': 'update', '优化': 'update', '改进': 'update',
  // 合作类
  '合作': 'coop', '联手': 'coop', '结盟': 'coop', '联盟': 'coop', '战略': 'coop',
  // 法律类
  '起诉': 'sue', '诉讼': 'sue', '被告': 'sue', '原告': 'sue', '禁令': 'sue', '处罚': 'sue', '罚款': 'sue',
  // 监管类
  '监管': 'regulate', '审查': 'regulate', '调查': 'regulate',
  // 其他
  '突破': 'breakthrough', '创新': 'breakthrough', '完成': 'achieve', '达成': 'achieve', '实现': 'achieve'
};

/**
 * 提取事件的语义指纹
 * 指纹 = { 主体, 动作, 对象, 时间 }
 */
function extractEventFingerprint(title) {
  const text = title.toLowerCase();
  const fingerprint = {
    entities: [],      // 涉及的公司/人
    actions: [],       // 动作类型（原始词）
    actionConcepts: [], // 动作概念（同义词归一化）
    products: [],      // 产品/技术
    tech: [],          // 技术术语
    financial: [],     // 金融相关
    hash: ''           // 组合哈希
  };
  
  // 提取各类实体
  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    const matches = title.match(pattern) || [];
    const normalized = matches.map(m => m.toLowerCase().trim());
    
    switch(type) {
      case 'companyEn':
      case 'companyZh':
        fingerprint.entities.push(...normalized);
        break;
      case 'product':
        fingerprint.products.push(...normalized);
        break;
      case 'person':
        fingerprint.entities.push(...normalized);
        break;
      case 'action':
        fingerprint.actions.push(...normalized);
        // 映射到概念
        for (const action of normalized) {
          const concept = ACTION_SYNONYMS[action];
          if (concept && !fingerprint.actionConcepts.includes(concept)) {
            fingerprint.actionConcepts.push(concept);
          }
        }
        break;
      case 'tech':
        fingerprint.tech.push(...normalized);
        break;
      case 'financial':
        fingerprint.financial.push(...normalized);
        break;
    }
  }
  
  // 去重
  fingerprint.entities = [...new Set(fingerprint.entities)];
  fingerprint.actions = [...new Set(fingerprint.actions)];
  fingerprint.actionConcepts = [...new Set(fingerprint.actionConcepts)];
  fingerprint.products = [...new Set(fingerprint.products)];
  fingerprint.tech = [...new Set(fingerprint.tech)];
  fingerprint.financial = [...new Set(fingerprint.financial)];
  
  // 生成组合哈希（用于快速比对）- 使用概念而非原始词
  const keyParts = [
    ...fingerprint.entities.slice(0, 2).sort(),
    ...fingerprint.actionConcepts.slice(0, 2).sort(),
    ...fingerprint.products.slice(0, 1).sort()
  ];
  fingerprint.hash = keyParts.join('|');
  
  return fingerprint;
}

/**
 * 计算两个指纹的相似度 (0-1)
 */
function calculateFingerprintSimilarity(fp1, fp2) {
  // 1. 实体重叠度（最重要）
  const entityJaccard = calculateJaccard(fp1.entities, fp2.entities);
  
  // 2. 动作重叠度（使用概念而非原始词）
  const actionJaccard = calculateJaccard(fp1.actionConcepts, fp2.actionConcepts);
  
  // 3. 产品重叠度
  const productJaccard = calculateJaccard(fp1.products, fp2.products);
  
  // 4. 哈希完全匹配（强信号）
  const hashMatch = fp1.hash && fp1.hash === fp2.hash ? 1 : 0;
  
  // 加权综合 (实体权重最高)
  const similarity = 
    entityJaccard * 0.5 +      // 实体占50%
    actionJaccard * 0.25 +     // 动作占25%
    productJaccard * 0.15 +    // 产品占15%
    hashMatch * 0.1;           // 哈希占10%
  
  return {
    overall: similarity,
    entityJaccard,
    actionJaccard,
    productJaccard,
    hashMatch
  };
}

/**
 * Jaccard相似度
 */
function calculateJaccard(set1, set2) {
  if (set1.length === 0 && set2.length === 0) return 0;
  const intersection = set1.filter(x => set2.includes(x));
  const union = [...new Set([...set1, ...set2])];
  return intersection.length / union.length;
}

/**
 * 计算文本余弦相似度（基于字符n-gram）
 */
function calculateTextSimilarity(text1, text2, n = 2) {
  const normalize = (t) => t.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
  const t1 = normalize(text1);
  const t2 = normalize(text2);
  
  // 生成n-gram
  function getNGrams(text, n) {
    const grams = [];
    for (let i = 0; i <= text.length - n; i++) {
      grams.push(text.slice(i, i + n));
    }
    return grams;
  }
  
  const grams1 = getNGrams(t1, n);
  const grams2 = getNGrams(t2, n);
  
  // 计算余弦相似度
  const set1 = new Set(grams1);
  const set2 = new Set(grams2);
  const allGrams = [...new Set([...grams1, ...grams2])];
  
  const vec1 = allGrams.map(g => grams1.filter(x => x === g).length);
  const vec2 = allGrams.map(g => grams2.filter(x => x === g).length);
  
  const dot = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (mag1 * mag2);
}

/**
 * 去重决策结果
 */
export class DeduplicationResult {
  constructor(isDuplicate, reason, confidence, details = {}) {
    this.isDuplicate = isDuplicate;
    this.reason = reason;
    this.confidence = confidence; // 0-1，置信度
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 去重引擎
 */
export class DeduplicationEngine {
  constructor(options = {}) {
    this.thresholds = {
      fingerprintSimilarity: options.fingerprintThreshold || 0.65,  // 指纹相似度阈值（提高以减少误判）
      textSimilarity: options.textThreshold || 0.8,                 // 文本相似度阈值（提高）
      minConfidence: options.minConfidence || 0.75                  // 最小置信度（提高）
    };
    this.history = []; // 去重历史日志
    this.fingerprints = new Map(); // title -> fingerprint 缓存
  }
  
  /**
   * 检查是否为重复
   */
  checkDuplicate(title, existingTitles) {
    if (!title || existingTitles.length === 0) {
      return new DeduplicationResult(false, '无需检查', 1, { existingCount: existingTitles.length });
    }
    
    // 获取或生成当前标题的指纹
    let currentFP = this.fingerprints.get(title);
    if (!currentFP) {
      currentFP = extractEventFingerprint(title);
      this.fingerprints.set(title, currentFP);
    }
    
    const results = [];
    
    for (const existing of existingTitles) {
      // 完全匹配
      if (title.toLowerCase().trim() === existing.toLowerCase().trim()) {
        const result = new DeduplicationResult(true, '标题完全相同', 1.0, { matchedWith: existing });
        this.logDecision(title, existing, result);
        return result;
      }
      
      // 获取已有标题的指纹
      let existingFP = this.fingerprints.get(existing);
      if (!existingFP) {
        existingFP = extractEventFingerprint(existing);
        this.fingerprints.set(existing, existingFP);
      }
      
      // 计算指纹相似度
      const fpSim = calculateFingerprintSimilarity(currentFP, existingFP);
      
      // 强匹配：实体+动作都匹配（实体>=1个共同，动作概念>=1个共同）
      const hasCommonEntity = currentFP.entities.some(e => existingFP.entities.includes(e));
      const hasCommonAction = currentFP.actionConcepts.some(a => existingFP.actionConcepts.includes(a));
      
      if (hasCommonEntity && hasCommonAction) {
        const result = new DeduplicationResult(true, '实体和动作高度匹配', 0.9, {
          matchedWith: existing,
          fingerprintSimilarity: fpSim,
          commonEntities: currentFP.entities.filter(e => existingFP.entities.includes(e)),
          commonActions: currentFP.actionConcepts.filter(a => existingFP.actionConcepts.includes(a)),
          currentFP,
          existingFP
        });
        this.logDecision(title, existing, result);
        return result;
      }
      
      // 中等匹配：指纹综合相似度达标
      if (fpSim.overall >= this.thresholds.fingerprintSimilarity) {
        results.push({
          existing,
          similarity: fpSim.overall,
          fpSim,
          type: 'fingerprint'
        });
      }
      
      // 计算文本相似度（作为补充）
      const textSim = calculateTextSimilarity(title, existing);
      if (textSim >= this.thresholds.textSimilarity) {
        results.push({
          existing,
          similarity: textSim,
          type: 'text'
        });
      }
    }
    
    // 如果有多个匹配，取最高相似度
    if (results.length > 0) {
      results.sort((a, b) => b.similarity - a.similarity);
      const best = results[0];
      
      const result = new DeduplicationResult(true, best.type === 'fingerprint' ? '语义指纹匹配' : '文本高度相似', best.similarity, {
        matchedWith: best.existing,
        allMatches: results.slice(0, 3),
        currentFP
      });
      this.logDecision(title, best.existing, result);
      return result;
    }
    
    // 不是重复
    const result = new DeduplicationResult(false, '未检测到重复', 1, { currentFP });
    return result;
  }
  
  /**
   * 批量去重 - 返回去重后的列表
   */
  deduplicate(newsList) {
    const unique = [];
    const duplicates = [];
    const titles = [];
    
    for (const news of newsList) {
      const check = this.checkDuplicate(news.title, titles);
      
      if (check.isDuplicate) {
        duplicates.push({ ...news, dedupResult: check });
      } else {
        unique.push(news);
        titles.push(news.title);
      }
    }
    
    return {
      unique,
      duplicates,
      stats: {
        total: newsList.length,
        unique: unique.length,
        duplicates: duplicates.length,
        dedupRate: ((duplicates.length / newsList.length) * 100).toFixed(1) + '%'
      }
    };
  }
  
  /**
   * 记录去重决策
   */
  logDecision(title, matchedWith, result) {
    this.history.push({
      title: title.slice(0, 100),
      matchedWith: matchedWith.slice(0, 100),
      isDuplicate: result.isDuplicate,
      reason: result.reason,
      confidence: result.confidence,
      timestamp: result.timestamp
    });
    
    // 只保留最近1000条日志
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
    }
  }
  
  /**
   * 获取去重统计报告
   */
  getReport() {
    const total = this.history.length;
    const duplicates = this.history.filter(h => h.isDuplicate).length;
    const reasons = {};
    
    for (const h of this.history) {
      reasons[h.reason] = (reasons[h.reason] || 0) + 1;
    }
    
    return {
      totalChecks: total,
      duplicatesFound: duplicates,
      dedupRate: total > 0 ? ((duplicates / total) * 100).toFixed(1) + '%' : '0%',
      reasonBreakdown: reasons,
      recentDecisions: this.history.slice(-20)
    };
  }
  
  /**
   * 导出详细日志
   */
  exportLogs() {
    return JSON.stringify(this.history, null, 2);
  }
}

/**
 * 便捷函数：快速检查单个标题
 */
export function checkDuplicate(title, existingTitles, options = {}) {
  const engine = new DeduplicationEngine(options);
  return engine.checkDuplicate(title, existingTitles);
}

/**
 * 便捷函数：批量去重
 */
export function deduplicateNews(newsList, options = {}) {
  const engine = new DeduplicationEngine(options);
  return engine.deduplicate(newsList);
}

// 测试用例（用于验证去重逻辑）
export const TEST_CASES = {
  // 应该判定为重复的案例
  shouldBeDuplicate: [
    {
      title1: 'OpenClaw创始人加入OpenAI',
      title2: 'OpenAI聘请OpenClaw联合创始人',
      reason: '实体和动作匹配'
    },
    {
      title1: 'Anthropic发布Claude 3.5 Sonnet',
      title2: 'Claude 3.5 Sonnet正式发布，Anthropic推出最强模型',
      reason: '产品+公司匹配'
    },
    {
      title1: 'Google以25亿美元收购Character.AI',
      title2: 'Character.AI被Google收购，金额达25亿美元',
      reason: '收购事件匹配'
    },
    {
      title1: 'Meta发布Llama 3.1开源模型',
      title2: 'Llama 3.1开源发布，Meta提供405B参数版本',
      reason: '产品发布匹配'
    },
    {
      title1: 'Sam Altman被OpenAI董事会解雇',
      title2: 'OpenAI CEO Sam Altman突遭罢免',
      reason: '人名+动作匹配'
    }
  ],
  
  // 不应该判定为重复的案例
  shouldNotBeDuplicate: [
    {
      title1: 'OpenAI发布GPT-5',
      title2: 'Google发布Gemini 2.0',
      reason: '不同公司不同产品'
    },
    {
      title1: '字节跳动收购游戏公司',
      title2: '字节跳动发布新AI模型',
      reason: '同一公司不同事件'
    },
    {
      title1: 'Anthropic完成4亿美元融资',
      title2: 'Anthropic发布新安全研究',
      reason: '同一公司不同事件'
    }
  ]
};
