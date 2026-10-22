// Bounded local batch run; no persistent environment or schedule changes.
import fs from 'node:fs';
process.env.MODEL_CALLS_ENABLED='true';
process.env.COLLECT_ENABLED='false';
// Use the website's configured model and key; never override with another provider.
if (!process.env.LLM_API_KEY || !process.env.LLM_BASE_URL) throw new Error('Website model credentials missing');
const LIMIT = Number.parseInt(process.env.INTERPRETATION_LIMIT || '6', 10);
if (!Number.isInteger(LIMIT) || LIMIT < 1) throw new Error('INTERPRETATION_LIMIT must be a positive integer');
const {sql,closeDb}=await import('@aihot/backend/db');
const {interpretArticle}=await import('@aihot/backend/editorial/interpretation');
const rows=await sql`
 SELECT a.id
 FROM articles a
 WHERE a.body_status='ok'
   AND length(coalesce(a.body_text,'')) >= 1200
   AND EXISTS (
     SELECT 1
     FROM publications p
     WHERE p.article_id=a.id
       AND p.visibility='public'
   )
   AND NOT EXISTS (
     SELECT 1
     FROM article_interpretations i
     WHERE i.article_id=a.id
       AND i.input_revision=a.revision
   )
 ORDER BY a.published_at DESC NULLS LAST, a.discovered_at DESC
 LIMIT ${LIMIT}
`;
const results=[];
let processed=0;
let skipped=0;
let failed=0;
try {
 for(const a of rows){
  console.log(JSON.stringify({step:'start',id:a.id}));
  try{
   const interpretation=await interpretArticle(a.id);
   if(!interpretation){
    skipped++;
    results.push({id:a.id,skipped:true,reason:'no-body-or-not-eligible'});
    console.log(JSON.stringify({step:'skip',id:a.id,reason:'no-body-or-not-eligible'}));
   }else{
    processed++;
    const result={
     id:a.id,
     model:interpretation.model,
     readingChars:interpretation.reading.length,
     facts:interpretation.facts.length,
     impact:interpretation.impact.length,
     limits:interpretation.limits.length
    };
    results.push(result);
    console.log(JSON.stringify({step:'done',...result}));
   }
  }catch(e){
   failed++;
   const error=String(e?.message ?? e).slice(0,300);
   results.push({id:a.id,error});
   console.log(JSON.stringify({step:'error',id:a.id,error}));
   break;
  }
  fs.writeFileSync('notes/phone-interpretation-results.json',JSON.stringify(results,null,2));
 }
 fs.writeFileSync('notes/phone-interpretation-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({step:'summary',processed,skipped,failed}));
}finally{await closeDb();}
