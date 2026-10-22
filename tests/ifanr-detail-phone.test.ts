// 源码契约测试（不连库、不 import 后端模块）：detail.ts 的两个入口
// （loadItemDetail / exportMarkdown）都必须走 ifanrLicensedBody 许可闸门，
// 爱范儿未审时不留全文，非爱范儿路径与 X 分支保持原样。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

/** 从测试目录向上找仓库根（含 packages/backend/src/publication/detail.ts）。 */
function findDetail(): string {
  let dir = here;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, "packages", "backend", "src", "publication", "detail.ts");
    if (existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error(`detail.ts not found upward from ${here}`);
}

const src = readFileSync(findDetail(), "utf8");

function sliceBetween(startNeedle: string, endNeedle: string): string {
  const s = src.indexOf(startNeedle);
  assert.notEqual(s, -1, `missing: ${startNeedle}`);
  const e = src.indexOf(endNeedle, s + startNeedle.length);
  assert.notEqual(e, -1, `missing after start: ${endNeedle}`);
  return src.slice(s, e);
}

const loadSlice = sliceBetween("export async function loadItemDetail", "export function markdownAvailable");
const exportSlice = sliceBetween("export async function exportMarkdown", "export function siteItemDetail");

test("helper 被 import，且两个入口各调用一次", () => {
  assert.ok(
    /import \{ ifanrLicensedBody \} from "\.\/ifanr-license\.ts";/.test(src),
    "detail.ts 必须从 ./ifanr-license.ts 引入 ifanrLicensedBody",
  );
  const calls = src.match(/ifanrLicensedBody\(\{ articleId: row\.id, url: row\.url, author: row\.author, bodyHtml: row\.body_html \}\)/g) ?? [];
  assert.equal(calls.length, 2, "loadItemDetail 与 exportMarkdown 各需一次 helper 调用");
  assert.ok(loadSlice.includes("ifanrLicensedBody({ articleId: row.id"), "loadItemDetail 未调用 helper");
  assert.ok(exportSlice.includes("ifanrLicensedBody({ articleId: row.id"), "exportMarkdown 未调用 helper");
  const guardCalls = src.match(/isIfanrSource\(row\)/g) ?? [];
  assert.equal(guardCalls.length, 2, "两个入口都应经 isIfanrSource 分支");
});

test("loadItemDetail：爱范儿未审时 body 保持 null，isZh 强制 true 且不用 tr_html", () => {
  assert.ok(loadSlice.includes("const html = ifanr ? licensed : row.body_html;"), "非爱范儿仍走 row.body_html");
  assert.ok(loadSlice.includes("if (html) {"), "helper 为 null 时不组装 body");
  const guard = loadSlice.indexOf("if (html) {");
  const bodyAssign = loadSlice.indexOf("body = {", guard);
  assert.ok(guard >= 0 && bodyAssign > guard, "body 组装必须在 if (html) 守卫内");
  assert.match(loadSlice, /const isZh = ifanr \|\|/, "爱范儿 isZh 强制 true");
});

test("非爱范儿路径保留原逻辑（proxyBodyImages / withOutline / tr_html 双语）", () => {
  assert.ok(loadSlice.includes("proxyBodyImages(html)"), "仍走 proxyBodyImages");
  assert.ok(loadSlice.includes("row.tr_html ? proxyBodyImages(row.tr_html) : null"), "非爱范儿译文路径保留");
  assert.ok(loadSlice.includes("const primary = withOutline(zh ?? original);"), "withOutline 保留");
  assert.ok(loadSlice.includes("complete: isZh ? true : row.tr_complete ?? false"), "complete 语义保留");
});

test("X 分支与可见性门未改", () => {
  assert.ok(loadSlice.includes('if (row.channel === "x" && row.body_mode === "full")'), "loadItemDetail X 分支保留");
  assert.ok(loadSlice.includes("xView(row, false, true)"), "xView 保留");
  assert.ok(loadSlice.includes("summary.x?.translation ? textToHtml(summary.x.translation) : null"), "X 译文组装保留");
  assert.ok(loadSlice.includes("if (!row || !hasItemPage({ visibility: row.visibility, sourceMode: row.source_mode }))"), "hasItemPage 门保留");
  assert.ok(loadSlice.includes('if (row.visibility === "summary-only")'), "summary-only 早退保留");
  assert.ok(loadSlice.includes('readingMode: "summary-only"'), "summary-only detail 保留");
  assert.ok(loadSlice.includes('readingMode: body && (body.zh?.trim() || body.original?.trim()) ? "full" : "summary-only"'), "readingMode 表达式未改");
});

test("exportMarkdown：爱范儿只导出 helper 结果，未审时仅摘要；其它来源双语原样", () => {
  assert.ok(exportSlice.includes("if (ifanr) {"), "exportMarkdown 需要爱范儿分支");
  assert.ok(exportSlice.includes('if (licensed) lines.push("## 正文", "", turndown.turndown(licensed), "");'), "只有 helper 结果才导出正文");
  const ifanrBranch = exportSlice.slice(exportSlice.indexOf("if (ifanr) {"), exportSlice.indexOf("} else {"));
  assert.ok(!ifanrBranch.includes("row.tr_html"), "爱范儿分支不得导出 tr_html");
  assert.ok(!ifanrBranch.includes("row.body_html)"), "爱范儿分支不得直接导出库内全文");
  assert.ok(exportSlice.includes('if (!isZh && row.tr_html && row.tr_complete) lines.push("## 正文 · 中文译文"'), "非爱范儿双语译文保留");
  assert.ok(exportSlice.includes('lines.push(isZh ? "## 正文" : "## 正文 · 原文", "", turndown.turndown(row.body_html), "");'), "非爱范儿正文导出保留");
  assert.ok(exportSlice.includes('if (row.channel === "x" && row.body_mode === "full" && row.x_post?.text)'), "X 导出分支保留");
  assert.ok(exportSlice.includes("String(row.x_post.text)"), "X 正文导出保留");
});

test("isIfanrSource 仅按 source_id 判定（从源码取函数体验证）", () => {
  const m = src.match(/function isIfanrSource\(row: \{ source_id: string \}\): boolean \{([\s\S]*?)\}/);
  assert.ok(m, "detail.ts 需保留 isIfanrSource(source_id) 单参判定");
  assert.ok(!/channel|hostname|new URL/.test(m![1]), "isIfanrSource 不得按 channel 或 host 猜来源");
  const fn = new Function("row", m![1]) as (row: Record<string, string>) => boolean;
  assert.equal(fn({ source_id: "rss-ifanr" }), true, "rss-ifanr 应为 true");
  assert.equal(fn({ source_id: "rss-other", channel: "rss-ifanr" }), false, "同 host/其它 source_id 即使 channel 是 rss-ifanr 也是 false");
  assert.equal(fn({ source_id: "web" }), false, "非 ifanr source_id 为 false");
});

test("无写库语句、markdownAvailable 门未放宽", () => {
  assert.ok(!/\b(INSERT INTO|UPDATE\s+\S+\s+SET|DELETE FROM)\b/i.test(src), "detail.ts 不得含写库语句");
  assert.ok(
    src.includes('return !!row.summary || (row.body_mode === "full" && ((row.channel === "x" && !!row.x_post?.text) || !!row.body_html));'),
    "markdownAvailable 判定保持原样",
  );
});
