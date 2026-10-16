// Interaction test for Jaskinia: every gesture, checked against the layout state. node tools/jk_test.mjs [shotdir]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk');
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_test.html');
fs.writeFileSync(test, skel);
const SRV = await serve(path.dirname(test));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1918, height: 1030 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const J = fn => page.evaluate(fn);
const wait = ms => page.waitForTimeout(ms);
const shot = async n => { await page.screenshot({ path: path.join(shots, n + '.png') }); };
async function box(sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no box ' + sel); return b; }
async function dragPts(from, to, steps = 12, holdShot) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await wait(16); }
  if (holdShot) await shot(holdShot);
  await page.mouse.up(); await wait(250);
}
const winSel = type => `.win[data-type="${type}"]`;
const headOf = type => `${winSel(type)} .whead`;
async function headGrip(type) { const b = await box(`${winSel(type)} .wtype`); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
const treeStr = () => J(() => { const s = n => n.t === 'w' ? __JASK.L.wins[n.id].type : `${n.d}(${n.r.toFixed(2)}:${s(n.a)},${s(n.b)})`; return s(__JASK.L.tree); });

await page.goto(SRV.base + '/' + path.basename(test));
await wait(900); await J(() => document.fonts.ready); await wait(300);
// dismiss the first-run hint
await page.click('.jk-hint .ib'); await wait(100);
ok(errs.length === 0, 'load without errors', errs.join(' | '));
const t0 = await treeStr();
console.log('tree', t0);
ok(await page.locator('.win:not([hidden])').count() === 4, 'four windows in Przegląd');
ok(await page.locator('.jk-div').count() === 3, 'three borders');

// 1. border drag
const rowDiv = page.locator('.jk-div.jk-dv').first();
const dv = await rowDiv.boundingBox();
const mapW0 = (await box(winSel('mapa'))).width, katW0 = (await box(winSel('kataster'))).width;
await dragPts({ x: dv.x + dv.width / 2, y: dv.y + 300 }, { x: dv.x + dv.width / 2 - 300, y: dv.y + 300 }, 10, 'b01-border-drag-held');
await wait(300);
const mapW1 = (await box(winSel('mapa'))).width, katW1 = (await box(winSel('kataster'))).width;
ok(Math.abs((mapW0 - mapW1) - 300) <= 2 && Math.abs((katW1 - katW0) - 300) <= 2, 'border drag resizes both sides by 300px', `${mapW0}->${mapW1}, ${katW0}->${katW1}`);
await shot('b02-after-border-drag');
// minimum size respected
await dragPts({ x: dv.x - 300 + dv.width / 2, y: dv.y + 300 }, { x: 20, y: dv.y + 300 }, 10);
const mapWmin = (await box(winSel('mapa'))).width;
ok(mapWmin >= 168, 'border cannot squeeze a window below its minimum', 'map width ' + mapWmin);
// double click equalizes
await page.locator('.jk-div.jk-dv').first().dblclick({ position: { x: 5, y: 200 } }); await wait(300);
const rRoot = await J(() => __JASK.L.tree.r);
ok(Math.abs(rRoot - 0.5) < 0.001, 'double click on a border evens it out', rRoot);

// 2. carry Puls onto the right edge of Kataster
const kb = await box(winSel('kataster'));
await dragPts(await headGrip('puls'), { x: kb.x + kb.width - 30, y: kb.y + kb.height / 2 }, 14, 'b03-carry-puls-held');
const t2 = await treeStr();
ok(/row\(0\.50:kataster,puls\)/.test(t2), 'drop at right edge puts the window beside', t2);
await shot('b04-after-carry');
// 3. swap karta and mapa by dropping on the middle
const mb = await box(winSel('mapa'));
await dragPts(await headGrip('karta'), { x: mb.x + mb.width / 2, y: mb.y + mb.height / 2 }, 14, 'b05-swap-held');
const t3 = await treeStr();
ok(t3.indexOf('karta') < t3.indexOf('kataster') && t3.startsWith('row(0.50:karta') , 'drop in the middle swaps places', t3);
// 4. root edge: carry kataster to the very bottom of the screen
const st = await box('.jk-stage');
await dragPts(await headGrip('kataster'), { x: st.x + st.width / 2, y: st.y + st.height - 6 }, 14, 'b06-root-edge-held');
const t4 = await treeStr();
ok(/^col\(0\.70:.*,kataster\)$/.test(t4), 'drop at the outer edge runs along the whole screen', t4);
await shot('b07-after-root-edge');
// 5. undo all the way back, then redo one
for (let i = 0; i < 6; i++) { await page.keyboard.press('Control+z'); await wait(120); }
const t5 = await treeStr();
ok(t5 === t0, 'Ctrl+Z walks back to the start', t5);
await page.keyboard.press('Control+Shift+z'); await wait(200);
const t6 = await treeStr();
ok(t6 !== t0, 'Ctrl+Shift+Z redoes', t6);
await page.keyboard.press('Control+z'); await wait(200);

// 6. split the map, choose a type in the new window
await page.click(`${winSel('mapa')} .b-sr`); await wait(400);
ok(await page.locator(winSel('wybor')).count() === 1, 'split makes an empty window that asks what to show');
await shot('b08-split-chooser');
await page.click(`${winSel('wybor')} .ch-tile[data-type="statystyki"]`); await wait(600);
ok(await page.locator(`${winSel('statystyki')} .st-kpis`).count() === 1, 'choosing a tile turns it into that window');
// 7. change a window through its name
await page.click(`${winSel('statystyki')} .wtype`); await wait(200);
ok(await page.locator('.jk-menu.types').count() === 1, 'clicking the window name opens the list of what it can show');
await shot('b09-type-menu');
await page.locator('.jk-menu.types .mi', { hasText: 'Spis projektów' }).click(); await wait(400);
ok(await page.locator(`${winSel('spis')} .spis-b`).count() > 20, 'window now shows the outliner');
// 8. close and bring back
const n0 = await page.locator('.win:not([hidden])').count();
await page.click(`${winSel('spis')} .b-x`); await wait(300);
ok(await page.locator('.win:not([hidden])').count() === n0 - 1, 'close removes the window and its neighbour takes the room');
await page.keyboard.press('Control+z'); await wait(400);
ok(await page.locator(winSel('spis')).count() === 1, 'Ctrl+Z brings the closed window back');
await page.click(`${winSel('spis')} .b-x`); await wait(300);

// 9. maximize and back
await page.click(`${winSel('mapa')} .b-mx`); await wait(500);
const mx = await box(winSel('mapa')), stg = await box('.jk-stage');
ok(Math.abs(mx.width - stg.width) < 2 && Math.abs(mx.height - stg.height) < 2, 'maximize fills the screen', `${mx.width}x${mx.height}`);
await shot('b10-maximized');
await page.keyboard.press('Escape'); await wait(400);
ok(await J(() => __JASK.L.max) === null && (await box(winSel('mapa'))).width < stg.width - 100, 'Esc returns to the previous layout');
const kb2 = await box(winSel('kataster'));
await page.mouse.move(kb2.x + kb2.width / 2, kb2.y + kb2.height / 2);
await page.keyboard.press('Control+Space'); await wait(400);
ok(await J(() => __JASK.L.wins[__JASK.L.max]?.type) === 'kataster', 'Ctrl+Space maximizes the window under the mouse');
await page.keyboard.press('Control+Space'); await wait(400);
ok(await J(() => __JASK.L.max) === null, 'Ctrl+Space again goes back');
await page.dblclick(`${headOf('puls')} .wctx`, { position: { x: 60, y: 12 } }); await wait(400);
ok(await J(() => __JASK.L.wins[__JASK.L.max]?.type) === 'puls', 'double click on the bar maximizes');
await page.click(`${winSel('puls')} .wback`); await wait(400);
ok(await J(() => __JASK.L.max) === null, '„Wróć do układu” returns');

// 10. zoom one window with Ctrl+wheel
const kr = await box(winSel('karta'));
await page.mouse.move(kr.x + kr.width / 2, kr.y + kr.height / 2);
await page.keyboard.down('Control');
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -100); await wait(40); }
await page.keyboard.up('Control'); await wait(400);
const zk = await J(() => Object.values(__JASK.L.wins).find(w => w.type === 'karta').z);
const zoomCss = await page.locator(`${winSel('karta')} .wz`).evaluate(el => el.style.zoom);
ok(zk > 1.2 && Math.abs(+zoomCss - zk) < 0.01, 'Ctrl+wheel zooms only that window', `z=${zk} css=${zoomCss}`);
ok(await J(() => Object.values(__JASK.L.wins).find(w => w.type === 'mapa').z) === 1, 'other windows keep their zoom');
await shot('b11-zoomed-card');
await page.click(`${winSel('karta')} .wzv`); await wait(300);
ok(await J(() => Object.values(__JASK.L.wins).find(w => w.type === 'karta').z) === 1, 'click on the percent returns to 100%');

