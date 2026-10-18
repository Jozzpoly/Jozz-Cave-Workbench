// Jaskinia v6 checks: Materiały (Jozz's own models in this browser), the shared 3D stage, Wejdź (walking at 1:1),
// the window.Jaskinia API for other tools, and "Zagraj" never taking over the game being played.
// node tools/jk6_test.mjs [shotdir] [modelsdir]   (served over http, WebGL through SwiftShader)
// modelsdir holds real models from the owner's public repositories (see MAT_REPO in 57-materialy.js), e.g.
//   Box3d___building.obj, Box3d___stairs.obj, Box3d___test_map01.obj, Box3d___Nadwozie.gltf, JV-Box__m6-owner-full-rig-r3.glb, voxel-__test_anim.gltf
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk6t');
const models = process.argv[3] || '/home/claude/models';
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_jk6_test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
const SRV = await serve(dist);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
const M = n => path.join(models, n);
const have = n => fs.existsSync(M(n));
async function open({ phone = false, size = { width: 1500, height: 900 }, place = 'web', scheme = 'dark' } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'], colorScheme: scheme } : { viewport: size, deviceScaleFactor: 1, colorScheme: scheme });
  await ctx.addInitScript(p => { window.__JASK_PLACE = p; try { if (!sessionStorage.getItem('h')) { localStorage.setItem('jaskinia:hint', '1'); sessionStorage.setItem('h', '1'); } } catch { /* fine */ } }, place);
  // the owner's repositories are served from the local copies (the test never depends on the network)
  await ctx.route('https://raw.githubusercontent.com/Jozzpoly/**', r => {
    const u = new URL(r.request().url()), name = u.pathname.split('/').pop(), repo = u.pathname.split('/')[2] || '';
    const local = fs.readdirSync(models).find(f => f.endsWith('__' + name) && repo.toLowerCase().startsWith(f.split('__')[0].toLowerCase().replace(/[-_]+$/, '')));
    if (!local) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, body: fs.readFileSync(M(local)), headers: { 'access-control-allow-origin': '*', 'content-type': 'application/octet-stream' } });
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(SRV.base + '/_jk6_test.html');
  await page.waitForTimeout(700);
  return { ctx, page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }) };
}
const waitFor = async (J, fn, a, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 150)); } return null; };
const matWin = J => J(() => Object.entries(__JASK.L.wins).find(([, w]) => w.type === 'materialy')?.[0] || null);
/* click a tile and wait until that material stands on the stage (its caption, and Wejdź offered) */
async function pick(page, J, name) {
  await page.locator('.mt-tile', { hasText: name }).first().click();
  await waitFor(J, n => { const c = document.querySelector('.mt-cap b'); return c && c.textContent === n && !!document.querySelector('.mt-go'); }, name, 30000);
  await page.waitForTimeout(300);
}
const lib = J => J(async () => (await Jaskinia.materialy.list()).map(m => ({ id: m.id, name: m.name, ver: m.ver, size: m.facts?.size, tris: m.facts?.tris, anims: m.facts?.anims, from: m.from, rot: m.rot, scale: m.scale, thumb: !!m.thumb })));

