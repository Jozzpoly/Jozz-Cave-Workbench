// Isolated real-Jaskinia interaction research. Not a general capability SDK.
// UI click inside an actual Medium instrument asks a strictly pinned peer to try an authored workpiece.
// The bridge below uses same-origin diagnostic access and is NOT a production security design.
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const prefix='experiments/received-workpieces/przesmyk-kowal-2026-10-18/';
const donor=path.join(root,'medium',prefix);
const sourceName='two-instruments-one-world-gpt6.html';
const signalName='second-life-signal-gpt6.html';
const originalHost=fs.readFileSync(path.join(dist,'jaskinia-web.html'));
if(originalHost.byteLength!==2450637)throw Error('Expected exact real Jaskinia public v6.3 build');
for(const n of [sourceName,signalName])fs.copyFileSync(path.join(donor,n),path.join(dist,'_ui_'+n));
const srv=await serve(dist),browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:1480,height:960}});
await ctx.addInitScript(()=>{window.__JASK_PLACE='web';try{localStorage.setItem('jaskinia:hint','1')}catch{}});
const page=await ctx.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
const SRC=srv.base+'/_ui_'+sourceName,DST=srv.base+'/_ui_'+signalName;
let pass=0,fail=0;
function test(cond,name,details){console.log(cond?'PASS':'FAIL',name,details?JSON.stringify(details):'');if(cond)pass++;else fail++}
let srcId,dstId;
try{
  await page.goto(srv.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.Jaskinia?.ext?.open);
  srcId=await page.evaluate(url=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url,title:'PRZESMYK · mechanika'}}),SRC);
  dstId=await page.evaluate(url=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url,title:'ŚLAD · interpretacja sygnału'}}),DST);
  await page.waitForFunction(([a,b])=>{
    const frame=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return !!frame(a)?.__mediumPortable?.get&&!!frame(b)?.__mediumSignal?.get;
  },[srcId,dstId],{timeout:20000});

  const setup=await page.evaluate(([a,b])=>{
    const frame=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    const src=frame(a),dst=frame(b);
    const request='try-signal-workpiece-v0';
    const safeOrigin=location.origin;
    window.__mediumBridgeProof={calls:0,receipts:[],allowedOrigin:safeOrigin};
    // Single, pinned, positive-list action. An external-origin frame cannot trigger it.
    window.addEventListener('message',e=>{
      if(e.origin!==safeOrigin||e.source!==src||e.data?.mediumProbe!==1||e.data?.action!==request)return;
      const proof=window.__mediumBridgeProof;
      proof.calls++;
      const before=JSON.stringify(dst.__mediumSignal.get());
      let reply;
      try{
        const work=src.__mediumPortable.get();
        const receiver=dst.__mediumSignal.get().mediumSignal.receiver;
        const data={...work,mediumSignal:{receiver}};
        const serialized=JSON.stringify(data);
        if(serialized.length>120000)throw Error('Wariant przekracza ograniczenie importera');
        const restored=dst.__mediumSignal.import(serialized);
        reply={ok:true,steps:restored.changes.length,receiver:restored.mediumSignal.receiver};
      }catch(err){
        reply={ok:false,error:String(err.message),atomic:before===JSON.stringify(dst.__mediumSignal.get())};
      }
      proof.receipts.push(reply);
      src.postMessage({mediumProbe:1,action:'receipt',...reply},safeOrigin);
    });
    // Attach a tiny test-only adapter INSIDE the donor's own JavaScript realm.
    // A callback installed in the parent's realm would falsely claim to originate from the parent,
    // and the real source-window identity gate correctly rejects it.
    const script=src.document.createElement('script');
    script.textContent=[
      '(()=>{',
      'const trustedOrigin=location.origin;',
      'const button=document.createElement("button");',
      'button.id="try-signal-in-home";button.type="button";button.className="minor";',
      'button.textContent="Sprawdź tę konstrukcję w ŚLADZIE";',
      'button.addEventListener("click",()=>parent.postMessage({mediumProbe:1,action:"try-signal-workpiece-v0"},trustedOrigin));',
      'addEventListener("message",e=>{',
      'if(e.origin!==trustedOrigin||e.source!==parent||e.data?.mediumProbe!==1||e.data?.action!=="receipt")return;',
      'button.textContent=e.data.ok?"ŚLAD: interpretacja gotowa":"ŚLAD: zmiana niezgodna · "+e.data.error;',
      'button.dataset.ok=String(e.data.ok);',
      '});',
      'const toolbar=document.querySelector(".utility");',
      'if(!toolbar)throw Error("Missing original Medium toolbar");',
      'toolbar.append(button);',
      '})();'
    ].join('\n');
    src.document.body.appendChild(script);script.remove();
    const button=src.document.getElementById('try-signal-in-home');
    const toolbar=src.document.querySelector('.utility');
    if(!button||!toolbar)throw Error('Real donor controls missing');
    return {project:src.document.title,signal:dst.document.title,button:!!button,buttonInExistingToolbar:button.parentElement===toolbar};
  },[srcId,dstId]);
  test(setup.button&&setup.buttonInExistingToolbar,'new action is inline in original authoring tool, not a new Jaskinia portal',setup);

  const hostBefore=await page.evaluate(()=>Object.values(__JASK.L.wins).filter(x=>x.type==='przyrzad').length);
  test(hostBefore===2,'the host has only the two original Jaskinia instrument windows');
  // Bring source to front using the genuine public host API.
  const focused=await page.evaluate(()=>Jaskinia.ext.open('przyrzad'));
  test(focused===srcId,'native Jaskinia window focusing reuses source instrument',{focused,srcId});

  const frm=page.frameLocator('.win[data-id="'+srcId+'"] iframe');
  await frm.locator('#lens-wall').click();
  async function paint(cellX,cellY){
    const el=frm.locator('#dam-lens');
    const b=await el.boundingBox();
    const px=((cellX-44+0.5)/24)*b.width, py=((cellY-43+0.5)/17)*b.height;
    await el.click({position:{x:px,y:py}});
  }
  await paint(56,50);
  const author=await page.evaluate(([a,b])=>{
    const f=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return {source:f(a).__kowal.sample(56,50).solid,signal:f(b).__mediumSignal.sample(56,50),
      signalReceiver:f(b).__mediumSignal.get().mediumSignal.receiver};
  },[srcId,dstId]);
  test(author.source===1&&author.signal!==1,'real pointer input edits author work, peer still has earlier geometry',author);

  await frm.locator('#try-signal-in-home').click();
  await page.waitForFunction(()=>window.__mediumBridgeProof?.receipts?.length===1,{timeout:5000});
  const positive=await page.evaluate(([a,b])=>{
    const f=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return {source:f(a).__kowal.sample(56,50).solid,signal:f(b).__mediumSignal.sample(56,50),
      receiver:f(b).__mediumSignal.get().mediumSignal.receiver,
      receipts:window.__mediumBridgeProof.receipts,
      button:f(a).document.querySelector('#try-signal-in-home').textContent,
      hostCount:Object.values(__JASK.L.wins).filter(x=>x.type==='przyrzad').length};
  },[srcId,dstId]);
  test(positive.source===1&&positive.signal===1&&positive.receipts[0].ok===true&&positive.hostCount===2,
    'one human-facing action transfers actual edited geometry without new window or clipboard',positive);
  test(positive.button.includes('gotowa')&&positive.receiver.x===62&&positive.receiver.y===52,
    'donor UI reports completed interpretation; receiver-specific intent remains with its owner');

  // Another real pointer action violates the peer's semantic constraint; peer must reject atomically.
  await paint(62,52);
  const blocked=await page.evaluate(([a,b])=>{
    const f=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return {sourceWall:f(a).__kowal.sample(62,52).solid,targetWall:f(b).__mediumSignal.sample(62,52),
      before:JSON.stringify(f(b).__mediumSignal.get())};
  },[srcId,dstId]);
  test(blocked.sourceWall===1&&blocked.targetWall===0,'real edit invalidates receiver only in sender world',blocked);
  await frm.locator('#try-signal-in-home').click();
  await page.waitForFunction(()=>window.__mediumBridgeProof?.receipts?.length===2,{timeout:5000});
  const rejected=await page.evaluate(([a,b])=>{
    const f=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return {receiver:f(b).__mediumSignal.get().mediumSignal.receiver,
      targetJson:JSON.stringify(f(b).__mediumSignal.get()),
      wall:f(b).__mediumSignal.sample(62,52),receipts:__mediumBridgeProof.receipts,
      label:f(a).document.querySelector('#try-signal-in-home').textContent};
  },[srcId,dstId]);
  test(rejected.receipts[1].ok===false&&rejected.receipts[1].atomic===true&&
      rejected.wall===0&&rejected.targetJson===blocked.before&&rejected.label.includes('niezgodna'),
    'invalid authored meaning rejects transfer atomically with visible in-tool feedback',rejected);
  // Real author correction without rebooting either tool or discarding previously accepted work.
  await frm.locator('#lens-cut').click();
  await paint(62,52);
  const repairedBefore=await page.evaluate(id=>{
    const a=document.querySelector('.win[data-id="'+id+'"] iframe').contentWindow;
    return {wall:a.__kowal.sample(62,52).solid,
      action:a.document.querySelector('#try-signal-in-home').textContent};
  },srcId);
  test(repairedBefore.wall===0,'author can physically correct the invalid topology in the existing editor',repairedBefore);
  await frm.locator('#try-signal-in-home').click();
  await page.waitForFunction(()=>window.__mediumBridgeProof?.receipts?.length===3,{timeout:5000});
  const repairedAfter=await page.evaluate(([a,b])=>{
    const f=id=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
    return {source:f(a).__kowal.sample(62,52).solid,peer:f(b).__mediumSignal.sample(62,52),
      receiver:f(b).__mediumSignal.get().mediumSignal.receiver,
      receipt:__mediumBridgeProof.receipts[2],
      action:f(a).document.querySelector('#try-signal-in-home').textContent};
  },[srcId,dstId]);
  test(repairedAfter.source===0&&repairedAfter.peer===0&&repairedAfter.receipt.ok&&
    repairedAfter.receiver.x===62&&repairedAfter.receiver.y===52&&repairedAfter.action.includes('gotowa'),
    'author repair → accepted new interpretation works without losing target-specific decision',repairedAfter);

  const cards=await page.evaluate(()=>Object.values(__JASK.L.wins).filter(w=>w.type==='przyrzad')
    .map(w=>({url:w.st.url,authoringSchema:w.st.authoringSchema||null})));
  test(cards.length===2,'full flow does not accidentally replace Jaskinia layout or open a third home',cards);
  test(errors.length===0,'no top-level host exceptions',errors);
  await page.screenshot({path:path.join(dist,'_gpt_onehome_ui_action.png')});
}catch(err){console.error('UI_ACTION_ABORT',err.stack);fail++}
finally{await browser.close();await srv.close()}
console.log('ONE_HOME_UI_ACTION_GATE',JSON.stringify({pass,fail}));
if(fail)process.exitCode=1;