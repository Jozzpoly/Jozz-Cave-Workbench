// Screenshots of every workspace (fresh storage), plus light theme and phone width. node tools/jk_views.mjs <outdir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'shots/jkv');
fs.mkdirSync(out, { recursive: true });
const test = path.join(root, 'dist/_jk_test.html');
const browser = await chromium.launch();
async function run(name, { w = 1918, hh = 1030, scheme = 'dark', steps = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + test);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('jaskinia:hint', '1'); });
  await page.reload();
  await page.waitForTimeout(1000); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  for (const st of steps) { await page.evaluate(st); await page.waitForTimeout(900); }
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(out, name + '.png') });
  console.log(name, 'overflowX', ov, errs.length ? errs.join(' | ') : '');
  await ctx.close();
}
const sp = id => `__JASK.setSpace('${id}')`;
await run('v1-przeglad');
await run('v2-granie', { steps: [sp('granie')] });
await run('v3-statystyki', { steps: [sp('statystyki')] });
await run('v4-projekt', { steps: [sp('projekt')] });
await run('v5-sciana', { steps: [sp('sciana')] });
await run('v6-light', { scheme: 'light' });
await run('v7-light-stats', { scheme: 'light', steps: [sp('statystyki')] });
await run('v8-phone', { w: 400, hh: 860 });
await run('v9-laptop', { w: 1366, hh: 768 });
await browser.close();
