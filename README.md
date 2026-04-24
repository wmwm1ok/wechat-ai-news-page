# AI资讯每日精选 - 微信公众号助手发布页

从多个信息源抓取 AI 新闻，使用 DeepSeek 做摘要与分类，生成适合粘贴到微信公众号助手的日报内容页。

## 当前产品边界

- 自动抓取和筛选 AI 新闻
- 自动生成摘要、分类和 JSON 数据
- 自动生成适合微信公众号排版的 HTML
- 通过 GitHub Pages 提供一个可直接复制、可手动微调的网页
- 不直接调用微信公众号发布接口，最终发布动作仍在手机端或公众号助手中完成
- 仅保留 `daily` 日报，不再区分早报/午后版

## 项目结构

```text
ai-news-wechat-publisher/
├── .github/workflows/
│   └── daily-news.yml        # 定时抓取与生成
├── src/
│   ├── index.js              # 入口
│   ├── daily-news-runner.js  # 主流程：抓取 -> 总结 -> 评分 -> 输出
│   ├── config.js             # RSS 源、关键词、阈值配置
│   ├── rss-fetcher.js        # RSS / Serper 抓取
│   ├── ai-summarizer.js      # DeepSeek 摘要与净化
│   ├── news-scorer.js        # 去重与质量评分
│   ├── category-classifier.js
│   ├── date-utils.js
│   └── html-formatter.js     # HTML 模板生成
├── output/                   # 历史 JSON/HTML 产物
├── index.html                # 在线编辑与复制页面
├── latest.json               # 页面默认读取的数据文件
├── cloudflare-worker/        # 可选的微信 API 代理实验代码
└── tests/
```

## 运行方式

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

至少需要：

- `DEEPSEEK_API_KEY`

可选：

- `DEEPSEEK_API_URL`
- `DEEPSEEK_MODEL`
- `SERPER_API_KEY`
- `NEWS_FRESHNESS_HOURS`：新闻新鲜度窗口，默认 `18`，用于优先抓取小时级新发布内容

### 3. 本地生成内容

```bash
npm start
```

生成后会输出：

- `output/news-YYYY-MM-DD.json`
- `output/latest.json`
- `output/newsletter-YYYY-MM-DD.html`
- `output/wechat-YYYY-MM-DD.html`
- 根目录 `latest.json`

### 4. 本地查看和复制

打开根目录 [index.html](./index.html)。

页面会读取 `latest.json`，并提供：

- 微信公众号风格预览
- 可直接微调的编辑区
- 富文本复制到剪贴板
- 原文链接面板（便于校对与补充）

## GitHub Actions

### `AI Daily News`

工作流文件：[.github/workflows/daily-news.yml](./.github/workflows/daily-news.yml)

作用：

- 每天北京时间 08:00 自动运行（并在 08:10/08:20/08:30 做兜底触发）
- 执行 `npm start`
- 上传 `output/` 产物
- 提交最新 JSON 回仓库，供次日去重和页面读取

## 关键配置

### RSS 源和关键词

查看 [src/config.js](./src/config.js)。

你可以在这里调整：

- 国内/海外 RSS 源
- AI 关键词
- 栏目顺序
- 质量阈值

### 质量筛选

查看 [src/news-scorer.js](./src/news-scorer.js)。

当前逻辑会：

- 用语义规则做去重
- 合并同一事件的多源报道，并把多源覆盖作为热度信号
- 用来源、时效性、热度、实质性、重要性打分
- 过滤掉低于 `QUALITY_THRESHOLD` 的新闻
- 优先保持分类结构均衡，并在候选不足时做有限补位

### HTML 模板

查看 [src/html-formatter.js](./src/html-formatter.js)。

模板按公众号粘贴场景做了约束，尽量使用：

- 行内样式
- 段落、标题、边框分割
- 尽量简单的结构，减少粘贴兼容问题

## 测试

```bash
npm test
```

当前覆盖：

- 抓取过滤
- 摘要净化
- 去重与评分
- 分类
- 主流程关键逻辑

## 发布流程建议

1. GitHub Actions 定时生成日报
2. GitHub Pages 自动更新网页
3. 手机打开页面，按需微调文案
4. 点击复制
5. 粘贴到公众号助手发布

## 备注

- `cloudflare-worker/` 为可选实验代码，不属于当前主流程
- `mobile-preview.html` 为历史页面，主入口以根目录 `index.html` 为准
