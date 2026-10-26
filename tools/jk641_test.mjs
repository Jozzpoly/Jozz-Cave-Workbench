// Jaskinia v6.4.1 checks: the findings of GPT, Medium, Astra and Feniks GPT on PR #4 (21 Oct 2026), each first shown to
// fail on v6.4 by them, and here held as regression checks.
//   tozsamosc  two groups both called "wheel" swap places in a new version of the file: his motion stays on the wheel he
//              chose (by where it sits in the file), and motion kept before 6.4.1, which cannot be told apart, is not
//              guessed: he is told to point at it again (Astra's real-host reproducer, the Browser falsifier)
//   uklad      the same wheel moved in the file: its pivot moves with it, so it turns in place instead of orbiting the old
//              point (Medium); a wheel whose shape changed gets its proposed axis and pivot again and he is asked to look
//   palce      only the finger that took a part moves it and lets it go; a second finger neither ends nor steals the
//              gesture (Feniks GPT)
//   okna       two Materiały windows on one model add up their parts instead of the later one replacing the other (Medium)
//   zamknij    the close button of a floating window takes a click in its middle (Astra)
// node tools/jk641_test.mjs [shotdir]   (ONLY=tozsamosc|uklad|palce|okna|zamknij to run one)
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk641t');
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_jk641_test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
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
async function tab(ctx) {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(SRV.base + '/_jk641_test.html');
  await page.waitForTimeout(800);
  return { page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }) };
}
const waitFor = async (J, fn, a, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 120)); } return null; };

/* models made up for the checks, as Blockbench saves them (16 px = 1 m) */
const F = Object.fromEntries(['north', 'south', 'east', 'west', 'up', 'down'].map(k => [k, { uv: [0, 0, 4, 4] }]));
const cube = (uuid, from, to) => ({ uuid, name: 'cube', type: 'cube', from, to, origin: [0, 0, 0], faces: F });
const bb = (name, elements, outliner) => ({ meta: { format_version: '4.10', model_format: 'free', box_uv: false }, name, resolution: { width: 16, height: 16 }, elements, outliner, textures: [] });
// Astra's pair: two wheels side by side; version 2 only swaps the order of the two groups
const pair = (unique, reverse) => {
  const out = [{ uuid: 'g-left', name: unique ? 'left wheel' : 'wheel', origin: [-8, 8, 0], children: ['c-left'] }, { uuid: 'g-right', name: unique ? 'right wheel' : 'wheel', origin: [8, 8, 0], children: ['c-right'] }];
  if (reverse) out.reverse();
  return bb('para', [cube('c-left', [-12, 2, -1], [-4, 14, 1]), cube('c-right', [4, 2, -1], [12, 14, 1])], out);
};
// Medium's wheel: v2 moves it 24 px (1.5 m) along X; or grows it (another shape)
const wheel = (dx = 0, grow = false) => bb('kolo', [cube('c', grow ? [-6 + dx, 0, -1] : [-4 + dx, 2, -1], grow ? [6 + dx, 16, 1] : [4 + dx, 14, 1])], [{ uuid: 'g', name: 'felga', origin: [dx, 8, 0], children: ['c'] }]);
// a wheel and a piston, for two windows
const two = () => bb('dwa', [cube('c1', [-12, 2, -1], [-4, 14, 1]), cube('c2', [4, 2, -1], [6, 14, 1])], [{ uuid: 'g1', name: 'kolo', origin: [-8, 8, 0], children: ['c1'] }, { uuid: 'g2', name: 'tlok', origin: [5, 8, 0], children: ['c2'] }]);

