/* Independent temporary GPT audit of Opus v4. No app code modified. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../../tools/serve.mjs';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const evidence = path.join(root,'shots','gpt-v4-audit');
fs.mkdirSync(evidence,{recursive:true});
const {base,close} = await serve(path.join(root,'dist'));
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:1500,height:930}});
await ctx.addInitScript(() => {localStorage.setItem('jaskinia:hint','1')});
const page = await ctx.newPage();
const errors=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok,detail={})=>{cases.push({name,pass:!!ok,...detail});console.log((ok?'PASS':'FAIL')+' '+name+' '+JSON.stringify(detail));};
let couldRun=false;
try {
 await page.goto(base+'/jaskinia-web.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.__JASK?.packageData && !!window.__JASK?.store);
 couldRun=true;
 check('REAL v4 app boots', await page.evaluate(()=>window.__JASK.store?.spaces?.length>=5 &&
   window.__JASK.packageData(false).jaskinia.wersja==='v4'));
 const sentinel='GPT_PRIVATE_NOTE_DO_NOT_EXPORT_20261016';
 await page.evaluate(secret=>{
   const J=window.__JASK;
   const id=J.leafIds(J.L.tree)[0];
   J.store.notes.gpt_audit_note={text:secret,upd:Date.now()};
   J.commit('Synthetic private note fixture',L=>{L.wins[id].type='notatki';L.wins[id].st={note:'gpt_audit_note'};});
 },sentinel);
 await page.locator('.win[data-type="notatki"] .note-pick').first().click();
 const hit=page.locator('.jk-menu .mi').filter({hasText:sentinel}).first();
 await hit.waitFor({timeout:5000});
 await hit.click();
 await page.waitForTimeout(150);
 const leak=await page.evaluate(secret=>{
  const p=window.__JASK.packageData(false);
  return {
   noteBodyOmitted: typeof p.notatki.tresc==='string'&&p.notatki.tresc.startsWith('pominięta'),
   journalHasNoteExcerpt:p.dziennik.some(e=>e.a.includes(secret)),
   packageHasExcerpt:JSON.stringify(p).includes(secret),
   textModeHasExcerpt:window.__JASK.packageText().includes(secret),
   journalCount:p.dziennik.length
  }
 },sentinel);
 check('Note body is omitted by export=false',leak.noteBodyOmitted);
 check('PRIVACY COUNTEREXAMPLE — note text excerpt unexpectedly present in journal',leak.journalHasNoteExcerpt,leak);
 check('PRIVACY COUNTEREXAMPLE — omitted-note package JSON includes that text',leak.packageHasExcerpt,leak);
 check('PRIVACY COUNTEREXAMPLE — text package includes that text',leak.textModeHasExcerpt,leak);
 check('No pageerror during privacy test',errors.length===0,{errors});
 await page.screenshot({path:path.join(evidence,'v4-notes-privacy-repro.png'),fullPage:true});
} catch(e) {check('audit harness ran to completion',false,{message:e.message});}
finally {await ctx.close();await browser.close();close();}
const result={at:new Date().toISOString(),base:'Opus v4 PR #1 26bebee610076dd9cc3dc5f947206071ae921ff2',
  couldRun,cases,errors,kind:'counterexample-and-reproduction-not-owner-feedback'};
fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2));
console.log('AUDIT_SUMMARY',JSON.stringify(result));
if(!couldRun||errors.length||cases.some(x=>!x.pass))process.exitCode=1;
