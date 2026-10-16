// Every window type, maximized, at 1918x1030 and in a narrow 560px float. node tools/jk_types.mjs <outdir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'shots/jkt');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1918, height: 1030 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto('file://' + path.join(root, 'dist/_jk_test.html'));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('jaskinia:hint', '1'); });
await page.reload(); await page.waitForTimeout(1200);
const types = await page.evaluate(() => [...document.querySelectorAll('.win')].length && null);
const list = ['wybor', 'mapa', 'sciana', 'kataster', 'spis', 'zagraj', 'ustalenia', 'zmiany', 'karta', 'gra', 'galezie', 'rytm', 'stan', 'dane', 'statystyki', 'wykres', 'ranking', 'rok', 'zegar', 'puls', 'historia', 'notatki', 'wiedza'];
for (const t of list) {
  await page.evaluate(t => { const L = __JASK.L; const id = Object.keys(L.wins).find(k => L.wins[k].type === 'mapa' || L.wins[k].__probe); L.wins[id].__probe = 1; __JASK.commit('test', () => { L.wins[id].type = t; L.wins[id].st = {}; L.max = id; }); }, t);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `t-${t}.png`) });
  const e = errs.splice(0);
  const empty = await page.evaluate(() => { const w = document.querySelector('.win.maxed .wz'); return w ? w.textContent.trim().length + w.querySelectorAll('svg,canvas,iframe').length : -1; });
  console.log(t, 'content', empty, e.length ? 'ERR ' + e.join(' | ') : '');
}
// narrow: put each into a 520px floating window
await page.evaluate(() => { const L = __JASK.L; L.max = null; __JASK.apply(); });
for (const t of ['kataster', 'karta', 'statystyki', 'wykres', 'ranking', 'sciana', 'galezie', 'gra', 'stan', 'historia', 'ustalenia', 'zagraj', 'wiedza']) {
  await page.evaluate(t => { const L = __JASK.L; const id = Object.keys(L.wins).find(k => L.wins[k].__probe); __JASK.commit('test', () => { L.wins[id].type = t; L.wins[id].st = {}; L.max = id; }); }, t);
  await page.setViewportSize({ width: 520, height: 900 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `n-${t}.png`) });
  const e = errs.splice(0);
  const ov = await page.evaluate(() => { const b = document.querySelector('.win.maxed .wbody'); return b ? b.scrollWidth - b.clientWidth : -1; });
  console.log('narrow', t, 'overflowX', ov, e.length ? 'ERR ' + e.join(' | ') : '');
  await page.setViewportSize({ width: 1918, height: 1030 });
}
await browser.close();