const importAs = (J, file, model) => J(([file, m]) => __JASK.matImport([{ name: file, blob: new Blob([JSON.stringify(m)]) }]), [file, model]);
const idOf = (J, name) => J(async n => (await Jaskinia.materialy.list()).find(m => m.name === n)?.id, name);
// a group of the model on the Ruch stage, by name, the one further left or right when names repeat
const groupExpr = (r, name, side) => `(() => { const { THREE } = Jaskinia.swiat.three(), gs = []; window.${r}.inner.updateMatrixWorld(true); const inner = window.${r}.inner; inner.traverse(o => { if (o !== inner && !o.isMesh && o.name === ${JSON.stringify(name)}) gs.push(o); }); gs.sort((a, b) => new THREE.Box3().setFromObject(a).getCenter(new THREE.Vector3()).x - new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3()).x); return ${side === 'right' ? 'gs.at(-1)' : 'gs[0]'}; })()`;
const pickPart = (J, r, name, side, kind) => J(new Function(`window.${r}.pick(${groupExpr(r, name, side)}); window.${r}.kind(${JSON.stringify(kind)});`));
// a fresh copy through the public API: turn part 0 a quarter round and say which group changed its box (left or right)
const drive = (J, id, names = ['wheel', 'left wheel', 'right wheel']) => J(async ([id, names]) => {
  const object = await Jaskinia.materialy.object(id), { THREE } = Jaskinia.swiat.three(), gs = [];
  object.updateMatrixWorld(true);
  object.traverse(o => { if (!o.isMesh && names.includes(o.name)) gs.push(o); });
  const box = g => new THREE.Box3().setFromObject(g);
  gs.sort((a, b) => box(a).getCenter(new THREE.Vector3()).x - box(b).getCenter(new THREE.Vector3()).x);
  const before = gs.map(g => { const b = box(g); return { c: b.getCenter(new THREE.Vector3()), s: b.getSize(new THREE.Vector3()) }; });
  const rig = await Jaskinia.materialy.rig(object, id);
  if (!rig.parts.length) return { parts: 0 };
  rig.set(0, Math.PI / 2); object.updateMatrixWorld(true);
  const after = gs.map(g => { const b = box(g); return { c: b.getCenter(new THREE.Vector3()), s: b.getSize(new THREE.Vector3()) }; });
  const turned = after.map((a, i) => a.s.distanceTo(before[i].s) > 1e-3);
  const drift = after.map((a, i) => a.c.distanceTo(before[i].c));
  rig.rest(); object.updateMatrixWorld(true);
  const back = gs.map((g, i) => box(g).getSize(new THREE.Vector3()).distanceTo(before[i].s));
  return { parts: rig.parts.length, which: turned[0] && !turned[1] ? 'left' : turned[1] && !turned[0] ? 'right' : turned.join(','), drift, back: Math.max(...back) };
}, [id, names]);
const panelText = J => J(() => document.querySelector('.mt-ruch')?.textContent || '');
// open the Materiały window, show a material in it and turn Ruch on
async function showIn(J, wait, page, name) {
  const want = await idOf(J, name);
  await J(n => document.querySelector(`.mt-tile[title="${n}"]`)?.click(), name);
  await waitFor(J, w => window.__jkRuch?.json()?.material?.id === w && !!window.__jkRuch.inner && !!document.querySelector('.mt-ruchb'), want, 10000);
  if (!(await J(() => window.__jkRuch.on))) await page.locator('.mt-ruchb').first().click();
  await wait(250);
}

