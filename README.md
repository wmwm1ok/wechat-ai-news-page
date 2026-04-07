# AI资讯每日精选 - 微信公众号助手发布页

从多个信息源抓取 AI 新闻，使用 DeepSeek 做摘要与分类，生成一份适合粘贴到微信公众号助手的 HTML 内容页。

当前产品边界很明确：

- 自动抓取和筛选 AI 新闻
- 自动生成摘要、分类和 JSON 数据
- 自动生成适合微信公众号排版的 HTML
- 通过 GitHub Pages 提供一个可直接复制、可手动微调的网页
- 不直接调用微信公众号发布接口，最终发布动作仍在手机端或公众号助手中完成

## 项目结构

```text
ai-news-wechat-publisher/
├── .github/workflows/
│   ├── daily-news.yml        # 定时抓取与生成
│   └── pages.yml             # GitHub Pages 部署
├── src/
│   ├── index.js              # 主流程：抓取 -> 总结 -> 评分 -> 输出
│   ├── config.js             # RSS 源、关键词、阈值配置
│   ├── rss-fetcher.js        # RSS / Serper 抓取
│   ├── ai-summarizer.js      # DeepSeek 摘要与分类
│   ├── news-scorer.js        # 去重与质量评分
│   └── html-formatter.js     # HTML 模板生成
├── output/                   # 每次生成的历史数据与 HTML
├── index.html                # 在线复制/编辑页面
├── latest.json               # GitHub Pages 默认读取的数据文件
├── cloudflare-worker/        # 可选的微信 API 代理实验代码
└── tests/                    # 当前仅包含去重测试
```

## 运行方式

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

至少需要：

- `DEEPSEEK_API_KEY`

可选：

- `DEEPSEEK_API_URL`
- `DEEPSEEK_MODEL`
- `SERPER_API_KEY`

### 3. 本地生成内容

```bash
npm start
```

生成后会输出：

- `output/news-YYYY-MM-DD-daily.json`
- `output/latest.json`
- `output/newsletter-YYYY-MM-DD-daily.html`
- `output/wechat-YYYY-MM-DD-daily.html`
- 根目录 `latest.json`

### 4. 本地查看和复制

打开根目录的 [index.html](./index.html)。

页面会读取 `latest.json`，并提供：

- 微信公众号风格的预览
- 可直接微调的编辑区
- 富文本复制到剪贴板

## GitHub Actions

### `AI Daily News`

工作流文件：[.github/workflows/daily-news.yml](./.github/workflows/daily-news.yml)

作用：

- 每天北京时间 15:00 定时运行一次
- 执行 `npm start`
- 上传 `output/` 产物
- 提交最新 JSON 回仓库，供前一天去重和页面读取

### `Deploy static content to Pages`

工作流文件：[.github/workflows/pages.yml](./.github/workflows/pages.yml)

作用：

- 监听 `main` 分支更新
- 也可在 `AI Daily News` 完成后拉取 artifact
- 部署整个静态站点到 GitHub Pages

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
- 用来源、时效性、实质性、重要性打分
- 过滤掉低于 `QUALITY_THRESHOLD` 的新闻
- 默认优先维持国内/海外 1:1 的 14 条结果

### HTML 模板

查看 [src/html-formatter.js](./src/html-formatter.js)。

模板已经按微信公众号粘贴场景做过简化，尽量使用：

- 行内样式
- 段落、标题、边框分割
- 少阴影、少复杂布局

## 测试

```bash
npm test
```

当前测试覆盖：

- 去重引擎

还没有覆盖：

- RSS 抓取
- HTML 模板
- Pages 页面复制链路

## 发布流程建议

1. GitHub Actions 定时生成日报
2. GitHub Pages 自动更新网页
3. 手机打开页面，按需微调文案
4. 点击复制
5. 粘贴到公众号助手发布

## 备注

- `cloudflare-worker/` 里保留的是代理相关实验代码，不属于当前主流程
- `mobile-preview.html` 是历史页面，主入口以根目录 `index.html` 为准
