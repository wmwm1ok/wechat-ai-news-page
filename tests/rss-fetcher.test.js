import {
  deduplicateNews,
  getNewsAgeHours,
  isFreshNews,
  isNewsLikeItem,
  isSourceQualifiedNewsItem,
  normalizeJiqizhixinArticle,
  parsePublishedAt
} from '../src/rss-fetcher.js';

function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    process.exitCode = 1;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    }
  };
}

describe('RSS fetcher filters', () => {
  it('rejects video pages from news candidates', () => {
    const result = isNewsLikeItem({
      title: 'InfoQ视频：OpenClaw 创始人谈 AI Agent',
      url: 'https://www.infoq.cn/video/C1OyeNDJ2OtLtoCTdoV5'
    });

    expect(result).toBe(false);
  });

  it('keeps regular article pages', () => {
    const result = isNewsLikeItem({
      title: '百度发布全球首款手机龙虾应用',
      url: 'https://www.infoq.cn/article/abcd1234'
    });

    expect(result).toBe(true);
  });

  it('rejects 36kr roundup-style multi-topic briefs', () => {
    const result = isSourceQualifiedNewsItem({
      title: '全国首个万卡级自主可控智算集群点亮，泡泡玛特乐园门票将涨价，蚂蚁发现OpenClaw高危漏洞',
      snippet: '大公司：全国首个万卡级全栈自主可控智算集群点亮。新产品：爱奇艺发布专业影视制作智能体。投融资：“灵猴机器人”宣布完成数亿元B轮融资。'
    }, '36氪');

    expect(result).toBe(false);
  });

  it('keeps regular single-topic 36kr articles', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'EnerVenue完成3亿美元B轮追加融资，将升级常州吉瓦级生产线',
      snippet: '36氪独家获悉，新型镍氢气电池技术公司 EnerVenue 已完成 3 亿美元 B 轮优先股追加融资，本轮资金将用于常州工厂产能升级与扩充。'
    }, '36氪');

    expect(result).toBe(true);
  });

  it('rejects MIT Technology Review download roundups', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'The Download: brainless human clones, and a uterus kept alive outside the body',
      snippet: 'This is today’s edition of The Download, our weekday newsletter that provides a daily dose of what is going on in the world of technology.'
    }, 'MIT Technology Review');

    expect(result).toBe(false);
  });

  it('rejects InfoQ multi-topic weekly AI roundups', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'AI周报：Token成职场内卷新指标，月之暗面或赴港IPO，谷歌推TurboQuant算法',
      snippet: '本周AI领域的重要进展包括：Token消耗成为企业评估AI效率的新指标，月之暗面或赴港IPO，谷歌推出TurboQuant算法。'
    }, 'InfoQ');

    expect(result).toBe(false);
  });

  it('rejects InfoQ multi-company daily roundup titles even without weekly markers', () => {
    const result = isSourceQualifiedNewsItem({
      title: '阿里发布Qwen3.5-Omni与Qwen3.6-Plus，微软商用自研AI模型，OpenAI完成大规模融资',
      snippet: 'InfoQ 编辑整理了当天值得关注的 AI 动态，涉及阿里、微软和 OpenAI 的多项进展。'
    }, 'InfoQ');

    expect(result).toBe(false);
  });

  it('rejects entertainment-style AI roundup stories from broad overseas feeds', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'All the latest in AI music',
      snippet: 'A roundup of artists, copyright fights, and creator reactions to AI music tools.',
      url: 'https://www.theverge.com/entertainment/903196/ai-music-roundup'
    }, 'The Verge AI');

    expect(result).toBe(false);
  });

  it('keeps concrete robotics research from broad overseas feeds', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'AI benchmark helps robots plan and complete their chores in the real world',
      snippet: 'Researchers built a benchmark for household robots and evaluated planning accuracy and task completion.',
      url: 'https://techxplore.com/news/2026-03-ai-benchmark-robots-chores.html'
    }, 'Tech Xplore');

    expect(result).toBe(true);
  });

  it('keeps concrete AI industry news from newly added broad feeds', () => {
    const result = isSourceQualifiedNewsItem({
      title: "Mystery solved: Anthropic reveals changes to Claude's harnesses and operating instructions likely caused degradation",
      snippet: 'Anthropic revealed system changes affecting Claude Code behavior after developer complaints.',
      url: 'https://venturebeat.com/ai/anthropic-claude-code-harnesses/'
    }, 'VentureBeat AI');

    expect(result).toBe(true);
  });

  it('rejects tutorial-style posts from developer feeds', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'How to Use Transformers.js in a Chrome Extension',
      snippet: 'A step-by-step tutorial for building browser extensions with Transformers.js.',
      url: 'https://huggingface.co/blog/transformersjs-chrome-extension'
    }, 'Hugging Face Blog');

    expect(result).toBe(false);
  });

  it('keeps high-signal AWS model platform updates', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'Amazon Bedrock launches new agent evaluation tools for enterprise AI teams',
      snippet: 'AWS announced Bedrock updates for foundation model deployment, inference, and agent workflows.',
      url: 'https://aws.amazon.com/blogs/machine-learning/bedrock-agent-evaluation/'
    }, 'AWS Machine Learning Blog');

    expect(result).toBe(true);
  });

  it('rejects low-signal AWS marketing posts', () => {
    const result = isSourceQualifiedNewsItem({
      title: 'Amazon Quick for marketing: From scattered data to strategic action',
      snippet: 'A marketing team case study about dashboards and campaign planning.',
      url: 'https://aws.amazon.com/blogs/machine-learning/amazon-quick-for-marketing/'
    }, 'AWS Machine Learning Blog');

    expect(result).toBe(false);
  });

  it('normalizes Jiqizhixin article library items into project news format', () => {
    const result = normalizeJiqizhixinArticle({
      title: '全球最强开源模型智谱GLM-5.1「Day0」上线华为云，可免费体验',
      slug: '2026-04-08-14',
      publishedAt: '2026/04/08 15:27',
      readCount: '12,000',
      content: '4 月 8 日，智谱正式发布新一代旗舰模型 GLM-5.1，发布当天已上线华为云。'
    }, { name: '机器之心' });

    expect(result.url).toBe('https://www.jiqizhixin.com/articles/2026-04-08-14');
    expect(result.publishedAt).toBe('2026-04-08T15:27:00+08:00');
    expect(result.source).toBe('机器之心');
    expect(result.popularityScore).toBe(4);
  });

  it('keeps only hour-level fresh news by default', () => {
    const oldValue = process.env.NEWS_FRESHNESS_HOURS;
    process.env.NEWS_FRESHNESS_HOURS = '18';
    const now = new Date('2026-04-24T08:00:00+08:00');

    expect(isFreshNews('2026-04-23T15:30:00+08:00', now)).toBe(true);
    expect(isFreshNews('2026-04-23T08:00:00+08:00', now)).toBe(false);
    expect(isFreshNews('', now)).toBe(false);

    if (oldValue === undefined) {
      delete process.env.NEWS_FRESHNESS_HOURS;
    } else {
      process.env.NEWS_FRESHNESS_HOURS = oldValue;
    }
  });

  it('parses relative published times from search results', () => {
    const now = new Date('2026-04-24T08:00:00+08:00');
    const parsed = parsePublishedAt('3 hours ago', now);

    expect(getNewsAgeHours(parsed.toISOString(), now)).toBe(3);
  });

  it('merges duplicate events and preserves coverage signals', () => {
    const result = deduplicateNews([
      {
        title: 'OpenAI releases GPT-5 enterprise agent platform',
        url: 'https://techcrunch.com/openai-gpt5-enterprise?utm_source=x',
        snippet: 'OpenAI released GPT-5 for enterprise agents.',
        source: 'TechCrunch AI',
        publishedAt: '2026-04-24T07:00:00+08:00'
      },
      {
        title: 'OpenAI launches GPT-5 enterprise agent platform',
        url: 'https://www.theverge.com/openai-gpt5-enterprise',
        snippet: 'OpenAI launched GPT-5 for enterprise agent workflows.',
        source: 'The Verge AI',
        publishedAt: '2026-04-24T07:20:00+08:00'
      },
      {
        title: 'Google updates Gemini Code Assist',
        url: 'https://example.com/gemini-code',
        snippet: 'Google updated Gemini Code Assist.',
        source: 'InfoQ',
        publishedAt: '2026-04-24T07:10:00+08:00'
      }
    ]);

    const openai = result.find(item => item.title.includes('OpenAI'));
    expect(result.length).toBe(2);
    expect(openai.coverageCount).toBe(2);
  });
});

console.log('🧪 Running RSSFetcher Tests...\n');
