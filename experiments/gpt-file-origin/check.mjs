/* Temporary GPT diagnostic: compare two exact builds through file:// and HTTP, not Android content://. */
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import * as vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {serve} from '../../tools/serve.mjs';
fs.mkdirSync('shots',{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true});
const srv=await serve(path.resolve('.'));
for(const name of ['jaskinia.html','jaskinia-web.html']){
 const html=fs.readFileSync(path.resolve('dist',name),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(x=>x[1].includes('JASK_BUILD'));
 const diag={name,length:html.length,scriptCount:scripts.length,top:html.slice(0,150).replace(/\n/g,' '),syntax:'UNKNOWN',syntaxError:null};
 if(scripts.length){try{new vm.Script(scripts[0][1],{filename:name+'.inline.js'});diag.syntax='PASS';}catch(e){diag.syntax='FAIL';diag.syntaxError=e.stack?.slice(0,1200)}}
 console.log('STATIC_PARSE',JSON.stringify(diag));
 results.push({kind:'static',...diag});
 for(const transport of ['file','http']){
  const url=transport==='file'?pathToFileURL(path.resolve('dist',name)).href:srv.base+'/dist/'+name;
  const context=await browser.newContext({viewport:{width:1380,height:880}});
  const page=await context.newPage();
  const runtime={kind:'browser',name,transport,boot:false,errors:[],consoleErrors:[],place:null,storageAvailable:null};
  page.on('pageerror',e=>runtime.errors.push(e.stack||e.message));
  page.on('console',e=>{if(e.type()==='error')runtime.consoleErrors.push(e.text())});
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
   try{await page.waitForFunction(()=>!!window.__JASK?.store,{timeout:5000});runtime.boot=true;}catch{}
   if(runtime.boot){
     Object.assign(runtime,await page.evaluate(()=>({
       place:__JASK.packageData(false).jaskinia.dziala_jako,
       storageAvailable:(()=>{try{localStorage.setItem('gptfiletmp','1');localStorage.removeItem('gptfiletmp');return true;}catch{return false}})(),
       spaces:__JASK.store.spaces.length
     })));
     if(transport==='file' && runtime.storageAvailable){
       const marker='GPT TEMP FILE RELOAD CHECK';
       await page.evaluate(v=>{__JASK.store.spaces[0].purpose=v;__JASK.persistNow()},marker);
       await page.reload({waitUntil:'domcontentloaded'});
       try{await page.waitForFunction(()=>!!window.__JASK?.store,{timeout:5000});}catch{}
       runtime.storageSurvivesReload=await page.evaluate(v=>window.__JASK?.store?.spaces?.[0]?.purpose===v,marker);
     }
     await page.screenshot({path:path.resolve('shots','gpt-'+name+'-'+transport+'.png')});
   }
  }catch(e){runtime.navigateError=e.message}
  console.log('RUNTIME',JSON.stringify(runtime));
  results.push(runtime);
  await context.close();
 }
}
await browser.close();
srv.close();
fs.writeFileSync('shots/gpt-file-origin-result.json',JSON.stringify({note:'Build/file-origin matrix; not Android content://',results},null,2));
if(results.some(r=>r.kind==='static'&&r.syntax==='FAIL'))process.exitCode=1;
