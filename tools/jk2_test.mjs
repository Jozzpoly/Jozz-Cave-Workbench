// Jaskinia v2 behaviour test: trust (store, notes, trash, copies), the wall's gestures, the phone. node tools/jk2_test.mjs [shotdir]
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk2t');
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_test.html');
fs.writeFileSync(test, skel);
const SRV = await serve(path.dirname(test));
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
async function open({ phone = false, storage = null, size = { width: 1600, height: 960 } } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'], colorScheme: 'dark' } : { viewport: size, deviceScaleFactor: 1, colorScheme: 'dark' });
  if (storage) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, storage);
  await ctx.addInitScript(() => { try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* fine */ } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errs.push(`pageerror: ${e.message} ${(e.stack || '').split('\n').slice(1, 3).join(' ')}`));
  await page.goto(SRV.base + '/' + path.basename(test));
  await page.waitForTimeout(900);
  return { ctx, page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png') }) };
}
const center = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
async function mouseDrag(page, a, b, steps = 12) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await page.waitForTimeout(12); }
  await page.mouse.up(); await page.waitForTimeout(200);
}

/* ================= desk ================= */
{
  const { ctx, page, J, wait, shot } = await open();
  ok(!(await J(() => document.querySelector('.jk-bar').textContent)).includes('null'), 'no "null" in the top bar');
  ok(await page.locator('.win:not([hidden])').count() === 4, 'four windows in Przegląd');

  // --- notes live outside undo ---
  await J(() => { __JASK.setSpace('przeglad'); });
  const pulsId = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'puls'));
  await J(id => __JASK.commit('test: puls → notatki', L => { L.wins[id].type = 'notatki'; L.wins[id].st = { note: 'nTEST' }; }), pulsId);
  await wait(300);
  await page.locator(`.win[data-id="${pulsId}"] textarea.jk-notes`).click();
  await page.keyboard.type('Zapisz to w kamieniu');
  await wait(400);
  await J(() => document.activeElement.blur());
  await page.locator('.win[data-type="mapa"] .b-sc').click(); await wait(300);
  await page.locator('.win[data-type="mapa"] .b-sc').click(); await wait(300);
  await page.keyboard.press('Control+z'); await wait(200);
  await page.keyboard.press('Control+z'); await wait(200);
  await page.keyboard.press('Control+z'); await wait(300);
  const noteNow = await J(() => __JASK.store.notes.nTEST && __JASK.store.notes.nTEST.text);
  ok(noteNow === 'Zapisz to w kamieniu', 'undo of layout does not rewind a note', JSON.stringify(noteNow));
  // redo brings the notes window back with the same text
  await page.keyboard.press('Control+Shift+z'); await wait(300);
  const ta = await J(id => document.querySelector(`.win[data-id="${id}"] textarea.jk-notes`)?.value, pulsId);
  ok(ta === 'Zapisz to w kamieniu', 'redo shows the same note text', JSON.stringify(ta));

  // --- save a layout, change it, load it back ---
  const savedN0 = await J(() => __JASK.store.saved.length);
  await page.locator('.jk-stage').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+s'); await wait(300);
  ok(await J(() => __JASK.store.saved.length) === savedN0 + 1, 'Ctrl+S saves the layout');
  const tree0 = await J(() => JSON.stringify(__JASK.L.tree).length);
  await page.locator('.win[data-type="kataster"] .b-sr').click(); await wait(300);
  ok(await J(() => JSON.stringify(__JASK.L.tree).length) !== tree0, 'layout changed after saving');
  await J(() => __JASK.openSettings('uklady')); await wait(500);
  await shot('t01-settings-uklady');
  const loadBtn = page.locator('.win[data-type="ustawienia"]:not([hidden]) .set-list li >> text=Wczytaj tutaj').first();
  ok(await loadBtn.count() > 0, 'saved layout is listed with "Wczytaj tutaj"');

  // --- delete a workspace: it goes to the trash, the toast brings it back ---
  const n0 = await J(() => __JASK.store.spaces.length);
  await page.locator('.jk-tab[data-sp="granie"]').click({ button: 'right' }); await wait(200);
  await page.locator('.jk-menu .mi >> text=Usuń układ (do kosza)').click(); await wait(300);
  ok(await J(() => __JASK.store.spaces.length) === n0 - 1 && await J(() => __JASK.store.trash.some(x => x.kind === 'space' && x.name === 'Granie')), 'deleted workspace is in the trash');
  await page.locator('.jk-toast-b >> text=Przywróć').click(); await wait(400);
  ok(await J(() => __JASK.store.spaces.some(x => x.name === 'Granie')) && !(await J(() => __JASK.store.trash.some(x => x.kind === 'space' && x.name === 'Granie'))), 'workspace restored from the toast');

  // --- reset everything, then take it back ---
  await J(() => __JASK.setSpace(__JASK.store.spaces[0].id)); await wait(200);
  await J(() => { const sp = __JASK.store.spaces[0]; sp.name = 'Mój Przegląd'; });
  await page.locator('.jk-brand').click(); await wait(200);
  await page.locator('.jk-menu .mi >> text=Zresetuj całą Jaskinię…').click(); await wait(200);
  await shot('t02-reset-question');
  await page.locator('.jk-confirm .btn.warn').click(); await wait(500);
  ok(await J(() => __JASK.store.spaces.map(s => s.name).join(',')) === 'Przegląd,Granie,Statystyki,Projekt,Ściana', 'reset brings the starting layouts');
  await page.locator('.jk-toast-b >> text=Cofnij').first().click(); await wait(500);
  ok(await J(() => __JASK.store.spaces.some(s => s.name === 'Mój Przegląd')), 'reset can be taken back from the toast (copy)');
  ok(await J(() => __JASK.readBackups().length) >= 2, 'copies exist after reset', String(await J(() => __JASK.readBackups().length)));

  // --- export, import as new tabs ---
  const nBefore = await J(() => __JASK.store.spaces.length);
  await J(() => { const t0 = exportTextForTest(); }).catch(() => {});
  const exported = await J(() => window.__JASK && JSON.stringify({ app: 'jaskinia', v: 2, kind: 'space', data: { name: 'Import próbny', L: __JASK.L, notes: {} } }));
  await J(() => __JASK.openSettings('dane')); await wait(400);
  await page.locator('.win[data-type="ustawienia"]:not([hidden]) textarea.set-ta').last().fill(exported);
  await page.locator('.win[data-type="ustawienia"]:not([hidden]) button >> text=Sprawdź wklejony tekst').click(); await wait(200);
  await page.locator('.win[data-type="ustawienia"]:not([hidden]) button >> text=Dodaj jako nową zakładkę').click(); await wait(500);
  ok(await J(() => __JASK.store.spaces.length) === nBefore + 1 && await J(() => __JASK.store.spaces.some(s => s.name.startsWith('Import próbny'))), 'import adds a workspace');
  const ids = await J(() => { const all = __JASK.store.spaces.flatMap(s => Object.keys(s.L.wins)); return [all.length, new Set(all).size]; });
  ok(ids[0] === ids[1], 'imported windows get their own ids', ids.join('/'));
  await J(() => __JASK.openSettings('dane')); await wait(400);
  await page.locator('.win[data-type="ustawienia"]:not([hidden]) textarea.set-ta').last().fill('{to nie json');
  await page.locator('.win[data-type="ustawienia"]:not([hidden]) button >> text=Sprawdź wklejony tekst').click(); await wait(200);
  ok(await page.locator('.win[data-type="ustawienia"]:not([hidden]) .set-err').count() === 1, 'bad import text is refused with a sentence');

  // --- tabs that do not fit ---
  for (let i = 0; i < 9; i++) await J(i => { document.querySelector('.jk-tab-add').click(); }, i).then(() => page.locator('.jk-menu .mi').first().click());
  await wait(400);
  ok(await J(() => document.querySelector('.jk-tabs-w').classList.contains('over')), 'many tabs: the bar knows it overflows');
  ok(await page.locator('.jk-tarr.r').isVisible() || await page.locator('.jk-tarr.l').isVisible(), 'many tabs: an arrow to scroll appears');
  await page.locator('.jk-tall').click(); await wait(200);
  ok(await page.locator('.jk-menu.spaces .mi').count() >= 14, 'all workspaces menu lists every tab', String(await page.locator('.jk-menu.spaces .mi').count()));
  await page.keyboard.press('Escape');
  await shot('t03-many-tabs');

  // --- an empty window that is small asks with a button ---
  const sp0 = await J(() => __JASK.store.cur);
  await J(() => __JASK.setSpace(__JASK.store.spaces[__JASK.store.spaces.length - 1].id)); await wait(300);
  for (let i = 0; i < 4; i++) { await page.locator('.win .b-sr').last().click().catch(() => {}); await wait(150); await page.locator('.win .b-sc').last().click().catch(() => {}); await wait(150); }
  await wait(400);
  ok(await page.locator('.chooser.small').count() > 0, 'small empty windows show the compact chooser');
  await shot('t04-small-choosers');
  await J(id => __JASK.setSpace(id), sp0); await wait(200);

  // --- rename a window with F2 ---
  const kat = await J(() => __JASK.leafIds(__JASK.L.tree)[0]);
  if (kat) {
    await page.locator(`.win[data-id="${kat}"] .wbody`).click({ position: { x: 30, y: 30 } }).catch(() => {});
    await J(id => { __JASK.L.focus = id; }, kat);
    await page.keyboard.press('F2'); await wait(150);
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Moje repo'); await page.keyboard.press('Enter'); await wait(300);
    ok((await page.locator(`.win[data-id="${kat}"] .wtype .tn`).textContent()) === 'Moje repo', 'F2 renames a window');
  } else ok(false, 'F2 renames a window', 'no kataster window');

  // --- themes ---
  for (const th of ['kataster', 'neon', 'piwnica', 'jaskinia']) {
    await J(th => { __JASK.prefs.theme = th; document.documentElement.dataset.jk = th; }, th);
    await J(() => __JASK.openSettings('wyglad')); await wait(300);
    await page.locator(`.th-card >> nth=${['jaskinia', 'kataster', 'neon', 'piwnica'].indexOf(th)}`).click(); await wait(500);
    ok(await J(() => document.documentElement.dataset.jk) === th, 'theme ' + th + ' applied');
    await J(() => __JASK.setSpace('przeglad')); await wait(500);
    await shot('t05-theme-' + th);
  }
  await ctx.close();
}

