// Continuity across a refresh (10 Nov 2026). Jozz's Home is the page published on GitHub Pages; his layouts, windows,
// notes and the project he chose live in his browser, not in the page. When the page is replaced by a fresh build,
// all of that must still be there. This opens the page published now, then the fresh build at the same address,
// the way his browser will meet them, and compares.
//   reload    he arranges things in the published page; the address starts serving the fresh build; he reloads
//   open tab  he keeps the published page open all day; the fresh build opens in a second tab; both tabs keep
//             working, and neither loses what the other holds
// node tools/dom_ciaglosc_test.mjs PUBLISHED.html [FRESH.html]    (FRESH defaults to dist/jaskinia-web.html)
// Status: tymczasowe, together with the self-refreshing Home (.github/workflows/dom-odswiezanie.yml).
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OLD = process.argv[2];
const NEW = process.argv[3] || path.join(root, 'dist', 'jaskinia-web.html');
if (!OLD || !fs.existsSync(OLD) || !fs.existsSync(NEW)) {
  console.log('usage: node tools/dom_ciaglosc_test.mjs PUBLISHED.html [FRESH.html]');
  process.exit(2);
}
const libOf = file => {
  const m = fs.readFileSync(file, 'utf8').match(/<script[^>]*id="lib-data"[^>]*>([\s\S]*?)<\/script>/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};
const oldLib = libOf(OLD), newLib = libOf(NEW);

// one address, as on GitHub Pages: /Jozz-Cave-Workbench/index.html serves whichever page is published
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-'));
fs.mkdirSync(path.join(site, 'Jozz-Cave-Workbench'));
const publish = file => fs.copyFileSync(file, path.join(site, 'Jozz-Cave-Workbench', 'index.html'));
const SRV = await serve(site);
const HOME = SRV.base + '/Jozz-Cave-Workbench/index.html';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  // his browser dismissed the first-visit hints long ago
  await ctx.addInitScript(() => { try { localStorage.setItem('jaskinia:hint', '1'); localStorage.setItem('jaskinia:v6', '1'); } catch { /* fine */ } });
  return ctx;
}
const ready = page => page.waitForFunction(() => window.__JASK && window.__JASK.store && window.Jaskinia, null, { timeout: 30000 });
async function tab(ctx) {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|ERR_NAME|404|GPU stall|WebGL/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(HOME);
  await ready(page);
  await page.waitForTimeout(700);
  return { page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms) };
}
const waitFor = async (J, fn, a, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await J(fn, a); if (v) return v; await new Promise(r => setTimeout(r, 120)); } return null; };
const generated = J => J(() => JSON.parse(document.getElementById('lib-data').textContent).estate.generated);
const picture = J => J(() => {
  const s = __JASK.store;
  return { spaces: s.spaces.map(x => x.id + ':' + x.name), cur: s.cur, sel: s.sel,
           wins: Object.values(__JASK.L.wins).map(w => w.type).sort(),
           notes: Object.fromEntries(Object.entries(s.notes || {}).map(([k, v]) => [k, v.text])) };
});
const noteOf = J => J(() => Object.values(__JASK.L.wins).find(w => w.type === 'notatki')?.st?.note);

ok(!!oldLib && !!newLib, 'both pages carry their data', `${oldLib?.estate?.generated} → ${newLib?.estate?.generated}`);
const names = new Set((newLib?.repos || []).map(r => r.name));
const both = (oldLib?.repos || []).map(r => r.name).filter(n => names.has(n));
const pick = both.includes('Combat-Lab') ? 'Combat-Lab' : both[0];
const gone = (oldLib?.repos || []).map(r => r.name).filter(n => !names.has(n));
console.log(`   projects in both pages: ${both.length}; only in the published one: ${gone.length ? gone.join(', ') : 'none'}; chosen for the check: ${pick}`);

