import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dist=path.join(root,'dist');
const host=fs.readFileSync(path.join(dist,'jaskinia-web.html'),'utf8');
if(Buffer.byteLength(host)!==2450637)throw Error('Expected exact public Jaskinia host missing');
const fixture=[
'<!doctype html><html><head><meta charset="utf-8"><title>Storage-test lab</title></head><body>',
'<script>',
'const p=new URLSearchParams(location.search);',
'const run=p.get("run"),isolated=p.get("isolated")==="1";',
'const key=isolated?"gpt:isolated:"+run:"gpt:colliding";',
'const saved=JSON.parse(localStorage.getItem(key)||"null");',
'window.__lab={run,isolated,key,boot:Math.random().toString(36).slice(2),',
'loadedFrom:saved?.run||null,loadedStep:saved?.step||null,step:0,',
'save(step){this.step=step;localStorage.setItem(key,JSON.stringify({run,step}));}};',
'parent.postMessage({jaskinia:1,type:"hello",name:"fixture "+run,version:"R1",wants:[]},"*");',
'<\/script></body></html>'
].join('\n');
fs.writeFileSync(path.join(dist,'_gpt_storage_fixture.html'),fixture);
const server=await serve(dist);
const browser=await chromium.launch({headless:true});
let pass=0,fail=0;
const check=(ok,why,details)=>{console.log(ok?'PASS':'FAIL',why,details?JSON.stringify(details):'');ok?pass++:fail++};
async function runCase(isolated){
  const ctx=await browser.newContext({viewport:{width:1450,height:900}});
  await ctx.addInitScript(()=>{window.__JASK_PLACE='web';try{localStorage.setItem('jaskinia:hint','1')}catch{}});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__JASK&&!!window.Jaskinia);
  const urls=['A','B'].map(run=>server.base+'/_gpt_storage_fixture.html?run='+run+'&isolated='+(isolated?1:0));
  await page.evaluate(urls=>{for(let i=0;i<urls.length;i++)Jaskinia.ext.open('przyrzad',{fresh:true,st:{url:urls[i],title:'fixture '+i}})},urls);
  const ready=()=>Object.entries(window.__JASK?.L?.wins||{}).filter(([,w])=>w.type==='przyrzad').length===2&&
    Object.entries(__JASK.L.wins).filter(([,w])=>w.type==='przyrzad')
      .every(([id])=>document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow?.__lab);
  await page.waitForFunction(ready,{timeout:15000});
  const capture=()=>page.evaluate(()=>Object.entries(__JASK.L.wins).filter(([,w])=>w.type==='przyrzad')
    .map(([id,w])=>{const f=document.querySelector('.win[data-id="'+id+'"] iframe'),z=f.contentWindow.__lab;
      return {id,url:w.st.url,lab:{run:z.run,boot:z.boot,step:z.step,loadedFrom:z.loadedFrom,loadedStep:z.loadedStep,key:z.key}};})
    .sort((a,b)=>a.lab.run.localeCompare(b.lab.run)));
  const start=await capture();
  check(start.length===2&&start[0].lab.boot!==start[1].lab.boot,'distinct runtime boot identities',{isolated});
  await page.evaluate(()=>{let frames=Object.entries(__JASK.L.wins).filter(([,w])=>w.type==='przyrzad')
    .map(([id])=>document.querySelector('.win[data-id="'+id+'"] iframe').contentWindow.__lab);
    frames.find(x=>x.run==='A').save(1234);frames.find(x=>x.run==='B').save(5678)});
  const before=await capture();
  const stored=await page.evaluate(()=>({collision:localStorage.getItem('gpt:colliding'),
    A:localStorage.getItem('gpt:isolated:A'),B:localStorage.getItem('gpt:isolated:B')}));
  check(before[0].lab.step===1234&&before[1].lab.step===5678,'independent in-memory states',{isolated});
  check(isolated?stored.A?.includes('1234')&&stored.B?.includes('5678'):
    stored.collision?.includes('5678')&&!stored.collision?.includes('1234'),
    isolated?'per-instance storage retains both saves':'same-origin shared key overwrites first checkpoint',{isolated,stored});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(ready,{timeout:15000});
  const after=await capture();
  check(after[0].url===urls[0]&&after[1].url===urls[1],
    'host restores distinct address/window records',{isolated});
  check(after[0].lab.boot!==before[0].lab.boot&&after[1].lab.boot!==before[1].lab.boot,
    'both physical runtimes restarted',{isolated});
  check(isolated?after[0].lab.loadedStep===1234&&after[1].lab.loadedStep===5678:
    after[0].lab.loadedFrom==='B'&&after[1].lab.loadedFrom==='B'&&after[0].lab.loadedStep===5678&&after[1].lab.loadedStep===5678,
    isolated?'cooperating lab restores correct instance checkpoints':'both windows reload last-written world B',
    {isolated,recovered:after.map(x=>({run:x.lab.run,from:x.lab.loadedFrom,step:x.lab.loadedStep}))});
  check(errors.length===0,'no host page errors',{isolated,errors});
  await ctx.close();
}
async function runMutableVersionCase(){
  const ctx=await browser.newContext({viewport:{width:1280,height:780}});
  await ctx.addInitScript(()=>{window.__JASK_PLACE='web';try{localStorage.setItem('jaskinia:hint','1')}catch{}});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let deployed='A',count=0;
  const testUrl=server.base+'/_gpt_mutable_fixture.html';
  await page.route('**/_gpt_mutable_fixture.html',async route=>{
    const code=deployed;count++;
    const pageHtml='<!doctype html><meta charset="utf-8"><title>Mutable lab build '+code+'</title>'+
      '<script>window.__specBuild='+JSON.stringify(code)+';'+
      'parent.postMessage({jaskinia:1,type:"hello",name:"Same URL lab",version:"build '+code+'",wants:[]},"*");<\/script>';
    await route.fulfill({status:200,contentType:'text/html',headers:{'cache-control':'no-store'},body:pageHtml});
  });
  await page.goto(server.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__JASK&&!!window.Jaskinia);
  const id=await page.evaluate(url=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url,title:'Same URL lab'}}),testUrl);
  const waitFor=version=>page.waitForFunction(({id,version})=>{
    const win=__JASK.L.wins[id],frame=document.querySelector('.win[data-id="'+id+'"] iframe');
    const live=__JASK.live().find(x=>x.id===id);
    return win&&frame?.contentWindow?.__specBuild===version&&live?.hello?.version==='build '+version;
  },{id,version},{timeout:12000});
  await waitFor('A');
  const get=()=>page.evaluate(id=>{
    const w=__JASK.L.wins[id],frame=document.querySelector('.win[data-id="'+id+'"] iframe');
    const live=__JASK.live().find(x=>x.id===id);
    return {id,st:JSON.stringify(w.st),url:frame?.src,build:frame?.contentWindow?.__specBuild,
      announced:live?.hello?.version,recordedBuild:w.st?.build??null,oldVersion:w.st?.previousVersion??null};
  },id);
  const first=await get();
  check(first.build==='A'&&first.announced==='build A'&&first.url===testUrl,'initial immutable physical build is A',first);
  deployed='B';
  await page.reload({waitUntil:'domcontentloaded'});
  await waitFor('B');
  const second=await get();
  check(count===2&&first.id===second.id&&first.st===second.st&&first.url===second.url&&
    first.build==='A'&&second.build==='B',
    'same address and saved Jaskinia window silently load new code build B',{first,second,loadCount:count});
  check(second.announced==='build B'&&second.recordedBuild===null&&second.oldVersion===null,
    'current hello version is visible, but prior build identity is not stored in the window',second);
  check(errors.length===0,'no host script errors during mutable-build replacement',{errors});
  await ctx.close();
}
try{await runCase(false);await runCase(true);await runMutableVersionCase()}
catch(e){console.error('TEST_ABORT',e.stack);fail++}
finally{await browser.close();await server.close();}
console.log('SAME_ORIGIN_SESSION_GATE',JSON.stringify({pass,fail}));
if(fail)process.exitCode=1;