const ONLY = process.env.ONLY || ''; // run one part: desk, repo, phone, claude, ext, identity, blockbench, names
/* ---------- 1. desk ---------- */
if (!ONLY || ONLY === 'desk') {
  const { ctx, page, J, wait, shot } = await open();
  const api = await J(() => ({ v: window.Jaskinia?.v, build: JASK_BUILD?.v, types: typeof Jaskinia?.ext?.type, mat: !!__JASK && Object.keys(window.Jaskinia.materialy) }));
  ok(api.v === 1 && api.build === '6' && api.types === 'function', 'boot: window.Jaskinia v1 in build 6', JSON.stringify(api));
  // open Materiały from the API (what a window chooser does)
  const wid = await J(() => Jaskinia.ext.open('materialy'));
  await wait(600);
  ok(!!(await matWin(J)) && wid, 'a Materiały window opens', wid);
  ok(await J(() => !!document.querySelector('.mt-empty:not([hidden])')), 'an empty library says what to drop');
  ok(await J(() => !document.querySelector('.mt .sw-cv')), 'no WebGL context before there is something to show');
  await shot('01-empty');
  // the owner's own files, through the button's file input
  const files = ['Box3d___building.obj', 'Box3d___stairs.obj', 'Box3d___test_map01.obj', 'Box3d___Nadwozie.gltf', 'JV-Box__m6-owner-full-rig-r3.glb', 'voxel-__test_anim.gltf'].filter(have);
  await page.setInputFiles('.mt input[type=file]', files.map(M));
  const n = await waitFor(J, k => Jaskinia.materialy.list().then(l => l.length >= k ? l.length : 0), files.length, 30000);
  ok(n === files.length, 'every dropped model becomes a material', `${n}/${files.length}`);
  let L = await lib(J);
  const by = Object.fromEntries(L.map(m => [m.name, m]));
  const dims = m => m && m.size ? m.size.map(v => +v.toFixed(2)) : null;
  console.log('   library', L.map(m => `${m.name} ${JSON.stringify(dims(m))} tris=${m.tris} anims=${(m.anims || []).length}`).join(' | '));
  ok(by['Box3d___building'] && Math.abs(by['Box3d___building'].size[1] - 7.59) < 0.05 && by['Box3d___building'].size[0] > 10.9, 'the house is 11 m wide and 7.6 m tall (metres from the file)', JSON.stringify(dims(by['Box3d___building'])));
  ok(L.every(m => m.thumb && m.tris > 0), 'every material has a picture and triangles');
  if (by['voxel-__test_anim']) ok((by['voxel-__test_anim'].anims || []).length >= 1, 'animations are read from a Blockbench file', JSON.stringify(by['voxel-__test_anim'].anims));
  await wait(800);
  await shot('02-library');
  // pick the vehicle and look at it with the 1.8 m body
  const m6 = L.find(m => /m6/i.test(m.name));
  if (m6) { await pick(page, J, m6.name); await wait(600); await shot('03-m6'); }
  ok(await J(() => !!document.querySelector('.mt .sw-cv')), 'the stage draws on a canvas');
  const cap = await J(() => document.querySelector('.mt-cap')?.textContent || '');
  ok(/m6/i.test(cap) && / m × /.test(cap), 'the caption names it and gives its size in metres', cap.slice(0, 120));
  // the same file again is not a second material; a changed file with the same name is a new version
  await page.setInputFiles('.mt input[type=file]', [M('Box3d___stairs.obj')]);
  await wait(1500);
  L = await lib(J);
  ok(L.filter(m => m.name === 'Box3d___stairs').length === 1 && L.length === files.length, 'the same bytes again add nothing');
  const tmp = path.join(shots, 'Box3d___stairs.obj');
  fs.writeFileSync(tmp, fs.readFileSync(M('Box3d___stairs.obj'), 'utf8').replace(/^v 0\.711911 1\.912575/gm, 'v 0.711911 2.412575'));
  await page.setInputFiles('.mt input[type=file]', [tmp]);
  const v2 = await waitFor(J, () => Jaskinia.materialy.list().then(l => l.find(m => m.name === 'Box3d___stairs' && m.ver === 2) || null));
  ok(!!v2, 'a changed file with the same name is version 2 of the same material', v2 ? v2.id : '');
  const vs = v2 ? await J(id => Jaskinia.materialy.versions(id).then(v => v.map(x => x.ver)), v2.id) : [];
  ok(JSON.stringify(vs) === '[1,2]', 'both versions stay', JSON.stringify(vs));
  ok(await J(() => document.querySelectorAll('.mt-vers .jk-tb').length === 2), 'the viewer offers v1 and v2');
  // orientation and scale are the material's defaults
  const house = (await lib(J)).find(m => m.name === 'Box3d___building');
  await pick(page, J, 'Box3d___building');
  await page.locator('.mt-bar .jk-tb', { hasText: /Skala/ }).click(); await wait(200);
  await page.locator('.jk-menu button, .jk-menu .mi, [role=menuitem]', { hasText: '×1/100' }).first().click(); await wait(1500);
  let h2 = (await lib(J)).find(m => m.id === house.id);
  ok(h2 && Math.abs(h2.scale - 0.01) < 1e-9 && Math.abs(h2.size[1] - 0.0759) < 0.002, 'scale ×1/100 makes the house 7.6 cm', JSON.stringify(h2 && dims(h2)));
  ok(await J(() => /Bardzo mały/.test(document.querySelector('.mt-cap')?.textContent || '')), 'a tiny model gets a hint about the scale');
  await page.locator('.mt-bar .jk-tb', { hasText: /Skala/ }).click(); await wait(200);
  await page.locator('.jk-menu button, .jk-menu .mi, [role=menuitem]', { hasText: /^×1\b|^×1jednostka/ }).first().click().catch(() => {});
  await wait(1200);
  h2 = (await lib(J)).find(m => m.id === house.id);
  if (Math.abs(h2.scale - 1) > 1e-9) { await J(async id => { const m = await Jaskinia.materialy.get(id); m.scale = 1; }, house.id); }
  await page.locator('.mt-bar .jk-tb', { hasText: /Obrót/ }).click(); await wait(200);
  await page.locator('.jk-menu button, .jk-menu .mi, [role=menuitem]', { hasText: 'Postaw: X +90°' }).first().click(); await wait(1500);
  const h3 = (await lib(J)).find(m => m.id === house.id);
  ok(h3 && h3.rot[0] === 1 && Math.abs(h3.size[2] - 7.59 * (h3.scale || 1)) < 0.06 * (h3.scale || 1), 'a quarter turn about X lays the house down (its height becomes its depth)', JSON.stringify(h3 && { rot: h3.rot, size: dims(h3), scale: h3.scale }));
  await page.locator('.mt-bar .jk-tb', { hasText: /Obrót/ }).click(); await wait(200);
  await page.locator('.jk-menu button, .jk-menu .mi, [role=menuitem]', { hasText: 'Jak w pliku' }).first().click(); await wait(1300);
  // the API gives another tool a fresh copy with the defaults applied
  const objInfo = await J(async id => { const o = await Jaskinia.materialy.object(id); const { THREE } = Jaskinia.swiat.three(); const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); return { name: o.name, mat: o.userData.material, size: [s.x, s.y, s.z].map(v => +v.toFixed(2)), isObj: o.isObject3D }; }, house.id);
  ok(objInfo.isObj && objInfo.mat === house.id, 'Jaskinia.materialy.object(id) gives a three.js object of the material', JSON.stringify(objInfo));
  await shot('04-house');
  /* ---------- Wejdź ---------- */
  // SwiftShader takes seconds per frame here, so the body is moved by simulate() with the drawing loop held,
  // and each picture is one frame drawn by hand (on a real GPU the same scene draws in a few milliseconds)
  await J(() => window.__jkStage.hold(true)); // hold before stepping in, so no software frames pile up
  await page.locator('.mt-go').click(); await wait(300);
  ok(await J(() => !!document.querySelector('.sw-hud') && !!window.__jkWalk), 'Wejdź puts a body in the scene (the walking HUD is up)');
  const p0 = await J(() => { const w = window.__jkWalk; w.face(0, -0.05); return w.pos.toArray().map(v => +v.toFixed(2)); }); // facing the house, whatever the mouse did
  await J(() => { window.__jkStage.draw(); window.__jkStage.renderer.getContext().finish(); });
  await shot('05-walk-start');
  const walked = await J(() => { const w = window.__jkWalk; w.simulate(3, ['KeyW']); window.__jkStage.draw(); window.__jkStage.renderer.getContext().finish(); return { p: w.pos.toArray().map(v => +v.toFixed(2)), g: w.onGround }; });
  await shot('06-walk-front');
  ok(walked.p[2] < p0[2] - 2 && walked.p[1] > 1.3 && walked.p[1] < 1.8, 'walking forward moves toward the house and stays on the ground', JSON.stringify({ from: p0, to: walked }));
  // into the wall: a long walk ends at the house, not inside its wall
  const wall = await J(() => { const w = window.__jkWalk; w.simulate(6, ['KeyW']); return w.pos.toArray().map(v => +v.toFixed(2)); });
  ok(wall[2] > -5.3, 'the house stops the body (walls are solid)', JSON.stringify(wall));
  const jumped = await J(() => { const w = window.__jkWalk; const y0 = w.pos.y; w.keys.add('Space'); let top = y0; for (let i = 0; i < 40; i++) { w.simulate(1 / 60); top = Math.max(top, w.pos.y); if (i === 2) w.keys.delete('Space'); } return +(top - y0).toFixed(2); });
  void jumped;
  await J(() => window.__jkStage.hold(false));
  await page.keyboard.press('Escape'); await wait(200);
  if (await J(() => !!document.querySelector('.sw-hud'))) { await page.keyboard.press('Escape'); await wait(300); } // the first Esc may only let go of the mouse
  ok(await J(() => !document.querySelector('.sw-hud')), 'Esc ends the walk (the first one lets go of the mouse)');
  // the stairs: walking into a step climbs it (steps up to 0.55 m, no jumping)
  await pick(page, J, 'Box3d___stairs');
  await page.locator('.mt-vers .jk-tb', { hasText: 'v1' }).click().catch(() => {});
  await waitFor(J, () => !!document.querySelector('.mt-go') && document.querySelector('.mt-vers .jk-tb.on')?.textContent === 'v1', null, 30000); await wait(300);
  await J(() => window.__jkStage.hold(true));
  await page.locator('.mt-go').click(); await wait(300);
  const up = await J(() => { const w = window.__jkWalk; w.face(-Math.PI / 2); w.place(-3.2, null, 0); w.simulate(0.5); let top = 0; for (let i = 0; i < 12; i++) { w.simulate(0.2, ['KeyW']); top = Math.max(top, w.pos.y); } window.__jkStage.draw(); window.__jkStage.renderer.getContext().finish(); return { top: +top.toFixed(2), end: w.pos.toArray().map(v => +v.toFixed(2)) }; });
  ok(up.top > 3.4, 'walking into the stairs climbs them to the top (2 m) without jumping', JSON.stringify(up));
  await shot('07-stairs');
  await J(() => { window.__jkStage.hold(false); window.__jkWalk?.end(); });
  // a big map is entered from above its middle and the body lands on it
  await pick(page, J, 'Box3d___test_map01');
  await J(() => window.__jkStage.hold(true));
  await page.locator('.mt-go').click(); await wait(300);
  const land = await J(() => { const w = window.__jkWalk; w.simulate(2.5); window.__jkStage.draw(); window.__jkStage.renderer.getContext().finish(); return { p: w.pos.toArray().map(v => +v.toFixed(2)), g: w.onGround }; });
  ok(land.p[1] < 8 && land.p[1] > -0.5, 'on a map the body falls from above and lands', JSON.stringify(land));
  await shot('08-map');
  console.log('   gl after map', JSON.stringify(await J(() => { const S = window.__jkStage, g = S.renderer.getContext(); const px = new Uint8Array(4); S.draw(); g.readPixels(Math.floor(g.drawingBufferWidth / 2), Math.floor(g.drawingBufferHeight / 3), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); return { lost: g.isContextLost(), px: [...px], pr: S.quality(), cam: S.camera.position.toArray().map(v => +v.toFixed(2)), rot: [S.camera.rotation.x, S.camera.rotation.y].map(v => +v.toFixed(2)), fog: [S.scene.fog.near, S.scene.fog.far].map(v => +v.toFixed(1)), contexts: document.querySelectorAll('canvas').length }; })));
  await J(() => { window.__jkStage.hold(false); window.__jkWalk?.end(); });
  // the API: another tool adds a window type without touching Jaskinia's files
  const ext = await J(() => { Jaskinia.ext.type('probny', { name: 'Próbny', render(box) { box.append(Object.assign(document.createElement('p'), { className: 'probny', textContent: 'ok z zewnątrz' })); } }); const id = Jaskinia.ext.open('probny'); return id; });
  await wait(500);
  ok(await J(() => document.querySelector('.probny')?.textContent === 'ok z zewnątrz'), 'Jaskinia.ext.type registers a window type from outside', ext);
  await J(() => Jaskinia.ext.open('materialy')); await wait(300); // bring the materials forward again
  // a file dropped anywhere goes to the materials; something else is refused without leaving Jaskinia
  const dropped = await J(async () => {
    const r = await fetch('https://raw.githubusercontent.com/Jozzpoly/Box3d_FunProject/main/data/meshes/conveyor.obj');
    const f = new File([await r.blob()], 'conveyor.obj');
    const dt = new DataTransfer(); dt.items.add(f);
    document.querySelector('.jk-bar').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    for (let i = 0; i < 60; i++) { const l = await Jaskinia.materialy.list(); if (l.some(m => m.name === 'conveyor')) return true; await new Promise(r => setTimeout(r, 150)); }
    return false;
  });
  ok(dropped, 'a model dropped anywhere in Jaskinia lands in Materiały');
  const refused = await J(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'notatka.txt')); const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }); document.querySelector('.jk-bar').dispatchEvent(ev); return ev.defaultPrevented; });
  ok(refused, 'a dropped file that is not a material never navigates away');
  // a theme change repaints the stage and never rebuilds the window
  const cv0 = await J(() => { window.__cv = document.querySelector('.mt .sw-cv'); return !!window.__cv; });
  await J(() => { document.documentElement.dataset.theme = 'light'; });
  await wait(400);
  ok(cv0 && await J(() => document.querySelector('.mt .sw-cv') === window.__cv), 'a theme change keeps the same 3D stage');
  await shot('09-light');
  await J(() => { delete document.documentElement.dataset.theme; });
  // deleting is soft and can be undone
  const before = (await lib(J)).length;
  await pick(page, J, 'conveyor');
  await page.locator('.mt-del').click(); await wait(600);
  ok((await lib(J)).length === before - 1, 'Usuń takes it out of the list');
  await page.locator('.jk-toast-b', { hasText: 'Cofnij' }).click(); await wait(700);
  ok((await lib(J)).length === before, 'Cofnij brings it back');
  // the library survives a reload (IndexedDB), the window remembers its material
  const selBefore = await J(() => Object.values(__JASK.L.wins).find(w => w.type === 'materialy')?.st.sel);
  await page.reload(); await wait(1500);
  ok((await lib(J)).length === before, 'the library is still there after a reload');
  ok(await J(s => Object.values(__JASK.L.wins).find(w => w.type === 'materialy')?.st.sel === s, selBefore), 'the window still shows the same material');
  await shot('10-reload');
  /* ---------- Zagraj never takes over the game being played (M1) ---------- */
  await page.route('https://jozzpoly.github.io/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>gra</title><body style="background:#123">gra</body>' }));
  const two = await J(() => Object.values(__BIB.R).filter(r => r.pages).slice(0, 2).map(r => r.name));
  await J(n => __BIB.HOOK.play(__BIB.R[n]), two[0]); await wait(500);
  await J(n => __BIB.HOOK.play(__BIB.R[n]), two[1]); await wait(500);
  const g = await J(() => { const ws = Object.entries(__JASK.L.wins).filter(([, w]) => w.type === 'gra'); return { n: ws.length, pins: ws.map(([, w]) => w.pin), rects: ws.map(([id]) => { const r = document.querySelector(`.win[data-id="${id}"]`).getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }) }; });
  const overlap = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  ok(g.n === 2 && g.pins[0] !== g.pins[1] && overlap(g.rects[0], g.rects[1]) < 0.2 * g.rects[0][2] * g.rects[0][3], 'a second Zagraj opens a second game beside the first, not over it', JSON.stringify(g));
  await J(n => __BIB.HOOK.play(__BIB.R[n]), two[0]); await wait(400);
  ok(await J(() => Object.values(__JASK.L.wins).filter(w => w.type === 'gra').length === 2), 'Zagraj on a game already open goes to its window');
  await ctx.close();
}

