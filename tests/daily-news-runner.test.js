import { filterAgainstPreviousEdition, selectBalancedFinalNews } from '../src/daily-news-runner.js';

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
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected value to be truthy but got ${actual}`);
      }
    }
  };
}

describe('Daily news runner', () => {
  it('keeps product section candidates in the final balanced selection when available', () => {
    const makeItem = (title, category, index) => ({
      title: `${title}-${index}`,
      category,
      summary: `${title} 的摘要包含完整句子和具体信息点。`,
      source: index % 2 === 0 ? 'InfoQ' : '机器之心',
      url: `https://example.com/${category}/${index}`
    });

    const candidates = [
      makeItem('技术稿', '技术与研究', 1),
      makeItem('技术稿', '技术与研究', 2),
      makeItem('技术稿', '技术与研究', 3),
      makeItem('技术稿', '技术与研究', 4),
      makeItem('产品稿', '产品发布与更新', 5),
      makeItem('产品稿', '产品发布与更新', 6),
      makeItem('融资稿', '投融资与并购', 7),
      makeItem('政策稿', '政策与监管', 8)
    ];

    const selected = selectBalancedFinalNews(candidates, 6);
    const hasProduct = selected.some(item => item.category === '产品发布与更新');

    expect(selected.length).toBe(6);
    expect(hasProduct).toBeTruthy();
  });

  it('restores cross-day fallback candidates only when the final pool is short', () => {
    const previousNews = [
      {
        title: 'Google发布Gemini Live可视化更新',
        summary: 'Google 发布 Gemini Live 更新，支持摄像头输入和屏幕共享。',
        source: 'TechCrunch AI',
        url: 'https://example.com/gemini-live'
      }
    ];
    const items = [
      {
        title: 'Anthropic发布Claude金融行业模板',
        summary: 'Anthropic 发布金融行业模板，覆盖审批流、知识库接入和审计能力。',
        source: 'MIT Technology Review',
        url: 'https://example.com/claude-finance'
      },
      {
        title: '谷歌给Gemini Live补上视频理解能力',
        summary: '谷歌为 Gemini Live 增加摄像头输入和屏幕共享能力。',
        source: 'The Verge AI',
        url: 'https://example.com/gemini-live-2',
        selectionMode: 'crossDayFallback'
      },
      {
        title: 'Google发布Gemini代码助手更新',
        summary: 'Google 发布 Gemini 代码助手更新，补充仓库上下文与审计日志能力。',
        source: 'The Verge AI',
        url: 'https://example.com/gemini-code'
      }
    ];

    const restored = filterAgainstPreviousEdition(items, previousNews, 3);
    const strict = filterAgainstPreviousEdition(items, previousNews, 2);
    const restoredTitles = restored.kept.map(item => item.title);
    const strictTitles = strict.kept.map(item => item.title);

    expect(restored.kept.length).toBe(3);
    expect(restored.restored.length).toBe(1);
    expect(restoredTitles).toInclude('谷歌给Gemini Live补上视频理解能力');
    expect(strict.restored.length).toBe(0);
    expect(strictTitles).notToInclude('谷歌给Gemini Live补上视频理解能力');
  });

  it('keeps reusable previous-day candidates available for later replenishment', () => {
    const previousNews = [
      {
        title: 'Google发布Gemini Live可视化更新',
        summary: 'Google 发布 Gemini Live 更新，支持摄像头输入和屏幕共享。',
        source: 'TechCrunch AI',
        url: 'https://example.com/gemini-live'
      }
    ];
    const items = [
      {
        title: 'Anthropic发布Claude金融行业模板',
        summary: 'Anthropic 发布金融行业模板，覆盖审批流、知识库接入和审计能力。',
        source: 'MIT Technology Review',
        url: 'https://example.com/claude-finance'
      },
      {
        title: '谷歌给Gemini Live补上视频理解能力',
        summary: '谷歌为 Gemini Live 增加摄像头输入和屏幕共享能力。',
        source: 'The Verge AI',
        url: 'https://example.com/gemini-live-2',
        selectionMode: 'crossDayFallback'
      }
    ];

    const result = filterAgainstPreviousEdition(items, previousNews, 1);

    expect(result.kept.length).toBe(1);
    expect(result.reusableRemovedItems.length).toBe(1);
  });

  it('does not reuse exact previous-day URL duplicates', () => {
    const previousNews = [
      {
        title: '地瓜机器人完成1.5亿美元B2轮融资，B轮累计融资额达2.7亿美元',
        summary: '地瓜机器人宣布完成1.5亿美元B2轮融资。',
        source: '量子位',
        url: 'https://example.com/funding'
      }
    ];
    const items = [
      {
        title: '地瓜机器人完成1.5亿美元B2轮融资，B轮累计融资2.7亿美元',
        summary: '地瓜机器人宣布完成1.5亿美元B2轮融资，并披露与地平线合作推进具身智能平台。',
        source: 'InfoQ',
        url: 'https://example.com/funding',
        selectionMode: 'crossDayFallback'
      }
    ];

    const result = filterAgainstPreviousEdition(items, previousNews, 1);

    expect(result.kept.length).toBe(0);
    expect(result.restored.length).toBe(0);
    expect(result.reusableRemovedItems.length).toBe(0);
  });
});

console.log('🧪 Running DailyNewsRunner Tests...\n');
