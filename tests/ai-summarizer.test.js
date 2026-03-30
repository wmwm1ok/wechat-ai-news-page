import { detectArticleMode, extractMainTextFromHtml, isComparisonArticle, isDisplayReadyNews, isReaderFriendlySummary, isReserveDisplayNews, isSpecificEnoughSummary, normalizeDisplaySummary } from '../src/ai-summarizer.js';

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
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected value to be truthy but got ${actual}`);
      }
    }
  };
}

describe('AI summarizer helpers', () => {
  it('detects comparison style articles', () => {
    const result = isComparisonArticle({
      title: 'Seedance 2.0、Sora 2与Runway Gen-4：面向开发者的AI视频API对比',
      snippet: '文章对 API 架构、延迟基准测试和定价做了横向比较。'
    });

    expect(result).toBe(true);
  });

  it('rejects vague summaries for comparison articles', () => {
    const result = isSpecificEnoughSummary(
      '文章对 Seedance 2.0、Sora 和 Runway Gen-4 进行了深入对比，内容涵盖 API 架构、延迟和定价等方面。',
      '原文比较了三个模型的 API、延迟和定价。',
      { comparisonMode: true }
    );

    expect(result).toBe(false);
  });

  it('accepts concrete summaries for comparison articles', () => {
    const result = isSpecificEnoughSummary(
      '原文将 Seedance 2.0、Sora 2 和 Runway Gen-4 放在同一组 API 测试中比较，重点看延迟、定价和开发者集成。文章明确提到 Runway 的接口更成熟，Seedance 在价格上更激进，而 Sora 2 的结论部分并未给出绝对优势判断。',
      '原文比较了三个模型的 API、延迟、定价和开发者集成。',
      { comparisonMode: true }
    );

    expect(result).toBe(true);
  });

  it('detects roundup style articles', () => {
    const result = detectArticleMode({
      title: '《下载》简报：Pokemon Go训练世界模型，以及中美寻找外星人竞赛',
      snippet: '本期《下载》简报讨论了 Pokemon Go、世界模型和外星生命搜索。'
    });

    expect(result).toBe('roundup');
  });

  it('detects story style articles', () => {
    const result = detectArticleMode({
      title: 'OpenClaw：创业者利用中国OpenClaw AI热潮获利',
      snippet: '一位开发者用 OpenClaw 做副业并接管设备自动完成任务。'
    });

    expect(result).toBe('story');
  });

  it('rejects vague roundup summaries', () => {
    const result = isSpecificEnoughSummary(
      '本期《下载》简报介绍了 Pokemon Go 和寻找外星生命等话题，内容围绕相关技术展开。',
      '简报涉及 Pokemon Go 世界模型、中美寻找外星生命竞赛以及相关研究。',
      { articleMode: 'roundup' }
    );

    expect(result).toBe(false);
  });

  it('rejects vague story summaries', () => {
    const result = isSpecificEnoughSummary(
      '文章讲述了一位创业者如何借助 OpenClaw 热潮创业的故事。',
      '原文提到 OpenClaw 是可接管设备并自动完成任务的开源 AI 工具，主角靠它承接自动化项目。',
      { articleMode: 'story' }
    );

    expect(result).toBe(false);
  });

  it('accepts concrete roundup summaries', () => {
    const result = isSpecificEnoughSummary(
      '这期《下载》简报列了三个重点：Pokemon Go 如何为送货机器人提供世界模型训练素材，中美团队如何用不同方法搜索外星生命，以及相关研究为什么重新带动了世界模型讨论。',
      '简报涉及 Pokemon Go 世界模型、中美寻找外星生命竞赛以及相关研究。',
      { articleMode: 'roundup' }
    );

    expect(result).toBe(true);
  });

  it('rejects reader-unfriendly fallback summaries', () => {
    const result = isReaderFriendlySummary(
      '原文把 Zendesk 收购 Forethought 放在一起比较，重点涉及定价等维度，但公开片段没有披露更完整的差异和最终结论。'
    );

    expect(result).toBe(false);
  });

  it('rejects internal downgrade style summaries', () => {
    const result = isReaderFriendlySummary(
      '原文围绕 Zendesk 收购 Forethought 展开对比，当前可确认的重点主要集中在定价等维度，因此这里不做扩展解读。'
    );

    expect(result).toBe(false);
  });

  it('rejects vague story fallback from final display', () => {
    const result = isDisplayReadyNews({
      title: 'OpenClaw：创业者利用中国OpenClaw AI热潮获利',
      snippet: '一位开发者用 OpenClaw 做副业并接管设备自动完成任务。',
      summary: '一位27岁的北京软件工程师冯庆阳开始尝试使用流行的开源AI工具OpenClaw。该工具可以接管设备并自主完成任务。他借此机会实现了快速创业的梦想。'
    });

    expect(result).toBe(false);
  });

  it('rejects vague roundup fallback from final display', () => {
    const result = isDisplayReadyNews({
      title: '《下载》简报：Pokémon Go训练世界模型，以及中美寻找外星人竞赛',
      snippet: '本期《下载》简报讨论了 Pokemon Go、世界模型和外星生命搜索。',
      summary: '本期《下载》简报介绍了 Pokémon Go 如何为送货机器人提供精确的世界视图。这款2016年发布的增强现实游戏，其技术正被用于训练世界模型。简报还提到了中美在寻找外星生命方面的竞赛。'
    });

    expect(result).toBe(false);
  });

  it('accepts a concrete story summary for final display', () => {
    const result = isDisplayReadyNews({
      title: 'OpenClaw：创业者利用中国OpenClaw AI热潮获利',
      snippet: '一位开发者用 OpenClaw 做副业并接管设备自动完成任务。',
      summary: '原文写的是北京开发者冯庆阳如何把 OpenClaw 当成接单工具。OpenClaw 是一套可接管手机或电脑界面、自动执行点击和流程任务的开源 AI 工具，他借它承接自动化项目并把副业做成了创业尝试。'
    });

    expect(result).toBe(true);
  });

  it('keeps concrete Chinese summaries as reserve display candidates', () => {
    const result = isReserveDisplayNews({
      title: 'OpenAI 推出面向企业的 Agent 工具链',
      snippet: 'OpenAI 发布了一套新的企业 Agent 开发工具，强调流程编排和审计能力。',
      summary: 'OpenAI 面向企业推出了一套 Agent 工具链，重点补上流程编排、权限管理和审计能力。原文提到它希望让企业把客服、销售和内部知识库流程接到统一工作流里，并降低上线门槛。'
    });

    expect(result).toBe(true);
  });

  it('rejects vague reserve candidates without enough concrete signals', () => {
    const result = isReserveDisplayNews({
      title: 'AI 行业迎来新变化',
      snippet: '报道提到行业出现了一些新的趋势。',
      summary: '这篇文章介绍了 AI 行业的一些变化，并讨论了未来发展的可能方向。'
    });

    expect(result).toBe(false);
  });

  it('trims semicolon-ended summaries back to a full sentence', () => {
    const result = normalizeDisplaySummary(
      '当然，每一项令人瞩目的技术成果，都离不开背后为其提供支持的技术专家。而魔法原子的技术管理团队可以用豪华来形容：CTO陈春玉师从国内第一代人形机器人科研人员，见证并参与了国产人形机器人从0到1的完整技术演进；具身模型负责人张涛在学术研究与工程实践方面有着深厚积累，曾发表SCI、EI论文10余篇，拥有2。'
    );

    expect(result.endsWith('。')).toBe(true);
    expect(result.includes('拥有2。')).toBe(false);
  });

  it('rejects incomplete summaries from final display', () => {
    const result = isDisplayReadyNews({
      title: '魔法原子获百亿级融资，资本为何青睐其具身智能体系化方案？',
      snippet: '文章介绍了魔法原子的融资背景和核心技术团队。',
      summary: '当然，每一项令人瞩目的技术成果，都离不开背后为其提供支持的技术专家。而魔法原子的技术管理团队可以用豪华来形容：CTO陈春玉师从国内第一代人形机器人科研人员，见证并参与了国产人形机器人从0到1的完整技术演进；具身模型负责人张涛在学术研究与工程实践方面有着深厚积累，曾发表SCI、EI论文10余篇，拥有2。'
    });

    expect(result).toBe(false);
  });

  it('extracts article-like text instead of whole-page boilerplate', () => {
    const html = `
      <html>
        <body>
          <header>登录 注册 下载客户端 专题精选</header>
          <nav>首页 --> AI研究社 --> 雷峰网公开课活动中心</nav>
          <article>
            <p>3月12日，百度发布了全球首款手机龙虾应用“红手指Operator”。</p>
            <p>百度称该应用支持用户一气呵成下单、上线后迅速引爆热议，系统后台资源出现紧缺提示。</p>
            <p>OpenClaw创始人Peter Steinberger随后在海外社交平台上连发两条回复，称中国AI创新速度“Amazing”。</p>
          </article>
          <footer>Copyright © 2011-2026 雷峰网 深圳英鹏信息技术股份有限公司</footer>
        </body>
      </html>
    `;

    const result = extractMainTextFromHtml(html);

    expect(result.includes('红手指Operator')).toBe(true);
    expect(result.includes('登录 注册')).toBe(false);
    expect(result.includes('Copyright')).toBe(false);
  });

  it('trims overly long display summaries to a steadier length', () => {
    const result = normalizeDisplaySummary(
      'OpenAI 发布了新的学习功能，第一段详细介绍了它的定位和背景。第二段继续展开它如何帮助学生理解数学与科学概念。第三段补充了产品形态、应用场景、发布时间以及更多边角信息，导致整段明显过长，不适合日报统一展示。'
    );

    expect(result.length <= 150).toBe(true);
  });

  it('cuts long single-sentence summaries at a natural boundary instead of mid-word', () => {
    const result = normalizeDisplaySummary(
      'AI初创公司Niv-AI近日获得1200万美元种子轮融资，正式从隐身模式走出。该公司专注于解决数据中心GPU能耗波动问题，其核心方案是在数据中心与电网之间构建一个智能层，具体而言正在部署机架级传感器，以毫秒级精度监测自有及合作方GPU的实时功耗，目标是分析不同深度学习任务的具体能耗特征并优化调度。'
    );

    expect(result.includes('能耗特。')).toBe(false);
    expect(result.endsWith('。')).toBe(true);
  });

  it('rejects mostly English summaries from final display', () => {
    const result = isDisplayReadyNews({
      title: 'OpenAI发布GPT-5.4 mini和nano，专为子代理时代打造',
      snippet: 'The New Stack discusses GPT-5.4 mini and nano for agentic workloads.',
      summary: 'Notion AI Engineering Lead Abhisek Modi says this shift is already real. &ldquo;GPT-5.4 mini handles focused, well-defined tasks with impressive precision across agentic workflows.&rdquo;'
    });

    expect(result).toBe(false);
  });
});

console.log('🧪 Running AISummarizer Helper Tests...\n');
