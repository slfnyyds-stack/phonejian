// 纯函数单元测试。以下全部对象均为测试夹具数据，不对应任何真实站点或数据库记录。
import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoryReportView, StoryFactView, SourceRef } from "@aihot/contracts/site";
import { groupStoryReports } from "../apps/web/app/features/story/report-comparison.ts";

function src(id: string, name = `来源${id}`): SourceRef {
  return { id, name, kind: "rss", firstParty: false, iconUrl: null };
}

function report(overrides: Partial<StoryReportView> & { id: string }): StoryReportView {
  return {
    title: `标题 ${overrides.id}`,
    summary: null,
    source: src(overrides.id),
    publishedAt: "2026-01-01T00:00:00Z",
    originalUrl: `https://example.com/${overrides.id}`,
    selected: true,
    factId: "",
    ...overrides,
  } as StoryReportView;
}

function fact(overrides: Partial<StoryFactView> & { factId: string }): StoryFactView {
  return {
    title: `事实 ${overrides.factId}`,
    occurredAt: null,
    firstReportAt: "2026-01-01T00:00:00Z",
    reportCount: 1,
    representative: report({ id: `rep-${overrides.factId}`, factId: overrides.factId }),
    ...overrides,
  } as StoryFactView;
}

test("空输入返回空数组", () => {
  assert.deepEqual(groupStoryReports([], []), []);
});

test("没有 developments 也可分组", () => {
  const r = report({ id: "a", factId: "f1" });
  const groups = groupStoryReports([r], []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "fact:f1");
  assert.equal(groups[0].title, "标题 a");
});

test("按 article id 全局去重，保留首次出现", () => {
  const first = report({ id: "a", factId: "f1", title: "第一次" });
  const dup = report({ id: "a", factId: "f2", title: "第二次" });
  const groups = groupStoryReports([first, dup], []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].reports[0].title, "第一次");
  assert.equal(groups[0].reportCount, 1);
});

test("空 factId 每条独立成组，不混在一起", () => {
  const a = report({ id: "a", factId: "" });
  const b = report({ id: "b", factId: "" });
  const groups = groupStoryReports([a, b], []);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.key).sort(), ["report:a", "report:b"]);
});

test("developments 标题映射", () => {
  const r = report({ id: "a", factId: "f1" });
  const groups = groupStoryReports([r], [fact({ factId: "f1", title: "官方事实标题" })]);
  assert.equal(groups[0].title, "官方事实标题");
});

test("缺 development 回落到组内最新有效日期那篇的原 title", () => {
  const old = report({ id: "old", factId: "f1", publishedAt: "2026-01-01T00:00:00Z", title: "旧" });
  const newer = report({ id: "new", factId: "f1", publishedAt: "2026-02-01T00:00:00Z", title: "新" });
  const groups = groupStoryReports([old, newer], []);
  assert.equal(groups[0].title, "新");
});

test("组内按 publishedAt 降序，非法日期最后，同时间按 id 字典序", () => {
  const b = report({ id: "b", factId: "f1", publishedAt: "2026-01-02T00:00:00Z" });
  const a = report({ id: "a", factId: "f1", publishedAt: "2026-01-02T00:00:00Z" });
  const bad = report({ id: "z", factId: "f1", publishedAt: "不是日期" });
  const good = report({ id: "c", factId: "f1", publishedAt: "2026-01-05T00:00:00Z" });
  const groups = groupStoryReports([b, a, bad, good], []);
  assert.deepEqual(groups[0].reports.map((r) => r.id), ["c", "a", "b", "z"]);
  assert.equal(groups[0].latestAt, "2026-01-05T00:00:00Z");
});

test("同源多报 sourceCount 按 source.id 去重；同名不同 source.id 不合并", () => {
  const r1 = report({ id: "a", factId: "f1", source: src("s1", "同名") });
  const r2 = report({ id: "b", factId: "f1", source: src("s1", "同名") });
  const r3 = report({ id: "c", factId: "f1", source: src("s2", "同名") });
  const groups = groupStoryReports([r1, r2, r3], []);
  assert.equal(groups[0].sourceCount, 2);
  assert.equal(groups[0].reportCount, 3);
});

test("全部无效日期时 latestAt 为 null，组排最后", () => {
  const bad = report({ id: "a", factId: "f1", publishedAt: "???" });
  const good = report({ id: "b", factId: "f2", publishedAt: "2026-03-01T00:00:00Z" });
  const groups = groupStoryReports([bad, good], []);
  assert.equal(groups[0].key, "fact:f2");
  assert.equal(groups[1].key, "fact:f1");
  assert.equal(groups[1].latestAt, null);
});

test("组排序按最新时间降序，平手按 key 字典序", () => {
  const g1 = report({ id: "a", factId: "f1", publishedAt: "2026-01-01T00:00:00Z" });
  const g2 = report({ id: "b", factId: "f2", publishedAt: "2026-01-01T00:00:00Z" });
  const g3 = report({ id: "c", factId: "f3", publishedAt: "2026-02-01T00:00:00Z" });
  const groups = groupStoryReports([g1, g2, g3], []);
  assert.deepEqual(groups.map((g) => g.key), ["fact:f3", "fact:f1", "fact:f2"]);
});

test("多 fact 组与无效日期分组成员排最后", () => {
  const f1a = report({ id: "a", factId: "f1", publishedAt: "2026-01-01T00:00:00Z" });
  const f1bad = report({ id: "b", factId: "f1", publishedAt: "bad" });
  const f2 = report({ id: "c", factId: "f2", publishedAt: "2026-01-02T00:00:00Z" });
  const lone = report({ id: "d", factId: "", publishedAt: "2026-01-03T00:00:00Z" });
  const groups = groupStoryReports([f1a, f1bad, f2, lone], []);
  assert.equal(groups.length, 3);
  const f1 = groups.find((g) => g.key === "fact:f1")!;
  assert.deepEqual(f1.reports.map((r) => r.id), ["a", "b"]);
});

test("调用本身不修改输入数组、development 或 report 对象", () => {
  const r = report({ id: "a", factId: "f1", title: "原标题", publishedAt: "2026-01-01T00:00:00Z" });
  const dev = fact({ factId: "f1", title: "事实标题" });
  const input = [r];
  const before = JSON.stringify({ input, dev });
  groupStoryReports(input, [dev]);
  assert.equal(JSON.stringify({ input, dev }), before);
  // 结果保留原报告对象（契约要求），同一引用可回溯。
  const groups = groupStoryReports(input, [dev]);
  assert.equal(groups[0].reports[0], r);
});
