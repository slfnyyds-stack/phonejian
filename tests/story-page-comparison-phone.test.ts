// 事件详情页「来源对照」源码契约：只读 story.tsx 文本，不渲染 JSX（避免 Node 解析 JSX）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupStoryReports } from "../apps/web/app/features/story/report-comparison.ts";
import type { SourceRef, StoryFactView, StoryReportView } from "@aihot/contracts/site";

const PAGE = "apps/web/app/routes/story.tsx";
const read = (p: string) => readFileSync(p, "utf8");

// 允许元素在 class 之外携带其他属性（title/dateTime/href 等），按属性出现再判定。
const tagWith = (src: string, tag: string, marker: string): boolean => {
  const re = new RegExp(`<${tag}\\b[^>]*`, "g");
  for (const m of src.matchAll(re)) if (m[0].includes(marker)) return true;
  return false;
};

test("SECTIONS 增加 comparison 锚点，两种导航路径都在 overview 与 reports 之间", () => {
  const src = read(PAGE);
  assert.match(src, /comparison:\s*"event-comparison"/);
  const observed = src.match(/observed\s*\?\s*\[[^\]]*\]\s*:\s*\[[^\]]*\]/);
  assert.ok(observed, "缺少 observed 分支的 sectionKeys");
  const keys = observed[0];
  assert.ok(keys.indexOf('"overview"') < keys.indexOf('"comparison"'), "comparison 应在 overview 之后");
  assert.ok(keys.indexOf('"comparison"') < keys.indexOf('"reports"'), "comparison 应在 reports 之前");
  const tabs = src.match(/items=\{[\s\S]*?\]\}/);
  assert.ok(tabs, "缺少 PillTabs items");
  assert.match(tabs[0], /key:\s*"comparison",\s*label:\s*"来源对照"/);
  assert.ok(tabs[0].indexOf('"overview"') < tabs[0].indexOf('"comparison"'), "导航 overview 在前");
  assert.ok(tabs[0].indexOf('"comparison"') < tabs[0].indexOf('"reports"'), "导航 comparison 在 reports 前");
});

