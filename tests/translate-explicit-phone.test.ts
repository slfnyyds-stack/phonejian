// 判断纯函数 isFulltextTranslationAllowed：已许可的 public 全文即使未入精选，也可以由编辑显式调用原生翻译；
// 后台自动翻译仍只处理精选。不连库、不调模型，只 import 真实函数。
import assert from "node:assert/strict";
import { test } from "node:test";
import { isFulltextTranslationAllowed } from "@aihot/backend/editorial/translate";

test("默认：selected/public/full 允许", () => {
  assert.equal(isFulltextTranslationAllowed({ selected: true, visibility: "public", body_mode: "full" }), true);
});

test("默认：unselected 拒绝", () => {
  assert.equal(isFulltextTranslationAllowed({ selected: false, visibility: "public", body_mode: "full" }), false);
});

test("显式 allowUnselectedFulltext：unselected/public/full 允许", () => {
  assert.equal(
    isFulltextTranslationAllowed({ selected: false, visibility: "public", body_mode: "full" }, { allowUnselectedFulltext: true }),
    true,
  );
});

test("显式仍拒绝 summary body_mode", () => {
  assert.equal(
    isFulltextTranslationAllowed({ selected: false, visibility: "public", body_mode: "summary" }, { allowUnselectedFulltext: true }),
    false,
  );
});

test("summary-only visibility 拒绝", () => {
  assert.equal(
    isFulltextTranslationAllowed({ selected: true, visibility: "summary-only", body_mode: "full" }, { allowUnselectedFulltext: true }),
    false,
  );
});

test("withdrawn visibility 拒绝", () => {
  assert.equal(
    isFulltextTranslationAllowed({ selected: true, visibility: "withdrawn", body_mode: "full" }, { allowUnselectedFulltext: true }),
    false,
  );
});

test("显式 false 不能绕过", () => {
  assert.equal(
    isFulltextTranslationAllowed({ selected: false, visibility: "public", body_mode: "full" }, { allowUnselectedFulltext: false }),
    false,
  );
});
