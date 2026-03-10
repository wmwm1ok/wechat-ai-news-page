import { isComparisonArticle, isSpecificEnoughSummary } from '../src/ai-summarizer.js';

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
});

console.log('🧪 Running AISummarizer Helper Tests...\n');
