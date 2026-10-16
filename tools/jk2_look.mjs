// Jaskinia v2: screenshots of specific states for a human look. node tools/jk2_look.mjs [shotdir]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk2look');
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_test.html');
fs.writeFileSync(test, skel);
const browser = await chromium.launch();
const errs = [];
async function open(opts = {}) {
  const ctx = await browser.newContext(opts.phone ? { ...devices['Pixel 7'], colorScheme: opts.scheme || 'dark' } : { viewport: opts.size || { width: 1600, height: 960 }, deviceScaleFactor: 1, colorScheme: opts.scheme || 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* fine */ } });
  if (opts.prefs) await ctx.addInitScript(p => { try { localStorage.setItem('jaskinia:prefs', JSON.stringify(p)); } catch { /* fine */ } }, opts.prefs);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + test);
  await page.waitForTimeout(900);
  return { ctx, page, J: (f, a) => page.evaluate(f, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png') }) };
}
const which = process.argv[3] || 'all';
if (which === 'all' || which === 'map') {
  const { ctx, page, J, wait, shot } = await open();
  const id = await J(() => Object.keys(__JASK.L.wins).find(k => __JASK.L.wins[k].type === 'mapa'));
  await J(id => { __JASK.L.wins[id].z = 1.6; __JASK.apply(); }, id);
  await page.locator(`.win[data-id="${id}"] .wzv`).click(); await wait(200); // 100%
  await J(id => { const rt = __JASK.RT.get(id); }, id);
  await page.mouse.move(400, 400);
  for (let i = 0; i < 5; i++) { await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await wait(80); }
  await wait(700);
  await shot('l01-map-zoomed-in');
  for (let i = 0; i < 9; i++) { await page.keyboard.down('Control'); await page.mouse.wheel(0, 120); await page.keyboard.up('Control'); await wait(80); }
  await wait(700);
  await shot('l02-map-zoomed-out');
  await ctx.close();
}
if (which === 'all' || which === 'chart') {
  const { ctx, page, J, wait, shot } = await open();
  await J(() => __JASK.setSpace('statystyki')); await wait(700);
  await page.locator('.jk-seg button', { hasText: 'od początku' }).first().click(); await wait(800);
  await shot('l03-stats-all');
  // a narrow chart
  await J(() => { const n = __JASK.L.tree; n.r = 0.55; n.a.r = 0.3; }); await J(() => __JASK.apply()); await wait(900);
  await shot('l04-stats-all-narrow');
  await ctx.close();
}
if (which === 'all' || which === 'light') {
  const { ctx, page, J, wait, shot } = await open({ scheme: 'light' });
  await shot('l05-light-przeglad');
  await J(() => __JASK.setSpace('sciana')); await wait(900);
  await shot('l06-light-sciana');
  await ctx.close();
}
if (which === 'all' || which === 'zar') {
  const { ctx, page, J, wait, shot } = await open({ prefs: { life: 'zar' } });
  await shot('l07-zar-przeglad');
  await ctx.close();
}
if (which === 'all' || which === 'phone') {
  const { ctx, page, J, wait, shot } = await open({ phone: true });
  await page.locator('.jk-spacebtn').tap(); await wait(400);
  await shot('l08-phone-spaces-sheet');
  await page.locator('.jk-scrim').tap({ position: { x: 20, y: 20 } }).catch(() => {}); await wait(300);
  await page.locator('.jk-brand').tap(); await wait(400);
  await shot('l09-phone-main-menu');
  await page.locator('.jk-menu .mi', { hasText: 'Ustawienia' }).first().tap(); await wait(700);
  await shot('l10-phone-settings');
  await J(() => __JASK.setSpace('statystyki')); await wait(800);
  await shot('l11-phone-stats');
  await ctx.close();
}
if (which === 'all' || which === 'en') {
  const { ctx, page, J, wait, shot } = await open({ prefs: { lang: 'en' } });
  await shot('l12-en-przeglad');
  await J(() => __JASK.setSpace('sciana')); await wait(900);
  await page.locator('.win[data-type="sciana"] .jk-tb', { hasText: 'Arrange' }).click(); await wait(300);
  await shot('l13-en-wall-menu');
  await page.keyboard.press('Escape');
  await J(() => __JASK.openSettings('uklady')); await wait(600);
  await shot('l14-en-settings');
  await ctx.close();
}
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
