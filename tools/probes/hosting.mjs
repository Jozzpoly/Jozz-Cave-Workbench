// What a page running in a Jaskinia window can still do, depending on where Jaskinia and the page live.
//
//   node tools/probes/hosting.mjs
//
// This probe never loads Jaskinia itself: a blank host page stands in for it, and a tiny page stands in for a lab or an
// authoring tool. It answers five questions for each placement of the tool:
//   1. Does the page's requestAnimationFrame keep running while its window is hidden the ways Jaskinia hides windows?
//   2. Does the page, framed, see the save it made when it was opened on its own?
//   3. Same question when the host is a downloaded file (file://), over two visits.
//   4. Can the framed page open a folder of the owner's (File System Access API)?
//   5. Can the framed page export its work as a file (download) and import one (file input)?
//
// Conditions, so nobody over-reads the result: Playwright's own Chromium, headless. Playwright launches Chromium with
// ThirdPartyStoragePartitioning disabled (playwright-core server/chromium/chromiumSwitches.js); Chrome ships with it on,
// so this probe turns it back on. Background throttling and field trials stay as Playwright sets them. Nothing here
// was checked in the owner's Opera. Hosts are *.localhost names: secure contexts that resolve to this machine, where
// cave.jozz.localhost and tool.jozz.localhost are one site, and cave.other.localhost is another site.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const core = path.dirname(require.resolve('playwright-core/package.json', { paths: [path.dirname(require.resolve('playwright'))] }));
const defaultDisabled = require(path.join(core, 'lib/server/chromium/chromiumSwitches.js')).chromiumSwitches(false)
  .find(a => a.startsWith('--disable-features='));
const launchLikeChrome = { ignoreDefaultArgs: [defaultDisabled], args: [defaultDisabled.replace('ThirdPartyStoragePartitioning,', '')] };

const TOOL = `<!doctype html><meta charset=utf-8><body style="margin:0">
<button id=ex style="width:120px;height:40px">eksport</button><input id=im type=file style="width:160px;height:40px">
<button id=dir style="width:120px;height:40px">folder</button><script>
window.raf = 0; (function f() { window.raf++; requestAnimationFrame(f); })();
window.saved = localStorage.getItem('SAVE');
if (parent !== window) localStorage.setItem('SAVE', (window.saved || '') + '+framed');
ex.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['{"praca":1}'])); a.download = 'praca.json'; document.body.append(a); a.click(); };
window.imported = null; im.onchange = async () => { window.imported = await im.files[0].text(); };
window.folder = null; dir.onclick = async () => {
  if (typeof showDirectoryPicker !== 'function') { window.folder = 'no API'; return; }
  const late = new Promise(r => setTimeout(() => r('a picker would open'), 1500));
  window.folder = await Promise.race([late, showDirectoryPicker().then(() => 'opened', e => e.name === 'AbortError' ? 'a picker would open' : e.name + ': ' + e.message)]);
};
</script>`;
const serve = () => new Promise(r => {
  const s = http.createServer((q, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(q.url.startsWith('/tool') ? TOOL : '<!doctype html><meta charset=utf-8><body style="margin:0"></body>'); });
  s.listen(0, '127.0.0.1', () => r(s));
});
const A = await serve(), B = await serve();
const at = (host, srv, p = '/') => `http://${host}:${srv.address().port}${p}`;
const PLACES = [
  ['on its own (top level)', null, at('tool.jozz.localhost', A, '/tool')],
  ['framed, same origin (today on Pages)', at('cave.jozz.localhost', A), at('cave.jozz.localhost', A, '/tool')],
  ['framed, same site, other origin', at('cave.jozz.localhost', A), at('tool.jozz.localhost', B, '/tool')],
  ['framed, other site (e.g. *.pages.dev)', at('cave.other.localhost', A), at('tool.jozz.localhost', B, '/tool')],
];
const frameIn = async (page, host, toolUrl, style = 'position:absolute;left:10px;top:10px;width:480px;height:240px;border:0') => {
  if (!host) { await page.goto(toolUrl); return page.mainFrame(); }
  await page.goto(host);
  await page.evaluate(([u, st]) => { const w = document.createElement('div'); w.id = 'w'; w.style.cssText = st; const f = document.createElement('iframe'); f.src = u; f.style.cssText = 'width:100%;height:100%;border:0'; w.append(f); document.body.append(w); }, [toolUrl, style]);
  await page.waitForTimeout(500);
  return page.frames().find(f => f.url() === toolUrl);
};

