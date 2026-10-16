// Jaskinia v5 checks: instruments. A lab or game runs in a window and nothing in Jaskinia restarts it; a lab that speaks
// the contract (docs/przyrzad/KONTRAKT.md) says who it is, what is happening and its numbers, gets the owner's remarks,
// and its events land in the log and the package.
// node tools/jk5_test.mjs [shotdir]   (served over http, like the other tests)
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv[2] || path.join(root, 'shots/jk5t');
fs.mkdirSync(shots, { recursive: true });
const dist = path.join(root, 'dist');
for (const f of ['demo.html', 'jaskinia-przyrzad.js']) fs.copyFileSync(path.join(root, 'docs/przyrzad', f), path.join(dist, '_lab_' + f));
fs.writeFileSync(path.join(dist, '_lab_demo.html'), fs.readFileSync(path.join(dist, '_lab_demo.html'), 'utf8').replace('src="jaskinia-przyrzad.js"', 'src="_lab_jaskinia-przyrzad.js"'));
const SRV = await serve(dist);
const LAB = SRV.base + '/_lab_demo.html';
let body = fs.readFileSync(path.join(dist, 'jaskinia.html'), 'utf8');
const pg = body.match(/"pages":"(https:\/\/jozzpoly\.github\.io\/Combat-Lab\/?)"/);
if (pg) body = body.split(pg[1]).join(LAB); // Combat Lab's page is the demo lab, so a "Gra" window can run it here
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
fs.writeFileSync(path.join(dist, '_jk5_test.html'), skel);
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };
const errs = [];
async function open({ phone = false, size = { width: 1600, height: 900 }, place = 'web' } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'], colorScheme: 'dark' } : { viewport: size, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(p => { window.__JASK_PLACE = p; try { if (!sessionStorage.getItem('h')) { localStorage.setItem('jaskinia:hint', '1'); sessionStorage.setItem('h', '1'); } } catch { /* fine */ } }, place);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(SRV.base + '/_jk5_test.html');
  await page.waitForTimeout(800);
  return { ctx, page, J: (fn, a) => page.evaluate(fn, a), wait: ms => page.waitForTimeout(ms), shot: n => page.screenshot({ path: path.join(shots, n + '.png') }) };
}
// an instrument window with the demo lab, in place of the first window of the current layout
const runLab = (J, url) => J(url => { const J = __JASK, id = J.leafIds(J.L.tree)[0]; J.commit('test: przyrząd', L => { L.wins[id].type = 'przyrzad'; L.wins[id].pin = null; L.wins[id].st = { url, title: 'Piłki' }; }); return id; }, url);
const boot = (page, id) => page.evaluate(id => { const f = document.querySelector(`.win[data-id="${id}"] iframe`); try { return f && f.contentWindow && f.contentWindow.__boot || null; } catch { return 'x-origin'; } }, id);
const waitHello = (J, id) => J(async id => { for (let i = 0; i < 60; i++) { const e = __JASK.live().find(x => x.id === id); if (e && e.hello) return e.hello; await new Promise(r => setTimeout(r, 100)); } return null; }, id);

