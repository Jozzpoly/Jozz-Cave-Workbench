/* GPT-only test of PR #2 unchanged v5 on synthetic local-origin pages. */
import fs from 'node:fs';
import http from 'node:http';
import {chromium} from 'playwright';
const html=fs.readFileSync('qualified-v5/dist/jaskinia-web.html');
const lab=name=>'<!doctype html><meta charset="utf-8"><title>GPT '+name+'</title>'+
 '<script>window.gptRuntimeId=Math.random().toString(36);'+
 'window.gptParentAccessible=!!parent.__JASK;'+
 'localStorage.setItem("gpt_multi_lab_sentinel","REACHABLE_FROM_'+name+'");'+
 '</script><h1>synthetic lab '+name+'</h1>';
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path==='/'||path==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return}
 if(path==='/lab-a/'||path==='/lab-b/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(lab(path==='/lab-a/'?'A':'B'));return}
 res.writeHead(404);res.end();
});
const checks=[];
const check=(name,ok,details={})=>{checks.push({name,pass:!!ok,details});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(details));};
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:890}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForFunction(()=>!!window.__JASK?.store,{timeout:12000});
 const ids=await page.evaluate(base=>{
  const J=__JASK,L=J.L,ids=J.leafIds(L.tree).slice(0,2);
  J.commit('GPT synthetic independent instruments',()=>{
   L.wins[ids[0]]={type:'przyrzad',z:1,pin:null,st:{url:base+'/lab-a/',title:'A'}};
   L.wins[ids[1]]={type:'przyrzad',z:1,pin:null,st:{url:base+'/lab-b/',title:'B'}};
  });
  return ids;
 },base);
 await page.waitForFunction(()=>__JASK.live().filter(e=>e.url.includes('/lab-')).length===2,{timeout:12000});
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].filter(e=>e.src.includes('/lab-')).length===2&&[...document.querySelectorAll('iframe')].filter(e=>e.src.includes('/lab-')).every(e=>e.contentWindow?.gptRuntimeId),{timeout:12000});
 const state=await page.evaluate(()=>{
  const es=[...document.querySelectorAll('iframe')].filter(e=>e.src.includes('/lab-'));
  return {urls:es.map(e=>e.src),independent:es[0].contentWindow.gptRuntimeId!==es[1].contentWindow.gptRuntimeId,
     parentRead:es.map(e=>e.contentWindow.gptParentAccessible),sharedStorage:localStorage.getItem('gpt_multi_lab_sentinel')};
 });
 check('two separate URL instrument instances run independently',state.urls.length===2&&state.urls[0]!==state.urls[1]&&state.independent,state);
 check('same-origin iframe JS can read parent object',state.parentRead.every(Boolean));
 check('two same-origin labs and host share localStorage',state.sharedStorage?.startsWith('REACHABLE_FROM_'));
 const after=await page.evaluate(()=>{
  const J=__JASK,L=J.L,ids=J.leafIds(L.tree).slice(0,2);
  J.commit('GPT synthetic two follower game windows',()=>{for(const id of ids)L.wins[id]={type:'gra',z:1,pin:null,st:{}}});
  J.select('ReflexBrain-Lab');const before=J.live().filter(e=>ids.includes(e.id)).map(e=>e.url);
  J.select('Combat-Lab');const after=J.live().filter(e=>ids.includes(e.id)).map(e=>e.url);
  return {before,after};
 });
 check('two Gra windows mirror selected ReflexBrain',after.before.length===2&&after.before.every(u=>u.includes('/ReflexBrain-Lab/')),after);
 check('two Gra windows switch jointly to Combat Lab',after.after.length===2&&after.after.every(u=>u.includes('/Combat-Lab/')),after);
 check('zero parent script errors',errors.length===0,{errors});
 fs.mkdirSync('shots/gpt-v5-instances',{recursive:true});
 await page.screenshot({path:'shots/gpt-v5-instances/current.png'});
 await page.close();
}catch(e){check('synthetic smoke completed',false,{error:String(e),stack:e.stack?.slice(0,800)})}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
fs.mkdirSync('shots/gpt-v5-instances',{recursive:true});
fs.writeFileSync('shots/gpt-v5-instances/evidence.json',JSON.stringify({exact_source:'8d7b1141105d1442eb7690bb345193a386485954',checks},null,2));
if(checks.some(x=>!x.pass))process.exitCode=1;