// 11. float kataster, move it, stretch it from two corners, dock it with the five squares
await page.click(`${winSel('kataster')} .b-fl`); await wait(400);
ok(await J(() => __JASK.L.floats.length) === 1 && await page.locator(`${winSel('kataster')}.float`).count() === 1, 'float button lifts the window above the rest');
await shot('b12-floating');
const f0 = await box(winSel('kataster'));
await dragPts(await headGrip('kataster'), { x: (await headGrip('kataster')).x - 340, y: (await headGrip('kataster')).y + 90 }, 10);
const f1 = await box(winSel('kataster'));
ok(Math.abs(f1.x - f0.x + 340) <= 2 && Math.abs(f1.y - f0.y - 90) <= 2, 'floating window moves with its bar', `${f0.x},${f0.y} -> ${f1.x},${f1.y}`);
const se = await box(`${winSel('kataster')} .fh-se`);
await dragPts({ x: se.x + se.width / 2, y: se.y + se.height / 2 }, { x: se.x + se.width / 2 + 120, y: se.y + se.height / 2 + 70 }, 8);
const f2 = await box(winSel('kataster'));
ok(Math.abs(f2.width - f1.width - 120) <= 2 && Math.abs(f2.height - f1.height - 70) <= 2, 'stretch from the bottom-right corner', `${f1.width}x${f1.height} -> ${f2.width}x${f2.height}`);
const nw = await box(`${winSel('kataster')} .fh-nw`);
await dragPts({ x: nw.x + nw.width / 2, y: nw.y + nw.height / 2 }, { x: nw.x + nw.width / 2 - 60, y: nw.y + nw.height / 2 - 40 }, 8);
const f3 = await box(winSel('kataster'));
ok(Math.abs(f3.x - (f2.x - 60)) <= 2 && Math.abs(f3.width - f2.width - 60) <= 2 && Math.abs(f3.height - f2.height - 40) <= 2, 'stretch from the top-left corner', `${f2.x},${f2.width}x${f2.height} -> ${f3.x},${f3.width}x${f3.height}`);
const wEdge = await box(`${winSel('kataster')} .fh-w`);
await dragPts({ x: wEdge.x + wEdge.width / 2, y: wEdge.y + wEdge.height / 2 }, { x: wEdge.x + wEdge.width / 2 + 50, y: wEdge.y + wEdge.height / 2 }, 6);
const f4 = await box(winSel('kataster'));
ok(Math.abs(f4.width - (f3.width - 50)) <= 2, 'stretch from the left edge', `${f3.width} -> ${f4.width}`);
await shot('b13-floating-moved');
// dock with the compass on the map: hover centre-left square
const mb2 = await box(winSel('mapa'));
const g = await headGrip('kataster');
const cx = mb2.x + mb2.width / 2, cy = mb2.y + mb2.height / 2;
await page.mouse.move(g.x, g.y); await page.mouse.down();
for (let i = 1; i <= 14; i++) { await page.mouse.move(g.x + (cx - 42 - g.x) * i / 14, g.y + (cy - g.y) * i / 14); await wait(16); }
await wait(100);
ok(await page.locator('.jk-compass:not([hidden])').count() === 1, 'five squares appear over the window beneath');
await shot('b14-compass-held');
await page.mouse.up(); await wait(400);
const t7 = await treeStr();
ok(await J(() => __JASK.L.floats.length) === 0 && /row\(0\.50:kataster,mapa\)/.test(t7), 'dropping on the left square docks it left of the map', t7);
// float and dock back to exactly where it was
const before8 = await treeStr();
await page.click(`${winSel('karta')} .b-fl`); await wait(300);
await page.click(`${winSel('karta')} .b-fl`); await wait(300);
ok(await treeStr() === before8, 'float then „wstaw z powrotem” returns it exactly where it was', await treeStr());

