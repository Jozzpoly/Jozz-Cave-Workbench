// Full native-shell Studio R1 smoke test, not a contract mock.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const html = readFileSync('dist/jaskinia-web.html', 'utf8');
assert(html.includes('Studio R1 — obraz') && html.includes('StudioR1Model'), 'R1 source absent from compiled Jaskinia');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',err=>err?reject(err):resolve()));
const url = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader']});
const context = await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page = await context.newPage();
const errors = [];
page.on('pageerror',e=>errors.push(String(e)));
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(() => !!window.Jaskinia?.ext?.open && !!document.querySelector('section.win'),{timeout:30000});
  await page.evaluate(()=>window.Jaskinia.ext.open('studio-r1-painter',{fresh:true,w:0.48,h:0.7}));
  const paint=page.locator('[data-studio-r1="painter"]');
  await paint.waitFor({state:'visible',timeout:15000});
  assert.equal(await paint.count(),1,'Painter should exist in real Jaskinia');
  await paint.getByRole('button',{name:'Otwórz obserwator'}).click();
  const obs=page.locator('[data-studio-r1="observer"]');
  await obs.waitFor({state:'visible',timeout:10000});
  assert.equal(await obs.count(),1,'Observer should exist in real Jaskinia');
  const obsShell=page.locator('section.win').filter({has:obs});
  const header=obsShell.locator('header.whead');
  const h=await header.boundingBox();
  if(h) {
    const x=h.x+h.width*0.5,y=h.y+Math.min(13,h.height*0.4);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+330,y+8,{steps:9});await page.mouse.up();
  }
  const canvas=paint.locator('canvas');
  let rect=await canvas.boundingBox();
  assert(rect && rect.width>30,'Painter canvas missing');
  const point=(px,py)=>[rect.x+(px+.5)/24*rect.width,rect.y+(py+.5)/24*rect.height];
  let [x,y]=point(2,2);
  const atop=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('[data-studio-r1]')?.dataset.studioR1||null,[x,y]);
  assert.equal(atop,'painter','After moving observer, paint area should be available');
  await page.mouse.move(x,y);await page.mouse.down();
  [x,y]=point(4,2);await page.mouse.move(x,y,{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-studio-r1="observer"] .r1-status')?.textContent?.includes('rewizja 1'));
  const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r1:demo:1')));
  assert.equal(current.revision,1);
  assert.equal(current.pixels[2*24+2],3);
  const painterShell=page.locator('section.win').filter({has:paint});
  await painterShell.locator('button.b-x').click({force:true});
  await page.waitForFunction(()=>!document.querySelector('[data-studio-r1="painter"]'));
  assert((await obs.innerText()).includes('rewizja 1'),'Document should outlive painter view');
  await obs.getByRole('button',{name:'Otwórz edytor'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-studio-r1="painter"] .r1-status')?.textContent?.includes('rewizja 1'));
  await page.locator('[data-studio-r1="painter"]').getByRole('button',{name:'Cofnij'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-studio-r1="observer"] .r1-status')?.textContent?.includes('rewizja 2'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r1:demo:1')).pixels[2*24+2]),0);
  await page.locator('[data-studio-r1="painter"]').getByRole('button',{name:'Ponów'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-studio-r1="observer"] .r1-status')?.textContent?.includes('rewizja 3'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.Jaskinia?.ext?.open&&!!document.querySelector('section.win'),{timeout:30000});
  await page.evaluate(()=>window.Jaskinia.ext.open('studio-r1-painter',{fresh:true,w:0.48,h:0.7}));
  await page.waitForFunction(()=>document.querySelector('[data-studio-r1="painter"] .r1-status')?.textContent?.includes('rewizja 3'));
  await page.screenshot({path:'studio-r1-native-1440.png'});
  assert.equal(errors.length,0,'Browser errors: '+errors.join(' | '));
  console.log('PASS native Jaskinia R1: registration, two native windows, browser paint, revision sync, native close/reopen, undo/redo, real origin reload');
} catch(e) {
  try {await page.screenshot({path:'studio-r1-native-failure.png',fullPage:true});}catch{}
  console.error('Native R1 failure:',String(e));
  console.error('Page errors:',errors);
  console.error('Visible R1 roots:',await page.locator('[data-studio-r1]').count().catch(()=>-1));
  throw e;
} finally {
  await context.close(); await browser.close(); await new Promise(resolve=>server.close(resolve));
}