/* ---------- 2. the owner's repositories, bringing a model from GitHub ---------- */
if (!ONLY || ONLY === 'repo') {
  const { ctx, page, J, wait, shot } = await open();
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  ok(await J(() => document.querySelectorAll('.mt-rchip').length >= 8), 'the empty library offers Jozz\'s own models from his repositories');
  await page.locator('.mt-rchip', { hasText: 'Dom' }).first().click();
  const got = await waitFor(J, () => Jaskinia.materialy.list().then(l => l.find(m => m.name === 'Dom') || null), null, 20000);
  ok(got && /^repo:Jozzpoly\/Box3d_FunProject\//.test(got.from), 'Dom comes from Box3d_FunProject and keeps where it came from', got ? got.from : '');
  await wait(1200);
  await shot('11-from-repo');
  await ctx.close();
}

/* ---------- 3. phone ---------- */
if (!ONLY || ONLY === 'phone') {
  const { ctx, page, J, wait, shot } = await open({ phone: true });
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await page.setInputFiles('.mt input[type=file]', [M('Box3d___building.obj')]);
  await waitFor(J, () => Jaskinia.materialy.list().then(l => l.length));
  await wait(1500);
  await shot('12-phone');
  const fits = await J(() => { const m = document.querySelector('.mt'); return m && m.scrollWidth <= m.clientWidth + 1 && getComputedStyle(m).gridTemplateColumns.split(' ').length === 1; });
  ok(fits, 'on a phone the viewer stacks above the list and nothing overflows');
  await page.locator('.mt-go').click(); await wait(500);
  ok(await J(() => !!document.querySelector('.sw-stick:not([hidden])') && !!document.querySelector('.sw-jump:not([hidden])')), 'on a touch screen Wejdź gives a stick and a jump button');
  await shot('13-phone-walk');
  await ctx.close();
}

/* ---------- 4. claude.ai ---------- */
if (!ONLY || ONLY === 'claude') {
  const { ctx, page, J, wait, shot } = await open({ place: 'claude', scheme: 'light' });
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  ok(await J(() => /claude\.ai/.test(document.querySelector('.mt-repo')?.textContent || '')), 'in claude.ai the repo models say why they cannot come');
  // textures go through <img> there (no fetch of blob: URLs): a textured GLB still shows its pictures
  await page.setInputFiles('.mt input[type=file]', [M('JV-Box__m6-owner-full-rig-r3.glb')]);
  const tex = await waitFor(J, async () => { const l = await Jaskinia.materialy.list(); const m = l[0]; if (!m) return null; const o = await Jaskinia.materialy.object(m.id); let n = 0, ok = 0; o.traverse(x => { if (x.isMesh) for (const mt of [].concat(x.material)) if (mt.map) { n++; if (mt.map.image && (mt.map.image.width || mt.map.image.naturalWidth)) ok++; } }); return n ? { n, ok, tag: (() => { let t0 = ''; o.traverse(x => { if (!t0 && x.isMesh && x.material.map) t0 = x.material.map.image?.tagName || x.material.map.image?.constructor?.name; }); return t0; })() } : null; }, null, 30000);
  ok(tex && tex.ok === tex.n && tex.tag === 'IMG', 'in claude.ai a textured model still gets its pictures (through <img>)', JSON.stringify(tex));
  await shot('14-claude');
  await ctx.close();
}

/* ---------- 5. a window type registered from outside, after a build that did not know it (GPT's seam check) ---------- */
if (!ONLY || ONLY === 'ext') {
  const { ctx, page, J, wait } = await open();
  // a saved window of a type this build does not know, with authored data in it
  await J(() => { const id = __JASK.leafIds(__JASK.L.tree)[0]; __JASK.commit('test: obcy typ', () => { const w = __JASK.L.wins[id]; w.type = 'miejsce_test'; w.st = { savedDocument: { id: 'own-doc', geometry: [1, 3, 5] } }; }); __JASK.persistNow(); });
  await page.reload(); await wait(1200);
  const kept = await J(() => Object.entries(__JASK.L.wins).find(([, w]) => w.lost && w.lost.type === 'miejsce_test'));
  ok(kept && kept[1].type === 'wybor' && JSON.stringify(kept[1].st.savedDocument) === '{"id":"own-doc","geometry":[1,3,5]}', 'a build that does not know a window type keeps it aside with its data', JSON.stringify(kept && kept[1]));
  await J(() => Jaskinia.ext.type('miejsce_test', { name: 'Miejsce (test)', render(box, c) { box.append(Object.assign(document.createElement('p'), { className: 'miejsce-test', textContent: 'doc ' + c.win.st.savedDocument.id })); } }));
  await wait(500);
  const back = await J(id => { const w = __JASK.L.wins[id]; return { type: w.type, lost: w.lost || null, st: w.st, shown: document.querySelector(`.win[data-id="${id}"] .miejsce-test`)?.textContent || '' }; }, kept && kept[0]);
  ok(back.type === 'miejsce_test' && !back.lost && back.st.savedDocument.id === 'own-doc' && back.shown === 'doc own-doc', 'registering the type later brings the window back with its data, drawn by the new type', JSON.stringify(back));
  await page.reload(); await wait(1200);
  ok(await J(id => __JASK.L.wins[id]?.type === 'wybor' && __JASK.L.wins[id]?.lost?.type === 'miejsce_test', kept && kept[0]), 'after a reload without the extension the window waits aside again, data intact');
  await ctx.close();
}

/* ---------- 6. identity of a material with companion files (Medium's counterexample, the VAW Blockbench sample) ---------- */
if ((!ONLY || ONLY === 'identity') && have('ext__vector_thruster_gltf.gltf')) {
  const { ctx, page, J, wait } = await open();
  await J(() => Jaskinia.ext.open('materialy')); await wait(500);
  const F = (name, file) => ({ name, mimeType: 'application/octet-stream', buffer: fs.readFileSync(file) });
  const A = [F('vector_thruster_gltf.gltf', M('ext__vector_thruster_gltf.gltf')), F('vector_thruster_gltf.bin', M('ext__vector_thruster_gltf.bin')), F('vector_thruster_texture.png', M('ext__vector_thruster_texture.png'))];
  await page.setInputFiles('.mt input[type=file]', A);
  const a = await waitFor(J, () => Jaskinia.materialy.list().then(l => l[0] && { id: l[0].id, deps: l[0].deps.map(d => d.name), missing: l[0].missing, texs: l[0].facts.texs }), null, 30000);
  ok(a && a.deps.length === 2 && !a.missing.length && a.texs >= 1, 'a .gltf with its .bin and texture (in textures/) keeps both as companions and shows the texture', JSON.stringify(a));
  const B = [A[0], A[1], F('vector_thruster_texture.png', path.join(models, 'ext_b', 'vector_thruster_texture.png'))];
  await page.setInputFiles('.mt input[type=file]', B);
  const b = await waitFor(J, () => Jaskinia.materialy.list().then(l => l.find(m => m.ver === 2) || null).then(m => m && { id: m.id, ver: m.ver }), null, 30000);
  ok(b && a && b.id !== a.id, 'the same .gltf bytes with a different texture are a different material (v2), never the old one reused', JSON.stringify({ a: a && a.id, b }));
  await page.setInputFiles('.mt input[type=file]', [A[0]]);
  await wait(2500);
  const c = await J(() => Jaskinia.materialy.list().then(l => l.map(m => m.ver)));
  ok(JSON.stringify(c) === '[2]' && await J(() => /nie dało się wczytać/.test([...document.querySelectorAll('.jk-toast')].map(x => x.textContent).join(' '))), 'the .gltf without its .bin is refused out loud, nothing half-made is stored', JSON.stringify(c));
  await ctx.close();
}

/* ---------- 7. Blockbench's own files, a whole folder at once (the owner's saves; a .vox file must stay untouched) ---------- */
const BB = path.join(models, 'bb');
if ((!ONLY || ONLY === 'blockbench') && fs.existsSync(BB)) {
  const tmp = path.join(shots, 'bbfolder');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.cpSync(BB, tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'studio_secret.vox'), 'VOX ');
  const nBB = fs.readdirSync(tmp, { recursive: true }).filter(f => /\.bbmodel$/i.test(f)).length;
  const { ctx, page, J, wait } = await open();
  await J(() => Jaskinia.ext.open('materialy')); await wait(500);
  await page.setInputFiles('.mt-dirin', tmp);
  const got = await waitFor(J, n => Jaskinia.materialy.list().then(l => l.length >= n ? l.map(m => ({ name: m.name, kind: m.kind, texs: m.facts.texs, size: m.facts.size.map(v => +v.toFixed(2)), missing: m.missing.length, main: m.main.name })) : null), nBB, 120000);
  ok(got && got.length === nBB && got.every(m => /\.bbmodel$/.test(m.main) && m.texs >= 1 && !m.missing), 'a folder of Blockbench saves: every .bbmodel comes in with its own pictures', JSON.stringify(got));
  ok(got && !got.some(m => /vox/i.test(m.main)), 'a .vox file in the folder is left alone');
  const wheel = got && got.find(m => m.name === 'small_wheels');
  if (wheel) ok(Math.abs(wheel.size[1] - 1.02) < 0.05, 'Blockbench pixels become metres like its glTF export (16 px = 1 m)', JSON.stringify(wheel.size));
  await ctx.close();
}

/* ---------- 8. names: two files called model.gltf in different folders are two materials, not versions of one ---------- */
const VB = path.join(models, 'vawblocks');
if ((!ONLY || ONLY === 'names') && fs.existsSync(VB)) {
  const { ctx, page, J, wait } = await open();
  await J(() => Jaskinia.ext.open('materialy')); await wait(500);
  await page.setInputFiles('.mt-dirin', VB);
  const got = await waitFor(J, () => Jaskinia.materialy.list().then(l => l.length >= 2 ? l.map(m => m.name + ' v' + m.ver).sort() : null), null, 60000);
  ok(JSON.stringify(got) === JSON.stringify(['hull · model v1', 'thruster · model v1']), 'model.gltf in hull/ and in thruster/ become "hull · model" and "thruster · model"', JSON.stringify(got));
  await ctx.close();
}

await browser.close(); SRV.close?.();
// GLTFLoader says this itself when a .gltf comes without its texture: the identity check provokes it on purpose
const real = errs.filter(e => !/Failed to load resource/.test(e) && !/GLTFLoader: Couldn't load texture/.test(e));
ok(!real.length, 'no errors in the console', real.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
