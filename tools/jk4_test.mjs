// Jaskinia v4 checks: what the owner's recordings of 15–16 Oct 2026 showed (C1 review, F1–F14) and the feedback loop.
// node tools/jk4_test.mjs [shotdir]   (served over http, like the other tests)
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk4t');
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk4_test.html');
fs.writeFileSync(test, skel);
const SRV = await serve(path.dirname(test));
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
async function open({ phone = false, size = { width: 1916, height: 908 }, place = null, prefs = null, init = null, hint = true } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'], colorScheme: 'dark' } : { viewport: size, deviceScaleFactor: 1, colorScheme: 'dark' });
  // a localStorage write injected at document start can hand a reloaded page an empty storage (see the file:// checks); checks that reload skip it
  if (hint) await ctx.addInitScript(() => { try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* fine */ } });
  if (place) await ctx.addInitScript(p => { window.__JASK_PLACE = p; }, place);
  if (init) await ctx.addInitScript(init[0], init[1]);
  if (prefs) await ctx.addInitScript(p => { try { if (!sessionStorage.getItem('p')) { localStorage.setItem('jaskinia:prefs', JSON.stringify(p)); sessionStorage.setItem('p', '1'); } } catch { /* fine */ } }, prefs);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('about:blank');
  await page.goto(SRV.base + '/' + path.basename(test));
  await page.waitForTimeout(900);
  return { ctx, page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png') }) };
}
const wallId = J => J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'sciana'));
const overlaps = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/* ================= desk ================= */
{
  const { ctx, page, J, wait, shot } = await open();
  // the build names itself (C1: a recording must say which version it shows)
  const bar = await page.locator('.jk-bar').textContent();
  ok(/v\d+/.test(await page.locator('.jk-brand .jk-ver').textContent()), 'the top bar shows the version', await page.locator('.jk-brand .jk-ver').textContent());
  ok(/sprzed|dzisiejszy|sprzed chwili/.test(bar), 'the top bar says how old the snapshot is', bar.match(/zrzut[^0-9]*/)?.[0]);
  // F2: Puls ends at the snapshot; the days after it are hatched, not silent
  const pz = { after: await page.locator('.win[data-type="puls"] .seismo-after').count() > 0 };
  const daysAfter = await J(() => Math.floor(Date.now() / 86400000) - Math.floor(JSON.parse(document.getElementById('lib-data').textContent).estate.generated_ts / 86400));
  ok(daysAfter < 1 || pz.after, 'Puls: the days after the snapshot are marked as unknown', `days after: ${daysAfter}`);
  const lab = await J(() => { const ls = [...document.querySelectorAll('.win[data-type="puls"] .seismo-m span')].filter(s => s.style.visibility !== 'hidden').map(s => s.getBoundingClientRect()); let bad = 0; for (let i = 1; i < ls.length; i++) if (ls[i].left < ls[i - 1].right) bad++; const box = document.querySelector('.win[data-type="puls"] .seismo-m').getBoundingClientRect(); return { bad, out: ls.some(r => r.right > box.right + 1), n: ls.length }; });
  ok(!lab.bad && !lab.out && lab.n >= 4, 'Puls: month names do not overlap and stay inside', JSON.stringify(lab));

  // F3: unknown is not zero on the wall
  await J(() => __JASK.setSpace('sciana')); await wait(700);
  const wid = await wallId(J);
  await J(id => { const st = __JASK.L.wins[id].st; __JASK.commit('test: duży MiniFeniks', () => { st.cards['Mini_Feniks'].w = 420; st.cards['Mini_Feniks'].h = 260; }); const c = st.cards['Mini_Feniks']; __JASK.WALLS.get(id).setCam({ cx: c.x, cy: c.y, z: 1 }); }, wid);
  await wait(500);
  const mfNums = await J(() => document.querySelector('.wc[data-repo="Mini_Feniks"] .wc-nums')?.textContent || '');
  ok(/\? PR/.test(mfNums), 'wall: a repo the API did not see shows "? PR", not 0', mfNums);
  await J(() => __JASK.undo()); await wait(200);

  // F4: arranging never leaves a card under a note (02_PC 03:51)
  await J(id => { const st = __JASK.L.wins[id].st; __JASK.commit('test: wąski ReflexBrain', () => { st.cards['ReflexBrain-Lab'].w = 42; st.cards['ReflexBrain-Lab'].h = 99; }); }, wid);
  const arrange = async () => { await page.locator('.win[data-type="sciana"] button:has-text("Ułóż")').click(); await wait(200); await page.locator('.jk-menu .mi:has-text("Według rodzin")').click(); await wait(700); };
  await arrange();
  await J(id => { const st = __JASK.L.wins[id].st, c = st.cards['ReflexBrain-Lab']; __JASK.commit('test: notatka', () => { st.notes.push({ id: 'nT4', x: c.x - 60, y: c.y - 50, w: 184, h: 105, tone: 'zolty' }); }); __JASK.store.notes.nT4 = { text: 'Test notatka.', upd: Date.now() }; }, wid);
  await wait(300);
  await arrange();
  const coveredDom = await J(id => {
    const out = [];
    for (const c of document.querySelectorAll(`.win[data-id="${id}"] .wc`)) { const b = c.getBoundingClientRect(); for (const n of document.querySelectorAll(`.win[data-id="${id}"] .wn`)) { const r = n.getBoundingClientRect(); const ix = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)), iy = Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)); if (ix * iy > 0) out.push(c.dataset.repo); } }
    return out;
  }, wid);
  ok(!coveredDom.length, 'Ułóż według rodzin: no card stays under a note', JSON.stringify(coveredDom));
  ok(await page.locator('.jk-toast:has-text("Notatki")').count() > 0, 'the moved note is announced with an undo', '');
  // the narrow card keeps its name
  const rb = await J(() => { const e = document.querySelector('.wc[data-repo="ReflexBrain-Lab"]'); return e ? { cls: e.className, name: e.querySelector('.wc-sname')?.textContent || e.querySelector('.wc-name')?.textContent || '' } : null; });
  ok(rb && /ReflexBrain/.test(rb.name), 'a narrow hand-sized card still shows its name', JSON.stringify(rb));
  await shot('d01-wall-arranged');
  // F12: small names never break inside a word
  const names = await J(() => [...document.querySelectorAll('.wc-sname.lines')].map(e => ({ full: e.title, parts: [...e.children].map(s => s.textContent) })));
  ok(names.length > 0 && names.every(n => n.parts.join(' ') === n.full), 'small card names break only between words', String(names.length));
  // "Rozsuń" moves notes too
  await J(id => { const st = __JASK.L.wins[id].st, c = st.cards['Llm-Live-NPC']; __JASK.commit('test: notatka na karcie', () => { const n = st.notes.find(x => x.id === 'nT4'); n.x = c.x - 40; n.y = c.y - 30; }); }, wid);
  await page.locator('.win[data-type="sciana"] button:has-text("Ułóż")').click(); await wait(200);
  await page.locator('.jk-menu .mi:has-text("Rozsuń")').click(); await wait(600);
  const cov2 = await J(id => { const out = []; for (const c of document.querySelectorAll(`.win[data-id="${id}"] .wc`)) { const b = c.getBoundingClientRect(); for (const n of document.querySelectorAll(`.win[data-id="${id}"] .wn`)) { const r = n.getBoundingClientRect(); const ix = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)), iy = Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)); if (ix * iy > 4) out.push(c.dataset.repo); } } return out; }, wid);
  ok(!cov2.length, 'Rozsuń separates notes from cards too', JSON.stringify(cov2));

  // F10: one language for findings, never a life colour in Żar
  await J(() => { __JASK.prefs.life = 'zar'; document.documentElement.dataset.life = 'zar'; }); await wait(300);
  const zarBadge = await J(() => { const b = document.querySelector('.wc-att.high') || document.querySelector('.wc-att'); if (!b) return null; const cs = getComputedStyle(b); return { bg: cs.backgroundColor, color: cs.color, ground: getComputedStyle(document.documentElement).getPropertyValue('--ground-2').trim() }; });
  ok(zarBadge && zarBadge.bg !== zarBadge.color, 'Żar: finding badges are rings on the ground, coloured by their number', JSON.stringify(zarBadge));
  await J(() => { __JASK.prefs.life = 'zielen'; document.documentElement.dataset.life = 'zielen'; }); await wait(200);
  const midHigh = await J(() => { const m = document.querySelector('.wc-att:not(.high)'), hi = document.querySelector('.wc-att.high'); return m && hi ? [getComputedStyle(m).backgroundColor, getComputedStyle(hi).backgroundColor] : null; });
  ok(midHigh && midHigh[0] !== midHigh[1], 'wall: medium and serious findings have different colours (as on the map)', JSON.stringify(midHigh));

  // F11: a floating window splits into a second float
  await J(() => __JASK.setSpace('przeglad')); await wait(500);
  const kid = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'kataster'));
  await page.locator(`.win[data-id="${kid}"] .b-fl`).click(); await wait(300);
  const fl0 = await J(() => __JASK.L.floats.length);
  await page.locator(`.win[data-id="${kid}"] .b-sr`).click(); await wait(400);
  ok(await J(() => __JASK.L.floats.length) === fl0 + 1, 'splitting a floating window makes a second floating window', '');
  ok(await page.locator('.jk-toast:has-text("najpierw wstaw")').count() === 0, 'no refusal toast for a floating split', '');
  await shot('d02-float-split');
  // F13: close the empty windows in one step, and undo it
  for (let i = 0; i < 3; i++) { await page.locator('.win[data-type="mapa"] .b-sc').click(); await wait(200); }
  const empties = await J(() => Object.values(__JASK.L.wins).filter(w => w.type === 'wybor').length);
  await page.locator('.jk-tall').click(); await wait(200);
  await page.locator('.jk-menu .mi:has-text("Zamknij puste okna")').click(); await wait(400);
  ok(empties >= 3 && await J(() => Object.values(__JASK.L.wins).filter(w => w.type === 'wybor').length) === 0, 'all empty windows close in one step', `${empties} empty`);
  await J(() => __JASK.undo()); await wait(300);
  ok(await J(() => Object.values(__JASK.L.wins).filter(w => w.type === 'wybor').length) === empties, 'one undo brings them back', '');

  // F9: statistics do not paint a text selection
  await J(() => __JASK.setSpace('statystyki')); await wait(700);
  const us = await J(() => { const e = document.querySelector('.st-kpi') || document.querySelector('.st-pl'); return e ? getComputedStyle(e).userSelect : '?'; });
  ok(us === 'none', 'statistics: no text selection on drag', us);

  // the feedback loop: "to mnie uwiera", the log, the package
  await J(() => __JASK.setSpace('sciana')); await wait(500);
  await page.mouse.move(400, 400);
  await page.keyboard.press('Control+.'); await wait(300);
  ok(await page.locator('.jk-uwaga').count() === 1, 'Ctrl+. opens the note pinned to the moment', '');
  await page.locator('.jk-uwaga textarea').fill('Ściana: ten róg jest za mały');
  await page.keyboard.press('Control+Enter'); await wait(400);
  const uw = await J(() => __JASK.uwagi[__JASK.uwagi.length - 1]);
  ok(uw && uw.text === 'Ściana: ten róg jest za mały' && uw.u === 'Ściana' && uw.ekran && uw.v, 'the note keeps the moment, layout, screen and version', JSON.stringify(uw));
  ok(await J(() => __JASK.log.some(e => /^uwaga: Ściana/.test(e.a))), 'the note is in the log', '');
  ok(await J(() => __JASK.log.some(e => /^układ: Ściana/.test(e.a)) && __JASK.log.some(e => /^start: Jaskinia v/.test(e.a))), 'the log records start and layout switches', '');
  const pk = await J(() => { const p = __JASK.packageData(false); return { v: p.jaskinia.wersja, place: p.jaskinia.dziala_jako, file: p.jaskinia.plik, uw: p.uwagi.length, log: p.dziennik.length, notes: typeof p.notatki.tresc === 'string', spaces: p.uklady.length }; });
  ok(/^v\d/.test(pk.v) && pk.uw >= 1 && pk.log > 5 && pk.notes && pk.spaces >= 5, 'the package carries version, notes, log and layouts, without note texts', JSON.stringify(pk));
  ok(!/[\\/]/.test(pk.file), 'the package names only the file, never its folder (a home folder is private)', pk.file);
  const txt = await J(() => __JASK.packageText());
  ok(txt.startsWith('# Paczka z Jaskini') && txt.includes('## Uwagi (1)') && txt.includes('## Dziennik'), 'the package as text for a chat', txt.split('\n')[0]);
  await J(() => __JASK.openSettings('uwagi')); await wait(500);
  ok(await page.locator('.win[data-type="ustawienia"]:not([hidden]) .set-list li').count() >= 1, 'Settings → Uwagi i paczka lists the notes', '');
  await shot('d03-uwagi');
  // the log and the notes survive a reload
  await J(() => __JASK.persistNow()); await wait(900);
  await page.reload(); await wait(1200);
  ok(await J(() => __JASK.uwagi.length) >= 1 && await J(() => __JASK.log.length) > 5, 'notes and log survive a reload', '');
  await ctx.close();
}

