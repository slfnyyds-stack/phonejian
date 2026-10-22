import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../packages/backend/src/publication/detail.ts", import.meta.url));
const src = readFileSync(SOURCE, "utf8");

interface BodyLike { zh: string | null; original: string | null; zhKind?: string | null }
interface DetailLike { readingMode: string; body?: BodyLike | null }

function siteFn(): string {
  const start = src.indexOf("export function siteItemDetail");
  assert.notEqual(start, -1, "找不到 siteItemDetail");
  return src.slice(start);
}

/** 普通公开 detail 分支（最后一个 const detail）里的 readingMode 表达式，实参只有 body。 */
function ordinaryReadingMode(): (body: BodyLike | null) => string {
  const decl = src.lastIndexOf("const detail: ItemDetail = {");
  assert.notEqual(decl, -1, "找不到普通 detail 分支");
  const m = src.slice(decl).match(/readingMode:\s*([^,\n]+)/);
  assert.ok(m, "普通 detail 分支缺少 readingMode 表达式");
  const expr = m[1].trim();
  assert.notEqual(expr, '"full"', '普通 detail 分支仍硬写 readingMode: "full"');
  return new Function("body", `return ${expr}`) as (body: BodyLike | null) => string;
}

/** 投影里的 readingMode 表达式，实参为 detail 与 selectedHtml。 */
function projectionReadingMode(): (detail: DetailLike, selectedHtml: string | null | undefined) => string {
  const m = siteFn().match(/const readingMode[^=]*=\s*([^;]+);/);
  assert.ok(m, "siteItemDetail 缺少 readingMode 投影表达式");
  const expr = m[1].trim();
  return new Function("detail", "selectedHtml", `return ${expr}`) as (detail: DetailLike, selectedHtml: string | null | undefined) => string;
}

function projectionHasTranslation(): (detail: DetailLike) => boolean {
  const m = siteFn().match(/const hasTranslation = ([^;]+);/);
  assert.ok(m, "siteItemDetail 缺少 hasTranslation 表达式");
  const expr = m[1].trim();
  return new Function("detail", `return ${expr}`) as (detail: DetailLike) => boolean;
}

test("普通公开 detail：只有真实可读 body 才 full", () => {
  const mode = ordinaryReadingMode();
  assert.equal(mode(null), "summary-only", "无 body 应 summary-only");
  assert.equal(mode({ zh: "", original: "" }), "summary-only", "两语言空字符串应 summary-only");
  assert.equal(mode({ zh: "  \n ", original: "" }), "summary-only", "两语言空白应 summary-only");
  assert.equal(mode({ zh: null, original: null }), "summary-only", "X 分支空文本且无译文应 summary-only");
  assert.equal(mode({ zh: "<p>中文</p>", original: null }), "full", "中文有内容应 full");
  assert.equal(mode({ zh: null, original: "<p>原文</p>" }), "full", "原文有内容应 full");
  assert.equal(mode({ zh: "<p>中文</p>", original: "<p>orig</p>" }), "full");
});

test("siteItemDetail 投影：按 selectedHtml 判定，受限投影不升级", () => {
  const mode = projectionReadingMode();
  assert.equal(mode({ readingMode: "summary-only" }, "<p>看起来有正文</p>"), "summary-only", "受限投影不得升级");
  assert.equal(mode({ readingMode: "full" }, "<p>原文正文</p>"), "full");
  assert.equal(mode({ readingMode: "full" }, "<p>中文正文</p>"), "full");
  assert.equal(mode({ readingMode: "full" }, "   "), "summary-only", "selectedHtml 空白应 summary-only");
  assert.equal(mode({ readingMode: "full" }, null), "summary-only", "无 selectedHtml 应 summary-only");
  assert.equal(mode({ readingMode: "full" }, undefined), "summary-only");
});

test("hasTranslation 只认两个真实非空语言且 translation 成立", () => {
  const f = projectionHasTranslation();
  assert.equal(f({ readingMode: "full", body: { zh: " ", original: "<p>orig</p>", zhKind: "translation" } }), false, "zh 空白不算");
  assert.equal(f({ readingMode: "full", body: { zh: "<p>译</p>", original: " ", zhKind: "translation" } }), false, "original 空白不算");
  assert.equal(f({ readingMode: "full", body: { zh: "<p>译</p>", original: "<p>orig</p>", zhKind: "original" } }), false, "非 translation 不算");
  assert.equal(f({ readingMode: "full", body: { zh: "<p>译</p>", original: "<p>orig</p>", zhKind: "translation" } }), true);
});

test("源码保留授权/隐私分支，不把摘要写成 body", () => {
  const qualified = src.match(/row\.body_mode === "full"/g) ?? [];
  assert.ok(qualified.length >= 2, "body_mode 授权阀门必须保持 row.body_mode === \"full\" 全限定");
  assert.match(src, /if \(row\.visibility === "summary-only"\)/, "visibility summary-only 分支被删");
  assert.match(src, /reason: null/, "cleared reason 被删");
  assert.match(src, /tags: \[\]/, "cleared tags 被删");
  assert.match(src, /hasItemPage\(\{ visibility: row\.visibility, sourceMode: row\.source_mode \}\)/, "hasItemPage 授权门被删");
  assert.ok(!/body:\s*(row\.)?summary\b/.test(src), "不把摘要拼成 body");
  assert.match(src, /indexable: row\.indexable/, "普通 detail 的 indexable 被清零");
  assert.match(src, /markdownAvailable: markdownAvailable\(row\)/, "普通 detail 的 markdownAvailable 被清零");
  assert.match(src, /relatedStories: related/, "普通 detail 的 story 关联被清零");
  assert.match(src, /group,/, "普通 detail 的 group 被清零");
  assert.ok(src.includes("textToHtml") && src.includes("proxyBodyImages"), "HTML sanitizer 保留");
  assert.ok(src.includes("row.url") && src.includes("itemUrl(row.id)"), "原文 URL 保留");
});
