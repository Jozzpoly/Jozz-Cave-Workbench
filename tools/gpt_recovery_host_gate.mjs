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
} catch(err){console.error('TEST ABORT',err.stack);fail++;}
finally{await browser.close();await s.close?.();}
console.log('REAL_HOST_RESULT',JSON.stringify({pass,fail,errors:errors.slice(0,12)}));
if(fail||errors.length)process.exitCode=1;
