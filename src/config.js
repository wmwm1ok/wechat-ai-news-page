import dotenv from 'dotenv';
dotenv.config();

// AI 核心关键词（用于过滤）
export const AI_KEYWORDS_CORE = [
  'AI', '人工智能', '大模型', 'LLM', 'AIGC', 'AGI',
  '机器学习', '深度学习', '神经网络', 'Transformer',
  'GPT', 'ChatGPT', 'OpenAI', 'Claude', 'Gemini', 'Sora',
  '智谱', '通义', '文心', 'Kimi', 'MiniMax', '百川', '讯飞星火', '混元', '豆包',
  'Agent', '智能体', 'Copilot', 'Grok', 'Perplexity', 'Mistral',
  '生成式', '多模态', '大语言模型', '自然语言处理', 'NLP',
  '自动驾驶', '具身智能', '机器人', '人形机器人',
  'AI芯片', 'GPU', 'NVIDIA', '英伟达', 'CUDA',
  'Stable Diffusion', 'Midjourney', 'Runway', 'DALL-E',
  'DeepMind', 'OpenAI', 'Anthropic', 'Meta AI', 'Google AI',
  'LangChain', 'Hugging Face', '向量数据库', 'RAG',
  'AI安全', 'AI对齐', '提示工程', 'Prompt'
];

// 国内 RSS 源
export const DOMESTIC_RSS_SOURCES = [
  {
    name: '机器之心',
    url: 'https://www.jiqizhixin.com/api/article_library/articles.json',
    limit: 6
  },
  {
    name: '量子位',
    url: 'https://www.qbitai.com/feed',
    limit: 6
  },
  {
    name: '36氪',
    url: 'https://36kr.com/feed',
    limit: 5
  },
  {
    name: 'InfoQ',
    url: 'https://www.infoq.cn/feed',
    limit: 5
  },
  {
    name: '雷锋网',
    url: 'https://www.leiphone.com/feed',
    limit: 8
  }
];

// 海外 RSS 源（精选高质）
// 注：海外源稳定性会有波动，因此同时保留 RSS 多源和 Serper 补充
export const OVERSEAS_RSS_SOURCES = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    limit: 10
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    limit: 8
  },
  {
    name: 'Ars Technica',
    url: 'https://arstechnica.com/tag/artificial-intelligence/feed/',
    limit: 8
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    limit: 6
  },
  {
    name: 'Wired AI',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss',
    limit: 6
  },
  {
    name: 'Tech Xplore',
    url: 'https://techxplore.com/rss-feed/breaking/machine-learning-ai-news/',
    limit: 6
  }
];

// 分类配置
export const SECTION_ORDER = [
  '产品发布与更新',
  '技术与研究',
  '投融资与并购',
  '政策与监管'
];

export const SECTION_ICON = {
  '产品发布与更新': '🚀',
  '技术与研究': '🧠',
  '投融资与并购': '💰',
  '政策与监管': '🏛️'
};

// API 配置
export const CONFIG = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  },
  serper: {
    apiKey: process.env.SERPER_API_KEY
  },
  debug: process.env.DEBUG === 'true'
};

// 质量阈值
export const QUALITY_THRESHOLD = 20; // 最低可接受分数
