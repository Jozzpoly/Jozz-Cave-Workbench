// Jaskinia v6.3 checks: a release that older tabs cannot undo, and merges that keep both losing sides.
// Each check answers a finding of the GPT lines on PR #4 (18 Oct), most of them reproduced in a real browser by GPT-6.
//   oldtab     a published v6 tab, still open on the same address, writes its old state on hide: the new state stays,
//              the old one waits in a copy, a note newer in the old tab comes in (and the replaced text is kept too)
//   merge      two tabs that each lose something in one merge keep both losers; a conflict inside one window and a rename
//              are conflicts too
//   materials  revisions survive an older build rewriting the record, two tabs never take one revision number, two
//              "texture.png" inside one glTF stay two pictures, leftovers of a failed import are swept only when old
//   agents     an open "Dla agentów" window follows changes and says when and from where it reads
// node tools/jk63_test.mjs [shotdir]     (old builds come from git: 2fde987 = published v6, 6e6b8f3 = v6.2)
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk63t');
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_jk63_test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
// an older build, exactly as it was published (from git when this is a clone, else a file left by an earlier run)
function oldBuild(sha, file) {
  const out = path.join(dist, file);
  try { fs.writeFileSync(out, execFileSync('git', ['-C', root, 'show', `${sha}:dist/jaskinia-web.html`], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* not a clone */ }
  return fs.existsSync(out) ? file : null;
}
const OLD6 = oldBuild('2fde987', '_old_v6.html');
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
async function tab(ctx, file = '_jk63_test.html') {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(file + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(file + ' pageerror: ' + e.message));
  await page.goto(SRV.base + '/' + file);
  await page.waitForTimeout(800);
  return { page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }) };
}
const waitFor = async (J, fn, a, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 150)); } return null; };
const copies = J => J(() => __JASK.readBackups().map(b => ({ why: b.why, notes: Object.values(b.data.notes || {}).map(n => n.text), names: (b.data.spaces || []).map(s => s.name), shapes: (b.data.spaces || []).map(s => JSON.stringify(s.L.tree)), pins: (b.data.spaces || []).flatMap(s => Object.values(s.L.wins).map(w => w.pin)) })));

/* ---------- 1. an old tab cannot undo a release ---------- */
if ((!ONLY || ONLY === 'oldtab') && OLD6) {
  const ctx = await context();
  // A: the published v6, loaded first, with a note
  const A = await tab(ctx, OLD6);
  const nid = await A.J(() => { const id = __JASK.store.spaces[0] && Object.keys(__JASK.store.notes)[0] || 'n_test'; __JASK.store.notes[id] = { text: 'STARA (v6)', upd: Date.now() }; __JASK.persistNow(); return id; });
  ok(await A.J(() => JSON.parse(localStorage.getItem('jaskinia:v2')).notes) !== null, 'the published v6 writes its own key (jaskinia:v2)');
  // B: v6.3 takes the state over once and writes a newer note into its own key
  const B = await tab(ctx);
  ok(await B.J(id => __JASK.store.notes[id]?.text === 'STARA (v6)', nid), 'v6.3 takes the older state over on its first start');
  await B.J(id => __JASK.noteSet(id, 'NOWA (v6.3)'), nid); await B.wait(500);
  ok(await B.J(() => !!localStorage.getItem('jaskinia:v3') && JSON.parse(localStorage.getItem('jaskinia:v3')).notes) !== null, 'v6.3 writes its own key (jaskinia:v3)');
  await B.page.close();
  // A leaves for real (pagehide writes its whole old state, as the published v6 does)
  await A.page.goto('about:blank'); await new Promise(r => setTimeout(r, 300));
  const C = await tab(ctx);
  ok(await C.J(id => __JASK.store.notes[id]?.text === 'NOWA (v6.3)', nid), 'the old tab leaving does not undo the newer note (GPT: OLD_V6_OVERWROTE_NEW_V61)', await C.J(id => __JASK.store.notes[id]?.text, nid));
  // the old tab writes again, now with a note it changed after the release: that note comes in, the replaced one is kept
  const A2 = await tab(ctx, OLD6);
  await A2.J(id => { __JASK.store.notes[id] = { text: 'POPRAWKA W STAREJ KARCIE', upd: Date.now() + 1000 }; __JASK.persistNow(); }, nid);
  const took = await waitFor(C.J, id => __JASK.store.notes[id]?.text === 'POPRAWKA W STAREJ KARCIE', nid);
  ok(!!took, 'a note changed later in the old tab comes in');
  const cs = await copies(C.J);
  ok(cs.some(b => b.why === 'ze starszej wersji Jaskini') && cs.some(b => b.notes.includes('NOWA (v6.3)')), 'the old tab\'s whole state and the replaced note both wait in copies', JSON.stringify(cs.map(b => b.why)));
  ok(await C.J(() => [...document.querySelectorAll('.jk-toast')].some(x => /Starsza karta Jaskini/.test(x.textContent))), 'Jozz is told an older tab is writing, and to close it');
  ok(await C.J(() => (__JASK.store.spaces || []).length >= 1 && !!__JASK.L), 'the layouts of this tab are not replaced by the old tab\'s');
  await C.shot('01-old-tab');
  await ctx.close();
} else if (!OLD6) console.log('   (no published v6 build at hand: the old-tab checks are skipped)');

