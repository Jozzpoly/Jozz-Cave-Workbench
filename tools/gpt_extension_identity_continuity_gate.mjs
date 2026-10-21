// Isolated regression falsifier: saved native extension returns under a DIFFERENT implementation
// that reuses the same key. This tests unmodified public Jaskinia v6.3, not an installed plugin.
// It does not use the Owner's browser or saved data.
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
if(fs.statSync(path.join(dist,'jaskinia-web.html')).size!==2450637)throw Error('Require original pinned Jaskinia v6.3');
const srv=await serve(dist),browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1400,height:880}});
await ctx.addInitScript(()=>{window.__JASK_PLACE='web';try{localStorage.setItem('jaskinia:hint','1')}catch{}});
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
let pass=0,fail=0;const check=(good,description,evidence)=>{console.log(good?'PASS':'FAIL',description,evidence?JSON.stringify(evidence):'');good?pass++:fail++};
const original={tool:'agent-A-builder',schema:'agentA.construction.v1',ownerWork:'wybrane osie i relacje',axis:[1,0,0],revision:7};
let id=null;
try{
  await p.goto(srv.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>!!window.Jaskinia?.ext?.type);
  const started=await p.evaluate(work=>{
    Jaskinia.ext.type('agentcanvas',{name:'Agent A builder',render(box,c){
      box.innerHTML='<section data-ext-version="A">'+c.win.st.workpiece?.schema+'</section>';
    }});
    const id=Jaskinia.ext.open('agentcanvas',{fresh:true,st:{workpiece:work}});
    const w=__JASK.L.wins[id];
    return {id,type:w.type,workpiece:w.st.workpiece,visible:!!document.querySelector('[data-ext-version="A"]')};
  },original);
  id=started.id;
  check(started.type==='agentcanvas'&&started.visible&&JSON.stringify(started.workpiece)===JSON.stringify(original),
    'agent A creates real native editor, with meaningful authored extension work in host window',started);
  await p.waitForFunction(id=>{
    const raw=JSON.parse(localStorage.getItem('jaskinia:v3')||'null');
    return raw?.spaces?.some(sp=>sp.L.wins[id]?.type==='agentcanvas'&&sp.L.wins[id]?.st?.workpiece?.revision===7);
  },id,{timeout:10000});
  const persisted=await p.evaluate(id=>{
    const raw=JSON.parse(localStorage.getItem('jaskinia:v3')),w=raw.spaces.map(sp=>sp.L.wins[id]).find(Boolean);
    return {id,type:w.type,workpiece:w.st.workpiece};
  },id);
  check(JSON.stringify(persisted.workpiece)===JSON.stringify(original),
    'real original host persisted the semantic payload under an extension type key',persisted);

  // App upgrade where the extension is unavailable at startup.
  await p.reload({waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>!!window.Jaskinia?.ext?.type);
  const missing=await p.evaluate(id=>{
    const found=__JASK.store.spaces.flatMap(sp=>Object.entries(sp.L.wins)).find(([wid])=>wid===id);
    if(!found)return {absent:true};
    const w=found[1];
    return {id,type:w.type,lost:w.lost,workpiece:w.st?.workpiece};
  },id);
  check(missing.type==='wybor'&&missing.lost?.type==='agentcanvas'&&JSON.stringify(missing.workpiece)===JSON.stringify(original),
    'unknown extension becomes placeholder, keeping the original typed workpiece',missing);

  // Another agent supplies SAME KEY, but fundamentally incompatible "world".
  const rebound=await p.evaluate(id=>{
    Jaskinia.ext.type('agentcanvas',{name:'Agent B signal editor',render(box,c){
      const w=c.win.st;
      box.innerHTML='<section data-ext-version="B">'+
        (w.workpiece?.schema==='agentB.signal.v2'?'B valid signal document':'B INCOMPATIBLE SOURCE')+'</section>';
    }});
    const raw=__JASK.store.spaces.flatMap(sp=>Object.entries(sp.L.wins)).find(([wid])=>wid===id);
    const w=raw?.[1], node=document.querySelector('[data-ext-version="B"]');
    return {id,type:w?.type,lost:w?.lost||null,workpiece:w?.st?.workpiece,rendered:node?.textContent};
  },id);
  check(rebound.type==='agentcanvas'&&!rebound.lost&&rebound.rendered==='B INCOMPATIBLE SOURCE'&&
    JSON.stringify(rebound.workpiece)===JSON.stringify(original),
    'new unrelated extension silently receives and renders the earlier agent workpiece',rebound);
  check(errors.length===0,'host reports no script exception for extension misbinding',errors);

  // Explicit agent-level validation prevents interpretation; host itself does NOT enforce it.
  const validation=await p.evaluate(id=>{
    const s=__JASK.store.spaces.flatMap(sp=>Object.entries(sp.L.wins)).find(([wid])=>wid===id)?.[1]?.st;
    return {hostBound:true,moduleAccepts:s?.workpiece?.schema==='agentB.signal.v2',originalSchema:s?.workpiece?.schema};
  },id);
  check(validation.hostBound&&!validation.moduleAccepts,
    'module-local schema guard detects mismatch, while host binding has already happened',validation);

  const status=await p.evaluate(id=>({id,nativeCount:__JASK.store.spaces.flatMap(sp=>Object.values(sp.L.wins)).filter(w=>w.type==='agentcanvas').length,
    source:window.Jaskinia.build}));
  check(status.nativeCount===1,'test left no duplicate host windows and made no product changes',status);
} catch(e){console.error('EXTENSION_CONTINUITY_ABORT',e.stack);fail++}
finally{await browser.close();await srv.close()}
console.log('EXTENSION_CONTINUITY_GATE',JSON.stringify({pass,fail}));
if(fail)process.exitCode=1;