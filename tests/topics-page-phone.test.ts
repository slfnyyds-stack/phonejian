// 主题目录（手机行业）页面静态契约测试。
// 与 navigation-phone.test.ts 相同的思路：直接读 apps/web/app/routes/topics.tsx
// 源码做结构断言，node --test 无需打包器即可运行。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "..", "apps", "web", "app", "routes", "topics.tsx"), "utf8");

test("页面不含上游 AI 行业残留文案", () => {
  for (const banned of ["OpenAI", "Anthropic", "Agent、多模态", "按主题看 AI", "38 个方向", "AI 主题页", "公司与模型", "技术方向", "内容形态"]) {
    assert.ok(!page.includes(banned), `topics.tsx 不得出现上游文案："${banned}"`);
  }
});

test("三个分组使用手机行业语义名称", () => {
  assert.match(page, /品牌与厂商/, "company 组应改为品牌与厂商");
  assert.match(page, /产品与体验/, "field 组应改为产品与体验");
  assert.match(page, /零售与服务|零售与经营/, "genre 组应改为零售语义");
  // 保留 API 的 group 枚举，不得改写键名
  for (const key of ["company", "field", "genre"]) {
    assert.match(page, new RegExp(`key:\\s*"${key}"`), `分组 key 必须保留 API 枚举值 ${key}`);
  }
});

test("meta 与 h1 为手机行业语义且不硬编码总数", () => {
  assert.match(page, /title:\s*"品牌与主题"/, "页面标题应为品牌与主题");
  const metaCall = page.slice(page.indexOf("export function meta"));
  assert.ok(!/\d+\s*个方向/.test(metaCall) && !/38/.test(metaCall), "meta description 不得硬编码主题总数");
  const h1 = page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
  assert.ok(/品牌与主题/.test(h1) || !/AI/.test(h1), "h1 不得再是「按主题看 AI」");
});

test("页面统计使用 topics.length 而非写死的数字", () => {
  assert.match(page, /topics\.length/, "说明文案应动态取 topics.length");
});

test("total 为 0 时显示暂无精选而不是查看 0 条精选", () => {
  assert.ok(!/查看 \{t\.total\} 条精选/.test(page), "不得渲染「查看 0 条精选」");
  assert.match(page, /暂无精选/, "total 为 0 时应显示暂无精选");
  // 0 精选时链接仍然可用（整个卡片仍是 Link，供查看主题定义）
  assert.match(page, /to=\{`\/topics\/\$\{t\.slug\}`\}/, "每个主题卡必须是可点击的 Link");
});

test("recent 只陈述真实数字，不鼓吹热门", () => {
  assert.ok(!/热门|爆/.test(page), "页面不得编造热度话术");
  assert.match(page, /t\.recent/, "近期精选数量必须来自真实字段 t.recent");
});

test("空分组显示没有配置主题的空态", () => {
  assert.match(page, /没有配置主题/, "分组无条目时应有空态文案");
});

test("网格响应式：手机 1 列、中等 2 列、桌面最多 3 列，不得有 xl:grid-cols-4", () => {
  assert.ok(!/xl:grid-cols-4/.test(page), "不得出现 xl:grid-cols-4 的窄四列卡");
  assert.match(page, /sm:grid-cols-2/, "中等屏幕应为 2 列");
  assert.match(page, /lg:grid-cols-3/, "桌面最多 3 列");
  const grid = page.match(/<ul className="[^"]*grid[^"]*"/)?.[0] ?? "";
  assert.ok(!grid.includes("grid-cols-4"), "网格不得出现 4 列");
});

test("保留 dark tokens 与可访问性写法", () => {
  assert.match(page, /text-ink/, "沿用 dark token 文本色");
  assert.match(page, /aria-label=/, "主题卡链接需带 aria-label");
  assert.match(page, /aria-labelledby=/, "分组区块需 aria-labelledby");
});
