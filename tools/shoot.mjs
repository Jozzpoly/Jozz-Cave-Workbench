// Render dist/biblioteka.html inside a skeleton like the artifact host's and take screenshots.
// Usage: node tools/shoot.mjs <outdir> [views...]   views: name=hash@WxH[:light]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });
const body = fs.readFileSync(path.join(root, 'dist/biblioteka.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_test.html');
fs.writeFileSync(test, skel);

const views = process.argv.slice(3).length ? process.argv.slice(3) : [
  'pano-dark=#panorama@1440x1000', 'pano-light=#panorama@1440x1000:light', 'pano-phone=#panorama@400x860',
];
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const v of views) {
  const eq = v.indexOf('='), name = v.slice(0, eq), rest0 = v.slice(eq + 1);
  const [rest, ...acts] = rest0.split('|');   // extra steps: |click=<css> |scroll=<css> |eval=<js>
  const [hash, spec] = rest.split('@');
  const [dims, mode] = spec.split(':');
  const [w, hgt] = dims.split('x').map(Number);
  const full = name.endsWith('-full');
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, colorScheme: (mode || '').includes('light') ? 'light' : 'dark', reducedMotion: (mode || '').includes('motion') ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + test + hash);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout((mode || '').includes('motion') ? 2600 : 300);
  for (const a of acts) {
    const [k, ...vv] = a.split('='); const val = vv.join('=');
    try {
      if (k === 'click') { await page.click(val, { timeout: 4000 }); await page.waitForTimeout(350); }
      else if (k === 'scroll') { await page.evaluate(sel => { const el = document.querySelector(sel); if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } }, val); await page.waitForTimeout(300); }
      else if (k === 'eval') { await page.evaluate(val); await page.waitForTimeout(300); }
    } catch (e) { errs.push('step ' + a + ': ' + e.message.split('\n')[0]); }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: full });
  console.log(`${name}: overflowX=${overflow}px ${errs.length ? '\n  ' + errs.slice(0, 8).join('\n  ') : ''}`);
  await ctx.close();
}
await browser.close();
