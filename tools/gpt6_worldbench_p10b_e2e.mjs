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
 await page.waitForFunction(id=>(__JASK.live().find(x=>x.id===id)?.hello?.name)==='Combat Lab · P10b',pair.lab,{timeout:15000});
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
 const ruler=page.locator('.jk-div.jk-dv:visible').last(), box=await ruler.boundingBox();
 assert.ok(box,'actual native Jaskinia splitter exists');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2,{steps:6});
 await page.mouse.up();
 const reflow=await page.evaluate(id=>Jaskinia.ext.worldbench.capture(id),pair.lab);
 assert.equal(reflow.source.runtimeId,edited.source.runtimeId,
  'native resize preserved active Rapier world and actual physical edits');
 assert.equal(reflow.source.simulation.aperture.width,edited.source.simulation.aperture.width);
 // Verify source observation and host time, without claiming an authoritative solver checkpoint.
 assert.ok(reflow.host.hostObservedAt && reflow.host.address===p10);
 assert.equal(reflow.source.sourceRevisionClaim,null);
 await page.screenshot({path:path.join(caveDist,'_gpt6_worldbench_p10b_desktop.png'),fullPage:true});
 await ctx.close();
 assert.deepEqual(errors,[]);
 console.log('PASS cross-repo: real Jaskinia native split + real P10b Rapier collider edit + source witness + runtime survival');
}finally{await browser.close();cave.close();combat.close();}
