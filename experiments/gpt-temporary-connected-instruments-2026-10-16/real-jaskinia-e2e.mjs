/* GPT TEMPORARY: full Jaskinia source-generated E2E, isolated branch only. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../../tools/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const server = await serve(root);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1580, height: 940 } });
const failures = [], checks = [], errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const test = async (name, fn) => {
  try { const value = await fn(); assert.ok(value, name); checks.push(name); console.log('PASS', name); }
  catch(e) { failures.push(name+': '+e.message); console.log('FAIL', name, e.message); }
};
const evaluate = (fn, arg) => page.evaluate(fn, arg);
const probe = () => evaluate(() => window.__JASK_GPT_TEMP.list().sort((a,b)=>a.id.localeCompare(b.id)));
const acked = async (name,n=2) => {
  await page.waitForFunction(({name,n}) => {
    const a=window.__JASK_GPT_TEMP?.list()||[];
    return a.filter(s=>s.lastAck?.project===name).length===n;
  }, {name,n}, {timeout:8000});
};
try {
  await page.goto(server.base+'/dist/jaskinia-web.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(() => !!window.__JASK?.store,{timeout:15000});
  await test('REAL full Jaskinia boot and 24 public repos',async()=>evaluate(()=>
    window.__BIB?.D.repos.length===24 && window.__JASK?.store?.spaces?.length>=5));
  await test('module inserted into actual generated registry',async()=>evaluate(()=>
    !!document.querySelector('.jk') && !!window.__JASK_GPT_TEMP && !!document.querySelector('.jk-stage')));
  await evaluate(() => {
    const ids=window.__JASK.leafIds(window.__JASK.L.tree).slice(0,2);
    window.__JASK.commit('GPT TEMP: two actual instrument windows', L=>{
      for(const id of ids){L.wins[id].type='gpt_instrument_temp';L.wins[id].st={};}
    });
  });
  await page.locator('.win[data-type="gpt_instrument_temp"]').first().waitFor({timeout:7000});
  const instrumentWindows=page.locator('.win[data-type="gpt_instrument_temp"]');
  await test('two actual movable Jaskinia instrument windows',async()=>(await instrumentWindows.count())===2);
  await test('fixture points to repo path, not /dist/',async()=>{
    const url=await instrumentWindows.first().locator('input').inputValue();
    return /\\/experiments\\/gpt-temporary-connected-instruments-2026-10-16\\/adapter\\.html$/.test(new URL(url).pathname);
  });
  for(let i=0;i<2;i++) await instrumentWindows.nth(i).getByRole('button',{name:'Załaduj instrument'}).click();
  await page.waitForFunction(()=>window.__JASK_GPT_TEMP?.list().filter(x=>x.ready).length===2,{timeout:10000});
  await test('two actual sandbox iframes READY',async()=>{
    const s=await probe();return s.length===2&&s.every(x=>x.ready);
  });
  for(let i=0;i<2;i++)await instrumentWindows.nth(i).getByRole('button',{name:'Połącz z wyborem projektu'}).click();
  const names=await evaluate(()=>window.__BIB.D.repos.filter(r=>r.private===false).slice(0,3).map(r=>r.name));
  assert(names.length>=3,'enough public projects');
  await acked(names[0]);
  await evaluate(n=>window.__JASK.select(n),names[1]);
  await acked(names[1]);
  await test('both independently ACK same new project',async()=>{
    const s=await probe();return s.every(x=>x.lastAck?.project===names[1]);
  });
  await test('genuine sandboxed frames lack same-origin',async()=>evaluate(()=>{
    const f=document.querySelector('.win[data-type="gpt_instrument_temp"] iframe');
    try{return f.contentWindow.document===undefined;}catch{return true;}
  }));
  await test('switch selection does not recreate iframes',async()=>{
    const count=await evaluate(()=>[...document.querySelectorAll('.win[data-type="gpt_instrument_temp"] iframe')].map(e=>e.dataset.seq=(e.dataset.seq||'')+'X'));
    await evaluate(n=>window.__JASK.select(n),names[2]);
    await acked(names[2]);
    return (await evaluate(()=>[...document.querySelectorAll('.win[data-type="gpt_instrument_temp"] iframe')].map(e=>e.dataset.seq))).join(',')===count.join(',');
  });
  await test('private project identity blocked from instrument',async()=>{
    await evaluate(n=>{window.__BIB.R[n].private=true;window.__JASK.select(n)},names[1]);
    await page.waitForTimeout(180);
    const s=await probe();
    await evaluate(n=>{window.__BIB.R[n].private=false},names[1]);
    return s.every(x=>x.lastAck?.project===names[2]&&x.history.some(t=>t.includes('prywatny')));
  });
  await evaluate(n=>window.__JASK.select(n),names[0]); await acked(names[0]);
  await page.locator('.jk-tab[data-sp="granie"]').click();
  await evaluate(n=>window.__JASK.select(n),names[1]);
  await page.locator('.jk-tab[data-sp="przeglad"]').click();
  await test('instrument catches up when returning to workspace',async()=>{
    try{await acked(names[1]);return true;}catch{return false;}
  });
  await test('no runtime console/page errors',()=>errors.length===0);
} finally {
  console.log('SUMMARY',JSON.stringify({pass:checks.length,fail:failures.length,failures,errors}));
  await page.close(); await browser.close(); server.close();
}
if(failures.length||errors.length)process.exit(1);
