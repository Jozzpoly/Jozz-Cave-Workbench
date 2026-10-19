// Jaskinia v6.2 checks: the owner's ten remarks from using v6 (18 Oct), each answered by behaviour.
//   charts    every chart mark answers the pointer the same way: it brightens, the same note follows, it fades back
//   remarks   a remark can be corrected, other tabs take it in, answers show under it and in "Dla agentów"
//   models    an .obj from Blockbench looks as in Blockbench (matte, cut-out alpha, sharp pixels); one switch for sharp
//             or smooth pixels; models that were never his are not offered and leave the library once, with Cofnij
//   controls  the wheel button moves the 3D view; flying: Space up, Shift down, the wheel sets the speed; no stuck keys
//   chrome    on a desk the interface is compact and the window tools stay quiet until the header is pointed at
// node tools/jk62_test.mjs [shotdir]     JK_BB_EXPORT=<a folder of Blockbench .obj exports> adds a check on real files
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk62t');
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_jk62_test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
const SRV = await serve(dist);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
const ONLY = process.env.ONLY || '';
const BB = process.env.JK_BB_EXPORT || '/mnt/user-data/uploads/Blockbench/export';
async function context(init, arg) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(() => { window.__JASK_PLACE = 'web'; try { localStorage.setItem('jaskinia:hint', '1'); localStorage.setItem('jaskinia:v6', '1'); } catch { /* fine */ } });
  if (init) await ctx.addInitScript(init, arg);
  return ctx;
}
// a window opened from outside floats on top: each chart is looked at alone, then closed
const openOnTop = async (J, wait, ty) => { await J(ty => Jaskinia.ext.open(ty), ty); await wait(700); };
const closeTop = async (J, wait, ty) => { await J(ty => { const ws = [...document.querySelectorAll('.win')].filter(w => w.dataset.type === ty); ws[ws.length - 1]?.querySelector('.b-x')?.click(); }, ty); await wait(300); };
async function tab(ctx, hash = '') {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(SRV.base + '/_jk62_test.html' + hash);
  await page.waitForTimeout(700);
  return { page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }) };
}
const waitFor = async (J, fn, a, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 120)); } return null; };
const center = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
const onIt = (J, sel) => J(sel => {
  const el = document.querySelector(sel); if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const b = el.getBoundingClientRect();
  for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) { const x = b.x + b.width * i / 8, y = b.y + b.height * j / 8, at = document.elementFromPoint(x, y); if (at === el || el.contains(at)) return { x, y }; }
  const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  return { miss: at ? at.tagName + '.' + (at.className?.baseVal ?? at.className) : null };
}, sel);
const tipNow = J => J(() => { const t = document.querySelector('.tip'); return t && !t.hidden ? { tt: t.querySelector('.tt')?.textContent || '', ts: t.querySelector('.ts')?.textContent || '', all: t.textContent, n: document.querySelectorAll('.tip:not([hidden])').length } : null; });

