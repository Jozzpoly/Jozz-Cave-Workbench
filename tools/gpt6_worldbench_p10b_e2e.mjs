// Cross-repository source execution: genuine Jaskinia compositor hosts genuine Vite/Rapier P10b.
// Requires sibling checkout `combat-donor/dist/p10.html`. No public deployment or private data.
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const caveDist=path.join(root,'dist'), combatDist=path.join(root,'combat-donor/dist');
assert.ok(fs.existsSync(path.join(combatDist,'p10.html')),'exact donor must be built');
const cave=await serve(caveDist), combat=await serve(combatDist);
const browser=await chromium.launch();
const errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:1600,height:950},deviceScaleFactor:1,colorScheme:'dark'});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('parent: '+e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errors.push('parent console: '+m.text());});
 await page.goto(cave.base+'/jaskinia-web.html');
 await page.waitForFunction(()=>Boolean(window.Jaskinia?.ext?.worldbench),null,{timeout:25000});
 const p10=combat.base+'/p10.html';
 const pair=await page.evaluate(url=>Jaskinia.ext.worldbench.launch(url),p10);
 assert.ok(pair.lab&&pair.microscope);
 const target=page.frameLocator(`.win[data-id="${pair.lab}"] iframe`);
 await target.locator('body[data-p10-live="yes"]').waitFor({timeout:25000});
 try {
   await page.waitForFunction(id=>(__JASK.live().find(x=>x.id===id)?.hello?.name)==='Combat Lab · P10b',
     pair.lab,{timeout:6500});
 } catch(err) {
   const host=await page.evaluate(id=>{
     const e=__JASK.live().find(x=>x.id===id);
     return {entry:e||null,hosted:!!document.querySelector('.win[data-type="przyrzad"] iframe'),
       liveCount:__JASK.live().length};
   },pair.lab);
   const child=await target.locator('body').evaluate(()=>{
     return {live:document.body.dataset.p10Live,errors:document.body.dataset.p10Error||null,
       framed:window.parent!==window,origin:location.origin};
   });
   console.error('WITNESS HANDSHAKE DIAGNOSTIC',JSON.stringify({host,child,errors}));
   throw err;
 }
 const before=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(before.kind,'source-reported-physical-witness',
  'not merely declared telemetry: P10b v0 should opt into actual source trace');
 assert.equal(before.source.kind,'read-only-physical-witness');
 assert.equal(before.source.restorable,false);
 assert.ok(before.source.runtimeId);
 assert.equal(before.source.simulation.actors.length,3);
 assert.equal(before.source.simulation.cargo.length,5);
 assert.ok(Math.abs(before.source.simulation.aperture.width-2.2)<1e-4);
 // Real operator button in the actual cross-origin P10b iframe, not JS-mutated state.
 await target.locator('#pause').click();
 const paused=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(paused.source.paused,true);
 await target.locator('#open').click();
 const edited=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(edited.source.runtimeId,before.source.runtimeId,'same real Rapier runtime, no reloading');
 assert.ok(edited.source.simulation.aperture.width>3.4,'actual physical collider was moved');
 assert.ok(edited.source.simulation.materialEvents.edits>=1);
 assert.equal(edited.source.simulation.tick,paused.source.simulation.tick,
  'editing while paused did not secretly step the world');
 // An actual foreign Jaskinia window MUST NOT be able to edit without
 // an explicit permission gesture inside the already-running physical lab.
 const expectedFrom=source=>({runtimeId:source.runtimeId,
   aperture:source.simulation.aperture.width,edits:source.simulation.materialEvents.edits});
 const denied=await page.evaluate(({id,exp})=>Jaskinia.ext.worldbench.action(
   id,'p10b.aperture.widen',exp),{id:pair.lab,exp:expectedFrom(edited.source)});
 assert.equal(denied.ok,false);
 assert.equal(denied.error,'owner-opt-in-required');
 const afterDenial=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(afterDenial.source.simulation.aperture.width,edited.source.simulation.aperture.width);
 // Owner's actual local button grants this one live session physical edit authority.
 await target.locator('#wb-grant').click();
 const granted=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(granted.source.capabilities.ownerGrantedRemoteEdit,true);
 // Execute through the actual NATIVE Jaskinia microscope controls, not JS state mutation.
 const microscopy=page.locator(`.win[data-id="${pair.microscope}"] .gpt6-wb`);
 await microscopy.getByText('Uchwyć moment',{exact:true}).click();
 await microscopy.getByText('Poszerz fizyczną szczelinę',{exact:true}).click();
 await page.waitForFunction(id=>{
   const el=document.querySelector(`.win[data-id="${id}"] .gpt6-wb .wb-warning`);
   return el && el.textContent.includes('Źródło potwierdziło');
 },pair.microscope,{timeout:8000});
 const afterAction=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(afterAction.source.runtimeId,edited.source.runtimeId);
 assert.ok(afterAction.source.simulation.aperture.width>=edited.source.simulation.aperture.width+1.29);
 assert.equal(afterAction.source.simulation.materialEvents.edits,
   edited.source.simulation.materialEvents.edits+1);
 assert.equal(afterAction.source.simulation.tick,edited.source.simulation.tick);
 const stale=await page.evaluate(({id,exp})=>Jaskinia.ext.worldbench.action(
   id,'p10b.aperture.narrow',exp),{id:pair.lab,exp:expectedFrom(edited.source)});
 assert.equal(stale.ok,false);
 assert.equal(stale.error,'stale-physical-state');
 await microscopy.getByText('Cofnij poszerzenie',{exact:true}).click();
 await page.waitForFunction(({id,width})=>{
   const el=document.querySelector(`.win[data-id="${id}"] .gpt6-wb .wb-warning`);
   return el && el.textContent.includes('Źródło potwierdziło') &&
     el.textContent.includes('→ '+width+' m');
 },{id:pair.microscope,width:edited.source.simulation.aperture.width},{timeout:8000});
 const reversed=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(reversed.source.simulation.aperture.width,edited.source.simulation.aperture.width);
 assert.equal(reversed.source.simulation.materialEvents.edits,
   edited.source.simulation.materialEvents.edits+2);
 const ruler=page.locator('.jk-div.jk-dv:visible').last(), box=await ruler.boundingBox();
 assert.ok(box,'actual native Jaskinia splitter exists');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2,{steps:6});
 await page.mouse.up();
 const reflow=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(reflow.source.runtimeId,reversed.source.runtimeId,
  'native resize preserved active Rapier world and actual physical edits');
 assert.equal(reflow.source.simulation.aperture.width,reversed.source.simulation.aperture.width);
 // Verify source observation and host time, without claiming an authoritative solver checkpoint.
 assert.ok(reflow.host.hostObservedAt && reflow.host.address===p10);
 assert.equal(reflow.source.sourceRevisionClaim,null);
 // This is NOT a PASS for Owner usability. Measure how much of the true
 // physics canvas remains visible inside a native split before promoting UX.
 const viewport=await target.locator('body').evaluate(()=>{
   const stage=document.querySelector('.stage').getBoundingClientRect();
   const aside=document.querySelector('aside').getBoundingClientRect();
   const height=innerHeight,width=innerWidth;
   const visibleHeight=Math.max(0,Math.min(height,stage.bottom)-Math.max(0,stage.top));
   return {width,height,canvasWidth:Math.round(stage.width),canvasHeight:Math.round(stage.height),
     canvasVisibleFraction:+(visibleHeight/Math.max(1,stage.height)).toFixed(3),
     controlsBelowWorld:aside.top>=stage.bottom,controlsTop:Math.round(aside.top)};
 });
 console.log('OWNER-VIEW GEOMETRY (NOT FEEL PASS):',JSON.stringify(viewport));
 assert.ok(viewport.canvasVisibleFraction>=0.70,
   'Owner-critical: the physical world must be genuinely visible in native Jaskinia window, not below fold');
 assert.ok(viewport.canvasWidth>=150 && viewport.canvasHeight>=150,
   'Owner-critical: physical world cannot shrink into a token-sized preview');
 await page.screenshot({path:path.join(caveDist,'_gpt6_worldbench_p10b_desktop.png'),fullPage:true});
 await ctx.close();
 assert.deepEqual(errors,[]);
 console.log('PASS cross-repo: native Jaskinia + real Rapier edits + owner permission + stale rejection + reverse + runtime survival');
}finally{await browser.close();cave.close();combat.close();}
