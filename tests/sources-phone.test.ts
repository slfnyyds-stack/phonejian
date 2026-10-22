// 信源试点（手机行业）：sources.json 里只有 rss-apple-newsroom-cn 一个信源，且配置符合第八步要求。
// 纯文件级校验：读 industry/sources.json，不触库、不联网。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

interface Source {
  id: string;
  name: string;
  kind: string;
  config: Record<string, unknown>;
  tier?: string;
  first_party?: boolean;
  owner_entity_id?: string | null;
  participation_mode?: string;
  interval_minutes?: number;
  tags?: string[];
  site_fulltext?: boolean;
  syndicate_fulltext?: boolean;
}

const file = path.join(import.meta.dirname, "..", "industry", "sources.json");
const { sources } = JSON.parse(readFileSync(file, "utf8")) as { sources: Source[] };

test("信源列表共 14 个信源", () => {
  assert.equal(sources.length, 14, `期望 7 个既有信源加 7 个国际信源共 14 个，实际 ${sources.length} 个`);
});

const s = sources[0]!;

test("id 与 kind 正确", () => {
  assert.equal(s.id, "rss-apple-newsroom-cn");
  assert.equal(s.kind, "rss");
});

test("名称与 tier / first_party / owner / 模式正确", () => {
  assert.equal(s.name, "Apple Newsroom（中国大陆）");
  assert.equal(s.tier, "T1");
  assert.equal(s.first_party, true);
  assert.equal(s.owner_entity_id, "apple");
  assert.equal(s.participation_mode, "editorial");
});

test("feedUrl、间隔、标签与全文开关正确", () => {
  assert.equal(s.config.feedUrl, "https://www.apple.com.cn/newsroom/rss-feed.rss");
  assert.equal(s.interval_minutes, 120);
  assert.deepEqual(s.tags, ["官方"]);
  assert.equal(s.site_fulltext, false);
  assert.equal(s.syndicate_fulltext, false);
});

test("config 含 _aihot.initialBackfillLimit=3", () => {
  assert.equal((s.config._aihot as Record<string, unknown>)?.initialBackfillLimit, 3);
});

test("无旧 AI 示范信源残留", () => {
  const old = sources.filter((x) => /^(rss-openai|rss-anthropic|rss-deepmind|demo-)/.test(x.id) || (x.config.feedUrl as string | undefined)?.includes("openai.com"));
  assert.deepEqual(old, []);
});

// ---- 第九步：电信誉源扩充 ----

const EXPECTED: Record<string, string> = {
  "rss-apple-newsroom-cn": "https://www.apple.com.cn/newsroom/rss-feed.rss",
  "rss-ithome": "https://www.ithome.com/rss",
  "rss-sspai": "https://sspai.com/feed",
  "rss-ifanr": "https://www.ifanr.com/feed",
  "rss-geekpark": "https://www.geekpark.net/rss",
  "rss-mi-ir": "https://ir.mi.com/rss.xml",
  "rss-leikeji": "https://www.leikeji.com/rss",
  "rss-gsmarena": "https://www.gsmarena.com/rss-news-reviews.php3",
  "rss-9to5mac": "https://9to5mac.com/feed/",
  "rss-macrumors": "https://feeds.macrumors.com/macrumors_all",
  "rss-androidauthority": "https://www.androidauthority.com/feed/",
  "rss-androidcentral": "https://www.androidcentral.com/feed",
  "rss-theverge": "https://www.theverge.com/rss/index.xml",
  "rss-samsung-newsroom-global": "https://news.samsung.com/global/feed",
};
const MEDIA_IDS = ["rss-ithome", "rss-sspai", "rss-ifanr", "rss-geekpark", "rss-leikeji"];

test("共 14 个信源且 id 唯一", () => {
  assert.equal(sources.length, 14, `期望 14 个信源，实际 ${sources.length} 个`);
  const ids = sources.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "信源 id 存在重复");
  assert.deepEqual(ids.sort(), Object.keys(EXPECTED).sort());
});

test("每条 feedUrl 与清单一致且非空", () => {
  for (const s of sources) {
    const url = s.config.feedUrl as string | undefined;
    assert.ok(typeof url === "string" && url.length > 0, `${s.id} feedUrl 非空`);
    assert.equal(url, EXPECTED[s.id], `${s.id} feedUrl 不符`);
  }
});

test("小米与三星为一手信源，媒体条为一手=false", () => {
  const mi = sources.find((x) => x.id === "rss-mi-ir")!;
  assert.equal(mi.first_party, true);
  assert.equal(mi.owner_entity_id, "xiaomi");
  assert.equal(mi.tier, "T1");
  const samsung = sources.find((x) => x.id === "rss-samsung-newsroom-global")!;
  assert.equal(samsung.first_party, true, "三星应为一手信源");
  assert.equal(samsung.owner_entity_id, "samsung");
  assert.equal(samsung.tier, "T1");
  for (const id of MEDIA_IDS) {
    const m = sources.find((x) => x.id === id)!;
    assert.equal(m.first_party, false, `${id} 应为媒体（first_party=false）`);
    assert.equal(m.tier, "T2", `${id} 应为 T2`);
  }
  for (const id of ["rss-gsmarena", "rss-9to5mac", "rss-macrumors", "rss-androidauthority", "rss-androidcentral", "rss-theverge"]) {
    const m = sources.find((x) => x.id === id)!;
    assert.equal(m.first_party, false, `${id} 应为媒体（first_party=false）`);
    assert.equal(m.tier, "T2", `${id} 应为 T2`);
  }
});

test("仅 rss-ifanr site_fulltext=true，其余 13 源仍为 false", () => {
  const ifanr = sources.find((x) => x.id === "rss-ifanr");
  assert.ok(ifanr, "缺少 rss-ifanr");
  assert.equal(ifanr.site_fulltext, true, "rss-ifanr site_fulltext 应为 true");
  for (const s of sources) {
    if (s.id === "rss-ifanr") continue;
    assert.equal(s.site_fulltext, false, `${s.id} site_fulltext 应为 false`);
  }
});

test("所有 14 个信源 syndicate_fulltext=false", () => {
  assert.equal(sources.length, 14, `期望 14 个信源，实际 ${sources.length} 个`);
  for (const s of sources) assert.equal(s.syndicate_fulltext, false, `${s.id} syndicate_fulltext 应为 false`);
});

test("新增信源 kind=rss、模式、间隔与 backfillLimit", () => {
  for (const s of sources) {
    if (s.id === "rss-apple-newsroom-cn") continue; // 试点信源由上面既有断言覆盖
    const expectedInterval = ["rss-gsmarena", "rss-9to5mac", "rss-macrumors", "rss-androidauthority", "rss-androidcentral", "rss-theverge", "rss-samsung-newsroom-global"].includes(s.id) ? 180 : 120;
    assert.equal(s.kind, "rss", `${s.id} kind`);
    assert.equal(s.participation_mode, "editorial", `${s.id} participation_mode`);
    assert.equal(s.interval_minutes, expectedInterval, `${s.id} interval_minutes`);
    assert.equal((s.config._aihot as Record<string, unknown>)?.initialBackfillLimit, 5, `${s.id} initialBackfillLimit`);
  }
});