/* ---------- 1. the same name twice ---------- */
if (!ONLY || ONLY === 'tozsamosc') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await importAs(J, 'para.bbmodel', pair(false, false)); await wait(500);
  await showIn(J, wait, page, 'para');
  await pickPart(J, '__jkRuch', 'wheel', 'left', 'obrot');
  await J(() => window.__jkRuch.saved); await wait(300);
  const v1 = await idOf(J, 'para');
  const kept = await J(id => Jaskinia.materialy.get(id), v1);
  ok(kept?.ruch?.parts?.length === 1 && Array.isArray(kept.ruch.parts[0].boxes) && kept.ruch.parts[0].boxes[0]?.length === 6, 'a part he sets in motion now keeps where it sits in the file (the middle and size of its box)', JSON.stringify(kept?.ruch?.parts?.[0]?.boxes));
  ok((await drive(J, v1)).which === 'left', 'version 1: his motion turns the LEFT wheel');

  await importAs(J, 'para.bbmodel', pair(false, true)); await wait(500);
  await showIn(J, wait, page, 'para');
  const c2 = await waitFor(J, () => window.__jkRuch?.carried ? window.__jkRuch.carried : null, null, 8000);
  await J(() => window.__jkRuch.saved); await wait(400);
  const v2 = await idOf(J, 'para');
  const d2 = await drive(J, v2);
  ok(v2 !== v1 && c2?.n === 1 && !c2.niejednoznaczne?.length && d2.which === 'left', 'version 2 swaps the two groups called "wheel": his motion stays on the LEFT wheel, known by where it sits', JSON.stringify({ c2, d2 }));
  ok(/Ruch przeniesiony z wersji 1: 1 z 1/.test(await panelText(J)), 'and Ruch says it came along');
  await page.reload(); await wait(1200);
  ok((await drive(J, v2)).which === 'left', 'after a reload it is still the LEFT wheel');

  // the same, with motion kept before 6.4.1 (no boxes): two wheels fit, so nothing is guessed
  await importAs(J, 'para-stara.bbmodel', { ...pair(false, false), name: 'para-stara' }); await wait(500);
  await showIn(J, wait, page, 'para-stara');
  await pickPart(J, '__jkRuch', 'wheel', 'left', 'obrot');
  await J(() => window.__jkRuch.saved); await wait(300);
  const o1 = await idOf(J, 'para-stara');
  await J(id => __JASK.matPatch?.(id, r => { for (const p of r.ruch.parts) delete p.boxes; }), o1);
  await importAs(J, 'para-stara.bbmodel', { ...pair(false, true), name: 'para-stara' }); await wait(500);
  await showIn(J, wait, page, 'para-stara');
  const c3 = await waitFor(J, () => window.__jkRuch?.carried ? window.__jkRuch.carried : null, null, 8000);
  await wait(400);
  const o2 = await idOf(J, 'para-stara');
  const txt = await panelText(J);
  ok(o2 !== o1 && c3?.n === 0 && c3.niejednoznaczne?.join() === 'wheel' && !(await J(id => Jaskinia.materialy.ruch(id), o2)), 'motion kept before 6.4.1 on one of two same-named wheels is not guessed onto either: nothing moves, nothing is written', JSON.stringify(c3));
  ok(/Nie przeniosłem z wersji 1: „wheel”/.test(txt) && /Wskaż ją i nadaj ruch jeszcze raz/.test(txt) && !/Ruch przeniesiony/.test(txt), 'and Ruch tells him which part to point at again, instead of "1 z 1"', txt.slice(0, 200));
  await shot('01-niejednoznaczne');

  // the control: unique names kept before 6.4.1 still come along, with a word that the place was not checked
  await importAs(J, 'para-u.bbmodel', { ...pair(true, false), name: 'para-u' }); await wait(500);
  await showIn(J, wait, page, 'para-u');
  await pickPart(J, '__jkRuch', 'left wheel', 'left', 'obrot');
  await J(() => window.__jkRuch.saved); await wait(300);
  const u1 = await idOf(J, 'para-u');
  await J(id => __JASK.matPatch?.(id, r => { for (const p of r.ruch.parts) delete p.boxes; }), u1);
  await importAs(J, 'para-u.bbmodel', { ...pair(true, true), name: 'para-u' }); await wait(500);
  await showIn(J, wait, page, 'para-u');
  const c4 = await waitFor(J, () => window.__jkRuch?.carried ? window.__jkRuch.carried : null, null, 8000);
  await J(() => window.__jkRuch.saved); await wait(400);
  const u2 = await idOf(J, 'para-u');
  ok(c4?.n === 1 && c4.niesprawdzone === 1 && (await drive(J, u2)).which === 'left', 'unique names kept before 6.4.1 still come along to the LEFT wheel', JSON.stringify(c4));
  ok(/nie sprawdziłem, czy części nie zmieniły miejsca/.test(await panelText(J)), 'and he is told their place was not checked');
  await ctx.close();
}

