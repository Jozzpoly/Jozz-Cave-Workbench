/* GPT diagnostic: actual v4.1 and immutable v2/main HTML, same file path,
   persistent real Chromium profile, synthetic unknown future window type.
   Never touches Owner's localStorage, browser, credentials or private data. */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const tmp=mkdtempSync(path.join(os.tmpdir(),'gpt-v41-backcompat-'));
const file=path.join(tmp,'Jaskinia.html');
const url=pathToFileURL(file).href;
const current=readFileSync('dist/jaskinia.html','utf8');
const legacy='<meta charset="utf-8">\n'+execFileSync('git',['show','4567a0ea09afd11213d979daf54a393ba9017be0:dist/jaskinia.html'],{encoding:'utf8',maxBuffer:20*1024*1024});
const record=[],note=(name,pass,extra={})=>{record.push({name,pass:!!pass,...extra});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(extra));};
const profile=path.join(tmp,'profile');const browser=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:900}});
let tab=null;
const load=async html=>{
 writeFileSync(file,html,'utf8');
 if(tab)await tab.close();
 tab=await browser.newPage();
 const errs=[];tab.on('pageerror',e=>errs.push(e.message));
 await tab.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
 await tab.waitForFunction(()=>!!window.__JASK?.store,{timeout:8000});
 note('actual Jaskinia boots from same file origin',errs.length===0,{errors:errs});
 return tab;
};
let sentinelWin='';
try {
 await load(current);
 // Separate downloaded filenames are a different question from a same-path overwrite.
 // Observe actual Chromium storage behavior without assuming it is browser-portable.
 const otherFile=path.join(tmp,'Jaskinia-other-download.html');
 writeFileSync(otherFile,current,'utf8');
 const marker='GPT_DIFFERENT_FILE_NAME_MARKER';
 await tab.evaluate(v=>localStorage.setItem('gpt:crossfile',v),marker);
 const second=await browser.newPage();
 await second.goto(pathToFileURL(otherFile).href,{waitUntil:'domcontentloaded',timeout:20000});
 await second.waitForFunction(()=>!!window.__JASK?.store,{timeout:8000});
 const shared=await second.evaluate(v=>localStorage.getItem('gpt:crossfile')===v,marker);
 record.push({name:'distinct downloaded filenames share localStorage in this Chromium profile?',observation:true,shared});
 console.log('OBSERVED_CROSS_FILE_STORAGE',JSON.stringify({shared}));
 await second.close();
 let initial=await tab.evaluate(()=>{
   const J=window.__JASK,sp=J.store.spaces[0],id=J.leafIds(sp.L.tree)[0];
   const w=sp.L.wins[id];w.type='gpt_future_type';w.pin='gpt_future_private_project';delete w.lost;
   J.persistNow();
   const disk=JSON.parse(localStorage.getItem('jaskinia:v2'));
   return {id,storedType:disk.spaces[0].L.wins[id].type,storedPin:disk.spaces[0].L.wins[id].pin};
 });
 sentinelWin=initial.id;
 note('future-style unknown window and pin stored in shared v2 key',initial.storedType==='gpt_future_type'&&initial.storedPin==='gpt_future_private_project',initial);
 await load(legacy);
 const old=await tab.evaluate(id=>{
  const J=window.__JASK;J.persistNow();
  const memory=J.store.spaces[0].L.wins[id],disk=JSON.parse(localStorage.getItem('jaskinia:v2')).spaces[0].L.wins[id];
  return {memoryType:memory?.type,memoryPin:memory?.pin??null,diskType:disk?.type,diskPin:disk?.pin??null,lost:disk?.lost||null};
 },sentinelWin);
 note('old binary has overwritten unknown type and pin',old.diskType==='wybor'&&old.diskPin===null&&!old.lost,old);
 await load(current);
 const after=await tab.evaluate(id=>{
  const w=window.__JASK.store.spaces[0].L.wins[id];
  return {type:w?.type,pin:w?.pin??null,lost:w?.lost||null};
 },sentinelWin);
 note('returning to v4.1 cannot recover already discarded data',after.type==='wybor'&&after.pin===null&&!after.lost,after);
} catch(e){note('scenario completed',false,{error:String(e),stack:e.stack?.slice(0,900)})}
finally{if(tab)await tab.close();await browser.close();mkdirSync('shots/gpt-v41-legacy',{recursive:true});writeFileSync('shots/gpt-v41-legacy/result.json',JSON.stringify({scenario:'synthetic future data -> authentic v2 binary -> v4.1, same file path + persistent Chromium context',scope:'not proof a user lost data; test-only sentinel; no actual owner storage',record},null,2));rmSync(tmp,{recursive:true,force:true})}
if(record.some(x=>x.pass===false))process.exitCode=1;