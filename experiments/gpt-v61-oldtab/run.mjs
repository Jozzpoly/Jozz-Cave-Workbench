// Isolated Chromium falsifier for the published v6 -> unreleased v6.1 transition.
// Uses the EXACT published v6 HTML git blob and the exact built v6.1 HTML.
// All state lives in an ephemeral Playwright browser context on localhost.
// This is a NEGATIVE RELEASE-READINESS EXPERIMENT, not a passing product gate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../../tools/serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'shots/gpt-v61-oldtab');
const oldPath = path.join(dist, '_gpt61_old_v6.html');
const newPath = path.join(dist, '_gpt61_new_v61.html');
const legacySha = '2fde98717acd65d6ac1718a78fe6167d4d254f47';
const publishedBlob = 'b5f0416af09b0e3c94a786a1fb774a693c00c8df';
const oldBinary = execFileSync('git', ['show', legacySha + ':dist/jaskinia-web.html'], {
  cwd: root, maxBuffer: 12 * 1024 * 1024
});
const computed = execFileSync('git', ['hash-object', '--stdin'], {
  cwd: root, input: oldBinary, encoding: 'utf8'
}).trim();
assert.equal(computed, publishedBlob, 'test must use exactly deployed v6 bytes');
const newBinary = fs.readFileSync(path.join(dist, 'jaskinia-web.html'));
assert.notDeepEqual(oldBinary, newBinary, 'future build must differ from v6');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(oldPath, oldBinary);
fs.writeFileSync(newPath, newBinary);
let srv, browser, context;
const report = {
  purpose: 'Pre-release negative falsifier, not an Owner-data test or release PASS',
  oldCommit: legacySha,
  publishedBlob,
  newRefExpected: 'd95dbe6db09ca273eabd9ca02c674192a562a069',
  origin: 'isolated localhost browser context',
  expectedOutcome: 'older v6 tab may overwrite v6.1 note after the new tab closed',
};
const waitReady = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__JASK && window.__JASK.store), null, { timeout: 30000 });
};
try {
  srv = await serve(dist);
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    window.__JASK_PLACE = 'web';
    try { localStorage.setItem('jaskinia:hint', '1'); localStorage.setItem('jaskinia:v6', '1'); } catch {}
  });
  const A = await context.newPage();
  await waitReady(A, srv.base + '/_gpt61_old_v6.html');
  const noteId = await A.evaluate(() => {
    const id = 'gpt61_synthetic_note';
    window.__JASK.store.notes[id] = { text: 'SYNTHETIC_OLD', upd: 100 };
    window.__JASK.persistNow();
    return id;
  });
  assert.ok(noteId, 'v6 must create synthetic note');
  const B = await context.newPage();
  await waitReady(B, srv.base + '/_gpt61_new_v61.html');
  const before = await B.evaluate(id => window.__JASK.store.notes[id]?.text, noteId);
  assert.equal(before, 'SYNTHETIC_OLD', 'v6.1 must start with previous user data');
  await B.evaluate(id => {
    window.__JASK.noteSet(id, 'SYNTHETIC_NEW');
    window.__JASK.persistNow();
  }, noteId);
  const savedNew = await B.evaluate(id => JSON.parse(localStorage.getItem('jaskinia:v2'))?.notes[id]?.text, noteId);
  assert.equal(savedNew, 'SYNTHETIC_NEW', 'v6.1 must durably write newer note');
  await B.goto('about:blank'); // v6.1 leaves; no modern tab left to rescue stale state.
  const olderMemory = await A.evaluate(id => window.__JASK.store.notes[id]?.text, noteId);
  assert.equal(olderMemory, 'SYNTHETIC_OLD', 'legacy tab has stale in-memory snapshot');
  // Real browser navigation fires pagehide for the still-running v6 code.
  await A.goto('about:blank');
  const C = await context.newPage();
  await waitReady(C, srv.base + '/_gpt61_new_v61.html');
  const after = await C.evaluate(id => window.__JASK.store.notes[id]?.text, noteId);
  const diskAfter = await C.evaluate(id => JSON.parse(localStorage.getItem('jaskinia:v2'))?.notes[id]?.text, noteId);
  report.before = before;
  report.savedNew = savedNew;
  report.staleMemory = olderMemory;
  report.afterReopen = after;
  report.diskAfterReopen = diskAfter;
  report.releaseGate = after === 'SYNTHETIC_NEW' ? 'PASS' : 'FAIL';
  report.observation = after === 'SYNTHETIC_OLD' ? 'OLD_V6_OVERWROTE_NEW_V61' : 'DID_NOT_REPRODUCE_EXPECTED_OLD_WRITE';
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  // This is the bounded 2026-10-18 counterexample campaign; a successful CI job
  // means the *experiment* reproduced the unsafe behavior, NOT that Jaskinia passes.
  assert.equal(report.observation, 'OLD_V6_OVERWROTE_NEW_V61',
    'expected falsifier not observed: investigate test/setup or a changed release contract');
} catch (error) {
  report.executionError = String(error?.stack || error);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(report.executionError);
  process.exitCode = 1;
} finally {
  try { await context?.close(); } catch {}
  try { await browser?.close(); } catch {}
  try { srv?.close(); } catch {}
  for (const p of [oldPath, newPath]) { try { fs.unlinkSync(p); } catch {} }
}
