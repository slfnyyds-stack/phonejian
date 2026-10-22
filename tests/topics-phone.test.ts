// 主题目录测试：验证 industry/topics.json 已切换为手机行业配置。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORY_TAGS, ENTITY_TAGS, ENTITIES, TOPIC_TAGS } from "../industry/taxonomy.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(readFileSync(path.join(root, "industry/topics.json"), "utf8")) as {
  exportedAt: string;
  groups: Array<{ key: string; name: string; blurb: string }>;
  topics: Array<{ slug: string; name: string; group: string; entityId?: string | null; tags: string[]; definition: string; related?: string[] }>;
};

const BRAND_IDS = ["apple", "huawei", "honor", "oppo", "vivo", "xiaomi", "samsung", "iqoo", "oneplus", "realme"];
const RETAIL_SLUGS = ["phone-launch", "comparison", "price-channel", "service", "industry", "observation"];

test("只有三个组，key 与显示名符合手机行业", () => {
  assert.deepEqual(data.groups.map((g) => g.key), ["company", "field", "genre"]);
  assert.deepEqual(data.groups.map((g) => g.name), ["品牌与厂商", "产品与体验", "零售与服务"]);
  for (const g of data.groups) {
    assert.ok(g.name.trim().length > 0, `组名非空：${g.key}`);
    assert.ok(g.blurb.trim().length > 0, `blurb 非空：${g.key}`);
    assert.ok(!g.blurb.includes("模型") && !g.blurb.includes("Agent"), `blurb 含旧行业词：${g.key}`);
  }
});

test("exportedAt 是配置编辑日期 2026-10-01", () => {
  assert.equal(data.exportedAt, "2026-10-01");
});

test("slug 唯一且十个品牌主题齐全，六个零售主题齐全", () => {
  const slugs = data.topics.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug 必须唯一");
  for (const id of BRAND_IDS) {
    assert.ok(slugs.includes(id), `缺少品牌主题：${id}`);
  }
  for (const slug of RETAIL_SLUGS) {
    assert.ok(slugs.includes(slug), `缺少零售主题：${slug}`);
  }
  assert.ok(!slugs.some((s) => ["openai", "anthropic", "model-releases", "agent", "mcp"].includes(s)), "不得保留旧行业主题");
});

test("每个主题：组、entityId、tags 均合法，品牌主题对应实体", () => {
  const groupKeys = new Set(data.groups.map((g) => g.key));
  const vocab = new Set<string>([...CATEGORY_TAGS, ...TOPIC_TAGS, ...ENTITY_TAGS]);
  for (const t of data.topics) {
    assert.ok(groupKeys.has(t.group), `${t.slug} 的组不合法：${t.group}`);
    assert.ok(t.name.trim().length > 0, `${t.slug} 的 name 为空`);
    assert.ok(t.definition.trim().length > 0, `${t.slug} 的 definition 为空`);
    for (const tag of t.tags) {
      assert.ok(vocab.has(tag) || /^entity:(apple|huawei|honor|oppo|vivo|xiaomi|samsung|iqoo|oneplus|realme)$/.test(tag), `${t.slug} 的标签不在词表：${tag}`);
    }
    if (t.group === "company") {
      assert.ok(t.entityId && ENTITIES[t.entityId], `${t.slug} 的 entityId 不在 ENTITIES：${t.entityId}`);
      assert.ok(t.tags.includes(`entity:${t.entityId}`), `${t.slug} 缺少 entity:${t.entityId} 标签`);
      assert.equal(t.slug, t.entityId, `品牌主题 slug 应与 entityId 一致：${t.slug}`);
    } else {
      assert.ok(!t.entityId, `非公司主题不应有 entityId：${t.slug}`);
      assert.ok(t.tags.length > 0, `${t.slug} 缺少归类标签`);
    }
    assert.ok(!t.definition.includes("OpenAI") && !t.definition.includes("Claude"), `${t.slug} 的定义含旧行业词`);
  }
});

test("十个品牌主题的 name 与 tags 取自 taxonomy 对应条目", () => {
  const byslug = new Map(data.topics.map((t) => [t.slug, t]));
  for (const id of BRAND_IDS) {
    const e = ENTITIES[id]!;
    const t = byslug.get(id)!;
    assert.equal(t.name, e.name, `${id} 的 name 与 taxonomy 不一致：${t.name}`);
    if (e.displayTag) assert.ok(t.tags.includes(e.displayTag), `${id} 缺少 displayTag：${e.displayTag}`);
  }
});

test("related 只引用本文件中存在的 slug", () => {
  const slugs = new Set(data.topics.map((t) => t.slug));
  for (const t of data.topics) {
    const related = t.related ?? [];
    assert.ok(related.length > 0 && related.length <= 4, `${t.slug} 的 related 数量应在 1–4：${related.length}`);
    for (const r of related) {
      assert.ok(slugs.has(r), `${t.slug} 的 related 悬空引用：${r}`);
      assert.notEqual(r, t.slug, `${t.slug} 的 related 引用了自己`);
    }
  }
});
