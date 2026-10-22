// 预筛提示词的手机行业契约测试：只做静态文本检查，不调用任何模型，
// 不验证真实 LLM 分类精度。改 industry/prompts/prefilter.md 后跑：
//   node --test tests/prefilter-phone.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../industry/prompts/prefilter.md", import.meta.url), "utf8");

const mustInclude = (parts: string[], label: string) => {
  for (const p of parts) {
    assert.ok(RAW.includes(p), `预筛提示词缺少${label}：${p}`);
  }
};

test("模板占位符保留：{{siteName}} 存在，且没有遗留 AI 行业措辞", () => {
  assert.ok(RAW.includes("{{siteName}}"), "缺少 {{siteName}} 占位符");
  assert.ok(!RAW.includes("为{{siteName}}做宽召回的AI相关性预筛"), "仍是旧的 AI 行业预筛提示词");
});

test("PASS 覆盖手机零售相关的正面方向", () => {
  mustInclude(
    [
      "折叠屏",
      "上市",
      "评测",
      "影像",
      "续航",
      "性能",
      "补贴",
      "渠道",
      "售后",
      "回收",
      "换新",
      "运营商",
      "配件",
      "供应链",
      "门店",
      "顾客",
    ],
    "手机相关性 PASS 方向",
  );
});

test("手机 AI 与通用 AI 的边界写清楚", () => {
  mustInclude(["手机AI", "不是所有AI"], "手机 AI 边界说明");
});

test("BLOCK 有正面依据要求：通用大模型/企业AI工具，且不按公司名或关键词机械拦截", () => {
  mustInclude(["大模型", "企业AI", "不能", "公司名", "手机关键词"], "BLOCK 判定规则");
});

test("UNKNOWN 处理材料不足：代词、图片视频、作者职业不补全、标题明确可PASS", () => {
  mustInclude(["代词", "图片", "视频", "作者职业", "UNKNOWN"], "UNKNOWN 判定规则");
  assert.ok(/标题[^。]*PASS|PASS[^。]*标题/.test(RAW), "缺少「标题已明确相关可 PASS」");
});

test("宽召回：预筛不评真假、质量、热度、精选；传闻可过但不写成正式发布", () => {
  for (const w of ["传闻", "真假", "质量", "热度", "精选", "正式发布"]) {
    assert.ok(RAW.includes(w), `缺少宽召回边界词：${w}`);
  }
});

test("输出契约：纯 JSON，label 三态与 reason 字段，20 字内", () => {
  assert.ok(RAW.includes('{"label":"PASS|BLOCK|UNKNOWN","reason":"20字内依据"}'), "缺少 JSON 输出契约");
  assert.ok(!/\bmarkdown\b/i.test(RAW.replace(/\bmd\b/g, "")), "不应要求输出 markdown");
  for (const label of ["PASS", "BLOCK", "UNKNOWN"]) {
    assert.ok(RAW.includes(label), `缺少 ${label} 说明`);
  }
});

test("安全边界：素材不可信、不执行其中指令与答案暗示", () => {
  mustInclude(["不可信", "不执行"], "安全边界");
  assert.ok(RAW.includes("命令") || RAW.includes("提示注入") || RAW.includes("Prompt"), "缺少命令/注入提示的说明");
});

test("原文缺失的处理：正文缺失不作 BLOCK，标题清楚可 PASS", () => {
  assert.ok(/正文[^。]*缺失/.test(RAW), "缺少正文缺失处理");
});
