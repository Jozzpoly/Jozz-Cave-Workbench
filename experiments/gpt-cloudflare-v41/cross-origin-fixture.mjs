/* Synthetic browser-policy experiment, NOT a product acceptance test. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
const record=[],log=(name,ok,extra={})=>{record.push({name,pass:!!ok,...extra});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(extra));};
async function serve(host,body){
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(body)});
 await new Promise(r=>server.listen(0,host,r));
 return {url:'http://'+host+':'+server.address().port+'/',close:()=>new Promise(r=>server.close(r))};
}
const lab=await serve('localhost',
 '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>External lab</h1><script>'+
 'const read=()=>{try{return {ok:true,value:localStorage.getItem("GPT_WORKSHOP_SENTINEL")}}catch(e){return {ok:false,error:e.name}}};'+
 'const send=()=>parent.postMessage({kind:"GPT_ORIGIN_TEST",storage:read(),labOrigin:location.origin},"*");'+
 'addEventListener("message",e=>{if(e.data?.kind==="READ_AGAIN")send()});send();'+
 '<\/script></body></html>');
const host=await serve('127.0.0.1',
 '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Workshop host</h1><script>'+
 'window.reports=[];addEventListener("message",e=>{if(e.data?.kind==="GPT_ORIGIN_TEST")'+
 'window.reports.push({reportedOrigin:e.origin,sourceIsFrame:e.source===document.querySelector("iframe")?.contentWindow,frameReport:e.data})});'+
 '<\/script></body></html>');
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:960,height:700}});
const direct=await ctx.newPage(),outer=await ctx.newPage();
try{
 await direct.goto(lab.url);
 log('standalone lab can write localStorage',await direct.evaluate(()=>{localStorage.setItem('GPT_WORKSHOP_SENTINEL','STANDALONE_DATA');return localStorage.getItem('GPT_WORKSHOP_SENTINEL')==='STANDALONE_DATA'}));
 for(const spec of [{name:'opaque sandbox',sandbox:'allow-scripts'},{name:'true origin sandbox',sandbox:'allow-scripts allow-same-origin'},{name:'no sandbox',sandbox:null}]){
  await outer.goto(host.url);
  await outer.evaluate(({url,sandbox})=>{window.reports=[];const f=document.createElement('iframe');if(sandbox!==null)f.setAttribute('sandbox',sandbox);f.src=url;document.body.appendChild(f)},{url:lab.url,sandbox:spec.sandbox});
  await outer.waitForFunction(()=>window.reports.length>0,{timeout:8000});
  const snap=await outer.evaluate(()=>window.reports.at(-1));
  const expected=spec.name==='opaque sandbox'?'null':new URL(lab.url).origin;
  log(spec.name+': observable sender origin and frame source',snap.reportedOrigin===expected&&snap.sourceIsFrame,{origin:snap.reportedOrigin,storage:snap.frameReport.storage});
  if(spec.name==='opaque sandbox')log('opaque sandbox denies localStorage',snap.frameReport.storage.ok===false,{storage:snap.frameReport.storage});
  if(spec.name==='true origin sandbox'){
   const first=snap.frameReport.storage;
   record.push({name:'cross-site lab sees standalone data?',observation:true,yes:first.value==='STANDALONE_DATA',storage:first});
   console.log('OBSERVED_STORAGE',JSON.stringify(record.at(-1)));
   await outer.evaluate(()=>{window.reports=[];document.querySelector('iframe').contentWindow.postMessage({kind:'READ_AGAIN'},'*')});
   await outer.waitForFunction(()=>window.reports.length>0,{timeout:5000});
   log('storage observation repeatable while embedded',JSON.stringify(first)===JSON.stringify((await outer.evaluate(()=>window.reports.at(-1))).frameReport.storage));
  }
 }
 log('standalone state survives embedding tests',await direct.evaluate(()=>localStorage.getItem('GPT_WORKSHOP_SENTINEL'))==='STANDALONE_DATA');
}catch(e){log('cross-origin experiment completed',false,{error:String(e)})}
finally{await ctx.close();await browser.close();await host.close();await lab.close()}
fs.mkdirSync('shots/gpt-stage-v41',{recursive:true});
fs.writeFileSync('shots/gpt-stage-v41/cross-origin-observation.json',JSON.stringify({note:'Synthetic Chrome two-site origin experiment, not Jaskinia or Android validation',record},null,2));
if(record.some(x=>x.pass===false))process.exitCode=1;