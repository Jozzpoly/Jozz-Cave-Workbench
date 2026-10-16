// Isolated owner-UX qualification of multi-game launching. No real games and no private saves.
// Intended run (from the repository): npm ci && node tools/jk5_multi_game_probe.mjs
// This test regenerates a current web build, opens it in Chromium, and uses two local fixture games.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npm', ['run', 'jaskinia'], { cwd: root, stdio: 'inherit' });
const dist = path.join(root, 'dist');
const files = ['_gpt_multi_a.html', '_gpt_multi_b.html', '_gpt_multi_test.html'];
function game(name) {
  return '<!doctype html><html><head><meta charset="utf-8"></head><body>'
    + '<h1>' + name + '</h1>'
    + '<button onclick="window.__clicks++">Interact</button>'
    + '<script>window.__multiBoot = String(Math.random()) + ":" + Date.now();'
    + 'window.__clicks = 0; window.__name = "' + name + '";<\/script></body></html>';
}
fs.writeFileSync(path.join(dist, files[0]), game('A'));
fs.writeFileSync(path.join(dist, files[1]), game('B'));
const body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
fs.writeFileSync(path.join(dist, files[2]),
  '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<style>:root{color-scheme:light}[hidden]{display:none!important}</style></head><body>'
  + body + '</body></html>');

let server, browser, ctx;
let failed = 0, passed = 0;
function check(cond, name, evidence = '') {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (evidence ? ': ' + evidence : ''));
  if (cond) passed++; else failed++;
}
try {
  server = await serve(dist);
  browser = await chromium.launch();
  ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => {
    window.__JASK_PLACE = 'web';
    try { localStorage.setItem('jaskinia:hint', '1'); } catch { /* ephemeral profile */ }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(server.base + '/' + files[2]);
  await page.waitForFunction(() => !!(window.__JASK && window.__BIB && window.__BIB.HOOK.play), null, { timeout: 20000 });
  // Use the same hook called by genuine "Zagraj" links, with local fake game URLs.
  const state = await page.evaluate(({ a, b }) => {
    const J = window.__JASK, B = window.__BIB;
    J.setPref('games', 'okno');
    const ids = ['Combat-Lab', 'ReflexBrain-Lab'];
    if (!ids.every(id => B.R[id] && B.R[id].pages)) return { error: 'fixtures' };
    B.R[ids[0]].pages = a;
    B.R[ids[1]].pages = b;
    const beforeSelection = J.store.sel;
    const results = [B.HOOK.play(B.R[ids[0]]), B.HOOK.play(B.R[ids[1]])];
    const windows = Object.entries(J.L.wins).filter(([, w]) => w.type === 'gra' && w.pin && ids.includes(w.pin));
    return { beforeSelection, afterSelection: J.store.sel, results, windows: windows.map(([id, w]) => ({ id, pin: w.pin })) };
  }, { a: server.base + '/' + files[0], b: server.base + '/' + files[1] });
  if (state.error) throw Error('Fixture projects unavailable: ' + state.error);
  check(state.results.every(Boolean), 'each Play action opens an in-window game');
  check(state.windows.length === 2 && new Set(state.windows.map(w => w.id)).size === 2
    && new Set(state.windows.map(w => w.pin)).size === 2,
  'two different Play actions create two distinct pinned game windows', JSON.stringify(state.windows));
  check(state.beforeSelection === state.afterSelection,
    'opening games leaves the selection used by unrelated panels unchanged');
  const boot = async id => page.evaluate(id => {
    const f = document.querySelector('.win[data-id="' + id + '"] iframe');
    return f?.contentWindow?.__multiBoot || null;
  }, id);
  await page.waitForTimeout(600);
  const origins = await Promise.all(state.windows.map(w => boot(w.id)));
  check(origins.every(Boolean), 'both fixture games actually boot in frames', JSON.stringify(origins));
  await page.evaluate(() => { window.__JASK.select('Mini_Feniks'); window.__JASK.setPref('theme', 'kataster'); });
  await page.waitForTimeout(600);
  const after = await Promise.all(state.windows.map(w => boot(w.id)));
  check(origins.every((x, i) => x && x === after[i]), 'unrelated selection and theme do not restart either game');
  const third = await page.evaluate(() => {
    const B = window.__BIB;
    B.HOOK.play(B.R['Combat-Lab']);
    return Object.entries(window.__JASK.L.wins)
      .filter(([, w]) => w.type === 'gra' && w.pin === 'Combat-Lab').map(([id]) => id);
  });
  check(third.length === 2 && new Set(third).size === 2,
    'relaunching the same game creates an additional instance', JSON.stringify(third));
  const snapshot = await page.evaluate(ids => {
    const f = id => document.querySelector('.win[data-id="' + id + '"] iframe')?.contentWindow;
    const first = f(ids[0]), second = f(ids[1]);
    if (!first || !second) return null;
    first.__clicks++;
    first.localStorage.setItem('__multi_probe_shared', 'from_first');
    return { first: first.__clicks, second: second.__clicks,
      sameOriginSharedStorage: second.localStorage.getItem('__multi_probe_shared') === 'from_first' };
  }, state.windows.map(w => w.id));
  check(snapshot?.first === 1 && snapshot?.second === 0, 'runtime counters remain instance-local', JSON.stringify(snapshot));
  check(snapshot?.sameOriginSharedStorage === true,
    'limitation exposed: same-origin frames still share localStorage; not independent saved sessions');
  // The launch may be technically independent yet visually obscure the previous game.
  // Record this as an OWNER-UX observation, not a false mechanical FAIL/pass.
  const rects = await page.evaluate(ids => ids.map(id => {
    const frame = document.querySelector('.win[data-id="' + id + '"]');
    const r = frame?.getBoundingClientRect();
    return r && { id, x: r.x, y: r.y, w: r.width, h: r.height };
  }), state.windows.map(w => w.id));
  if (rects.every(Boolean)) {
    const [a, b] = rects, iw = Math.max(0, Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x,b.x));
    const ih = Math.max(0, Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y,b.y));
    const overlap = iw * ih / Math.min(a.w*a.h, b.w*b.h);
    console.log('OWNER-UX OBSERVATION: initial game-window overlap = ' + Math.round(overlap*100)
      + '% of smaller window; a separate usability decision remains');
  }
  check(!errors.length, 'no uncaught page errors', errors.slice(0, 4).join('; '));
  console.log('\n' + passed + ' PASS / ' + failed + ' FAIL');
} finally {
  if (ctx) await ctx.close();
  if (browser) await browser.close();
  if (server) server.close(); // serve() exposes a no-argument close wrapper
  for (const file of files) fs.rmSync(path.join(dist, file), { force: true });
}
process.exit(failed ? 1 : 0);
