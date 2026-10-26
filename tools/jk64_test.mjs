// Jaskinia v6.4 checks: Ruch, his own parts set in motion by his own hands, and the works speaking on his surfaces.
//   ruch    a Blockbench model gets a moving part by a click and one word (it turns, it slides); the axis comes from a cube
//           named Axis or from the shape; his hand drags it; the show stops at the exact rest pose; Ctrl+click makes a
//           part of his own; it is kept on the material, survives a reload, comes along to a new version of the file by
//           names, and agents read it (Jaskinia.materialy.ruch, .rig, "Dla agentów", a .json file)
//   mowa    the "Do zagrania" shelf and a game's launch card speak about the works, the workshop's process stays on call
// node tools/jk64_test.mjs [shotdir]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk64t');
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, '_jk64_test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
const SRV = await serve(dist);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
const ONLY = process.env.ONLY || '';
async function context(o = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1500, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark', hasTouch: !!o.touch });
  await ctx.addInitScript(() => { window.__JASK_PLACE = 'web'; try { localStorage.setItem('jaskinia:hint', '1'); localStorage.setItem('jaskinia:v6', '1'); } catch { /* fine */ } });
  return ctx;
}
async function tab(ctx, file = '_jk64_test.html') {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(file + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(file + ' pageerror: ' + e.message));
  await page.goto(SRV.base + '/' + file);
  await page.waitForTimeout(800);
  return { page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }) };
}
const waitFor = async (J, fn, a, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 120)); } return null; };

/* a small machine as Blockbench saves it: a base, a gear with a cube named Axis, a piston, a wheel whose group also holds
   its mudguard (the group is not the part he means). v2 adds a cube before everything, so every index path moves. */
const machine = v2 => {
  const F = { north: { uv: [0, 0, 4, 4] }, south: { uv: [0, 0, 4, 4] }, east: { uv: [0, 0, 4, 4] }, west: { uv: [0, 0, 4, 4] }, up: { uv: [0, 0, 4, 4] }, down: { uv: [0, 0, 4, 4] } };
  const c = (uuid, name, from, to) => ({ uuid, name, type: 'cube', from, to, origin: [0, 0, 0], faces: F });
  const els = [c('e1', 'podstawa', [-16, 0, -8], [16, 2, 8]), c('e2', 'zab', [-14, 4, -1], [-2, 16, 1]), c('e3', 'Axis', [-9, 9, -3], [-7, 11, 3]),
    c('e4', 'tlok', [3, 4, -1], [5, 16, 1]), c('e5', 'opona', [8, 4, -6], [10, 16, 6]), c('e6', 'felga', [7, 7, -3], [11, 13, 3]), c('e7', 'blotnik', [7, 16, -7], [11, 17, 7])];
  const out = ['e1', { name: 'gear', uuid: 'g1', origin: [0, 0, 0], children: ['e2', 'e3'] }, { name: 'piston', uuid: 'g2', origin: [0, 0, 0], children: ['e4'] },
    { name: 'wheel', uuid: 'g3', origin: [9, 10, 0], children: ['e5', 'e6', 'e7'] }];
  if (v2) { els.unshift(c('e0', 'nowy', [12, 0, -2], [14, 2, 2])); out.unshift('e0'); }
  return { meta: { format_version: '4.10', model_format: 'free', box_uv: false }, name: 'mechanizm', resolution: { width: 16, height: 16 }, elements: els, outliner: out, textures: [] };
};
// where a point of the model is on the screen (x, y, z in the file's metres)
const onScreen = (J, p) => J(p => {
  const S = window.__jkStage, inner = window.__jkRuch.inner, { THREE } = Jaskinia.swiat.three();
  inner.updateMatrixWorld(true);
  const q = inner.localToWorld(new THREE.Vector3(...p)).project(S.camera), r = S.canvas.getBoundingClientRect();
  return [r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height];
}, p);
const meshOf = name => `(() => { let m = null; window.__jkRuch.inner.traverse(x => { if (x.isMesh && x.name === ${JSON.stringify(name)}) m = x; }); return m; })()`;
// every node of the model with its local matrix: the rest pose
const pose = J => J(() => { const out = {}; window.__jkRuch.inner.traverse(x => { x.updateMatrix(); out[x.uuid] = x.matrix.elements.slice(); }); return out; });
const poseDiff = (a, b) => { let m = 0; for (const k of Object.keys(a)) for (let i = 0; i < 16; i++) m = Math.max(m, Math.abs(a[k][i] - (b[k] ? b[k][i] : 1e9))); return m; };

