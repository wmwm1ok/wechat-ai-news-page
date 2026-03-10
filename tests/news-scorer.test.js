import { selectTopNews } from '../src/news-scorer.js';

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
});

console.log('🧪 Running NewsScorer Tests...\n');