// 12. selection follows, pin holds
await page.click(`${winSel('mapa')} .parcel[data-repo="Tysi-c-The-Game"]`, { force: true }); await wait(500);
ok(await J(() => __JASK.store.sel) === 'Tysi-c-The-Game', 'click on a parcel selects the project');
ok((await page.locator(`${winSel('karta')} .card-h h1`).textContent()) === 'Tysiąc', 'project card follows the selection');
await page.click(`${winSel('karta')} .jk-pin`); await wait(300);
await page.click(`${winSel('mapa')} .parcel[data-repo="Combat-Lab"]`, { force: true }); await wait(500);
ok((await page.locator(`${winSel('karta')} .card-h h1`).textContent()) === 'Tysiąc' && await J(() => __JASK.store.sel) === 'Combat-Lab', 'pinned card stays while the selection moves on');
await shot('b15-pinned');
await page.click(`${winSel('karta')} .jk-pin`); await wait(400);
ok((await page.locator(`${winSel('karta')} .card-h h1`).textContent()) === 'Combat Lab', 'unpinned card catches up with the selection');
// kataster row click selects
await page.click(`${winSel('kataster')} .krow[data-repo="ReflexBrain-Lab"] .khead`); await wait(400);
ok(await J(() => __JASK.store.sel) === 'ReflexBrain-Lab', 'click on a kataster row selects the project');

