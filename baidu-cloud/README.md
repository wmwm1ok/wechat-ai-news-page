# 百度云部署方案 B：BCC 生成 + BOS 托管静态页

这套目录是给百度智能云单独准备的，不会改动你现有的 GitHub Actions / GitHub Pages 逻辑。

目标架构：

- `BCC`：每天定时运行 `npm start`，抓取新闻并生成 `latest.json` / `output/*.json`
- `BOS`：托管静态页面和 JSON 数据，对外提供访问

官方参考：

- [云服务器 BCC](https://cloud.baidu.com/product/bcc)
- [对象存储 BOS](https://cloud.baidu.com/product/bos)
- [BOS 文档](https://cloud.baidu.com/doc/BOS/s/Aktidwdot)
- [BOS CLI 下载说明](https://cloud.baidu.com/doc/BOS/s/Ejwvyqobd)
- [函数计算 CFC](https://cloud.baidu.com/product/cfc.html)

如果你要走 `CFC + BOS` 这条更省机器成本的方案，请直接看：

- [CFC-README.md](/Users/wyattwong/Documents/wechat/baidu-cloud/CFC-README.md)

## 目录说明

```text
baidu-cloud/
├── README.md
├── config/
│   ├── ai-news.cron
│   └── bos.env.example
├── nginx/
│   └── wechat-ai-news.conf
└── scripts/
    ├── setup_bcc.sh
    ├── deploy_app_to_bcc.sh
    ├── run_daily_job.sh
    └── sync_to_bos.sh
```

## 你会得到什么

1. 一台 BCC 服务器负责定时生成日报
2. 一个 BOS bucket 负责对外展示静态页面
3. BCC 在每天北京时间 `08:15` 自动跑
4. 生成后的 `index.html`、`latest.json`、`output/*.json` 自动同步到 BOS

## 推荐资源

### BCC

- 系统：Ubuntu 22.04 LTS
- 规格：2 vCPU / 4 GB RAM 起步
- 磁盘：40 GB SSD
- 网络：公网 IP

### BOS

- 新建一个 bucket，例如 `wechat-ai-news`
- 开启静态网站托管
- 建议绑定 CDN 或自定义域名

## 部署步骤

### 1. 准备 BCC 机器

在本地执行：

```bash
cd baidu-cloud/scripts
./deploy_app_to_bcc.sh your_user@your_bcc_ip
```

这个脚本会把当前仓库同步到远端 `/opt/wechat-ai-news`。

### 2. 登录 BCC，安装运行环境

```bash
ssh your_user@your_bcc_ip
cd /opt/wechat-ai-news/baidu-cloud/scripts
sudo bash setup_bcc.sh
```

### 3. 配置应用环境变量

在 BCC 上创建：

```bash
sudo mkdir -p /opt/wechat-ai-news/shared
sudo cp /opt/wechat-ai-news/.env.example /opt/wechat-ai-news/shared/.env
sudo nano /opt/wechat-ai-news/shared/.env
```

至少填写：

```env
DEEPSEEK_API_KEY=your_key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
SERPER_API_KEY=
```

### 4. 配置 BOS 同步凭证

```bash
sudo cp /opt/wechat-ai-news/baidu-cloud/config/bos.env.example /opt/wechat-ai-news/shared/bos.env
sudo nano /opt/wechat-ai-news/shared/bos.env
```

填写：

```env
BOS_BUCKET=your-bucket-name
BOS_ENDPOINT=bj.bcebos.com
BCE_ACCESS_KEY_ID=your_ak
BCE_SECRET_ACCESS_KEY=your_sk
```

如果你先只想验证生成成功，可以先不填 BOS 这部分。

### 5. 先手动跑一次

```bash
sudo /opt/wechat-ai-news/baidu-cloud/scripts/run_daily_job.sh
```

成功后会看到：

- `/opt/wechat-ai-news/current/latest.json`
- `/opt/wechat-ai-news/current/output/latest.json`

如果配置了 BOS，还会同步到 bucket。

### 6. 加定时任务

安装 cron：

```bash
sudo crontab /opt/wechat-ai-news/current/baidu-cloud/config/ai-news.cron
sudo crontab -l
```

当前默认是每天北京时间 `08:15`。

## BOS 同步内容

脚本会同步这些文件：

- `index.html`
- `latest.json`
- `output/`
- 可选的 `docs/`

同步命令基于 BOS 官方 CLI 工具 `bcecmd` 的 `bos sync` 能力。

注意：

- `bcecmd` 需要按百度云官方文档单独安装
- 建议在 BCC 机器上先手动执行一次 `bcecmd bos ls` 验证凭证和 endpoint

## Nginx 是否必须

不是必须。

如果你已经用 BOS 静态托管对外提供页面，BCC 只负责生成任务即可，不需要 Nginx。

本目录里的 `nginx/wechat-ai-news.conf` 只是给你一个备用方案：

- 在 BCC 上直接预览静态站
- 或作为内网调试页

## 不会影响 GitHub 的部分

这套百度云部署不会改：

- GitHub Pages 页面
- GitHub Actions 定时任务
- 现有仓库结构和入口代码

它只是额外增加了一套独立部署资产。
