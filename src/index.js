#!/usr/bin/env node

import { runDailyNews } from './daily-news-runner.js';

runDailyNews()
  .then(() => {
    // GitHub Actions 上偶尔会因为 HTTP socket 未及时释放而挂起；CLI 完成后应明确结束。
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  });
