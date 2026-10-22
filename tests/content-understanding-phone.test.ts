// 内容理解提示词的手机行业契约测试：只做静态文本检查，不调用任何模型，
// 不验证真实 LLM 的摘要或推荐理由准确率。改 industry/prompts/content-understanding.md 后跑：
//   node --test tests/content-understanding-phone.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(
  new URL("../industry/prompts/content-understanding.md", import.meta.url),
  "utf8",
);
const TAXONOMY = readFileSync(
  new URL("../industry/taxonomy.ts", import.meta.url),
  "utf8",
);

// 从 taxonomy.ts 源码里提取词表，保证测试与代码同步，而不是复制一份词表。
function extractArray(name: string): string[] {
  const re = new RegExp(`export const ${name} = \\[([^\\]]+)\\]`);
  const m = re.exec(TAXONOMY);
  assert.ok(m, `taxonomy.ts 中找不到 ${name}`);
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

const CATEGORY_TAGS = extractArray("CATEGORY_TAGS");
const TOPIC_TAGS = extractArray("TOPIC_TAGS");
const ENTITY_TAGS = extractArray("ENTITY_TAGS");

function extractLastJsonObject(text: string): Record<string, unknown> {
  const start = text.lastIndexOf("{");
  assert.ok(start >= 0, "提示词中没有 JSON 示例");
  const depthEnd = text.indexOf("}", start);
  // 找最后一个平衡的大对象：从每个 "{" 开始尝试 parse，取最后一个成功的
  let parsed: Record<string, unknown> | null = null;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== "{") continue;
    for (let j = text.length; j > i; j--) {
      if (text[j] !== "}") continue;
      try {
        const candidate = JSON.parse(text.slice(i, j + 1));
        if (typeof candidate === "object" && candidate !== null) {
          parsed = candidate as Record<string, unknown>;
        }
      } catch {
        /* 继续尝试更长的片段 */
      }
      break;
    }
    if (parsed) return parsed;
  }
  assert.ok(parsed, "提示词末尾没有可解析的 JSON 示例");
  return parsed as Record<string, unknown>;
}

test("模板占位符保留：{{siteName}} 存在", () => {
  assert.ok(RAW.includes("{{siteName}}"), "缺少 {{siteName}} 占位符");
});

test("JSON 示例能 parse，且顶层只有六个字段", () => {
  const example = extractLastJsonObject(RAW);
  const keys = Object.keys(example).sort();
  assert.deepEqual(
    keys,
    ["authorRole", "editorialJudgment", "itemType", "summaryZh", "tags", "titleZh"].sort(),
    "JSON 示例顶层字段必须是六字段",
  );
});

test("itemType 覆盖 7 个内部标识且语义与手机一致", () => {
  for (const t of [
    "model_release",
    "product_launch",
    "tool_or_prompt",
    "research_paper",
    "industry_event",
    "opinion_analysis",
    "tutorial_explainer",
  ]) {
    assert.ok(RAW.includes(`\`${t}\``) || RAW.includes(t), `缺少 itemType：${t}`);
  }
  // 手机语义锚点：芯片、新品功能、零售方法、技术研究、行业政策、观点分析、评测讲解
  for (const w of ["芯片", "零售", "政策", "评测"]) {
    assert.ok(RAW.includes(w), `缺少手机语义说明：${w}`);
  }
  // 旧 AI 语义不应出现
  assert.ok(!RAW.includes("大版本更新"), "仍是旧的模型语义描述");
});

test("authorRole 三选一：principal / observer / relayer，且不冒充亲历", () => {
  for (const r of ["principal", "observer", "relayer"]) {
    assert.ok(RAW.includes(r), `缺少 authorRole：${r}`);
  }
  assert.ok(
    !/AI摘要|模型摘要/.test(RAW.split("authorRole")[1] ?? "") ||
      RAW.includes("不凭空"),
    "缺少不把媒体稿或AI摘要当亲历的说明",
  );
});

test("标签词表与 taxonomy.ts 一致：类别、主题、实体全部同步", () => {
  for (const c of CATEGORY_TAGS) {
    assert.ok(RAW.includes(c), `提示词缺少分类标签：${c}`);
  }
  for (const t of TOPIC_TAGS) {
    assert.ok(RAW.includes(t), `提示词缺少主题标签：${t}`);
  }
  for (const e of ENTITY_TAGS) {
    assert.ok(RAW.includes(e), `提示词缺少实体标签：${e}`);
  }
  // 旧 AI 行业词表不应残留
  for (const w of ["Agent", "RAG", "多模态", "Hugging Face", "arXiv", "DeepSeek", "OpenAI"]) {
    assert.ok(!RAW.includes(w), `残留旧 AI 词表：${w}`);
  }
});