/* ================= where it runs (F1) ================= */
{
  const { ctx, page, J, wait } = await open({ place: 'plik' });
  await J(() => __JASK.setSpace('granie')); await wait(700);
  const f = await J(() => ({ iframe: !!document.querySelector('.win[data-type="gra"] iframe'), ext: !!document.querySelector('.win[data-type="gra"] .jk-game-ext') }));
  ok(f.iframe && f.ext, 'a downloaded file plays the game inside its window, with a new-tab way out', JSON.stringify(f));
  await J(() => __JASK.openSettings('o')); await wait(400);
  ok(/plik na tym urządzeniu/.test(await page.locator('.win[data-type="ustawienia"]:not([hidden]) .set-pane').textContent()), 'Settings → O Jaskini says it runs as a file', '');
  await ctx.close();
}
{
  const { ctx, page, J, wait } = await open({ place: 'claude' });
  await J(() => __JASK.setSpace('granie')); await wait(700);
  const f = await J(() => ({ iframe: !!document.querySelector('.win[data-type="gra"] iframe'), note: document.querySelector('.win[data-type="gra"] .jl-note')?.textContent || '' }));
  ok(!f.iframe && /claude\.ai/.test(f.note), 'inside claude.ai the game opens in a new tab and the note says why', f.note.slice(0, 60));
  await ctx.close();
}

