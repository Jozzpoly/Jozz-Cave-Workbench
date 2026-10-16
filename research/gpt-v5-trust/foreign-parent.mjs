/* GPT-6 security research: lab bridge from exact PR #2, against an
   unrelated cross-origin parent. Only synthetic sentinel state is used.
   A PASS means the counterexample is reproducible, NOT that the bridge is safe. */
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
const SHA='8d7b1141105d1442eb7690bb345193a386485954';
const bridge=execFileSync('git',['show',SHA+':docs/przyrzad/jaskinia-przyrzad.js'],{encoding:'utf8'});
const results=[],check=(name,ok,e={})=>{results.push({name,pass:!!ok,...e});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(e));};
async function serve(host,content){
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(content)});
 await new Promise(r=>server.listen(0,host,r));
 return {url:'http://'+host+':'+server.address().port+'/',close:()=>new Promise(r=>server.close(r))};
}
const labHTML='<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Lab fixture</h1>'+
 '<script>'+bridge.replace(/<\/script/gi,'<\\/script')+'</script>'+
 '<script>window.syntheticRemarks=[];'+
 'Jaskinia.onRemark(r=>window.syntheticRemarks.push(r));'+
 'Jaskinia.onStateRequest(()=>({text:"PRIVATE_SYNTHETIC_LAB_STATE_FRESH",data:{onlyForTest:"GPT_SENTINEL_PRIVATE"}}));'+
 'Jaskinia.hello({name:"Test Lab",version:"fixture",wants:["remark"]});'+
 'Jaskinia.state("PRIVATE_SYNTHETIC_LAB_STATE",{onlyForTest:"GPT_SENTINEL_PRIVATE"});'+
 '</script></body></html>';
const parentHTML='<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Unrelated web host</h1>'+
 '<script>window.loot=[];addEventListener("message",e=>{if(e.data?.jaskinia===1)window.loot.push({origin:e.origin,sourceMatches:e.source===document.querySelector("iframe")?.contentWindow,data:e.data})});</script></body></html>';
const lab=await serve('localhost',labHTML),host=await serve('127.0.0.1',parentHTML);
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1000,height:780}});
const p=await ctx.newPage();
try {
 await p.goto(host.url);
 await p.evaluate(url=>{const f=document.createElement('iframe');f.src=url;document.body.append(f)},lab.url);
 await p.waitForFunction(()=>window.loot.some(x=>x.data.type==='state'),{timeout:7500});
 const first=await p.evaluate(()=>window.loot.find(x=>x.data.type==='state'));
 check('unrelated parent receives synthetic lab state without prior trusted handshake',
     first.data.text==='PRIVATE_SYNTHETIC_LAB_STATE'&&first.data.data?.onlyForTest==='GPT_SENTINEL_PRIVATE',{origin:first.origin,sourceMatches:first.sourceMatches});
 await p.evaluate(()=>{document.querySelector('iframe').contentWindow.postMessage({jaskinia:1,type:'state?'},'*')});
 await p.waitForFunction(()=>window.loot.some(x=>x.data.text==='PRIVATE_SYNTHETIC_LAB_STATE_FRESH'),{timeout:7500});
 check('unrelated parent can request a fresh synthetic lab state',
     (await p.evaluate(()=>window.loot.some(x=>x.data.data?.onlyForTest==='GPT_SENTINEL_PRIVATE'&&x.data.text==='PRIVATE_SYNTHETIC_LAB_STATE_FRESH'))));
 await p.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({jaskinia:1,type:'remark',text:'FORGED_EXTERNAL_REMARK',at:'2026-10-16T00:00:00Z'},'*'));
 await p.waitForFunction(()=>document.querySelector('iframe').contentWindow&&window.loot.length>0);
 const child=p.frames().find(f=>f.url().startsWith(lab.url));
 await child.waitForFunction(()=>window.syntheticRemarks.length>0,{timeout:7500});
 const r=await child.evaluate(()=>window.syntheticRemarks);
 check('unrelated parent can inject a synthetic remark into the lab',r[0]?.text==='FORGED_EXTERNAL_REMARK',{remarks:r.length});
 const standalone=await ctx.newPage();
 await standalone.goto(lab.url);
 check('drop-in remains inert standalone',await standalone.evaluate(()=>window.Jaskinia.active===false));
 await standalone.close();
} catch(e){check('research completed',false,{error:String(e),stack:e.stack?.slice(0,900)})}
finally{await ctx.close();await browser.close();await lab.close();await host.close()}
fs.mkdirSync('shots/gpt-v5-trust',{recursive:true});
fs.writeFileSync('shots/gpt-v5-trust/real-bridge-observation.json',JSON.stringify({exact_source:SHA,
 scenario:'synthetic lab at localhost framed by unrelated 127.0.0.1 origin',
 note:'All state synthetic. This is a negative security result/unauthorized-parent counterexample, not personal data access.',results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;