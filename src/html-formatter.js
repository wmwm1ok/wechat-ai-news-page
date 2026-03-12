import { SECTION_ORDER, SECTION_ICON } from './config.js';

/**
 * HTML 转义
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 格式化日期（统一格式：M月D日）
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    // 处理各种日期格式
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // 尝试提取日期部分（如 "Sat, 14 Feb 2026..."）
      const match = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        const m = parseInt(match[2]);
        const d = parseInt(match[3]);
        return `${m}月${d}日`;
      }
      return '';
    }
    
    const m = date.getMonth() + 1;
    const day = date.getDate();
    return `${m}月${day}日`;
  } catch (e) {
    return '';
  }
}

/**
 * 渲染单条新闻卡片
 */
function renderNewsCard(item, index) {
  const meta = [item.source, formatDate(item.publishedAt)]
    .filter(Boolean)
    .join(' · ');
  const sourceLinkHtml = item.url
    ? `<div style="margin-top:12px;">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#f8fbff;border:1px solid #dbeafe;border-radius:999px;padding:7px 12px;font-size:12px;color:#1c5cff;text-decoration:none;font-weight:700;">
          查看原文
        </a>
      </div>`
    : '';
  
  const tagsHtml = Array.isArray(item.tags) && item.tags.length > 0
    ? `<div style="margin-top:10px;">
        ${item.tags.map(tag => `
          <span style="display:inline-block;background:#eef4ff;border:1px solid #dbe7ff;border-radius:999px;padding:3px 10px;margin:4px 6px 0 0;font-size:12px;color:#1c5cff;">
            ${escapeHtml(tag)}
          </span>
        `).join('')}
      </div>`
    : '';
  
  const companyHtml = item.company
    ? `<span style="color:#0f766e;font-weight:700;">${escapeHtml(item.company)}</span> · `
    : '';

  return `
    <section style="padding:16px 15px;border:1px solid #e5e7eb;border-left:4px solid #1c5cff;border-radius:10px;background:#fff;margin-bottom:14px;">
      <div style="font-size:16px;font-weight:800;margin-bottom:8px;color:#111;line-height:1.6;">
        ${index + 1}. ${companyHtml}${escapeHtml(item.title)}
      </div>
      ${meta ? `<div style="font-size:12px;color:#6b7280;margin-bottom:10px;">${escapeHtml(meta)}</div>` : ''}
      <div style="font-size:14px;color:#374151;line-height:1.85;text-align:justify;">
        ${escapeHtml(item.summary)}
      </div>
      ${sourceLinkHtml}
      ${tagsHtml}
    </section>
  `;
}

/**
 * 渲染分类区块
 */
function renderSection(sectionName, items) {
  if (!items || items.length === 0) return '';
  
  const icon = SECTION_ICON[sectionName] || '📍';
  
  return `
    <section style="margin:24px 0;">
      <div style="display:inline-block;font-size:17px;font-weight:900;color:#fff;background:#1c5cff;border-radius:999px;padding:7px 14px;margin-bottom:14px;">
        ${icon} ${escapeHtml(sectionName)} 
        <span style="color:rgba(255,255,255,0.88);font-weight:700;">（${items.length}）</span>
      </div>
      ${items.map((item, idx) => renderNewsCard(item, idx)).join('')}
    </section>
  `;
}

/**
 * 渲染整个内容区域
 */
function renderContent(groupedNews) {
  let html = '';
  
  // 按固定顺序渲染分类
  for (const section of SECTION_ORDER) {
    html += renderSection(section, groupedNews[section]);
  }
  
  // 渲染其他分类
  for (const [section, items] of Object.entries(groupedNews)) {
    if (SECTION_ORDER.includes(section)) continue;
    html += renderSection(section, items);
  }
  
  return html;
}

/**
 * 生成完整 HTML
 */