/* ================= phone ================= */
{
  const { ctx, page, J, wait, shot } = await open({ phone: true, place: 'plik' });
  // F5: Back closes the sheet, not Jaskinia
  const url0 = page.url();
  await page.locator('.jk-dock .dk-add').click(); await wait(400);
  ok(await page.locator('.jk-menu.sheet').count() === 1, 'phone: the add-window sheet is open', '');
  await page.goBack(); await wait(600);
  ok(page.url() === url0 && await page.locator('.jk-menu.sheet').count() === 0 && await page.locator('.jk-bar').count() === 1, 'phone: Back closes the sheet and stays in Jaskinia', page.url());
  // a sheet closed by tapping outside leaves no extra history step behind
  await page.locator('.jk-dock .dk-add').click(); await wait(300);
  await page.locator('.jk-scrim').click({ position: { x: 20, y: 20 } }); await wait(500);
  const hl = await J(() => history.length);
  await page.locator('.jk-dock .dk-add').click(); await wait(300);
  await page.locator('.jk-scrim').click({ position: { x: 20, y: 20 } }); await wait(500);
  ok(await J(() => history.length) === hl, 'phone: closing sheets does not pile up history', String(hl));
  // F6: lost in an empty part of the wall: say so and offer the way back
  await J(() => __JASK.setSpace('sciana')); await wait(800);
  const wid = await wallId(J);
  await J(id => __JASK.WALLS.get(id).setCam({ cx: 99000, cy: 99000, z: 0.85 }), wid); await wait(400);
  ok(await page.locator('.w2-empty').isVisible(), 'phone: an empty view of the wall offers "pokaż wszystko"', '');
  await shot('d04-phone-empty-wall');
  await page.locator('.w2-empty').click(); await wait(700);
  ok(!(await page.locator('.w2-empty').isVisible()) && await page.locator('.wc:not([hidden])').count() > 5, 'phone: the way back shows the cards again', '');
  await page.locator('.win[data-type="sciana"]:not(.off) .b-more').click(); await wait(300);
  ok(await page.locator('.jk-menu .mi:has-text("Pokaż wszystko")').count() === 1, 'phone: the wall window menu has "Pokaż wszystko"', '');
  await page.goBack(); await wait(400);
  // F7: two fingers zoom the window, not the page
  await J(() => __JASK.setSpace('przeglad')); await wait(600);
  await page.locator('.jk-dock .dk-i', { hasText: 'Kataster' }).click(); await wait(500);
  const z0 = await J(() => __JASK.L.wins[__JASK.L.focus].z);
  await J(() => {
    const el = document.querySelector('.win:not(.off) .wbody');
    const mk = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(1, 150, 400), mk(2, 250, 400)], targetTouches: [mk(1, 150, 400), mk(2, 250, 400)], bubbles: true, cancelable: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(1, 100, 400), mk(2, 300, 400)], targetTouches: [mk(1, 100, 400), mk(2, 300, 400)], bubbles: true, cancelable: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], bubbles: true }));
  });
  await wait(400);
  const z1 = await J(() => __JASK.L.wins[__JASK.L.focus].z);
  ok(z1 > z0 * 1.5, 'phone: two fingers zoom the window content', `${z0} → ${z1}`);
  ok(await J(() => getComputedStyle(document.querySelector('.jk')).touchAction).then(v => /pan-x pan-y|pan-y pan-x/.test(v)), 'phone: the page itself does not pinch-zoom', '');
  // F8 on the phone
  await page.locator('.jk-dock .dk-i', { hasText: 'Puls' }).click(); await wait(600);
  const lab = await J(() => { const ls = [...document.querySelectorAll('.win:not(.off) .seismo-m span')].filter(s => s.style.visibility !== 'hidden').map(s => s.getBoundingClientRect()); let bad = 0; for (let i = 1; i < ls.length; i++) if (ls[i].left < ls[i - 1].right) bad++; return { bad, n: ls.length }; });
  ok(!lab.bad && lab.n >= 3, 'phone: Puls month names do not overlap', JSON.stringify(lab));
  // the note on the phone: from the brand menu
  await page.locator('.jk-brand').click(); await wait(300);
  ok(await page.locator('.jk-menu .mi:has-text("To mnie uwiera")').count() === 1, 'phone: "To mnie uwiera" is in the main menu', '');
  await page.goBack(); await wait(300);
  await ctx.close();
}