/* ================= a running lab is never restarted by Jaskinia ================= */
{
  const { ctx, page, J, wait, shot } = await open();
  const id = await runLab(J, LAB);
  const hello = await waitHello(J, id);
  ok(hello && hello.name === 'Piłki' && hello.version === 'pokaz 1', 'contract: the lab says who it is', JSON.stringify(hello));
  ok(/Piłki pokaz 1/.test(await page.locator(`.win[data-id="${id}"] .lv-head`).textContent()), 'contract: the window header names the lab', '');
  let b0 = await boot(page, id);
  ok(!!b0, 'the lab runs in the window', b0);
  const kept = async (name, fn, ms = 600) => { await fn(); await wait(ms); const b1 = await boot(page, id); ok(b1 === b0, 'lab keeps running: ' + name, b1 === b0 ? '' : `restarted (${b0} → ${b1})`); b0 = b1; };
  await kept('theme', () => J(() => __JASK.setPref('theme', 'kataster')));
  await kept('light and dark', () => J(() => __JASK.setPref('scheme', __JASK.prefs.scheme === 'jasna' ? 'ciemna' : 'jasna')));
  await kept('life colours', () => J(() => __JASK.setPref('life', 'zar')));
  await kept('density', () => J(() => __JASK.setPref('density', __JASK.prefs.density === 'duza' ? 'zwarta' : 'duza')));
  await kept('zoom of all windows', () => J(() => __JASK.setPref('cz', 1.1)));
  await kept('the games setting', () => J(() => __JASK.setPref('games', 'karta')));
  await kept('maximize and back', async () => { await page.locator(`.win[data-id="${id}"] .b-mx`).click(); await wait(300); await page.locator(`.win[data-id="${id}"] .b-mx`).click(); });
  await kept('float out and dock back', async () => { await page.locator(`.win[data-id="${id}"] .b-fl`).click(); await wait(300); await page.locator(`.win[data-id="${id}"] .b-fl`).click(); });
  await kept('another layout and back', async () => { const cur = await J(() => __JASK.store.cur); await J(() => __JASK.setSpace(__JASK.store.spaces.find(s => s.id !== __JASK.store.cur).id)); await wait(400); await J(c => __JASK.setSpace(c), cur); });
  await kept('a narrow window (phone layout) and back', async () => { await page.setViewportSize({ width: 430, height: 860 }); await wait(700); await page.setViewportSize({ width: 1600, height: 900 }); }, 900);
  await kept('selecting another project', () => J(() => __JASK.select('ReflexBrain-Lab')));
  await kept('undo and redo of something else', async () => { await J(() => { const J = __JASK, other = J.leafIds(J.L.tree)[1]; J.commit('test: inne okno', L => { L.wins[other].z = 1.2; }); J.undo(); J.redo(); }); });
  // the hidden lab is told so (it may rest), and told again when it is back
  const cur = await J(() => __JASK.store.cur);
  await J(() => __JASK.setSpace(__JASK.store.spaces.find(s => s.id !== __JASK.store.cur).id)); await wait(400);
  const hiddenVis = await J(id => __JASK.live().find(x => x.id === id).vis, id);
  await J(c => __JASK.setSpace(c), cur); await wait(400);
  const backVis = await J(id => __JASK.live().find(x => x.id === id).vis, id);
  ok(hiddenVis === false && backVis === true, 'contract: the lab hears when its window is hidden and shown', `${hiddenVis} → ${backVis}`);

  /* ================= what the lab says ================= */
  await wait(1200);
  const live = await J(id => __JASK.live().find(x => x.id === id), id);
  ok(live.state && /piłki, energia/.test(live.state.text), 'contract: the lab says what is happening', live.state && live.state.text);
  ok(['energia', 'odbicia', 'pilki', 'fps'].every(k => live.sigs.includes(k)) && live.n.energia > 5, 'contract: numbers arrive several times a second', JSON.stringify(live.n));
  ok(/piłki, energia/.test(await page.locator(`.win[data-id="${id}"] .lv-what`).textContent()), 'the bar under the lab shows its state', '');
  // events: a click inside the lab
  await page.frameLocator(`.win[data-id="${id}"] iframe`).locator('#add').click(); await wait(400);
  const log = await J(() => __JASK.log.map(e => e.a));
  ok(log.some(a => /przyrząd Piłki: nowa piłka/.test(a)), 'contract: the lab\'s events land in the log', log.filter(a => /przyrząd/.test(a)).slice(-2).join(' | '));
  // the signals window beside it
  await page.locator(`.win[data-id="${id}"] .lv-sig`).click(); await wait(1500);
  const sg = await J(() => { const w = document.querySelector('.win[data-type="sygnaly"]'); if (!w) return null; const cvs = [...w.querySelectorAll('canvas.sg-cv')]; const ink = cvs.map(c => { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }); return { rows: [...w.querySelectorAll('.sg-name')].map(x => x.textContent), ink, vals: [...w.querySelectorAll('.sg-val')].map(x => x.textContent) }; });
  ok(sg && sg.rows.includes('energia') && sg.ink.every(n => n > 20), 'Sygnały: one live plot per number, drawn', sg && JSON.stringify({ rows: sg.rows, ink: sg.ink }));
  await shot('a01-lab-and-signals');
  // the flag pressed inside the lab: Ctrl+. there asks Jaskinia for the note, pinned to this lab
  await page.frameLocator(`.win[data-id="${id}"] iframe`).locator('canvas').click({ position: { x: 40, y: 40 } }); await wait(200);
  await page.keyboard.press('Control+.'); await wait(500);
  const pop = await page.locator('.jk-uwaga').count() ? await page.locator('.jk-uwaga .uw-ctx').textContent() : '';
  ok(/przyrząd „Piłki pokaz 1”/.test(pop) && /przyrząd też ją dostanie/.test(pop), 'flag inside the lab: the note knows the lab and says the lab gets it', pop);
  await page.locator('.jk-uwaga textarea').fill('piłki za szybko gasną'); await page.keyboard.press('Control+Enter'); await wait(500);
  const uw = await J(() => __JASK.uwagi[__JASK.uwagi.length - 1]);
  ok(uw && uw.przyrzad && uw.przyrzad.nazwa === 'Piłki' && /energia/.test(uw.przyrzad.stan || '') && uw.przyrzad.adres, 'the note carries the lab and its state at that second', JSON.stringify(uw && uw.przyrzad).slice(0, 160));
  const got = await page.frameLocator(`.win[data-id="${id}"] iframe`).locator('#trace p').allTextContents();
  ok(got.some(x => /piłki za szybko gasną/.test(x)), 'the lab got the remark for its own trace', got.join(' | '));
  await shot('a02-remark-in-lab');
  // the package
  const pk = await J(() => ({ p: __JASK.packageData(false), txt: __JASK.packageText() }));
  const lab = pk.p.przyrzady.find(x => x.nazwa === 'Piłki');
  ok(lab && lab.stan && lab.sygnaly.energia && lab.sygnaly.energia.probek > 5 && lab.zdarzenia.some(z => /nowa piłka/.test(z.tekst)) && lab.uwagi_jozza.length === 1, 'package: the lab, its state, numbers, events and the remark', lab && JSON.stringify(Object.keys(lab)));
  ok(/## Przyrządy \(\d+\)/.test(pk.txt) && /Piłki pokaz 1/.test(pk.txt) && /\[stan przyrządu: /.test(pk.txt), 'package (text): a section for instruments; the remark shows the lab\'s state', '');

  /* ================= only pages Jaskinia opened may talk, and only in words ================= */
  const forged = await J(async id => {
    window.postMessage({ jaskinia: 1, type: 'hello', name: 'PODRÓBKA', version: 'x' }, '*');
    const f = document.createElement('iframe');
    f.srcdoc = '<script>parent.postMessage({jaskinia:1,type:"event",text:"PODRÓBKA z obcej ramki"},"*")<\/script>';
    document.body.append(f);
    await new Promise(r => setTimeout(r, 400));
    f.remove();
    return { names: __JASK.live().map(x => x.hello && x.hello.name), log: __JASK.log.some(e => /PODRÓBKA/.test(e.a)) };
  }, id);
  ok(!forged.names.includes('PODRÓBKA') && !forged.log, 'only pages Jaskinia itself opened in a window can talk to it', JSON.stringify(forged));
  const tricky = await page.frameLocator(`.win[data-id="${id}"] iframe`).locator('body').evaluate(() => {
    Jaskinia.state('<img src=x onerror="parent.__pwned=1">' + 'x'.repeat(600), { big: 'y'.repeat(20000) });
    Jaskinia.signals({ dobre: 1, zle: 'tekst', nan: NaN, nieskonczone: Infinity });
    Jaskinia.event('<b>pogrubione?</b>');
    return true;
  });
  await wait(600);
  const after = await J(id => { const e = __JASK.live().find(x => x.id === id); return { len: e.state.text.length, big: JSON.stringify(e.state).length, sigs: e.sigs, pwned: !!window.__pwned, html: !!document.querySelector('.lv-what img, .sg-evs b') }; }, id);
  ok(tricky && after.len <= 240 && after.big < 9000 && !after.pwned && !after.html, 'what a lab says is cut to size and shown as text', JSON.stringify({ len: after.len, big: after.big, pwned: after.pwned, html: after.html }));
  ok(after.sigs.includes('dobre') && !after.sigs.includes('zle') && !after.sigs.includes('nan') && !after.sigs.includes('nieskonczone'), 'only finite numbers become signals', after.sigs.join(','));
  await ctx.close();
}

/* ================= a remark about something else is not pinned to a lab in the corner ================= */
{
  const { ctx, page, J, wait } = await open();
  const id = await runLab(J, LAB);
  await waitHello(J, id);
  const other = await J(id => { const J = __JASK, o = J.leafIds(J.L.tree).find(k => k !== id && J.L.wins[k].type === 'kataster') || J.leafIds(J.L.tree).find(k => k !== id); return o; }, id);
  await page.locator(`.win[data-id="${other}"] .whead`).click(); await wait(200);
  await J(id => { const e = __JASK.live().find(x => x.id === id); return e; }, id);
  await J(() => { /* pretend the lab was last touched long ago */ });
  await page.evaluate(() => __JASK.uwagaPop(null)); await wait(400);
  const ctxLine = await page.locator('.jk-uwaga .uw-ctx').textContent();
  ok(!/przyrząd „/.test(ctxLine), 'a remark made in another window is not pinned to an untouched lab', ctxLine);
  await page.keyboard.press('Escape');
  await ctx.close();
}

/* ================= choosing what runs ================= */
{
  const { ctx, page, J, wait, shot } = await open();
  const id = await J(() => { const J = __JASK, id = J.leafIds(J.L.tree)[0]; J.commit('test: pusty przyrząd', L => { L.wins[id].type = 'przyrzad'; L.wins[id].pin = null; L.wins[id].st = {}; }); return id; });
  await wait(500);
  const chips = await page.locator(`.win[data-id="${id}"] .lv-pick .jk-chip`).count();
  ok(chips >= 5, 'the picker offers the projects\' pages', String(chips));
  await shot('b01-picker');
  const inp = page.locator(`.win[data-id="${id}"] .lv-url input`);
  await inp.fill('javascript:alert(1)'); await page.locator(`.win[data-id="${id}"] .lv-url button`).click(); await wait(300);
  ok(await J(id => !__JASK.L.wins[id].st.url, id), 'a javascript: address is refused', '');
  await inp.fill(LAB); await page.locator(`.win[data-id="${id}"] .lv-url button`).click();
  const hello = await waitHello(J, id);
  ok(hello && hello.name === 'Piłki', 'a pasted address runs and talks', JSON.stringify(hello));
  await J(() => __JASK.undo()); await wait(400);
  ok(await page.locator(`.win[data-id="${id}"] .lv-pick`).count() === 1 && /Piłki/.test(await page.locator(`.win[data-id="${id}"] .lv-pick`).textContent()), 'undo goes back to the picker, which now remembers the lab', '');
  await ctx.close();
}

/* ================= "Gra" is an instrument too ================= */
{
  const { ctx, page, J, wait } = await open();
  const id = await J(() => { const J = __JASK, id = J.leafIds(J.L.tree)[0]; J.commit('test: gra', L => { L.wins[id].type = 'gra'; L.wins[id].st = {}; L.wins[id].pin = 'Combat-Lab'; }); return id; });
  const hello = await waitHello(J, id);
  ok(hello && hello.name === 'Piłki', 'a game window talks when its page speaks the contract', JSON.stringify(hello));
  let b0 = await boot(page, id);
  await J(() => __JASK.setPref('theme', 'neon')); await wait(600);
  ok(await boot(page, id) === b0, 'a game keeps running when the theme changes (v4.1 restarted it)', '');
  await page.setViewportSize({ width: 430, height: 860 }); await wait(700); await page.setViewportSize({ width: 1600, height: 900 }); await wait(900);
  ok(await boot(page, id) === b0, 'a game keeps running when the browser gets narrow on a computer', '');
  await ctx.close();
}

/* ================= the demo lab carried inside runs anywhere, even in claude.ai ================= */
{
  const { ctx, page, J, wait } = await open({ place: 'claude' });
  const id = await runLab(J, 'pokaz:pilki');
  const hello = await waitHello(J, id);
  ok(hello && hello.name === 'Piłki', 'the demo lab inside Jaskinia runs and talks, even in claude.ai', JSON.stringify(hello));
  ok(await page.locator(`.win[data-id="${id}"] .jk-game-ext`).count() === 0, 'the demo has no "new tab" link (it lives inside)', '');
  await ctx.close();
}

/* ================= the phone ================= */
{
  const { ctx, page, J, wait, shot } = await open({ phone: true });
  const id = await runLab(J, LAB);
  await J(id => __JASK.select && null, id);
  const hello = await waitHello(J, id);
  ok(!!hello, 'phone: a lab runs in a window and talks', JSON.stringify(hello));
  await page.locator(`.win[data-id="${id}"] .lv-flag`).click(); await wait(400);
  ok(/przyrząd „Piłki pokaz 1”/.test(await page.locator('.jk-uwaga .uw-ctx').textContent()), 'phone: the flag under the lab pins the note to it', '');
  await shot('c01-phone-lab');
  await page.goBack(); await wait(300);
  ok(await page.locator('.jk-uwaga').count() === 0 && /_jk5_test/.test(page.url()), 'phone: Back closes the note and stays in Jaskinia', page.url());
  await ctx.close();
}

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : '');
ok(!errs.length, 'no errors during the whole run', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); SRV.close();
for (const f of ['_jk5_test.html', '_lab_demo.html', '_lab_jaskinia-przyrzad.js']) fs.rmSync(path.join(dist, f), { force: true });
process.exit(fail ? 1 : 0);