const browser = await chromium.launch(launchLikeChrome);

// 1. requestAnimationFrame while hidden
console.log('\n1. requestAnimationFrame calls per second while Jaskinia hides the window');
const HIDE = [['visible', ''], ['display:none (another layout)', 'display:none'], ['visibility:hidden (behind a maximized window)', 'visibility:hidden'],
  ['offscreen', 'left:-5000px'], ['opacity:0', 'opacity:0']];
for (const [label, hostIdx] of [['same origin', 1], ['other origin', 2]]) {
  const row = [];
  for (const [, css] of HIDE) {
    const page = await browser.newPage();
    const fr = await frameIn(page, PLACES[hostIdx][1], PLACES[hostIdx][2]);
    if (css) await page.evaluate(c => { const [k, v] = c.split(':'); document.getElementById('w').style[k] = v; }, css);
    await page.waitForTimeout(300);
    const a = await fr.evaluate(() => window.raf); await page.waitForTimeout(1500); const b = await fr.evaluate(() => window.raf);
    row.push(Math.round((b - a) / 1.5));
    await page.close();
  }
  console.log('   ' + label.padEnd(14) + HIDE.map(([h], i) => `${h}: ${row[i]}`).join(' | '));
}

// 2 + 4 + 5. one context per placement, after the tool saved something on its own
console.log('\n2/4/5. what the tool can reach, by placement (the tool first saved "SAVE=standalone" when opened on its own)');
for (const [label, host, toolUrl] of PLACES) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const own = await ctx.newPage(); await own.goto(toolUrl); await own.evaluate(() => localStorage.setItem('SAVE', 'standalone'));
  const page = await ctx.newPage();
  const fr = await frameIn(page, host, toolUrl);
  const seen = await fr.evaluate(() => window.saved);
  const dl = page.waitForEvent('download', { timeout: 3000 }).then(() => 'yes', () => 'no');
  await fr.click('#ex'); const exported = await dl;
  const fc = page.waitForEvent('filechooser', { timeout: 3000 }).then(c => c, () => null);
  await fr.click('#im'); const chooser = await fc;
  if (chooser) await chooser.setFiles({ name: 'praca.json', mimeType: 'application/json', buffer: Buffer.from('{"praca":2}') });
  await fr.click('#dir'); await page.waitForTimeout(1800);
  const r = await fr.evaluate(() => ({ imported: window.imported, folder: window.folder }));
  console.log(`   ${label.padEnd(40)} sees its save: ${JSON.stringify(seen).padEnd(14)} export: ${exported.padEnd(4)} import: ${r.imported ? 'yes' : 'no'}   folder: ${r.folder}`);
  await ctx.close();
}

// 3. a downloaded Jaskinia (file://) framing the tool, two visits, persistent profile
console.log('\n3. a downloaded Jaskinia (file://) framing the tool');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jask-probe-'));
const file = path.join(dir, 'jaskinia.html'); fs.writeFileSync(file, '<!doctype html><meta charset=utf-8><body style="margin:0"></body>');
const pctx = await chromium.launchPersistentContext(path.join(dir, 'profile'), launchLikeChrome);
const own = await pctx.newPage(); await own.goto(PLACES[2][2]); await own.evaluate(() => localStorage.setItem('SAVE', 'standalone'));
for (const visit of [1, 2]) {
  const page = await pctx.newPage();
  const fr = await frameIn(page, 'file://' + file, PLACES[2][2]);
  console.log(`   visit ${visit}: the framed tool sees ${JSON.stringify(await fr.evaluate(() => window.saved))}`);
  await page.close();
}
console.log(`   the tool opened on its own still has ${JSON.stringify(await own.evaluate(() => localStorage.getItem('SAVE')))}`);
await pctx.close();
fs.rmSync(dir, { recursive: true, force: true });

await browser.close(); A.close(); B.close();