/* ---------- 1. reload ---------- */
{
  publish(OLD);
  const ctx = await context();
  const A = await tab(ctx);
  await A.J(() => Jaskinia.ext.open('notatki')); await A.wait(500);
  const noteId = await noteOf(A.J);
  await A.J(id => __JASK.noteSet(id, 'Zapisane przed odświeżeniem'), noteId);
  await A.J(() => Jaskinia.ext.open('wiedza')); await A.wait(400);
  await A.J(() => { const s = __JASK.store.spaces.find(x => x.id === __JASK.store.cur); s.name = 'Mój układ'; __JASK.persist(); });
  await A.J(n => __JASK.select(n), pick); await A.wait(300);
  await A.J(() => __JASK.persistNow()); await A.wait(300);
  const before = await picture(A.J);
  ok(!!noteId && before.notes[noteId] === 'Zapisane przed odświeżeniem' && before.sel === pick, 'the published page holds what he arranged', JSON.stringify({ sel: before.sel, wins: before.wins }));

  publish(NEW);
  await A.page.reload();
  await ready(A.page);
  await A.wait(900);
  ok((await generated(A.J)) === newLib.estate.generated, 'after a reload the address serves the fresh build', newLib.estate.generated);
  const after = await picture(A.J);
  ok(after.notes[noteId] === 'Zapisane przed odświeżeniem', 'his note is there');
  ok(JSON.stringify(after.spaces) === JSON.stringify(before.spaces) && after.spaces.some(x => x.endsWith(':Mój układ')), 'his layouts and their names are there', JSON.stringify(after.spaces));
  ok(after.cur === before.cur, 'he lands on the layout he left', after.cur);
  ok(JSON.stringify(after.wins) === JSON.stringify(before.wins), 'the same windows are open', JSON.stringify(after.wins));
  ok(after.sel === pick, 'the project he chose is still chosen', String(after.sel));
  ok(!!(await waitFor(A.J, () => [...document.querySelectorAll('.win:not([hidden]) textarea')].some(x => x.value === 'Zapisane przed odświeżeniem'))), 'the note shows on screen');
  await ctx.close();
}

/* ---------- 2. a tab open all day ---------- */
{
  publish(OLD);
  const ctx = await context();
  const A = await tab(ctx);
  await A.J(() => Jaskinia.ext.open('notatki')); await A.wait(500);
  const noteId = await noteOf(A.J);
  await A.J(id => { __JASK.noteSet(id, 'Rano, w starej karcie'); __JASK.persistNow(); }, noteId);
  await A.wait(300);

  publish(NEW);
  const B = await tab(ctx);
  ok((await generated(B.J)) === newLib.estate.generated && (await generated(A.J)) === oldLib.estate.generated, 'a new tab gets the fresh build while the old tab keeps the page it opened');
  ok((await B.J(id => __JASK.store.notes[id]?.text, noteId)) === 'Rano, w starej karcie', 'the new tab opens with what the old tab wrote');
  await B.J(id => { __JASK.noteSet(id, 'Wieczorem, w nowej karcie'); __JASK.persistNow(); }, noteId);
  ok(!!(await waitFor(A.J, id => __JASK.store.notes[id]?.text === 'Wieczorem, w nowej karcie', noteId)), 'the old tab takes in what the new tab wrote');
  // he switches away from the old tab: it writes on hide, and must not put its older state over the newer one
  await A.J(() => { document.dispatchEvent(new Event('visibilitychange')); __JASK.persistNow(); });
  await B.wait(900);
  const stored = await B.J(() => JSON.parse(localStorage.getItem('jaskinia:v3') || 'null'));
  ok(stored?.notes?.[noteId]?.text === 'Wieczorem, w nowej karcie', 'the old tab, hidden, does not write over the new one');
  await A.J(() => Jaskinia.ext.open('zegar'));
  ok(!!(await waitFor(B.J, () => __JASK.store.spaces.some(s => Object.values(s.L.wins).some(w => w.type === 'zegar')))), 'a window opened in the old tab reaches the new one');
  await A.page.close(); await B.page.close();
  const C = await tab(ctx);
  ok((await C.J(id => __JASK.store.notes[id]?.text, noteId)) === 'Wieczorem, w nowej karcie' && (await generated(C.J)) === newLib.estate.generated, 'the next visit opens the fresh build with everything in it');
  await ctx.close();
}

ok(errs.length === 0, 'no errors in the console', errs.slice(0, 3).join(' | '));
await browser.close();
SRV.close();
fs.rmSync(site, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
