// 爱范儿（ifanr.com）已审正文的许可闸门。核查结论固化在代码里（来源：notes/ifanr-license-review.json，
// 该文件只读、运行期不加载）：只有 articleId + 原样 URL + 作者 + 正文 SHA256 四项同时匹配的记录，
// 正文才允许以全文渲染；未审稿默认不展示全文。
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { sanitizeBody } from "../content/sanitize.ts";

export interface IfanrReviewedArticle {
  readonly id: string;
  readonly url: string;
  readonly author: string;
  readonly bodySha256: string;
}

/** 三条已审记录（3 页均见 CC BY-NC 4.0 且未见转载限制，正文与库内去空白逐字一致）。 */
export const IFANR_REVIEWED: readonly IfanrReviewedArticle[] = Object.freeze([
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
]);

/**
 * 原始 URL 严格形态：https、无端口、无 credentials、主机恰为 www.ifanr.com、路径为纯数字文章段。
 * 解析失败（非法 URL）一律 false。
 */
function isStrictIfanrUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username !== "" || parsed.password !== "") return false;
  if (parsed.hostname !== "www.ifanr.com") return false;
  if (parsed.port !== "") return false;
  return /^\/\d+$/.test(parsed.pathname);
}

/**
 * 是否为已审爱范儿文章：articleId 命中已审记录，且 URL 与记录原样一致（并满足严格形态）、
 * 作者一致、正文 SHA256 一致。未审、换作者、换 URL、换正文 hash 都返回 false。
 */
export function isReviewedIfanrArticle(input: {
  articleId: string;
  url: string;
  author: string | null;
  bodySha256: string;
}): boolean {
  if (typeof input.articleId !== "string" || typeof input.url !== "string" || typeof input.bodySha256 !== "string") return false;
  const record = IFANR_REVIEWED.find((r) => r.id === input.articleId);
  if (!record) return false;
  if (input.url !== record.url) return false;
  if (!isStrictIfanrUrl(input.url)) return false;
  if (input.author === null || input.author !== record.author) return false;
  if (!/^[0-9a-f]{64}$/.test(input.bodySha256)) return false;
  return input.bodySha256 === record.bodySha256;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** 媒体与可执行节点：整块删除（连同其内容）。 */
const DROP_MEDIA = [
  "img", "picture", "video", "audio", "iframe", "svg", "object", "embed",
  "script", "style", "source", "track", "canvas", "link", "meta", "noscript",
  "template", "form", "input", "button", "select", "textarea",
].join(", ");

/** 删除媒体后没有文字的块（空段、仅图 figure、空标题等）。 */
const TEXT_LEAVES = "p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, pre, td, th, dt, dd, caption, span";
const TEXT_CONTAINERS = "figure, ul, ol, dl, table, div, section, article, aside, header, footer, nav, main";

const LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/";

/**
 * 纯文字渲染工具（不表示已审核）：cheerio 先删掉媒体/执行节点、仅图链接与空段，保留正文段落、
 * 标题、列表和原链接，再追加“来源与许可”区块（原作者、爱范儿、精确原 URL、CC BY-NC 4.0 链接
 * 与用途说明），动态值全部转义，最后交给已有 sanitizeBody 收尾。
 */
export function renderIfanrTextOnly(input: { url: string; author: string; bodyHtml: string }): string {
  const { url, author, bodyHtml } = input;
  const $ = cheerio.load(typeof bodyHtml === "string" ? bodyHtml : "", null, false);
  $(DROP_MEDIA).remove();
  // 仅图链接（图已删，链接即空）与空段。
  $("a").each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });
  $(TEXT_LEAVES).each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });
  $(TEXT_CONTAINERS).each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });

  const attribution = [
    "<h2>来源与许可</h2>",
    `<p>原作者：${escapeHtml(author)}</p>`,
    "<p>来源：爱范儿（ifanr.com）</p>",
    `<p>原文：<a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    `<p>许可：<a href="${LICENSE_URL}">CC BY-NC 4.0</a>（署名-非商业性使用 4.0 国际）</p>`,
    "<p>依CC BY-NC 4.0用于非商业阅读；移除图片与嵌入媒体、整理排版；中文正文来自原作者，不是AI扩写；不表示原作者为本站背书。</p>",
  ].join("");

  return sanitizeBody($.html() + attribution);
}

/**
 * 已审正文的全文：按“原 bodyHtml 的 SHA256”核验，四项匹配才渲染；
 * 正文为空、未知文章或正文已变化都返回 null（未审稿默认不展示全文）。
 */
export function ifanrLicensedBody(input: {
  articleId: string;
  url: string;
  author: string | null;
  bodyHtml: string | null;
}): string | null {
  const { articleId, url, author, bodyHtml } = input;
  if (typeof bodyHtml !== "string" || bodyHtml.trim() === "") return null;
  const bodySha256 = createHash("sha256").update(bodyHtml, "utf8").digest("hex");
  if (!isReviewedIfanrArticle({ articleId, url, author, bodySha256 })) return null;
  if (author === null || author.trim() === "") return null;
  return renderIfanrTextOnly({ url, author, bodyHtml });
}