test("类别 fallback 与 taxonomy 的 CATEGORY_BY_ITEM_TYPE 对应", () => {
  const m = /export const CATEGORY_BY_ITEM_TYPE[^{]+\{([\s\S]*?)\}/.exec(TAXONOMY);
  assert.ok(m, "taxonomy.ts 中找不到 CATEGORY_BY_ITEM_TYPE");
  for (const pair of m[1].split(",")) {
    const kv = pair.split(":").map((s) => s.trim().replace(/["']/g, ""));
    if (kv.length !== 2 || !kv[1]) continue;
    const [itemType, category] = kv;
    assert.ok(
      RAW.includes(category),
      `提示词缺少 ${itemType} 的 fallback 类别：${category}`,
    );
  }
});

test("输入不可信：素材内的指令不执行", () => {
  for (const w of ["不可信", "不执行", "指令"]) {
    assert.ok(RAW.includes(w), `缺少输入安全边界：${w}`);
  }
  assert.ok(/命令|Prompt|JSON/.test(RAW), "缺少命令/Prompt/JSON 等不可信素材的说明");
});

test("原阶段不升级：传闻、预告、预约、上市、正式发布、实测按原文表达", () => {
  for (const w of ["传闻", "预告", "预约", "上市", "正式发布", "实测"]) {
    assert.ok(RAW.includes(w), `缺少阶段表达约束：${w}`);
  }
});

test("价格政策条件：时间、地区、平台、购买或服务条件必须保留", () => {
  for (const w of ["时间", "地区", "平台", "条件"]) {
    assert.ok(RAW.includes(w), `缺少价格/补贴/售后条件约束：${w}`);
  }
  assert.ok(RAW.includes("非公开"), "缺少非公开渠道价不外泄的约束");
});

test("厂商宣称与独立评测分开；一线观察是作者观点", () => {
  assert.ok(RAW.includes("厂商宣称"), "缺少厂商宣称边界");
  assert.ok(/独立评测|评测结论/.test(RAW), "缺少不得把宣称当评测结论的约束");
  assert.ok(RAW.includes("一线观察") && RAW.includes("作者观点"), "缺少一线观察属作者观点的约束");
});

test("不编经历、不编数字、证据不足时推荐理由为空", () => {
  assert.ok(/不得?编|不编/.test(RAW), "缺少不编造约束");
  assert.ok(RAW.includes("空字符串"), "缺少证据不足时 editorialJudgment 为空字符串的约束");
  assert.ok(/45|70/.test(RAW), "缺少推荐理由字数约束");
  assert.ok(/45|70/.test(RAW) && RAW.includes("一句话"), "缺少一句话约束");
  assert.ok(RAW.includes("不营销") || RAW.includes("命令读者"), "缺少不营销/不命令读者约束");
});

test("图文边界与冲突处理：不凭图猜、冲突不裁决", () => {
  assert.ok(/图文|图片/.test(RAW), "缺少图文边界说明");
  assert.ok(RAW.includes("冲突"), "缺少图文冲突不擅自裁决的约束");
});

test("只输出六字段 JSON，不打分、不判断精选", () => {
  assert.ok(RAW.includes("不打分") || RAW.includes("不得打分"), "缺少不打分约束");
  assert.ok(RAW.includes("精选"), "缺少不判断精选的说明");
  for (const f of ["itemType", "authorRole", "tags", "editorialJudgment", "titleZh", "summaryZh"]) {
    assert.ok(RAW.includes(`\`${f}\``), `缺少字段说明：${f}`);
  }
});

test("示例不是真实事件：不得出现具体已发布机型的真实组合", () => {
  const example = JSON.stringify(extractLastJsonObject(RAW));
  // 示例里不应出现真实品牌名与真实机型的发布组合，避免像一条真新闻
  for (const e of ENTITY_TAGS) {
    assert.ok(!example.includes(e), `JSON 示例包含真实品牌 ${e}，应改为虚构手机场景`);
  }
  const tagList = (extractLastJsonObject(RAW).tags as string[]) ?? [];
  assert.ok(tagList.length >= 1, "示例 tags 至少 1 个");
  assert.ok(CATEGORY_TAGS.includes(tagList[0]), "示例第一个标签必须是分类标签");
  for (const t of tagList.slice(1)) {
    assert.ok(
      TOPIC_TAGS.includes(t) || ENTITY_TAGS.includes(t),
      `示例标签不在白名单：${t}`,
    );
  }
});