export function generateHTML(groupedNews, options = {}) {
  const date = formatDate(new Date());
  const title = options.title || `AI 每日快报（${date}）`;
  const subtitle = options.subtitle || '今日精选 AI 资讯';
  
  const content = renderContent(groupedNews);
  const coveredSections = SECTION_ORDER
    .filter(section => groupedNews[section]?.length > 0)
    .map(section => SECTION_ICON[section] + section)
    .join('、');
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;">
  <div style="max-width:760px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',Roboto,Arial;line-height:1.8;color:#111;padding:18px 16px 28px;background:#fff;">
    
    <!-- 标题区 -->
    <div style="text-align:center;padding:12px 0 22px;border-bottom:2px solid #1c5cff;margin-bottom:22px;">
      <div style="font-size:28px;font-weight:900;margin-bottom:8px;color:#1c5cff;line-height:1.35;">${escapeHtml(title)}</div>
      <div style="color:#6b7280;font-size:14px;">${escapeHtml(subtitle)}</div>
    </div>
    
    <!-- 导读 -->
    <div style="background:#f8fbff;border:1px solid #dbeafe;border-left:4px solid #1c5cff;border-radius:10px;padding:15px 16px;margin-bottom:22px;">
      <div style="font-size:14px;color:#475569;line-height:1.8;">
        📌 ${coveredSections ? `本期涵盖${coveredSections}等领域。` : '本期精选 AI 行业重点资讯。'}
      </div>
    </div>
    
    <!-- 内容区 -->
    ${content}
    
    <!-- 底部 -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#94a3b8;font-size:12px;">
      <div>AI 每日快报 · 每日 8:00 自动更新</div>
      <div style="margin-top:8px;">${date}</div>
    </div>
    
  </div>
</body>
</html>`;

  return html;
}

/**
 * 生成微信公众号专用 HTML
 * （微信公众号有一些特殊的 HTML 限制）
 */
export function generateWechatHTML(groupedNews, options = {}) {
  const date = formatDate(new Date());
  const title = options.title || `AI 每日快报（${date}）`;
  
  let content = '';
  
  for (const section of SECTION_ORDER) {
    const items = groupedNews[section];
    if (!items || items.length === 0) continue;
    
    const icon = SECTION_ICON[section] || '📍';
    
    content += `
      <h2 style="color:#1c5cff;font-size:18px;line-height:1.5;border-left:4px solid #1c5cff;padding:2px 0 2px 10px;margin:26px 0 16px;">
        ${icon} ${section}
      </h2>
    `;
    
    for (const item of items) {
      const meta = [item.source, formatDate(item.publishedAt)]
        .filter(Boolean)
        .join(' · ');
      
      const tagsHtml = Array.isArray(item.tags) && item.tags.length > 0
        ? `<p style="margin-top:8px;">${item.tags.map(tag => 
            `<span style="background:#eef4ff;color:#1c5cff;padding:2px 8px;border-radius:10px;font-size:12px;margin-right:5px;">${escapeHtml(tag)}</span>`
          ).join('')}</p>`
        : '';
      
      content += `
        <section style="padding:0 0 16px;margin:0 0 16px;border-bottom:1px solid #e5e7eb;">
          <h3 style="font-size:16px;color:#111827;margin:0 0 10px;line-height:1.65;font-weight:800;">
            ${item.company ? `<strong style="color:#0f766e;">${escapeHtml(item.company)}</strong> · ` : ''}
            ${escapeHtml(item.title)}
          </h3>
          ${meta ? `<p style="font-size:12px;color:#6b7280;margin:0 0 10px;">${escapeHtml(meta)}</p>` : ''}
          <p style="font-size:14px;color:#374151;line-height:1.85;margin:0;text-align:justify;">
            ${escapeHtml(item.summary)}
          </p>
          ${tagsHtml}
        </section>
      `;
    }
  }
  
  return `<section style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;line-height:1.8;color:#333;max-width:677px;margin:0 auto;padding:0 2px;">
    <h1 style="text-align:center;color:#1c5cff;font-size:24px;line-height:1.45;margin:0 0 8px;font-weight:900;">${escapeHtml(title)}</h1>
    <p style="text-align:center;color:#94a3b8;font-size:13px;margin:0 0 22px;">今日精选 AI 行业资讯</p>
    
    <p style="background:#f8fbff;border:1px solid #dbeafe;border-left:4px solid #1c5cff;padding:12px 14px;margin:0 0 24px;font-size:13px;color:#475569;line-height:1.8;border-radius:8px;">
      📌 本期精选 AI 行业资讯。
    </p>
    
    ${content}
    
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;">
      AI 每日快报 · ${date}
    </p>
  </section>`;
}
