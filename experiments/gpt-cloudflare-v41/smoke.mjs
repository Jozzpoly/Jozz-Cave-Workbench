/* GPT TEMP: local browser smoke of exact immutable v4.1 Cloudflare candidate.
   Does not deploy to the internet or claim owner product acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const root=path.resolve(process.argv[2]||process.env.RUNNER_TEMP||'/tmp','jaskinia-gpt-stage-v41','site');
const errors=[], results=[];
const check=(name,condition)=>{results.push({name,pass:!!condition});console.log((condition?'PASS':'FAIL')+' '+name);};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url||'/', 'http://127.0.0.1').pathname;
  const mapping={'/':'index.html','/estate.json':'estate.json','/status.json':'status.json'};
  const target=mapping[pathname];
  if(!target){res.writeHead(404);res.end('Not Found');return;}
  const data=fs.readFileSync(path.join(root,target));
  res.writeHead(200,{'Content-Type':target.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(data);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
  const response=await fetch(base+'/status.json'),status=await response.json();
  const estResp=await fetch(base+'/estate.json'),estate=await estResp.json();
  check('status and estate endpoint HTTP 200',response.status===200&&estResp.status===200);
  check('identity explicitly pinned to v4.1',status.source?.exact_pr_commit==='efbc980658e05decbee683930dedb1102214bc4b');
  check('exactly 24 unclassified/private-free repos',estate.repos?.length===24&&estate.repos.every(x=>x.private===false));
  check('unknown route HTTP 404', (await fetch(base+'/private')).status===404);
  browser=await chromium.launch({headless:true});
  for(const device of [{name:'desktop',viewport:{width:1520,height:950},isMobile:false,hasTouch:false},{name:'touch',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
    const context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(device.name+':'+e.message));
    await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForFunction(()=>!!window.__JASK?.store,{timeout:12000});
    const current=await page.evaluate(()=>({version:JASK_BUILD.v,place:__JASK.packageData(false).jaskinia.dziala_jako,repoCount:__BIB.D.repos.length,spaces:__JASK.store.spaces.length}));
    check(device.name+' v4.1 actual boot/public dataset',current.version==='4.1'&&current.repoCount===24&&current.spaces>=5);
    check(device.name+' correctly detects hosted origin',current.place==='web');
    const shots=path.resolve('shots/gpt-stage-v41');
    fs.mkdirSync(shots,{recursive:true});
    await page.screenshot({path:path.join(shots,device.name+'.png'),fullPage:false});
    await context.close();
  }
  check('no Chromium page errors',errors.length===0);
} catch(e) {
  console.error('ERROR',e.stack||String(e));
  check('browser test completed',false);
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
fs.mkdirSync('shots/gpt-stage-v41',{recursive:true});
fs.writeFileSync('shots/gpt-stage-v41/result.json',JSON.stringify({results,errors,source:'exact PR v4.1',deployed:false},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
