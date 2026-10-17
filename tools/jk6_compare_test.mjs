// Jaskinia experimental A/B browser qualification.
// Prerequisites: npm ci; npx playwright install chromium; npm run jaskinia
// Run: node tools/jk6_compare_test.mjs [shots-directory]
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const shots = process.argv[2] || path.join(root, 'shots/jk6');
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
const test = path.join(dist, '_jk6_compare.html');
fs.writeFileSync(test, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + body + '</body></html>');
const srv = await serve(dist);
const browser = await chromium.launch();
let pass=0, fail=0; const errors=[];
const ok = (v, label, detail='') => { console.log(v?'PASS':'FAIL',label,detail); v?pass++:fail++; };
try {
  const ctx = await browser.newContext({viewport:{width:1600,height:980},acceptDownloads:true});
  await ctx.addInitScript(() => { window.__JASK_PLACE='web'; localStorage.setItem('jaskinia:hint','1'); localStorage.setItem('jaskinia:v2','OWNER_SENTINEL'); localStorage.setItem('jaskinia:kopie','BACKUP_SENTINEL'); localStorage.setItem('jaskinia:uwagi','NOTES_SENTINEL'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(srv.base+'/_jk6_compare.html');
  await page.waitForTimeout(500);
  let ids = await page.evaluate(() => __JASK.leafIds(__JASK.L.tree));
  while (ids.length < 3) {
    await page.locator('.win:not([hidden]) .b-sr').first().click();
    ids = await page.evaluate(() => __JASK.leafIds(__JASK.L.tree));
  }
  await page.evaluate(ids => __JASK.commit('A/B test', L => {
    ids.slice(0,3).forEach((id,i) => {
      L.wins[id].pin=null;
      L.wins[id].type=i===2?'porownanie':'przyrzad';
      L.wins[id].st=i===2?{}:{url:'pokaz:pilki',title:'Piłki '+i};
    });
  }),ids);
  await page.waitForTimeout(2800);
  const live = await page.evaluate(() => __JASK.live().filter(e => e.url==='pokaz:pilki').map(e => ({id:e.id,energy:e.n.energia||0})));
  ok(live.length===2 && live.every(x=>x.energy>0),'two independently emitting labs',JSON.stringify(live));
  const cmp = page.locator('.win[data-type="porownanie"]');
  ok(await cmp.count()===1,'comparison registered as window');
  const status = await cmp.locator('.cmp-status').textContent();
  ok(status.includes('Dwa bieżące strumienie danych'),'two data sources joined on a shared clock',status);
  const ink = await cmp.locator('.cmp-canvas').evaluate(c => { const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i])n++; return n; });
  ok(ink>500,'draws a nonempty canvas graph','pixels='+ink);
  await page.screenshot({path:path.join(shots,'desktop.png'),fullPage:true});
  const before = await page.evaluate(ids=>ids.slice(0,2).map(id=>document.querySelector('.win[data-id="'+id+'"] iframe').contentWindow.__boot),ids);
  // Negative physical measurements must not be turned into formula-escaped text.
  await page.evaluate(id => {
    const frame = document.querySelector('.win[data-id="' + id + '"] iframe');
    frame.contentWindow.Jaskinia.signals({ energia: -17.25 });
  }, ids[0]);
  await page.waitForTimeout(80);
  const dl = page.waitForEvent('download');
  await cmp.getByRole('button',{name:'Zapisz próbki CSV'}).click();
  const download=await dl, csv=fs.readFileSync(await download.path(),'utf8');
  ok(csv.includes('instrument_id')&&csv.includes('"A"')&&csv.includes('"B"'),'CSV includes two sources and their identities');
  ok(csv.includes(',-17.25\r\n'),'signed measurement stays numeric in CSV');
  await cmp.locator('select[aria-label="Instrument B"]').selectOption(ids[0]);
  await page.waitForTimeout(350);
  ok((await cmp.locator('.cmp-status').textContent()).includes('Wybierz dwa różne'),'same-source comparison explicitly refused');
  await cmp.locator('select[aria-label="Instrument B"]').selectOption(ids[1]);
  await page.waitForTimeout(400);
  const after = await page.evaluate(ids=>ids.slice(0,2).map(id=>document.querySelector('.win[data-id="'+id+'"] iframe').contentWindow.__boot),ids);
  ok(JSON.stringify(after)===JSON.stringify(before),'changing comparison never restarts instruments');
  const isolated = await page.evaluate(() => ({
    legacy: localStorage.getItem('jaskinia:v2'),
    backup: localStorage.getItem('jaskinia:kopie'),
    notes: localStorage.getItem('jaskinia:uwagi'),
    experimental: localStorage.getItem('jaskinia:ab-exp:v2'),
  }));
  ok(isolated.legacy === 'OWNER_SENTINEL' && isolated.backup === 'BACKUP_SENTINEL'
     && isolated.notes === 'NOTES_SENTINEL' && !!isolated.experimental,
     'A/B experiment preserves ordinary Jaskinia layouts, backups and notes');
  await ctx.close();

  // A new owner enters an empty comparison: one deliberate click creates two real independent demos.
  const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 980 } });
  await ctx2.addInitScript(() => { window.__JASK_PLACE = 'web'; localStorage.setItem('jaskinia:hint', '1'); });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => errors.push(e.message));
  await page2.goto(srv.base + '/_jk6_compare.html');
  await page2.waitForTimeout(400);
  await page2.evaluate(() => {
    const id = __JASK.leafIds(__JASK.L.tree)[0];
    __JASK.commit('A/B entry test', L => { L.wins[id].type = 'porownanie'; L.wins[id].st = {}; });
  });
  await page2.locator('.cmp-start').click();
  await page2.waitForTimeout(2100);
  const started = await page2.evaluate(() => ({
    labs: __JASK.live().filter(e => e.url === 'pokaz:pilki').length,
    windows: Object.values(__JASK.L.wins).filter(w => w.type === 'przyrzad').length,
    compare: Object.values(__JASK.L.wins).find(w => w.type === 'porownanie')?.st,
  }));
  ok(started.labs === 2 && started.windows >= 2 && started.compare?.cmpA !== started.compare?.cmpB,
    'one click creates and connects two independently running demos', JSON.stringify(started));
  await page2.screenshot({ path: path.join(shots, 'one-click-entry.png'), fullPage: true });
  await ctx2.close();

  const phoneCtx = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
  await phoneCtx.addInitScript(() => { window.__JASK_PLACE='web'; localStorage.setItem('jaskinia:hint','1'); });
  const phonePage = await phoneCtx.newPage();
  phonePage.on('pageerror', e => errors.push(e.message));
  await phonePage.goto(srv.base + '/_jk6_compare.html');
  await phonePage.waitForTimeout(500);
  await phonePage.evaluate(() => {
    const id = __JASK.leafIds(__JASK.L.tree)[0];
    __JASK.commit('A/B mobile entry', L => { L.wins[id].type='porownanie'; L.wins[id].st={}; });
  });
  await phonePage.locator('.cmp-start').tap();
  await phonePage.waitForTimeout(1000);
  const phoneState = await phonePage.evaluate(() => ({
    phone: __JASK.phone,
    two: Object.values(__JASK.L.wins).filter(w => w.type === 'przyrzad').length,
    cmp: Object.values(__JASK.L.wins).some(w => w.type === 'porownanie'),
  }));
  ok(phoneState.phone && phoneState.two === 2 && phoneState.cmp,
    'phone tap launches two labs without losing the comparison', JSON.stringify(phoneState));
  const hidden = await phonePage.evaluate(() => __JASK.live().filter(e => e.url === 'pokaz:pilki').map(e => e.vis));
  const warning = await phonePage.locator('.win[data-type="porownanie"] .cmp-caveat').allTextContents();
  ok(hidden.length === 2 && hidden.every(x => x === false),
    'mobile limitation reproduced: both labs are hidden while comparison is open', JSON.stringify(hidden));
  ok(warning.some(x => x.includes('ukryte laboratoria mogą pauzować')),
    'mobile limitations explicitly communicated to the owner');
  await phonePage.waitForTimeout(2800);
  ok((await phonePage.locator('.win[data-type="porownanie"] .cmp-status').textContent()).includes('Ślad pomiarów'),
    'paused mobile labs are labeled historical, never two live streams');
  await phonePage.screenshot({ path:path.join(shots,'phone-entry.png'), fullPage:true });
  await phoneCtx.close();
} finally {
  await browser.close(); srv.close(); fs.rmSync(test,{force:true});
}
ok(!errors.length,'no JS page errors',errors.slice(0,3).join(' | '));
console.log(pass+' PASS / '+fail+' FAIL');
process.exit(fail?1:0);