/* ---------- 2. the right part in the old place ---------- */
if (!ONLY || ONLY === 'uklad') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await importAs(J, 'kolo.bbmodel', wheel(0)); await wait(500);
  await showIn(J, wait, page, 'kolo');
  await pickPart(J, '__jkRuch', 'felga', 'left', 'obrot');
  await J(() => window.__jkRuch.saved); await wait(300);
  const k1 = await idOf(J, 'kolo');
  const p1 = (await J(id => Jaskinia.materialy.ruch(id), k1))?.parts?.[0];
  ok(JSON.stringify(p1?.pivot) === '[0,0.5,0]', 'version 1: the wheel turns about its own middle', JSON.stringify(p1?.pivot));
  await importAs(J, 'kolo.bbmodel', wheel(24)); await wait(500);
  await showIn(J, wait, page, 'kolo');
  const c = await waitFor(J, () => window.__jkRuch?.carried ? window.__jkRuch.carried : null, null, 8000);
  await J(() => window.__jkRuch.saved); await wait(400);
  const k2 = await idOf(J, 'kolo');
  const p2 = (await J(id => Jaskinia.materialy.ruch(id), k2))?.parts?.[0];
  const dv = await drive(J, k2, ['felga']);
  ok(c?.przesuniete?.join() === 'felga' && JSON.stringify(p2?.pivot) === '[1.5,0.5,0]', 'version 2 moves the wheel 1.5 m: its pivot moves with it', JSON.stringify({ c, pivot: p2?.pivot }));
  ok(dv.parts === 1 && dv.drift[0] < 1e-6 && dv.back < 1e-9, 'so it turns in place instead of orbiting the old point, and comes back exactly', JSON.stringify(dv));
  ok(/Przesunięte w pliku: „felga”/.test(await panelText(J)), 'and he is told it moved, to check');
  await shot('02-przesuniete');

  // another shape: what came from a proposal is proposed again, and he is asked to look
  await importAs(J, 'kolo.bbmodel', wheel(24, true)); await wait(500);
  await showIn(J, wait, page, 'kolo');
  const c3 = await waitFor(J, () => window.__jkRuch?.carried ? window.__jkRuch.carried : null, null, 8000);
  await J(() => window.__jkRuch.saved); await wait(400);
  const k3 = await idOf(J, 'kolo');
  const p3 = (await J(id => Jaskinia.materialy.ruch(id), k3))?.parts?.[0];
  ok(c3?.zmienione?.join() === 'felga' && JSON.stringify(p3?.pivot) === '[1.5,0.5,0]' && p3?.skad?.punkt === 'bryla' && /Zmieniony kształt: „felga”/.test(await panelText(J)), 'a wheel whose shape changed gets its axis and pivot proposed again from the new shape, and he is asked to look', JSON.stringify({ c3, p3 }));
  await ctx.close();
}

/* ---------- 3. fingers ---------- */
if (!ONLY || ONLY === 'palce') {
  const ctx = await context();
  const { page, J, wait } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await importAs(J, 'dwa.bbmodel', two()); await wait(500);
  await showIn(J, wait, page, 'dwa');
  await pickPart(J, '__jkRuch', 'kolo', 'left', 'obrot');
  await J(() => window.__jkRuch.saved);
  await waitFor(J, () => [...window.__jkRuch.rig.vals.values()].every(v => v === 0), null, 8000);
  const at = await J(() => { const S = window.__jkStage, inner = window.__jkRuch.inner, { THREE } = Jaskinia.swiat.three(); inner.updateMatrixWorld(true); const q = inner.localToWorld(new THREE.Vector3(-0.3, 0.5, 1 / 16)).project(S.camera), r = S.canvas.getBoundingClientRect(); return [r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height]; });
  const ev = (type, pid, x, y, onWindow) => J(([type, pid, x, y, onWindow]) => { const e = new PointerEvent(type, { pointerId: pid, pointerType: 'touch', isPrimary: pid === 2, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true }); (onWindow ? window : window.__jkStage.canvas).dispatchEvent(e); }, [type, pid, x, y, onWindow]);
  const val = () => J(() => window.__jkRuch.rig.vals.get(window.__jkRuch.defs[0].id) || 0);
  await ev('pointerdown', 2, at[0], at[1]);
  ok(await J(() => window.__jkRuch.dragging), 'finger A takes the wheel');
  await ev('pointermove', 2, at[0] + 40, at[1] + 60, true); await wait(50);
  const v1 = await val();
  await ev('pointerdown', 4, at[0] + 5, at[1] + 5); // finger B lands too
  await ev('pointermove', 4, at[0] + 300, at[1] + 200, true); await wait(50);
  ok(Math.abs((await val()) - v1) < 1e-12, 'finger B moving elsewhere does not turn the wheel', String(await val()));
  await ev('pointerup', 4, at[0] + 300, at[1] + 200, true);
  ok(await J(() => window.__jkRuch.dragging), 'finger B lifted first: finger A still holds the wheel (on v6.4 this ended the gesture)');
  await ev('pointermove', 2, at[0] + 80, at[1] + 120, true); await wait(50);
  ok(Math.abs((await val()) - v1) > 1e-3, 'and finger A keeps turning it', `${v1} → ${await val()}`);
  await ev('pointerup', 2, at[0] + 80, at[1] + 120, true);
  ok(await J(() => !window.__jkRuch.dragging && window.__jkStage.controls.enabled), 'finger A lifted: the gesture ends and the view can turn again');
  await ctx.close();
}