/* ---------- 1. charts: one way of answering ---------- */
if (!ONLY || ONLY === 'charts') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  for (const ty of ['rok', 'zegar', 'statystyki']) { await J(ty => Jaskinia.ext.open(ty), ty); await wait(250); }
  await wait(600);
  const titles = await J(() => [...document.querySelectorAll('svg title')].filter(x => x.parentElement?.tagName.toLowerCase() !== 'svg').length);
  ok(titles === 0, 'no chart mark keeps a browser tooltip (svg <title>)', String(titles));
  ok(await J(() => document.querySelectorAll('[data-tip]').length > 50), 'chart marks carry the note instead', String(await J(() => document.querySelectorAll('[data-tip]').length)));
  for (const ty of ['rok', 'zegar', 'statystyki']) await closeTop(J, wait, ty);
  // the year: a busy day
  await openOnTop(J, wait, 'rok');
  await J(() => document.querySelector('.st-year .c.l4')?.scrollIntoView({ block: 'center' }));
  await wait(200);
  let c = await center(page, '.st-year .c.l4');
  if (c) { await page.mouse.move(c.x - 20, c.y - 20); await page.mouse.move(c.x, c.y, { steps: 3 }); await wait(150); }
  let tp = await tipNow(J);
  ok(tp && /commit/.test(tp.tt) && tp.ts.length > 3, 'a day in the year answers with the note: commits large, the day under', JSON.stringify(tp));
  ok(await J(() => !!document.querySelector('.st-year .c.tip-on')), 'the day under the pointer lights up');
  await shot('01-year-tip');
  await page.mouse.move(5, 890); await wait(450);
  ok(!(await tipNow(J)) && await J(() => !document.querySelector('.tip-on')), 'leaving it the note goes and the light fades back');
  await closeTop(J, wait, 'rok');
  // "Kiedy i jak": its hour bars (they had only the browser's tooltip until v6.3)
  await openOnTop(J, wait, 'zegar');
  await J(() => document.querySelectorAll('.jk-toast').forEach(x => x.remove()));
  c = await onIt(J, '.win[data-type="zegar"] .st-mb.hrs .mb.peak');
  if (c?.x) { await page.mouse.move(c.x - 40, c.y); await page.mouse.move(c.x, c.y, { steps: 3 }); await wait(150); }
  tp = await tipNow(J);
  ok(tp && /commit/.test(tp.tt) && /:00/.test(tp.ts) && await J(() => !!document.querySelector('.st-mb .mb.tip-on')), 'an hour in "Kiedy i jak" answers with the same note and lights up', JSON.stringify(tp || c));
  await page.mouse.move(5, 890); await wait(300);
  await closeTop(J, wait, 'zegar');
  // the work clock on the project card (its wedges)
  await J(() => document.querySelectorAll('.jk-toast').forEach(x => x.remove()));
  c = await onIt(J, '.win[data-type="karta"] .clock .wedge.peak');
  if (c?.x) { await page.mouse.move(c.x - 40, c.y); await page.mouse.move(c.x, c.y, { steps: 3 }); await wait(150); }
  tp = await tipNow(J);
  ok(tp && /commit/.test(tp.tt) && /:00/.test(tp.ts), 'an hour on the work clock answers with the same note', JSON.stringify(tp || c));
  await page.mouse.move(5, 890); await wait(300);
  // Puls (in the first layout)
  await onIt(J, '.seismo');
  await J(() => document.querySelectorAll('.jk-toast').forEach(x => x.remove())); // a toast over the chart would take the pointer
  const bar = await J(() => { const sv = document.querySelector('.seismo').getBoundingClientRect(), bs = [...document.querySelectorAll('.seismo .sbar')], b = bs[bs.length - 3].getBoundingClientRect(); return { x: b.x + b.width / 2, y: sv.y + 6 }; });
  if (bar?.x) { await page.mouse.move(bar.x, bar.y - 30); await page.mouse.move(bar.x, bar.y, { steps: 3 }); await wait(150); }
  tp = await tipNow(J);
  ok(tp && /commit/.test(tp.tt) && await J(() => !!document.querySelector('.seismo .sbar.on')), 'Puls: the bar lights up and the note says the day', JSON.stringify(tp || bar));
  await shot('02-puls-tip');
  await page.mouse.move(5, 890); await wait(450);
  ok(await J(() => !document.querySelector('.seismo .sbar.on')), 'Puls: the light fades back after leaving');
  // Statystyki
  await openOnTop(J, wait, 'statystyki');
  await J(() => document.querySelector('.st-chart')?.scrollIntoView({ block: 'center' }));
  await wait(200);
  const sb = await J(() => { const bs = [...document.querySelectorAll('.st-chart .bar')]; const b = bs[Math.floor(bs.length / 2)]?.getBoundingClientRect(); return b ? { x: b.x + b.width / 2, y: b.y + b.height - 2 } : null; });
  if (sb) { await page.mouse.move(sb.x, sb.y - 40); await page.mouse.move(sb.x, sb.y, { steps: 3 }); await wait(150); }
  tp = await tipNow(J);
  ok(tp && /commit/.test(tp.tt) && await J(() => !!document.querySelector('.st-chart .bar.on')), 'Statystyki: the bar lights up like in Puls', JSON.stringify(tp));
  await page.mouse.move(5, 890); await wait(300);
  await closeTop(J, wait, 'statystyki');
  // the map (in the first layout): its own richer note, and only one
  ok(await J(() => [...document.querySelectorAll('.map .parcel')].every(p => !p.querySelector('title'))), 'map parcels have no browser tooltip under their own note');
  c = await center(page, '.map .parcel rect.body');
  if (c) { await page.mouse.move(c.x - 30, c.y); await page.mouse.move(c.x, c.y, { steps: 3 }); await wait(250); }
  tp = await tipNow(J);
  ok(tp && tp.n === 1, 'pointing at a parcel shows exactly one note', JSON.stringify(tp));
  await ctx.close();
}