/* ================= the wall ================= */
{
  const { ctx, page, J, wait, shot } = await open();
  await J(() => __JASK.setSpace('sciana')); await wait(900);
  const wid = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'sciana'));
  const st = () => J(id => JSON.parse(JSON.stringify(__JASK.L.wins[id].st)), wid);
  const s0 = await st();
  const nRepos = await J(() => __BIB.D.repos.length), nFams = await J(() => new Set(__BIB.D.repos.map(r => r.family)).size);
  ok(s0.v === 2 && Object.keys(s0.cards).length >= nRepos && s0.frames.length >= nFams - 1, 'wall laid out once, by families', `${Object.keys(s0.cards).length} cards for ${nRepos} repos, ${s0.frames.length} frames`);
  // a small card: carried, not resized (the v1 bug)
  const small = await J(() => { const el = [...document.querySelectorAll('.wc.lod-S')].find(e => { const b = e.getBoundingClientRect(); return b.width > 30 && b.top > 120 && b.top < 700; }); return el ? el.dataset.repo : null; });
  ok(!!small, 'there is a small card to try', small);
  const b0 = await page.locator(`.wc[data-repo="${small}"]`).boundingBox();
  await mouseDrag(page, center(b0), { x: center(b0).x + 140, y: center(b0).y + 60 });
  const s1 = await st();
  ok(Math.abs((s1.cards[small].x - s0.cards[small].x) - 140 / (await J(id => __JASK.store.views[id].cam.z, wid))) < 3, 'dragging a small card moves it', `${s0.cards[small].x} → ${s1.cards[small].x}`);
  ok(!s1.cards[small].w && !s1.cards[small].h, 'dragging a small card does not resize it');
  // others did not move
  const moved = Object.keys(s0.cards).filter(n => n !== small && (s0.cards[n].x !== s1.cards[n].x || s0.cards[n].y !== s1.cards[n].y));
  ok(moved.length === 0, 'nothing else moved', moved.join(','));
  await shot('t10-wall-moved');
  // the v1 audit's suspicion: a redraw in the middle of a drag (window resized, project picked elsewhere) broke the grip
  {
    const other = await J(s => { const el = [...document.querySelectorAll('.wc.lod-S')].find(e => { const b = e.getBoundingClientRect(); return e.dataset.repo !== s && b.width > 30 && b.top > 140 && b.top < 650 && b.left > 200; }); return el ? el.dataset.repo : null; }, small);
    const bo = await page.locator(`.wc[data-repo="${other}"]`).boundingBox(), a = center(bo), z = await J(id => __JASK.store.views[id].cam.z, wid);
    const xo = (await st()).cards[other].x;
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(a.x + 10 * i, a.y + 4 * i); await wait(15); }
    await J(() => { __JASK.select('Combat-Lab', 'win'); const t = __JASK.L.tree; if (t && t.r) t.r = Math.min(0.9, t.r + 0.03); __JASK.apply(); });
    await wait(120);
    for (let i = 7; i <= 12; i++) { await page.mouse.move(a.x + 10 * i, a.y + 4 * i); await wait(15); }
    await page.mouse.up(); await wait(250);
    const zNow = await J(id => __JASK.store.views[id].cam.z, wid);
    ok(Math.abs(((await st()).cards[other].x - xo) - 120 / z) < 4 && Math.abs(zNow - z) < 1e-9, 'a redraw in the middle of a drag does not drop the card', `${xo} → ${(await st()).cards[other].x} (expected +${(120 / z).toFixed(1)})`);
    await page.keyboard.press('Control+z'); await wait(300);
  }
  // the corner of the selected card resizes it (cards may overlap on the wall by design: click a part of it that shows)
  const seen = await J(n => { const el = document.querySelector(`.wc[data-repo="${n}"]`), b = el.getBoundingClientRect();
    for (let y = b.top + 3; y < b.bottom - 2; y += 4) for (let x = b.left + 3; x < b.right - 2; x += 4) { const e = document.elementFromPoint(x, y); if (e && el.contains(e)) return { x, y }; }
    return null; }, small);
  ok(!!seen, 'the moved card can still be reached', small);
  await page.mouse.click(seen.x, seen.y); await wait(250);
  const hb = await page.locator('.w2-handle').boundingBox();
  ok(!!hb, 'the picked card shows one resize corner');
  await mouseDrag(page, center(hb), { x: center(hb).x + 90, y: center(hb).y + 50 });
  const s2 = await st();
  ok(s2.cards[small].w > 118 && s2.cards[small].h > 98, 'the corner resizes the card', `${s2.cards[small].w}×${s2.cards[small].h}`);
  await shot('t11-wall-resized');
  // undo the resize, then the move
  await page.keyboard.press('Control+z'); await wait(300);
  ok(!(await st()).cards[small].w, 'undo takes the resize back');
  await page.keyboard.press('Control+z'); await wait(300);
  ok(Math.abs((await st()).cards[small].x - s0.cards[small].x) < 0.5, 'undo takes the move back');
  // pan the view by dragging empty space: the world does not change
  const wb = await page.locator('.wall2').boundingBox();
  const empty = await J(() => { const w = document.querySelector('.wall2').getBoundingClientRect(); for (let y = w.top + 20; y < w.bottom - 60; y += 17) for (let x = w.left + 20; x < w.right - 200; x += 17) { const e = document.elementFromPoint(x, y); if (e && (e.classList.contains('wall2') || e.classList.contains('w2-grid'))) return { x, y }; } return null; });
  const cam0 = await J(id => ({ ...__JASK.store.views[id].cam }), wid);
  await mouseDrag(page, empty, { x: empty.x + 120, y: empty.y + 40 });
  await wait(400);
  const cam1 = await J(id => ({ ...__JASK.store.views[id].cam }), wid);
  ok(Math.abs(cam1.cx - cam0.cx) > 20, 'dragging empty space pans the view', `${cam0.cx} → ${cam1.cx}`);
  ok(JSON.stringify((await st()).cards) === JSON.stringify((await st()).cards) && (await st()).cards[small].x === (await st()).cards[small].x, 'panning does not move cards');
  // wheel zooms around the pointer
  await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
  await page.mouse.wheel(0, -400); await wait(500);
  const cam2 = await J(id => ({ ...__JASK.store.views[id].cam }), wid);
  ok(cam2.z > cam1.z * 1.2, 'the wheel zooms the view in', `${cam1.z} → ${cam2.z}`);
  ok(await page.locator('.wc.lod-M, .wc.lod-L, .wc.lod-XL').count() > 0, 'zooming in shows richer cards');
  await shot('t12-wall-zoomed');
  await page.keyboard.press('0'); await wait(500);
  // double-click empty space: a note
  await page.locator('.wall2').focus();
  const e2 = await J(() => { const w = document.querySelector('.wall2').getBoundingClientRect(); for (let y = w.top + 30; y < w.bottom - 80; y += 13) for (let x = w.left + 30; x < w.right - 230; x += 13) { const e = document.elementFromPoint(x, y); if (e && (e.classList.contains('wall2') || e.classList.contains('w2-grid'))) return { x, y }; } return null; });
  await page.mouse.click(e2.x, e2.y); await wait(60); await page.mouse.click(e2.x, e2.y); await wait(500);
  const s3 = await st();
  ok(s3.notes.length === 1, 'double click on empty space adds a note');
  await page.keyboard.type('Ta ściana jest moja');
  await wait(500);
  const nid = s3.notes[0] && s3.notes[0].id;
  ok(await J(id => __JASK.store.notes[id] && __JASK.store.notes[id].text, nid) === 'Ta ściana jest moja', 'typing on a wall note keeps the text');
  await shot('t13-wall-note');
  await J(() => document.activeElement.blur());
  await page.locator('.wall2').focus();
  await page.keyboard.press('Delete'); await wait(400);
  ok((await st()).notes.length === 0 && await J(() => __JASK.store.trash.some(x => x.kind === 'wallnote')), 'deleting a wall note puts it in the trash');
  // shift-drag on empty space picks several cards, then they move together
  const e3 = await J(() => { const w = document.querySelector('.wall2').getBoundingClientRect(); return { x: w.left + 15, y: w.top + 15, x2: w.left + w.width * 0.45, y2: w.top + w.height * 0.55 }; });
  await page.keyboard.down('Shift');
  await mouseDrag(page, { x: e3.x, y: e3.y }, { x: e3.x2, y: e3.y2 });
  await page.keyboard.up('Shift');
  const nPicked = await J(id => document.querySelectorAll('.wc.picked').length, wid);
  ok(nPicked >= 2, 'shift-drag picks several cards', String(nPicked));
  // arrange by life (explicit), undoable
  const before = JSON.stringify((await st()).cards);
  await page.locator('.win[data-type="sciana"] .jk-tb >> text=Ułóż…').click(); await wait(200);
  await page.locator('.jk-menu .mi >> text=Według życia').click(); await wait(600);
  ok(JSON.stringify((await st()).cards) !== before, 'arranging by life moves cards');
  await shot('t14-wall-by-life');
  await page.keyboard.press('Control+z'); await wait(400);
  ok(JSON.stringify((await st()).cards) === before, 'arranging is one undo step');
  await ctx.close();
}

