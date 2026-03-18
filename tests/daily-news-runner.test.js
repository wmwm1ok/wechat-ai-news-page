import { selectBalancedFinalNews } from '../src/daily-news-runner.js';

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
});

console.log('🧪 Running DailyNewsRunner Tests...\n');