/* ---------- 2. remarks ---------- */
if (!ONLY || ONLY === 'remarks') {
  const T0 = 1792300000000; // a made-up moment: the test never carries the owner's own remarks
  const ctx = await context(t0 => { try { if (!sessionStorage.getItem('uw')) { localStorage.setItem('jaskinia:uwagi', JSON.stringify([{ t: t0, text: 'Uwaga testowa o oknie gry', v: 'v6', u: 'Granie' }])); sessionStorage.setItem('uw', '1'); } } catch { /* fine */ } }, T0);
  await ctx.addInitScript(t0 => { window.__T0 = t0; }, T0);
  const A = await tab(ctx), B = await tab(ctx);
  await A.J(() => __JASK.openSettings('uwagi')); await A.wait(500);
  ok(await A.J(() => !!document.querySelector('.set-list button[title="Popraw uwagę"]')), 'every remark in the list can be corrected (pencil)');
  await A.page.locator('.set-list button[title="Popraw uwagę"]').first().click();
  await A.wait(200);
  await A.page.locator('.jk-uwaga textarea').fill('Uwaga testowa o oknie gry, dopisana później (poprawione)');
  await A.page.locator('.jk-uwaga .btn:not(.ghost)').click();
  await A.wait(300);
  const u = await A.J(() => __JASK.uwagi.find(x => x.t === window.__T0));
  ok(u && /poprawione/.test(u.text) && u.edited > 0, 'the corrected remark keeps its moment and says when it was corrected', JSON.stringify(u && { text: u.text.slice(-12), edited: !!u.edited }));
  const inB = await waitFor(B.J, () => __JASK.uwagi.find(x => x.t === window.__T0)?.text.includes('poprawione'));
  ok(!!inB, 'another tab takes in the correction');
  // answers come from the private layer: when this build has one, a remark at that moment shows it
  const key = await A.J(() => Object.keys(typeof UW_ODP !== 'undefined' ? UW_ODP : {})[0] || null);
  if (key) {
    await A.J(k => { const l = JSON.parse(localStorage.getItem('jaskinia:uwagi') || '[]'); l.push({ t: +k, text: 'Uwaga testowa z odpowiedzią', v: 'v6' }); localStorage.setItem('jaskinia:uwagi', JSON.stringify(l)); }, key);
    await A.page.reload(); await A.wait(900);
    await A.J(() => __JASK.openSettings('uwagi')); await A.wait(500);
  }
  const want = key ? await A.J(k => UW_ODP[k].odp.slice(0, 24), key) : null;
  const shown = await A.J(() => [...document.querySelectorAll('.set-list .uw-ans')].map(x => x.textContent).join(' | '));
  ok(key ? shown.includes(want) : !shown, key ? 'the answer shows under its remark (private build)' : 'a public build shows no answers', shown.slice(0, 80));
  await A.page.goto(SRV.base + '/_jk62_test.html#agenci'); await A.wait(900);
  const ag = await A.J(() => document.querySelector('.agents-jk')?.textContent || '');
  ok(/poprawione/.test(ag) && /Bez odpowiedzi/.test(ag) && (!key || /Odpowiedź \(v6\.2/.test(ag)), '"Dla agentów" shows every remark and whether it has an answer');
  await A.shot('03-agents-remarks');
  await ctx.close();
}

/* ---------- 3. models: the Blockbench look, sharp pixels, only his ---------- */
// a Blockbench-style .obj: one quad, a 16 px picture with a transparent half (made in the page, nobody's model)
const makeQuad = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const g = cv.getContext('2d'); g.fillStyle = '#d33'; g.fillRect(0, 0, 8, 16); g.fillStyle = '#3d3'; g.fillRect(8, 0, 8, 8); // the rest stays transparent
  return new Promise(res => cv.toBlob(png => res([
    { name: 'kafel.obj', blob: new Blob(['# Made in Blockbench 5.1.4\nmtllib materials.mtl\n\no kafel\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nvn 0 0 1\nusemtl m_kafel\nf 1/1/1 2/2/1 3/3/1 4/4/1\n']), rel: 'kafle/kafel.obj' },
    { name: 'materials.mtl', blob: new Blob(['# Made in Blockbench 5.1.4\nnewmtl m_kafel\nmap_Kd kafel.png\nnewmtl none']), rel: 'kafle/materials.mtl' },
    { name: 'kafel.png', blob: png, rel: 'kafle/kafel.png' }]), 'image/png'));
};
const looks = () => Jaskinia.materialy.list().then(async l => {
  const m = l.find(x => x.name === 'kafel'); if (!m) return null;
  const o = await Jaskinia.materialy.object(m.id), out = [];
  o.traverse(x => { if (x.isMesh) for (const mm of [].concat(x.material)) out.push({ type: mm.type, alphaTest: mm.alphaTest, side: mm.side, rough: mm.roughness, mag: mm.map?.magFilter, min: mm.map?.minFilter, w: mm.map?.image?.width || 0 }); });
  return out;
});
if (!ONLY || ONLY === 'models') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  const offer = await J(() => [...document.querySelectorAll('.mt-rchip')].map(b => b.querySelector('span')?.textContent));
  ok(offer.length >= 6 && !offer.some(n => /^(Dom|Schody|Mapa testowa)$/.test(n)), 'the offer has only his own models: no Box3D house, stairs or test map', JSON.stringify(offer));
  await J(`(${makeQuad})().then(f => __JASK.matImport(f, 'folder'))`);
  await wait(400);
  let L = await J(`(${looks})()`);
  ok(L && L.length === 1 && L[0].type === 'MeshStandardMaterial' && Math.abs(L[0].alphaTest - 0.05) < 1e-6 && L[0].side === 2 && L[0].rough === 1, 'a Blockbench .obj gets the Blockbench look: matte, cut-out alpha (0.05), both sides', JSON.stringify(L));
  ok(L && L[0].mag === 1003 && L[0].min === 1003 && L[0].w === 16, 'its pixels are sharp by default (nearest, as Blockbench draws them)', JSON.stringify(L && L[0]));
  await J(() => document.querySelector('.mt-tile[title="kafel"], .mt-grid [title="kafel"]')?.click()); await wait(900);
  ok(await J(() => window.__jkStage?.canvas.style.imageRendering === 'pixelated'), 'the stage enlarges its picture block by block, never blurred');
  ok(await J(() => document.querySelector('.mt-px')?.getAttribute('aria-pressed') === 'true'), 'the stage has a "Ostre piksele" switch, on');
  await page.locator('.mt-px').click(); await wait(300);
  const stageMag = await J(() => { let f = null; window.__jkStage.root.traverse(x => { if (x.isMesh && x.material.map) f = x.material.map.magFilter; }); return f; });
  ok(await J(() => __JASK.prefs.pixels === 'gladkie') && stageMag === 1006 && await J(() => window.__jkStage.canvas.style.imageRendering === ''), 'the switch smooths the model on the stage at once', String(stageMag));
  L = await J(`(${looks})()`);
  ok(L && L[0].mag === 1006, 'and every model given out afterwards is smooth too (one choice for all)', JSON.stringify(L && L[0]));
  await J(() => __JASK.openSettings('wyglad')); await wait(400);
  ok(await J(() => [...document.querySelectorAll('.set-pane')].some(p => /Piksele tekstur/.test(p.textContent))), 'Ustawienia → Wygląd has the same choice');
  await J(() => __JASK.setPref('pixels', 'ostre')); await wait(200);
  ok(await J(() => document.querySelector('.mt-px')?.getAttribute('aria-pressed') === 'true'), 'the switch on the stage follows the setting');
  // a model brought by v6 from Box3D's own meshes leaves the library once, out loud, with Cofnij
  await J(() => __JASK.matImport([{ name: 'stairs.obj', blob: new Blob(['o s\nv 0 0 0\nv 1 0 0\nv 1 1 0\nf 1 2 3\n']) }], 'repo:Jozzpoly/Box3d_FunProject/data/meshes/stairs.obj', 'Schody'));
  await J(() => { for (const w of document.querySelectorAll('.win')) if (w.dataset.type === 'materialy') w.querySelector('.b-x')?.click(); });
  await wait(300);
  await J(() => Jaskinia.ext.open('materialy')); await wait(900);
  const toast = await J(() => [...document.querySelectorAll('.jk-toast')].map(x => x.textContent).join(' | '));
  const gone = await J(() => Jaskinia.materialy.list().then(l => !l.some(m => m.name === 'Schody')));
  ok(/nie są Twoje/.test(toast) && gone, 'a model that was never his leaves the library once, and says so', toast.slice(0, 120));
  await page.locator('.jk-toast', { hasText: 'nie są Twoje' }).locator('.jk-toast-b').click().catch(() => {});
  await wait(500);
  ok(await J(() => Jaskinia.materialy.list().then(l => l.some(m => m.name === 'Schody' && m.keep))), 'Cofnij brings it back and it stays');
  // his real Blockbench exports, when they are at hand (private, never in the repository)
  if (fs.existsSync(BB)) {
    const files = [];
    const walk = (d, rel) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), r = rel ? rel + '/' + f : f; if (fs.statSync(p).isDirectory()) walk(p, r); else if (/\.(obj|mtl|png)$/i.test(f)) files.push({ name: f, rel: 'export/' + r, b64: fs.readFileSync(p).toString('base64') }); } };
    walk(BB, '');
    const res = await J(fl => __JASK.matImport(fl.map(f => ({ name: f.name, rel: f.rel, blob: new Blob([Uint8Array.from(atob(f.b64), c => c.charCodeAt(0))]) })), 'folder'), files);
    const done = res.done.filter(x => !x.error);
    const real = await J(ids => Promise.all(ids.map(async id => { const o = await Jaskinia.materialy.object(id), ms = []; o.traverse(x => { if (x.isMesh) for (const mm of [].concat(x.material)) ms.push(mm); }); const m = await Jaskinia.materialy.get(id); return { id, missing: m.missing || [], n: ms.length, ok: ms.every(mm => mm.type === 'MeshStandardMaterial' && mm.alphaTest > 0 && mm.map && mm.map.image?.width > 0 && mm.map.magFilter === 1003) }; })), done.map(x => x.id));
    ok(done.length >= 5 && !res.done.some(x => x.error) && real.every(r => r.ok && !r.missing.length), 'his Blockbench .obj folder: every model with its own pictures, all with the Blockbench look', JSON.stringify(real.map(r => [r.n, r.ok, r.missing.length])));
    for (const [i, r] of real.slice(0, 3).entries()) { await J(id => { location.hash = '#m~' + id; }, r.id); await wait(1400); await shot('10-own-' + i); }
  } else console.log('   (no Blockbench export folder here: the check on real files is skipped)');
  await ctx.close();
}

