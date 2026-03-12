# 百度云部署方案 C：CFC 定时生成 + BOS 托管静态页

这套方案是给你现在这个项目单独准备的，不会替换现有 GitHub Pages / GitHub Actions。

目标架构：

- `CFC`：每天定时运行一次，抓取新闻、调用 DeepSeek、生成 JSON/HTML
- `BOS`：保存 `index.html`、`latest.json` 和 `output/*`
- `自定义域名`：最终像 GitHub Pages 一样直接在浏览器里访问

## 这套方案适合你什么情况

- 你想避免 GitHub `schedule` 偶发延迟
- 你每天只跑 1 次，成本希望尽量低
- 你愿意保留 GitHub 那套，同时单独多一套百度云版本

## 先决条件

1. 你已经有一个 BOS bucket
   - 你当前的是 `wechat-ai-news-01`
2. 你已经买了一个域名
   - 你当前在审核中的域名是 `wmainews.cn`
3. 你已经准备好这些环境变量

```env
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
SERPER_API_KEY=可选
BOS_BUCKET=wechat-ai-news-01
BOS_ENDPOINT=https://bj.bcebos.com
BCE_ACCESS_KEY_ID=你的百度云 AK
BCE_SECRET_ACCESS_KEY=你的百度云 SK
TARGET_NEWS_COUNT=14
```

`build:cfc` 会把这些变量写进部署包里的 `runtime-config.json`，这样你不需要在当前这版控制台里单独找环境变量入口。

当前 CFC 部署默认会启用快速模式，目的是把完整流程压进 CFC 的 `300 秒` 限制内：

- 减少 Serper 查询数量
- 压缩国内/海外待总结条数
- 优先批量总结，减少逐条抓全文
- 只对最终入选的一部分新闻做全文精修，兼顾质量和时长

## 本地先生成 CFC 部署包

在仓库根目录运行：

```bash
npm run build:cfc
```

成功后会生成：

```text
baidu-cloud/dist/wechat-cfc.zip
```

## CFC 控制台创建方式

建议这样选：

- 地域：`华北-北京`
- 函数运行时：`Node.js 22`
- 创建方式：`上传 ZIP`
- ZIP 文件：`baidu-cloud/dist/wechat-cfc.zip`
- 入口文件：`index.js`
- Handler：`handler`
- 内存：`1024 MB`
- 超时时间：`300 秒`

## 需要填写的环境变量

在函数配置里逐个填入：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_API_URL`
- `DEEPSEEK_MODEL`
- `SERPER_API_KEY`
- `BOS_BUCKET`
- `BOS_ENDPOINT`
- `BCE_ACCESS_KEY_ID`
- `BCE_SECRET_ACCESS_KEY`
- `TARGET_NEWS_COUNT`

## 定时触发器

建议建立一个每天北京时间 `08:15` 的定时触发器。

如果控制台要求用 cron 表达式，填：

```text
15 8 * * *
```

如果控制台按 UTC 解释，则改成：

```text
15 0 * * *
```

创建完成后，先手动测试运行一次，确认：

- `latest.json` 上传到了 bucket 根目录
- `output/latest.json` 上传成功
- `output/news-YYYY-MM-DD.json` 上传成功

## BOS 侧还要做什么

1. 开启静态网站托管
   - 索引文件：`index.html`
2. 后续等域名审核和备案完成后
   - 绑定自定义域名
   - 用自定义域名访问页面

## 重要提醒

- CFC 里的代码包文件系统不是长期持久化的，所以这套实现会在每次运行时：
  - 先从 BOS 拉昨天的 `news-YYYY-MM-DD.json`
  - 再做跨天去重
  - 最后把当天产物重新上传到 BOS
- 这正是为什么它比 GitHub 定时更准，但实现也比 GitHub Actions 更复杂

## 如果你正在控制台里一步一步配置

你接下来最需要看的字段就是这几个：

- 创建函数
- 运行时
- ZIP 上传
- 入口文件
- Handler
- 环境变量
- 定时触发器

只要你到了创建函数那一页，发截图给我，我就继续带你逐项填。
