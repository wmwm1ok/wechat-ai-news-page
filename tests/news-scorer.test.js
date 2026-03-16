import { scoreNews, selectTopNews } from '../src/news-scorer.js';

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
    },
    toInclude(expected) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to include ${expected}`);
      }
    },
    notToInclude(expected) {
      if (Array.isArray(actual) && actual.includes(expected)) {
        throw new Error(`Expected array not to include ${expected}`);
      }
    }
  };
}

describe('News scorer', () => {
  it('filters out news below the quality threshold', () => {
    const selected = selectTopNews([
      {
        title: '行业综述：创业公司竞争格局再平衡',
        summary: '这是一篇泛泛而谈的综述，缺少明确事件、数据和落地动作。',
        source: '未知来源',
        publishedAt: '2026-03-01T00:00:00.000Z',
        region: '国内',
        url: 'https://example.com/low'
      },
      {
        title: 'OpenAI发布GPT-5并开放企业接入',
        summary: 'OpenAI 正式发布 GPT-5，并开放多模态能力与企业接入方案，包含明确产品动作和发布时间。',
        source: '机器之心',
        publishedAt: new Date().toISOString(),
        region: '国内',
        url: 'https://example.com/high'
      }
    ]);

    const titles = selected.map(item => item.title);
    expect(selected.length).toBe(1);
    expect(titles).toInclude('OpenAI发布GPT-5并开放企业接入');
    expect(titles).notToInclude('行业综述：创业公司竞争格局再平衡');
  });

  it('respects the requested target count', () => {
    const now = new Date().toISOString();
    const selected = selectTopNews([
      {
        title: 'OpenAI发布GPT-5企业版',
        summary: 'OpenAI 发布 GPT-5 企业版，提供多模态和推理增强。',
        source: '机器之心',
        publishedAt: now,
        region: '国内',
        url: 'https://example.com/1'
      },
      {
        title: 'Google发布Gemini 3研究更新',
        summary: 'Google 发布 Gemini 3 研究更新，包含模型能力提升和新 benchmark。',
        source: 'InfoQ',
        publishedAt: now,
        region: '海外',
        url: 'https://example.com/2'
      },
      {
        title: 'Anthropic发布Claude企业安全更新',
        summary: 'Anthropic 发布 Claude 企业安全更新，强调合规与管理能力。',
        source: 'MIT Technology Review',
        publishedAt: now,
        region: '海外',
        url: 'https://example.com/3'
      }
    ], 2);

    expect(selected.length).toBe(2);
  });

  it('does not hard-drop strong news with generic summaries during scoring', () => {
    const now = new Date().toISOString();
    const scoring = scoreNews({
      title: 'OpenAI发布企业搜索工具并开放知识库接入',
      summary: '文章介绍了 OpenAI 一项面向企业搜索的新工具更新，围绕知识库接入和使用体验展开。',
      source: 'InfoQ',
      publishedAt: now,
      region: '国内',
      url: 'https://example.com/relaxed'
    }, []);

    expect(scoring.isDuplicate).toBe(false);
    expect(scoring.score >= 0).toBe(true);
  });

  it('keeps category diversity when enough candidates exist', () => {
    const now = new Date().toISOString();
    const makeItem = (title, category, index) => ({
      title: `${title}-${index}`,
      summary: `${title} 的摘要包含明确产品动作、公司名称、发布时间和具体变化，适合作为日报展示内容。`,
      source: index % 2 === 0 ? '机器之心' : 'InfoQ',
      publishedAt: now,
      region: index % 2 === 0 ? '国内' : '海外',
      url: `https://example.com/${category}/${index}`,
      category
    });

    const selected = selectTopNews([
      makeItem('产品更新', '产品发布与更新', 1),
      makeItem('产品更新', '产品发布与更新', 2),
      makeItem('产品更新', '产品发布与更新', 3),
      makeItem('技术突破', '技术与研究', 4),
      makeItem('技术突破', '技术与研究', 5),
      makeItem('技术突破', '技术与研究', 6),
      makeItem('融资并购', '投融资与并购', 7),
      makeItem('融资并购', '投融资与并购', 8),
      makeItem('政策监管', '政策与监管', 9),
      makeItem('补充技术', '技术与研究', 10),
      makeItem('补充产品', '产品发布与更新', 11),
      makeItem('补充融资', '投融资与并购', 12)
    ], 10);

    const categoryCounts = selected.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    expect(categoryCounts['产品发布与更新'] >= 2).toBe(true);
    expect(categoryCounts['技术与研究'] >= 2).toBe(true);
    expect(categoryCounts['投融资与并购'] >= 1).toBe(true);
  });
});

console.log('🧪 Running NewsScorer Tests...\n');
