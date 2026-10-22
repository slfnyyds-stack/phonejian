// 爱范儿已审正文许可模块（packages/backend/src/publication/ifanr-license.ts）的手机行业试点测试。
// 纯函数：不触库、不联网、不启停服务。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IFANR_REVIEWED,
  ifanrLicensedBody,
  isReviewedIfanrArticle,
  renderIfanrTextOnly,
} from "@aihot/backend/publication/ifanr-license";

/** 与 notes/ifanr-license-review.json 一致的三条核查记录（代码内嵌，测试再对一次防止抄错）。 */
const REVIEWED = [
  {
    id: "qt7a01hdqri52un9tjcczbd2v",
    url: "https://www.ifanr.com/1682801?utm_source=rss&utm_medium=rss&utm_campaign=",
    author: "肖钦鹏",
    bodySha256: "877d01a092b6e832eb627beb4477536d3fb1571349451322a4581b3dd84657b0",
  },
  {
    id: "wvs62fdupk1cip4z2xu7jtjnt",
    url: "https://www.ifanr.com/1683596?utm_source=rss&utm_medium=rss&utm_campaign=",
    author: "张展毓",
    bodySha256: "eef64f3eb2217791759e6276154c1d0385b974a29eaf5a5de4af128f00a6d7c2",
  },
  {
    id: "feteodm6kbcqm5qsl8tjd5c0n",
    url: "https://www.ifanr.com/1684008?utm_source=rss&utm_medium=rss&utm_campaign=",
    author: "莫崇宇",
    bodySha256: "953add74e5470d5723704ee989c5b2caf367012f2557d91558016cf1e734f5b3",
  },
];

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

test("IFANR_REVIEWED 内嵌 3 条核查记录，hash 为 64 位小写 hex", () => {
  assert.equal(IFANR_REVIEWED.length, 3, "必须恰好 3 条已审记录");
  const picked = IFANR_REVIEWED.map((r) => ({ id: r.id, url: r.url, author: r.author, bodySha256: r.bodySha256 }));
  assert.deepEqual(picked, REVIEWED, "内嵌记录必须与核查 JSON 的 id/url/author/bodySha256 逐字一致");
  for (const r of REVIEWED) assert.match(r.bodySha256, /^[0-9a-f]{64}$/);
});

test("isReviewedIfanrArticle：3 条真实记录全部通过", () => {
  for (const r of REVIEWED) {
    assert.equal(
      isReviewedIfanrArticle({ articleId: r.id, url: r.url, author: r.author, bodySha256: r.bodySha256 }),
      true,
      `${r.id} 应判定为已审`,
    );
  }
});

test("isReviewedIfanrArticle：未知文章 / 换作者 / 换 URL / 换正文 hash 均 false", () => {
  const r = REVIEWED[0]!;
  assert.equal(isReviewedIfanrArticle({ articleId: "unknown-article-id", url: r.url, author: r.author, bodySha256: r.bodySha256 }), false, "未知 id 必须 false");
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: r.url, author: "别人", bodySha256: r.bodySha256 }), false, "换作者必须 false");
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: r.url, author: null, bodySha256: r.bodySha256 }), false, "作者 null 必须 false");
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: r.url, author: r.author, bodySha256: "0".repeat(64) }), false, "换 hash 必须 false");
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: r.url, author: r.author, bodySha256: r.bodySha256.slice(0, 63) + "z" }), false, "非法 hash 必须 false");
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: r.url, author: r.author, bodySha256: r.bodySha256.toUpperCase() }), false, "大写 hash 不算一致");
  // URL 变化（原样一致之外的形态一律 false）。
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: "https://www.ifanr.com/1682801", author: r.author, bodySha256: r.bodySha256 }), false, "去掉 query 必须 false");
  assert.equal(isReviewedIfanrArticle({ articleId: r.id, url: "http://www.ifanr.com/1682801?utm_source=rss&utm_medium=rss&utm_campaign=", author: r.author, bodySha256: r.bodySha256 }), false, "http 必须 false");
});

test("isReviewedIfanrArticle：恶意 host、无 www、非纯数字路径、credentials 一律 false", () => {
  const r = REVIEWED[0]!;
  const q = "?utm_source=rss&utm_medium=rss&utm_campaign=";
  const cases: Array<[string, string]> = [
    ["恶意 host（前缀相似域）", `https://www.ifanr.com.evil.example/1682801${q}`],
    ["恶意 host（IP）", `https://127.0.0.1/1682801${q}`],
    ["无 www 子域", `https://ifanr.com/1682801${q}`],
    ["换成别的子域", `https://m.ifanr.com/1682801${q}`],
    ["带端口", `https://www.ifanr.com:8443/1682801${q}`],
    ["非纯数字路径", `https://www.ifanr.com/1682801/edit${q}`],
    ["路径带前缀", `https://www.ifanr.com/a/1682801${q}`],
    ["credentials（user@）", `https://www.ifanr.com@evil.example/1682801${q}`],
    ["credentials（user:pass@）", `https://user:pass@www.ifanr.com/1682801${q}`],
    ["协议相对", `//www.ifanr.com/1682801${q}`],
    ["非 URL", "not a url"],
  ];
  for (const [label, url] of cases) {
    assert.equal(
      isReviewedIfanrArticle({ articleId: r.id, url, author: r.author, bodySha256: r.bodySha256 }),
      false,
      `${label} 必须 false`,
    );
  }
});

