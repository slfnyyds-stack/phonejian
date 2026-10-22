// 手机行业术语与翻译规则（industry/prompts/rules-domain.md）的静态契约测试：
// 只检查提示词文本内容，不调用任何模型，不验证真实翻译质量。
// 修改 industry/prompts/rules-domain.md 后运行：
//   node --test tests/rules-domain-phone.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(
  new URL("../industry/prompts/rules-domain.md", import.meta.url),
  "utf8",
);

function hasAll(words: string[], label: string) {
  for (const w of words) {
    assert.ok(RAW.includes(w), `${label}缺少：${w}`);
  }
}

test("面向手机/移动终端与零售场景，按上下文解释", () => {
  for (const w of ["手机", "移动终端", "零售"]) {
    assert.ok(RAW.includes(w), `缺少领域定位词：${w}`);
  }
  assert.ok(RAW.includes("上下文"), "缺少按上下文解释的要求");
});

test("无 100% AI 宣称、无一律按 AI 解释歧义", () => {
  assert.ok(!RAW.includes("100%"), "不得宣称平台内容 100% 属于 AI");
  assert.ok(!/一律按 AI 含义翻译|一律按 AI/.test(RAW), "不得把歧义词一律按 AI 解释");
  assert.ok(!RAW.includes("大语言模型（绝不译\"法学硕士\""), "残留旧 LLM 强制解释规则");
  // 旧 AI 厂商/基准大段例子不应残留
  for (const w of ["MMLU", "SWE-bench", "HuggingFace", "LangChain", "vLLM"]) {
    assert.ok(!RAW.includes(w), "残留旧 AI 行业示例词表");
  }
  // 可提手机 AI，但不得写"所有内容都按 AI 翻译"
  assert.ok(!/所有内容都按 AI 翻译/.test(RAW), "出现被禁止的全量 AI 翻译表述");
});

test("品牌、机型、版本、SKU、URL、代码命令准确保留，不猜未知型号", () => {
  for (const w of ["机型", "产品代码", "SKU", "URL", "命令", "不擅自", "未知"]) {
    assert.ok(RAW.includes(w), `缺少精确保留要求：${w}`);
  }
  assert.ok(RAW.includes("不猜"), "缺少不猜未知型号/后缀的要求");
});

test("官方中文名仅限原文给出；子品牌不因母公司互换", () => {
  for (const w of ["官方中文", "未知译名", "不编"]) {
    assert.ok(RAW.includes(w), `缺少译名约束：${w}`);
  }
  assert.ok(RAW.includes("iQOO") && RAW.includes("vivo"), "缺少 iQOO/vivo 区分");
  assert.ok(RAW.includes("OnePlus") && RAW.includes("OPPO"), "缺少 OnePlus/OPPO 区分");
  assert.ok(RAW.includes("不因母公司"), "缺少母公司关系不互换品牌的约束");
});

test("保留 RAM/ROM、mAh、刷新率等缩写单位；刷新率≠PWM；防抖/像素/变焦不混用", () => {
  for (const w of ["RAM", "ROM", "GB", "TB", "mAh", "W", "Hz", "MP", "CPU", "GPU", "NPU", "OIS", "EIS", "IP", "5G", "Wi-Fi", "Bluetooth", "USB"]) {
    assert.ok(RAW.includes(w), `缺少需保留的缩写/单位：${w}`);
  }
  assert.ok(RAW.includes("刷新率") && RAW.includes("PWM"), "缺少刷新率与 PWM 频率区分");
  for (const w of ["防抖", "像素", "变焦倍率"]) {
    assert.ok(RAW.includes(w), `缺少不混用要求：${w}`);
  }
});

test("光学变焦、光学品质变焦、数字变焦三种口径严格区分；宣称与实测分开；保留约/至多", () => {
  for (const w of ["光学变焦", "光学品质变焦", "数字变焦"]) {
    assert.ok(RAW.includes(w), `缺少变焦口径：${w}`);
  }
  assert.ok(RAW.includes("厂商宣称") && RAW.includes("实测"), "缺少宣称与实测分开的要求");
  assert.ok(RAW.includes("约") || RAW.includes("至多") || RAW.includes("最高"), "缺少保留约/至多/最高的要求");
});

test("电池容量口径与有线/无线充电区分；IP 防护保留测试条件", () => {
  for (const w of ["标称", "典型", "额定", "有线", "无线", "测试条件"]) {
    assert.ok(RAW.includes(w), `缺少电池/防护约束：${w}`);
  }
  assert.ok(!/永久防水/.test(RAW), "不得承诺永久防水保证");
});

test("MSRP/RRP 是建议零售价，不是成交价；报价条件保留", () => {
  for (const w of ["MSRP", "RRP", "建议零售价", "成交价"]) {
    assert.ok(RAW.includes(w), `缺少价格术语约束：${w}`);
  }
  for (const w of ["时间", "地区", "平台", "版本", "资格", "服务条件"]) {
    assert.ok(RAW.includes(w), `缺少报价条件保留要求：${w}`);
  }
  assert.ok(RAW.includes("不推算"), "缺少不推算内部渠道价/利润的约束");
});

test("阶段不升级：传闻、预告、预约、上市、正式发布、评测按原文", () => {
  for (const w of ["传闻", "预告", "预约", "上市", "正式发布", "评测", "不升级"]) {
    assert.ok(RAW.includes(w), `缺少阶段表达约束：${w}`);
  }
});

test("手机 AI 词按上下文，同名词不强制 AI 含义", () => {
  for (const w of ["Token", "Agent", "Inference", "销售代理", "访问令牌", "金融代币"]) {
    assert.ok(RAW.includes(w), `缺少 AI 同名词上下文约束：${w}`);
  }
  assert.ok(RAW.includes("存疑"), "缺少未知含义保留原词并存疑的要求");
});

test("数字、金额、单位原样保留；不换算、不补未知参数", () => {
  for (const w of ["金额", "币种", "比例", "区间", "不换算", "不补"]) {
    assert.ok(RAW.includes(w), `缺少数值保留要求：${w}`);
  }
  assert.ok(/汇率|容量换算/.test(RAW), "缺少不做汇率/容量换算的要求");
});

test("输入不可信；不改变调用者输出格式；不编个人经历", () => {
  for (const w of ["不可信", "不执行", "输出格式", "不编", "个人经历"]) {
    assert.ok(RAW.includes(w), `缺少安全/边界约束：${w}`);
  }
});
