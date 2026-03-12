import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import sdk from '@baiducloud/sdk';

const { BosClient } = sdk;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function createBosClient() {
  return new BosClient({
    credentials: {
      ak: requireEnv('BCE_ACCESS_KEY_ID'),
      sk: requireEnv('BCE_SECRET_ACCESS_KEY')
    },
    endpoint: process.env.BOS_ENDPOINT || 'https://bj.bcebos.com'
  });
}

async function loadRuntimeConfig(rootDir) {
  const configPath = path.join(rootDir, 'baidu-cloud', 'cfc', 'runtime-config.json');

  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== null && value !== '') {
        process.env[key] = String(value);
      }
    }
    console.log('🔐 已加载 CFC 运行配置文件');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function safeGetPreviousDayFile(client, bucket, key, targetPath) {
  try {
    const response = await client.getObject(bucket, key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, response.body);
    console.log(`📥 已从 BOS 预载昨日数据: ${key}`);
  } catch {
    console.log(`ℹ️ BOS 中未找到昨日数据: ${key}`);
  }
}

async function uploadFile(client, bucket, localPath, remoteKey) {
  await client.putObjectFromFile(bucket, remoteKey, localPath);
  console.log(`☁️ 已上传到 BOS: ${remoteKey}`);
}

async function listOutputFiles(baseDir) {
  const outputDir = path.join(baseDir, 'output');
  const names = await fs.readdir(outputDir);
  return names.map(name => ({
    localPath: path.join(outputDir, name),
    remoteKey: `output/${name}`
  }));
}

export async function handler() {
  const rootDir = path.resolve(import.meta.dirname, '..', '..');
  await loadRuntimeConfig(rootDir);
  process.env.CFC_FAST_MODE = process.env.CFC_FAST_MODE || 'true';
  process.env.CFC_SERPER_QUERY_LIMIT = process.env.CFC_SERPER_QUERY_LIMIT || '8';
  process.env.CFC_SERPER_RESULT_LIMIT = process.env.CFC_SERPER_RESULT_LIMIT || '6';
  process.env.DOMESTIC_SUMMARY_LIMIT = process.env.DOMESTIC_SUMMARY_LIMIT || '8';
  process.env.OVERSEAS_SUMMARY_LIMIT = process.env.OVERSEAS_SUMMARY_LIMIT || '16';
  process.env.SUMMARY_BATCH_SIZE = process.env.SUMMARY_BATCH_SIZE || '8';
  process.env.SELECTED_REFINE_LIMIT = process.env.SELECTED_REFINE_LIMIT || '6';

  const [{ runDailyNews }, { getBeijingDateString }] = await Promise.all([
    import('../../src/daily-news-runner.js'),
    import('../../src/date-utils.js')
  ]);

  const bucket = requireEnv('BOS_BUCKET');
  const bosClient = createBosClient();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-ai-news-'));

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `output/news-${getBeijingDateString(yesterday)}.json`;

  await safeGetPreviousDayFile(
    bosClient,
    bucket,
    yesterdayKey,
    path.join(workDir, yesterdayKey)
  );

  const result = await runDailyNews({
    baseDir: workDir,
    targetCount: Number(process.env.TARGET_NEWS_COUNT || 14)
  });

  await uploadFile(bosClient, bucket, path.join(rootDir, 'index.html'), 'index.html');
  await uploadFile(bosClient, bucket, result.files.latestJsonPath, 'latest.json');

  const outputFiles = await listOutputFiles(workDir);
  for (const file of outputFiles) {
    await uploadFile(bosClient, bucket, file.localPath, file.remoteKey);
  }

  return {
    ok: true,
    date: result.date,
    generatedAt: result.generatedAt,
    totalNews: result.totalNews,
    uploaded: ['index.html', 'latest.json', ...outputFiles.map(file => file.remoteKey)]
  };
}
