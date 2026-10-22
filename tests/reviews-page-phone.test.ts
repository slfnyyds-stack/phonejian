// Structural contract tests for the 评测 aggregation page (方案A).
// Static source assertions like the other *-phone tests: node --test must run
// without a bundler, so we read the source files as text.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routes = readFileSync(join(here, "..", "apps", "web", "app", "routes.ts"), "utf8");
const reviews = readFileSync(join(here, "..", "apps", "web", "app", "routes", "reviews.tsx"), "utf8");
const root = readFileSync(join(here, "..", "apps", "web", "app", "root.tsx"), "utf8");

test("route table registers /reviews", () => {
  assert.match(routes, /route\(\s*"reviews"\s*,\s*"routes\/reviews\.tsx"\s*\)/,
    "routes.ts must register the /reviews route");
});

test("reviews page is locked to category=comparison and reuses the pool API", () => {
  assert.match(reviews, /const CATEGORY\s*=\s*"comparison"/, "reviews must define CATEGORY = comparison");
  assert.match(reviews, /category:\s*CATEGORY/, "loader must request category=comparison");
  assert.match(reviews, /\/api\/site\/pool/, "reviews must use the same pool endpoint as /all");
});

test("root.tsx top nav includes /reviews and activeNav owns it", () => {
  assert.match(root, /\["\/reviews","评测"\]/, "nav items must contain [/reviews, 评测]");
  assert.match(root, /pathname\s*===\s*"\/reviews"\s*\?\s*"评测"/,
    "activeNav must map /reviews to 评测");
  // 资讯 comes before 评测 in the nav list.
  const navList = root.match(/\[\["\/all","资讯"[\s\S]*?\]\]/)?.[0] ?? "";
  assert.ok(navList.includes('"/reviews","评测"') && navList.indexOf('"/all","资讯"') < navList.indexOf('"/reviews","评测"'),
    "评测 must sit right after 资讯 in the nav list");
});

test("empty state copy exists and no counts are hardcoded", () => {
  assert.match(reviews, /暂无评测内容。评测会随实测与对比类文章入库自动出现。/,
    "empty state must use the agreed copy");
  // No invented totals: page must not render a literal item count like "共 N 条".
  assert.ok(!/共\s*\d+\s*条|精选\s*\d+|\d+\s*篇评测/.test(reviews), "no hardcoded review counts");
});
