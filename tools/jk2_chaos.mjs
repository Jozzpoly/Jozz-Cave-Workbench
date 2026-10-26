// Jaskinia v2 destruction run: hundreds of random actions (like the Owner's third recording), invariants after every step,
// then a reload that must bring back exactly the same state. node tools/jk2_chaos.mjs [steps] [seed]
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STEPS = +(process.argv[2] || 300), SEED = +(process.argv[3] || 7);
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_chaos.html');
fs.writeFileSync(test, skel);
const SRV = await serve(path.dirname(test));
let s = SEED;
const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
const pick = a => a[Math.floor(rnd() * a.length)];
const browser = await chromium.launch();
let bad = 0;
for (const mode of ['desk', 'phone']) {
  const ctx = await browser.newContext(mode === 'phone' ? { ...devices['Pixel 7'] } : { viewport: { width: 1500, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* fine */ } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(SRV.base + '/' + path.basename(test));
  await page.waitForTimeout(900);
  const types = await page.evaluate(() => ['mapa', 'sciana', 'kataster', 'spis', 'zagraj', 'ustalenia', 'zmiany', 'karta', 'gra', 'galezie', 'rytm', 'stan', 'dane', 'statystyki', 'wykres', 'ranking', 'rok', 'zegar', 'puls', 'historia', 'notatki', 'wiedza', 'ustawienia', 'wybor']);
  const log = [];
  for (let i = 0; i < STEPS; i++) {
    const act = pick(['split', 'split', 'close', 'type', 'type', 'float', 'dock', 'max', 'zoom', 'undo', 'undo', 'redo', 'tab', 'newtab', 'deltab', 'rename', 'select', 'wall', 'note', 'save', 'restoreTrash', 'resetspace', 'lang', 'back', 'menu']);
    const r = rnd(), r2 = rnd();
    log.push(act);
    try {
      await page.evaluate(([act, r, r2, types]) => {
        const J = window.__JASK, L = J.L, ids = Object.keys(L.wins), id = ids[Math.floor(r * ids.length)];
        const typeT = types[Math.floor(r2 * types.length)];
        const click = sel => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
        switch (act) {
          case 'split': click(`.win[data-id="${id}"] .b-s${r2 < 0.5 ? 'r' : 'c'}`) || click(`.win[data-id="${id}"] .b-more`); break;
          case 'close': click(`.win[data-id="${id}"] .b-x`); break;
          case 'type': J.commit('chaos: typ', L2 => { if (!L2.wins[id]) return false; L2.wins[id].type = typeT; L2.wins[id].st = {}; }); break;
          case 'float': click(`.win[data-id="${id}"] .b-fl`); break;
          case 'dock': { const f = L.floats[0]; if (f) click(`.win[data-id="${f.id}"] .b-fl`); break; }
          case 'max': click(`.win[data-id="${id}"] .b-mx`); break;
          case 'zoom': { const w = L.wins[id]; if (w) { w.z = Math.round((0.5 + r2 * 2) * 100) / 100; J.apply(); } break; }
          case 'undo': J.undo(); break;
          case 'redo': J.redo(); break;
          case 'tab': J.setSpace(J.store.spaces[Math.floor(r * J.store.spaces.length)].id); break;
          case 'newtab': click('.jk-tab-add'); { const mi = document.querySelectorAll('.jk-menu .mi'); if (mi.length) mi[Math.floor(r2 * Math.min(mi.length, 8))].click(); } break;
          case 'deltab': if (J.store.spaces.length > 2) { const sp = J.store.spaces[Math.floor(r * J.store.spaces.length)]; const tab = document.querySelector(`.jk-tab[data-sp="${sp.id}"]`); if (tab) { tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })); const b = [...document.querySelectorAll('.jk-menu .mi')].find(x => x.textContent.includes('Usuń układ')); b?.click(); } } break;
          case 'rename': { const sp = J.store.spaces[Math.floor(r * J.store.spaces.length)]; sp.name = ['sadasdasda', '1!@#SAd132412', 'Żółć ąę', 'x'.repeat(50), 'Ąę ż ;)', '<b>html</b>'][Math.floor(r2 * 6)]; } break;
          case 'select': { const n = ['Combat-Lab', 'ReflexBrain-Lab', 'Mini_Feniks', 'Jozz-Cave-Workbench', 'Tysi-c-The-Game'][Math.floor(r * 5)]; J.select(n, 'win'); } break;
          case 'wall': { const w = document.querySelector('.win:not([hidden]) .wall2'); if (w) { const b = w.getBoundingClientRect(); w.dispatchEvent(new WheelEvent('wheel', { deltaY: (r2 - 0.5) * 400, clientX: b.left + b.width * r, clientY: b.top + b.height / 2, bubbles: true, cancelable: true })); } } break;
          case 'note': { const ta = document.querySelector('.win:not([hidden]) textarea.jk-notes'); if (ta) { ta.value += ' chaos' + Math.floor(r * 100); ta.dispatchEvent(new Event('input')); ta.dispatchEvent(new Event('blur')); } } break;
          case 'save': document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })); break;
          case 'restoreTrash': { const b = document.querySelector('.jk-toast-b'); if (b) b.click(); } break;
          case 'resetspace': if (J.store.spaces[0].preset) { const tab = document.querySelector(`.jk-tab[data-sp="${J.store.cur}"]`); } break;
          case 'lang': break;
          case 'menu': click(`.win[data-id="${id}"] .b-more`); break;
          case 'back': if (document.querySelector('.jk-menu.sheet')) history.back(); break; // Back with a sheet open closes the sheet, never the page
        }
      }, [act, r, r2, types]);
    } catch (e) { errs.push('step ' + i + ' ' + act + ': ' + e.message); }
    await page.waitForTimeout(act === 'tab' || act === 'newtab' ? 120 : 40);
    if (i % 10 === 9 || i === STEPS - 1) {
      await page.waitForTimeout(250);
      const inv = await page.evaluate(() => {
        const J = window.__JASK, out = [];
        const all = J.store.spaces.flatMap(sp => Object.keys(sp.L.wins));
        if (new Set(all).size !== all.length) out.push('duplicate window ids');
        for (const sp of J.store.spaces) {
          const leaves = J.leafIds(sp.L.tree);
          if (!leaves.length) out.push('empty tree in ' + sp.name);
          for (const id of leaves) if (!sp.L.wins[id]) out.push('leaf without window in ' + sp.name);
          for (const k of Object.keys(sp.L.wins)) if (!leaves.includes(k) && !sp.L.floats.some(f => f.id === k)) out.push('orphan window in ' + sp.name);
          for (const w of Object.values(sp.L.wins)) if (w.type === 'notatki' && !(w.st && w.st.note)) out.push('notes window without a note');
        }
        if (document.querySelectorAll('.win:not([hidden]) .jk-err').length) out.push('window failed to draw: ' + [...document.querySelectorAll('.win:not([hidden]) .jk-err')].map(e => e.textContent).join(' / '));
        if ((document.querySelector('.jk-bar')?.textContent || '').includes('null')) out.push('null in bar');
        J.persistNow();
        try { JSON.parse(localStorage.getItem('jaskinia:v3')); } catch { out.push('store not JSON'); }
        return out;
      });
      if (inv.length) { bad++; console.log(`[${mode}] step ${i}: ${inv.join('; ')} (last: ${log.slice(-6).join(',')})`); }
    }
  }
  // reload: the same state comes back
  const snap = () => page.evaluate(() => JSON.stringify({ cur: __JASK.store.cur, n: __JASK.store.spaces.map(sp => [sp.name, JSON.stringify(sp.L.tree), Object.values(sp.L.wins).map(w => w.type).join()]), notes: __JASK.store.notes }));
  await page.evaluate(() => __JASK.persistNow());
  const before = await snap();
  await page.reload(); await page.waitForTimeout(1200);
  const after = await snap();
  if (before !== after) {
    bad++;
    const A = JSON.parse(before), Bq = JSON.parse(after);
    console.log(`[${mode}] reload changed the state: cur ${A.cur}→${Bq.cur}; spaces ${A.n.length}→${Bq.n.length}`);
    A.n.forEach((x, i) => { const y = Bq.n[i]; if (JSON.stringify(x) !== JSON.stringify(y)) console.log('  space', i, String(JSON.stringify(x)).slice(0, 160), '→', String(JSON.stringify(y)).slice(0, 160)); });
    for (const k of new Set([...Object.keys(A.notes), ...Object.keys(Bq.notes)])) if (JSON.stringify(A.notes[k]) !== JSON.stringify(Bq.notes[k])) console.log('  note', k, JSON.stringify(A.notes[k]), '→', JSON.stringify(Bq.notes[k]));
  }
  const bannerAfter = await page.locator('.jk-banner.warn').count();
  if (bannerAfter) { bad++; console.log(`[${mode}] reload showed a damage warning`); }
  console.log(`[${mode}] ${STEPS} steps, ${errs.length} console errors, spaces ${await page.evaluate(() => __JASK.store.spaces.length)}, trash ${await page.evaluate(() => __JASK.store.trash.length)}, copies ${await page.evaluate(() => __JASK.readBackups().length)}`);
  if (errs.length) { bad++; console.log(errs.slice(0, 8).join('\n')); }
  await ctx.close();
}
await browser.close();
console.log(bad ? `PROBLEMS: ${bad}` : 'chaos survived');
process.exit(bad ? 1 : 0);