/* ================= v4.1: the package keeps note text out (GPT's review of PR #1) ================= */
{
  // v4 logged a note's title when it was chosen from the notes menu, so a package "without notes" still carried it.
  // The check searches the whole package, JSON and text, not only the notes field.
  const S = { title: 'SENTINEL_TITLE_kx81 prywatny tytuł', body: 'SENTINEL_BODY_qz42 tej linijki nikt nie powinien zobaczyć', old: 'SENTINEL_OLD_mm7 tytuł z v4' };
  const seed = [s => { try { if (!sessionStorage.getItem('seeded')) { const n = Date.now(); localStorage.setItem('jaskinia:dziennik', JSON.stringify([
    { t: n - 9000, a: 'menu: Notatka w tym oknie' }, { t: n - 8000, a: 'wybrane: ' + s }, { t: n - 7000, a: 'menu: Ułóż kartki' }, { t: n - 6000, a: 'wybrane: Według rodzin' }]));
    sessionStorage.setItem('seeded', '1'); } } catch { /* fine */ } }, S.old];
  const { ctx, page, J, wait } = await open({ init: seed });
  const raw0 = await J(() => __JASK.log.map(e => e.a));
  ok(!raw0.some(a => a.includes('SENTINEL_OLD')) && raw0.includes('wybrane: notatka'), 'package: a note title logged by v4 is cleaned when the log is read', raw0.slice(0, 4).join(' | '));
  ok(raw0.includes('wybrane: Według rodzin'), 'package: other choices stay readable in the log', '');
  // two notes; the window shows the second; the sentinel note is chosen from the window's notes menu
  await J(S => { const J = window.__JASK, id = J.leafIds(J.L.tree)[0];
    J.store.notes.sentA = { text: S.title + '\n' + S.body, upd: Date.now() }; J.store.notes.sentB = { text: 'zwykła notatka', upd: Date.now() - 1000 };
    J.commit('test: notatka', L => { L.wins[id].type = 'notatki'; L.wins[id].st = { note: 'sentB' }; }); }, S);
  await wait(400);
  await page.locator('.win[data-type="notatki"] .note-pick').first().click(); await wait(250);
  await page.locator('.jk-menu .mi', { hasText: 'SENTINEL_TITLE_kx81' }).first().click(); await wait(300);
  const shown = await J(() => { const id = Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'notatki'); return __JASK.L.wins[id].st.note; });
  ok(shown === 'sentA', 'package: the note picked from the menu is shown', shown);
  await wait(900); // the log is saved 0.7 s after the last line
  const stored = await J(() => localStorage.getItem('jaskinia:dziennik') || '');
  ok(!/SENTINEL/.test(stored) && stored.includes('wybrane: notatka'), 'package: choosing a note logs "notatka", not its title, also in the saved log', '');
  // a remark made while the notes window is in focus names the window, not the note
  await page.locator('.win[data-type="notatki"] .whead').first().click(); await wait(150);
  await page.keyboard.press('Control+.'); await wait(300);
  await page.locator('.jk-uwaga textarea').fill('uwaga testowa przy notatkach'); await page.keyboard.press('Control+Enter'); await wait(300);
  const uw = await J(() => __JASK.uwagi[__JASK.uwagi.length - 1]);
  ok(uw && uw.text === 'uwaga testowa przy notatkach' && !/SENTINEL/.test(JSON.stringify(uw)), 'package: a remark carries the window, not the note', uw && uw.okno);
  // a path that does not exist yet: a line that carries a note's title and a line of its body
  await J(S => { __JASK.log.push({ t: Date.now(), a: 'komunikat: coś z ' + S.title }, { t: Date.now(), a: 'błąd: ' + S.body }); }, S);
  const pk = await J(() => ({ json: JSON.stringify(__JASK.packageData(false)), text: __JASK.packageText(), withNotes: JSON.stringify(__JASK.packageData(true)) }));
  const leak = x => (x.match(/SENTINEL_[A-Z]+_[a-z0-9]+/g) || []).join(',');
  ok(!leak(pk.json), 'package (file): no note title or body anywhere without the tick', leak(pk.json));
  ok(!leak(pk.text), 'package (text): no note title or body anywhere', leak(pk.text));
  ok(pk.json.includes('wybrane: Według rodzin') && pk.json.includes('[notatka]'), 'package: the log keeps its other lines; a note becomes [notatka]', '');
  ok(pk.withNotes.includes('SENTINEL_BODY_qz42'), 'package: with the tick, the notes are in', '');
  await ctx.close();
}

