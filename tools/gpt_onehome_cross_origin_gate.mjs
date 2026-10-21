// Research-only off-origin, lab-owned, one-operation handoff. NOT a shipping bridge.
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist'),donor=path.join(root,'medium/experiments/received-workpieces/przesmyk-kowal-2026-10-18');
if(fs.statSync(path.join(dist,'jaskinia-web.html')).size!==2450637)throw Error('Pinned public Jaskinia host not available');
const host=await serve(dist),homeOrigin=new URL(host.base).origin;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'onehome-offorigin-'));
const sourceName='two-instruments-one-world-gpt6.html',targetName='second-life-signal-gpt6.html';

function sourceAdapter(HOST){
 const ACT='medium.przesmyk-variant.try-signal-v0';
 const strip=document.createElement('section');strip.id='off-origin-action';
 strip.style.cssText='display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:10px 12px;margin:10px 0 14px;border:1px solid #386274;border-radius:10px;background:#0c2430';
 const button=document.createElement('button');button.className='minor';button.id='off-origin-try';button.textContent='Sprawdź w ŚLADZIE';
 const output=document.createElement('output');output.id='off-origin-outcome';output.setAttribute('aria-live','polite');
 output.style.cssText='flex:1 1 250px;min-width:0;color:#b6dfde;font-size:13px;line-height:1.4';
 output.textContent='Dwa różne światy · wspólna autorska topologia';
 strip.append(button,output);document.querySelector('.bottom').insertAdjacentElement('afterend',strip);
 let nonce=0;
 button.addEventListener('click',()=>parent.postMessage({mediumOffOrigin:1,type:'request',nonce:++nonce,action:ACT,workpiece:__mediumPortable.get()},HOST));
 addEventListener('message',e=>{
   if(e.source!==parent||e.origin!==HOST||e.data?.mediumOffOrigin!==1)return;
   if(e.data.type==='describe')parent.postMessage({mediumOffOrigin:1,type:'description',actions:[{
     key:ACT,label:'Zobacz konstrukcję w ŚLADZIE',input:'medium.przesmyk.variant.v1',
     effect:'new interpretation',not:'not the same world or simulation checkpoint'
   }]},HOST);
   if(e.data.type==='receipt')output.textContent=e.data.ok?
     ('ŚLAD: '+(e.data.analysis?.reach?'trasa '+e.data.analysis.cost+' kroków siatki':'brak trasy')+' · nowa interpretacja'):
     ('ŚLAD: odmowa · '+e.data.error+' · poprzedni wariant zachowany');
 });
}
function receiverAdapter(HOST){
 addEventListener('message',e=>{
   if(e.source!==parent||e.origin!==HOST||e.data?.mediumOffOrigin!==1||e.data.type!=='offer')return;
   const msg=e.data,old=JSON.stringify(__mediumSignal.get());
   let answer;
   try{
     if(msg.action!=='medium.przesmyk-variant.try-signal-v0')throw Error('Nieznana operacja');
     const current=__mediumSignal.get();
     const candidate={...msg.workpiece,mediumSignal:{receiver:current.mediumSignal.receiver}};
     const json=JSON.stringify(candidate);if(json.length>120000)throw Error('Zbyt duży wariant');
     const applied=__mediumSignal.import(json),observed=__mediumSignal.status();
     answer={ok:true,receiver:applied.mediumSignal.receiver,analysis:{
       reach:!!observed.reach,cost:Number.isFinite(observed.travel)?Math.round(observed.travel):null}};
   }catch(err){answer={ok:false,error:String(err.message),atomic:old===JSON.stringify(__mediumSignal.get())};}
   parent.postMessage({mediumOffOrigin:1,type:'outcome',nonce:msg.nonce,...answer},HOST);
 });
}
function writeDonor(file,fn){
 const orig=fs.readFileSync(path.join(donor,file),'utf8');
 if(!orig.includes('</body>'))throw Error('Real donor unexpected structure');
 const script='<script>('+fn.toString()+')('+JSON.stringify(homeOrigin)+')</script>';
 fs.writeFileSync(path.join(tmp,file),orig.replace('</body>',script+'</body>'));
}
writeDonor(sourceName,sourceAdapter);writeDonor(targetName,receiverAdapter);
const labs=await serve(tmp),labOrigin=new URL(labs.base).origin;
if(labOrigin===homeOrigin)throw Error('Unexpected matching origins');
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:1490,height:940}});
await ctx.addInitScript(()=>{window.__JASK_PLACE='web';try{localStorage.setItem('jaskinia:hint','1')}catch{}});
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const srcUrl=labs.base+'/'+sourceName,dstUrl=labs.base+'/'+targetName;
let pass=0,fail=0;const check=(cond,msg,d)=>{console.log(cond?'PASS':'FAIL',msg,d?JSON.stringify(d):'');cond?pass++:fail++};
try{
 await page.goto(host.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.Jaskinia?.ext?.open);
 const ids=[];
 for(const url of [srcUrl,dstUrl])ids.push(await page.evaluate(url=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url,title:'Medium off-origin research'}}),url));
 const [srcId,dstId]=ids;
 await page.waitForFunction(ids=>ids.every(id=>!!document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow),ids);
 const started=await page.evaluate(({ids,origin})=>{
   const frame=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
   const source=frame(ids[0]),recipient=frame(ids[1]);
   window.__mediumOff={descriptions:[],requests:[],results:[],ignored:[],pending:new Set()};
   const witness=window.__mediumOff;
   window.addEventListener('message',e=>{
     if(e.origin!==origin||e.data?.mediumOffOrigin!==1)return;
     const d=e.data;
     if(e.source===source&&d.type==='description')witness.descriptions.push(d);
     else if(e.source===source&&d.type==='request'&&d.action==='medium.przesmyk-variant.try-signal-v0'){
       if(!Number.isInteger(d.nonce)||d.nonce<1||witness.pending.has(d.nonce)||d.workpiece?.schema!=='medium.przesmyk.variant.v1'||JSON.stringify(d.workpiece).length>120000){
         witness.ignored.push('bad request');return;
       }
       witness.pending.add(d.nonce);witness.requests.push(d.nonce);
       recipient.postMessage({...d,mediumOffOrigin:1,type:'offer'},origin);
     }else if(e.source===recipient&&d.type==='outcome'&&witness.pending.has(d.nonce)){
       witness.pending.delete(d.nonce);witness.results.push(d);
       source.postMessage({...d,mediumOffOrigin:1,type:'receipt'},origin);
     }else witness.ignored.push('bad source');
   });
   let blocked=false;
   try{void source.__mediumPortable.get()}catch(e){blocked=e.name==='SecurityError'}
   source.postMessage({mediumOffOrigin:1,type:'describe'},origin);
   return {blocked,home:location.origin,labOrigin:origin};
 },{ids,origin:labOrigin});
 check(started.blocked&&started.home!==started.labOrigin,'actual SOP boundary: Jaskinia cannot inspect off-origin lab runtime',started);
 await page.waitForFunction(()=>window.__mediumOff.descriptions.length===1,{timeout:8000});
 const caps=await page.evaluate(()=>__mediumOff.descriptions[0].actions);
 check(caps.length===1&&caps[0].effect==='new interpretation'&&caps[0].not.includes('not the same world'),'source advertises one bounded useful operation and its semantic boundary',caps);
 const frm=page.frameLocator('.win[data-id="'+srcId+'"] iframe'),to=page.frameLocator('.win[data-id="'+dstId+'"] iframe');
 await page.evaluate(()=>Jaskinia.ext.open('przyrzad'));
 await frm.locator('#lens-wall').click();
 async function paint(x,y){
  const b=await frm.locator('#dam-lens').boundingBox();
  await frm.locator('#dam-lens').click({position:{x:(x-44+.5)/24*b.width,y:(y-43+.5)/17*b.height}});
 }
 await paint(56,50);
 const src0=await frm.locator('body').evaluate(()=>__kowal.sample(56,50).solid);
 const to0=await to.locator('body').evaluate(()=>__mediumSignal.sample(56,50));
 check(src0===1&&to0===0,'human pointer changes source, recipient is independent before the action');
 await frm.locator('#off-origin-try').click();
 await page.waitForFunction(()=>__mediumOff.results.length===1,{timeout:8000});
 const result=await page.evaluate(()=>__mediumOff.results[0]);
 const recipient=await to.locator('body').evaluate(()=>({wall:__mediumSignal.sample(56,50),
  receiver:__mediumSignal.get().mediumSignal.receiver,status:__mediumSignal.status()}));
 const output=await frm.locator('#off-origin-outcome').innerText();
 check(result.ok&&recipient.wall===1&&result.analysis.reach===!!recipient.status.reach&&output.includes('ŚLAD:'),
  'real off-origin operation changes recipient and shows its actual interpretation at source',{result,output});
 check(recipient.receiver.x===62&&recipient.receiver.y===52,'specialist receiver authority retained');
 await paint(62,52);
 const before=await to.locator('body').evaluate(()=>JSON.stringify(__mediumSignal.get()));
 await frm.locator('#off-origin-try').click();
 await page.waitForFunction(()=>__mediumOff.results.length===2,{timeout:8000});
 const denial=await page.evaluate(()=>__mediumOff.results[1]);
 const after=await to.locator('body').evaluate(()=>JSON.stringify(__mediumSignal.get()));
 const refusal=await frm.locator('#off-origin-outcome').innerText();
 check(!denial.ok&&denial.atomic&&before===after&&refusal.includes('odmowa'),
  'target rejects invalid meaning atomically without same-origin host introspection',{denial,refusal});
 await frm.locator('#lens-cut').click();await paint(62,52);
 await frm.locator('#off-origin-try').click();
 await page.waitForFunction(()=>__mediumOff.results.length===3,{timeout:8000});
 const repaired=await page.evaluate(()=>__mediumOff.results[2]);
 check(repaired.ok,'real author fixes and retries same one-click operation');
 // Synthetic parent-origin request does not have allowed off-origin source.
 await page.evaluate(()=>window.postMessage({mediumOffOrigin:1,type:'request',action:'medium.przesmyk-variant.try-signal-v0',nonce:99},window.location.origin));
 const count=await page.evaluate(()=>({requests:__mediumOff.requests.length,results:__mediumOff.results.length,
  windows:Object.values(__JASK.L.wins).filter(w=>w.type==='przyrzad').length}));
 check(count.requests===3&&count.results===3&&count.windows===2,'forged parent request ignored, no third Home or window',count);
 check(errors.length===0,'no Jaskinia script error',errors);
 await page.screenshot({path:path.join(dist,'_gpt_onehome_offorigin_action.png')});
}catch(err){console.error('OFF_ORIGIN_ABORT',err.stack);fail++}
finally{await browser.close();await host.close();await labs.close();fs.rmSync(tmp,{recursive:true,force:true})}
console.log('ONE_HOME_OFF_ORIGIN_GATE',JSON.stringify({pass,fail}));
if(fail)process.exitCode=1;