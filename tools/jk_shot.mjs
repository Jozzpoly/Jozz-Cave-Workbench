// Open dist/jaskinia.html in an artifact-like skeleton and screenshot it. Usage: node tools/jk_shot.mjs <out.png> [WxH] [light] [js-to-eval-before-shot]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'shots/jk.png');
const [w, hgt] = (process.argv[3] || '1918x1030').split('x').map(Number);
const light = process.argv[4] === 'light';
const evalJs = process.argv[5] || '';
const body = fs.readFileSync(path.join(root, 'dist/jaskinia.html'), 'utf8');
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const test = path.join(root, 'dist/_jk_test.html');
fs.writeFileSync(test, skel);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, colorScheme: light ? 'light' : 'dark', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto('file://' + test);
await page.waitForTimeout(900);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
if (evalJs) { await page.evaluate(evalJs); await page.waitForTimeout(600); }
const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await page.screenshot({ path: out });
console.log(`shot ${out} overflowX=${ov}`);
if (errs.length) console.log(errs.join('\n'));
await browser.close();
