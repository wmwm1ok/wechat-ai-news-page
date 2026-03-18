import { classifyNewsCategory } from '../src/category-classifier.js';

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

describe('Category classifier', () => {
  it('classifies model launches as product updates', () => {
    const category = classifyNewsCategory({
      title: 'OpenAI GPT-5.4 Mini和Nano：子代理功能详解',
      summary: 'OpenAI发布了GPT-5.4 Mini和Nano两款新模型，定位为子代理，用于构建更便宜、更快速的AI工作流。'
    });

    expect(category).toBe('产品发布与更新');
  });

  it('keeps business retrenchment stories out of product updates', () => {
    const category = classifyNewsCategory({
      title: 'OpenAI高管恐慌性削减项目，四面楚歌',
      summary: '面对亏损与竞争压力，OpenAI高管正削减项目并收缩战线，以聚焦核心业务。'
    });

    expect(category).toBe('技术与研究');
  });

  it('classifies defense and government constraint stories as policy', () => {
    const category = classifyNewsCategory({
      title: '报告称五角大楼正在开发Anthropic的替代方案',
      summary: '分歧核心在于Anthropic要求合同禁止其AI用于大规模监控或全自主武器，但五角大楼未予接受。'
    });

    expect(category).toBe('政策与监管');
  });

  it('classifies research frameworks as technology', () => {
    const category = classifyNewsCategory({
      title: '计算所与上交大提出MultiAnimate框架：仅用双人数据即可生成多人动画',
      summary: '研究团队提出MultiAnimate框架，通过新的训练方法将双人动作数据扩展到多人动画生成。'
    });

    expect(category).toBe('技术与研究');
  });
});

console.log('🧪 Running CategoryClassifier Tests...\n');
