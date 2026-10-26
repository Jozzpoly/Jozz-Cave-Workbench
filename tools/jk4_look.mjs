// Jaskinia v4: screenshots of the states the owner's recordings of 15–16 Oct 2026 pointed at, for a human look.
// node tools/jk4_look.mjs [shotdir] [scenario]   (served over http, like the tests)
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk4look');
const which = process.argv[3] || 'all';
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_look4.html');
fs.writeFileSync(test, skel);
const SRV = await serve(path.dirname(test));
const browser = await chromium.launch();
const errs = [];
async function open(opts = {}) {
  const ctx = await browser.newContext(opts.phone ? { ...devices['Pixel 7'], colorScheme: opts.scheme || 'dark' } : { viewport: opts.size || { width: 1916, height: 908 }, deviceScaleFactor: 1, colorScheme: opts.scheme || 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* fine */ } });
  if (opts.prefs) await ctx.addInitScript(p => { try { if (!sessionStorage.getItem('p')) { localStorage.setItem('jaskinia:prefs', JSON.stringify(p)); sessionStorage.setItem('p', '1'); } } catch { /* fine */ } }, opts.prefs);
  if (opts.place) await ctx.addInitScript(p => { window.__JASK_PLACE = p; }, opts.place);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(SRV.base + '/' + path.basename(test));
  await page.waitForTimeout(900);
  return { ctx, page, J: (f, a) => page.evaluate(f, a), wait: ms => page.waitForTimeout(ms), shot: (n, clip) => page.screenshot({ path: path.join(shots, n + '.png'), clip }) };
}
const want = k => which === 'all' || which === k;

if (want('bar')) {
  const { ctx, page, shot, wait } = await open();
  await shot('a01-bar', { x: 0, y: 0, width: 760, height: 46 });
  const puls = page.locator('.win[data-type="puls"]');
  const b = await puls.boundingBox();
  await shot('a02-puls-desk', b);
  await page.locator('.jk-snap').click(); await wait(300);
  await shot('a03-snapinfo', { x: 0, y: 0, width: 760, height: 320 });
  await ctx.close();
}
if (want('pulsphone')) {
  const { ctx, page, shot, wait, J } = await open({ phone: true });
  await page.locator('.jk-dock .dk-i', { hasText: 'Puls' }).click(); await wait(700);
  await shot('a04-puls-phone');
  await ctx.close();
}

if (want('wall')) {
  // the owner's 02_PC moves: ReflexBrain made a strip by hand, a note on the wall, then "Ułóż… według rodzin"
  const { ctx, page, shot, wait, J } = await open();
  await J(() => __JASK.setSpace('sciana')); await wait(700);
  const id = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'sciana'));
  await J(id => { const st = __JASK.L.wins[id].st; __JASK.commit('look', () => { st.cards['ReflexBrain-Lab'].w = 42; st.cards['ReflexBrain-Lab'].h = 99; }); }, id);
  const arrange = async () => { await page.locator('.win[data-type="sciana"] button:has-text("Ułóż")').click(); await wait(200); await page.locator('.jk-menu .mi:has-text("Według rodzin")').click(); await wait(700); };
  await arrange();
  await J(id => { const st = __JASK.L.wins[id].st, c = st.cards['ReflexBrain-Lab']; __JASK.commit('look: notatka', () => { st.notes.push({ id: 'nLook', x: c.x - 60, y: c.y - 50, w: 184, h: 105, tone: 'zolty' }); }); __JASK.store.notes.nLook = { text: 'Test notatka.\n\npozdro od Jozza ;>', upd: Date.now() }; }, id);
  await wait(300);
  await arrange();
  await wait(500);
  await shot('b01-wall-after-arrange');
  await J(id => { const st = __JASK.L.wins[id].st, c = st.cards['ReflexBrain-Lab']; __JASK.store.views[id] = { cam: { cx: c.x, cy: c.y, z: 0.71 } }; __JASK.apply(); }, id);
  await J(() => __JASK.setSpace('przeglad')); await wait(300); await J(() => __JASK.setSpace('sciana')); await wait(800);
  await shot('b02-wall-71pct');
  await ctx.close();
}
if (want('zar')) {
  const { ctx, page, shot, wait, J } = await open({ prefs: { life: 'zar' } });
  await wait(400);
  await shot('b03-zar-przeglad');
  await J(() => __JASK.setSpace('sciana')); await wait(900);
  await shot('b04-zar-sciana');
  await ctx.close();
  const o2 = await open({ prefs: { life: 'zielen' } });
  await o2.J(() => __JASK.setSpace('sciana')); await o2.wait(900);
  await o2.shot('b05-zielen-sciana');
  await o2.ctx.close();
}
if (want('phonewall')) {
  const { ctx, page, shot, wait, J } = await open({ phone: true });
  await J(() => __JASK.setSpace('sciana')); await wait(900);
  const id = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'sciana'));
  // the pinch that landed in empty space (05_MOBILE 02:19): the view far from every card
  await J(id => __JASK.WALLS.get(id).setCam({ cx: 99000, cy: 99000, z: 0.85 }), id); await wait(500);
  await shot('b06-phone-wall-empty');
  await page.locator('.w2-empty').click(); await wait(700);
  await shot('b07-phone-wall-back');
  await page.locator('.win[data-type="sciana"]:not(.off) .b-more').click(); await wait(400);
  await shot('b08-phone-wall-menu');
  await ctx.close();
}
if (want('float')) {
  const { ctx, page, shot, wait, J } = await open();
  const kid = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'kataster'));
  await page.locator(`.win[data-id="${kid}"] .b-fl`).click(); await wait(400);
  await page.locator(`.win[data-id="${kid}"] .b-sr`).click(); await wait(500);
  await shot('b09-float-split');
  await ctx.close();
}

if (want('en')) {
  const { ctx, page, shot, wait, J } = await open({ prefs: { lang: 'en' } });
  await wait(400);
  await page.locator('.jk-brand').click(); await wait(300);
  await shot('c01-en-menu');
  await page.keyboard.press('Escape');
  await J(() => __JASK.openSettings('uwagi')); await wait(500);
  await shot('c02-en-uwagi');
  await ctx.close();
}
if (want('phonemenu')) {
  const { ctx, page, shot, wait } = await open({ phone: true });
  await page.locator('.jk-brand').click(); await wait(400);
  await shot('c03-phone-menu');
  await page.locator('.jk-menu .mi:has-text("To mnie uwiera")').click(); await wait(400);
  await shot('c04-phone-uwaga');
  await ctx.close();
}

if (want('themes')) {
  for (const [k, pr] of [['kataster', { theme: 'kataster' }], ['kataster-zar', { theme: 'kataster', life: 'zar' }], ['light', { scheme: 'jasna' }], ['neon-zar', { theme: 'neon', life: 'zar' }], ['piwnica', { theme: 'piwnica' }]]) {
    const { ctx, page, shot, wait, J } = await open({ prefs: pr });
    await wait(500);
    await shot('e-' + k + '-przeglad');
    await J(() => __JASK.setSpace('sciana')); await wait(900);
    await shot('e-' + k + '-sciana');
    await ctx.close();
  }
}

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await browser.close(); SRV.close();
fs.rmSync(test, { force: true });