/* ================= v4.1: "deleted for good" keeps a way back (GPT's review of v3: the copy did not hold it) ================= */
{
  const { ctx, page, J, wait } = await open({ hint: false });
  await J(() => { try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* fine */ } });
  const r = await J(() => {
    const J = __JASK, sp = J.store.spaces[J.store.spaces.length - 1];
    J.deleteSpace(sp.id);
    const tr = J.store.trash.find(x => x.kind === 'space' && x.data && x.data.sp && x.data.sp.id === sp.id);
    J.forgetTrash(tr.id);
    const gone = !J.store.trash.some(x => x.id === tr.id);
    const b = J.readBackups()[0];
    const held = !!(b && b.data.forgotten && b.data.forgotten.some(x => x.id === tr.id));
    J.restoreBackup(b.id, true);
    const back = J.store.trash.some(x => x.id === tr.id);
    if (back) J.restoreTrash(tr.id);
    return { gone, held, back, again: J.store.spaces.some(x => x.id === sp.id) };
  });
  ok(r.gone && r.held, 'trash: a layout deleted for good rides along in the copy made just before', JSON.stringify(r));
  ok(r.back && r.again, 'trash: restoring that copy puts it back in the trash, and from there into the layouts', '');
  // the whole trash at once, through the real button
  await J(() => { const J = __JASK; J.deleteSpace(J.store.spaces[J.store.spaces.length - 1].id); });
  await J(() => __JASK.openSettings('kosz')); await wait(400);
  await page.locator('.set-danger .btn.danger').click(); await wait(200);
  await page.locator('.jk-confirm .btn.danger').click(); await wait(300);
  const emptied = await J(() => ({ trash: __JASK.store.trash.length, held: (__JASK.readBackups()[0].data.forgotten || []).length }));
  ok(emptied.trash === 0 && emptied.held >= 1, 'trash: "Opróżnij kosz" keeps what it deletes in the copy', JSON.stringify(emptied));
  await page.keyboard.press('Escape');

  /* an older Jaskinia, or the public one, opening layouts written by a newer one (every downloaded file on one computer
     shares the same file:// storage): what it cannot draw waits, and comes back */
  const sid = await J(() => { const J = __JASK, sp = J.store.spaces[0], id = J.leafIds(sp.L.tree)[0];
    Object.assign(sp.L.wins[id], { type: 'przyrzad_z_przyszlosci', pin: 'Repo-Z-Przyszlosci', st: { url: 'https://example.org/lab' } }); J.store.cur = sp.id; J.persist(); J.persistNow(); return sp.id; });
  await page.reload(); await wait(1000);
  const kept = await J(sid => { const J = __JASK, sp = J.store.spaces.find(x => x.id === sid), w = sp.L.wins[J.leafIds(sp.L.tree)[0]]; return { type: w.type, lost: w.lost || null, url: w.st.url || null }; }, sid);
  ok(kept.type === 'wybor' && kept.lost?.type === 'przyrzad_z_przyszlosci' && kept.lost?.pin === 'Repo-Z-Przyszlosci' && kept.url, 'older build: an unknown window type and project wait aside', JSON.stringify(kept));
  ok(await page.locator('.ch-lost').count() > 0, 'older build: the empty window says what was there', '');
  // a Jaskinia that knows them again (simulated with a type and a project this build knows)
  await J(sid => { const J = __JASK, sp = J.store.spaces.find(x => x.id === sid), w = sp.L.wins[J.leafIds(sp.L.tree)[0]]; w.lost = { type: 'karta', pin: 'Mini_Feniks' }; J.persist(); J.persistNow(); }, sid);
  await page.reload(); await wait(1000);
  const backAgain = await J(sid => { const J = __JASK, sp = J.store.spaces.find(x => x.id === sid), w = sp.L.wins[J.leafIds(sp.L.tree)[0]]; return { type: w.type, pin: w.pin, lost: w.lost || null }; }, sid);
  ok(backAgain.type === 'karta' && backAgain.pin === 'Mini_Feniks' && !backAgain.lost, 'newer build: the window and its project come back by themselves', JSON.stringify(backAgain));
  await ctx.close();
}

