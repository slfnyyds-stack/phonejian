// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉模型怎么归类。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 */
export const CATEGORIES = [
  { key: "phone-launch", label: "新品动态", section: "新品动态", guide: "手机、折叠屏及相关移动终端的官方发布、上市、核心规格与系统更新" },
  { key: "comparison", label: "机型对比", section: "机型对比", guide: "同价位/同系列机型差异、实测体验与可核对的评测，不将营销榜单当事实" },
  { key: "price-channel", label: "价格与渠道", section: "价格与渠道", guide: "公开调价、补贴、零售渠道规则与公开供销信息；不暴露非公开渠道报价" },
  { key: "service", label: "售后与服务", section: "售后与服务", guide: "官方保修、维修、回收以旧换新、服务政策与风险提醒，标注适用范围" },
  { key: "industry", label: "行业动态", section: "行业动态", guide: "手机行业经营、市场、监管、供应链与技术变化" },
  { key: "observation", label: "一线观察", section: "一线观察", guide: "可溯源的零售经验、销售问题、顾客需求与观点；观点不能冒充新闻，AI 不能编作者经历" },
] as const;

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 * 注意：这些只是内部兼容标识（后端 z.enum 依赖它），不向用户展示为分类。
 */
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "新品发布", "系统更新", "评测对比", "价格政策", "渠道信息", "售后服务", "回收换新", "行业动态", "技术研究", "零售实践", "观点分析", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "折叠屏", "影像", "续航", "性能", "系统", "AI功能", "配件", "运营商", "补贴", "以旧换新", "顾客体验", "门店经营",
] as const;

/** 可选的实体标签（品牌）。 */
export const ENTITY_TAGS = ["Apple", "华为", "荣耀", "OPPO", "vivo", "小米", "Samsung", "iQOO", "OnePlus", "realme"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  发布: "新品发布", 上市: "新品发布", 开售: "新品发布", 首发: "新品发布", 新品: "新品发布", launch: "新品发布",
  系统更新: "系统更新", 升级: "系统更新", 固件: "系统更新", OTA: "系统更新", 更新: "系统更新",
  评测: "评测对比", 对比: "评测对比", 横评: "评测对比", 上手: "评测对比", 实测: "评测对比", review: "评测对比",
  调价: "价格政策", 降价: "价格政策", 涨价: "价格政策", 价格: "价格政策", 补贴: "价格政策", 国补: "价格政策", 优惠: "价格政策",
  渠道: "渠道信息", 供货: "渠道信息", 供销: "渠道信息", 门店: "渠道信息", channel: "渠道信息",
  保修: "售后服务", 维修: "售后服务", 质量问题: "售后服务", 服务政策: "售后服务", 风险提醒: "售后服务",
  回收: "回收换新", 以旧换新: "回收换新", 换新: "回收换新", 折抵: "回收换新",
  行业: "行业动态", 动态: "行业动态", 供应链: "行业动态", 监管: "行业动态", 市场: "行业动态", 经营: "行业动态",
  技术: "技术研究", 规格: "技术研究", 芯片: "技术研究", research: "技术研究",
  实践: "零售实践", 经验: "零售实践", 销售: "零售实践", 门店经营: "零售实践", 带货: "零售实践",
  观点: "观点分析", 评论: "观点分析", 分析: "观点分析", 观察: "观点分析", opinion: "观点分析",
};

/** 模型漏了分类标签时，按内容类型补一个。 */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  model_release: "系统更新", product_launch: "新品发布", tool_or_prompt: "零售实践", research_paper: "技术研究",
  industry_event: "行业动态", opinion_analysis: "观点分析", tutorial_explainer: "零售实践",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/** 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  apple: { name: "Apple", displayTag: "Apple", aliases: ["Apple", "苹果", "iPhone"] },
  huawei: { name: "华为", displayTag: "华为", aliases: ["华为", "Huawei"] },
  honor: { name: "荣耀", displayTag: "荣耀", aliases: ["荣耀", "Honor", "HONOR"] },
  oppo: { name: "OPPO", displayTag: "OPPO", aliases: ["OPPO", "欧珀"] },
  vivo: { name: "vivo", displayTag: "vivo", aliases: ["vivo", "维沃"] },
  xiaomi: { name: "小米", displayTag: "小米", aliases: ["小米", "Xiaomi", "Redmi", "红米"] },
  samsung: { name: "Samsung", displayTag: "Samsung", aliases: ["Samsung", "三星", "Galaxy"] },
  iqoo: { name: "iQOO", displayTag: "iQOO", aliases: ["iQOO", "艾酷"] },
  oneplus: { name: "OnePlus", displayTag: "OnePlus", aliases: ["OnePlus", "一加"] },
  realme: { name: "realme", displayTag: "realme", aliases: ["realme", "真我"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 * 注意子品牌与母品牌分开识别：iQOO 不属于 vivo 词，OnePlus 不属于 OPPO 词，品牌归属单独判断。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  // Apple 放最前，避免 "Apple" 被其他词吞掉；苹果 AI 功能属于 Apple，不是另起虚构品牌。
  { id: "apple", name: "Apple / iPhone", patterns: [/\bapple\b|苹果|\biphone\b|\bipad\b|\bmac\b|watch\s?os|\bios\s?\d/i] },
  { id: "huawei", name: "华为", patterns: [/华为|huawei|\bmate\s?\d|harmonyos|鸿蒙|\bpura\s?\d|\bnova\s?\d/i] },
  { id: "honor", name: "荣耀", patterns: [/荣耀|(?<![a-z])honor(?![a-z])/i, /\bmagic\s?\d/i] },
  { id: "oppo", name: "OPPO", patterns: [/(?<![a-z])oppo(?![a-z])/i, /\bfind\s?[xnr]\d/i, /\bareno\s?\d/i] },
  { id: "vivo", name: "vivo", patterns: [/(?<!i)(?<![a-z])vivo(?![a-z])/i, /\bX\d{3,}\b|\bS\s?\d{1,2}\s?(?:Pro|e)?\b/i, /\bX\s?(?:200|100)\b/i, /\bfold\b/i, /\bOriginOS\b|\bfuntouch/i] },
  { id: "xiaomi", name: "小米", patterns: [/小米|红米|xiaomi|redmi|\bmi\s?\d{1,2}\b|\bpoco\b|HyperOS|澎湃/i] },
  { id: "samsung", name: "Samsung / Galaxy", patterns: [/三星|samsung|\bgalaxy\b|\bexynos\b|\bOne\s?UI\b/i] },
  { id: "iqoo", name: "iQOO", patterns: [/iqoo|艾酷/i] },
  { id: "oneplus", name: "OnePlus", patterns: [/one\s?plus|一加/i] },
  { id: "realme", name: "realme", patterns: [/realme|真我/i] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台、论坛、聚合平台不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "apple", domains: ["apple.com", "apple.com.cn"] },
  { entityId: "huawei", domains: ["huawei.com"] },
  { entityId: "honor", domains: ["honor.com"] },
  { entityId: "oppo", domains: ["oppo.com"] },
  { entityId: "vivo", domains: ["vivo.com", "vivo.com.cn"] },
  { entityId: "xiaomi", domains: ["mi.com", "xiaomi.com"] },
  { entityId: "samsung", domains: ["samsung.com", "samsung.com.cn"] },
  { entityId: "iqoo", domains: ["iqoo.com"] },
  { entityId: "oneplus", domains: ["oneplus.com"] },
  { entityId: "realme", domains: ["realme.com"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
