import { readFileSync } from 'fs';
import { getEditionMeta, getPreviousEditionInfo, inferNewsEdition } from '../src/date-utils.js';

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
      if (!String(actual).includes(expected)) {
        throw new Error(`Expected content to include ${expected}`);
      }
    }
  };
}

describe('Index date handling', () => {
  it('uses Asia/Shanghai timezone when formatting generated date', () => {
    const dateUtilsSource = readFileSync(new URL('../src/date-utils.js', import.meta.url), 'utf-8');
    const runnerSource = readFileSync(new URL('../src/daily-news-runner.js', import.meta.url), 'utf-8');
    expect(dateUtilsSource).toInclude("timeZone: 'Asia/Shanghai'");
    expect(runnerSource).toInclude('generatedAt');
  });

  it('defaults to a single daily edition', () => {
    expect(inferNewsEdition(new Date('2026-03-18T03:59:00Z'))).toBe('daily');
    expect(inferNewsEdition(new Date('2026-03-18T04:00:00Z'))).toBe('daily');
    expect(getEditionMeta('daily').label).toBe('每日精选');
    expect(getEditionMeta('daily').title).toBe('AI资讯每日精选');
  });

  it('only looks back one day for dedupe', () => {
    const previousDaily = getPreviousEditionInfo(new Date('2026-03-18T08:00:00Z'), 'daily');

    expect(previousDaily.edition).toBe('daily');
    expect(previousDaily.dateString).toBe('2026-03-17');
  });

  it('stores edition-specific history filenames in the runner', () => {
    const runnerSource = readFileSync(new URL('../src/daily-news-runner.js', import.meta.url), 'utf-8');
    const workflowSource = readFileSync(new URL('../.github/workflows/daily-news.yml', import.meta.url), 'utf-8');
    expect(runnerSource).toInclude("buildEditionOutputName('news', date, edition, 'json')");
    expect(runnerSource).toInclude('latest-${edition}.json');
    expect(runnerSource).toInclude('loadPreviousEditionNews');
    expect(workflowSource).toInclude('latest-*.json');
  });
});

console.log('🧪 Running Index Date Tests...\n');
