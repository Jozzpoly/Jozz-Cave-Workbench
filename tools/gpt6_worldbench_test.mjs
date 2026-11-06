// Real Jaskinia v6.4.1 compositor smoke: NOT a fake two-iframe shell.
// Run after: python3 tools/render.py --app jaskinia --host web
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dist=path.join(root,'dist');
const witness=`<!doctype html><meta charset="utf-8"><title>Test witness</title>
<body>Source protocol fixture (not Rapier)</body><script>
const send = (data) => parent.postMessage(data,'*');
addEventListener('message', ev => {
 if(ev.source !== parent) return;
 const d=ev.data||{};
 if(d.jaskinia===1 && d.type==='hi')
  send({jaskinia:1,type:'hello',name:'Source protocol test',version:'v0',wants:['evidence']});
 if(d.protocol==='jozz-worldbench/v0' && d.type==='capture?' && typeof d.id==='string')
  send({protocol:'jozz-worldbench/v0',type:'capture',id:d.id,ok:true,
    record:{contract:'jozz-worldbench/v0',kind:'read-only-physical-witness',restorable:false,
     runtimeId:'test-only-not-rapier',simulation:{tick:42,selected:1,actors:[{id:1,x:3,y:2}],
     cargo:[],grips:[],fixture:'synthetic'}}});
});
</script>`;
fs.writeFileSync(path.join(dist,'_gpt6_witness_fixture.html'),witness);
const srv=await serve(dist);
const browser=await chromium.launch();
const errors=[];
try {
 const ctx=await browser.newContext({viewport:{width:1450,height:950},colorScheme:'dark'});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED/.test(m.text()))errors.push(m.text());});
 await page.goto(srv.base+'/jaskinia-web.html');
 await page.waitForFunction(()=>Boolean(window.Jaskinia?.ext?.worldbench && window.__JASK?.L),null,{timeout:25000});
 const intro=await page.evaluate(()=>{
  const anchor=__JASK.leafIds(__JASK.L.tree)[0];
  const origin=__JASK.L.wins[anchor].type;
  const lab=Jaskinia.ext.worldbench.openBeside(anchor,'przyrzad',{
    side:'right',share:.48,st:{url:'pokaz:pilki',title:'Physical demo'}});
  return {anchor,origin,lab,tree:__JASK.L.tree};
 });
 assert.equal(intro.tree.t,'s','a real native split node is created');
 await page.waitForFunction(id=>(__JASK.live().find(e=>e.id===id)?.hello?.name)==='Piłki',intro.lab,{timeout:12000});
 const originalBoot=await page.evaluate(id=>{
  const f=document.querySelector(`.win[data-id="${id}"] iframe`);
  return f?.contentWindow?.__boot || null;
 },intro.lab);
 assert.ok(originalBoot,'actual running instrument booted');
 const microscope=await page.evaluate(id=>Jaskinia.ext.worldbench.openBeside(id,'gpt6_mikroskop',{
  side:'right',share:.4}),intro.lab);
 await page.locator(`.win[data-id="${microscope}"] .gpt6-wb`).waitFor();
 const fallback=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),intro.lab);
 assert.equal(fallback.kind,'host-telemetry-only');
 assert.equal(fallback.source,null);
 assert.equal(fallback.host.hello.name,'Piłki');
 const afterBoot=await page.evaluate(id=>{
  const f=document.querySelector(`.win[data-id="${id}"] iframe`);
  return f?.contentWindow?.__boot || null;
 },intro.lab);
 assert.equal(afterBoot,originalBoot,'composing a microscope does not restart real laboratory');
 const div=page.locator('.jk-div.jk-dv:visible').last();
 const bounds=await div.boundingBox();
 assert.ok(bounds && bounds.height>20,'the parent has a physical draggable Jaskinia divider');
 const treeBefore=JSON.stringify(await page.evaluate(()=>__JASK.L.tree));
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 await page.mouse.down();
 await page.mouse.move(bounds.x+bounds.width/2+65,bounds.y+bounds.height/2,{steps:5});
 await page.mouse.up();
 const treeAfter=JSON.stringify(await page.evaluate(()=>__JASK.L.tree));
 assert.notEqual(treeAfter,treeBefore,'the real divider changes native layout');
 const fixtureURL=srv.base+'/_gpt6_witness_fixture.html';
 const numBefore=await page.evaluate(()=>Object.keys(__JASK.L.wins).length);
 const pair=await page.evaluate(url=>Jaskinia.ext.worldbench.launch(url),fixtureURL);
 assert.ok(pair.lab && pair.microscope,'native pair created from one call');
 await page.waitForFunction(id=>(__JASK.live().find(e=>e.id===id)?.hello?.name)==='Source protocol test',pair.lab,{timeout:12000});
 const proof=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(proof.kind,'source-reported-physical-witness');
 assert.equal(proof.source.simulation.tick,42);
 assert.equal(proof.source.restorable,false);
 assert.equal(await page.evaluate(()=>Object.keys(__JASK.L.wins).length),numBefore+2);
 await page.evaluate(()=>__JASK.undo());
 assert.equal(await page.evaluate(()=>Object.keys(__JASK.L.wins).length),numBefore,
  'one native undo removes the entire atomic pair');
 await page.evaluate(()=>__JASK.redo());
 assert.equal(await page.evaluate(()=>Object.keys(__JASK.L.wins).length),numBefore+2);
 // Independent phone context: API may compose, but no desktop divider is expected.
 const phone=await browser.newContext({...devices['Pixel 7'],colorScheme:'dark'});
 const mobile=await phone.newPage();
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(srv.base+'/jaskinia-web.html');
 await mobile.waitForFunction(()=>Boolean(window.Jaskinia?.ext?.worldbench&&window.__JASK?.phone),null,{timeout:25000});
 const n=await mobile.evaluate(url=>Jaskinia.ext.worldbench.launch(url),fixtureURL);
 assert.ok(n.lab && n.microscope);
 await mobile.screenshot({path:path.join(dist,'_gpt6_worldbench_phone.png')});
 await page.screenshot({path:path.join(dist,'_gpt6_worldbench_desktop.png')});
 await phone.close();
 await ctx.close();
 assert.deepEqual(errors,[],'no parent-window JavaScript errors');
 console.log('PASS: native split + live retention + source-bound evidence + divider drag + atomic undo/redo + phone composition');
}finally{await browser.close();await srv.close?.();}