/* ---------- 1. Ruch ---------- */
if (!ONLY || ONLY === 'ruch') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await J(m => __JASK.matImport([{ name: 'mechanizm.bbmodel', blob: new Blob([JSON.stringify(m)]) }]), machine(false));
  await wait(500);
  await J(() => document.querySelector('.mt-tile[title="mechanizm"]')?.click());
  await waitFor(J, () => !!window.__jkRuch?.inner && !!document.querySelector('.mt-ruchb'));
  const mid = await J(async () => (await Jaskinia.materialy.list()).find(m => m.name === 'mechanizm')?.id);
  ok(await J(() => /Ruch/.test(document.querySelector('.mt-ruchb')?.textContent || '') && !window.__jkRuch.on), 'a model on the stage has a "Ruch" switch, off until he turns it on');
  await page.locator('.mt-ruchb').click(); await wait(250);
  ok(await J(() => { const p = document.querySelector('.mt-ruch'); return !!p && !p.hidden && /Kliknij część swojego modelu/.test(p.textContent) && /Ctrl\+klik/.test(p.textContent); }), 'Ruch opens beside the model and says what to do: click a part, Ctrl+click for a part of his own');
  const rest0 = await pose(J);

  // a real click on the gear chooses the group that holds the clicked cube
  const camBefore = await J(() => window.__jkStage.camera.position.toArray());
  let pt = await onScreen(J, [-0.75, 0.625, 1 / 16]);
  await page.mouse.click(pt[0], pt[1]); await wait(300);
  const s1 = await J(() => ({ n: window.__jkRuch.sel?.nodes.map(n => n.name), leaf: window.__jkRuch.sel?.leaf?.children[0]?.name, path: [...document.querySelectorAll('.rc-crumb')].map(b => b.textContent) }));
  ok(s1.n?.[0] === 'gear' && s1.leaf === 'zab' && s1.path.join('>') === 'gear>zab', 'a click on a cube chooses the group that holds it, and shows the path in his file (gear › zab)', JSON.stringify(s1));
  ok(await J(() => [...document.querySelectorAll('.mt-ruch .jk-tb.hint')].some(b => /Obraca się/.test(b.textContent))), 'the name "gear" hints that it turns (a dashed suggestion, not a choice made for him)');
  await page.locator('.mt-ruch button', { hasText: 'Obraca się' }).click();
  const moving = await waitFor(J, () => Math.abs([...window.__jkRuch.rig.vals.values()][0] || 0) > 0.05, null, 3000);
  const d1 = await J(() => window.__jkRuch.defs[0]);
  ok(d1?.kind === 'obrot' && JSON.stringify(d1.axis) === '[0,0,1]' && JSON.stringify(d1.pivot) === '[-0.5,0.625,0]' && d1.z === 'klocek:Axis', '"Obraca się": the axis and pivot come from his cube named Axis', JSON.stringify(d1));
  ok(!!moving, 'the part shows its motion at once');
  ok(await J(() => ![...document.querySelectorAll('.mt-ruch .jk-tb')].some(b => /z pliku/.test(b.textContent))), 'a pivot left at the model\'s origin (never set in Blockbench) is not offered as "z pliku"');
  await waitFor(J, () => (window.__jkRuch.rig.vals.get(window.__jkRuch.defs[0].id) || 0) === 0, null, 8000);
  await wait(200);
  ok(poseDiff(rest0, await pose(J)) < 1e-12, 'after the show the model is back in its exact rest pose', String(poseDiff(rest0, await pose(J))));
  await shot('01-gear');

  // his hand: a drag on the gear turns it like a dial; the view does not turn
  const piv = await onScreen(J, [-0.5, 0.625, 1 / 16]);
  const start = await onScreen(J, [-0.8, 0.625, 1 / 16]);
  const R0 = Math.hypot(start[0] - piv[0], start[1] - piv[1]), a0 = Math.atan2(start[1] - piv[1], start[0] - piv[0]);
  await page.mouse.move(start[0], start[1]); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { const a = a0 + (Math.PI / 2) * i / 12; await page.mouse.move(piv[0] + R0 * Math.cos(a), piv[1] + R0 * Math.sin(a)); await wait(16); }
  await page.mouse.up(); await wait(200);
  const dv = await J(() => window.__jkRuch.rig.vals.get(window.__jkRuch.defs[0].id));
  const camAfter = await J(() => window.__jkStage.camera.position.toArray());
  ok(Math.abs(dv) > 1.0 && Math.abs(dv) < 2.2, 'dragging the gear a quarter round turns it about a quarter turn', dv.toFixed(3));
  ok(camAfter.every((v, i) => Math.abs(v - camBefore[i]) < 1e-6), 'while his hand turns a part, the view stays where it was');
  ok(await J(() => /°/.test(document.querySelector('.rc-val')?.textContent || '')), 'the panel says how far it is turned, in degrees', await J(() => document.querySelector('.rc-val')?.textContent));
  // a drag on empty ground still turns the view (the owner's hands are unchanged)
  const r = await J(() => { const b = window.__jkStage.canvas.getBoundingClientRect(); return [b.left + 40, b.top + b.height - 120]; });
  await page.mouse.move(r[0], r[1]); await page.mouse.down(); await page.mouse.move(r[0] + 120, r[1] - 10, { steps: 8 }); await page.mouse.up(); await wait(300);
  ok(await J(c => window.__jkStage.camera.position.toArray().some((v, i) => Math.abs(v - c[i]) > 1e-3), camAfter), 'a drag on empty ground still turns the view');

  // the piston: its name hints a slide; the slide follows the longest side, his hand pulls it within its travel
  await J(new Function(`window.__jkRuch.pick(${meshOf('tlok')})`)); await wait(200);
  ok(await J(() => window.__jkRuch.sel?.nodes[0]?.name === 'piston' && [...document.querySelectorAll('.mt-ruch .jk-tb.hint')].some(b => /Przesuwa się/.test(b.textContent))), 'the piston\'s name hints that it slides');
  await page.locator('.mt-ruch button', { hasText: 'Przesuwa się' }).click(); await wait(1600);
  const d2 = await J(() => window.__jkRuch.defs.find(d => d.name === 'piston'));
  ok(d2?.kind === 'przesuw' && JSON.stringify(d2.axis) === '[0,1,0]' && JSON.stringify(d2.range) === '[0,0.375]', 'a slide along its longest side, half its length by default', JSON.stringify(d2));
  await waitFor(J, () => [...window.__jkRuch.rig.vals.values()].every(v => v === 0) || true, null, 2000);
  const tp = await onScreen(J, [0.25, 1.0, 0]);
  ok(await J(p => { const S = window.__jkStage, { THREE } = Jaskinia.swiat.three(), r = S.canvas.getBoundingClientRect(), rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((p[0] - r.left) / r.width * 2 - 1, -((p[1] - r.top) / r.height) * 2 + 1), S.camera);
    return rc.intersectObject(window.__jkRuch.inner, true)[0]?.object.name === 'tlok'; }, tp), 'the top of the piston is in sight (the drag below starts on it)');
  await page.mouse.move(tp[0], tp[1]); await page.mouse.down(); await page.mouse.move(tp[0], tp[1] - 400, { steps: 10 }); await page.mouse.up(); await wait(150);
  const pv = await J(() => window.__jkRuch.rig.vals.get(window.__jkRuch.defs.find(d => d.name === 'piston').id));
  ok(pv > 0.2 && pv <= 0.375 + 1e-9, 'pulled up, the piston slides out and stops at the end of its travel', pv.toFixed(3));

  // a part of his own: two cubes of the wheel, not its mudguard
  const opona = await onScreen(J, [10 / 16, 0.9, 0.25]);
  await page.keyboard.down('Control'); await page.mouse.click(opona[0], opona[1]); await page.keyboard.up('Control'); await wait(200);
  await J(new Function(`window.__jkRuch.pick(${meshOf('felga')}, true)`)); await wait(200);
  const cs = await J(() => ({ custom: window.__jkRuch.sel?.custom, n: window.__jkRuch.sel?.nodes.map(x => x.children[0]?.name), text: document.querySelector('.mt-ruch .rc-name')?.textContent }));
  ok(cs.custom && JSON.stringify(cs.n) === '["opona","felga"]' && /Twoja część: opona \+ 1/.test(cs.text), 'Ctrl+click gathers cubes into a part of his own (a real Ctrl+click, then one more)', JSON.stringify(cs));
  await page.locator('.mt-ruch button', { hasText: 'Obraca się' }).click(); await wait(300);
  const d3 = await J(() => window.__jkRuch.defs.find(d => d.name.startsWith('opona')));
  ok(d3 && d3.name === 'opona + 1' && JSON.stringify(d3.axis) === '[1,0,0]' && JSON.stringify(d3.pivot) === '[0.5625,0.625,0]', 'his part turns about its thinnest side, through its middle, named after his own cubes', JSON.stringify(d3));
  ok(await J(() => [...document.querySelectorAll('.mt-ruch .jk-tb')].some(b => /z pliku/.test(b.textContent)) === false), 'no "z pliku" pivot is offered for a part of loose cubes');
  // the group's own pivot from Blockbench is offered when it sits on the part (the wheel group's origin is its hub)
  await J(new Function(`window.__jkRuch.pick(${meshOf('blotnik')})`)); await wait(150);
  await page.locator('.mt-ruch button', { hasText: 'Obraca się' }).click(); await wait(200);
  const wz = await J(() => ({ part: window.__jkRuch.sel?.part?.name, file: [...document.querySelectorAll('.mt-ruch .jk-tb')].some(b => /z pliku/.test(b.textContent)) }));
  ok(wz.part === 'wheel' && wz.file, 'for a group of his file, its Blockbench pivot is offered ("z pliku") when it sits on the part', JSON.stringify(wz));
  // the wheel group overlaps his own part: it may move too (nested), but it cannot take the same cubes twice
  await page.locator('.mt-ruch button', { hasText: 'Stoi' }).click(); await wait(200);
  ok(await J(() => window.__jkRuch.defs.length === 3 && !window.__jkRuch.defs.some(d => d.name === 'wheel')), '"Stoi" takes the motion back');

  // the show: everything moves at once; the mudguard stays; stopping puts everything back exactly
  const guard0 = await J(new Function(`const m = ${meshOf('blotnik')}; m.updateMatrixWorld(true); return m.matrixWorld.elements.slice();`));
  await page.locator('.mt-ruch button', { hasText: 'Pokaż ruch' }).click();
  const all = await waitFor(J, () => { const v = [...window.__jkRuch.rig.vals.values()]; return v.length === 3 && v.every(x => Math.abs(x) > 0.01) ? v : null; }, null, 6000);
  ok(!!all, 'Pokaż ruch: all three parts move at once', JSON.stringify(all));
  const guard1 = await J(new Function(`const m = ${meshOf('blotnik')}; m.updateMatrixWorld(true); return m.matrixWorld.elements.slice();`));
  ok(guard0.every((v, i) => Math.abs(v - guard1[i]) < 1e-9), 'the mudguard, left out of his part, does not move');
  await shot('02-show');
  await page.locator('.mt-ruch button', { hasText: 'Zatrzymaj' }).click(); await wait(200);
  ok(poseDiff(rest0, await pose(J)) < 1e-12, 'Zatrzymaj: every part is back in its exact rest pose', String(poseDiff(rest0, await pose(J))));

  // kept on the material, for agents
  await J(() => window.__jkRuch.saved); await wait(300);
  const kept = await J(id => Jaskinia.materialy.ruch(id), mid);
  ok(kept?.jaskinia === 'ruch v1' && kept.parts.length === 3 && kept.parts.map(p => p.kind).join(',') === 'obrót,przesuw,obrót' && kept.parts[0].names[0].join('/') === 'gear' && kept.material.plik === 'mechanizm.bbmodel',
    'Jaskinia.materialy.ruch(id): the parts, kinds, axes and names in his file, for agents', JSON.stringify(kept?.parts?.map(p => [p.name, p.kind, p.axis, p.skad])));
  const rigd = await J(async id => {
    const o = await Jaskinia.materialy.object(id), r = await Jaskinia.materialy.rig(o, id);
    let zab = null; o.traverse(x => { if (x.isMesh && x.name === 'zab') zab = x; });
    const { THREE } = Jaskinia.swiat.three(); zab.geometry.computeBoundingBox();
    const at = v => { o.updateMatrixWorld(true); return v.clone().applyMatrix4(zab.matrixWorld); };
    const mid = zab.geometry.boundingBox.getCenter(new THREE.Vector3()), corner = zab.geometry.boundingBox.max.clone();
    const m0 = at(mid), c0 = at(corner); r.set('gear', Math.PI / 2); const m1 = at(mid), c1 = at(corner); r.rest(); const c2 = at(corner);
    return { parts: r.parts.map(p => p.name), mid: m1.distanceTo(m0), corner: c1.distanceTo(c0), back: c2.distanceTo(c0) };
  }, mid);
  ok(rigd.parts.length === 3 && rigd.mid < 1e-6 && rigd.corner > 0.3 && rigd.back < 1e-12, 'Jaskinia.materialy.rig drives a fresh copy: the gear turns about its own middle (the middle stays, a corner moves), rest() puts it back', JSON.stringify(rigd));
  const rigd2 = await J(async id => {
    const o = await Jaskinia.materialy.object(id), r = await Jaskinia.materialy.rig(o, id);
    let t = null; o.traverse(x => { if (x.isMesh && x.name === 'tlok') t = x; });
    const y = () => { o.updateMatrixWorld(true); return t.getWorldPosition(new (Jaskinia.swiat.three().THREE.Vector3)()).y; };
    const y0 = y(); r.set('piston', 0.25); const y1 = y(); r.rest();
    return y1 - y0;
  }, mid);
  ok(Math.abs(rigd2 - 0.25) < 1e-9, 'and a slide moves the piston by exactly what was asked (0.25 m of the file)', String(rigd2));
  const js = await J(() => window.__jkRuch.json());
  ok(js?.parts?.length === 3 && js.material.id && /kinematyka, nie fizyka/.test(js.co), 'the "Plik dla agentów" JSON says what it is and holds the same parts');

  // the agents window shows it in words
  await J(() => Jaskinia.ext.open('agenci')); await wait(900);
  ok(await J(() => [...document.querySelectorAll('.win[data-type="agenci"]')].some(w => /Ruch nadany przez Jozza: gear obraca się, piston przesuwa się, opona \+ 1 obraca się/.test(w.textContent))), '"Dla agentów" lists the motion he set, in words');
  await J(() => Jaskinia.ext.open('materialy')); await wait(400);

  // a reload: Ruch comes back on, with his three parts
  await page.reload(); await wait(1200);
  await waitFor(J, () => window.__jkRuch?.on && window.__jkRuch.defs.length === 3, null, 10000);
  const back = await J(() => ({ on: window.__jkRuch?.on, n: window.__jkRuch?.defs.length, badge: document.querySelector('.mt-ruchb .mt-n')?.textContent, chips: [...document.querySelectorAll('.rc-list .jk-chip')].map(b => b.textContent) }));
  ok(back.on && back.n === 3 && back.badge === '3' && back.chips.join('|') === 'gear|piston|opona + 1', 'after a reload Ruch is on again, with his three parts (and their count on the switch)', JSON.stringify(back));

  // an older build (v6.1, v6.2) writes a whole record from its memory and drops his motion: the mirror brings it back
  const rawRec = (J, id, strip) => J(async ([id, strip]) => {
    const db = await new Promise((res, rej) => { const rq = indexedDB.open('jaskinia-materialy', 1); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
    const n = await new Promise((res, rej) => {
      const tx = db.transaction('materialy', 'readwrite'), os = tx.objectStore('materialy'); let k = 0;
      const g = os.get(id); g.onsuccess = () => { const r = g.result; k = r?.ruch?.parts?.length || 0; if (strip && r) { delete r.ruch; os.put(r); } };
      tx.oncomplete = () => res(k); tx.onerror = () => rej(tx.error);
    });
    db.close(); return n;
  }, [id, strip]);
  ok(await rawRec(J, mid, true) === 3, 'the record holds his three parts before an older build rewrites it');
  await page.reload(); await wait(1200);
  const healed = await waitFor(J, () => window.__jkRuch?.on && window.__jkRuch.defs.length === 3 ? window.__jkRuch.defs.map(d => d.name).join('|') : null, null, 10000);
  ok(healed === 'gear|piston|opona + 1' && await rawRec(J, mid, false) === 3, 'a record rewritten without his motion gets it back from the mirror after a reload, kept in the record again', String(healed));

  // a new version of the file: his motion comes along by names, though every path moved
  await J(m => __JASK.matImport([{ name: 'mechanizm.bbmodel', blob: new Blob([JSON.stringify(m)]) }]), machine(true));
  await wait(500);
  await J(() => document.querySelector('.mt-tile[title="mechanizm"]')?.click());
  const carried = await waitFor(J, () => window.__jkRuch?.carried && window.__jkRuch.defs.length === 3 ? { c: window.__jkRuch.carried, nodes: window.__jkRuch.defs.map(d => d.nodes.join('+')), ver: document.querySelector('.mt-vers .on')?.textContent } : null, null, 8000);
  ok(carried && carried.c.from === 1 && carried.c.n === 3 && carried.nodes.join(' ') === '2 3 4.0+4.1' && carried.ver === 'v2', 'a new version of the file takes his motion along by names (every path moved by one)', JSON.stringify(carried));
  ok(await J(() => /Ruch przeniesiony z wersji 1: 3 z 3/.test(document.querySelector('.mt-ruch')?.textContent || '')), 'and says so');
  await J(() => window.__jkRuch.saved); await wait(300);
  const v2id = await J(async () => (await Jaskinia.materialy.list()).find(m => m.name === 'mechanizm')?.id);
  ok(v2id !== mid && (await J(id => Jaskinia.materialy.ruch(id), v2id))?.parts?.length === 3 && (await J(id => Jaskinia.materialy.ruch(id), mid))?.parts?.length === 3, 'v2 keeps its own copy; v1 keeps its own');
  await shot('03-v2');

  // Wejdź: inside, the parts stand where the file put them
  await page.locator('.mt-go').click(); await wait(500);
  ok(await J(() => !window.__jkRuch.on && !!window.__jkWalk), 'Wejdź turns Ruch off (inside, the model stands as in the file)');
  await J(() => window.__jkWalk?.end()); await wait(300);
  await ctx.close();
}

/* ---------- 1a. the first click guesses the part the way he builds wheels ----------
   A group holding a cube named Axis is one wheel with its shaft; a group inside it with an Axis of its own is another
   wheel and stays out; a group Blockbench named "group" by itself is passed over; an "Axis" that is a plate (16 by 15)
   gives its middle but not its direction. The model is made up for the test. */
const wheels = () => {
  const F = { north: { uv: [0, 0, 4, 4] }, south: { uv: [0, 0, 4, 4] }, east: { uv: [0, 0, 4, 4] }, west: { uv: [0, 0, 4, 4] }, up: { uv: [0, 0, 4, 4] }, down: { uv: [0, 0, 4, 4] } };
  const c = (uuid, name, from, to) => ({ uuid, name, type: 'cube', from, to, origin: [0, 0, 0], faces: F });
  return { meta: { format_version: '5.0', model_format: 'java_block', box_uv: false }, name: 'kola', resolution: { width: 16, height: 16 },
    elements: [c('a1', 'Axis', [7, -1, 1], [9, 1, 5]), c('g1', 'Gear', [4, -0.5, 2.5], [12, 0.5, 3.5]), c('a2', 'Axis', [11, -1, 7], [15, 1, 9]), c('g2', 'Gear', [12.5, -0.5, 4], [13.5, 0.5, 12]),
      c('a3', 'Axis', [3, 3, 18], [5, 5, 24]), c('t1', 'teeth', [0, 0, 20], [8, 8, 22]), c('p1', 'Axis', [0, 0, 30], [15, 2, 46]), c('p2', 'Top', [2, 2, 30], [13, 3, 46])],
    groups: [{ uuid: 'G1', name: 'zebatki', origin: [0, 0, 0] }, { uuid: 'G2', name: 'group', origin: [0, 0, 0] }, { uuid: 'G3', name: 'kolo', origin: [8, 8, 8] }, { uuid: 'G4', name: 'group', origin: [0, 0, 0] }, { uuid: 'G5', name: 'ogniwo', origin: [0, 0, 0] }],
    outliner: [{ uuid: 'G1', children: ['a1', 'g1', { uuid: 'G2', children: ['a2', 'g2'] }] }, { uuid: 'G3', children: ['a3', { uuid: 'G4', children: ['t1'] }] }, { uuid: 'G5', children: ['p1', 'p2'] }],
    textures: [] };
};
if (!ONLY || ONLY === 'ruch' || ONLY === 'guess') {
  const ctx = await context();
  const { J, wait } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await J(m => __JASK.matImport([{ name: 'kola.bbmodel', blob: new Blob([JSON.stringify(m)]) }]), wheels());
  await wait(500);
  await J(() => document.querySelector('.mt-tile[title="kola"]')?.click());
  await waitFor(J, () => !!window.__jkRuch?.inner && !!document.querySelector('.mt-ruchb'));
  await J(() => document.querySelector('.mt-ruchb').click()); await wait(150);
  const pickN = async (name, nth = 0) => { await J(([n, k]) => { const all = []; window.__jkRuch.inner.traverse(x => { if (x.isMesh && x.name === n) all.push(x); }); window.__jkRuch.pick(all[k]); }, [name, nth]); await wait(120); };
  const turn = async () => { await J(() => window.__jkRuch.kind('obrot')); await wait(150); return J(() => { const d = window.__jkRuch.sel.part; return { name: d.name, axis: d.axis, pivot: d.pivot.map(v => +(v * 16).toFixed(4)), z: d.z, zp: d.zp, n: d.nodes.length }; }); };
  await pickN('Gear', 0);
  const g1 = await J(() => ({ label: document.querySelector('.rc-name b')?.textContent, crumbs: [...document.querySelectorAll('.rc-crumb')].map(b => b.textContent).join('>'), n: window.__jkRuch.sel.nodes.map(x => x.children[0]?.name || x.name) }));
  ok(g1.label === 'zebatki' && JSON.stringify(g1.n) === '["Axis","Gear"]' && /zebatki/.test(g1.crumbs), 'a gear whose cubes sit loose beside another wheel\'s group: the click takes its own cubes with its Axis, named after the group', JSON.stringify(g1));
  const d1 = await turn();
  ok(JSON.stringify(d1.axis) === '[0,0,1]' && JSON.stringify(d1.pivot) === '[8,0,3]' && d1.z === 'klocek:Axis' && d1.n === 2, 'and it turns about that Axis', JSON.stringify(d1));
  await pickN('Gear', 1);
  const d2 = await turn();
  ok(d2.name === 'zebatki › group' && JSON.stringify(d2.axis) === '[1,0,0]' && JSON.stringify(d2.pivot) === '[13,0,8]' && d2.n === 1, 'the wheel inside, with its own Axis, is its own part: its whole group (named "group" by Blockbench, so his name goes in front)', JSON.stringify(d2));
  await pickN('teeth');
  const d3sel = await J(() => window.__jkRuch.sel.nodes.map(x => x.name));
  const d3 = await turn();
  ok(JSON.stringify(d3sel) === '["kolo"]' && d3.name === 'kolo' && JSON.stringify(d3.axis) === '[0,0,1]' && JSON.stringify(d3.pivot) === '[4,4,21]', 'teeth in a "group" beside the Axis: the click takes the whole wheel group, shaft and teeth together', JSON.stringify({ d3sel, d3 }));
  await pickN('Top');
  const d4 = await turn();
  ok(d4.name === 'ogniwo' && d4.z === 'bryla' && d4.zp === 'klocek:Axis' && JSON.stringify(d4.pivot) === '[7.5,1,38]', 'an "Axis" that is a plate (16 by 15) gives the pivot, not the direction', JSON.stringify(d4));
  ok(await J(() => ![...document.querySelectorAll('.mt-ruch .jk-tb')].some(b => /^z „Axis”$/.test(b.textContent))), 'and its direction is not offered as an axis');
  ok(await J(() => window.__jkRuch.defs.length === 4), 'four wheels set in motion, each its own part');
  await ctx.close();
}

/* ---------- 1c. a skinned glTF: Blockbench's export with groups as bones (his Box3D models are made that way) ----------
   One mesh, a tire and a socket bound to two bones, and two empty bones named Axis_Spin_A and _B on the axle line. The
   model is made up for the test. */
function skinnedWheel() {
  const box = (x0, x1, y0, y1, z0, z1) => { const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    return [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]].flatMap(t => t.map(i => p[i])); };
  const tire = box(-0.1, 0.1, 0, 1, -0.5, 0.5), sock = box(-0.3, -0.1, 0.4, 0.6, -0.1, 0.1);
  const pos = [...tire, ...sock], joints = [...tire.map(() => [1, 0, 0, 0]), ...sock.map(() => [2, 0, 0, 0])], weights = pos.map(() => [1, 0, 0, 0]);
  const T = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const ibm = [T(0, 0, 0), T(0, 0, 0), T(0, 0, 0), T(-0.2, -0.5, 0), T(0.2, -0.5, 0)];
  const f32 = a => Buffer.from(new Float32Array(a.flat(2)).buffer), u16 = a => Buffer.from(new Uint16Array(a.flat()).buffer);
  const parts = [f32(pos), u16(joints), f32(weights), f32(ibm)], offs = []; let o = 0;
  for (const b of parts) { offs.push(o); o += b.length; }
  const buf = Buffer.concat(parts), mn = [0, 1, 2].map(k => Math.min(...pos.map(v => v[k]))), mx = [0, 1, 2].map(k => Math.max(...pos.map(v => v[k])));
  return JSON.stringify({ asset: { version: '2.0', generator: 'jk64 test' }, scene: 0, scenes: [{ nodes: [5] }],
    nodes: [{ name: 'Wheel_root', children: [1, 2, 3, 4] }, { name: 'Tire' }, { name: 'Socket' }, { name: 'Axis_Spin_A', translation: [0.2, 0.5, 0] }, { name: 'Axis_Spin_B', translation: [-0.2, 0.5, 0] }, { name: 'Wheel', mesh: 0, skin: 0, children: [0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }], skins: [{ joints: [0, 1, 2, 3, 4], inverseBindMatrices: 3, skeleton: 0 }],
    buffers: [{ byteLength: buf.length, uri: 'data:application/octet-stream;base64,' + buf.toString('base64') }],
    bufferViews: parts.map((b, i) => ({ buffer: 0, byteOffset: offs[i], byteLength: b.length })),
    accessors: [{ bufferView: 0, componentType: 5126, count: pos.length, type: 'VEC3', min: mn, max: mx }, { bufferView: 1, componentType: 5123, count: pos.length, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: pos.length, type: 'VEC4' }, { bufferView: 3, componentType: 5126, count: 5, type: 'MAT4' }] });
}
if (!ONLY || ONLY === 'ruch' || ONLY === 'skin') {
  const ctx = await context();
  const { page, J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await J(t => __JASK.matImport([{ name: 'kolo.gltf', blob: new Blob([t]) }]), skinnedWheel());
  await wait(500);
  await J(() => document.querySelector('.mt-tile[title="kolo"]')?.click());
  await waitFor(J, () => !!window.__jkRuch?.inner && !!document.querySelector('.mt-ruchb'));
  ok(await J(() => { let s = 0; window.__jkRuch.inner.traverse(o => { if (o.isSkinnedMesh) s++; }); return s === 1; }), 'the model comes in as one skinned mesh with bones (as Blockbench exports groups as an armature)');
  await J(() => document.querySelector('.mt-ruchb').click()); await wait(200);
  const tp = await onScreen(J, [0.1, 0.8, 0.3]);
  await page.mouse.click(tp[0], tp[1]); await wait(300);
  const s1 = await J(() => ({ n: window.__jkRuch.sel?.nodes.map(x => x.name), bone: !!window.__jkRuch.sel?.nodes[0]?.isBone, crumbs: [...document.querySelectorAll('.rc-crumb')].map(b => b.textContent).join('>') }));
  ok(JSON.stringify(s1.n) === '["Tire"]' && s1.bone, 'a real click on the tire chooses its bone, not the whole mesh', JSON.stringify(s1));
  const rest0 = await pose(J);
  await page.locator('.mt-ruch button', { hasText: 'Obraca się' }).click(); await wait(300);
  const d = await J(() => window.__jkRuch.defs[0]);
  ok(d && d.axis.map(Math.abs).join(',') === '1,0,0' && JSON.stringify([d.pivot[1], d.pivot[2]]) === '[0.5,0]' && /^klocek:Axis_Spin/.test(d.z), 'the axis runs through the two empty Axis_Spin bones on the axle line', JSON.stringify(d));
  const vtx = () => J(() => { let m = null; window.__jkRuch.inner.traverse(o => { if (o.isSkinnedMesh) m = o; }); m.skeleton.update(); const { THREE } = Jaskinia.swiat.three(); const a = m.getVertexPosition(0, new THREE.Vector3()).toArray(), b = m.getVertexPosition(40, new THREE.Vector3()).toArray(); return { tire: a, sock: b }; });
  const v0 = await vtx();
  await page.locator('.mt-ruch button', { hasText: 'Pokaż ruch' }).click(); await wait(900);
  const v1 = await vtx();
  const moved = Math.hypot(...v1.tire.map((x, i) => x - v0.tire[i])), still = Math.hypot(...v1.sock.map((x, i) => x - v0.sock[i]));
  ok(moved > 0.05 && still < 1e-9, 'the tire turns with its bone; the socket, bound to another bone, stays', JSON.stringify({ moved, still }));
  await shot('06-skinned');
  await page.locator('.mt-ruch button', { hasText: 'Zatrzymaj' }).click(); await wait(200);
  ok(poseDiff(rest0, await pose(J)) < 1e-12, 'Zatrzymaj: the bones are back in their exact rest pose');
  const sb = await J(async () => { await window.__jkRuch.saved; const m = (await Jaskinia.materialy.list()).find(x => x.name === 'kolo'); return Jaskinia.materialy.ruch(m.id); });
  ok(sb?.parts?.[0]?.names?.[0]?.join('/') === 'Wheel/Wheel_root/Tire', 'kept for agents with its place in the file, bone by bone', JSON.stringify(sb?.parts?.[0]?.names));
  await ctx.close();
}

/* ---------- 1b. phone width: the panel sits above the bar, the stage stays usable ---------- */
if (!ONLY || ONLY === 'ruch' || ONLY === 'phone') {
  const ctx = await context({ viewport: { width: 390, height: 844 }, touch: true });
  const { J, wait, shot } = await tab(ctx);
  await J(() => Jaskinia.ext.open('materialy')); await wait(700);
  await J(m => __JASK.matImport([{ name: 'mechanizm.bbmodel', blob: new Blob([JSON.stringify(m)]) }]), machine(false));
  await wait(500);
  await J(() => document.querySelector('.mt-tile[title="mechanizm"]')?.click());
  await waitFor(J, () => !!window.__jkRuch?.inner && !!document.querySelector('.mt-ruchb'));
  await J(() => document.querySelector('.mt-ruchb').click()); await wait(200);
  await J(new Function(`window.__jkRuch.pick(${meshOf('zab')})`)); await wait(200);
  const lay = await J(() => { const p = document.querySelector('.mt-ruch').getBoundingClientRect(), v = document.querySelector('.mt-view').getBoundingClientRect(); return { pw: p.width, vw: v.width, inside: p.left >= v.left - 1 && p.right <= v.right + 1, scroll: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
  ok(lay.inside && lay.scroll && lay.pw <= lay.vw, 'on a phone the Ruch panel fits inside the stage and the page does not scroll sideways', JSON.stringify(lay));
  await shot('04-phone');
  await ctx.close();
}

/* ---------- 2. the works speak on his surfaces; the workshop's process waits on call ---------- */
if (!ONLY || ONLY === 'mowa') {
  const ctx = await context();
  const { J, wait, shot } = await tab(ctx);
  await J(() => __JASK.setSpace('granie')); await wait(1200);
  const shelf = await J(() => [...document.querySelectorAll('.win[data-type="zagraj"] .play-tile')].map(t => ({ name: t.querySelector('.pt-name')?.textContent, line: t.querySelector('.pt-sense')?.textContent || '', title: t.title, text: t.innerText })));
  const vaw = shelf.find(x => x.name === 'Voxel Aeronautics Workshop'), multi = shelf.find(x => x.name === 'MultiWorld');
  ok(shelf.length >= 5 && /^Warsztat maszyn budowanych blok po bloku/.test(vaw?.line || ''), 'each game on the "Do zagrania" shelf says what it is (VAW: a workshop of machines built block by block)', JSON.stringify(vaw));
  ok(/^Wspólny fizyczny świat/.test(multi?.line || ''), 'without repeating its own name in front of the sentence (MultiWorld)', multi?.line);
  ok(shelf.every(x => !/commit/i.test(x.text)) && shelf.every(x => /^ostatni commit /.test(x.title)), 'the shelf shows no commits; when it was last touched is there on hover');
  await J(() => __JASK.select('cloudflare-multiplayer-lab')); await wait(500);
  const card = await J(() => {
    const w = [...document.querySelectorAll('.win[data-type="gra"]')].find(x => x.querySelector('.jk-launch'));
    if (!w) return null;
    const d = w.querySelector('.jl-proc'), shown = [...w.querySelector('.jk-launch').children].filter(x => x !== d).map(x => x.innerText).join(' ');
    return { sense: w.querySelector('.jl-sense')?.textContent, open: d?.open, summary: d?.querySelector('summary')?.innerText, shown };
  });
  ok(card && /^Wspólny fizyczny świat/.test(card.sense) && !/commit|gałę|zrzutu/i.test(card.shown), 'the launch card speaks about the game; no commits, branches or snapshots in what it shows first', JSON.stringify(card));
  ok(card && card.open === false && /Z warsztatu agentów/.test(card.summary) && /ostatni commit/.test(card.summary), 'the workshop\'s process is folded under "Z warsztatu agentów", one click away', card?.summary);
  await shot('05-granie');
  await ctx.close();
}

ok(!errs.length, 'no errors in the console', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); SRV.close?.();
process.exit(fail ? 1 : 0);
