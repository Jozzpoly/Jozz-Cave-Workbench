// Jaskinia v6.1 checks: the foundation under everything else.
//   tabs       several tabs of one Jaskinia merge instead of overwriting each other (the 18 Oct audit: an older tab,
//              closed last, wrote its old layouts and notes over the newer ones)
//   addresses  #repo~, #m~, #uklad~ and window names work from outside, from links inside windows and follow the selection
//   agents     the "Dla agentów" window shows the state, Jozz's notes and the materials as plain text
//   materials  a folder with two "texture.png" in two subfolders gives each model its own; settings get revisions
// node tools/jk61_test.mjs [shotdir]    (served over http, WebGL through SwiftShader)
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk61t');
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_jk61_test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
const SRV = await serve(dist);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
const ONLY = process.env.ONLY || '';
async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(() => { window.__JASK_PLACE = 'web'; try { localStorage.setItem('jaskinia:hint', '1'); localStorage.setItem('jaskinia:v6', '1'); } catch { /* fine */ } });
  return ctx;
}
async function tab(ctx, hash = '') {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(SRV.base + '/_jk61_test.html' + hash);
  await page.waitForTimeout(700);
  return { page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }) };
}
const waitFor = async (J, fn, a, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 120)); } return null; };
const stored = J => J(() => JSON.parse(localStorage.getItem('jaskinia:v3') || 'null'));

