#!/usr/bin/env node

import { runDailyNews } from './daily-news-runner.js';

runDailyNews().catch(error => {
  console.error('\n❌ 错误:', error.message);
  process.exit(1);
});