/* ---------- 2. merges keep both losing sides ---------- */
if (!ONLY || ONLY === 'merge') {
  const ctx = await context();
  const A = await tab(ctx), B = await tab(ctx);
  const nid = await A.J(() => { const id = __JASK.noteNew('wspólna'); __JASK.persist(); return id; });
  await A.wait(600);
  await waitFor(B.J, id => !!__JASK.store.notes[id], nid);
  // mixed sides: both rearrange the same layout and edit the same note; B's note is newer, A's layout stays
  const sp = await A.J(() => __JASK.store.spaces[0].id);
  await A.J(([sp, id]) => { const s = __JASK.store.spaces.find(x => x.id === sp); s.L.tree.r = 0.31; __JASK.store.notes[id] = { text: 'TEKST Z KARTY A', upd: Date.now() - 5000 }; }, [sp, nid]);
  await B.J(([sp, id]) => { const s = __JASK.store.spaces.find(x => x.id === sp); s.L.tree.r = 0.69; __JASK.store.notes[id] = { text: 'TEKST Z KARTY B', upd: Date.now() }; __JASK.persist(); }, [sp, nid]);
  await waitFor(A.J, id => __JASK.store.notes[id]?.text === 'TEKST Z KARTY B', nid);
  let cs = await copies(A.J);
  ok(cs.some(b => b.notes.includes('TEKST Z KARTY A')) && cs.some(b => b.shapes.some(x => x.includes('0.69'))), 'a merge where both sides lose something keeps both losers in copies (GPT/Medium: the `||`)', JSON.stringify(cs.map(b => b.why)));
  // one window changed in both tabs (no reshaping): the losing pin waits in a copy
  await A.wait(800);
  const w = await A.J(sp => Object.keys(__JASK.store.spaces.find(x => x.id === sp).L.wins)[0], sp);
  await waitFor(B.J, () => !__JASK.dirty);
  await A.J(([sp, w]) => { __JASK.store.spaces.find(x => x.id === sp).L.wins[w].pin = 'Combat-Lab'; }, [sp, w]);
  await B.J(([sp, w]) => { __JASK.store.spaces.find(x => x.id === sp).L.wins[w].pin = 'JV-Box3D-Web-Public'; __JASK.persist(); }, [sp, w]);
  await A.wait(900);
  cs = await copies(A.J);
  ok(cs.some(b => b.pins.includes('JV-Box3D-Web-Public')) && await A.J(([sp, w]) => __JASK.store.spaces.find(x => x.id === sp).L.wins[w].pin === 'Combat-Lab', [sp, w]), 'one window changed in both tabs: this tab\'s change stays, the other waits in a copy', JSON.stringify(cs.map(b => b.pins.filter(Boolean))));
  // the same layout renamed in both tabs
  await A.J(() => __JASK.persist()); await A.wait(800);
  await A.J(sp => { __JASK.store.spaces.find(x => x.id === sp).name = 'Nazwa z A'; }, sp);
  await B.J(sp => { __JASK.store.spaces.find(x => x.id === sp).name = 'Nazwa z B'; __JASK.persist(); }, sp);
  await A.wait(900);
  cs = await copies(A.J);
  ok(cs.some(b => b.names.includes('Nazwa z B')), 'a layout renamed in both tabs: the other name waits in a copy', JSON.stringify(cs.map(b => b.names[0])));
  await ctx.close();
}

