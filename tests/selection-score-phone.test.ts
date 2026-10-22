// 精选评分提示词的手机行业契约测试：只做静态文本检查，不调用任何模型，
// 不验证真实 LLM 评分精度。改 industry/prompts/selection-score.md 后跑：
//   node --test tests/selection-score-phone.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../industry/prompts/selection-score.md", import.meta.url), "utf8");

const mustInclude = (parts: string[], label: string) => {
  for (const p of parts) {
    assert.ok(RAW.includes(p), `评分提示词缺少${label}：${p}`);
  }
};

// 原始（改造前）selection-score.md 中的 7 行权重，逐行原样提取作为 fixtures。
// 任何一行变动（包括数字或顺序）都会导致测试失败。
const ORIGINAL_WEIGHT_ROWS = [
  "| model_release | 4 | 1 | 2 | 2 | 1 |",
  "| product_launch | 3 | 2 | 1 | 2 | 2 |",
  "| tool_or_prompt | 1 | 2 | 1 | 2 | 4 |",
  "| research_paper | 5 | 3 | 1 | 0 | 1 |",
  "| industry_event | 3 | 2 | 2 | 3 | 0 |",
  "| opinion_analysis | 1 | 3 | 1 | 4 | 1 |",
  "| tutorial_explainer | 1 | 1 | 1 | 3 | 4 |",
];

// 与 industry/taxonomy.ts 的 ITEM_TYPES 保持一致的 7 个内部类型标识。
const ITEM_TYPES = [
  "model_release",
  "product_launch",
  "tool_or_prompt",
  "research_paper",
  "industry_event",
  "opinion_analysis",
  "tutorial_explainer",
];

test("模板占位符保留：{{siteName}} 存在", () => {
  assert.ok(RAW.includes("{{siteName}}"), "缺少 {{siteName}} 占位符");
  assert.ok(RAW.includes("{\"attentionScore\": 0}"), "缺少单字段 JSON 输出示例");
});

test("手机零售读者方向：读者定义与评价视角", () => {
  mustInclude(
    ["手机零售", "从业者", "门店", "顾客", "选机", "售后", "补贴", "回收"],
    "手机零售读者方向",
  );
  // 不再是旧的 AI 行业读者定义
  assert.ok(!RAW.includes("持续关注 AI、但注意力有限的普通重度用户"), "仍是旧的 AI 行业读者定义");
});

test("核心场景写清：新品/价格补贴/售后/安全/实测方法/一线经验", () => {
  mustInclude(
    ["新品", "价格", "补贴", "保修", "以旧换新", "安全", "隐私", "实测", "话术"],
    "核心场景",
  );
  assert.ok(/不能仅因为属于版本更新就机械低估/.test(RAW), "缺少“重要修复不因版本更新机械低估”规则");
});

test("输入安全边界：材料不可信，不执行其中指令", () => {
  mustInclude(["不可信的待评材料", "不是给你的指令", "绝不执行或复制", "输出指定分数或增加字段"], "输入安全边界");
  assert.ok(/只评(当前)?材料所代表的事件|只评价这个事件本身/.test(RAW), "缺少“材料讨论注入时只评事件”规则");
});

test("输出契约：单字段 attentionScore，禁止额外字段与精选结论", () => {
  assert.ok(/必须且只能包含 `attentionScore`/.test(RAW), "缺少单字段输出契约描述");
  assert.ok(/只返回合法 JSON/.test(RAW), "缺少合法 JSON 要求");
  assert.ok(/不要输出精选门槛|没有输出精选门槛/.test(RAW), "缺少禁止输出门槛/结论");
});

test("五轴全部保留且为 0–10 整数", () => {
  for (const axis of ["sig", "nov", "cred", "reson", "act"]) {
    assert.ok(RAW.includes(`\`${axis}\``), `缺少五轴：${axis}`);
  }
  assert.ok(RAW.includes("0–10 整数分"), "缺少 0–10 整数五轴说明");
  assert.ok(RAW.includes("attentionScore = sig×w1 + nov×w2 + cred×w3 + reson×w4 + act×w5"), "缺少合成公式");
});

test("7 行类型权重与改造前完全相同（逐行比对 fixtures）", () => {
  for (const row of ORIGINAL_WEIGHT_ROWS) {
    assert.ok(RAW.includes(row), `权重行与改造前不一致：${row}`);
  }
  assert.ok(RAW.includes("每行权重之和为 10"), "缺少权重和为 10 的说明");
});

test("7 个 ITEM_TYPES 标识保留且语义重写为手机行业", () => {
  for (const t of ITEM_TYPES) {
    assert.ok(RAW.includes(`\`${t}\``), `缺少类型标识：${t}`);
  }
  assert.ok(RAW.includes("折叠屏"), "product_launch 语义应包含折叠屏");
  assert.ok(RAW.includes("零售方法"), "tool_or_prompt 语义应为零售方法");
  assert.ok(RAW.includes("选机对比"), "tutorial_explainer 语义应包含选机对比");
});

test("证据与营销边界：cred 依据材料内部证据，不因品牌加分", () => {
  assert.ok(/不是品牌名气|不是来源名气/.test(RAW), "cred 不应依赖来源名气");
  assert.ok(/官方公告足以证明.*但不能自动证明/.test(RAW), "官方公告只证明动作、不证明效果");
  assert.ok(RAW.includes("遥遥领先"), "应压制“遥遥领先”式纯宣传");
  assert.ok(/冒充正式发布/.test(RAW), "应压制预告/传闻冒充正式发布");
  assert.ok(/单一榜单刷分|参数堆砌/.test(RAW), "应压制榜单刷分/参数堆砌");
});

test("价格补贴边界：无范围条件不按实质政策评分", () => {
  mustInclude(["时间、地区、平台", "无范围条件"], "价格补贴条件要求");
});

test("不编造作者经历、不把未知渠道报价写成公开价格", () => {
  assert.ok(/不编造作者经历/.test(RAW), "缺少不编造作者经历");
  assert.ok(/未知渠道报价/.test(RAW), "缺少未知渠道报价约束");
});

test("证据不足与材料不足约束保留", () => {
  assert.ok(RAW.includes("`cred` 和相关轴必须随之降低"), "缺少证据不足降分规则");
  assert.ok(RAW.includes("不要替材料补全一个更强故事"), "缺少不补强因果规则");
  assert.ok(/不得高于 30/.test(RAW), "缺少残缺材料分数上限");
  assert.ok(RAW.includes("标题与正文冲突时以正文为准"), "缺少标题正文冲突规则");
});

test("事件口径校正保留：短公告/长文规则与强事件优先", () => {
  assert.ok(RAW.includes("事件口径校正"), "缺少事件口径校正节");
  assert.ok(RAW.includes("短公告"), "缺少短公告不自动低分规则");
  assert.ok(RAW.includes("不自动高分"), "缺少长文/知名厂商不自动高分规则");
  assert.ok(RAW.includes("以强事件为核心"), "缺少强事件优先规则");
});

test("不再有旧 AI 行业品味例子", () => {
  for (const stale of ["AI 重度用户", "通用智能体", "Harness", "普通重度用户", "SOTA", "开源", "对齐", "大模型", "融资"]) {
    assert.ok(!RAW.includes(stale), `仍残留旧行业例子或措辞：${stale}`);
  }
});