// 13. workspaces
await page.click('.jk-tab[data-sp="statystyki"]'); await wait(900);
ok(await page.locator('.win:not([hidden]) .st-chart').count() === 1 && await page.locator('.win:not([hidden])[data-type="ranking"] .st-tbl').count() === 1, 'Statystyki workspace shows its windows');
await shot('b16-stats-space');
await page.locator('.win[data-type="wykres"] .jk-seg button', { hasText: '7 dni' }).click(); await wait(700);
const kp = await page.locator('.win[data-type="wykres"] .st-kpi b').nth(1).textContent();
ok(/z 7$/.test(kp), 'range 7 days applies', kp);
const rk = await page.locator('.win[data-type="ranking"] .st-tbl thead th').nth(4).textContent();
ok(/7 dni/.test(rk), 'all stats windows in the workspace share the range', rk);
await shot('b17-stats-7d');
await page.click('.jk-tab[data-sp="przeglad"]'); await wait(500);
ok(await page.locator('.win:not([hidden])').count() === 4, 'back to Przegląd with its windows as they were');
// new, rename, delete
await page.click('.jk-tab-add'); await wait(200);
await page.locator('.jk-menu .mi', { hasText: 'Pusty' }).click(); await wait(500);
ok(await J(() => __JASK.store.spaces.length) === 6 && await page.locator('.win:not([hidden])[data-type="wybor"]').count() === 1, 'plus makes a new empty layout');
await page.locator('.jk-tab.on').dblclick(); await wait(150);
await page.keyboard.press('Control+a'); await page.keyboard.type('Moja jaskinia'); await page.keyboard.press('Enter'); await wait(200);
ok((await page.locator('.jk-tab.on').textContent()) === 'Moja jaskinia', 'double click renames a layout');
await page.locator('.jk-tab.on').click({ button: 'right' }); await wait(200);
await page.locator('.jk-menu .mi', { hasText: 'Usuń układ' }).click(); await wait(400);
await shot('b18-deleted-to-trash');
ok(await J(() => __JASK.store.spaces.length) === 5 && await J(() => __JASK.store.trash.some(x => x.kind === 'space' && x.name === 'Moja jaskinia')), 'delete moves the layout to the trash');
// reorder tabs: drag Ściana to the front
const curBefore = await J(() => __JASK.store.cur);
const tS = await box('.jk-tab[data-sp="sciana"]'), tP = await box('.jk-tab[data-sp="przeglad"]');
await dragPts({ x: tS.x + tS.width / 2, y: tS.y + tS.height / 2 }, { x: tP.x + 4, y: tP.y + tP.height / 2 }, 12);
ok(await J(() => __JASK.store.spaces[0].id) === 'sciana' && await J(() => __JASK.store.cur) === curBefore, 'dragging a tab reorders without switching', await J(() => __JASK.store.spaces.map(s => s.id).join(',')));