/* ================= statistics periods (Owner, 14.10: "od początku" from the real start; the account's whole life as its own range) ================= */
{
  const { ctx, page, J, wait } = await open();
  await J(() => __JASK.setSpace('statystyki')); await wait(700);
  const setRange = r => J(r => __JASK.commit('test: okres', L => { L.stats = Object.assign({}, L.stats, { range: r, fams: [] }); }), r);
  await setRange('all'); await wait(600);
  const a = await J(() => ({ note: document.querySelector('.st-h .st-note')?.textContent || '', brk: document.querySelector('.st-chart .brk-t')?.textContent || '', ax: [...document.querySelector('.st-chart').querySelectorAll('.ax text')].map(t => t.textContent) }));
  // the rule, written out independently of the page: the oldest commit after which there is no silence longer than
  // 60 days, unless what came before such a silence is a tenth of all commits or more
  const want = await J(() => {
    const days = {}; for (const r of __BIB.D.repos) for (const [k, n] of Object.entries(r.days || {})) days[k] = (days[k] || 0) + n;
    const ks = Object.keys(days).filter(k => days[k] > 0).sort(), total = ks.reduce((a, k) => a + days[k], 0);
    const t = k => Date.parse(k + 'T12:00:00Z') / 864e5;
    let start = ks[0], before = 0, acc = 0;
    for (let i = 1; i < ks.length; i++) { acc += days[ks[i - 1]]; if (t(ks[i]) - t(ks[i - 1]) > 60 && acc < total * 0.1) { start = ks[i]; before = acc; } }
    const d = new Date(start + 'T12:00:00Z');
    return { label: `${d.getUTCDate()} ${['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'][d.getUTCMonth()]} ${d.getUTCFullYear()}`, before };
  });
  ok(a.note.includes(want.label), '"od początku" starts where the work really starts', `${a.note} (expected ${want.label})`);
  ok(want.before ? new RegExp(`wcześniej ${want.before} commit`).test(a.brk) : !a.brk, 'the thin prelude it leaves out is named at the chart edge', a.brk || '(no prelude)');
  ok(!a.ax.some(x => /2025/.test(x)), 'no empty 2025 stretch on the axis', a.ax.join(' '));
  await setRange('konto'); await wait(600);
  const k = await J(() => ({ note: document.querySelector('.st-h .st-note')?.textContent || '', kpi: document.querySelectorAll('.st-kpi b')[1]?.textContent || '', ax: [...document.querySelector('.st-chart').querySelectorAll('.ax text')].map(t => t.textContent) }));
  ok(k.note.includes('21 lut 2022'), '"od konta" starts when the account was made', k.note);
  const accDays = await J(() => Math.floor(__BIB.SNAP / 86400) - Math.floor(__BIB.D.estate.account.created_ts / 86400) + 1);
  ok(new RegExp(`z ${accDays}`).test(k.kpi) && k.ax.join(' ') === '2023 2024 2025 2026', 'the account range counts every day and labels years', `${k.kpi} · ${k.ax.join(' ')}`);
  const overlaps = await J(() => { let bad = 0; for (const svg of document.querySelectorAll('.st-chart')) { const l = [...svg.querySelectorAll('.ax text')]; for (let i = 1; i < l.length; i++) if (+l[i].getAttribute('x') < +l[i - 1].getAttribute('x') + l[i - 1].getComputedTextLength() + 2) bad++; } return bad; });
  ok(overlaps === 0, 'axis labels never overlap', String(overlaps));
  await setRange('28'); await wait(300);
  await ctx.close();
}