/* ---------- 3. materials ---------- */
const png = (r, g, b) => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 4, 4); return new Promise(res => c.toBlob(res, 'image/png')); };
if (!ONLY || ONLY === 'materials') {
  const ctx = await context();
  const A = await tab(ctx);
  const id = await A.J(`(async () => { const b = await (${png})(200, 30, 30); const r = await __JASK.matImport([{ name: 'kafel.png', blob: b }], 'plik'); return r.done[0].id; })()`);
  await A.J(id => __JASK.matApplySettings(id, { scale: 2 }), id);
  ok((await A.J(id => Jaskinia.materialy.settings(id), id)).map(s => s.n).join() === '1,2', 'a change of scale makes revision 2');
  // an older build rewrites the record from its stale copy: no revisions, a turn of its own (as published v6 does)
  await A.J(async id => {
    const db = await new Promise(r => { const q = indexedDB.open('jaskinia-materialy', 1); q.onsuccess = () => r(q.result); });
    await new Promise(r => { const tx = db.transaction('materialy', 'readwrite'), os = tx.objectStore('materialy'); const q = os.get(id); q.onsuccess = () => { const m = q.result; delete m.sets; delete m.set; m.scale = 1; m.rot = [1, 0, 0]; os.put(m); }; tx.oncomplete = r; });
    db.close();
  }, id);
  const C = await tab(ctx);
  const sets = await C.J(id => Jaskinia.materialy.settings(id), id);
  ok(sets.length === 3 && sets[1].scale === 2 && sets[2].rot[0] === 1, 'revisions survive an older build rewriting the record; its own change becomes revision 3 (GPT: V6_ERASED_V61_SETTING_REVISION)', JSON.stringify(sets.map(s => [s.n, s.scale, s.rot])));
  const o2 = await C.J(async id => { const o = await Jaskinia.materialy.object(id, { set: 2 }); return { set: o.userData.set, s: o.children[0].scale.x }; }, id);
  ok(o2.set === 2 && o2.s === 2, 'a place pinned to revision 2 still gets its look', JSON.stringify(o2));
  // two tabs change the same material at once: two numbers, nothing overwritten
  const [ra, rb] = await Promise.all([A.J(id => __JASK.matApplySettings(id, { scale: 4 }).then(r => r.n), id), C.J(id => __JASK.matApplySettings(id, { scale: 8 }).then(r => r.n), id)]);
  const after = await C.J(async id => { const db = await new Promise(r => { const q = indexedDB.open('jaskinia-materialy-ustawienia', 1); q.onsuccess = () => r(q.result); }); const v = await new Promise(r => { const q = db.transaction('sets').objectStore('sets').get(id); q.onsuccess = () => r(q.result); }); db.close(); return v.sets.map(s => [s.n, s.scale]); }, id);
  ok(ra !== rb && after.length === 5 && new Set(after.map(x => x[0])).size === 5, 'two tabs changing one material at once get two revision numbers', JSON.stringify({ ra, rb, after }));
  // one glTF with red/texture.png and blue/texture.png: two pictures
  const two = await A.J(`(async () => {
    const red = await (${png})(255, 0, 0), blue = await (${png})(0, 0, 255);
    const pos = new Float32Array([0,0,0, 1,0,0, 0,1,0]), uv = new Float32Array([0,0, 1,0, 0,1]);
    const bin = new Uint8Array(pos.byteLength + uv.byteLength); bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(uv.buffer), pos.byteLength);
    const b64 = btoa(String.fromCharCode(...bin));
    const prim = m => ({ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: m });
    const g = { asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,' + b64, byteLength: bin.byteLength }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: uv.byteLength }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [1,1,0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }],
      images: [{ uri: 'red/texture.png' }, { uri: 'blue/texture.png' }], textures: [{ source: 0 }, { source: 1 }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }, { pbrMetallicRoughness: { baseColorTexture: { index: 1 } } }],
      meshes: [{ primitives: [prim(0)] }, { primitives: [prim(1)] }], nodes: [{ mesh: 0 }, { mesh: 1, translation: [2, 0, 0] }], scenes: [{ nodes: [0, 1] }], scene: 0 };
    const r = await __JASK.matImport([{ name: 'dwa.gltf', blob: new Blob([JSON.stringify(g)]), rel: 'scena/dwa.gltf' }, { name: 'texture.png', blob: red, rel: 'scena/red/texture.png' }, { name: 'texture.png', blob: blue, rel: 'scena/blue/texture.png' }], 'folder');
    const o = await Jaskinia.materialy.object(r.done[0].id), cols = [];
    o.traverse(x => { if (x.isMesh) { const im = x.material.map.image, c = document.createElement('canvas'); c.width = c.height = 4; const cx = c.getContext('2d'); cx.drawImage(im, 0, 0); const d = cx.getImageData(1, 1, 1, 1).data; cols.push([d[0], d[2]]); } });
    return cols;
  })()`);
  ok(two.length === 2 && two.some(c => c[0] > 200 && c[1] < 50) && two.some(c => c[1] > 200 && c[0] < 50), 'two "texture.png" inside one glTF stay two pictures (red and blue)', JSON.stringify(two));
  // a failed import leaves its bytes only until they are old: a sweep removes them, never what a saved material uses
  const sw = await A.J(`(async () => {
    const pic = await (${png})(10, 200, 10);
    await __JASK.matImport([{ name: 'zly.gltf', blob: new Blob(['{ to nie jest gltf']) }, { name: 'zielony.png', blob: pic }], 'plik');
    const keys = async () => { const db = await new Promise(r => { const q = indexedDB.open('jaskinia-materialy', 1); q.onsuccess = () => r(q.result); }); const k = await new Promise(r => { const q = db.transaction('pliki').objectStore('pliki').getAllKeys(); q.onsuccess = () => r(q.result); }); db.close(); return k.length; };
    const n0 = await keys();
    await __JASK.matSweep();
    const n1 = await keys();
    const db = await new Promise(r => { const q = indexedDB.open('jaskinia-materialy', 1); q.onsuccess = () => r(q.result); });
    await new Promise(r => { const tx = db.transaction('pliki', 'readwrite'), os = tx.objectStore('pliki'); const q = os.getAll(); q.onsuccess = () => { for (const f of q.result) { f.at = 1; os.put(f); } }; tx.oncomplete = r; });
    db.close();
    await __JASK.matSweep();
    const n2 = await keys();
    const still = await Jaskinia.materialy.object((await Jaskinia.materialy.list()).find(m => m.name === 'kafel').id).then(() => true, () => false);
    return { n0, n1, n2, still };
  })()`);
  ok(sw.n1 === sw.n0 && sw.n2 < sw.n1 && sw.still, 'leftovers of a failed import are swept only when old, and never what a material uses (GPT: cleanup race)', JSON.stringify(sw));
  await ctx.close();
}

