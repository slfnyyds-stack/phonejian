// Contract tests for the desktop sidebar nav (apps/web/app/components/shell/nav.ts).
// They read nav.ts as source text and execute the real tabIsActive body via new Function:
// importing it would pull TSX icons and workspace packages that node --test cannot resolve.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const nav = readFileSync(join(here, "..", "apps", "web", "app", "components", "shell", "nav.ts"), "utf8");

type NavStub = { to: string; end?: boolean };

// Pure function: MORE_PATHS from the source literal, plus the exported body with types erased.
const moreLiteral = nav.match(/export const MORE_PATHS = (\[[^;]+\]);/)?.[1] ?? "";
const body = nav
  .slice(nav.indexOf("export function tabIsActive"))
  .replace("export ", "")
  .replace("item: NavItem", "item")
  .replace("pathname: string", "pathname")
  .replace("): boolean", ")");
const tabIsActive = new Function(`const MORE_PATHS = ${moreLiteral};\n${body}\nreturn tabIsActive;`)() as (item: NavStub, pathname: string) => boolean;

const active = (to: string, pathname: string, end?: boolean) => tabIsActive({ to, end }, pathname);
const hits = (to: string, list: string[]) => list.filter((p) => active(to, p));

test("SIDEBAR adds /reviews 评测 once after /all, keeps labels and feature switches", () => {
  const sidebar = nav.slice(nav.indexOf("export const SIDEBAR"), nav.indexOf("export const TABBAR"));
  const found = sidebar.match(/\{ to: "\/reviews", label: "评测", icon: IconDoc \}/g) ?? [];
  assert.equal(found.length, 1, "exactly one /reviews entry");
  assert.ok(sidebar.indexOf('to: "/all"') < sidebar.indexOf('to: "/reviews"'), "/reviews must follow /all");
  for (const to of ["/", "/hot", "/daily", "/topics", "/starred", "/agent", "/about", "/changelog", "/feedback"]) {
    assert.ok(sidebar.includes(`to: "${to}"`), `existing entry ${to} kept`);
  }
  for (const label of ["精选", "热点榜", "主题", "收藏", "关于", "更新日志", "反馈", "模型榜", "Tibo重置监控"]) {
    assert.ok(sidebar.includes(label), `existing label ${label} kept`);
  }
  assert.match(sidebar, /FEATURES\.leaderboard \|\| FEATURES\.codexResetMonitor/, "feature gate kept");
});

test("home stays exact-match only", () => {
  assert.equal(active("/", "/", true), true);
  assert.equal(active("/", "/all", true), false);
  assert.equal(active("/all", "/all/x", true), false, "end wins over prefix");
});

test("detail ownership: /all owns /items/, /hot owns /story/, /topics owns /topic/", () => {
  const cases: Array<[string, string[], string[]]> = [
    ["/all", ["/all", "/all/page/2", "/items/abc", "/items/abc/original"], ["/items", "/items/", "/items-evil", "/item/abc", "/hot", "/story/abc"]],
    ["/hot", ["/hot", "/hot/week", "/story/abc", "/story/abc/comments"], ["/story", "/story/", "/story-evil", "/stories/abc", "/all", "/items/abc"]],
    ["/topics", ["/topics", "/topics/ai", "/topic/ai", "/topic/ai/page/2"], ["/topic", "/topic/", "/topic-evil", "/topics-ai", "/all", "/items/abc"]],
  ];
  for (const [to, yes, no] of cases) {
    for (const p of yes) assert.equal(active(to, p), true, `${to} must be active on ${p}`);
    for (const p of no) assert.equal(active(to, p), false, `${to} must stay inactive on ${p}`);
  }
});

test("日报 owns daily, weekly, monthly (with detail keys) and nothing else", () => {
  const yes = ["/daily", "/weekly", "/monthly", "/daily/2026-10-10", "/weekly/2026-w40", "/monthly/2026-09"];
  const no = ["/dailys", "/week", "/month", "/all", "/items/abc", "/hot"];
  assert.deepEqual(hits("/daily", yes), yes, "all three report kinds stay active");
  for (const p of no) assert.equal(active("/daily", p), false, `inactive on ${p}`);
});

test("/more keeps its existing path set", () => {
  const paths = ["/more", "/hot", "/topics", "/starred", "/leaderboard", "/codex-reset", "/agent", "/about", "/changelog", "/feedback", "/terms", "/privacy"];
  assert.deepEqual(hits("/more", [...paths, "/privacy/x", "/terms/y"]), [...paths, "/privacy/x", "/terms/y"]);
  assert.equal(active("/more", "/all"), false);
  assert.equal(active("/more", "/reviews"), false, "/reviews is not a 更-more page");
});

test("/reviews stays its own section and TABBAR is untouched", () => {
  assert.equal(active("/reviews", "/reviews"), true);
  assert.equal(active("/reviews", "/reviews/ai"), true);
  for (const p of ["/all", "/items/abc", "/topics", "/topic/ai", "/hot", "/story/abc", "/reviews-evil"]) {
    assert.equal(active("/reviews", p), false, `reviews must not grab ${p}`);
  }
  const tabbar = nav.slice(nav.indexOf("export const TABBAR"), nav.indexOf("/** Pages reached"));
  assert.deepEqual([...tabbar.matchAll(/to: "([^"]+)"/g)].map((m) => m[1]), ["/", "/all", "/daily", "/more"],
    "TABBAR keeps its four entries and gains no bottom-bar item");
  assert.equal((nav.match(/label: "评测"/g) ?? []).length, 1, "评测 appears only in the sidebar");
});
