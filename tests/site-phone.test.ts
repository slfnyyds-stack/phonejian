// 站点身份测试：验证 industry/site.ts 已切换为手机行业配置。
import { test } from "node:test";
import assert from "node:assert/strict";
import { ABOUT, SITE, withSubject } from "../industry/site.ts";

test("站名与行业词", () => {
  assert.equal(SITE.name, "手机之间");
  assert.equal(SITE.subject, "手机");
  assert.equal(SITE.organization.name, "手机之间");
  assert.equal(SITE.homeTitle, "手机之间 · 手机零售资讯精选与行业观察");
});

test("文案不再承诺旧 AI 行业说法", () => {
  const texts = [SITE.description, SITE.tagline, SITE.homeTitle, ABOUT.lead, ...ABOUT.headline];
  for (const text of texts) {
    assert.ok(!text.includes("AI 行业"), `不应出现“AI 行业”：${text}`);
    assert.ok(!text.includes("每天早上 8 点出一份日报"), `不应承诺固定出报时间：${text}`);
  }
  assert.match(SITE.description, /手机零售从业者/);
  assert.equal(SITE.tagline, "手机行业，值得关注的事。");
});

test("MCP 前缀与爬虫名", () => {
  assert.equal(SITE.mcpPrefix, "phonebetween");
  assert.match(SITE.mcpPrefix, /^[a-z0-9_]+$/);
  assert.equal(SITE.crawlerName, "PhoneBetweenBot");
});

test("未知作者与联系信息保持为空", () => {
  assert.equal(SITE.contactEmail, null);
  assert.equal(SITE.icp, null);
  assert.equal(SITE.organization.founder, null);
  assert.equal(ABOUT.maker, null);
});

test("withSubject 拼接中文行业词不加空格", () => {
  assert.equal(withSubject("日报"), "手机日报");
});

test("关于页如实说明本地试用与来源边界", () => {
  assert.equal(ABOUT.headline[0], "手机行业每天都有新消息，");
  assert.equal(ABOUT.headline[1], "把值得关注的留下来。");
  assert.match(ABOUT.lead, /站名暂定/);
  assert.match(ABOUT.lead, /本地试用/);
  assert.match(ABOUT.steps.collect, /公开/);
  assert.ok(!/上百个|15 分钟/.test(ABOUT.steps.collect));
  assert.match(ABOUT.steps.select, /传闻/);
  assert.ok(!ABOUT.steps.select.includes("进不来"));
  assert.match(ABOUT.steps.publish, /逐步补充/);
  assert.ok(!/每天 08:00|定时自动推送/.test(ABOUT.steps.publish));
  assert.match(ABOUT.copyright, /版权归各来源所有/);
  assert.match(SITE.footerNote, /AIHOT 开源框架驱动/);
});