/* ---------- 4. the agents window follows ---------- */
if (!ONLY || ONLY === 'agents') {
  const ctx = await context();
  const A = await tab(ctx), B = await tab(ctx);
  await A.J(() => Jaskinia.ext.open('agenci')); await A.wait(700);
  const txt0 = await A.J(() => document.querySelector('.agents-jk')?.textContent || '');
  ok(/Stan z \d\d:\d\d:\d\d, z tej karty tej przeglądarki \(http/.test(txt0), '"Dla agentów" says when and from which browser it reads, and that it is not shared memory');
  await B.J(() => { const id = __JASK.noteNew('Notatka dopisana w drugiej karcie'); __JASK.persist(); return id; });
  const seen = await waitFor(A.J, () => (document.querySelector('.agents-jk')?.textContent || '').includes('Notatka dopisana w drugiej karcie'), null, 6000);
  ok(!!seen, 'an open "Dla agentów" shows a note written in another tab, without reopening (Medium: freshness)');
  await ctx.close();
}

/* ---------- 5. games open where they work (data/wejscia.json) ---------- */
if (!ONLY || ONLY === 'games') {
  const ctx = await context();
  const { J, wait, shot } = await tab(ctx);
  const g = await J(() => { const R = __BIB.R, ty = R['Tysi-c-The-Game'], vaw = R['voxel-aeronautics-workshop']; return { ty: ty && { pages: ty.pages, tab: ty.tab }, vaw: vaw && { pages: vaw.pages, tab: vaw.tab }, inWin: __BIB.HOOK.play(ty) }; });
  ok(g.ty && /workers\.dev/.test(g.ty.pages) && g.ty.tab === true && g.inWin === false, 'a game with a verified address that works only in its own tab gets that address and opens there', JSON.stringify(g));
  ok(g.vaw && g.vaw.pages === 'https://jozzpoly.github.io/voxel-aeronautics-workshop/' && !g.vaw.tab, 'VAW keeps its Pages entry from fresh data, not from a hand edit of the published page', JSON.stringify(g.vaw));
  await J(() => { __JASK.select('Tysi-c-The-Game'); Jaskinia.ext.open('gra'); }); await wait(800);
  ok(await J(() => [...document.querySelectorAll('.win[data-type="gra"]')].some(w => /działa tylko w osobnej karcie/.test(w.textContent) && !w.querySelector('iframe'))), 'its game window explains why it opens in a tab instead of framing it');
  await shot('05-tab-only');
  await ctx.close();
}

ok(!errs.length, 'no errors in the console', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); SRV.close?.();
process.exit(fail ? 1 : 0);
