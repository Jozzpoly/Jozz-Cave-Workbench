// Genuine Chromium falsifier for old v6 material editor vs v6.1 IndexedDB settings revisions.
// No owner's model bytes: a 2×2 synthetic image is generated in a disposable localhost profile.
// A green experiment result is NOT a product PASS: this test expects a v6.1 revision to disappear.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../../tools/serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'shots/gpt-v61-oldtab');
const oldPath = path.join(dist, '_gpt61_old_v6.html');
const newPath = path.join(dist, '_gpt61_new_v61.html');
const oldSource = '2fde98717acd65d6ac1718a78fe6167d4d254f47';
const oldBinary = execFileSync('git', ['show', oldSource + ':dist/jaskinia-web.html'], {
  cwd: root, maxBuffer: 12 * 1024 * 1024
});
const blobSha = execFileSync('git', ['hash-object', '--stdin'], { cwd: root, input: oldBinary, encoding: 'utf8' }).trim();
assert.equal(blobSha, 'b5f0416af09b0e3c94a786a1fb774a693c00c8df');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(oldPath, oldBinary);
fs.copyFileSync(path.join(dist, 'jaskinia-web.html'), newPath);

const report = {
  purpose: 'Negative release readiness falsifier for material revisions, not product PASS',
  origin: 'ephemeral localhost Chromium',
  legacySource: oldSource,
  legacyPublishedBlob: blobSha,
  expectedOutcome: 'old v6 material editor overwrites v6.1 settings rev 2'
};
let server, browser, context;
const ready = async (page, file) => {
  await page.goto(server.base + '/' + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__JASK?.store && window.Jaskinia?.materialy), null, { timeout: 30000 });
};
async function pickMaterial(page, name) {
  await page.locator('.mt-tile', { hasText: name }).first().click({ timeout: 30000 });
  await page.waitForFunction(n => document.querySelector('.mt-cap b')?.textContent === n && Boolean(document.querySelector('.mt-go')), name, {timeout: 30000});
}
try {
  server = await serve(dist);
  browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  context = await browser.newContext({ viewport: {width:1400,height:860}});
  await context.addInitScript(() => {
    window.__JASK_PLACE = 'web';
    try { localStorage.setItem('jaskinia:hint','1'); localStorage.setItem('jaskinia:v6','1'); } catch {}
  });
  const A = await context.newPage();
  await ready(A,'_gpt61_old_v6.html');
  const result = await A.evaluate(async () => {
    const canvas = new OffscreenCanvas(2,2);
    const g = canvas.getContext('2d'); g.fillStyle = '#dd3344'; g.fillRect(0,0,2,2);
    const blob = await canvas.convertToBlob({type:'image/png'});
    return await window.Jaskinia.materialy.import([{name:'gpt61_synthetic_material.png',blob}]);
  });
  assert.equal(result.done.length,1,'v6 must import exactly one synthetic material');
  assert.ok(!result.done[0].error, JSON.stringify(result));
  const mid=result.done[0].id;
  await A.evaluate(() => window.Jaskinia.ext.open('materialy'));
  await pickMaterial(A,'gpt61_synthetic_material');
  const original=await A.evaluate(id => window.Jaskinia.materialy.get(id).then(m=>({sets:m.sets?.length??0,scale:m.scale})),mid);
  assert.equal(original.sets,0,'older v6 material has no versioned settings');
  const B = await context.newPage();
  await ready(B,'_gpt61_new_v61.html');
  await B.evaluate(() => window.Jaskinia.ext.open('materialy'));
  await pickMaterial(B,'gpt61_synthetic_material');
  await B.locator('.mt-bar .jk-tb',{hasText:/Skala/}).first().click();
  await B.locator('.jk-menu button, .jk-menu .mi, [role=menuitem]',{hasText:'×2'}).first().click();
  await B.waitForFunction(async id => (await window.Jaskinia.materialy.settings(id)).length===2,mid,{timeout:30000});
  const before=await B.evaluate(id=>window.Jaskinia.materialy.settings(id),mid);
  assert.equal(before[1].n,2); assert.equal(before[1].scale,2);
  // The stale v6 view was opened before B wrote the settings revision.
  await A.locator('.mt-bar .jk-tb',{hasText:/Obrót/}).first().click();
  await A.locator('.jk-menu button, .jk-menu .mi, [role=menuitem]',{hasText:'Postaw: X +90°'}).first().click();
  await A.waitForFunction(async id => (await window.Jaskinia.materialy.get(id))?.rot?.[0]===1,mid,{timeout:30000});
  const C=await context.newPage();
  await ready(C,'_gpt61_new_v61.html');
  const after=await C.evaluate(id=>window.Jaskinia.materialy.settings(id),mid);
  const rawRecord=await C.evaluate(id=>window.Jaskinia.materialy.get(id),mid);
  report.materialId=mid;
  report.originalSettings=original.sets;
  report.newSettingsBefore=before.map(s=>({n:s.n,scale:s.scale}));
  report.settingsAfterStaleV6Write=after.map(s=>({n:s.n,scale:s.scale}));
  report.recordHasSettingsArray=Array.isArray(rawRecord.sets);
  report.releaseGate=after.some(x=>x.n===2)?'PASS':'FAIL';
  report.observation=report.releaseGate==='FAIL'?'V6_ERASED_V61_SETTING_REVISION':'REVISION_SURVIVED';
  fs.writeFileSync(path.join(out,'material-result.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  assert.equal(report.observation,'V6_ERASED_V61_SETTING_REVISION',
    'source-indicated old settings erasure not observed: inspect scenario or changed compatibility');
} catch(err){
  report.executionError=String(err?.stack||err);
  fs.writeFileSync(path.join(out,'material-result.json'),JSON.stringify(report,null,2)+'\n');
  console.error(report.executionError);
  process.exitCode=1;
} finally {
  try{await context?.close();}catch{}
  try{await browser?.close();}catch{}
  try{server?.close();}catch{}
  for(const p of [oldPath,newPath])try{fs.unlinkSync(p);}catch{}
}