/* ================= v4.1: a real file from the disk (GPT: file://, not the HTTP stand-in for "plik") =================
   In a real browser profile, like the owner's, and without the suite's usual init script: a localStorage write that
   Playwright injects at the start of a reloaded file:// document makes Chromium hand that document an empty storage
   (lost on 2 to 3 reloads in 8, in throwaway and real profiles alike). Without it, 48 reloads of 48 kept the state. */
for (const name of ['jaskinia.html', 'jaskinia-web.html']) {
  const f = path.join(root, 'dist', name);
  if (!fs.existsSync(f)) { ok(false, `file://: ${name} is built`, 'npm run jaskinia'); continue; }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'jk4-profile-'));
  const ctx = await chromium.launchPersistentContext(prof, { viewport: { width: 1400, height: 880 }, colorScheme: 'dark' });
  const page = ctx.pages()[0] || await ctx.newPage(), e2 = [];
  page.on('pageerror', e => e2.push(e.message));
  await page.goto(pathToFileURL(f).href);
  const up = () => page.waitForFunction(() => !!(window.__JASK && window.__JASK.store), null, { timeout: 10000 }).then(() => true, () => false);
  const booted = await up();
  ok(booted && !e2.length, `file://: ${name} starts straight from the disk`, (await page.evaluate(() => document.characterSet)) + ' ' + e2.slice(0, 2).join(' | '));
  if (booted) {
    const where = await page.evaluate(() => { const k = __JASK.packageData(false).jaskinia; return k.dziala_jako + ' ' + k.protokol; });
    ok(where === 'plik file:', `file://: ${name} knows it runs as a file`, where);
    await page.evaluate(() => { __JASK.store.spaces[0].purpose = 'sprawdzenie po przeładowaniu'; __JASK.persist(); __JASK.persistNow(); });
    await page.reload(); await up();
    const kept = await page.evaluate(() => __JASK.store.spaces[0].purpose);
    ok(kept === 'sprawdzenie po przeładowaniu', `file://: ${name} keeps its state across a reload`, String(kept));
  }
  await ctx.close();
  fs.rmSync(prof, { recursive: true, force: true });
}

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : '');
ok(!errs.length, 'no errors during the whole run', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); SRV.close();
fs.rmSync(test, { force: true });
process.exit(fail ? 1 : 0);
