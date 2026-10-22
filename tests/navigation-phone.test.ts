// Structural contract tests for the site-top-navigation current-section state.
// They read apps/web/app/root.tsx as source text on purpose: node --test must run
// without a bundler, and the contract is about the source implementing these rules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = readFileSync(join(here, "..", "apps", "web", "app", "root.tsx"), "utf8");

test("SiteShell reads the current pathname from useLocation", () => {
  assert.match(root, /function SiteShell[\s\S]*useLocation\(\)/, "SiteShell must call useLocation()");
  const shell = root.slice(root.indexOf("function SiteShell"));
  assert.match(shell, /pathname/, "SiteShell must derive the active section from pathname");
});

test("active-section matcher: root path is exact match only (精选)", () => {
  assert.match(root, /pathname\s*===?\s*"\/"(?!\s*\|\|\s*pathname\.startsWith)/,
    '精选 must match only the exact "/" path, not every prefix');
});

test("active-section matcher: section routing covers list and detail pages", () => {
  // 资讯: /all + /items/
  assert.match(root, /\/all/, "资讯 anchor exists");
  assert.match(root, /startsWith\("\/items\/"\)/, "资讯 must own item detail pages /items/*");
  // 热点: /hot + /story/
  assert.match(root, /startsWith\("\/story\/"\)/, "热点 must own story detail pages /story/*");
  // 日报: /daily + /weekly + /monthly
  assert.match(root, /\/daily[\s\S]*?\/weekly[\s\S]*?\/monthly/, "日报 must cover daily, weekly and monthly");
  // 主题: /topics + /topic/
  assert.match(root, /startsWith\("\/topic\/"\)/, "主题 must own topic detail pages /topic/*");
});

test("active link exposes aria-current=page and a non-color highlight", () => {
  assert.match(root, /aria-current=\{[^}]*"page"[^}]*\}|aria-current="page"/,
    "the active nav link must set aria-current=page");
  // non-color cue: visible text weight or underline (border-b / underline)
  const hasWeight = /font-semibold|font-bold/.test(root);
  const hasUnderline = /underline|border-b-/.test(root);
  assert.ok(hasWeight || hasUnderline, "active link must be highlighted beyond color alone");
});

test("phone visibility: active link scrolls into view without page jumps or animation", () => {
  assert.match(root, /scrollIntoView\(\s*\{\s*block:\s*"nearest"\s*,\s*inline:\s*"nearest"/,
    "active nav link must scrollIntoView with block/inline nearest");
  // Reduced motion is respected by never animating: no "smooth" scrolling anywhere.
  assert.ok(!/behavior:\s*"smooth"/.test(root) && !/scrollIntoView\(\{\}\)/.test(root),
    "no animated scrolling; behavior must stay auto/omitted");
  // Only the top nav gets this treatment: the ref/effect lives inside SiteShell.
  const shell = root.slice(root.indexOf("function SiteShell"));
  assert.match(shell, /scrollIntoView/, "scrollIntoView must be scoped to the SiteShell top nav");
});

test("active-section behavior: 日报 owns its detail and archive paths, near-miss paths do not", () => {
  const marker = "const activeNav =";
  const at = root.indexOf(marker);
  assert.ok(at >= 0, "SiteShell must declare const activeNav");
  const body = root.slice(at + marker.length);
  const expr = body.slice(0, body.indexOf(";"));
  assert.ok(expr.trim().length > 0, "the activeNav expression must be non-empty");
  const activeNav = new Function("pathname", "return (" + expr + ");") as (pathname: string) => string | null;
  // Detail pages and the archive keep the 日报 highlight.
  for (const p of ["/daily", "/daily/2026-10-13", "/daily/archive", "/weekly/2026-W42", "/monthly/2026-10"]) {
    assert.equal(activeNav(p), "日报", `${p} must keep the 日报 highlight`);
  }
  // A prefix match must not swallow lookalike paths.
  for (const p of ["/dailyfoo", "/weeklyfoo", "/monthlyfoo"]) {
    assert.equal(activeNav(p), null, `${p} must match no section`);
  }
});
