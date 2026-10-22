import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files=['structure.md','summarize-article.md','summarize-long-post.md','rules-self-contained-title.md'];
const text=(name:string)=>readFileSync(new URL('../industry/prompts/'+name,import.meta.url),'utf8');
const tokens=(s:string)=>Array.from(s.matchAll(/\{\{([^}]+)\}\}/g),m=>m[1]!.trim()).sort();
for(const name of files){
 test(name+' preserves upstream template inputs',()=>{
  // fixture 固定 AIHOT 基线 8d5a39b（不依赖 git HEAD，公开快照/ZIP 无 .git）
  const old=readFileSync(new URL('./fixtures/upstream-prompts/'+name,import.meta.url),'utf8');
  assert.deepEqual(tokens(text(name)),tokens(old));
 });
 test(name+' uses phone context without stale AI examples',()=>{
  const s=text(name);assert.match(s,/手机|机型/);
  for(const old of ['AI 内容优先保留','AI 行业资深编辑','Claude Code','开源多模态模型','与 AI 相关'])assert.ok(!s.includes(old),old);
 });
}
test('structure retains JSON fields and unknown date contract',()=>{
 const s=text('structure.md');for(const key of ['category','tags','subjects','fact','occurredAt'])assert.ok(s.includes(key));assert.ok(s.includes('未知为 null'));assert.ok(s.includes('{{> safety}}'));assert.ok(s.includes('不补未知事实'));
});
test('article and long post keep output fields and safety rules',()=>{
 for(const name of ['summarize-article.md','summarize-long-post.md']){
  const s=text(name);for(const field of ['title_zh:','summary_zh:','{{> rules-anti-hallucination}}','{{> rules-domain}}'])assert.ok(s.includes(field));
  for(const condition of ['时间','地区','平台','传闻','正式发布','独立评测'])assert.ok(s.includes(condition));
 }
});
test('title rules preserve genre and do not upgrade previews',()=>{
 const s=text('rules-self-contained-title.md');assert.ok(s.includes('文章类型和核心动作'));assert.ok(s.includes('不能改成已经发布或上市'));assert.ok(s.includes('绝不凭行业常识编具体型号'));assert.ok(s.includes('格式示例'));
});
