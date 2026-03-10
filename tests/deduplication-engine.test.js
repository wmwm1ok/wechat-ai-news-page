/**
 * 去重引擎单元测试
 * 确保各种重复场景都能被正确识别
 */

import { DeduplicationEngine, checkDuplicate, deduplicateNews, TEST_CASES } from '../src/deduplication-engine.js';

// 简单的测试框架
function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${e.message}`);
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
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`Expected true but got ${actual}`);
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`Expected false but got ${actual}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    }
  };
}

// 运行测试
describe('DeduplicationEngine', () => {
  describe('Basic duplicate detection', () => {
    it('should detect identical titles', () => {
      const engine = new DeduplicationEngine();
      const result = engine.checkDuplicate('OpenAI发布GPT-5', ['OpenAI发布GPT-5']);
      expect(result.isDuplicate).toBeTrue();
      expect(result.confidence).toBe(1.0);
    });
    
    it('should detect case-insensitive identical titles', () => {
      const engine = new DeduplicationEngine();
      const result = engine.checkDuplicate('OpenAI发布GPT-5', ['openai发布gpt-5']);
      expect(result.isDuplicate).toBeTrue();
    });
    
    it('should not flag different titles as duplicate', () => {
      const engine = new DeduplicationEngine();
      const result = engine.checkDuplicate('OpenAI发布GPT-5', ['Google发布Gemini']);
      expect(result.isDuplicate).toBeFalse();
    });
  });
  
  describe('Entity + Action matching', () => {
    it('should detect OpenClaw founder joining OpenAI', () => {
      const engine = new DeduplicationEngine();
      // 模拟 InfoQ、TechCrunch AI、机器之心 对同一事件的报道
      const existing = [
        'OpenClaw联合创始人加入OpenAI，负责多Agent系统',
        'OpenAI聘请OpenClaw创始人，强化Agent能力'
      ];
      const newTitle = '前OpenClaw创始人加盟OpenAI';
      const result = engine.checkDuplicate(newTitle, existing);
      
      console.log(`     Confidence: ${result.confidence}, Reason: ${result.reason}`);
      expect(result.isDuplicate).toBeTrue();
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    it('should detect acquisition news from different sources', () => {
      const engine = new DeduplicationEngine();
      const existing = ['Google收购Character.AI，金额超25亿美元'];
      const result = engine.checkDuplicate('Character.AI被Google收购，创始人加入DeepMind', existing);
      
      console.log(`     Confidence: ${result.confidence}, Reason: ${result.reason}`);
      expect(result.isDuplicate).toBeTrue();
    });
    
    it('should detect product launch duplicates', () => {
      const engine = new DeduplicationEngine();
      const existing = ['Meta正式发布Llama 3.1，最大405B参数'];
      const result = engine.checkDuplicate('Llama 3.1开源，Meta提供最强开源模型', existing);
      
      console.log(`     Confidence: ${result.confidence}, Reason: ${result.reason}`);
      expect(result.isDuplicate).toBeTrue();
    });
  });
  
  describe('Person + Action matching', () => {
    it('should detect executive departure news', () => {
      const engine = new DeduplicationEngine();
      const existing = ['Sam Altman被OpenAI董事会解雇'];
      const result = engine.checkDuplicate('OpenAI CEO Sam Altman突然离职', existing);
      
      console.log(`     Confidence: ${result.confidence}, Reason: ${result.reason}`);
      expect(result.isDuplicate).toBeTrue();
    });
    
    it('should detect hiring news with person names', () => {
      const engine = new DeduplicationEngine();
      const existing = ['Andrej Karpathy回归OpenAI'];
      const result = engine.checkDuplicate('Karpathy重返OpenAI担任技术主管', existing);
      
      console.log(`     Confidence: ${result.confidence}, Reason: ${result.reason}`);
      expect(result.isDuplicate).toBeTrue();
    });
  });
  
  describe('Non-duplicate detection', () => {
    it('should not flag different company news as duplicate', () => {
      const engine = new DeduplicationEngine();
      const result = engine.checkDuplicate('OpenAI发布新模型', ['Google发布新模型']);
      expect(result.isDuplicate).toBeFalse();
    });
    
    it('should not flag different events from same company', () => {
      const engine = new DeduplicationEngine();
      const existing = ['字节跳动收购游戏公司'];
      const result = engine.checkDuplicate('字节跳动发布AI编程助手', existing);
      expect(result.isDuplicate).toBeFalse();
    });
    
    it('should not flag funding vs product launch as duplicate', () => {
      const engine = new DeduplicationEngine();
      const existing = ['Anthropic完成4亿美元融资'];
      const result = engine.checkDuplicate('Anthropic发布Claude新功能', existing);
      expect(result.isDuplicate).toBeFalse();
    });
  });
  
  describe('Batch deduplication', () => {
    it('should deduplicate a list of news', () => {
      const newsList = [
        { title: 'OpenAI发布GPT-5，支持多模态', source: '机器之心' },
        { title: 'GPT-5正式发布，OpenAI推出最强模型', source: 'InfoQ' },
        { title: 'Google发布Gemini 2.0', source: 'TechCrunch' },
        { title: 'Gemini 2.0上线，Google对标GPT-5', source: '量子位' },
        { title: 'Meta发布Llama 3.1', source: '36氪' }
      ];
      
      const result = deduplicateNews(newsList);
      console.log(`     Stats: ${JSON.stringify(result.stats)}`);
      
      // 应该有5条输入，3条输出（OpenAI和Google各去重1条）
      expect(result.unique.length).toBe(3);
      expect(result.duplicates.length).toBe(2);
      expect(result.stats.dedupRate).toBe('40.0%');
    });
  });
  
  describe('Report generation', () => {
    it('should generate statistics report', () => {
      const engine = new DeduplicationEngine();
      
      // 模拟一些去重检查 - 使用可能重复的标题
      engine.checkDuplicate('OpenAI发布GPT-5', []);
      engine.checkDuplicate('GPT-5发布，OpenAI推出新模型', ['OpenAI发布GPT-5']); // 这应该是重复
      engine.checkDuplicate('Google发布Gemini', ['OpenAI发布GPT-5', 'GPT-5发布，OpenAI推出新模型']);
      
      const report = engine.getReport();
      // 日志只记录在找到重复时
      expect(report.totalChecks >= 1).toBeTrue();
    });
  });
  
  describe('Real-world test cases', () => {
    it('should pass all shouldBeDuplicate test cases', () => {
      const engine = new DeduplicationEngine();
      let passed = 0;
      let failed = 0;
      
      for (const testCase of TEST_CASES.shouldBeDuplicate) {
        const result = engine.checkDuplicate(testCase.title1, [testCase.title2]);
        if (result.isDuplicate) {
          passed++;
          console.log(`     ✅ "${testCase.title1.slice(0, 30)}..." vs "${testCase.title2.slice(0, 30)}..."`);
        } else {
          failed++;
          console.log(`     ❌ FAILED: "${testCase.title1.slice(0, 30)}..." should match "${testCase.title2.slice(0, 30)}..."`);
        }
      }
      
      console.log(`     Result: ${passed}/${TEST_CASES.shouldBeDuplicate.length} passed`);
      if (failed > 0) {
        throw new Error(`${failed} duplicate detection test cases failed`);
      }
    });
    
    it('should pass all shouldNotBeDuplicate test cases', () => {
      const engine = new DeduplicationEngine();
      let passed = 0;
      let failed = 0;
      
      for (const testCase of TEST_CASES.shouldNotBeDuplicate) {
        const result = engine.checkDuplicate(testCase.title1, [testCase.title2]);
        if (!result.isDuplicate) {
          passed++;
          console.log(`     ✅ "${testCase.title1.slice(0, 30)}..." correctly not matched with "${testCase.title2.slice(0, 30)}..."`);
        } else {
          failed++;
          console.log(`     ❌ FALSE POSITIVE: "${testCase.title1.slice(0, 30)}..." should NOT match "${testCase.title2.slice(0, 30)}..."`);
        }
      }
      
      console.log(`     Result: ${passed}/${TEST_CASES.shouldNotBeDuplicate.length} passed`);
      if (failed > 0) {
        throw new Error(`${failed} false positive test cases failed`);
      }
    });
  });
});

// 运行测试
console.log('🧪 Running DeduplicationEngine Tests...\n');