/* ---------- 4. two windows on one model ---------- */
if (!ONLY || ONLY === 'okna') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await importAs(J, 'dwa.bbmodel', two()); await wait(500);
  await showIn(J, wait, page, 'dwa');
  await J(() => { window.__rA = window.__jkRuch; });
  const idB = await J(() => Jaskinia.ext.open('materialy', { fresh: true })); await wait(900);
  await J(id => { const el = __JASK.RT.get(id)?.el; el?.querySelector('.mt-tile[title="dwa"]')?.click(); }, idB);
  await waitFor(J, () => window.__jkRuch !== window.__rA && !!window.__jkRuch?.inner, null, 10000);
  await J(() => { window.__rB = window.__jkRuch; });
  await J(id => { const el = __JASK.RT.get(id)?.el; if (!window.__rB.on) el?.querySelector('.mt-ruchb')?.click(); }, idB); await wait(300);
  ok(await J(() => window.__rA !== window.__rB && window.__rA.on && window.__rB.on && window.__rA.inner && window.__rB.inner), 'two Materiały windows show the same model, Ruch on in both');
  await pickPart(J, '__rA', 'kolo', 'left', 'obrot');
  await J(() => window.__rA.saved); await wait(300);
  ok(!!(await waitFor(J, () => window.__rB.defs.some(d => d.name === 'kolo'), null, 4000)), 'the wheel set in window A appears in window B');
  await pickPart(J, '__rB', 'tlok', 'left', 'przesuw');
  await J(() => window.__rB.saved); await wait(300);
  const mid = await idOf(J, 'dwa');
  const names = (await J(id => Jaskinia.materialy.ruch(id), mid))?.parts?.map(p => p.name).sort().join('|');
  ok(names === 'kolo|tlok', 'the piston set in window B is added to the record; the wheel from A stays (on v6.4, B replaced the list)', names);
  ok(!!(await waitFor(J, () => window.__rA.defs.map(d => d.name).sort().join('|') === 'kolo|tlok', null, 4000)), 'and window A shows both');
  // "Stoi" on the wheel in B takes back only the wheel
  await J(new Function(`window.__rB.pick(${groupExpr('__rB', 'kolo', 'left')}); window.__rB.kind('stoi');`));
  await J(() => window.__rB.saved); await wait(300);
  const left = (await J(id => Jaskinia.materialy.ruch(id), mid))?.parts?.map(p => p.name).join('|');
  ok(left === 'tlok', '"Stoi" in one window takes back only that part', left);
  await shot('04-dwa-okna');
  await ctx.close();
}

/* ---------- 5. the close button ---------- */
if (!ONLY || ONLY === 'zamknij') {
  const ctx = await context();
  const { J, wait } = await tab(ctx);
  const id = await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  const hitX = await J(id => { const el = __JASK.RT.get(id)?.el, b = el?.querySelector('.whead .b-x'); if (!b || !el.classList.contains('float')) return { float: !!el?.classList.contains('float'), b: !!b }; const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { float: true, density: document.documentElement.dataset.density, mid: t === b || b.contains(t), target: t?.className || t?.tagName }; }, id);
  ok(hitX.float && hitX.mid, 'a floating window\'s close button takes a click in its middle (the corner handle no longer covers it)', JSON.stringify(hitX));
  ok(await J(id => { const el = __JASK.RT.get(id)?.el, c = el?.querySelector('.fh-ne'), r = el.getBoundingClientRect(), t = document.elementFromPoint(r.right - 3, r.top + 3); return !!c && (t === c); }, id), 'the corner outside the button still stretches the window');
  await ctx.close();
}

ok(!errs.length, 'no errors in the console', errs.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
SRV.close?.();
process.exit(fail ? 1 : 0);