/* ---------- 1. several tabs ---------- */
if (!ONLY || ONLY === 'tabs') {
  const ctx = await context();
  const A = await tab(ctx), B = await tab(ctx);
  // B opens a notes window and writes in it: A takes in both, without reloading
  const nw = await B.J(() => Jaskinia.ext.open('notatki'));
  await B.wait(500);
  const noteId = await B.J(id => __JASK.L.wins[id].st.note, nw);
  await B.J(id => __JASK.noteSet(id, 'Notatka z karty B'), noteId);
  const seen = await waitFor(A.J, id => __JASK.store.notes[id]?.text === 'Notatka z karty B' && !!__JASK.L.wins[Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].st?.note === id)], noteId);
  ok(!!seen, 'tab A takes in the window and the note written in tab B');
  const shown = await waitFor(A.J, () => [...document.querySelectorAll('.win:not([hidden]) textarea')].some(x => x.value === 'Notatka z karty B'));
  ok(!!shown, 'the note shows in tab A without a reload');
  // an older copy in memory never goes over a newer one: A holds a changed name it never wrote, then hides and closes
  await A.J(() => { __JASK.store.spaces[0].name = 'STARA KOPIA'; });
  await A.J(() => { document.dispatchEvent(new Event('visibilitychange')); __JASK.persistNow(); });
  const s1 = await stored(B.J);
  ok(s1 && !s1.spaces.some(s => s.name === 'STARA KOPIA') && s1.notes[noteId]?.text === 'Notatka z karty B', 'a tab with nothing new writes nothing (no old copy over a newer one)');
  // both tabs change different things at once: both changes stay, in both tabs
  await A.J(() => { __JASK.store.spaces[0].name = 'Przegląd'; });
  const spB = await B.J(() => __JASK.store.spaces.find(s => s.id === 'granie') ? 'granie' : __JASK.store.spaces[1].id);
  await A.J(sp => { __JASK.store.spaces.find(s => s.id === sp).name = 'Granie A'; __JASK.persist(); }, spB); // as renameSpace() does
  await B.J(() => Jaskinia.ext.open('wiedza'));
  await A.wait(1200);
  const conv = async J => J(() => ({ names: __JASK.store.spaces.map(s => s.name).join(','), wiedza: __JASK.store.spaces.some(s => Object.values(s.L.wins).some(w => w.type === 'wiedza')) }));
  const ca = await conv(A.J), cb = await conv(B.J);
  ok(ca.names === cb.names && ca.names.includes('Granie A') && ca.wiedza && cb.wiedza, 'changes made at once in two tabs both stay, in both tabs', JSON.stringify([ca, cb]));
  // the same note changed in both tabs before they heard of each other: the newer text stays, the other waits in a copy
  await A.J(id => __JASK.noteSet(id, 'Tekst z A'), noteId);
  await B.wait(30);
  await B.J(id => { __JASK.noteSet(id, 'Tekst z B (nowszy)'); __JASK.persistNow(); }, noteId);
  await A.wait(1200);
  const na = await A.J(id => __JASK.store.notes[id].text, noteId), nb = await B.J(id => __JASK.store.notes[id].text, noteId);
  ok(na === 'Tekst z B (nowszy)' && nb === na, 'the same note in two tabs: the newer text wins in both', JSON.stringify([na, nb]));
  const kept = await B.J(() => JSON.parse(localStorage.getItem('jaskinia:kopie') || '[]').some(b => JSON.stringify(b.data.notes || {}).includes('Tekst z A')));
  ok(kept, 'the text that lost waits in an automatic copy');
  const toast = await A.J(() => [...document.querySelectorAll('.jk-toast, .toast, [role=status]')].map(x => x.textContent).join(' | '));
  ok(/dwóch kartach/.test(toast), 'tab A says so once', toast.slice(0, 160));
  // both tabs rearrange the same layout in the same moment: one shape stays in both, the other waits in a copy, nothing breaks
  const nb0 = await B.J(() => JSON.parse(localStorage.getItem('jaskinia:kopie') || '[]').length);
  await Promise.all([A.J(() => Jaskinia.ext.open('rytm')), B.J(() => Jaskinia.ext.open('zegar'))]);
  await A.wait(1500);
  const shapeOf = J => J(() => JSON.stringify([__JASK.L.tree, __JASK.L.floats.map(f => f.id).sort(), Object.keys(__JASK.L.wins).sort()]));
  const sa = await shapeOf(A.J), sb = await shapeOf(B.J);
  const valid = await A.J(() => { const ids = new Set([...__JASK.leafIds(__JASK.L.tree), ...__JASK.L.floats.map(f => f.id)]); return [...ids].every(id => __JASK.L.wins[id]) && Object.keys(__JASK.L.wins).every(id => ids.has(id)); });
  ok(sa === sb && valid, 'the same layout rearranged in two tabs at once: one valid shape in both', String(valid));
  const nb1 = await B.J(() => JSON.parse(localStorage.getItem('jaskinia:kopie') || '[]').length);
  ok(nb1 > nb0, 'the other shape waits in an automatic copy', `${nb0} → ${nb1}`);
  // another page at this address wipes the storage: the open tab writes Jaskinia back
  await B.J(() => localStorage.clear());
  const back = await waitFor(B.J, () => !!localStorage.getItem('jaskinia:v3'));
  ok(!!back && (await stored(B.J)).notes[noteId]?.text === 'Tekst z B (nowszy)', 'a wiped storage is written back by the open tab');
  await A.page.close(); await B.page.close();
  // a reload after all this shows the same state
  const C = await tab(ctx);
  ok((await C.J(id => __JASK.store.notes[id]?.text, noteId)) === 'Tekst z B (nowszy)' && (await C.J(() => __JASK.store.spaces.some(s => s.name === 'Granie A'))), 'a new tab opens on the merged state');
  await ctx.close();
}

