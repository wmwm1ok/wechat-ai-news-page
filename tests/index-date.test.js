import { readFileSync } from 'fs';

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
});

console.log('🧪 Running Index Date Tests...\n');
