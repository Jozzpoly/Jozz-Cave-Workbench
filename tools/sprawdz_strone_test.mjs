// tools/sprawdz_strone.mjs on a local copy of a published site (10 Nov 2026): it must pass the right build and
// refuse a stale one or a broken one, because the publish job rolls back on its answer.
// node tools/sprawdz_strone_test.mjs [PAGE.html]     (PAGE defaults to dist/jaskinia-web.html)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PAGE = process.argv[2] || path.join(root, 'dist', 'jaskinia-web.html');
const html = fs.readFileSync(PAGE, 'utf8');
const gen = JSON.parse(html.match(/<script[^>]*id="lib-data"[^>]*>([\s\S]*?)<\/script>/)[1]).estate.generated;
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'strona-'));
const put = (page, fp, g = gen) => {
  fs.writeFileSync(path.join(site, 'index.html'), page);
  fs.writeFileSync(path.join(site, 'status.json'), JSON.stringify({ data: { fingerprint: fp, generated: g } }));
};
// like GitHub Pages: a folder address serves its index.html, the query string is ignored
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(site, p);
  if (!f.startsWith(site) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${server.address().port}/`;
let fail = 0;
const ok = (c, n, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fail++; };
// the check runs as a child process, so it gets the real exit code and output; the server keeps answering meanwhile
const { spawn } = await import('node:child_process');
const check = (fp, extra = []) => new Promise(resolve => {
  const p = spawn(process.execPath, [path.join(root, 'tools', 'sprawdz_strone.mjs'), URL0, fp, '--czekaj', '2', ...extra]);
  let s = ''; p.stdout.on('data', d => { s += d; });
  p.on('close', code => resolve({ code, out: (() => { try { return JSON.parse(s.trim().split('\n').pop()); } catch { return { raw: s }; } })() }));
});

put(html, 'abc');
let r = await check('abc');
ok(r.code === 0 && r.out.ok, 'the build that status.json names, and the page starts: passed', JSON.stringify(r.out.page));
r = await check('nowy');
ok(r.code === 1 && /does not serve/.test(r.out.why || ''), 'the address still serves the older build: refused', r.out.why);
put(html.replace('<head>', '<head><script>throw new Error("zepsuta strona")</script>'), 'zly');
r = await check('zly');
ok(r.code === 1 && /zepsuta strona|did not start/.test(r.out.why || ''), 'a page that throws: refused', (r.out.why || '').slice(0, 120));
put(html, 'inne-dane', '1999-01-01T00:00+00:00');
r = await check('inne-dane');
ok(r.code === 1, 'status.json names other data than the page carries: refused', (r.out.why || '').slice(0, 120));
server.close();
fs.rmSync(site, { recursive: true, force: true });
console.log(`\n${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
