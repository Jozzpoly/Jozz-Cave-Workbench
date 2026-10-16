/* GPT TEMPORARY: full Jaskinia source-generated E2E, isolated branch only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
    return new URL(url).pathname.endsWith('/experiments/gpt-temporary-connected-instruments-2026-10-16/adapter.html');
  });
  for(let i=0;i<2;i++) await instrumentWindows.nth(i).getByRole('button',{name:'Załaduj instrument'}).click();
  await page.waitForFunction(()=>window.__JASK_GPT_TEMP?.list().filter(x=>x.ready).length===2,{timeout:10000});
  await test('two actual sandbox iframes READY',async()=>{
    const s=await probe();return s.length===2&&s.every(x=>x.ready);
  });
  for(let i=0;i<2;i++)await instrumentWindows.nth(i).getByRole('button',{name:'Połącz z wyborem projektu'}).click();
  const names=await evaluate(()=>window.__BIB.D.repos.filter(r=>r.private===false).slice(0,3).map(r=>r.name));
  assert(names.length>=3,'enough public projects');
  await evaluate(n=>window.__JASK.select(n),names[0]);
  await acked(names[0]);
  await evaluate(n=>window.__JASK.select(n),names[1]);
  await acked(names[1]);
  await test('both independently ACK same new project',async()=>{
    const s=await probe();return s.every(x=>x.lastAck?.project===names[1]);
  });
  await test('recipient UI visibly applied actual project (not just self-reported ACK)',async()=>{
    const texts=[];
    for(let i=0;i<2;i++) texts.push(await instrumentWindows.nth(i).frameLocator('iframe').locator('#project').textContent());
    return texts.every(t=>t===names[1]);
  });
  const shotdir=path.join(root,'shots'); fs.mkdirSync(shotdir,{recursive:true});
  await page.screenshot({path:path.join(shotdir,'gpt-temp-real-jaskinia.png'),fullPage:true});
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
  await instrumentWindows.first().frameLocator('iframe').getByRole('button',{name:'Pomiń następny ACK: OFF'}).click();
  await evaluate(n=>window.__JASK.select(n),names[2]);
  await acked(names[2],1);
  await page.waitForTimeout(2000);
  await test('one missing ACK yields uncertainty while independent peer succeeds',async()=>{
    const q=await probe();
    return q.filter(x=>x.lastAck?.project===names[2]).length===1 &&
      q.filter(x=>x.history.some(h=>h.includes('timeout'))).length===1 &&
      q.every(x=>x.pending===null);
  });
  await test('lost ACK does not imply recipient failed to act',async()=>{
    return (await instrumentWindows.first().frameLocator('iframe').locator('#project').textContent())===names[2];
  });
  await instrumentWindows.first().frameLocator('iframe').getByRole('button',{name:'Wyślij fałszywy/stary ACK'}).click();
  await test('stale/forged ACK rejected on actual Jaskinia',async()=>{
    await page.waitForTimeout(150);
    return (await probe()).some(x=>x.history.some(h=>h.includes('Odrzucono przestarzały')));
  });
  await instrumentWindows.first().getByRole('button',{name:'Rozłącz wybór projektu'}).click();
  await evaluate(n=>window.__JASK.select(n),names[0]);
  await acked(names[0],1);
  await test('unlink suppresses selection relay to that instrument',async()=>{
    const q=await probe();
    return q.filter(x=>x.linked).length===1 &&
      q.filter(x=>x.lastAck?.project===names[0]).length===1 &&
      (await instrumentWindows.first().frameLocator('iframe').locator('#project').textContent())===names[2];
  });
  await evaluate(()=>window.__JASK.commit('GPT TEMP dispose instrument',L=>{
    const id=Object.keys(L.wins).find(id=>L.wins[id].type==='gpt_instrument_temp');
    L.wins[id].type='wybor';L.wins[id].st={};
  }));
  await test('disposing one instrument removes only its subscription',async()=>(await probe()).length===1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__JASK?.store);
  await test('reload preserves layout but does NOT auto-connect external instruments',async()=>
    (await evaluate(()=>Object.values(window.__JASK.L.wins).filter(w=>w.type==='gpt_instrument_temp').length))===1 &&
    (await probe()).every(x=>!x.linked&&!x.ready));
  await test('real mobile: touch-sized Jaskinia instrument, restore and ACK',async()=>{
    const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const mob=await mobileContext.newPage();
    mob.on('pageerror', e=>errors.push('mobile pageerror: '+e.message));
    try {
      await mob.goto(server.base+'/dist/jaskinia-web.html',{waitUntil:'domcontentloaded',timeout:30000});
      await mob.waitForFunction(()=>!!window.__JASK?.store,{timeout:15000});
      if(!await mob.evaluate(()=>window.__JASK.phone))return false;
      await mob.evaluate(()=>{
        const id=window.__JASK.leafIds(window.__JASK.L.tree)[0];
        window.__JASK.commit('GPT TEMP mobile instrument',L=>{
          L.wins[id].type='gpt_instrument_temp';L.wins[id].st={};
        });
      });
      const box=mob.locator('.win[data-type="gpt_instrument_temp"]');
      await box.getByRole('button',{name:'Załaduj instrument'}).click({timeout:5000});
      await mob.waitForFunction(()=>window.__JASK_GPT_TEMP.list().some(x=>x.ready),{timeout:8000});
      await box.getByRole('button',{name:'Połącz z wyborem projektu'}).click({timeout:5000});
      const publics=await mob.evaluate(()=>window.__BIB.D.repos.filter(r=>r.private===false).slice(0,2).map(r=>r.name));
      await mob.evaluate(n=>window.__JASK.select(n),publics[0]);
      await mob.waitForFunction(n=>window.__JASK_GPT_TEMP.list().some(x=>x.lastAck?.project===n),publics[0],{timeout:7000});
      await mob.screenshot({path:path.join(root,'shots','gpt-temp-real-mobile.png'),fullPage:true});
      await mob.evaluate(()=>window.__JASK.setSpace('granie'));
      await mob.evaluate(n=>window.__JASK.select(n),publics[1]);
      await mob.evaluate(()=>window.__JASK.setSpace('przeglad'));
      await mob.waitForFunction(n=>window.__JASK_GPT_TEMP.list().some(x=>x.lastAck?.project===n),publics[1],{timeout:7000});
      const actual=await box.frameLocator('iframe').locator('#project').textContent();
      return actual===publics[1];
    } finally {await mobileContext.close();}
  });
  await test('real source observer: distinguish GitHub GET evidence from mere iframe ACK',async()=>{
    const win=page.locator('.win[data-type="gpt_instrument_temp"]').first();
    const src=server.base+'/experiments/gpt-temporary-connected-instruments-2026-10-16/live-repo.html';
    await win.locator('input[aria-label="Adres instrumentu"]').fill(src);
    await win.getByRole('button',{name:'Załaduj instrument'}).click();
    await page.waitForFunction(()=>window.__JASK_GPT_TEMP.list().some(x=>x.ready),{timeout:7000});
    await win.getByRole('button',{name:'Połącz z wyborem projektu'}).click();
    await evaluate(n=>window.__JASK.select(n),names[0]);
    await page.waitForFunction(()=>window.__JASK_GPT_TEMP.list().some(x=>x.lastAck?.project==='Mini_Feniks'||x.lastAck?.project===window.__BIB.D.repos[0].name),{timeout:8000});
    const inner=win.frameLocator('iframe');
    await inner.locator('#status').waitFor({timeout:6000});
    let observed='';
    for(let i=0;i<70;i++){
      observed=await inner.locator('#status').textContent();
      if(observed.includes('GET HTTP 200')||observed.includes('NIEZNANE'))break;
      await page.waitForTimeout(160);
    }
    const actual=await inner.locator('#sha').textContent();
    const state=(await probe())[0];
    console.log('LIVE_GITHUB_OBSERVATION',JSON.stringify({project:names[0],status:observed,sha:actual,receiverClaim:state?.observation}));
    await page.screenshot({path:path.join(root,'shots','gpt-temp-live-source.png'),fullPage:true});
    if(observed.includes('GET HTTP 200')){
      return /^[a-f0-9]{40}$/.test(actual)&&
        (await probe()).some(x=>x.observation?.sha===actual&&x.observation.verification==='receiver-claimed-only');
    }
    return observed.includes('NIEZNANE')&&actual==='NIEZNANY'&&(await probe()).every(x=>!x.observation);
  });
  await test('no runtime console/page errors',()=>errors.length===0);
} finally {
  console.log('SUMMARY',JSON.stringify({pass:checks.length,fail:failures.length,failures,errors}));
  await page.close(); await browser.close(); server.close();
}
if(failures.length||errors.length)process.exit(1);
