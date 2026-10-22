import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("../packages/backend/src/publication/publish.ts", import.meta.url),
  "utf8",
);

test("imports ifanrLicensedBody, ArticleRow fields, initial SELECT", () => {
  assert.match(src, /import\s+(?:type\s+)?\{[^}]*\bifanrLicensedBody\b/);
  assert.match(src, /interface\s+ArticleRow\s*\{[^}]*\bauthor:\s*string\s*\|\s*null\b/);
  assert.match(src, /interface\s+ArticleRow\s*\{[^}]*\bbody_html:\s*string\s*\|\s*null\b/);
  const columns = src.match(/SELECT\s+id,\s*source_id,[\s\S]*?FROM articles WHERE/)?.[0] ?? "";
  assert.match(columns, /\bauthor\b/);
  assert.match(columns, /\bbody_html\b/);
});

test("reviewedBody gate picks bodyModeOf with original article fields", () => {
  assert.match(src, /source\.id\s*!==\s*["']rss-ifanr["']\s*\|\|\s*!!ifanrLicensedBody/);
  assert.match(src, /reviewedBody\s*\?\s*bodyModeOf\([\s\S]*?\)\s*:\s*["']summary["']/);
  const calls = [...src.matchAll(/ifanrLicensedBody\(([\s\S]*?)\)/g)].map((m) => m[1] ?? "");
  const wanted = ["article.id", "article.url", "article.author", "article.body_html"];
  assert.ok(calls.some((a) => wanted.every((f) => a.includes(f))), "licence helper must get article.id/url/author/body_html");
});

test("syndicate keeps mayRedistribute; pool_search gated on full body", () => {
  assert.match(src, /mayRedistribute\(\s*source\s*,\s*bodyMode\s*\)/);
  const at = src.indexOf("// The pool search row");
  assert.notEqual(at, -1, "pool_search missing");
  const block = src.slice(at, at + 500);
  assert.match(block, /bodyMode\s*===\s*["']full["']/);
  assert.match(block, /article\.body_text/);
  assert.match(block, /["']{2}/, "non-full mode must fall back to empty string");
});
