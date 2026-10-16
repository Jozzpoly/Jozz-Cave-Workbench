/* Temporary GPT exploratory test: true file:// not emulated via HTTP. */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const file=pathToFileURL(path.resolve('dist/jaskinia.html')).href;
const browser=await chromium.launch({headless:true});
const cases=[];
const put=(device,s)=>{cases.push({device,...s});console.log('FILE_ORIGIN',JSON.stringify({device,...s}));};
for(const device of [{name:'desktop',viewport:{width:1500,height:900},isMobile:false,hasTouch:false},{name:'touch_emulation',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
  const context=await browser.newContext({...device,deviceScaleFactor:1});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  const s={file:file.slice(0,15),boot:false,place:null,phone:null,storageAvailable:null,settingsSurviveReload:null,persistenceError:null};
  try{
    await page.goto(file,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>!!window.__JASK?.store,{timeout:10000});
    s.boot=true;
    const base=await page.evaluate(()=>({
      place:__JASK.packageData(false).jaskinia.dziala_jako,
      phone:__JASK.phone,
      spaces:__JASK.store.spaces.length,
      storageAvailable:(()=>{try{localStorage.setItem('gpt_audit_temp','1');localStorage.removeItem('gpt_audit_temp');return true;}catch{return false}})(),
    }));
    Object.assign(s,base);
    const p=await page.evaluate(()=>{
      try{
        const J=window.__JASK;
        J.store.spaces[0].purpose='GPT FILE ORIGIN TEST ONLY';
        J.persistNow();
        return {attempted:true};
      }catch(e){return {attempted:false,error:String(e)}}
    });
    if(p.attempted){
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!window.__JASK?.store,{timeout:10000});
      s.settingsSurviveReload=await page.evaluate(()=>__JASK.store.spaces[0].purpose==='GPT FILE ORIGIN TEST ONLY');
    }else s.persistenceError=p.error;
    await page.screenshot({path:path.resolve('shots/gpt-file-origin-'+device.name+'.png'),fullPage:false});
  }catch(e){s.error=e.message}
  s.pageErrors=pageErrors;
  put(device.name,s);
  await context.close();
}
await browser.close();
fs.mkdirSync('shots',{recursive:true});
fs.writeFileSync('shots/gpt-file-origin-result.json',JSON.stringify({kind:'observational-file-origin-check',note:'Touch emulation is NOT Android content://; no claim about real handset',cases},null,2));
if(cases.some(x=>!x.boot||x.place!=='plik'||x.pageErrors.length))process.exitCode=1;
