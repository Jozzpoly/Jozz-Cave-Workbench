import {chromium,devices} from 'playwright';
import {serve} from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dist=path.join(root,'dist');
const shipped=fs.readFileSync(path.join(dist,'jaskinia-web.html'),'utf8');
if(shipped.length<1_500_000||!shipped.includes('Jaskinia')) throw Error('Not the real committed Jaskinia HTML');
console.log('ORIGINAL_HOST_BYTES', Buffer.byteLength(shipped));
const s=await serve(dist);
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let pass=0,fail=0;const errors=[];
function check(cond,name,more=''){console.log(cond?'PASS':'FAIL',name,more);cond?pass++:fail++;}
const specs=[
 ['s0','https://jozzpoly.github.io/ReflexBrain-Lab/playmat-s0/'],
 ['d1','https://jozzpoly.github.io/ReflexBrain-Lab/world-d1/']
];
const installed=() => {
  const typ='doznania';
  Jaskinia.ext.type(typ,{
    name:'Doświadczenia',group:'one',follows:true,render(box,c){
      const el=document.createElement('div');
      el.className='recover-host-smoke';
      el.dataset.project=c.repo?.name||'';
      for(const [k,url] of [
        ['s0','https://jozzpoly.github.io/ReflexBrain-Lab/playmat-s0/'],
        ['d1','https://jozzpoly.github.io/ReflexBrain-Lab/world-d1/']
      ]) {
        const b=document.createElement('button');
        b.className='recover-'+k;b.textContent=k;
        b.onclick=()=>c.openType('przyrzad',{fresh:true,st:{url,title:k,project:c.repo?.name||''}});
        el.appendChild(b);
      }
      box.append(el);
    }
  });
  return Jaskinia.ext.open(typ);
};
async function open(phone){
 const ctx=await browser.newContext(phone?{...devices['Pixel 7'],colorScheme:'dark'}:{viewport:{width:1450,height:900},colorScheme:'dark'});
 await ctx.addInitScript(()=>{
  window.__JASK_PLACE='web';
  try{localStorage.setItem('jaskinia:hint','1');}catch{}
 });
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 await page.route('https://jozzpoly.github.io/ReflexBrain-Lab/**',async route=>{
   const url=route.request().url();
   const label=url.includes('world-d1')?'D1':'S0';
   const html='<!doctype html><meta charset=utf-8><title>'+label+'</title><body><h1>'+label+'</h1><script>setTimeout(()=>parent.postMessage({jaskinia:1,type:"hello",name:"'+label+'",version:"fixture",wants:[]},"*"),120);<\/script></body>';
   await route.fulfill({status:200,contentType:'text/html',body:html});
 });
 await page.goto(s.base+'/jaskinia-web.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!(window.Jaskinia?.ext?.type&&window.__JASK?.L),{timeout:20000});
 return {ctx,page};
}
try{
 const {ctx,page}=await open(false);
 const before=await page.evaluate(()=>({api:Jaskinia.v,repos:__JASK.store?.sel,types:Object.values(__JASK.L.wins).map(w=>w.type)}));
 check(before.api===1,'actual distributed Jaskinia API v1');
 check(before.types.length>0,'actual Jaskinia has persistent windows');
 check(before.repos!==undefined,'actual store ready');
 await page.evaluate(installed);
 await page.waitForFunction(()=>!!document.querySelector('.recover-host-smoke'));
 check(await page.locator('.recover-host-smoke').count()===1,'registered extension renders inside REAL Jaskinia window');
 await page.locator('.recover-s0').click();
 const covered=await page.locator('.recover-d1').evaluate(el=>{
   const b=el.getBoundingClientRect();
   const over=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
   return !el.contains(over);
 });
 console.log('UX_FINDING: chooser covered by new floating experiment?',covered);
 await page.evaluate(()=>Jaskinia.ext.open('doznania')); // normal host API: bring chooser back to front
 await page.locator('.recover-d1').click();
 await page.waitForTimeout(1200);
 const win=await page.evaluate(()=>Object.entries(__JASK.L.wins).filter(([,w])=>w.type==='przyrzad').map(([id,w])=>({id,url:w.st?.url,hasIframe:!!document.querySelector('.win[data-id="'+id+'"] iframe')})));
 check(win.length===2,'two independent instrument windows',JSON.stringify(win));
 check(win.some(w=>w.url?.includes('playmat-s0'))&&win.some(w=>w.url?.includes('world-d1')),'two different specimen URLs rather than one repo pin');
 check(win.every(w=>w.hasIframe),'each instrument embeds an iframe, no second game player');
 const live=await page.evaluate(()=>__JASK.live().filter(e=>/ReflexBrain/.test(e.url||'')).map(e=>({url:e.url,hello:e.hello?.name})));
 check(live.length===2,'two different live records',JSON.stringify(live));
 check(live.some(x=>x.hello==='S0')&&live.some(x=>x.hello==='D1'),'source-matched hello handshake from distinct frames',JSON.stringify(live));
 const prev=await page.evaluate(()=>Object.entries(__JASK.L.wins).filter(([,w])=>w.type==='przyrzad').map(([id])=>[id,document.querySelector('.win[data-id="'+id+'"] iframe')?.src]));
 await page.evaluate(()=>__JASK.setPref('theme','kataster'));
 await page.waitForTimeout(700);
 const next=await page.evaluate(()=>Object.entries(__JASK.L.wins).filter(([,w])=>w.type==='przyrzad').map(([id])=>[id,document.querySelector('.win[data-id="'+id+'"] iframe')?.src]));
 check(JSON.stringify(prev)===JSON.stringify(next),'theme changes keep both live iframe URLs and identity');
 await page.evaluate(()=>__JASK.select('FrameMatter-Lab'));
 await page.waitForTimeout(450);
 check((await page.evaluate(()=>Object.values(__JASK.L.wins).filter(w=>w.type==='przyrzad').map(w=>w.st.url))).length===2,'repo selection does not overwrite the live experiments');
 await page.screenshot({path:path.join(dist,'_gpt_recovery_real_host_desktop.png')});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Jaskinia&&window.__JASK);
 await page.evaluate(installed);
 await page.waitForTimeout(900);
 const revived=await page.evaluate(()=>Object.values(__JASK.L.wins).filter(w=>w.type==='przyrzad').map(w=>w.st.url));
 check(revived.length===2&&revived.some(x=>x.includes('playmat-s0'))&&revived.some(x=>x.includes('world-d1')),'both actual window records survive reload');
 await ctx.close();
 const phone=await open(true);
 await phone.page.evaluate(installed);
 await phone.page.waitForFunction(()=>!!document.querySelector('.recover-host-smoke'));
 check(await phone.page.locator('.recover-host-smoke').count()===1,'extension renders on physical-size phone viewport');
 await phone.page.locator('.recover-s0').click();
 check(await phone.page.evaluate(()=>Object.values(__JASK.L.wins).some(w=>w.type==='przyrzad'&&w.st?.url?.includes('playmat-s0'))),'phone can create specific experiment window');
 await phone.page.screenshot({path:path.join(dist,'_gpt_recovery_real_host_phone.png')});
 await phone.ctx.close();
 // Genuine bundled Piłki lab: two concurrent physical runtimes, hidden pause, same-session continuity, reload versus genuine resume.
 const cont=await open(false), cp=cont.page;
 const idA=await cp.evaluate(()=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url:'pokaz:pilki',title:'Piłki A'}}));
 const idB=await cp.evaluate(()=>Jaskinia.ext.open('przyrzad',{fresh:true,st:{url:'pokaz:pilki',title:'Piłki B'}}));
 const capture=async()=>cp.evaluate(ids=>ids.map(id=>{
   const f=document.querySelector('.win[data-id="'+id+'"] iframe'),lab=f?.contentWindow;
   const live=__JASK.live().find(x=>x.id===id);
   return {id,boot:lab?.__boot||null,paused:lab?.document?.querySelector('#pause')?.classList.contains('on')||false,vis:live?.vis??null,energy:live?.state?.data?.energia??null,time:live?.state?.data?.czas_s??null,url:__JASK.L.wins[id]?.st.url};
 }),[idA,idB]);
 await cp.waitForFunction(ids=>ids.every(id=>!!document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow?.__boot),[idA,idB]);
 await cp.waitForTimeout(750);
 const physA=await capture();
 check(physA.length===2&&physA.every(x=>x.boot&&x.url==='pokaz:pilki')&&physA[0].boot!==physA[1].boot,'two real physics lab instances, distinct runtime boot IDs',JSON.stringify(physA));
 const oldSpace=await cp.evaluate(()=>{const x=__JASK.store.cur;__JASK.setSpace('granie');return x});
 await cp.waitForTimeout(350);
 const direct=()=>cp.evaluate(ids=>ids.map(id=>{const cw=document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow;
   return cw?.eval('({paused,W,H,energy:energy(),balls:balls.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy}))})')||null;
 }),[idA,idB]);
 const paused1=await capture();
 const direct1=await direct();
 await cp.waitForTimeout(1550);
 const paused2=await capture();
 const direct2=await direct();
 console.log('PHYSICS_DIRECT_BEFORE_AFTER',JSON.stringify({before:direct1,after:direct2}));
 console.log('TELEMETRY_BEFORE_AFTER',JSON.stringify({before:paused1,after:paused2}));
 check(direct1.every((x,i)=>x?.paused===true&&direct2[i]?.paused===true&&
    JSON.stringify(x.balls)===JSON.stringify(direct2[i].balls)),
    'REAL physical positions and velocities frozen after lab sees pause');
 check(paused1.every(x=>x.paused&&x.vis===false),'host visibility message pauses both bundled labs',JSON.stringify(paused1));
 check(paused1.every((x,i)=>x.boot===physA[i].boot&&direct1[i]?.energy===direct2[i]?.energy),
   'hidden labs preserve directly observed physical energy and runtime (host telemetry may lag)',JSON.stringify({direct1:direct1.map(x=>x.energy),direct2:direct2.map(x=>x.energy)}));
 console.log('CLOCK_SEAM paused_time_before_after',JSON.stringify(paused1.map((x,i)=>({before:x.time,after:paused2[i].time}))));
 await cp.evaluate(x=>__JASK.setSpace(x),oldSpace);
 await cp.waitForTimeout(500);
 const resumed=await capture();
 check(resumed.every((x,i)=>x.boot===physA[i].boot&&!x.paused),'return to layout continues SAME physical runtime, not reload',JSON.stringify(resumed));
 await cp.reload({waitUntil:'domcontentloaded'});
 await cp.waitForFunction(ids=>ids.every(id=>!!document.querySelector('.win[data-id="'+id+'"] iframe')?.contentWindow?.__boot),[idA,idB]);
 await cp.waitForTimeout(800);
 const afterReload=await capture();
 check(afterReload.length===2&&afterReload.every((x,i)=>x.url==='pokaz:pilki'&&x.boot&&x.boot!==physA[i].boot),'reload restores WINDOW but creates NEW physical runtime (not resume)',JSON.stringify(afterReload));
 await cont.ctx.close();
} catch(err){console.error('TEST ABORT',err.stack);fail++;}
finally{await browser.close();await s.close?.();}
console.log('REAL_HOST_RESULT',JSON.stringify({pass,fail,errors:errors.slice(0,12)}));
if(fail||errors.length)process.exitCode=1;
