// 分类体系测试：验证 industry/taxonomy.ts 已切换为手机行业配置。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  CATEGORY_BY_ITEM_TYPE,
  CATEGORY_TAGS,
  ENTITIES,
  ENTITY_TAGS,
  IDENTITY_LEXICON,
  ITEM_TYPES,
  PUBLISHER_DOMAINS,
  TAG_SYNONYMS,
  TOPIC_TAGS,
} from "../industry/taxonomy.ts";

test("六个分类的 key 顺序与唯一性，字段非空", () => {
  const expected = ["phone-launch", "comparison", "price-channel", "service", "industry", "observation"];
  assert.deepEqual(CATEGORIES.map((c) => c.key), expected);
  for (const c of CATEGORIES) {
    assert.ok(c.label.trim().length > 0, `label 为空：${c.key}`);
    assert.ok(c.section.trim().length > 0, `section 为空：${c.key}`);
    assert.ok(c.guide.trim().length > 0, `guide 为空：${c.key}`);
  }
});

test("CATEGORY_BY_ITEM_TYPE 的值都在 CATEGORY_TAGS 中；ITEM_TYPES 与原枚举一致", () => {
  const original = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"];
  assert.deepEqual([...ITEM_TYPES], original);
  for (const [type, tag] of Object.entries(CATEGORY_BY_ITEM_TYPE)) {
    assert.ok(original.includes(type), `未知内容类型：${type}`);
    assert.ok((CATEGORY_TAGS as readonly string[]).includes(tag), `${type} 的兜底标签不在词表：${tag}`);
  }
});

test("十个品牌 id 与 displayTag 有效；IDENTITY_LEXICON id 对应实体", () => {
  const expectedIds = ["apple", "huawei", "honor", "oppo", "vivo", "xiaomi", "samsung", "iqoo", "oneplus", "realme"];
  assert.deepEqual(Object.keys(ENTITIES), expectedIds);
  const entityTags = ENTITY_TAGS as readonly string[];
  for (const id of expectedIds) {
    const e = ENTITIES[id]!;
    assert.ok(e.name.trim().length > 0);
    assert.ok(e.displayTag !== null && entityTags.includes(e.displayTag), `${id} 的 displayTag 无效：${e.displayTag}`);
    assert.ok(e.aliases.length > 0);
  }
  for (const entry of IDENTITY_LEXICON) {
    assert.ok(ENTITIES[entry.id], `IDENTITY_LEXICON 的 id 不在 ENTITIES：${entry.id}`);
    assert.ok(entry.patterns.length > 0);
  }
});

test("PUBLISHER_DOMAINS 的 entityId 有效且域名非空；TAG_SYNONYMS 的值都在三个词表内", () => {
  for (const { entityId, domains } of PUBLISHER_DOMAINS) {
    assert.ok(ENTITIES[entityId], `未知 entityId：${entityId}`);
    assert.ok(domains.length > 0 && domains.every((d) => d.trim().length > 0));
  }
  const allowed = new Set<string>([...CATEGORY_TAGS, ...TOPIC_TAGS, ...ENTITY_TAGS]);
  for (const [from, to] of Object.entries(TAG_SYNONYMS)) {
    assert.ok(allowed.has(to), `TAG_SYNONYMS["${from}"] 的目标不在词表：${to}`);
  }
});

test("品牌识别：正向命中且母品牌不误指子品牌", () => {
  const find = (id: string) => {
    const entry = IDENTITY_LEXICON.find((e) => e.id === id);
    assert.ok(entry, `缺少词条：${id}`);
    return entry!;
  };
  const match = (id: string, text: string) => find(id).patterns.some((re) => re.test(text));

  assert.ok(match("apple", "Apple发布iPhone 18"));
  assert.ok(match("huawei", "华为Mate 80 发布"));
  assert.ok(match("honor", "荣耀Magic7 体验"));
  assert.ok(match("samsung", "Samsung Galaxy S26 上手"));
  assert.ok(match("oppo", "OPPO Find X8 评测"));
  assert.ok(match("vivo", "vivo X200 续航实测"));
  assert.ok(match("xiaomi", "小米 Redmi Turbo5 价格"));

  // 子品牌与母品牌分离：提到 iQOO 不应命中 vivo，提到 OnePlus 不应命中 OPPO。
  const oppoEntry = find("oppo");
  assert.ok(!oppoEntry.patterns.some((re) => re.test("OnePlus 13 发布")), "OnePlus 不应命中 OPPO");
  const vivoEntry = find("vivo");
  assert.ok(!vivoEntry.patterns.some((re) => re.test("iQOO Neo11 评测")), "iQOO 不应命中 vivo");
  assert.ok(match("iqoo", "iQOO Neo11 评测"));
  assert.ok(match("oneplus", "OnePlus 13 发布"));
});

test("词表不再含 AI 行业专属展示词", () => {
  const banned = ["论文/研究", "RAG", "MCP/工具调用", "模型发布", "开源/仓库", "大佬观点", "安全/对齐", "评测/基准"];
  const allTags = [...CATEGORY_TAGS, ...TOPIC_TAGS, ...ENTITY_TAGS];
  for (const tag of allTags) {
    for (const word of banned) {
      assert.ok(!tag.includes(word), `标签含旧行业词：${tag}`);
    }
  }
  const synonymText = Object.entries(TAG_SYNONYMS).map(([k, v]) => `${k}=${v}`).join(",");
  for (const word of ["RAG", "MCP", "论文", "模型", "开源", "对齐"]) {
    assert.ok(!synonymText.includes(word), `TAG_SYNONYMS 含旧行业词：${word}`);
  }
});
