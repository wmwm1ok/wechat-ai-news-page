import { detectArticleMode, isComparisonArticle, isSpecificEnoughSummary } from '../src/ai-summarizer.js';

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

describe('AI summarizer helpers', () => {
  it('detects comparison style articles', () => {
    const result = isComparisonArticle({
      title: 'Seedance 2.0、Sora 2与Runway Gen-4：面向开发者的AI视频API对比',
      snippet: '文章对 API 架构、延迟基准测试和定价做了横向比较。'
    });

    expect(result).toBe(true);
  });

  it('rejects vague summaries for comparison articles', () => {
    const result = isSpecificEnoughSummary(
      '文章对 Seedance 2.0、Sora 和 Runway Gen-4 进行了深入对比，内容涵盖 API 架构、延迟和定价等方面。',
      '原文比较了三个模型的 API、延迟和定价。',
      { comparisonMode: true }
    );

    expect(result).toBe(false);
  });

  it('accepts concrete summaries for comparison articles', () => {
    const result = isSpecificEnoughSummary(
      '原文将 Seedance 2.0、Sora 2 和 Runway Gen-4 放在同一组 API 测试中比较，重点看延迟、定价和开发者集成。文章明确提到 Runway 的接口更成熟，Seedance 在价格上更激进，而 Sora 2 的结论部分并未给出绝对优势判断。',
      '原文比较了三个模型的 API、延迟、定价和开发者集成。',
      { comparisonMode: true }
    );

    expect(result).toBe(true);
  });

  it('detects roundup style articles', () => {
    const result = detectArticleMode({
      title: '《下载》简报：Pokemon Go训练世界模型，以及中美寻找外星人竞赛',
      snippet: '本期《下载》简报讨论了 Pokemon Go、世界模型和外星生命搜索。'
    });

    expect(result).toBe('roundup');
  });

  it('detects story style articles', () => {
    const result = detectArticleMode({
      title: 'OpenClaw：创业者利用中国OpenClaw AI热潮获利',
      snippet: '一位开发者用 OpenClaw 做副业并接管设备自动完成任务。'
    });

    expect(result).toBe('story');
  });

  it('rejects vague roundup summaries', () => {
    const result = isSpecificEnoughSummary(
      '本期《下载》简报介绍了 Pokemon Go 和寻找外星生命等话题，内容围绕相关技术展开。',
      '简报涉及 Pokemon Go 世界模型、中美寻找外星生命竞赛以及相关研究。',
      { articleMode: 'roundup' }
    );

    expect(result).toBe(false);
  });

  it('rejects vague story summaries', () => {
    const result = isSpecificEnoughSummary(
      '文章讲述了一位创业者如何借助 OpenClaw 热潮创业的故事。',
      '原文提到 OpenClaw 是可接管设备并自动完成任务的开源 AI 工具，主角靠它承接自动化项目。',
      { articleMode: 'story' }
    );

    expect(result).toBe(false);
  });

  it('accepts concrete roundup summaries', () => {
    const result = isSpecificEnoughSummary(
      '这期《下载》简报列了三个重点：Pokemon Go 如何为送货机器人提供世界模型训练素材，中美团队如何用不同方法搜索外星生命，以及相关研究为什么重新带动了世界模型讨论。',
      '简报涉及 Pokemon Go 世界模型、中美寻找外星生命竞赛以及相关研究。',
      { articleMode: 'roundup' }
    );

    expect(result).toBe(true);
  });
});

console.log('🧪 Running AISummarizer Helper Tests...\n');