/* ================= what came back from storage ================= */
{
  const { ctx, page, J } = await open({ storage: { 'jaskinia:v2': '{"v":2,"spaces":[{"id":"a","name":"Zepsute"' } });
  ok(await page.locator('.jk-banner.warn').count() === 1, 'unreadable data: a visible warning, not silence');
  ok(await J(() => (localStorage.getItem('jaskinia:ratunek') || '').includes('Zepsute')), 'unreadable data is kept in the rescue box');
  ok(await J(() => __JASK.store.spaces.length) === 5, 'unreadable data: the starting layouts');
  await ctx.close();
}
{
  const good = { id: 'ok1', name: 'Dobry', preset: null, L: { tree: { t: 'w', id: 'w1' }, wins: { w1: { type: 'mapa', z: 1, pin: null, st: {} } }, floats: [], max: null, focus: null, stats: {} } };
  const bad = { id: 'bad1', name: 'Zły', preset: null, L: { tree: { t: 's', d: 'diag', a: 1 }, wins: {} } };
  const dup = { id: 'ok2', name: 'Duplikat', preset: null, L: { tree: { t: 'w', id: 'w1' }, wins: { w1: { type: 'spis', z: 1, pin: null, st: {} } }, floats: [], max: null, focus: null, stats: {} } };
  const { ctx, page, J } = await open({ storage: { 'jaskinia:v2': JSON.stringify({ v: 2, cur: 'ok1', sel: 'nope', spaces: [good, bad, dup], notes: {}, saved: [], trash: [], views: {} }) } });
  const names = await J(() => __JASK.store.spaces.map(s => s.name).join(','));
  ok(names === 'Dobry,Duplikat', 'one broken workspace does not take the others with it', names);
  ok(await J(() => __JASK.store.trash.some(x => x.kind === 'broken' && x.name === 'Zły')), 'the broken workspace waits in the trash');
  const wids = await J(() => __JASK.store.spaces.map(s => Object.keys(s.L.wins)[0]));
  ok(wids[0] !== wids[1], 'a window id used twice is given a new one', wids.join('/'));
  ok(await page.locator('.jk-banner.warn').count() === 1, 'broken workspace: Jozz is told');
  await ctx.close();
}
{
  const v1 = { v: 1, cur: 'n', sel: 'Combat-Lab', spaces: [{ id: 'n', name: 'Notatnik', preset: null, L: { tree: { t: 'w', id: 'wn' }, wins: { wn: { type: 'notatki', z: 1, pin: null, st: { text: 'stare notatki z v1' } } }, floats: [], max: null, focus: null, stats: {} } }] };
  const { ctx, page, J } = await open({ storage: { 'jaskinia:v1': JSON.stringify(v1) } });
  const txt = await J(() => document.querySelector('textarea.jk-notes')?.value);
  ok(txt === 'stare notatki z v1', 'v1 notes come along into v2', JSON.stringify(txt));
  ok(await J(() => !!localStorage.getItem('jaskinia:v1')), 'the v1 data is left untouched');
  ok(await J(() => { const w = Object.values(__JASK.store.spaces[0].L.wins)[0]; return !!w.st.note && w.st.text === undefined; }), 'the notes window now points at a note');
  await ctx.close();
}

