// Structural contract tests for the reference shell: screenshot-style 180px left
// navigation (Sidebar) plus a wide right main column. Like the other *-phone tests
// these read root.tsx as source text on purpose: node --test must run without a
// bundler, and the contract is about the source implementing these rules.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "apps", "web", "app");
const root = readFileSync(join(appDir, "root.tsx"), "utf8");
const shell = root.slice(root.indexOf("function SiteShell"));

test("root imports the shared Sidebar and renders it with changelogVersion", () => {
  assert.match(root, /import \{ Sidebar \} from "\.\/components\/shell\/Sidebar";/,
    "root must import Sidebar from ./components/shell/Sidebar");
  assert.match(shell, /<Sidebar changelogVersion=\{changelogVersion\} \/>/,
    "SiteShell must render <Sidebar changelogVersion={changelogVersion} /> exactly once");
  assert.equal((shell.match(/<Sidebar\b/g) ?? []).length, 1,
    "no hand-written second sidebar next to the shared one");
});

test("site wrapper is the phone-reference-site flex shell, not editorial-site", () => {
  assert.match(root, /<div className="phone-reference-site flex min-h-dvh">/,
    "SiteShell outer div must be phone-reference-site flex min-h-dvh");
  assert.ok(!/editorial-site/.test(root), "the editorial-site wrapper class must be gone");
  assert.ok(!/editorial-layout/.test(root), "the editorial-layout grid container must be gone");
  assert.ok(!/editorial-main/.test(root), "the editorial-main grid cell must be gone");
});

test("no EditorialRail render (module file stays on disk) and no MobileTabBar", () => {
  assert.ok(!/EditorialRail/.test(root), "the EditorialRail import and <EditorialRail /> must be removed from root.tsx");
  assert.ok(existsSync(join(appDir, "components", "shell", "EditorialRail.tsx"))
    || existsSync(join(appDir, "components", "shell", "EditorialRail.ts")),
    "the EditorialRail module itself must not be deleted");
  assert.ok(!/MobileTabBar/.test(root), "phones keep no fixed bottom app bar in this step");
});

test("phone top nav is kept but hidden on desktop, with all 7 links and active state", () => {
  assert.match(shell, /<header className="editorial-header lg:hidden">/,
    "the existing header must stay as the phone-only top nav (lg:hidden)");
  assert.match(shell, /const activeNav =/, "activeNav derivation must be preserved");
  assert.match(shell, /activeLinkRef/, "the active-link ref must be preserved");
  assert.match(shell, /scrollIntoView\(\{ block: "nearest", inline: "nearest", behavior: "auto" \}\)/,
    "the scroll-into-view effect must be preserved");
  const navList = shell.match(/\[\["\/all"[\s\S]*?\]\]/)?.[0] ?? "";
  assert.equal((navList.match(/\["\//g) ?? []).length, 7, "the 7 nav links must all remain");
});

test("main is one wide overflow-safe column behind a min-w-0 flex-1 right side", () => {
  assert.match(shell, /<div className="min-w-0 flex-1">/, "right side wrapper must be min-w-0 flex-1");
  assert.match(shell, /<main id="main" className="min-w-0 px-4 pb-12 pt-4 lg:px-7 lg:pt-6">/,
    "main must be id=main with the wide padding classes");
  assert.match(shell, /className="mx-auto w-full min-w-0 max-w-\[640px\] lg:max-w-\[var\(--page-max-wide\)\]"/,
    "inner container: 640px on phones, --page-max-wide on desktop");
  assert.match(shell, /<\/main>[\s\S]*?<footer className="min-w-0 border-t border-line px-4 py-5 lg:px-7 flex flex-wrap gap-4 text-xs text-ink-3">/,
    "footer sits after main inside the right side, with the agreed classes");
  assert.match(shell, /<footer[^>]*>[\s\S]*?\{SITE\.name\} · 记录手机行业的变化[\s\S]*?\/feed\/all\.xml[\s\S]*?\/feedback/,
    "footer keeps its brand span and both links");
});

test("loader, Layout, theme boot, meta, admin bypass and ErrorBoundary stay intact", () => {
  assert.match(root, /export const links: Route\.LinksFunction/, "links must be preserved");
  assert.match(root, /export async function loader\(\{ request \}: Route\.LoaderArgs\)/, "loader signature preserved");
  assert.match(root, /apiGet<SiteMeta>\("\/api\/site\/meta"/, "loader still fetches /api/site/meta");
  assert.match(root, /export const shouldRevalidate: ShouldRevalidateFunction = \(\) => false;/,
    "shouldRevalidate preserved");
  assert.match(root, /export function Layout\(\{ children \}: \{ children: React\.ReactNode \}\)/, "Layout preserved");
  assert.match(root, /THEME_BOOT_SCRIPT/, "theme boot script preserved");
  assert.match(root, /ScrollRestoration getKey=\{\(location\) => location\.key\}/, "ScrollRestoration preserved");
  assert.match(root, /export function meta\(\{ error \}: Route\.MetaArgs\)/, "meta preserved");
  assert.match(root, /export function ErrorBoundary\(\)/, "ErrorBoundary preserved");
  assert.match(root, /pathname === "\/admin" \|\| pathname\.startsWith\("\/admin\/"\)/,
    "admin keeps bypassing the shell");
  assert.match(root, /<NavigationProgress active=\{navigation\.state === "loading"\} \/>/, "NavigationProgress kept");
  assert.match(root, /href="#main"/, "skip-to-content link kept");
  assert.match(root, /<BackToTop \/>/, "BackToTop kept");
  assert.match(root, /useHydratedFlag\(\)/, "hydration flag call in App kept");
});