test("renderIfanrTextOnly：删除全部媒体与脚本，保留段落/标题/列表/原文链接", () => {
  const bodyHtml =
    "<h2>正文标题</h2>" +
    "<p>正文一段，说明产品。</p>" +
    "<ul><li>要点一</li><li>要点二</li></ul>" +
    '<p><a href="https://www.ifanr.com/1682801">阅读原文</a></p>' +
    '<img src="https://cdn.ifanr.com/a.png" alt="配图">' +
    '<picture><source srcset="https://cdn.ifanr.com/b.webp"><img src="https://cdn.ifanr.com/b.png"></picture>' +
    '<video src="https://cdn.ifanr.com/v.mp4"></video>' +
    '<audio src="https://cdn.ifanr.com/a.mp3"></audio>' +
    '<iframe src="https://evil.example/frame"></iframe>' +
    '<svg viewBox="0 0 1 1"><rect></rect></svg>' +
    '<object data="https://evil.example/o"></object>' +
    '<embed src="https://evil.example/e">' +
    "<script>alert(1)</script>" +
    "<style>.x{color:red}</style>" +
    "<source src='https://cdn.ifanr.com/c.mp4'>" +
    '<p><a href="https://cdn.ifanr.com/only-image"><img src="https://cdn.ifanr.com/only.png" alt="仅图"></a></p>' +
    "<p>   </p>" +
    "<figure><img src='https://cdn.ifanr.com/f.png'></figure>";

  const out = renderIfanrTextOnly({ url: REVIEWED[0]!.url, author: "肖钦鹏", bodyHtml });

  for (const tag of ["<img", "<picture", "<video", "<audio", "<iframe", "<svg", "<object", "<embed", "<script", "<style", "<source"]) {
    assert.ok(!out.includes(tag), `输出不得含 ${tag}：${out}`);
  }
  assert.ok(out.includes("<h2>正文标题</h2>"), "标题必须保留");
  assert.ok(out.includes("<p>正文一段，说明产品。</p>"), "正文段落必须原样保留");
  assert.ok(out.includes("<li>要点一</li>") && out.includes("<li>要点二</li>"), "列表必须保留");
  assert.ok(!out.includes("仅图"), "仅图链接整块删除");
  assert.ok(!/<p>\s*<\/p>/.test(out), "不得留下空段");

  // 署名与许可区块。
  assert.ok(out.includes("<h2>来源与许可</h2>"), "缺“来源与许可”标题");
  assert.ok(out.includes("肖钦鹏"), "缺原作者");
  assert.ok(out.includes("爱范儿"), "缺爱范儿");
  assert.ok(out.includes(esc(REVIEWED[0]!.url)), "缺精确原 URL");
  assert.ok(out.includes('href="https://creativecommons.org/licenses/by-nc/4.0/"'), "缺 CC BY-NC 4.0 链接");
  assert.ok(out.includes("依CC BY-NC 4.0用于非商业阅读"), "缺用途说明");
  assert.ok(out.includes("移除图片与嵌入媒体"), "缺媒体移除说明");
  assert.ok(out.includes("不是AI扩写"), "缺非 AI 扩写说明");
  assert.ok(out.includes("不表示原作者为本站背书"), "缺背书免责");
  assert.ok(out.includes('<a href="https://www.ifanr.com/1682801">阅读原文</a>'), "原文链接必须保留");
});

test("renderIfanrTextOnly：动态值转义，作者与 URL 注入都被挡住", () => {
  const evilAuthor = '<img src=x onerror="alert(1)">假作者<script>alert(2)</script>';
  const evilUrl = 'https://www.ifanr.com/1682801?a="><script>alert(3)</script>';
  const out = renderIfanrTextOnly({ url: evilUrl, author: evilAuthor, bodyHtml: "<p>正文在。</p>" });

  assert.ok(!/<script/i.test(out), "输出不得出现 script 元素");
  assert.ok(!out.includes("<img"), "作者里的 img 必须被转义，不能成为元素");
  assert.ok(out.includes("&lt;img"), "作者文本应以转义形式保留");
  assert.ok(!/<[a-z][^>]*\sonerror/i.test(out), "不得出现 onerror 属性");
  assert.ok(out.includes("正文在。"), "正文文字不因转义丢失");
});

test("ifanrLicensedBody：未知/空/变化的正文一律 null，未审稿不展示全文", () => {
  const r = REVIEWED[0]!;
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: r.url, author: r.author, bodyHtml: null }), null, "bodyHtml null 必须 null");
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: r.url, author: r.author, bodyHtml: "" }), null, "空正文必须 null");
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: r.url, author: r.author, bodyHtml: "   \n\t " }), null, "纯空白正文必须 null");
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: r.url, author: r.author, bodyHtml: "<p>被改写过的正文</p>" }), null, "未知正文（hash 不符）必须 null");
  assert.equal(ifanrLicensedBody({ articleId: "unknown-article-id", url: r.url, author: r.author, bodyHtml: "<p>正文</p>" }), null, "未知文章必须 null");
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: r.url, author: null, bodyHtml: "<p>正文</p>" }), null, "作者缺失必须 null");
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: "https://evil.example/1682801", author: r.author, bodyHtml: "<p>正文</p>" }), null, "URL 被换必须 null");
  assert.equal(ifanrLicensedBody({ articleId: r.id, url: r.url, author: "别人", bodyHtml: "<p>正文</p>" }), null, "作者被换必须 null");
});