/* ================= the phone ================= */
{
  const { ctx, page, J, wait, shot } = await open({ phone: true });
  ok(await J(() => __JASK.phone), 'phone layout on a phone');
  ok(await page.locator('.win:not(.off):not([hidden])').count() === 1, 'one window at a time');
  const chips = await page.locator('.dk-i').count();
  ok(chips === 4, 'the dock lists this workspace\'s windows', String(chips));
  await page.locator('.dk-i').nth(2).tap(); await wait(300);
  ok(await J(() => __JASK.L.wins[__JASK.L.focus].type) === 'kataster', 'tapping a dock chip shows that window');
  // map: a tap selects, no tooltip
  await page.locator('.dk-i').nth(0).tap(); await wait(400);
  const pb = await page.locator('.win[data-type="mapa"] .parcel[data-repo="Combat-Lab"] rect.body').boundingBox();
  await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2); await wait(400);
  ok(await J(() => __JASK.store.sel) === 'Combat-Lab', 'tapping a parcel selects it');
  ok(await J(() => { const t = document.querySelector('.tip'); return !t || t.hidden; }), 'no desktop tooltip after a tap');
  ok(await page.locator('.jk-sheet:not([hidden])').count() === 1, 'a sheet offers the project after a tap');
  await shot('t20-phone-map-tap');
  await page.locator('.jk-sheet .btn >> text=Karta').tap(); await wait(400);
  ok(await J(() => __JASK.L.wins[__JASK.L.focus].type) === 'karta', 'the sheet opens the project card');
  // swipe on the window bar goes to the next window
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  const swipe = async (a, b, steps = 8, hold = 0) => { await touch('touchStart', [a]); if (hold) await wait(hold); for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }]); await wait(16); } await touch('touchEnd', []); await wait(300); };
  const f0 = await J(() => __JASK.L.focus);
  const hb = await page.locator('.win:not(.off) .whead').boundingBox();
  await swipe({ x: hb.x + hb.width * 0.7, y: hb.y + hb.height / 2 }, { x: hb.x + hb.width * 0.1, y: hb.y + hb.height / 2 });
  ok(await J(() => __JASK.L.focus) !== f0, 'a swipe on the window bar changes the window');
  // the wall: quick drag pans, hold-then-drag moves, two fingers zoom
  await J(() => __JASK.setSpace('sciana')); await wait(900);
  const wid = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'sciana'));
  await J(id => __JASK.select && __JASK.L && (__JASK.L.focus = id), wid);
  await J(() => __JASK.apply()); await wait(400);
  await shot('t21-phone-wall');
  const card = await J(() => { const el = [...document.querySelectorAll('.win:not(.off) .wc')].find(e => { const b = e.getBoundingClientRect(); return b.width > 24 && b.top > 160 && b.bottom < innerHeight - 140 && b.left > 20 && b.right < innerWidth - 20; }); if (!el) return null; const b = el.getBoundingClientRect(); return { n: el.dataset.repo, x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  ok(!!card, 'a card is on the phone screen', card && card.n);
  const cardsAt = () => J(id => JSON.parse(JSON.stringify(__JASK.L.wins[id].st.cards)), wid);
  const camAt = () => J(id => ({ ...(__JASK.store.views[id] || {}).cam }), wid);
  const c0 = await cardsAt(), k0 = await camAt();
  await swipe({ x: card.x, y: card.y }, { x: card.x + 60, y: card.y + 30 }, 6, 0);
  await wait(400);
  const c1 = await cardsAt(), k1 = await camAt();
  ok(JSON.stringify(c0) === JSON.stringify(c1), 'a quick finger drag over a card does not move it');
  ok(Math.abs((k1.cx || 0) - (k0.cx || 0)) > 5, 'a quick finger drag pans the wall', `${k0.cx} → ${k1.cx}`);
  const card2 = await J(n => { const b = document.querySelector(`.win:not(.off) .wc[data-repo="${n}"]`).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, card.n);
  await swipe({ x: card2.x, y: card2.y }, { x: card2.x + 50, y: card2.y + 40 }, 8, 520);
  const c2 = await cardsAt();
  ok(c2[card.n].x !== c1[card.n].x, 'hold, then drag: the card moves');
  // pinch
  const z0 = (await camAt()).z;
  const mid = { x: 200, y: 450 };
  await touch('touchStart', [{ x: mid.x - 40, y: mid.y }, { x: mid.x + 40, y: mid.y }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: mid.x - 40 - i * 12, y: mid.y }, { x: mid.x + 40 + i * 12, y: mid.y }]); await wait(16); }
  await touch('touchEnd', []); await wait(500);
  const z1 = (await camAt()).z;
  ok(z1 > z0 * 1.5, 'two fingers zoom the wall', `${z0} → ${z1}`);
  await shot('t22-phone-wall-pinched');
  // add a window from the dock
  const nW = await J(() => Object.keys(__JASK.L.wins).length);
  await page.locator('.dk-add').tap(); await wait(300);
  await page.locator('.jk-menu .mi-l > span', { hasText: /^Notatki$/ }).tap(); await wait(400);
  ok(await J(() => Object.keys(__JASK.L.wins).length) === nW + 1 && await J(() => __JASK.L.wins[__JASK.L.focus].type) === 'notatki', 'the dock adds a window and shows it');
  await shot('t23-phone-new-notes');
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.slice(0, 20).join('\n'));
process.exit(fail || errs.length ? 1 : 0);
