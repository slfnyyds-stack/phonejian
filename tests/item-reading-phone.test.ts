import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../apps/web/app/routes/item.tsx", import.meta.url), "utf8");

/** Extract the substring of src between two unique anchors. */
function between(start: string, end: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `missing anchor: ${start}`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b >= 0, `missing anchor: ${end}`);
  return src.slice(a, b);
}

test("正文阅读区域有 reading-actions nav", () => {
  assert.match(src, /<nav data-reading-actions aria-label="阅读方式"[^>]*>/);
});

test("reading-actions 内外链主按钮：完整原文、新窗口、强调色", () => {
  const nav = between('<nav data-reading-actions aria-label="阅读方式"', "</nav>");
  assert.match(nav, /href=\{item\.links\.original\}/);
  assert.match(nav, /target="_blank"/);
  assert.match(nav, /rel="noopener noreferrer"/);
  assert.match(nav, /到来源网站阅读全文/, "无正文时主按钮文案");
  assert.match(nav, /查看来源原文/, "有正文时主按钮文案");
  assert.ok(!nav.includes("阅读完整原文"), "旧的固定文案应被两态文案替代");
  assert.match(nav, /bg-accent/);
  assert.match(nav, /text-accent-contrast/);
});

test("story 按钮仅在 story 且 publicId 非空时渲染", () => {
  const nav = between('<nav data-reading-actions aria-label="阅读方式"', "</nav>");
  assert.match(nav, /\{item\.story && item\.story\.publicId \? \(|item\.story\?\.publicId\)|item\.story && item\.story\.publicId && \(/);
  assert.match(nav, /to=\{`\/story\/\$\{item\.story\.publicId\}`\}|\/story\/\$\{item\.story\.publicId\}/);
  assert.match(nav, /查看事件详情/);
  assert.match(nav, /border-line-strong/);
});

test("导读头部：summaryOnly 为 站内摘要，否则 内容导读", () => {
  assert.match(src, /summaryOnly \? "站内摘要" : "内容导读"/);
  assert.ok(!src.includes('"AI 导读"'), "旧的 AI 导读 文案应被替换");
});

test("summary 段落字号缩到 16/17px、行高 1.8、间距 mt-4/mt-5", () => {
  const sec = between("item.summary && (", "</section>");
  assert.match(sec, /text-\[16px\]/);
  assert.match(sec, /lg:text-\[17px\]/);
  assert.match(sec, /leading-\[1\.8\]/);
  assert.match(sec, /mt-4|mt-5/);
  assert.ok(!/text-\[18px\]/.test(sec), "summary 不应再用 18px");
  assert.ok(!/text-\[20px\]/.test(sec), "summary 不应再用 20px");
  assert.ok(!/mt-7/.test(sec) && !/mt-8/.test(sec), "summary 区块间距应缩小");
});

test("h1 桌面字号 28/30，手机保持 26", () => {
  const h1 = between("<h1", "</h1>");
  assert.match(h1, /text-\[26px\]/);
  assert.match(h1, /lg:text-\[28px\]/);
  assert.match(h1, /xl:text-\[30px\]/);
  assert.ok(!/text-\[32px\]/.test(h1) && !/text-\[36px\]/.test(h1), "h1 桌面不应再用 32/36px");
});

test("summaryOnly 提示为中性准确文案", () => {
  assert.match(src, /本站展示摘要与来源链接。完整文章请到原文页面阅读。/);
  assert.ok(!src.includes("应来源方要求"), "不应再推断来源方要求");
});

test("note 回退分支删除：仅剩一条 data-reading-note 的 summaryOnly 提示", () => {
  assert.ok(!src.includes("!summaryOnly && !item.body"), "旧的 note 回退分支应删除");
  assert.ok(!src.includes("当前仅有导读，完整内容请阅读原文。"), "第二条重复提示应删除");
  const notes = src.match(/data-reading-note/g) ?? [];
  assert.equal(notes.length, 1, "全文件只应有一处 data-reading-note");
  const start = src.indexOf("data-reading-note");
  const end = src.indexOf("</p>", start);
  assert.match(src.slice(start, end), /本站展示摘要与来源链接。完整文章请到原文页面阅读。/);
});

test("summaryOnly 提示仅在 summaryOnly 时显示", () => {
  const note = between("本站展示摘要与来源链接", "</p>");
  assert.ok(note.length < 400, "提示段落应是独立的短段落");
});

test("正文全文逻辑保持：hasReadableBody 才走 prose", () => {
  assert.match(src, /hasReadableBody && \(/);
  assert.ok(!src.includes("item.body && bodyHtml && ("), "旧的 body 门控应删除");
  assert.match(src, /className="prose" dangerouslySetInnerHTML/);
});

test("推荐理由两处均按 item.reason 展示，不再被 summaryOnly 抑制", () => {
  assert.ok(!/item\.reason\s*&&\s*!summaryOnly/.test(src), "reason 不应再被 !summaryOnly 抑制");
  const gates = src.match(/\{item\.reason (?:&&|\?)/g) ?? [];
  assert.equal(gates.length, 2, "右 Rail 与 mobile 正文各一处 reason 条件");
});

test("原有能力保留：右栏 actions、手机 sticky 工具条、收藏分享相关报道", () => {
  assert.match(src, /StarButton item=\{item\}/);
  assert.match(src, /aria-label="分享"/);
  assert.match(src, /StoryFollowups/);
  assert.match(src, /relatedStories/);
  assert.match(src, /ArticleLayout/);
  assert.match(src, /lg:hidden/);
});

test("reading-actions 两按钮各一个，不伪造全文", () => {
  const nav = between('<nav data-reading-actions aria-label="阅读方式"', "</nav>");
  const hrefs = nav.match(/<(?:a|Link)\b/g)?.length ?? 0;
  assert.equal(hrefs, 2, "nav 内应恰好两个链接");
});
