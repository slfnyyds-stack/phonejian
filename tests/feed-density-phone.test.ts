// 手机信息流密度（第二轮）：FeedItem padding 收紧 + 推荐理由行、主题页 4 行摘要与更新时间。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const feedItem = readFileSync(join(root, "apps/web/app/features/feed/FeedItem.tsx"), "utf8");
const topic = readFileSync(join(root, "apps/web/app/routes/topic.tsx"), "utf8");
const css = readFileSync(join(root, "apps/web/app/editorial.css"), "utf8");

test("FeedItem: reason 渲染分支存在且有真实字段判断（无占位兜底）", () => {
  assert.match(feedItem, /item\.reason\s*&&/);
  assert.match(feedItem, /推荐理由：\{item\.reason\}/);
});

test("FeedItem: reason 样式为 text-[12.5px] text-accent 左边框行", () => {
  assert.match(feedItem, /border-l-2 border-accent pl-2 text-\[12\.5px\]/);
  assert.match(feedItem, /text-accent/);
});

test("FeedItem: reason 空值时不渲染任何占位文案", () => {
  assert.ok(!feedItem.includes("暂无理由"), "不得出现占位文案");
  assert.ok(!/暂无/.test(feedItem), "不得出现任何占位兜底文案");
});

test("FeedItem: padding 新值存在，旧值消失", () => {
  assert.match(feedItem, /lg:px-\[13px\]/);
  assert.match(feedItem, /lg:pb-\[10px\]/);
  assert.match(feedItem, /lg:pt-\[11px\]/);
  assert.ok(!feedItem.includes("lg:px-[18px]"), "旧 padding 应移除");
  assert.ok(!feedItem.includes("lg:pb-[14px]"), "旧 padding 应移除");
  assert.ok(!feedItem.includes("lg:pt-[15px]"), "旧 padding 应移除");
});

test("FeedItem: 保留 aria / data 属性与摘要节点标记", () => {
  assert.match(feedItem, /data-item-id=/);
  assert.match(feedItem, /data-item-summary/);
});

test("topic.tsx: 外层容器含 topic-page class", () => {
  assert.match(topic, /className="topic-page /);
});

test("topic.tsx: refreshAt 存在时显示“更新于 HH:MM”，无则不显示", () => {
  assert.match(topic, /data\.refreshAt\s*\?/);
  assert.match(topic, /更新于 \{updatedAt\}/);
  assert.ok(!topic.includes("fetch(") || !/refresh/.test(topic.match(/loader[\s\S]*?\n\}/)?.[0] ?? ""), "不得新增请求");
});

test("editorial.css: 主题页摘要 clamp 改为 4 行", () => {
  assert.match(css, /\.topic-page \[data-item-summary\]\s*\{[^}]*-webkit-line-clamp:\s*4/);
});

test("editorial.css: 相邻 item 间距收紧到 6px", () => {
  assert.match(css, /\.feed-item-gap > \* \+ \*\s*\{[^}]*margin-top:\s*6px/);
});
