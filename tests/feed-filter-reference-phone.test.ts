// 手机分类被裁切的修复契约（/ 与 /all，390px）：feed-layout-fix.css 必须把
// 过滤行/分类标签的规则挂在新根 .phone-reference-site 上，并且只在
// @media (max-width: 1023px) 内生效 —— 桌面 >=1024 维持原生「分类搜索同排」，
// 不允许出现全局（media 外）覆盖。旧 .editorial-site 作用域已随 root.tsx 的
// SiteShell 换成 phone-reference-site，留在 CSS 里等于死规则（手机端 87/89 红的根因）。
// 与其它 *-phone 测试一致：node --test 直接读源码文本，无需打包器。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "apps", "web", "app", "feed-layout-fix.css"), "utf8");

/** 取出唯一的 @media (max-width: 1023px) 块，并返回 media 之外的残留内容。 */
function splitMedia(source: string): { block: string; outside: string } {
  const start = source.search(/@media[^{]*max-width\s*:\s*1023px[^{]*\{/i);
  assert.notEqual(start, -1, "feed-layout-fix.css 必须含 @media (max-width: 1023px) 块");
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1, "@media 块花括号必须闭合");
  return {
    block: source.slice(open + 1, end),
    outside: source.slice(0, start) + source.slice(end + 1),
  };
}

/** 把一段 CSS 拆成 [{ selector, body }]（假定无嵌套规则，媒体块内本就不该有）。 */
function rulesOf(source: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push({ selector: m[1]!.trim(), body: m[2]!.trim() });
  return out;
}

const phoneRules = () => rulesOf(splitMedia(css).block);
const media = splitMedia(css);
const rules = phoneRules();

test("feed-layout-fix.css: 旧 .editorial-site 作用域已彻底移除", () => {
  assert.ok(!css.includes(".editorial-site"),
    "新根已是 .phone-reference-site，继续写 .editorial-site 的规则永不命中（手机分类裁切根因）");
});

test("feed-layout-fix.css: 全部规则都在 @media (max-width: 1023px) 内，桌面无全局覆盖", () => {
  const outside = media.outside.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  assert.equal(outside, "",
    "media 之外不得残留任何声明，否则会覆盖桌面 >=1024 的原生分类搜索同排布局");
  assert.ok(!/min-width\s*:\s*1024px/i.test(css), "不得新增桌面 (min-width:1024px) 覆盖");
  assert.ok(rules.length >= 4, `手机端至少应有 4 条规则，实际 ${rules.length} 条`);
});

test("feed-layout-fix.css: 每条规则都以 .phone-reference-site 作用域开头", () => {
  for (const rule of rules) {
    assert.ok(rule.selector.startsWith(".phone-reference-site "),
      `选择器必须以 .phone-reference-site 开头，实际：${rule.selector}`);
  }
});

test("feed-layout-fix.css: .feed-filter-row 在手机端为 column（搜索独占一行）", () => {
  const row = rules.find((r) => /\.feed-filter-row$/.test(r.selector));
  assert.ok(row, "缺少 .phone-reference-site .feed-filter-row 规则");
  assert.match(row!.body, /display\s*:\s*flex/);
  assert.match(row!.body, /flex-direction\s*:\s*column/);
});

test("feed-layout-fix.css: 过滤行内 form 为 order:-1 且 width:100%", () => {
  const form = rules.find((r) => /\.feed-filter-row\s*>\s*form$/.test(r.selector));
  assert.ok(form, "缺少 .feed-filter-row > form 规则");
  assert.match(form!.body, /order\s*:\s*-1/);
  assert.match(form!.body, /width\s*:\s*100%/);
});

test("feed-layout-fix.css: .feed-category-tabs 不裁切（overflow:visible + max-width:100%）", () => {
  const tabs = rules.find((r) => /\.feed-category-tabs$/.test(r.selector));
  assert.ok(tabs, "缺少 .feed-category-tabs 规则");
  assert.match(tabs!.body, /overflow\s*:\s*visible/);
  assert.match(tabs!.body, /max-width\s*:\s*100%/);
});

test("feed-layout-fix.css: [data-pill-track] 允许换行（flex-wrap:wrap）以完整显示全部分类", () => {
  const track = rules.find((r) => /\.feed-category-tabs\s*\[data-pill-track\]$/.test(r.selector));
  assert.ok(track, "缺少 .feed-category-tabs [data-pill-track] 规则");
  assert.match(track!.body, /display\s*:\s*flex/);
  assert.match(track!.body, /flex-wrap\s*:\s*wrap/);
  assert.match(track!.body, /width\s*:\s*100%/);
});