// 14. the wall: move a card, size a card, undo (v2: world places, one resize corner on the picked card)
await page.click('.jk-tab[data-sp="sciana"]'); await wait(900);
await shot('b19-wall');
const wallSt = () => J(() => JSON.parse(JSON.stringify(Object.values(__JASK.L.wins).find(w => w.type === 'sciana').st.cards)));
const w0 = await wallSt();
const CARD = 'Tysi-c-The-Game';
const card = page.locator(`.wall2 .wc[data-repo="${CARD}"]`);
const cb = await card.boundingBox();
await dragPts({ x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 }, { x: cb.x + cb.width / 2 - 260, y: cb.y + cb.height / 2 + 120 }, 12, 'b20-wall-drag-held');
await wait(400);
const w1 = await wallSt();
ok(w1[CARD].x < w0[CARD].x - 50 && !w1[CARD].w, 'moving a card on the wall keeps it where dropped', `${w0[CARD].x} -> ${w1[CARD].x}`);
await page.locator('.wall2 .wc[data-repo="Combat-Lab"]').click(); await wait(250);
const hb = await box('.w2-handle');
await dragPts({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, { x: hb.x + hb.width / 2 + 160, y: hb.y + hb.height / 2 + 120 }, 12, 'b21-wall-size-held');
await wait(400);
const w2 = await wallSt();
ok(!!w2['Combat-Lab'].w, 'pulling the corner sizes the card by hand', JSON.stringify(w2['Combat-Lab']));
await shot('b22-wall-after');
await page.keyboard.press('Control+z'); await wait(500); await page.keyboard.press('Control+z'); await wait(500);
const w3 = await wallSt();
ok(!w3['Combat-Lab'].w && Math.abs(w3[CARD].x - w0[CARD].x) < 0.5, 'Ctrl+Z undoes card moves too');

// 15. reload keeps everything
await page.click('.jk-tab[data-sp="przeglad"]'); await wait(400);
const beforeReload = await J(() => JSON.stringify({ cur: __JASK.store.cur, sel: __JASK.store.sel, order: __JASK.store.spaces.map(s => s.id), tree: __JASK.L.tree, types: Object.values(__JASK.L.wins).map(w => w.type).sort() }));
await wait(400);
await page.reload(); await wait(1200);
const afterReload = await J(() => JSON.stringify({ cur: __JASK.store.cur, sel: __JASK.store.sel, order: __JASK.store.spaces.map(s => s.id), tree: __JASK.L.tree, types: Object.values(__JASK.L.wins).map(w => w.type).sort() }));
ok(beforeReload === afterReload, 'after reload the layouts are exactly as left');
ok(errs.length === 0, 'no errors during the whole run', errs.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