/* ---------- 4. controls in 3D ---------- */
if (!ONLY || ONLY === 'controls') {
  const ctx = await context();
  const { page, J, wait } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await J(`(${makeQuad})().then(f => __JASK.matImport(f, 'folder'))`);
  await wait(400);
  await J(() => document.querySelector('.mt-grid [title="kafel"]')?.click()); await wait(1200);
  const mb = await J(() => { const c = window.__jkStage?.controls; return c ? { ...c.mouseButtons, zc: c.zoomToCursor } : null; });
  ok(mb && mb.LEFT === 0 && mb.MIDDLE === 2 && mb.RIGHT === 2 && mb.zc, 'the wheel button moves the view (pan), turning the wheel zooms to the cursor', JSON.stringify(mb));
  const before = await J(() => { const s = window.__jkStage; return { t: s.controls.target.toArray(), d: s.camera.position.distanceTo(s.controls.target) }; });
  const cc = await center(page, '.sw-cv');
  await page.mouse.move(cc.x, cc.y); await page.mouse.down({ button: 'middle' }); await page.mouse.move(cc.x + 80, cc.y + 30, { steps: 6 }); await page.mouse.up({ button: 'middle' });
  await wait(400);
  const after = await J(() => { const s = window.__jkStage; return { t: s.controls.target.toArray(), d: s.camera.position.distanceTo(s.controls.target) }; });
  const moved = Math.hypot(...after.t.map((v, i) => v - before.t[i]));
  ok(moved > 0.01 && Math.abs(after.d - before.d) / before.d < 0.05, 'dragging with the wheel button moves the view and does not zoom', JSON.stringify({ moved: +moved.toFixed(3), d: [+before.d.toFixed(2), +after.d.toFixed(2)] }));
  await page.locator('.mt-go').click(); await wait(500);
  ok(await J(() => !!document.querySelector('.sw-hud .sw-full')), 'walking on a desk offers fullscreen that keeps the keyboard (Ctrl+W cannot close the tab)');
  await page.mouse.click(cc.x, cc.y); await wait(200);
  await page.keyboard.press('KeyF'); await wait(100);
  const fl = await J(() => { const w = window.__jkWalk; if (!w) return null; const y0 = w.pos.y; w.simulate(0.5, ['Space']); const y1 = w.pos.y; w.simulate(0.5, ['ShiftLeft']); const y2 = w.pos.y; return { fly: w.fly, up: +(y1 - y0).toFixed(2), down: +(y2 - y1).toFixed(2) }; });
  ok(fl && fl.fly && fl.up > 0.5 && fl.down < -0.5, 'flying: Space goes up, Shift goes down (as in Minecraft)', JSON.stringify(fl));
  await page.mouse.move(cc.x, cc.y); await page.mouse.wheel(0, -120); await wait(150);
  ok(/×1,25/.test(await J(() => document.querySelector('.sw-hud')?.textContent || '')), 'the wheel sets the speed (×1,25 after one notch)');
  await page.keyboard.down('Space'); await page.keyboard.down('Control'); await page.keyboard.up('Space'); await page.keyboard.up('Control'); await wait(100);
  ok(await J(() => !window.__jkWalk.keys.has('Space') && window.__jkWalk.keys.size === 0), 'a key let go while Ctrl is held does not stay pressed');
  await ctx.close();
}

/* ---------- 5. the quiet, compact chrome ---------- */
if (!ONLY || ONLY === 'chrome') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  ok(await J(() => document.documentElement.dataset.density === 'zwarta'), 'with a mouse the interface is compact by itself');
  const q = await J(() => { const b = document.querySelector('.win .wtools > :not(.b-more)'); return b ? getComputedStyle(b).opacity : null; });
  ok(q === '0', 'window tools stay quiet until the header is pointed at', String(q));
  const hb = await center(page, '.win .whead');
  await page.mouse.move(hb.x, hb.y);
  // polled, not a fixed pause: right after start the first drawing of 31 repositories can hold the page for a moment
  // (a fixed 350 ms failed once under load, 19 Oct)
  const shown = async () => (await J(() => getComputedStyle(document.querySelector('.win .wtools > :not(.b-more)')).opacity)) === '1';
  for (let i = 0; i < 20 && !(await shown()); i++) await wait(150);
  ok(await shown(), 'pointing at the header shows them');
  await shot('20-chrome');
  await ctx.close();
}

ok(!errs.length, 'no errors in the console', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); SRV.close?.();
process.exit(fail ? 1 : 0);
