// Is the page at the live address the page we meant to publish, and does it work? (10 Nov 2026)
// node tools/sprawdz_strone.mjs URL FINGERPRINT [--czekaj SECONDS] [--bez-przegladarki]
//   1. polls URL + status.json until data.fingerprint equals FINGERPRINT (GitHub Pages takes a while to build)
//   2. opens URL in Chromium: the page starts (window.__JASK), carries the data status.json names, has windows on
//      screen, and throws no errors
// Prints one JSON line and exits 0 when both hold, 1 otherwise. The publish job rolls back on 1.
// Status: tymczasowe, together with the self-refreshing Home (.github/workflows/dom-odswiezanie.yml).
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [URL, FP] = args;
const WAIT = +flag('--czekaj', 900);
const NOBROWSER = args.includes('--bez-przegladarki');
if (!URL || !FP) { console.log('usage: node tools/sprawdz_strone.mjs URL FINGERPRINT [--czekaj S] [--bez-przegladarki]'); process.exit(2); }
const base = URL.endsWith('/') ? URL : URL + '/';
const out = { url: base, fingerprint: FP, seen: null, status: null, page: null, ok: false };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const t0 = Date.now();
let st = null;
while (Date.now() - t0 < WAIT * 1000) {
  try {
    const r = await fetch(base + 'status.json?t=' + Date.now(), { cache: 'no-store' });
    out.status = r.status;
    if (r.ok) { st = await r.json(); out.seen = st?.data?.fingerprint || null; if (out.seen === FP) break; }
  } catch (e) { out.status = String(e.message || e).slice(0, 120); }
  await sleep(15000);
}
out.waited_s = Math.round((Date.now() - t0) / 1000);
if (out.seen !== FP) { out.why = 'the address does not serve this build yet'; console.log(JSON.stringify(out)); process.exit(1); }
if (NOBROWSER) { out.ok = true; console.log(JSON.stringify(out)); process.exit(0); }

const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|GPU stall|WebGL/.test(m.text())) errs.push(m.text()); });
  await page.goto(base + '?t=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__JASK && window.__JASK.store, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  out.page = await page.evaluate(() => {
    const d = JSON.parse(document.getElementById('lib-data').textContent);
    return { generated: d.estate.generated, repos: d.repos.length, windows: document.querySelectorAll('.win:not([hidden])').length,
             zagraj: !!document.querySelector('[class*="zagraj"], .jk-play, button') };
  });
  const wanted = st?.data?.generated;
  out.ok = out.page.generated === wanted && out.page.repos > 0 && out.page.windows > 0 && errs.length === 0;
  if (!out.ok) out.why = errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ').slice(0, 300) : `page data ${out.page.generated}, status.json ${wanted}, windows ${out.page.windows}`;
} catch (e) {
  out.why = 'the page did not start: ' + String(e.message || e).slice(0, 200);
} finally {
  await browser.close();
}
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
