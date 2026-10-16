// Jaskinia v2 smoke run: loads the page on a desk and on a phone, collects console errors, takes screenshots.
// node tools/jk2_smoke.mjs [shotdir]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk2');
fs.mkdirSync(shots, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_test.html');
fs.writeFileSync(test, skel);
const browser = await chromium.launch();
const errs = [];
const watch = (page, tag) => {
  page.on('console', m => { if (m.type() === 'error') errs.push(`[${tag}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errs.push(`[${tag}] pageerror: ${e.message} ${(e.stack || '').split('\n').slice(1, 4).join(' ')}`));
};
const wait = (p, ms) => p.waitForTimeout(ms);

// ---- desk ----
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await ctx.newPage();
  watch(page, 'desk');
  await page.goto('file://' + test);
  await wait(page, 1200);
  await page.screenshot({ path: path.join(shots, 'd01-przeglad.png') });
  const s = await page.evaluate(() => ({ spaces: __JASK.store.spaces.map(x => x.name), cur: __JASK.store.cur, wins: Object.values(__JASK.L.wins).map(w => w.type) }));
  console.log('desk state', JSON.stringify(s));
  for (const sp of ['granie', 'statystyki', 'projekt', 'sciana']) {
    await page.evaluate(id => __JASK.setSpace(id), sp);
    await wait(page, 900);
    await page.screenshot({ path: path.join(shots, `d02-${sp}.png`) });
  }
  await page.evaluate(() => __JASK.openSettings('wyglad'));
  await wait(page, 700);
  await page.screenshot({ path: path.join(shots, 'd03-settings.png') });
  await ctx.close();
}
// ---- phone ----
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
  const page = await ctx.newPage();
  watch(page, 'phone');
  await page.goto('file://' + test);
  await wait(page, 1200);
  await page.screenshot({ path: path.join(shots, 'p01-start.png') });
  console.log('phone mode', await page.evaluate(() => __JASK.phone));
  await page.evaluate(() => __JASK.setSpace('sciana'));
  await wait(page, 900);
  await page.screenshot({ path: path.join(shots, 'p02-sciana.png') });
  await ctx.close();
}
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
