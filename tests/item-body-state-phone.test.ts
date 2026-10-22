import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../apps/web/app/routes/item.tsx", import.meta.url), "utf8");

/** 从源码提取 `const name = <expr>;` 的纯表达式，用 new Function 真跑行为。 */
function exprOf(name: string, params: string[]): (...args: never[]) => unknown {
  const m = src.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(m, `源码缺少 const ${name} 声明`);
  return new Function(...params, `return ${m[1].trim()}`) as (...args: never[]) => unknown;
}

/** Extract the substring of src between two unique anchors. */
function between(start: string, end: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `missing anchor: ${start}`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b >= 0, `missing anchor: ${end}`);
  return src.slice(a, b);
}

test("hasReadableBody 行为：null/空/纯空白为 false，真实 HTML 为 true", () => {
  const f = exprOf("hasReadableBody", ["bodyHtml"]) as (bodyHtml: unknown) => boolean;
  assert.equal(f(null), false, "bodyHtml null 不算可读正文");
  assert.equal(f(undefined), false, "bodyHtml undefined 不算可读正文");
  assert.equal(f(""), false, "空串不算可读正文");
  assert.equal(f("  \n\t "), false, "纯空白不算可读正文");
  assert.equal(f("<p>正文</p>"), true, "真实 HTML 算可读正文");
  assert.equal(f("<p> </p>"), true, "含标签的 HTML 算可读正文");
});

test("summaryOnly 行为：full+无 body 是摘要，summary-only 是摘要，full+有 body 正常", () => {
  const f = exprOf("summaryOnly", ["item", "hasReadableBody"]) as (item: { readingMode: string }, hasReadableBody: boolean) => boolean;
  assert.equal(f({ readingMode: "full" }, false), true, "mode full 但无可读 body 仍按摘要处理");
  assert.equal(f({ readingMode: "summary-only" }, false), true, "summary-only 且无 body 是摘要");
  assert.equal(f({ readingMode: "summary-only" }, true), true, "summary-only 模式始终是摘要");
  assert.equal(f({ readingMode: "full" }, true), false, "full + 有可读 body 是正常正文");
});

test("声明就位：hasReadableBody 由 bodyHtml 判定，bodyLabel 与 summaryOnly 跟随它", () => {
  assert.match(src, /const hasReadableBody = !!bodyHtml\?\.trim\(\);/);
  assert.match(src, /const bodyLabel = !hasReadableBody \? null :/);
  assert.match(src, /const summaryOnly = item\.readingMode === "summary-only" \|\| !hasReadableBody;/);
  assert.ok(!/const bodyLabel = !item\.body \? null/.test(src), "bodyLabel 不应只看 item.body");
});

test("单一 reading note：data-reading-note 在 summaryOnly 提示上，无第二条重复提示", () => {
  const notes = src.match(/data-reading-note/g) ?? [];
  assert.equal(notes.length, 1, "全文件应只有一处 data-reading-note");
  const start = src.indexOf("data-reading-note");
  const end = src.indexOf("</p>", start);
  assert.ok(end > start, "reading note 应是段落");
  const block = src.slice(start, end);
  assert.match(block, /本站展示摘要与来源链接。完整文章请到原文页面阅读。/);
  assert.ok(block.length < 400, "提示段落应是独立的短段落");
  assert.ok(!src.includes("当前仅有导读，完整内容请阅读原文。"), "第二条重复导读提示应删除");
  assert.ok(!/!summaryOnly && !item\.body/.test(src), "旧的 note 回退分支应删除");
});

test("两处推荐理由只按 item.reason 展示，不再被 summaryOnly 抑制", () => {
  assert.ok(!/item\.reason\s*&&\s*!summaryOnly/.test(src), "reason 不应再被 !summaryOnly 抑制");
  assert.ok(!src.includes("item.reason && !summaryOnly"), "旧的 reason 抑制条件应删除");
  const gates = src.match(/\{item\.reason (?:&&|\?)/g) ?? [];
  assert.equal(gates.length, 2, "右 Rail 与 mobile 正文应各有一处 reason 条件");
  assert.ok(gates.includes("{item.reason &&"), "mobile 正文处直接按 item.reason 展示");
});

test("正文门控：hasReadableBody 才渲染，注入 bodyHtml??''，带 data-article-body", () => {
  assert.match(src, /\{hasReadableBody && \(/, "正文渲染应由 hasReadableBody 门控");
  assert.ok(!src.includes("item.body && bodyHtml && ("), "旧的 item.body && bodyHtml 门控应删除");
  assert.match(src, /data-article-body/, "正文 section 应带 data-article-body 供 HTTP 验收");
  assert.match(src, /!item\.body!\.complete && \(/, "译文完整性访问应为 item.body!.complete");
  assert.match(src, /className="prose" dangerouslySetInnerHTML=\{\{ __html: bodyHtml \?\? "" \}\}/);
  assert.ok(!src.includes("__html: item.summary"), "不能把摘要注入成正文");
  assert.ok(!/body:\s*(item\.)?summary/.test(src), "不能把摘要拼成 body");
});

test("原文链接保留 URL 属性与两态主按钮文案，事件按钮条件不变", () => {
  const nav = between('<nav data-reading-actions aria-label="阅读方式"', "</nav>");
  assert.match(nav, /href=\{item\.links\.original\}/);
  assert.match(nav, /target="_blank"/);
  assert.match(nav, /rel="noopener noreferrer"/);
  assert.match(nav, /到来源网站阅读全文/, "无正文主按钮文案");
  assert.match(nav, /查看来源原文/, "有正文主按钮文案");
  assert.ok(!nav.includes("阅读完整原文"), "旧的固定文案应被两态文案替代");
  assert.match(nav, /item\.story && item\.story\.publicId && \(/, "事件按钮条件保留");
  const links = nav.match(/<(?:a|Link)\b/g) ?? [];
  assert.equal(links.length, 2, "nav 内仍恰好两个链接");
  const hrefs = src.match(/href=\{item\.links\.original\}/g) ?? [];
  assert.ok(hrefs.length >= 4, "sticky 栏、actions、nav、来源行的原文链接都应保留");
});

test("页面骨架保留：loader/meta/headers、摘要标题、媒体收藏导出", () => {
  assert.match(src, /export async function loader\(/);
  assert.match(src, /export function meta\(/);
  assert.match(src, /export function headers\(\)/);
  assert.match(src, /summaryOnly \? "站内摘要" : "内容导读"/);
  assert.match(src, /<MediaGallery media=\{item\.x!\.media\}/);
  assert.match(src, /StarButton item=\{item\}/);
  assert.match(src, /markdownAvailable && \(/);
});
