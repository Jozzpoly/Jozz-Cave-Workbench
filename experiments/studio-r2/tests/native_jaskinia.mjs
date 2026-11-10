// Studio R2: real native Jaskinia, NOT a replacement/mocked window manager.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const html=readFileSync('dist/jaskinia-web.html','utf8');
assert(html.includes('StudioR2Model') && html.includes('Studio R2 · Źródło'), 'R2 absent from real compiled Jaskinia');
const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
const address='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const waitData=async(selector,pred)=>page.waitForFunction(
  ({selector,pred})=>{const e=document.querySelector(selector);if(!e)return false;
    return pred==='active' ? Number(e.dataset.simMs)>500 && Number(e.dataset.emitted)>4
    : pred==='rev1' ? e.dataset.sourceRev==='1'
    : pred==='time' ? Number(e.dataset.simMs)>0
    : false;
  },{selector,pred},{timeout:15000});
try{
  await page.goto(address,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.Jaskinia?.ext?.open && !!document.querySelector('section.win'),{timeout:30000});
  await page.evaluate(()=>window.Jaskinia.ext.open('studio-r2-source',{fresh:true,w:.49,h:.7}));
  const source=page.locator('[data-studio-r2="source"]');
  await source.waitFor({state:'visible',timeout:15000});
  await source.getByRole('button',{name:'Otwórz żywy świat'}).click();
  const world=page.locator('[data-studio-r2="world"]');
  await world.waitFor({state:'visible',timeout:15000});
  const worldShell=page.locator('section.win').filter({has:world});
  // Arrange focus via the REAL shell's pointerdown handling; R2 never accesses private host globals.
  // The old ext.open always floats two panels over one another; focus is explicit in this test.
  const activate=async(shell)=>shell.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{
    button:0,bubbles:true,cancelable:true,pointerType:'mouse'
  })));
  const sourceShell=page.locator('section.win').filter({has:source});
  // Move the native Jaskinia floating window away from the editor's drawing surface.
  const hd=await worldShell.locator('header.whead').boundingBox();
  if(hd){const x=hd.x+hd.width*.5,y=hd.y+Math.min(12,hd.height*.4);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+290,y+7,{steps:12});await page.mouse.up();}
  await waitData('[data-studio-r2="world"]','active');
  assert.equal(await page.locator('section.win').filter({has:world}).count(),1,'world must be native Jaskinia window');
  const eCanvas=source.locator('canvas[aria-label="Rysuj wybraną klatkę ręcznie"]');
  const wCanvas=world.locator('canvas[aria-label^="Żywy świat"]');
  assert(await eCanvas.count()===1 && await wCanvas.count()===1,'real authoring and world canvases missing');
  // Distinct temporal controls: manual editing frame does not pause or reset world.
  const beforeBrowse=Number(await world.getAttribute('data-sim-ms'));
  await source.getByRole('button',{name:'2',exact:true}).click();
  assert.equal(await source.getByRole('button',{name:'2',exact:true}).getAttribute('aria-pressed'),'true');
  const afterBrowse=Number(await world.getAttribute('data-sim-ms'));
  assert(afterBrowse>=beforeBrowse,'manual frame selection moved world clock backwards');
  await source.getByRole('button',{name:'1',exact:true}).click();
  await activate(worldShell);
  await world.getByRole('button',{name:'Pauza świata'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-studio-r2="world"]')?.dataset.worldPaused==='true');
  const pausedAt=Number(await world.getAttribute('data-sim-ms'));
  const emittedBefore=Number(await world.getAttribute('data-emitted'));
  const beforeBitmap=await wCanvas.evaluate(c=>c.toDataURL('image/png'));
  await activate(sourceShell);
  const paintBox=await eCanvas.boundingBox();
  assert(paintBox&&paintBox.width>40,'source canvas not on screen');
  const px=(ix,iy)=>({x:paintBox.x+(ix+.5)/24*paintBox.width,y:paintBox.y+(iy+.5)/32*paintBox.height});
  const p=px(12,11);
  const target=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('[data-studio-r2]')?.dataset.studioR2||null,[p.x,p.y]);
  assert.equal(target,'source','source canvas covered by another native window');
  await page.mouse.move(p.x,p.y);await page.mouse.down();
  const q=px(14,11);await page.mouse.move(q.x,q.y,{steps:4});await page.mouse.up();
  await waitData('[data-studio-r2="world"]','rev1');
  assert.equal(await source.getAttribute('data-source-rev'),'1');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r2:source:1')));
  assert.equal(stored.frames[0].pixels[11*24+12],2,'new source pixels were not persisted');
  assert.equal(Number(await world.getAttribute('data-sim-ms')),pausedAt,'editing source restarted/advanced paused simulation');
  assert.equal(Number(await world.getAttribute('data-emitted')),emittedBefore,'editing source recreated emitted particles');
  const afterBitmap=await wCanvas.evaluate(c=>c.toDataURL('image/png'));
  assert.notEqual(afterBitmap,beforeBitmap,'Existing living particles did not visually respond to changed source');
  // Native resizing of an actual Jaskinia window may not replace the canvas.
  await page.evaluate(()=>{window.__r2CanvasBeforeMax=document.querySelector('[data-studio-r2="world"] canvas');});
  await activate(worldShell);
  await worldShell.locator('button.b-mx').click({force:true});
  await page.waitForFunction(()=>document.querySelector('[data-studio-r2="world"]')?.closest('section.win')?.classList.contains('maxed'));
  await page.waitForTimeout(450);
  assert(await page.evaluate(()=>window.__r2CanvasBeforeMax===document.querySelector('[data-studio-r2="world"] canvas')),'Native maximize restarted the world canvas');
  await worldShell.locator('button.wback').click({force:true});
  await page.waitForFunction(()=>!document.querySelector('[data-studio-r2="world"]')?.closest('section.win')?.classList.contains('maxed'));
  // The entire world survives closing its viewport.
  await activate(worldShell);
  await world.getByRole('button',{name:'Wznów świat'}).click();
  await page.waitForFunction(t=>Number(document.querySelector('[data-studio-r2="world"]')?.dataset.simMs)>t+170,pausedAt,{timeout:10000});
  const liveAt=Number(await world.getAttribute('data-sim-ms'));
  const emittedLive=Number(await world.getAttribute('data-emitted'));
  await worldShell.locator('button.b-x').click({force:true});
  await page.waitForFunction(()=>!document.querySelector('[data-studio-r2="world"]'));
  await page.waitForTimeout(260);
  await source.getByRole('button',{name:'Otwórz żywy świat'}).click({force:true});
  const liveAgain=page.locator('[data-studio-r2="world"]');
  await liveAgain.waitFor({state:'visible'});
  await waitData('[data-studio-r2="world"]','time');
  assert(Number(await liveAgain.getAttribute('data-sim-ms'))>=liveAt,'world time reset when opening a new native view');
  assert(Number(await liveAgain.getAttribute('data-emitted'))>=emittedLive,'particle emitter reset when view closed');
  // Source history is separate from shell layout undo.
  await activate(sourceShell);
  await source.getByRole('button',{name:'Cofnij'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-studio-r2="source"]')?.dataset.sourceRev==='2');
  const undone=await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r2:source:1')));
  assert.equal(undone.frames[0].pixels[11*24+12],3,'authoring undo should restore original hand-drawn pixel');
  await source.getByRole('button',{name:'Ponów'}).click();
  const redone=await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r2:source:1')));
  assert.equal(redone.frames[0].pixels[11*24+12],2);
  // RED contract test: after painting, Ctrl+Z must undo source pixels, not Jaskinia window layout.
  const oldLayout=await page.evaluate(()=>JSON.stringify(window.__JASK.L.tree));
  await source.focus();
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>document.querySelector('[data-studio-r2="source"]')?.dataset.sourceRev==='4',{timeout:3000});
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r2:source:1')))).frames[0].pixels[11*24+12],3,'Ctrl+Z must restore source pixel');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__JASK.L.tree)),oldLayout,'Ctrl+Z must not alter Jaskinia layout when source is active');
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(()=>document.querySelector('[data-studio-r2="source"]')?.dataset.sourceRev==='5',{timeout:3000});
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r2:source:1')))).frames[0].pixels[11*24+12],2);
  withBlock: {
    const exporter=source.getByRole('button',{name:'Eksport JSON'});
    const [dl]=await Promise.all([page.waitForEvent('download'),exporter.click({force:true})]);
    const pth=await dl.path();
    assert(pth,'File download should complete');
  }
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.Jaskinia?.ext?.open && !!document.querySelector('section.win'),{timeout:30000});
  await page.evaluate(()=>window.Jaskinia.ext.open('studio-r2-source',{w:.46,h:.7}));
  await page.waitForFunction(()=>Number(document.querySelector('[data-studio-r2="source"]')?.dataset.sourceRev)>=3);
  const recovered=await page.evaluate(()=>JSON.parse(localStorage.getItem('jaskinia-studio-r2:source:1')));
  assert.equal(recovered.frames[0].pixels[11*24+12],2,'browser reload lost edit');
  // A different tab writes the same source. This tab must NOT silently overwrite its bytes.
  const remote=await context.newPage();
  await remote.goto(address,{waitUntil:'domcontentloaded'});
  await remote.waitForFunction(()=>!!window.Jaskinia?.ext?.open);
  const foreignBytes=await remote.evaluate(()=>{
    const key='jaskinia-studio-r2:source:1';
    const d=JSON.parse(localStorage.getItem(key));
    d.frames[0].pixels[0]=6;d.revision+=1;
    const content=JSON.stringify(d);localStorage.setItem(key,content);return content;
  });
  await page.waitForFunction(()=>document.querySelector('[data-studio-r2="source"] .r2-warn')?.textContent?.includes('innej karcie'));
  const canvasAgain=page.locator('[data-studio-r2="source"] canvas[aria-label^="Rysuj"]').last();
  const b=await canvasAgain.boundingBox();
  assert(b&&b.width>24);
  await page.mouse.click(b.x+(1.5/24)*b.width,b.y+(1.5/32)*b.height);
  await page.waitForFunction(()=>Number(document.querySelector('[data-studio-r2="source"]')?.dataset.sourceRev)>=6);
  assert.equal(await page.evaluate(()=>localStorage.getItem('jaskinia-studio-r2:source:1')),foreignBytes,'Old tab overwrote a second tab after conflict');
  await remote.close();
  await page.screenshot({path:'studio-r2-native-pass.png',fullPage:true});
  assert.equal(errors.length,0,'Browser runtime errors: '+errors.join(' | '));
  console.log('PASS Studio R2 native: authoring source + autonomous living world, manual time, particle visuals update without reset, real host lifecycle, local recovery');
}catch(e){
  try{await page.screenshot({path:'studio-r2-native-failure.png',fullPage:true});}catch{}
  console.error('Studio R2 native FAIL:',String(e),'browser errors:',errors);
  throw e;
}finally{
  await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
}
