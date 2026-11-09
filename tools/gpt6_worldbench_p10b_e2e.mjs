// Cross-repository source execution: genuine Jaskinia compositor hosts genuine Vite/Rapier P10b.
// Requires sibling checkout `combat-donor/dist/p10.html`. No public deployment or private data.
import {chromium,devices} from 'playwright';
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
 // Alternative UX: one dedicated workbench with 71% width for real physical
 // world, instead of shrinking the lab among unrelated library windows.
 // It must preserve the *original* running lab in its original workspace.
 const focused=await page.evaluate(url=>Jaskinia.ext.worldbench.launchFocus(url),p10);
 assert.equal(focused.independentRuntime,true);
 assert.equal(await page.evaluate(()=>__JASK.store.cur),focused.spaceId);
 const focusedTree=await page.evaluate(()=>__JASK.L.tree);
 assert.equal(focusedTree.t,'s');
 assert.ok(focusedTree.r>=0.70);
 const focusFrame=page.frameLocator(`.win[data-id="${focused.lab}"] iframe`);
 await focusFrame.locator('body[data-p10-live="yes"]').waitFor({timeout:25000});
 await page.waitForFunction(id=>(__JASK.live().find(x=>x.id===id)?.hello?.name)==='Combat Lab · P10b',
   focused.lab,{timeout:12000});
 const focusSample=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),focused.lab);
 assert.equal(focusSample.kind,'source-reported-physical-witness');
 assert.notEqual(focusSample.source.runtimeId,reflow.source.runtimeId,
  'focus launch must never pretend an independent physical world is the old session');
 const focusedView=await focusFrame.locator('body').evaluate(()=>{
   const stage=document.querySelector('.stage').getBoundingClientRect();
   const visible=Math.max(0,Math.min(innerHeight,stage.bottom)-Math.max(0,stage.top));
   return {width:innerWidth,height:innerHeight,canvasWidth:Math.round(stage.width),
     visibleFraction:+(visible/Math.max(1,stage.height)).toFixed(3)};
 });
 assert.ok(focusedView.canvasWidth>600,'focus workspace must actually give the world useful horizontal area');
 assert.ok(focusedView.visibleFraction>=.70,'focused native space keeps physics in view');
 console.log('FOCUSED WORKSPACE GEOMETRY:',JSON.stringify(focusedView));
 await page.waitForFunction(id=>{
   const e=__JASK.live().find(v=>v.id===id);
   return e?.state?.data?.selectedActor?.kind==='small';
 },focused.lab,{timeout:6000});
 await page.waitForFunction(id=>{
   const el=document.querySelector(`.win[data-id="${id}"] .gpt6-wb .wb-context`);
   return el?.textContent?.includes('AKTYWNE CIAŁO · small')===true;
 },focused.microscope,{timeout:6000});
 // Real operator input to game changes selected physical body; the live Jaskinia
 // microscope must follow without a manual "Capture" press.
 await focusFrame.locator('#world').click({position:{x:32,y:32}});
 await page.keyboard.press('2');
 await page.waitForFunction(id=>{
   const e=__JASK.live().find(v=>v.id===id);
   return e?.state?.data?.selectedActor?.kind==='bulky';
 },focused.lab,{timeout:6000});
 await page.waitForFunction(id=>{
   const el=document.querySelector(`.win[data-id="${id}"] .gpt6-wb .wb-context`);
   return el?.textContent?.includes('AKTYWNE CIAŁO · bulky')===true;
 },focused.microscope,{timeout:6000});
 const bodyContext=await page.evaluate(id=>__JASK.live().find(v=>v.id===id).state.data.selectedActor,focused.lab);
 assert.ok(bodyContext.mass>0 && Number.isFinite(bodyContext.x));
 console.log('LIVE SELECTED-BODY CONTEXT:',JSON.stringify(bodyContext));
 await page.screenshot({path:path.join(caveDist,'_gpt6_worldbench_focus.png'),fullPage:true});
 // NEGATIVE-FIRST continuity probe. Keeping a frame alive is NOT the same as
 // keeping a world progressing while hidden. Measure actual solver ticks, not
 // just stable runtime IDs or screenshot appearance.
 const visibleBefore=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),focused.lab);
 await page.waitForTimeout(850);
 const visibleAfter=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),focused.lab);
 const visibleTicks=visibleAfter.source.simulation.tick-visibleBefore.source.simulation.tick;
 assert.ok(visibleTicks>3, 'continuity baseline: visible Rapier world must actually progress');
 // Obtain actual Rapier tick THROUGH THE HIDDEN IFRAME while it is still
 // hidden: the former return-then-capture method accidentally counted the
 // first resumed rAF steps as possible background physics.
 const readAnySpace=async(id)=>page.evaluate(async id=>{
   const rt=__JASK.RT.get(id),frame=rt?.el?.querySelector('iframe');
   if(!frame?.contentWindow)return {ok:false,error:'source frame unavailable'};
   const target=frame.contentWindow;
   const token='hiddenprobe-'+Math.random().toString(36).slice(2,14);
   const origin=new URL(frame.src).origin;
   return await new Promise(resolve=>{
     const timeout=setTimeout(()=>{removeEventListener('message',onMessage);
       resolve({ok:false,error:'no reply from iframe while hidden'});},1300);
     function onMessage(ev){
       if(ev.source!==target||ev.origin!==origin||
          ev.data?.protocol!=='jozz-worldbench/v0'||
          ev.data?.type!=='capture'||ev.data?.id!==token)return;
       clearTimeout(timeout);removeEventListener('message',onMessage);
       const record=ev.data?.record;
       resolve({ok:ev.data.ok===true,frameHidden:rt.el.hidden,
         frameConnected:frame.isConnected,hostSpace:__JASK.store.cur,
         reportedRuntimeId:record?.runtimeId||null,
         reportedAt:record?.capturedByLabAt||null,
         tick:record?.simulation?.tick??null,error:ev.data.error||null});
     }
     addEventListener('message',onMessage);
     target.postMessage({protocol:'jozz-worldbench/v0',type:'capture?',id:token},origin);
   });
 },id);
 await page.evaluate(id=>__JASK.setSpace(id),focused.from);
 await page.waitForTimeout(140);
 const hiddenFirst=await readAnySpace(focused.lab);
 await page.waitForTimeout(1080);
 const hiddenSecond=await readAnySpace(focused.lab);
 assert.equal(hiddenFirst.frameHidden,true,'must measure while host has ACTUALLY hidden source');
 assert.equal(hiddenSecond.frameHidden,true);
 assert.equal(hiddenFirst.ok,true,'source must answer a bounded read during hidden state');
 assert.equal(hiddenSecond.ok,true);
 assert.equal(hiddenSecond.reportedRuntimeId,visibleAfter.source.runtimeId);
 const genuinelyHiddenTicks=hiddenSecond.tick-hiddenFirst.tick;
 assert.ok(genuinelyHiddenTicks>=0,'monotonic true physics tick across two hidden observations');
 await page.evaluate(id=>__JASK.setSpace(id),focused.spaceId);
 const resumed=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),focused.lab);
 const firstVisibleAfterSwitch=resumed.source.simulation.tick-hiddenSecond.tick;
 const correctedContinuity={visibleTicks,visibleMs:850,
   firstHiddenTick:hiddenFirst.tick,secondHiddenTick:hiddenSecond.tick,
   hiddenIntervalMs:1080,hiddenTicks:genuinelyHiddenTicks,
   resumedTick:resumed.source.simulation.tick,
   resumeBoundaryTicks:firstVisibleAfterSwitch,
   sameRuntime:resumed.source.runtimeId===visibleAfter.source.runtimeId};
 console.log('HIDDEN-TIME DIRECT-WITNESS PROBE:',JSON.stringify(correctedContinuity));
 assert.equal(correctedContinuity.sameRuntime,true,'same actual Rapier runtime survived hiding');
 // No universal background execution assumption: recording actual evidence
 // rather than imposing a policy that hidden games must always keep ticking.
 await page.evaluate(id=>__JASK.setSpace(id),focused.from);
 const returned=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(returned.source.runtimeId,reflow.source.runtimeId,'original world survives detour to dedicated workspace');
 assert.equal(returned.source.simulation.aperture.width,reversed.source.simulation.aperture.width);
 await page.evaluate(id=>__JASK.setSpace(id),focused.spaceId);
 const focusReturn=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),focused.lab);
 assert.equal(focusReturn.source.runtimeId,focusSample.source.runtimeId,
  'dedicated experiment workspace returns without restarting its world');
 await ctx.close();
 // A second genuine P10b Rapier runtime on touch mobile. Jaskinia's native
 // one-window-at-a-time dock must preserve it when opening the microscope.
 const phoneCtx=await browser.newContext({...devices['Pixel 7'],colorScheme:'dark'});
 const mobile=await phoneCtx.newPage();
 mobile.on('pageerror',e=>errors.push('phone parent: '+e.message));
 await mobile.goto(cave.base+'/jaskinia-web.html');
 await mobile.waitForFunction(()=>Boolean(window.Jaskinia?.ext?.worldbench),null,{timeout:25000});
 const pairPhone=await mobile.evaluate(url=>Jaskinia.ext.worldbench.launchFocus(url),p10);
 const mobileLab=mobile.frameLocator(`.win[data-id="${pairPhone.lab}"] iframe`);
 await mobileLab.locator('body[data-p10-live="yes"]').waitFor({timeout:25000});
 await mobile.waitForFunction(id=>(__JASK.live().find(e=>e.id===id)?.hello?.name)==='Combat Lab · P10b',
   pairPhone.lab,{timeout:12000});
 const mobileBefore=await mobile.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pairPhone.lab);
 assert.equal(mobileBefore.kind,'source-reported-physical-witness');
 await mobileLab.locator('#pause').tap();
 await mobileLab.locator('#open').tap();
 const mobileChanged=await mobile.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pairPhone.lab);
 assert.equal(mobileChanged.source.paused,true);
 assert.ok(mobileChanged.source.simulation.aperture.width>3.4);
 const mGeometry=await mobileLab.locator('body').evaluate(()=>{
   const stage=document.querySelector('.stage').getBoundingClientRect();
   const height=Math.max(0,Math.min(innerHeight,stage.bottom)-Math.max(0,stage.top));
   return {width:innerWidth,height:innerHeight,stageWidth:stage.width,
     visibleFraction:+(height/Math.max(1,stage.height)).toFixed(3)};
 });
 assert.ok(mGeometry.visibleFraction>=.6 && mGeometry.stageWidth>=250,
   'phone Jaskinia must keep physical stage visible, not only responsive iframe loaded');
 await mobile.locator('.jk-dock .dk-i').nth(1).tap();
 await mobile.locator(`.win[data-id="${pairPhone.microscope}"] .gpt6-wb .wb-context`)
   .waitFor({timeout:8000});
 await mobile.waitForFunction(id=>document.querySelector(
   `.win[data-id="${id}"] .gpt6-wb .wb-context`)?.textContent?.includes('AKTYWNE CIAŁO'),
   pairPhone.microscope,{timeout:8000});
 await mobile.screenshot({path:path.join(caveDist,'_gpt6_worldbench_p10b_phone.png')});
 await mobile.locator('.jk-dock .dk-i').nth(0).tap();
 const mobileReturned=await mobile.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pairPhone.lab);
 assert.equal(mobileReturned.source.runtimeId,mobileChanged.source.runtimeId,
   'phone dock switch must not restart physical source');
 assert.equal(mobileReturned.source.simulation.aperture.width,mobileChanged.source.simulation.aperture.width);
 console.log('REAL PHONE PHYSICS GEOMETRY:',JSON.stringify(mGeometry));
 await phoneCtx.close();
 assert.deepEqual(errors,[]);
 console.log('PASS cross-repo: native Jaskinia + real Rapier edits + owner permission + stale rejection + reverse + runtime survival');
}finally{await browser.close();cave.close();combat.close();}
