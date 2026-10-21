// Research-only falsifier: two independent real Medium experiments inside the unmodified Jaskinia v6.3.
// This is NOT a host capability API or a recommendation to use same-origin iframe introspection in production.
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const prefix='experiments/received-workpieces/przesmyk-kowal-2026-10-18/';
const other=path.join(root,'medium',prefix);
const srcFile='two-instruments-one-world-gpt6.html';
const signalFile='second-life-signal-gpt6.html';
const hostFile=path.join(dist,'jaskinia-web.html');
if(!fs.existsSync(hostFile)||fs.readFileSync(hostFile).length!==2450637)throw Error('Pinned Jaskinia v6.3 not present');
for(const name of [srcFile,signalFile]) {
  const from=path.join(other,name);
  if(!fs.existsSync(from))throw Error('Pinned Medium source unavailable: '+from);
  fs.copyFileSync(from,path.join(dist,'_gpt_medium_'+name));
}
const server=await serve(dist);
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1470,height:900}});
await context.addInitScript(()=>{window.__JASK_PLACE='web';try{localStorage.setItem('jaskinia:hint','1')}catch{}});
const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
let ok=0,fail=0;const judge=(cond,topic,details)=>{console.log(cond?'PASS':'FAIL',topic,details?JSON.stringify(details):'');cond?ok++:fail++};
const getIframe=(id)=>'.win[data-id="'+id+'"] iframe';
const sourceUrl=server.base+'/_gpt_medium_'+srcFile, signalUrl=server.base+'/_gpt_medium_'+signalFile;
const worldIds=[];
try{
  await p.goto(server.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>!!(window.Jaskinia?.ext?.open&&window.__JASK?.L),{timeout:20000});
  const api=await p.evaluate(()=>({build:Jaskinia.build,v:Jaskinia.v,keys:Object.keys(Jaskinia),externalTypes:Object.keys(Jaskinia.ext)}));
  judge(api.v===1&&api.externalTypes.includes('type')&&api.externalTypes.includes('open'),
    'original Jaskinia host API registers windows, not generic actor capabilities',api);
  for(const u of [sourceUrl,signalUrl]){
    const id=await p.evaluate(url=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url,title:'Medium actual-world test'}}),u);
    worldIds.push(id);
  }
  await p.waitForFunction(([a,b])=>{
    const get=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return get(a)?.__mediumPortable?.get&&get(b)?.__mediumSignal?.get;
  },worldIds,{timeout:30000});
  const first=await p.evaluate(([srcId,sigId])=>{
    const a=document.querySelector('.win[data-id="'+srcId+'"] iframe').contentWindow;
    const b=document.querySelector('.win[data-id="'+sigId+'"] iframe').contentWindow;
    return {src:a.__mediumPortable.get(),signal:b.__mediumSignal.get(),sourceStatus:a.__kowal.snapshot(),signalStatus:b.__mediumSignal.status()};
  },worldIds);
  judge(first.src.schema==='medium.przesmyk.variant.v1'&&first.signal.schema===first.src.schema&&
    first.src.originalSha256===first.signal.originalSha256,
    'both independent programs understand same portable topology source', {src:first.src.schema,sha:first.src.originalSha256});
  judge(!('mediumSignal' in first.src)&&!!first.signal.mediumSignal?.receiver,
    'sender knows topology but does NOT natively know special receiver meaning',{sourceKeys:Object.keys(first.src),signalKeys:Object.keys(first.signal)});
  const transfer=await p.evaluate(([srcId,sigId])=>{
    const a=document.querySelector('.win[data-id="'+srcId+'"] iframe').contentWindow;
    const b=document.querySelector('.win[data-id="'+sigId+'"] iframe').contentWindow;
    const base=a.__mediumPortable.get();
    // First actual transfer into a different real engine, not just compare JSON shapes.
    const received=b.__mediumSignal.import(JSON.stringify(base));
    const sameTopology=JSON.stringify(received.changes)===JSON.stringify(base.changes);
    // Choose another valid empty cell, acting as a deliberately authored receiver decision.
    const old=received.mediumSignal.receiver;
    let p=null;
    for(let y=3;y<60&&!p;y++)for(let x=3;x<107;x++)if(!p&&Math.hypot(x-old.x,y-old.y)>19&&
      Math.hypot(x,base.source.x,y-base.source.y)>5&&b.__mediumSignal.sample(x,y)===0)p={x,y};
    if(!p)throw Error('No valid alternate receiver');
    const enriched={...received,mediumSignal:{receiver:p}};
    const enrichedReceived=b.__mediumSignal.import(JSON.stringify(enriched));
    // Sending back through the other real tool is legal but loses its unknown field.
    const echo=a.__mediumPortable.apply(JSON.stringify(enrichedReceived));
    const back=a.__mediumPortable.get();
    return {sameTopology,originalReceiver:old,authoredReceiver:p,afterSignal:enrichedReceived.mediumSignal.receiver,
      afterSource:back.mediumSignal??null,sourceAltered:JSON.stringify(back.changes)!==JSON.stringify(base.changes),
      roundtripBack:back,signalStatus:b.__mediumSignal.status(),echoKeys:Object.keys(echo)};
  },worldIds);
  judge(transfer.sameTopology,'actual Jaskinia-hosted source→signal import preserves authored topology');
  judge(JSON.stringify(transfer.afterSignal)===JSON.stringify(transfer.authoredReceiver),
    'real signal engine accepts and retains authored receiver decision',transfer.authoredReceiver);
  judge(transfer.afterSource===null&&!transfer.sourceAltered&&
    transfer.echoKeys.includes('changes')&&!transfer.echoKeys.includes('mediumSignal'),
    'real source engine roundtrip preserves geometry but strips signal-specific meaning',
    {newReceiver:transfer.authoredReceiver,sourceFields:transfer.echoKeys});
  // This is a *fresh* receiver to reveal non-obvious loss: existing signal iframe might retain old receiver in memory.
  const newSigId=await p.evaluate(u=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url:u,title:'Fresh independent ŚLAD'}}),signalUrl);
  await p.waitForFunction(id=>!!document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow?.__mediumSignal?.import,newSigId,{timeout:25000});
  const fresh=await p.evaluate(({id,payload})=>{
    const b=document.querySelector('.win[data-id="'+id+'"] iframe').contentWindow;
    const got=b.__mediumSignal.import(JSON.stringify(payload));
    return {receiver:got.mediumSignal.receiver,meaning:!!payload.mediumSignal,changed:got.changes.length};
  },{id:newSigId,payload:transfer.roundtripBack});
  judge(!fresh.meaning&&JSON.stringify(fresh.receiver)!==JSON.stringify(transfer.authoredReceiver),
    'fresh receiver imports same topology but cannot reconstruct lost author decision',{wanted:transfer.authoredReceiver,actual:fresh.receiver});
  // Counterfactual "fix": blindly retaining unknown receiver metadata is ALSO unsafe after topology edits.
  // Use both real importers. The source program legitimately adds a wall at the authored receiver cell.
  const stale=await p.evaluate(({srcId,sigId,target})=>{
    const a=document.querySelector('.win[data-id="'+srcId+'"] iframe').contentWindow;
    const b=document.querySelector('.win[data-id="'+sigId+'"] iframe').contentWindow;
    const base=a.__mediumPortable.get(),point=target.y*112+target.x;
    const changes=base.changes.map(x=>[...x]);const hit=changes.find(x=>x[0]===point);
    if(hit)hit[1]=1;else changes.push([point,1]);
    const updated=a.__mediumPortable.apply(JSON.stringify({...base,changes}));
    const staleMeaning={...updated,mediumSignal:{receiver:target}};
    const before=JSON.stringify(b.__mediumSignal.get());
    let rejected=null;
    try{b.__mediumSignal.import(JSON.stringify(staleMeaning))}catch(e){rejected=e.message}
    const after=JSON.stringify(b.__mediumSignal.get());
    return {isWall:a.__kowal.sample(target.x,target.y).solid===1,
      recipientReject:rejected,unchanged:before===after,
      wouldKeepOpaqueReceiver:staleMeaning.mediumSignal.receiver};
  },{srcId:worldIds[0],sigId:worldIds[1],target:transfer.authoredReceiver});
  judge(stale.isWall&&typeof stale.recipientReject==='string'&&stale.recipientReject.includes('pustej komórce')&&stale.unchanged,
    'preserving opaque receiver data across incompatible topology edits would be invalid; recipient correctly rejects atomically',stale);
  // A hosted iframe may be throttled, hidden, or paused. Do not confuse that with actual saved solver history.
  const hostMotion=await p.evaluate(id=>{
    const frame=document.querySelector('.win[data-id="'+id+'"] iframe');
    const cw=frame.contentWindow, button=cw.document.querySelector('#pause');
    if(cw.__kowal.snapshot().paused)button.click();
    return {before:cw.__kowal.snapshot(),frameCss:getComputedStyle(frame).display,
      parentCss:getComputedStyle(frame.parentElement).display};
  },worldIds[0]);
  const rafProbe=await p.evaluate(id=>{
    const frame=document.querySelector('.win[data-id="'+id+'"] iframe'), win=frame?.closest('.win');
    const w=frame?.contentWindow, rect=frame?.getBoundingClientRect();
    const html=w?.document?.documentElement;
    const original=w?.requestAnimationFrame.bind(w);
    if(w&&original) {
      w.__rafProbes=0;
      w.requestAnimationFrame=cb=>original(t=>{w.__rafProbes++;cb(t)});
    }
    return {docHidden:document.hidden,childHidden:w?.document.hidden,hasFocus:document.hasFocus(),
      frameRect:rect&&{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
      frameDisplay:getComputedStyle(frame).display,frameVisibility:getComputedStyle(frame).visibility,
      winClass:win?.className,winHidden:win?.hidden,winDisplay:win&&getComputedStyle(win).display,
      originalStep:w?.__kowal?.snapshot().step,
      rafProbeInstalled:!!original,childCss:html&&getComputedStyle(html).display};
  },worldIds[0]);
  await p.waitForTimeout(650);
  const hostAfter=await p.evaluate(id=>{
    const f=document.querySelector('.win[data-id="'+id+'"] iframe');
    return f.contentWindow.__kowal.snapshot();
  },worldIds[0]);
  console.log('HOSTED_SIM_ACTIVITY_BOUNDARY',JSON.stringify({before:hostMotion,probe:rafProbe,after:hostAfter,rafCalls:await p.evaluate(id=>document.querySelector('.win[data-id="'+id+'"] iframe').contentWindow.__rafProbes,worldIds[0])}));
  // Independent real runtime control: authoring capsule import MUST NOT be confused with live-solver resume.
  // Use the unchanged Medium page outside its Jaskinia iframe so it can actually advance.
  const solo=await context.newPage();
  await solo.goto(sourceUrl,{waitUntil:'domcontentloaded'});
  await solo.waitForFunction(()=>!!(window.__mediumPortable&&window.__kowal));
  await solo.evaluate(()=>{
    if(window.__kowal.snapshot().paused)document.querySelector('#pause').click();
  });
  await solo.waitForFunction(()=>window.__kowal.snapshot().step>=2,{timeout:7000});
  const replay=await solo.evaluate(()=>{
    const running=__kowal.snapshot(),saved=__mediumPortable.get();
    __mediumPortable.apply(JSON.stringify(saved));
    const after=__kowal.snapshot(),again=__mediumPortable.get();
    return {duringStep:running.step,afterStep:after.step,afterPaused:after.paused,
      sameTopology:JSON.stringify(saved.changes)===JSON.stringify(again.changes)};
  });
  judge(replay.duringStep>=2&&replay.afterStep===0&&replay.afterPaused&&replay.sameTopology,
    'real running Medium solver resets on topological import; same terrain is NOT a runtime checkpoint',replay);
  await solo.close();
  const hostRecords=await p.evaluate(()=>Object.values(__JASK.L.wins)
    .filter(w=>w.type==='przyrzad').map(w=>({url:w.st?.url,project:w.st?.project,build:w.st?.build})));
  judge(hostRecords.length===3&&hostRecords.every(x=>!x.build),
    'host preserves three run addresses; cannot promise per-tool semantic provenance',hostRecords);
  judge(errors.length===0,'no Jaskinia page exceptions',errors);
  await p.screenshot({path:path.join(dist,'_gpt_onehome_cross_tool.png')});
}catch(e){console.error('GATE_ABORT',e.stack);fail++}
finally{await browser.close();await server.close();}
console.log('ONE_HOME_MEDIUM_GATE',JSON.stringify({pass:ok,fail}));
if(fail)process.exitCode=1;