test("使用 helper 且以 useMemo 包裹，统计取自组而非 story.sourceCount", () => {
  const src = read(PAGE);
  assert.match(src, /import\s*\{\s*groupStoryReports\s*\}\s*from\s*"\.\.\/features\/story\/report-comparison"/);
  assert.match(src, /useMemo\(\(\)\s*=>\s*groupStoryReports\(story\.timeline,\s*story\.developments\)/);
  assert.match(src, /comparedReportCount/);
  assert.match(src, /comparedSourceCount/);
  const cov = src.match(/<p\b[^>]*data-comparison-coverage[^>]*>[\s\S]*?<\/p>/);
  assert.ok(cov, "缺少 coverage 文案");
  assert.ok(cov[0].includes("comparedReportCount") && cov[0].includes("comparedSourceCount"));
  assert.ok(cov[0].includes("story.reportCount") && cov[0].includes("story.sourceCount"), "coverage 需并列事件总数");
  const panel = src.match(/id=\{SECTIONS\.comparison\}[\s\S]{0,600}order-4/);
  assert.ok(panel, "comparison Panel 应带 order-4");
});

test("Panel 内有诚实提示与不夸大措辞", () => {
  const src = read(PAGE);
  assert.ok(src.includes("按已有事件归组排列报道，便于比较各来源的表述；多家报道不等于事实已核验。"));
  assert.ok(src.includes("暂无可对照的报道。"));
  assert.ok(!src.includes("共同事实") && !src.includes("差异结论"), "不得生成共同事实/差异结论");
  assert.ok(!src.includes("dangerouslySetInnerHTML"));
});

test("分组、文章、原文本链接的语义结构", () => {
  const src = read(PAGE);
  assert.match(src, /data-comparison-group=\{group\.key\}/);
  assert.match(src, /data-comparison-report=\{r\.id\}/);
  assert.match(src, /data-comparison-original/);
  const link = src.match(/<a\b[^>]*data-comparison-original[^>]*>[\s\S]*?<\/a>/);
  assert.ok(link, "缺少原文链接");
  assert.ok(/target="_blank"/.test(link[0]) && /rel="noopener noreferrer"/.test(link[0]), "原文外链需安全属性");
  assert.ok(link[0].includes("阅读原文"));
  // 文章标题走 ReactRouter Link（to=/items/…），不得写成 <a href="/items
  assert.ok(tagWith(src, "Link", "to={`/items/${r.id}`}"), "标题应使用 Link 内部路由");
  assert.ok(!/<a\s[^>]*href="\/items\//.test(src), "不得用 <a> 做站内路由");
});

test("来源/时间/摘要的语义分支", () => {
  const src = read(PAGE);
  assert.match(src, /firstParty\s*\?\s*"官方一手"\s*:\s*"非官方来源"/);
  assert.ok(src.includes("时间未提供"), "无效日期需显示『时间未提供』");
  assert.ok(src.includes("暂无摘要，请阅读原文。"), "无摘要文案");
  assert.match(src, /break-words/);
  assert.match(src, /monthDayTime\(r\.publishedAt\)/);
  assert.ok(!/summary\.slice\(/.test(src), "对照摘要不应裁切");
});

test("布局：单列手机、桌面两列；既有功能保留", () => {
  const src = read(PAGE);
  const comparisonGrid = src.match(/className="([^"]*grid-cols-1[^"]*)"/)?.[1].split(/\s+/) ?? [];
  for (const token of ["grid", "grid-cols-1", "xl:grid-cols-2", "gap-3"]) assert.ok(comparisonGrid.includes(token), `缺少对照布局 ${token}`);
  assert.match(src, /lg:text-\[30px\]/, "桌面 h1 应为 30px");
  assert.ok(src.includes('text-[27px]'), "手机 h1 27px 保留");
  assert.match(src, /className="order-5"/, "时间线 order-5");
  assert.match(src, /className="order-6"/, "热度 order-6");
  assert.match(src, /className="order-7"/, "相关 order-7");
  assert.match(src, /className="order-3"/, "事件进展 order-3");
  assert.match(src, /aside className="order-2/);
  assert.match(src, /SECTIONS\.heat/, "热度锚点保留");
  assert.match(src, /HeatChart points=\{story\.heat\}/);
  assert.match(src, /layoutId="story-report-filter"/, "时间线筛选保留");
  assert.match(src, /story\.related\.length > 0 &&\s*\(\s*<Panel title="关联事件"/s, "相关事件保留");
  assert.match(src, /export async function loader/, "loader 保留");
  assert.match(src, /showOfficial/, "官方筛选联动保留");
});

// —— helper 真实行为抽验（subset 计数语义）——
function srcRef(id: string, firstParty = false): SourceRef {
  return { id, name: `来源 ${id}`, kind: "rss", firstParty, iconUrl: null };
}
function report(o: Partial<StoryReportView> & { id: string }): StoryReportView {
  return {
    title: `标题 ${o.id}`,
    summary: `${o.id} 的摘要文本`,
    source: srcRef(`s-${o.id}`),
    publishedAt: "2026-01-01T00:00:00Z",
    originalUrl: `https://example.com/${o.id}`,
    selected: false,
    factId: "",
    ...o,
  } as StoryReportView;
}
function fact(factId: string): StoryFactView {
  return { factId, title: `事实 ${factId}`, occurredAt: null, firstReportAt: "2026-01-01T00:00:00Z", reportCount: 2, representative: report({ id: `rep-${factId}`, factId }) };
}

test("真实 subset：计数来自传入 timeline，不等于事件总数", () => {
  const groups = groupStoryReports([report({ id: "a", factId: "f1", source: srcRef("s1") }), report({ id: "b", factId: "f1", source: srcRef("s2") }), report({ id: "c", source: srcRef("s1") })], [fact("f1")]);
  const reportCount = groups.reduce((n, g) => n + g.reportCount, 0);
  const sourceCount = new Set(groups.flatMap((g) => g.reports.map((r) => r.source.id))).size;
  assert.equal(reportCount, 3);
  assert.equal(sourceCount, 2);
  // 与页面上 story.reportCount/story.sourceCount 的总量无关（subset 语义）。
  assert.ok(reportCount <= 3 && sourceCount <= 2);
});

test("执行页面实际 URL 判定：拒绝坏链接，保留合法原文标识", () => {
  const expression = read(PAGE).match(/const safeUrl = (\(\(\) => \{[\s\S]*?\}\)\(\));/)?.[1];
  assert.ok(expression, "缺少独立可验的 URL 校验表达式");
  // 只执行项目页面中此无副作用表达式，不导入 JSX、不调用网络。
  const check = new Function("r", `return ${expression};`) as (r: { originalUrl: string }) => string | null;
  for (const value of ["", "https://", "http://", "javascript:alert(1)", "data:text/html,test", "/relative", " https://example.com/", "https://example.com/path with space"]) {
    assert.equal(check({ originalUrl: value }), null, `不应接受 ${value}`);
  }
  for (const value of ["https://example.com/a?x=1#section", "http://example.com/a", "HTTPS://example.com/a"]) {
    assert.equal(check({ originalUrl: value }), value, "合法原文 URL 必须原样保留");
  }
});
