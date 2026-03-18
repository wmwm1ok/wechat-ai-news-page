const CATEGORY_SET = new Set(['产品发布与更新', '技术与研究', '投融资与并购', '政策与监管']);

const FINANCE_KEYWORDS = [
  '融资', '募资', '投资', '并购', '收购', '种子轮', '天使轮', 'pre-a', 'pre-b',
  'a轮', 'b轮', 'c轮', 'd轮', 'ipo', '估值', '基金', '注资', '领投', '跟投', '财报', '业绩'
];

const POLICY_KEYWORDS = [
  '政策', '监管', '法规', '合规', '条款', '禁令', '制裁', '审查', '法案', '法院', '版权',
  '隐私', '反垄断', '白宫', '欧盟', '政府', '军方', '国防部', '五角大楼', '国会', '立法',
  '合同', '采购', '准则', '监控', '武器', '军事'
];

const PRODUCT_ACTION_KEYWORDS = [
  '发布', '上线', '推出', '开放', '接入', '升级', '更新', '开售', '支持', '集成', '提供',
  '亮相', '可用', '商用', '公测', '内测', '发布会', '首发'
];

const PRODUCT_OBJECT_KEYWORDS = [
  '模型', '平台', '功能', '版本', '助手', 'agent', '智能体', '服务', '系统', '工具',
  '产品', '应用', 'api', 'sdk', '插件', '芯片', '数据库', '浏览器', '平台'
];

const RESEARCH_KEYWORDS = [
  '研究', '论文', '提出', '框架', '方法', '架构', '实践', '技术解析', '技术路线', '测试',
  '评测', '基准', 'benchmark', '实验', '训练', '推理', '开源', '数据集', '算法',
  '落地实践', '解析', '综述'
];

const BUSINESS_DYNAMICS_KEYWORDS = [
  '削减', '收缩', '放弃', '调整', '争议', '热议', '批评', '压力', '恐慌', '路线错误',
  '战略', '项目', '组织混乱', '四面楚歌'
];

function normalizeText(...parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword.toLowerCase()));
}

function countMatches(text, keywords) {
  return keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
}

export function classifyNewsCategory(item = {}) {
  const title = String(item.title || '');
  const summary = String(item.summary || '');
  const currentCategory = String(item.category || '');
  const titleText = title.toLowerCase();
  const fullText = normalizeText(title, summary);

  const financeHits = countMatches(fullText, FINANCE_KEYWORDS);
  const policyHits = countMatches(fullText, POLICY_KEYWORDS);
  const researchHits = countMatches(fullText, RESEARCH_KEYWORDS);
  const productActionHits = countMatches(titleText, PRODUCT_ACTION_KEYWORDS);
  const productActionContextHits = countMatches(fullText, PRODUCT_ACTION_KEYWORDS);
  const productObjectHits = countMatches(fullText, PRODUCT_OBJECT_KEYWORDS);
  const titleProductObjectHits = countMatches(titleText, PRODUCT_OBJECT_KEYWORDS);
  const businessDynamicsHits = countMatches(fullText, BUSINESS_DYNAMICS_KEYWORDS);

  if (financeHits >= 1) {
    return '投融资与并购';
  }

  if (policyHits >= 1) {
    return '政策与监管';
  }

  const strongProductSignal =
    (
      (productActionHits >= 1 && productObjectHits >= 1) ||
      (productActionContextHits >= 1 && titleProductObjectHits >= 1)
    ) &&
    businessDynamicsHits === 0 &&
    financeHits === 0;

  if (strongProductSignal) {
    return '产品发布与更新';
  }

  if (researchHits >= 1 || businessDynamicsHits >= 1) {
    return '技术与研究';
  }

  if (currentCategory && CATEGORY_SET.has(currentCategory)) {
    return currentCategory;
  }

  return '技术与研究';
}
