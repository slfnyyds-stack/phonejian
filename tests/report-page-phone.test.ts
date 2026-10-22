// 日报页面手机语义静态契约：三个路由文件不得残留 AI 旧文案，空态诚实，subject 来自 SITE。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = [
  "apps/web/app/routes/report-latest.tsx",
  "apps/web/app/routes/report-detail.tsx",
  "apps/web/app/routes/daily-archive.tsx",
] as const;

const EMPTY_LATEST = "今天还没有生成日报。日报从当日精选文章自动生成，当前精选文章不足或尚未到生成时间。";
const EMPTY_ARCHIVE = "还没有历史日报";

const read = (p: string) => readFileSync(p, "utf8");

test("页面无 AI 旧文案", () => {
  for (const p of FILES) {
    const src = read(p);
    assert.ok(!/AI/.test(src), `${p} 仍包含 AI 字样`);
  }
});

test("无日报空态文案存在且诚实", () => {
  const latest = read(FILES[0]);
  assert.ok(latest.includes(EMPTY_LATEST), "report-latest 缺少空态文案");
  const archive = read(FILES[2]);
  assert.ok(archive.includes(EMPTY_ARCHIVE), "daily-archive 缺少空态文案");
});

test("不硬编码日期或假条数", () => {
  for (const p of FILES) {
    const src = read(p);
    assert.ok(!/202[0-9]/.test(src), `${p} 硬编码了年份`);
    assert.ok(!/\d+ 期/.test(src.replace(/\{[^}]*\}/g, "")), `${p} 硬编码了期数`);
    assert.ok(!/每天 08:00/.test(src), `${p} 硬编码了出刊时间`);
  }
});

test("subject 来自 SITE，不写死「手机日报」", () => {
  for (const p of FILES) {
    const src = read(p);
    assert.ok(src.includes('@aihot/industry/site'), `${p} 未引用 SITE`);
    assert.ok(!src.includes("手机日报") && !src.includes("手机周报") && !src.includes("手机月报"), `${p} 硬编码了 subject 前缀`);
    assert.ok(/withSubject\(/.test(src), `${p} 未使用 withSubject 拼接行业词`);
  }
});
