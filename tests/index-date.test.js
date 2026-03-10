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
    const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf-8');
    expect(source).toInclude("timeZone: 'Asia/Shanghai'");
    expect(source).toInclude('generatedAt');
  });
});

console.log('🧪 Running Index Date Tests...\n');
