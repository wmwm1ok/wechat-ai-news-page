import { isNewsLikeItem } from '../src/rss-fetcher.js';

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
});

console.log('🧪 Running RSSFetcher Tests...\n');