/* ---------- 2. addresses and the agents window ---------- */
if (!ONLY || ONLY === 'addresses') {
  const ctx = await context();
  const P = await tab(ctx, '#repo~Combat-Lab');
  await P.wait(400);
  ok((await P.J(() => __JASK.store.sel)) === 'Combat-Lab', 'opened with #repo~Combat-Lab: that project is selected');
  ok(await P.J(() => Object.entries(__JASK.L.wins).some(([id, w]) => ['karta', 'gra', 'galezie', 'rytm', 'stan', 'dane'].includes(w.type) && !w.pin && !document.querySelector(`.win[data-id="${id}"]`)?.hidden)), 'a window that follows the selection is on screen');
  await P.J(() => __JASK.select('ReflexBrain-Lab'));
  ok((await P.J(() => location.hash)) === '#repo~ReflexBrain-Lab', 'the address follows the selection', await P.J(() => location.hash));
  // a link inside a window ("Pełna historia" in the Puls window) opens that window instead of doing nothing
  const link = P.page.locator('.win:not([hidden]) a[href="#historia"]').first();
  if (await link.count()) {
    await link.click();
    await P.wait(500);
    ok(await P.J(() => Object.values(__JASK.L.wins).some(w => w.type === 'historia')), 'a #historia link inside a window opens the Historia window');
  } else ok(false, 'the Puls window shows its "Pełna historia" link');
  await P.J(() => { location.hash = '#wiedza'; });
  ok(!!(await waitFor(P.J, () => Object.values(__JASK.L.wins).some(w => w.type === 'wiedza'))), 'a typed address (#wiedza) opens that window');
  await P.J(() => { location.hash = '#uklad~sciana'; });
  ok(!!(await waitFor(P.J, () => __JASK.store.cur === 'sciana')), '#uklad~sciana switches the layout');
  await P.J(() => { location.hash = '#repo~Nie-Ma-Takiego'; });
  ok(!!(await waitFor(P.J, () => /Nie znam projektu/.test(document.body.textContent))), 'an unknown project says so');
  // notes for agents: the agents window shows Jozz's notes as plain text
  await P.J(() => { const id = __JASK.noteNew(''); __JASK.noteSet(id, 'Dla agentów: sprawdźcie Combat Lab przed piątkiem'); });
  await P.J(() => { location.hash = '#agenci'; });
  const ag = await waitFor(P.J, () => { const w = [...document.querySelectorAll('.win:not([hidden])')].find(x => x.dataset.type === 'agenci'); return w && /Notatki Jozza/.test(w.textContent) && /sprawdźcie Combat Lab/.test(w.textContent) ? w.textContent.length : 0; });
  ok(!!ag, '#agenci opens the agents window with Jozz\'s notes', String(ag));
  ok(await P.J(() => /#repo~ReflexBrain-Lab|#repo~Combat-Lab/.test([...document.querySelectorAll('.win[data-type="agenci"]')].map(x => x.textContent).join(''))), 'the agents window names things by their addresses');
  await P.shot('agenci');
  await ctx.close();
}

/* ---------- 3. materials: folder paths, settings revisions, tabs ---------- */
if (!ONLY || ONLY === 'materials') {
  const ctx = await context();
  const A = await tab(ctx), B = await tab(ctx);
  const res = await A.J(async () => {
    const png = async col => { const c = new OffscreenCanvas(2, 2), g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 2, 2); return c.convertToBlob({ type: 'image/png' }); };
    const obj = 'mtllib model.mtl\no box\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl m\nf 1/1 2/2 3/3 4/4\n';
    const mtl = 'newmtl m\nmap_Kd texture.png\n';
    const red = await png('#d03030'), blue = await png('#3050d0');
    const sha = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('');
    const files = [
      { name: 'model.obj', rel: 'proba/dom/model.obj', blob: new Blob([obj]) }, { name: 'model.mtl', rel: 'proba/dom/model.mtl', blob: new Blob([mtl]) }, { name: 'texture.png', rel: 'proba/dom/texture.png', blob: red },
      { name: 'model.obj', rel: 'proba/wieza/model.obj', blob: new Blob([obj.replace('1 1 0', '1 2 0')]) }, { name: 'model.mtl', rel: 'proba/wieza/model.mtl', blob: new Blob([mtl]) }, { name: 'texture.png', rel: 'proba/wieza/texture.png', blob: blue },
    ];
    const r = await Jaskinia.materialy.import(files);
    const list = await Jaskinia.materialy.list();
    const get = n => list.find(m => m.name === n);
    const dom = get('dom · model'), wieza = get('wieza · model');
    const pngOf = m => (m?.deps || []).filter(d => /\.png$/.test(d.name)).map(d => d.sha);
    return { done: r.done.length, dom: dom && pngOf(dom), wieza: wieza && pngOf(wieza), red: await sha(red), blue: await sha(blue), ids: [dom?.id, wieza?.id] };
  });
  ok(res.dom && res.dom.length === 1 && res.dom[0] === res.red, 'dom/model.obj takes dom/texture.png (and only it)', JSON.stringify(res.dom));
  ok(res.wieza && res.wieza.length === 1 && res.wieza[0] === res.blue, 'wieza/model.obj takes wieza/texture.png (and only it)', JSON.stringify(res.wieza));
  // the other tab hears about the new materials
  const heard = await waitFor(B.J, async ids => { const l = await Jaskinia.materialy.list(); return ids.every(id => l.some(m => m.id === id)); }, res.ids);
  ok(!!heard, 'another tab sees the new materials without a reload');
  // a settings change makes a revision; the old look stays reachable
  const mid = res.ids[0];
  await A.J(id => { location.hash = '#m~' + id; }, mid);
  await waitFor(A.J, () => !!document.querySelector('.mt-go'), null, 30000);
  await A.page.locator('.mt-bar button', { hasText: 'Skala' }).first().click();
  await A.page.locator('.jk-menu .mi', { hasText: '×2' }).first().click();
  const sets = await waitFor(A.J, async id => { const s = await Jaskinia.materialy.settings(id); return s.length === 2 ? s : null; }, mid, 30000);
  ok(sets && sets[0].scale === 1 && sets[1].scale === 2 && sets[1].n === 2, 'changing the scale adds settings revision 2 and keeps revision 1', JSON.stringify(sets));
  const objs = await A.J(async id => {
    const o1 = await Jaskinia.materialy.object(id, { set: 1 }), o2 = await Jaskinia.materialy.object(id);
    return [o1.children[0].scale.x, o1.userData.set, o2.children[0].scale.x, o2.userData.set];
  }, mid);
  ok(objs[0] === 1 && objs[1] === 1 && objs[2] === 2 && objs[3] === 2, 'object(id, {set: 1}) gives the old look, object(id) the newest', JSON.stringify(objs));
  const bad = await A.J(async id => { try { await Jaskinia.materialy.object(id, { set: 9 }); return 'no error'; } catch (e) { return e.message; } }, mid);
  ok(/nie ma ustawień nr 9/.test(bad), 'asking for a settings revision that does not exist is an error, not a guess', bad);
  // a material address that does not exist says so
  await A.J(() => { location.hash = '#m~mNIEMA'; });
  ok(!!(await waitFor(A.J, () => /Nie ma w bibliotece materiału mNIEMA/.test(document.body.textContent))), 'an unknown material address says so');
  // a model that cannot be read leaves no bytes behind for good: since v6.3 they are swept once they are old enough that no
  // import running in another tab can still need them (jk63_test.mjs checks the sweep itself)
  const left = await A.J(async () => {
    const count = () => new Promise(res => { const rq = indexedDB.open('jaskinia-materialy', 1); rq.onsuccess = () => { const tx = rq.result.transaction('pliki'); const g = tx.objectStore('pliki').count(); g.onsuccess = () => res(g.result); }; });
    const before = await count();
    const r = await Jaskinia.materialy.import([{ name: 'zepsuty.glb', blob: new Blob(['to nie jest glb ' + Math.random()]) }]);
    await new Promise(res => { const rq = indexedDB.open('jaskinia-materialy', 1); rq.onsuccess = () => { const tx = rq.result.transaction('pliki', 'readwrite'), os = tx.objectStore('pliki'); const q = os.getAll(); q.onsuccess = () => { for (const f of q.result) if (f.at) { f.at = 1; os.put(f); } }; tx.oncomplete = res; }; });
    await __JASK.matSweep();
    return { before, after: await count(), err: r.done[0]?.error || '' };
  });
  ok(left.err && left.after === left.before, 'a model that could not be read leaves no bytes in the browser (once swept)', JSON.stringify(left));
  await A.shot('materialy');
  await ctx.close();
}

ok(errs.length === 0, 'no errors in the console', errs.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
SRV.close?.();
process.exit(fail ? 1 : 0);
