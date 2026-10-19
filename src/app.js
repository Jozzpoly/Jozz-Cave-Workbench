(() => {
'use strict';

/* =========================================================
   Biblioteka Jozzpoly — app
   Data: #lib-data (snapshot). Live layers light up when the
   viewer grants them: db (sens), sample (Zapytaj), mcp (na żywo),
   downloads, comments. Everything degrades to the snapshot.
   ========================================================= */

const D = JSON.parse(document.getElementById('lib-data').textContent);
/* The same code also runs inside Jaskinia (BIB_MODE = 'jaskinia'): there the panels live in windows,
   links to a repo select it instead of navigating, and the page shell belongs to jaskinia.js. */
const JASK = typeof BIB_MODE !== 'undefined' && BIB_MODE === 'jaskinia';
const HOOK = {}; // set by Jaskinia: go(hash), refresh(), play(repo)
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NF = new Intl.NumberFormat('pl-PL');
const fmt = n => NF.format(n);
const DAY = 86400;
const SNAP = D.estate.generated_ts;
const nowS = () => Date.now() / 1000;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const R = Object.fromEntries(D.repos.map(r => [r.name, r]));
const FAM = Object.fromEntries(D.families.map(f => [f.id, f]));
const LESSON = Object.fromEntries(D.lessons.map(l => [l.id, l]));

function h(tag, attrs, ...kids) {
  const svg = tag.startsWith('svg:');
  const el = svg ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
const s = (tag, attrs, ...kids) => h('svg:' + tag, attrs, ...kids);

function plural(n, one, few, many) {
  const a = Math.abs(n), m10 = a % 10, m100 = a % 100;
  if (a === 1) return one;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
  return many;
}
const pl = (n, one, few, many) => `${fmt(n)} ${plural(n, one, few, many)}`;
/* unknown is not zero: a repo the API could not see has no PR count, not a zero */
const prOpenTxt = r => r.api === false ? 'otwarte PR: nieznane (brak danych z API)' : pl(r.prs.open, 'otwarty PR', 'otwarte PR', 'otwartych PR');

function ageDays(ts) { return ts ? (nowS() - ts) / DAY : null; }
function heatOf(ts) {
  // Jaskinia colours the state as of the snapshot: an old snapshot must not make living projects look dead
  const a = ts ? ((JASK ? SNAP : nowS()) - ts) / DAY : null;
  if (a == null) return -1;
  if (a <= 1) return 5; if (a <= 3) return 4; if (a <= 7) return 3; if (a <= 14) return 2; if (a <= 30) return 1; return 0;
}
function ago(ts) {
  if (!ts) return 'nigdy';
  const sec = nowS() - ts;
  if (sec < 90) return 'przed chwilą';
  if (sec < 3600) return `${Math.round(sec / 60)} min temu`;
  if (sec < DAY) return `${Math.round(sec / 3600)} godz. temu`;
  const d = Math.floor(sec / DAY);
  if (d === 1) return 'wczoraj';
  if (d < 60) return `${d} dni temu`;
  if (d < 365) return `${Math.round(d / 30)} mies. temu`;
  const y = d / 365;
  return y < 1.5 ? 'ponad rok temu' : `${String(y.toFixed(1)).replace('.', ',')} roku temu`;
}
const DTF = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const DF = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Warsaw' });
const DS = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' });
const LDAY = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });
const DKEY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' });
/* how many days the repo's own state note lags behind the repo's last commit (dual time: a dated quote beside live work) */
function noteLag(r) { const st = r.state; return st?.last_ts && r.last_ts ? Math.max(0, (r.last_ts - st.last_ts) / DAY) : 0; }
const DFS = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' });
const TF = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const when = ts => ts ? DTF.format(new Date(ts * 1000)) : '—';
const day = ts => ts ? DF.format(new Date(ts * 1000)) : '—';
const isoTs = iso => iso ? Date.parse(iso) / 1000 : null;
const cssv = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const HEATVAR = ['--cold', '--h1', '--h2', '--h3', '--h4', '--h5'];
const heatVar = lvl => lvl < 0 ? '--ash' : HEATVAR[lvl];
const heatWord = lvl => ['ponad miesiąc', 'do miesiąca', 'do 2 tygodni', 'do tygodnia', 'do 3 dni', 'dziś'][lvl] ?? 'pusto';
function hashStr(t) { let x = 2166136261; for (const c of t) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; }; }
const routeFor = name => '#repo~' + name;
function openUrl(u) { const a = h('a', { href: u, target: '_blank', rel: 'noopener', style: { display: 'none' } }); document.body.append(a); a.click(); a.remove(); }

/* parcel numbers: order of founding (first commit) */
const FOUNDED = D.repos.filter(r => r.first_ts).sort((a, b) => a.first_ts - b.first_ts);
FOUNDED.forEach((r, i) => { r.no = i + 1; });
D.repos.filter(r => !r.first_ts).forEach(r => { r.no = FOUNDED.length + 1; });
const FENIKS = D.repos.filter(r => r.last_ts && ageDays(r.last_ts) <= 14 && r.life !== 'zakończone').sort((a, b) => b.last_ts - a.last_ts);

/* ---------------- live capabilities (all optional) ---------------- */
const cap = { db: null, user: null, sample: null, mcp: null, downloads: null, comments: null, isOwner: false };
const sense = {}; // key -> {status, text, note, at}
const live = { state: 'idle', pushed: {}, extra: [], checkedAt: null };
const use = name => (window.claude && typeof window.claude.use === 'function') ? window.claude.use(name).catch(() => null) : Promise.resolve(null);

/* ---------------- tooltip + toast ---------------- */
let tipEl = null;
function tip(e, content) {
  if ((e && e.pointerType === 'touch') || HOOK.noTips) return;
  if (!tipEl) { tipEl = h('div', { class: 'tip', role: 'tooltip' }); document.body.append(tipEl); }
  if (content) tipEl.replaceChildren(...[].concat(content)); // null = just follow the pointer
  tipEl.hidden = false;
  const pad = 14, w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + w > innerWidth - 8) x = e.clientX - w - pad;
  if (y + hh > innerHeight - 8) y = e.clientY - hh - pad;
  tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
}
function untip() { if (tipEl) tipEl.hidden = true; }
/* One way of answering what the pointer points at (v6.2; the owner, 18 Oct: the charts were inconsistent — some answered,
   others only through the browser's late plain tooltip). Every chart mark drawn with an SVG <title> loses it (the
   browser's tooltip came after a second, unstyled, on top of ours) and speaks through the same note instead: it lights
   up softly while pointed at, the note follows the pointer, and crossing a gap does not flash. The text stays as the
   mark's accessible name. A chart with its own richer answer marks itself data-own-tip and is left alone. */
function upgradeTitles(root) {
  const one = tt => {
    const el = tt.parentElement;
    if (!el || el.tagName.toLowerCase() === 'svg') return;
    el.dataset.tip = tt.textContent;
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', tt.textContent);
    tt.remove();
  };
  if (root.matches?.('svg title')) one(root);
  else if (root.querySelectorAll) for (const tt of root.querySelectorAll('svg title')) one(tt);
}
/* "5 commitów" says more than "2026-10-12", so a note "head: value" or "head · value" shows the value large and the head
   under it, the way the Puls and Statystyki notes do. A note without either is one plain line. */
function tipBody(text) {
  const m = /^(.*?)(?::| ·) (.+)$/s.exec(text || '');
  return m && m[1].length <= 40 && m[2].length <= 32 ? [h('div', { class: 'tt', text: m[2] }), h('div', { class: 'ts', text: m[1] })] : [h('div', { class: 'ts0', text: text || '' })];
}
{
  const mo = new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) upgradeTitles(n); });
  const start = () => { upgradeTitles(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  let on = null, body = null, offT = 0;
  const off = () => {
    clearTimeout(offT); offT = 0; on?.classList.remove('tip-on'); on = null;
    if (body && tipEl && body.includes(tipEl.firstChild)) untip(); // never hide a note another chart is showing
    body = null;
  };
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[data-tip]');
    if (!el || el.closest('[data-own-tip]')) { if (on && !offT) offT = setTimeout(off, 140); return; }
    clearTimeout(offT); offT = 0;
    if (on !== el) { on?.classList.remove('tip-on'); on = el; el.classList.add('tip-on'); body = tipBody(el.dataset.tip); }
    tip(e, tipEl && body.includes(tipEl.firstChild) ? null : body);
  }, true);
  document.documentElement.addEventListener('mouseleave', off);
  addEventListener('blur', off);
}
function toast(msg) { const t = h('div', { class: 'toast', role: 'status', text: msg }); document.body.append(t); setTimeout(() => t.remove(), 2700); }
async function copyText(text, okMsg = 'Skopiowane') {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' } }); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast(okMsg); } catch { toast('Zaznacz tekst i skopiuj ręcznie'); } ta.remove(); }
}

/* ---------------- sigil: growth rings of a repo ---------------- */
function sigil(repo, size) {
  const c = h('canvas', { class: 'sig' + (repo.life === 'zakończone' ? ' sig-ash' : ''), width: size * 2, height: size * 2, role: 'img',
    'aria-label': `Słoje ${repo.short}: ${repo.commits ? pl(repo.commits, 'commit', 'commity', 'commitów') + ' w ' + pl(repo.active_days, 'aktywnym dniu', 'aktywnych dniach', 'aktywnych dniach') : 'puste repo'}` });
  c.dataset.repo = repo.name; c.dataset.size = size;
  drawSigil(c);
  return c;
}
function drawSigil(c) {
  const repo = R[c.dataset.repo], size = +c.dataset.size;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr; c.height = size * dpr; c.style.width = size + 'px'; c.style.height = size + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, Rmax = size * 0.47;
  const ink2 = cssv('--ink-2'), rule = cssv('--rule-2');
  if (!repo.first_ts) {
    g.setLineDash([3, 4]); g.strokeStyle = rule; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, Rmax * 0.82, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = rule; g.beginPath(); g.arc(cx, cy, 2, 0, Math.PI * 2); g.fill();
    return;
  }
  // one ring per active day (earlywood/latewood), compressed gaps for quiet days, medullary rays for branches
  const act = Object.entries(repo.days).map(([d, n]) => ({ di: Math.floor(Date.parse(d + 'T12:00:00Z') / 1000 / DAY), n })).sort((a, b) => a.di - b.di);
  const maxN = Math.max(1, ...act.map(a => a.n));
  const core = size * 0.06;
  const units = [];
  act.forEach((a, i) => {
    if (i) { const gap = a.di - act[i - 1].di - 1; if (gap > 0) units.push({ gap: true, w: Math.min(1.4, 0.22 * Math.log2(1 + gap)), di: a.di - 1 }); }
    units.push({ n: a.n, di: a.di, w: 0.55 + 2.4 * Math.sqrt(a.n / maxN) });
  });
  const total = units.reduce((s0, u) => s0 + u.w, 0) || 1;
  // a young repo is a sapling: the trunk grows with the number of active days (full size from ~30)
  const grow = Math.min(1, 0.36 + 0.64 * Math.sqrt(Math.min(1, act.length / 30)));
  const Rt = Rmax * grow;
  const kk = (Rt * 0.92 - core) / total;
  let rr = core;
  for (const u of units) { u.r1 = rr; rr += u.w * kk; u.r2 = rr; }
  const radiusAt = di => {
    if (!units.length) return core;
    if (di <= units[0].di) return units[0].r1;
    for (const u of units) if (u.di >= di) return u.r2;
    return units[units.length - 1].r2;
  };
  const rand = rng(hashStr(repo.name));
  const phase = rand() * Math.PI * 2, wob = 0.03 + rand() * 0.025, lobes = 3 + Math.floor(rand() * 3);
  const warp = (a, rad) => 1 + wob * Math.sin(a * lobes + phase) * (rad / Rmax) + 0.012 * Math.sin(a * 9 + phase * 2) * (rad / Rmax);
  const shape = rad => {
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2, m = warp(a, rad);
      const x = cx + Math.cos(a) * rad * m, y = cy + Math.sin(a) * rad * m;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  };
  const lastLvl = heatOf(repo.last_ts);
  if (grow < 0.98) { // room to grow: a faint dotted outline of the full-size trunk
    g.setLineDash([1, 3.5]); g.strokeStyle = rule; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, Rmax * 0.93, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  if (lastLvl >= 2) {
    const grd = g.createRadialGradient(cx, cy, Rt * 0.55, cx, cy, Rt * 1.12);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, cssv('--glow'));
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, Rt * 1.12, 0, Math.PI * 2); g.fill();
  }
  // bark
  shape(Rt * 0.97); g.fillStyle = cssv('--plate-3'); g.fill();
  const ground2 = cssv('--ground-2'), groundC = cssv('--ground');
  const heatCols = HEATVAR.map(v => cssv(v));
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    shape(u.r2);
    if (u.gap) { g.fillStyle = ground2; g.globalAlpha = 1; }
    else {
      const lvl = heatOf((u.di + 0.5) * DAY);
      const strong = Math.sqrt(u.n / maxN);
      if (lvl >= 1) { g.fillStyle = heatCols[lvl]; g.globalAlpha = 0.55 + 0.45 * strong; }
      else { g.fillStyle = i % 2 ? ink2 : cssv('--ink-3'); g.globalAlpha = 0.25 + 0.6 * strong; }
    }
    g.fill(); g.globalAlpha = 1;
    g.strokeStyle = groundC; g.lineWidth = u.gap ? 0.3 : 0.55; g.stroke();
  }
  // medullary rays = branches: from the fork ring out to the tip ring
  const rays = repo.branches.filter(b => !b.roles.includes('domyślna'));
  const link = cssv('--link');
  for (const b of rays) {
    const a = (hashStr(b.n) % 3600) / 3600 * Math.PI * 2;
    const r1 = radiusAt(Math.floor((b.fork || b.ts) / DAY)), r2 = Math.min(Rt * 0.97, radiusAt(Math.floor(b.ts / DAY)) + size * 0.02);
    const m1 = warp(a, r1), m2 = warp(a, r2);
    const decl = b.roles.includes('wskazana');
    g.strokeStyle = decl ? link : (heatOf(b.ts) >= 1 ? heatCols[heatOf(b.ts)] : groundC);
    g.globalAlpha = decl ? 1 : 0.75;
    g.lineWidth = decl ? Math.max(1.2, size / 70) : Math.max(0.6, size / 160);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r1 * m1, cy + Math.sin(a) * r1 * m1); g.lineTo(cx + Math.cos(a) * r2 * m2, cy + Math.sin(a) * r2 * m2); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = cssv('--ink'); g.beginPath(); g.arc(cx, cy, Math.max(1.3, core * 0.42), 0, Math.PI * 2); g.fill();
}
function redrawSigils() { $$('canvas.sig').forEach(drawSigil); }

/* ---------------- sparkline of the last N days ---------------- */
function spark(repo, days = 63, w = 160, hgt = 30) {
  const end = Math.floor(nowS() / DAY), vals = [];
  for (let i = days - 1; i >= 0; i--) {
    const dd = new Date((end - i) * DAY * 1000).toISOString().slice(0, 10);
    vals.push(repo.days[dd] || 0);
  }
  const mx = Math.max(1, ...vals);
  const bw = w / days;
  const svg = s('svg', { class: 'spark', viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, role: 'img',
    'aria-label': `Ostatnie ${days} dni: ${pl(vals.reduce((a, b) => a + b, 0), 'commit', 'commity', 'commitów')}` });
  svg.append(s('line', { x1: 0, x2: w, y1: hgt - 0.5, y2: hgt - 0.5, stroke: 'var(--rule-2)', 'stroke-width': 1 }));
  vals.forEach((v, i) => {
    if (!v) return;
    const bh = Math.max(1.5, (hgt - 3) * Math.sqrt(v / mx));
    const ageD = days - 1 - i;
    const lvl = ageD <= 1 ? 5 : ageD <= 3 ? 4 : ageD <= 7 ? 3 : ageD <= 14 ? 2 : ageD <= 30 ? 1 : 0;
    svg.append(s('rect', { x: i * bw + 0.3, y: hgt - 1 - bh, width: Math.max(1, bw - 0.8), height: bh, rx: 0.6, fill: `var(${heatVar(lvl)})` }));
  });
  return svg;
}

/* ---------------- squarified treemap (no library) ---------------- */
function squarify(items, x, y, w, hgt) {
  // items: [{v, ...}] sorted desc; returns items with x,y,w,h
  const total = items.reduce((a, b) => a + b.v, 0);
  const out = [];
  if (!total || w <= 0 || hgt <= 0) return out;
  const scale = (w * hgt) / total;
  const rest = items.map(it => ({ ...it, a: it.v * scale }));
  let rx = x, ry = y, rw = w, rh = hgt;
  const worst = (row, side) => {
    const sum = row.reduce((a, b) => a + b.a, 0);
    let mx = 0;
    for (const it of row) { const r = Math.max((side * side * it.a) / (sum * sum), (sum * sum) / (side * side * it.a)); mx = Math.max(mx, r); }
    return mx;
  };
  while (rest.length) {
    const side = Math.min(rw, rh);
    const row = [rest.shift()];
    while (rest.length && worst([...row, rest[0]], side) <= worst(row, side)) row.push(rest.shift());
    const sum = row.reduce((a, b) => a + b.a, 0);
    if (rw >= rh) { // place column on the left
      const cw = sum / rh; let cy = ry;
      for (const it of row) { const ch = it.a / cw; out.push({ ...it, x: rx, y: cy, w: cw, h: ch }); cy += ch; }
      rx += cw; rw -= cw;
    } else {
      const ch = sum / rw; let cx = rx;
      for (const it of row) { const cw = it.a / ch; out.push({ ...it, x: cx, y: ry, w: cw, h: ch }); cx += cw; }
      ry += ch; rh -= ch;
    }
  }
  return out;
}

/* ---------------- the parcel map ---------------- */
function parcelMap(width, height) {
  const H = height ? Math.max(120, Math.round(height)) : Math.round(Math.max(360, Math.min(600, width * 0.5)));
  const fams = D.families.map(f => ({ f, v: f.repos.reduce((a, n) => a + parcelValue(R[n]), 0) })).sort((a, b) => b.v - a.v);
  const districts = squarify(fams, 0, 0, width, H);
  const svg = s('svg', { class: 'map', 'data-own-tip': '', viewBox: `0 0 ${width} ${H}`, width, height: H, role: 'group', 'aria-label': 'Mapa: każde repo to działka; wielkość rośnie z liczbą commitów, kolor to czas od ostatniego commita.' });
  const defs = s('defs');
  defs.append(s('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    s('rect', { width: 7, height: 7, fill: 'var(--ash)' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: 'var(--hatch)', 'stroke-width': 3 })));
  defs.append(s('pattern', { id: 'ashx', width: 9, height: 9, patternUnits: 'userSpaceOnUse' },
    s('rect', { width: 9, height: 9, fill: 'var(--ash)' }), s('path', { d: 'M0 0L9 9M9 0L0 9', stroke: 'var(--hatch-strong)', 'stroke-width': 1 })));
  defs.append(s('linearGradient', { id: 'sheen', x1: 0, y1: 0, x2: 0, y2: 1 },
    s('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': .2 }), s('stop', { offset: '.08', 'stop-color': '#ffffff', 'stop-opacity': .07 }), s('stop', { offset: '.6', 'stop-color': '#ffffff', 'stop-opacity': 0 }),
    s('stop', { offset: '1', 'stop-color': '#000000', 'stop-opacity': .12 })));
  svg.append(defs);
  const parcels = [];
  for (const d of districts) {
    const g = s('g', { class: 'district' });
    const pad = 5, top = 22;
    g.append(s('rect', { class: 'district-rule', x: d.x + 1.5, y: d.y + 1.5, width: Math.max(0, d.w - 3), height: Math.max(0, d.h - 3), rx: 3 }));
    const lab = s('text', { class: 'district-label', x: d.x + 9, y: d.y + 16, 'data-maxw': Math.max(0, d.w - 16) });
    lab.append(s('tspan', { text: d.f.name }));
    lab.append(s('tspan', { class: 'q', dx: 8, text: pl(d.f.repos.length, 'świat', 'światy', 'światów') }));
    g.append(lab);
    const items = d.f.repos.map(n => ({ r: R[n], v: parcelValue(R[n]) })).sort((a, b) => b.v - a.v);
    const cells = squarify(items, d.x + pad, d.y + top, d.w - pad * 2, d.h - top - pad);
    for (const c of cells) {
      const r = c.r, ash = r.life === 'zakończone', lvl = ash ? 0 : heatOf(r.last_ts);
      const gx = 1.5, x = c.x + gx, y = c.y + gx, w = Math.max(0, c.w - gx * 2), hh = Math.max(0, c.h - gx * 2);
      const fsev = (r.findings || []).filter(f => (f.sev === 'high' || f.sev === 'mid') && !decision[f.id]);
      const p = s('g', { class: 'parcel' + (ash ? ' ash' : ''), tabindex: 0, role: 'link', 'data-repo': r.name,
        'aria-label': `${r.short}. ${LIFE[r.life]?.label || ''}. Ostatni commit ${ago(r.last_ts)}. ${pl(r.commits, 'commit', 'commity', 'commitów')}.${fsev.length ? ' ' + pl(fsev.length, 'ustalenie', 'ustalenia', 'ustaleń') + ' do decyzji.' : ''}` });
      const fill = ash ? 'url(#ashx)' : lvl <= 0 ? (JASK ? (lvl === 0 ? 'var(--h0)' : 'url(#hatch)') : lvl === 0 ? 'url(#hatch)' : 'var(--ash)') : `var(${heatVar(lvl)})`;
      p.append(s('rect', { class: 'body', x, y, width: w, height: hh, rx: 2.5, fill }));
      if (lvl >= 1) p.append(s('rect', { class: 'sheen', x, y, width: w, height: hh, rx: 2.5, fill: 'url(#sheen)' }));
      p.append(s('rect', { class: 'ring', x: x + 1, y: y + 1, width: Math.max(0, w - 2), height: Math.max(0, hh - 2), rx: 2 }));
      const txtCol = lvl >= 1 ? `var(--hk${lvl})` : 'var(--ink)';
      const subCol = lvl >= 1 ? `var(--hs${lvl})` : 'var(--ink-2)';
      p.dataset.tc = txtCol;
      const hasNo = w > 40 && hh > 40;
      if (w > 30 && hh > 22) {
        const fs = Math.max(11, Math.min(PARCEL_CAP(), Math.max(Math.sqrt(w * hh) / 6.2, Math.min(w / 7.5, hh / 2.6))));
        const t = s('text', { class: 'pname', x: x + 8, y: y + 6 + fs * 0.92, 'font-size': fs, fill: txtCol, text: r.short });
        const badge = fsev.length && w > 46 && hh > 34;
        Object.assign(t.dataset, { maxw: w - 16 - (badge ? 20 : 0), maxh: hh - 10, x0: x + 8, y0: y + 6, fs0: fs, name: r.short, bottom: y + hh, right: x + w, nob: hasNo ? 1 : 0 });
        p.append(t);
        if (badge) {
          const worst = fsev.some(f => f.sev === 'high') ? 'high' : 'mid';
          p.append(s('g', { class: 'pbadge b-' + worst, 'aria-hidden': 'true' },
            s('circle', { cx: x + w - 12, cy: y + 12, r: 8.5 }), s('text', { x: x + w - 12, y: y + 15.6, 'text-anchor': 'middle', text: String(fsev.length) })));
        }
        if (w > 70) {
          p.append(s('text', { class: 'pmeta', x: x + 8, y: y + hh, fill: subCol, text: ash ? '✕ zakończone' : ago(r.last_ts) }));
          if (w > 112) p.append(s('text', { class: 'pmeta', x: x + 8, y: y + hh, fill: subCol, text: pl(r.commits, 'commit', 'commity', 'commitów') }));
        }
      }
      if (hasNo) {
        p.append(s('text', { class: 'pno', x: x + w - 7, y: y + hh - 7, 'text-anchor': 'end', fill: subCol, text: 'nr ' + r.no }));
        const noW = String(r.no).length * 6 + 16;
        if (r.pages && w > 90 && r.life !== 'zakończone') p.append(s('path', { class: 'pplay', d: `M${x + w - 7 - noW - 12} ${y + hh - 16} l7 4 l-7 4 z`, fill: subCol }));
      }
      if (live.pushed[r.name]) p.append(s('circle', { class: 'live-dot', cx: x + w - 10, cy: y + hh - 24, r: 4 }));
      parcels.push({ el: p, r, x, y, w, h: hh });
      g.append(p);
    }
    svg.append(g);
  }
  /* Hover without a disco (the owner, 18 Oct: sweeping the mouse across the map flashed every border it crossed).
     Crossing a gap between plots keeps the current plot lit for a moment; only resting outside the plots, or leaving the
     map, lets the light go. The light itself fades (CSS), so a fast sweep reads as one calm movement. */
  let tipFor = null, offT = 0;
  const lightsOff = () => { clearTimeout(offT); offT = 0; tipFor = null; untip(); svg.classList.remove('dimmed'); $$('.parcel.on', svg).forEach(x => x.classList.remove('on')); };
  svg.addEventListener('pointermove', e => {
    const p = e.target.closest?.('.parcel'); if (!p) { if (!offT && tipFor) offT = setTimeout(lightsOff, 180); return; }
    clearTimeout(offT); offT = 0;
    const r = R[p.dataset.repo];
    if (tipFor === r.name) { tip(e, null); return; }
    tipFor = r.name;
    $$('.parcel.on', svg).forEach(x => x !== p && x.classList.remove('on')); p.classList.add('on'); svg.classList.add('dimmed');
    tip(e, h('div', { class: 'tsig' }, sigil(r, 56), h('div', null,
      h('div', { class: 'tt' }, r.short, ' ', lifeBadge(r.life)),
      r.state?.status ? h('div', { class: 'tq', text: '„' + r.state.status + '”' }) : h('div', { class: 'ts', text: senseText(r) }),
      h('div', { class: 'tm', text: `${FAM[r.family]?.name} · nr ${r.no} · ostatni commit ${ago(r.last_ts)} · ${pl(r.commits, 'commit', 'commity', 'commitów')} · ${pl(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi')}${r.pages && r.life !== 'zakończone' ? ' · ▶ Pages' : ''}` }),
      (() => { const fs = (r.findings || []).filter(f => f.sev === 'high' || f.sev === 'mid'); return fs.length ? h('div', { class: 'tf' }, fs.slice(0, 3).map(f => h('div', null, sevTag(f.sev), ' ', ticks(f.title)))) : null; })())));
  });
  svg.addEventListener('pointerleave', () => { clearTimeout(offT); offT = setTimeout(lightsOff, 120); });
  svg.addEventListener('click', e => { const p = e.target.closest?.('.parcel'); if (p) go(routeFor(p.dataset.repo)); });
  svg.addEventListener('keydown', e => { const p = e.target.closest?.('.parcel'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(routeFor(p.dataset.repo)); } });
  return { svg, parcels, H };
}
function parcelValue(r) { return Math.sqrt(r.commits || 0) + 4; }
/* the largest name on the map: Jaskinia's compact (desktop) size keeps the hierarchy but lowers the voice (v6.1) */
const PARCEL_CAP = () => (JASK && document.documentElement.dataset.density === 'zwarta' ? 23 : 30);
/* Label typesetting for a parcel: the name is set as large as the plot allows, in one line if it can stay
   reasonably wide (Anybody's width axis does the squeezing), otherwise broken onto 2–3 lines; never below 11px.
   Measured at the base size, then scaled linearly (SVG text length is linear in font-size). */
const LH = 1.0;
function fitDistrictLabels(svg) {
  for (const t of $$('text.district-label', svg)) {
    const maxw = +t.dataset.maxw, q = $('tspan.q', t);
    if (q && q.dataset.t == null) q.dataset.t = q.textContent;
    t.style.display = ''; t.removeAttribute('font-size'); if (q) q.textContent = q.dataset.t;
    if (t.getComputedTextLength() <= maxw) continue;
    if (q) q.textContent = '';
    let fs = 12;
    while (t.getComputedTextLength() > maxw && fs > 9.5) { fs -= 0.5; t.setAttribute('font-size', fs); }
    if (t.getComputedTextLength() > maxw) t.style.display = 'none';
  }
}
function fitParcelLabels(svg) {
  fitDistrictLabels(svg);
  for (const p of $$('g.parcel', svg)) {
    const t = $('text.pname', p);
    const metas = $$('text.pmeta', p);
    if (!t) continue;
    const d = t.dataset, maxw = +d.maxw, maxh = +d.maxh, x0 = +d.x0, y0 = +d.y0, fs0 = +d.fs0, name = d.name;
    t.style.display = ''; t.removeAttribute('transform');
    const set = (lines, fs, st) => {
      t.replaceChildren(...lines.map((ln, i) => s('tspan', { x: x0, y: (y0 + fs * 0.9 + i * fs * LH).toFixed(1), text: ln })));
      t.setAttribute('font-size', fs.toFixed(1)); t.style.fontStretch = st + '%';
    };
    const widest = () => Math.max(...[...t.children].map(c => c.getComputedTextLength()));
    // a tall, narrow plot reads better with the name running up its side, like a street name on a cadastral sheet
    let rot = null;
    if (maxw < 60 && maxh > maxw * 2.4) {
      const along = maxh - (+d.nob ? 24 : 6), across = maxw + 16 - 12;
      for (const st of [100, 88, 76]) {
        set([name], 20, st);
        const fs = Math.min(26, across * 0.95, 20 * along / widest());
        if (!rot || fs > rot.fs) rot = { fs, st };
      }
    }
    if (rot && rot.fs >= 12) {
      const fs = Math.floor(rot.fs * 2) / 2, bx = x0 - 2 + fs * 0.8, by = +d.bottom - (+d.nob ? 22 : 8);
      t.replaceChildren(s('tspan', { x: bx, y: by, text: name }));
      t.setAttribute('font-size', fs); t.style.fontStretch = rot.st + '%';
      t.setAttribute('transform', `rotate(-90 ${bx.toFixed(1)} ${by.toFixed(1)})`);
      metas.forEach(m => { m.style.display = 'none'; });
      continue;
    }
    const words = name.split(/\s+/).filter(Boolean);
    const splits = [[name]];
    if (words.length >= 2) for (let i = 1; i < words.length; i++) splits.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
    if (words.length >= 3) for (let i = 1; i < words.length - 1; i++) for (let j = i + 1; j < words.length; j++)
      splits.push([words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')]);
    const room = metas.length && maxh > 52 ? maxh - 18 : maxh; // keep a line for "kiedy" when the plot is tall enough
    let best = null;
    for (const lines of splits) {
      for (const st of [112, 100, 88, 76, 64]) {
        set(lines, fs0, st);
        const len = widest();
        const fsW = fs0 * maxw / len, fsH = room / (lines.length * LH + 0.1);
        const fs = Math.min(fs0, fsW, fsH);
        if (fs < 11) continue;
        // score: big type wins; narrow widths and extra lines cost a little
        const score = fs * (0.82 + 0.18 * (st - 64) / 48) - (lines.length - 1) * 1.4;
        if (!best || score > best.score) best = { lines, fs, st, score };
      }
    }
    if (!best) { // last resort: one line, condensed hard, down to 10px
      set([name], fs0, 52);
      const fs = fs0 * maxw / widest();
      if (fs >= 10 && fs * 1.05 <= maxh) best = { lines: [name], fs, st: 52 };
    }
    if (!best) { t.style.display = 'none'; metas.forEach(m => { m.style.display = 'none'; }); continue; }
    set(best.lines, Math.floor(best.fs * 2) / 2, best.st);
    // meta lines follow the name block; they may share the bottom row with "nr" only when they don't collide
    let yy = y0 + best.fs * (0.9 + (best.lines.length - 1) * LH) + 15;
    const bottom = +d.bottom - 6, right = +d.right;
    for (const m of metas) {
      m.style.display = '';
      m.setAttribute('y', yy.toFixed(1));
      const clash = +d.nob && yy > bottom - 14 && x0 + m.getComputedTextLength() > right - 62;
      if (yy > bottom || clash || m.getComputedTextLength() > maxw + 2) m.style.display = 'none'; // never spill over the plot's edge
      yy += 15.5;
    }
  }
}

/* ---------------- embers rising into FENIKS ---------------- */
let embersStop = null;
function startEmbers(hero, canvas, word, parcels) {
  if (embersStop) embersStop();
  if (REDUCED) return;
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, running = true, visible = true;
  const parts = [];
  const sources = parcels.filter(p => heatOf(p.r.last_ts) >= 2 && p.r.life !== 'zakończone'); // ash does not feed the phoenix
  if (!sources.length) return;
  const resize = () => {
    const b = hero.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = b.width; H = b.height; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  };
  resize();
  const mapEl = $('svg.map', hero);
  const ro = new ResizeObserver(resize); ro.observe(hero);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && running) loop(); }, { threshold: 0 });
  io.observe(hero);
  const cols = [cssv('--h5'), cssv('--h4'), cssv('--h3')];
  // pre-rendered glow sprites: hot core → heat colour → nothing (one per colour, theme-aware)
  const rgba = (hex, a) => { const m = hex.replace('#', ''); const n = parseInt(m.length === 3 ? m.replace(/./g, '$&$&') : m, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const sprites = cols.map(col => {
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    const sg = c.getContext('2d'), grd = sg.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, rgba(cols[0], 1)); grd.addColorStop(0.1, rgba(col, 1)); grd.addColorStop(0.3, rgba(col, 0.32)); grd.addColorStop(0.62, rgba(col, 0.07)); grd.addColorStop(1, rgba(col, 0));
    sg.fillStyle = grd; sg.fillRect(0, 0, S, S); return c;
  });
  let last = performance.now(), fed = 0;
  const spawn = () => {
    const hb = hero.getBoundingClientRect(), mb = mapEl.getBoundingClientRect(), wb = word.getBoundingClientRect();
    const sx = mb.width / +mapEl.getAttribute('width');
    const weights = sources.map(p => heatOf(p.r.last_ts) ** 2);
    let t = Math.random() * weights.reduce((a, b) => a + b, 0), src = sources[0];
    for (let i = 0; i < sources.length; i++) { t -= weights[i]; if (t <= 0) { src = sources[i]; break; } }
    const x = mb.left - hb.left + (src.x + Math.random() * src.w) * sx;
    const y = mb.top - hb.top + (src.y + Math.random() * Math.min(src.h, 40)) * sx;
    const tx = wb.left - hb.left + Math.random() * wb.width, ty = wb.top - hb.top + wb.height * (0.25 + Math.random() * 0.6);
    const spark = Math.random() < 0.12; // a few fast bright sparks among slow embers
    const ci = spark ? 0 : Math.floor(Math.random() * cols.length);
    parts.push({ x, y, tx, ty, vx: (Math.random() - .5) * (spark ? 30 : 12), vy: -(spark ? 60 + Math.random() * 40 : 18 + Math.random() * 26), life: 0,
      max: spark ? 1.6 + Math.random() * 1.4 : 4 + Math.random() * 4, r: spark ? 0.9 + Math.random() * 0.6 : 0.7 + Math.random() * 1.7, ci, f: Math.random() * 6, spark });
  };
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(t) {
      if (!running || !visible || document.hidden) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (parts.length < 84 && Math.random() < 0.62) spawn();
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        const k = Math.min(1, p.life / p.max);
        const ax = (p.tx - p.x) * 0.18, ay = (p.ty - p.y) * 0.05;
        p.vx += ax * dt; p.vy += ay * dt - 4 * dt; p.vx *= 0.985; p.vy *= 0.992;
        p.x += p.vx * dt + Math.sin(t / 380 + p.f) * 0.25; p.y += p.vy * dt;
        const a = Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(t / 70 + p.f)); // flicker
        if (p.life >= p.max || p.y < p.ty - 6) { if (p.y < p.ty + 10) fed++; parts.splice(i, 1); continue; }
        const rr = p.r * (1.15 - 0.45 * k);
        // streak along the motion (hot trail), then the glow sprite
        g.globalAlpha = Math.max(0, a * (p.spark ? 0.7 : 0.38));
        g.strokeStyle = cols[p.ci]; g.lineWidth = rr * (p.spark ? 1.1 : 1.4);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.07, p.y - p.vy * 0.07); g.stroke();
        g.globalAlpha = Math.max(0, a);
        const R = rr * (p.spark ? 7 : 6.2);
        g.drawImage(sprites[p.ci], p.x - R, p.y - R, R * 2, R * 2);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (fed > 6) { word.classList.add('fed'); fed = 0; setTimeout(() => word.classList.remove('fed'), 700); }
      raf = requestAnimationFrame(step);
    });
  }
  const onVis = () => { if (!document.hidden && running) { last = performance.now(); loop(); } };
  document.addEventListener('visibilitychange', onVis);
  loop();
  embersStop = () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); g.clearRect(0, 0, W, H); embersStop = null; };
}

/* ---------------- sense (meaning) layer ---------------- */
const SENSE_WORD = { ok: 'Potwierdzone', fix: 'Poprawione', no: 'Odrzucone' };
function senseOf(key) { return sense[key] || null; }
function senseText(r) { const s0 = senseOf('repo:' + r.name); return s0?.status === 'fix' && s0.text ? s0.text : (r.identity || 'Brak hipotezy Claude: repo jest nowsze niż ostatni przegląd. Na razie mówi o nim tylko README i notatka stanu.'); }
function stampEl(st, thud) {
  if (!st) return h('span', { class: 'stamp hyp', title: 'Zdanie zaproponował Claude. Ty decydujesz.', text: 'hipoteza Claude' });
  return h('span', { class: `stamp ${st.status}${thud ? ' thud' : ''}`, title: st.at ? `Twoja decyzja · ${when(isoTs(st.at))}` : '', text: SENSE_WORD[st.status] || st.status });
}
async function saveSense(key, patch) {
  if (!cap.db) return false;
  const body = { subject: key, ...patch, at: new Date().toISOString() };
  try {
    if (patch === null) { await cap.db.collection('sens').doc(key).delete(); delete sense[key]; }
    else { await cap.db.collection('sens').doc(key).set(body); sense[key] = body; }
    return true;
  } catch (e) {
    if (e?.code === 'invalid_argument') { // a refused write decides: read-only for the rest of this visit
      cap.isOwner = false; toast('Zdania o sensie zatwierdza tylko właściciel Biblioteki.');
      const y = scrollY; render(); requestAnimationFrame(() => scrollTo(0, y));
    } else toast('Nie udało się zapisać. Spróbuj ponownie za chwilę.');
    return false;
  }
}
function senseBlock(key, hypothesis, onChange) {
  const box = h('div', { class: 'decide' });
  const render = (thud) => {
    const st = senseOf(key);
    const txt = st?.status === 'fix' && st.text ? st.text : hypothesis;
    box.replaceChildren(stampEl(st, thud));
    if (cap.db && cap.isOwner) {
      const mk = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, type: 'button', onclick: fn, text: label });
      if (!st || st.status !== 'ok') box.append(mk('Potwierdź', async () => { if (await saveSense(key, { status: 'ok' })) { render(true); onChange?.(); } }));
      box.append(mk(st?.status === 'fix' ? 'Popraw jeszcze raz' : 'Popraw', () => {
        const ta = h('textarea', { id: 'sense-' + key.replace(/[^a-z0-9]/gi, '-'), 'aria-label': 'Twoje zdanie o sensie' }); ta.value = txt;
        const save = mk('Zapisz poprawkę', async () => { const v = ta.value.trim(); if (!v) return; if (await saveSense(key, { status: 'fix', text: v })) { render(true); onChange?.(); } }, 'hot');
        box.replaceChildren(ta, save, mk('Anuluj', () => render(false), 'ghost'));
        ta.focus();
      }));
      if (!st || st.status !== 'no') box.append(mk('Odrzuć', async () => { if (await saveSense(key, { status: 'no' })) { render(true); onChange?.(); } }, 'ghost'));
      if (st) box.append(mk('Cofnij do hipotezy', async () => { if (await saveSense(key, null)) { render(false); onChange?.(); } }, 'ghost'));
    }
  };
  render(false);
  box._render = render;
  return box;
}

/* ---------------- router ---------------- */
const main = $('#main');
let lastPanoramaScroll = 0;
function parseRoute() {
  const hsh = decodeURIComponent((location.hash || '#panorama').slice(1));
  if (hsh.startsWith('repo~')) {
    const n = hsh.slice(5);
    return { v: 'repo', name: R[n] ? n : (Object.keys(R).find(k => k.toLowerCase() === n.toLowerCase()) || n) };
  }
  if (['panorama', 'historia', 'wiedza', 'agenci'].includes(hsh)) return { v: hsh };
  return { v: 'panorama' };
}
function go(hash) { if (JASK) { HOOK.go?.(hash); return; } if (location.hash === hash) render(); else location.hash = hash; }
let current = null;
function render() {
  if (JASK) { HOOK.refresh?.(); return; }
  const rt = parseRoute();
  if (current?.v === 'panorama') lastPanoramaScroll = scrollY;
  if (embersStop) embersStop();
  untip();
  $$('.nav a').forEach(a => a.setAttribute('aria-current', a.dataset.v === (rt.v === 'repo' ? '' : rt.v) ? 'page' : 'false'));
  let view;
  if (rt.v === 'repo' && R[rt.name]) view = repoView(R[rt.name]);
  else if (rt.v === 'historia') view = historyView();
  else if (rt.v === 'wiedza') view = knowledgeView();
  else if (rt.v === 'agenci') view = agentsView();
  else view = panoramaView();
  main.replaceChildren(view);
  document.title = rt.v === 'repo' && R[rt.name] ? `${R[rt.name].short} · Biblioteka Jozzpoly` : 'Biblioteka Jozzpoly';
  const prev = current; current = rt;
  requestAnimationFrame(() => {
    if (rt.v === 'panorama' && prev?.v === 'repo') scrollTo(0, lastPanoramaScroll);
    else scrollTo(0, 0);
    view._after?.();
  });
}
if (!JASK) addEventListener('hashchange', render);

/* ---------------- PANORAMA ---------------- */
function panoramaView() {
  const T = D.estate.totals, C = D.estate.coverage;
  const v = h('div', { class: 'view panorama' });
  const snapAge = ago(SNAP);
  const meter = h('button', { class: 'meaning-meter', id: 'meter', type: 'button', title: 'Przejdź do rodzin i zdań o sensie',
    onclick: () => document.getElementById('h-fam')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }) });
  const updMeter = () => {
    const keys = [...D.repos.map(r => 'repo:' + r.name), ...D.families.map(f => 'fam:' + f.id)];
    const done = keys.filter(k => sense[k]).length;
    meter.replaceChildren(h('b', { text: `${done}/${keys.length}` }), ' zdań o sensie rozstrzygnąłeś');
  };
  updMeter(); v._updMeter = updMeter;
  const liveBtn = h('button', { class: 'btn', type: 'button', id: 'liveBtn', hidden: !cap.mcp, onclick: liveCheck }, liveLabel());
  const mast = h('section', { class: 'wrap mast', 'aria-labelledby': 'h-mast' },
    h('div', null,
      h('h1', { id: 'h-mast', text: `${pl(C.collected, 'świat', 'światy', 'światów')}, jedna droga` }),
      h('p', { class: 'lede', text: `Wszystko, co masz na GitHubie, od pierwszego commita ${day(T.first_ts)}. Żar pokazuje, gdzie ostatnio toczyła się praca; nic tu nie jest oceną. Każde zdanie o sensie jest hipotezą, dopóki go nie potwierdzisz.` })),
    h('div', { class: 'mast-side' },
      h('div', { class: 'snap' }, 'Zrzut z ', h('b', { text: when(SNAP) }), ` (${snapAge})`),
      h('div', { style: { position: 'relative' } }, liveBtn),
      meter));
  const word = h('p', { class: 'word', 'aria-hidden': 'true', text: 'FENIKS' });
  const fenNames = FENIKS.map((r, i) => [i ? (i === FENIKS.length - 1 ? ' i ' : ', ') : '', h('a', { href: routeFor(r.name), text: r.short })]);
  const cap0 = h('div', { class: 'cap' },
    h('span', { class: 'sr-only', text: 'Feniks. ' }),
    'Jeszcze się nie odrodził. ',
    FENIKS.length ? ['Zasila go ', pl(FENIKS.length, 'laboratorium', 'laboratoria', 'laboratoriów'), ' z ostatnich 14 dni: ', fenNames, '.'] : 'W ostatnich 14 dniach żadne laboratorium nie dokładało żaru.',
    h('q', { text: D.estate_stated[1] }));
  const canvas = h('canvas', { class: 'embers', 'aria-hidden': 'true' });
  const mapBox = h('div', { class: 'mapbox' });
  const hero = h('section', { class: 'wrap horizon', 'aria-label': 'Mapa światów' }, h('div', { class: 'feniks' }, word, cap0), mapBox, canvas);
  const legend = h('div', { class: 'wrap legend', 'aria-label': 'Legenda' },
    h('div', { class: 'heatbar' },
      h('div', { class: 'hb-cap', text: 'Ostatni commit nie dawniej niż' }),
      h('div', { class: 'scale', 'aria-hidden': 'true' }, ['--h5', '--h4', '--h3', '--h2', '--h1', null].map(c => h('span', { class: c ? '' : 'hatched', style: c ? { background: `var(${c})` } : null }))),
      h('div', { class: 'ticks' }, ['24 h', '3 dni', '7 dni', '14 dni', '30 dni', 'dawniej'].map(t => h('span', { text: t })))),
    h('div', { class: 'legend-notes' },
      h('span', null, h('i', { class: 'sw-empty', 'aria-hidden': 'true' }), 'puste repo'),
      h('span', null, 'Wielkość działki rośnie z liczbą commitów (pierwiastek). ', h('b', { text: 'nr' }), ' to kolejność założenia, ▶ to strona GitHub Pages.')));
  const facts = h('section', { class: 'wrap facts', 'aria-label': 'Liczby estate’u' },
    fact(`${C.collected}/${C.expected}`, 'repo w zrzucie', `${C.public} publicznych, ${C.private} prywatnych`),
    fact(fmt(T.commits), plural(T.commits, 'commit', 'commity', 'commitów'), 'ze wszystkich gałęzi'),
    fact(fmt(T.branches), plural(T.branches, 'gałąź', 'gałęzie', 'gałęzi'), 'na zdalnych repo'),
    fact(fmt(T.prs), 'pull requestów', `${fmt(T.prs_open)} otwartych, ${fmt(T.prs_merged)} scalonych`),
    fact(fmt(T.ci_runs), plural(T.ci_runs, 'przebieg CI', 'przebiegi CI', 'przebiegów CI'), 'GitHub Actions, łącznie'),
    fact(T.busiest_day ? fmt(T.busiest_day[1]) : '—', 'commitów w jeden dzień', T.busiest_day ? 'rekord: ' + DF.format(new Date(T.busiest_day[0] + 'T12:00:00Z')) : ''));
  v.append(mast, hero, legend, facts, seismo(), findingsFeed(), playStrip(), katasterSection());

  v._after = () => {
    const w = Math.round(mapBox.getBoundingClientRect().width);
    const { svg, parcels } = parcelMap(w);
    mapBox.replaceChildren(svg);
    const fit = () => fitParcelLabels(svg);
    fit(); document.fonts?.ready?.then(fit);
    startEmbers(hero, canvas, word, parcels);
  };
  return v;
}
/* the pulse of all repos together, day by day. It ends where the snapshot ends: the days after it are not known,
   so they are hatched, never drawn as silent days (unknown is not zero). */
function seismo() {
  const days = D.estate.estate_days;
  const start = Math.floor(Date.parse('2026-05-01T12:00:00Z') / 1000 / DAY);
  const endSnap = Math.floor(SNAP / DAY), endNow = Math.max(endSnap, Math.floor(nowS() / DAY));
  const n = endNow - start + 1, nk = endSnap - start + 1, W = 1200, Hh = 64;
  const vals = []; let mx = 1;
  for (let i = 0; i < nk; i++) { const k = new Date((start + i) * DAY * 1000).toISOString().slice(0, 10); const v0 = days[k] || 0; vals.push(v0); mx = Math.max(mx, v0); }
  const bw = W / n;
  const svg = s('svg', { class: 'seismo', 'data-own-tip': '', viewBox: `0 0 ${W} ${Hh + 2}`, preserveAspectRatio: 'none', role: 'img',
    'aria-label': `Wszystkie repo razem, dzień po dniu od maja 2026 do zrzutu z ${DS.format(new Date(SNAP * 1000))}. Rekord: ${fmt(mx)} commitów jednego dnia.` });
  svg.append(s('line', { x1: 0, x2: W, y1: Hh + .5, y2: Hh + .5, stroke: 'var(--rule-2)', 'vector-effect': 'non-scaling-stroke' }));
  const bars = [];
  vals.forEach((v0, i) => {
    if (!v0) return;
    const bh = Math.max(1.5, (Hh - 2) * Math.sqrt(v0 / mx));
    const lvl = heatOf((start + i) * DAY + DAY / 2);
    bars[i] = s('rect', { class: 'sbar', x: i * bw + bw * 0.12, y: Hh - bh, width: Math.max(0.8, bw * 0.76), height: bh, fill: lvl >= 1 ? `var(${heatVar(lvl)})` : 'var(--cold)' });
    svg.append(bars[i]);
  });
  /* Pointing at a day answers like every other day chart (the owner, 18 Oct: the Puls bars said nothing while the very
     similar chart in Statystyki did): a guide, the bar lit, and a note with the day, its commits and who made them.
     Clicking selects the busiest project of that day. The light fades instead of flashing (as on the map). */
  const guide = s('line', { class: 'sguide', x1: 0, x2: 0, y1: 0, y2: Hh, 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
  svg.append(guide);
  const repos = Object.values(R);
  const dayKey = i => new Date((start + i) * DAY * 1000).toISOString().slice(0, 10);
  const topOf = i => { const k = dayKey(i); return repos.map(r => ({ r, n: (r.days && r.days[k]) || 0 })).filter(x => x.n).sort((a, b) => b.n - a.n); };
  const dayAt = e => { const bb = svg.getBoundingClientRect(); return Math.max(0, Math.min(nk - 1, Math.floor((e.clientX - bb.left) / bb.width * n))); };
  let lit = null, offT = 0;
  const off = () => { clearTimeout(offT); offT = 0; guide.setAttribute('visibility', 'hidden'); lit?.classList.remove('on'); lit = null; untip(); };
  svg.addEventListener('pointermove', e => {
    clearTimeout(offT); offT = 0;
    const i = dayAt(e), x = i * bw + bw / 2;
    guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('visibility', 'visible');
    if (lit !== bars[i]) { lit?.classList.remove('on'); lit = bars[i] || null; lit?.classList.add('on'); }
    const top = topOf(i);
    tip(e, [h('div', { class: 'tt', text: pl(vals[i] || 0, 'commit', 'commity', 'commitów') }), h('div', { class: 'ts', text: DS.format(new Date((start + i) * DAY * 1000)) }),
      h('div', { class: 'tm', text: top.length ? top.slice(0, 3).map(x => `${x.r.short} ${x.n}`).join(' · ') + (JASK ? ' · kliknij, żeby zaznaczyć' : '') : 'cisza' })]);
  });
  svg.addEventListener('pointerleave', () => { clearTimeout(offT); offT = setTimeout(off, 120); });
  svg.addEventListener('click', e => { const top = topOf(dayAt(e)); if (top[0]) go(routeFor(top[0].r.name)); });
  const plot = h('div', { class: 'seismo-plot' }, svg);
  const after = endNow - endSnap;
  if (after >= 1) plot.append(h('div', { class: 'seismo-after', style: { left: (nk / n * 100).toFixed(3) + '%' },
    'data-tip': `Po zrzucie z ${DS.format(new Date(SNAP * 1000))}: brak danych (${pl(after, 'dzień', 'dni', 'dni')}). To nie są dni bez commitów, tylko dni, których zrzut nie widział.` }));
  const months = h('div', { class: 'seismo-m', 'aria-hidden': 'true' });
  const MON = new Intl.DateTimeFormat('pl-PL', { month: 'long', timeZone: 'UTC' }), MSH = new Intl.DateTimeFormat('pl-PL', { month: 'short', timeZone: 'UTC' });
  for (let y = 2026, m = 4; ; m++) {
    if (m > 11) { m = 0; y++; }
    const ts = Date.UTC(y, m, 1) / 1000;
    if (ts / DAY > endNow) break;
    const pct = Math.max(0, (ts / DAY - start) / n * 100), dt = new Date(ts * 1000), yr = m === 0 ? ' ' + y : '';
    const full = MON.format(dt) + yr;
    months.append(h('span', { style: { left: pct.toFixed(2) + '%' }, 'data-pct': pct.toFixed(2), 'data-full': full, 'data-short': MSH.format(dt).replace('.', '') + yr, text: full }));
  }
  requestAnimationFrame(() => fitTicks(months));
  return h('section', { class: 'wrap seismo-wrap', 'aria-label': 'Puls estate’u' },
    h('div', { class: 'seismo-h' }, h('span', { text: `Puls: wszystkie repo razem, dzień po dniu od maja 2026 do zrzutu (${DS.format(new Date(SNAP * 1000))})` }), h('a', { href: '#historia', text: 'Pełna historia' })), plot, months);
}
/* names under a chart never print over each other or past the right edge: full names, else short ones, else fewer.
   Positions are in per cent of the row, so a window's own zoom does not matter. */
function fitTicks(box) {
  if (!box || !box.isConnected) return;
  const sp = [...box.children];
  const place = () => {
    const bb = box.getBoundingClientRect();
    if (!bb.width) return;
    for (const e of sp) {
      e.style.left = e.dataset.pct + '%'; e.classList.remove('moved');
      const b = e.getBoundingClientRect();
      if (b.right > bb.right + 0.5) { e.style.left = Math.max(0, (bb.width - b.width) / bb.width * 100) + '%'; e.classList.add('moved'); }
    }
  };
  const clash = () => { let prev = null; for (const e of sp) { if (e.style.visibility === 'hidden') continue; const b = e.getBoundingClientRect(); if (prev && b.left < prev.right + 4) return true; prev = b; } return false; };
  for (const e of sp) { e.textContent = e.dataset.full; e.style.visibility = ''; }
  place();
  if (!clash()) return;
  for (const e of sp) e.textContent = e.dataset.short;
  place();
  if (!clash()) return;
  for (const step of [2, 3, 4]) {
    sp.forEach((e, i) => { e.style.visibility = i % step && i !== sp.length - 1 ? 'hidden' : ''; });
    if (!clash()) return;
    sp.forEach((e, i) => { e.style.visibility = i % step ? 'hidden' : ''; });
    if (!clash()) return;
  }
}
/* the worlds you can open and play right now (GitHub Pages), freshest first */
function playStrip() {
  // a lab the repo itself declares finished is not offered to play (its own note asks not to present it)
  const rs = D.repos.filter(r => r.pages && r.life !== 'zakończone').sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
  if (!rs.length) return null;
  return h('section', { class: 'wrap sec play-sec', 'aria-labelledby': 'h-play' },
    h('div', { class: 'sec-h' },
      h('div', null, h('h2', { id: 'h-play', text: 'Do zagrania' }),
        h('p', { text: `${pl(rs.length, 'świat ma', 'światy mają', 'światów ma')} stronę GitHub Pages. Kafel prowadzi prosto do gry, nazwa do karty świata.` })),
      h('div', { class: 'side', text: 'Linki złożone z nazw repo; strony nie były otwierane przy budowie zrzutu.' })),
    h('div', { class: 'plays' }, rs.map(r => {
      const lvl = heatOf(r.last_ts);
      return h('article', { class: 'play-tile', style: { '--tile-heat': `var(${heatVar(lvl)})` } },
        playA(r, { class: 'pt-sig', tabindex: -1, 'aria-hidden': 'true' }, sigil(r, 48)),
        h('div', { class: 'pt-meta' },
          h('a', { class: 'pt-name', href: routeFor(r.name), text: r.short }),
          h('span', { class: 'pt-when', text: 'commit ' + ago(r.last_ts) })),
        playA(r, { class: 'pt-play', 'aria-label': `Zagraj: ${r.short}` }, playIcon(), 'Zagraj'));
    })));
}
function fact(v, l, small) { return h('div', { class: 'fact' }, h('div', { class: 'v', text: v }), h('div', { class: 'l' }, l, small ? h('small', { text: small }) : null)); }

/* ---------------- generated layer: life, findings, decisions (Kataster v2) ---------------- */
const LIFE = {
  'żywe': { label: 'żywe', c: '--h4', g: '', cls: 'zywe', hint: 'commit w ostatnich 7 dniach' },
  'stygnące': { label: 'stygnące', c: '--h2', g: '', cls: 'stygnace', hint: 'ostatni commit 8–30 dni temu' },
  'uśpione': { label: 'uśpione', c: '--cold', g: '', cls: 'uspione', hint: 'ponad 30 dni bez commita' },
  'wstrzymane': { label: 'wstrzymane', c: '--cold', g: '‖', cls: 'wstrzymane', hint: 'notatka stanu repo mówi, że jest wstrzymane' },
  'zakończone': { label: 'zakończone', c: '--ink-3', g: '✕', cls: 'zakonczone', hint: 'notatka stanu repo mówi, że jest zakończone' },
  'puste': { label: 'puste', c: '--rule-2', g: '', cls: 'puste', hint: 'brak commitów' },
};
const LIFE_ORDER = ['żywe', 'stygnące', 'uśpione', 'wstrzymane', 'zakończone', 'puste'];
const SEV = { high: 'poważne', mid: 'średnie', low: 'drobne', info: 'info' };
const SEV_W = { high: 3, mid: 2, low: 1, info: 0 };
const DECISION = { ty: 'Zajmę się', agent: 'Zleć agentowi', zostaw: 'Zostaw tak' };
const DECISION_STAMP = { ty: 'Twoje', agent: 'Dla agenta', zostaw: 'Zostaje' };
const WHO = { ty: 'decyzja Twoja', agent: 'może zrobić agent', 'ty+agent': 'Ty decydujesz, agent może wykonać' };
const decision = {}; // finding id -> {status, at, facts, title}
const ALL_FINDINGS = D.repos.flatMap(r => r.findings || []);
const CH = D.estate.changes || null;
const NEWF = new Set(CH?.findings_new || []);
const MOVED = Object.fromEntries((CH?.moved || []).map(m => [m.repo, m]));
function loadPref(k, d0) { try { const v = localStorage.getItem('bib:' + k); return v == null ? d0 : JSON.parse(v); } catch { return d0; } }
function savePref(k, v) { try { localStorage.setItem('bib:' + k, JSON.stringify(v)); } catch { /* per-viewer convenience only */ } }
/* view state that must survive the full re-render a snapshot triggers; localStorage only remembers it between visits */
const UI = {
  feedAll: false,
  feedOpen: !!loadPref('feedOpen', false),
  kat: Object.assign({ q: '', life: 'all', prob: 'all', sort: 'fam' }, loadPref('kataster', {})),
  katOpen: new Set(loadPref('katasterOpen', [])),
  focus: null, thud: null,
};
if (UI.kat.life !== 'all' && !LIFE_ORDER.includes(UI.kat.life)) UI.kat.life = 'all';
if (!['all', 'high', 'mid', 'clean', 'open'].includes(UI.kat.prob)) UI.kat.prob = 'all';
if (!['fam', 'last', 'score', 'branches', 'commits', 'no'].includes(UI.kat.sort)) UI.kat.sort = 'fam';
if (typeof UI.kat.q !== 'string') UI.kat.q = '';
function restoreFocus() {
  const f0 = UI.focus; UI.focus = null;
  if (!f0) return;
  const scope = f0.where === 'kat' ? '.kataster ' : f0.where === 'feed' ? '.feed ' : f0.where === 'card' ? '.nowp ' : '';
  const el = document.querySelector(`${scope}[data-id="${CSS.escape(f0.id)}"] .fdec button`) || document.querySelector(`${scope}[data-id="${CSS.escape(f0.id)}"] .fdec`);
  if (el) { if (!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON') el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
}
function ticks(t) { return String(t || '').split('`').map((part, i) => i % 2 ? h('code', { text: part }) : part); }
function lifeBadge(life) {
  const L = LIFE[life] || LIFE['uśpione'];
  return h('span', { class: 'life l-' + L.cls, title: L.hint }, h('i', { 'aria-hidden': 'true', style: { background: `var(${L.c})` }, text: L.g }), L.label);
}
function sevTag(sev) { return h('span', { class: 'sev s-' + sev, text: SEV[sev] }); }
async function saveDecision(f, status) {
  if (!cap.db) return false;
  const ref = cap.db.collection('decyzje').doc(f.id);
  const body = { repo: f.repo, rule: f.rule, status, title: f.title, facts: f.facts || {}, at: new Date().toISOString() };
  try {
    if (status === null) { await ref.delete(); delete decision[f.id]; }
    else { await ref.set(body); decision[f.id] = body; }
    return true;
  } catch (e) {
    if (e?.code === 'invalid_argument') {
      cap.isOwner = false; toast('Decyzje zapisuje tylko właściciel Biblioteki.');
      const y = scrollY; render(); requestAnimationFrame(() => scrollTo(0, y));
    } else toast('Nie udało się zapisać decyzji. Spróbuj za chwilę.');
    return false;
  }
}
const FACT = { stale: 'stare gałęzie', n: 'gałęzie', default_ts: 'ostatni commit na gałęzi domyślnej', drafts: 'szkice PR', files: 'pliki', md_kb: 'dokumenty KB',
  code_kb: 'kod KB', with_pr: 'z PR', groups: 'grupy nazw', date: 'data notatki', phase: 'faza' };
function factVal(k, v) { return k.endsWith('_ts') && typeof v === 'number' ? DS.format(new Date(v * 1000)) : v == null ? '—' : String(v); }
function decisionBlock(f, onChange) {
  const box = h('div', { class: 'fdec' });
  const act = async status => {
    if (!(await saveDecision(f, status))) return;
    UI.focus = { id: f.id, where: box.closest('.kataster') ? 'kat' : box.closest('.feed') ? 'feed' : box.closest('.nowp') ? 'card' : '' };
    UI.thud = status ? f.id : null;
    setTimeout(() => { if (UI.thud === f.id) UI.thud = null; }, 1200);
    draw(); onChange?.();
  };
  const draw = () => {
    const d0 = decision[f.id], thud = UI.thud === f.id;
    box.replaceChildren();
    if (d0) {
      const changed = Object.keys(f.facts || {}).filter(k => d0.facts && k in d0.facts && JSON.stringify(f.facts[k]) !== JSON.stringify(d0.facts[k]));
      box.append(h('span', { class: 'stamp dec d-' + d0.status + (thud ? ' thud' : ''), title: d0.at ? 'Twoja decyzja · ' + when(isoTs(d0.at)) : '', text: DECISION_STAMP[d0.status] || d0.status }));
      if (changed.length) box.append(h('span', { class: 'fchanged', text: 'od decyzji: ' + changed.map(k => `${FACT[k] || k} ${factVal(k, d0.facts[k])} → ${factVal(k, f.facts[k])}`).join(', ') }));
    }
    if (cap.db && cap.isOwner) {
      for (const [k, label] of Object.entries(DECISION)) if (!d0 || d0.status !== k)
        box.append(h('button', { class: 'btn mini', type: 'button', text: label, onclick: () => act(k) }));
      if (d0) box.append(h('button', { class: 'btn mini ghost', type: 'button', text: 'Cofnij', 'aria-label': 'Cofnij decyzję', onclick: () => act(null) }));
    }
  };
  draw();
  return box;
}
function findingItem(f, withRepo, onChange) {
  const r = R[f.repo];
  return h('li', { class: 'find s-' + f.sev + (decision[f.id] ? ' decided' : ''), 'data-id': f.id },
    sevTag(f.sev),
    h('div', { class: 'fbody' },
      h('p', { class: 'ft' }, withRepo ? [h('a', { class: 'frepo', href: routeFor(f.repo), text: r?.short || f.repo }), ' '] : null, ticks(f.title),
        NEWF.has(f.id) ? [' ', h('span', { class: 'chip new', title: 'Nie było go w poprzednim zrzucie', text: 'nowe' })] : null),
      f.detail ? h('p', { class: 'fd' }, ticks(f.detail)) : null,
      h('div', { class: 'fmeta' },
        (f.links || []).filter(l => l[1]).map(([t, u]) => h('a', { href: u, target: '_blank', rel: 'noopener' }, ticks(t))),
        f.who ? h('span', { class: 'fwho', text: WHO[f.who] || f.who }) : null),
      decisionBlock(f, onChange)));
}

/* what moved between the previous snapshot and this one */
function changesStrip() {
  if (!CH) return null;
  const since = isoTs(CH.since);
  const moved = CH.moved.filter(m => R[m.repo]);
  const quiet = !moved.length && !CH.repos_new.length && !CH.repos_gone.length && !CH.findings_new.length && !CH.findings_gone.length;
  const bit = m => {
    const r = R[m.repo], parts = [];
    if (m.commits) parts.push((m.commits > 0 ? '+' : '') + pl(m.commits, 'commit', 'commity', 'commitów'));
    if (m.n_new_branches) parts.push('+' + pl(m.n_new_branches, 'gałąź', 'gałęzie', 'gałęzi'));
    if (m.n_gone_branches) parts.push('−' + pl(m.n_gone_branches, 'gałąź', 'gałęzie', 'gałęzi'));
    if (!parts.length && m.moved_tips) parts.push('przesunięte ' + pl(m.moved_tips, 'gałąź', 'gałęzie', 'gałęzi'));
    return h('a', { class: 'mv', href: routeFor(m.repo), title: [m.new_branches?.length ? 'Nowe: ' + m.new_branches.join(', ') : '', m.gone_branches?.length ? 'Usunięte: ' + m.gone_branches.join(', ') : ''].filter(Boolean).join('\n') },
      h('b', { text: r.short }), ' ', parts.join(' · '),
      m.life_from && m.life_from !== m.life_to ? [' ', h('span', { class: 'mvlife', text: `${m.life_from} → ${m.life_to}` })] : null);
  };
  return h('div', { class: 'changes' },
    h('p', { class: 'ch-h' }, h('b', { text: 'Od poprzedniego zrzutu' }), ` (${when(since)}, ${ago(since)})`,
      quiet ? ': bez zmian.' : ':'),
    quiet ? null : h('div', { class: 'ch-row' },
      CH.repos_new.map(n => h('a', { class: 'mv add', href: routeFor(n) }, h('b', { text: R[n]?.short || n }), ' nowe repo')),
      CH.repos_gone.map(n => h('span', { class: 'mv gone' }, h('b', { text: n }), ' zniknęło z konta')),
      moved.map(bit)),
    CH.findings_new.length || CH.findings_gone.length ? h('p', { class: 'ch-f' },
      CH.findings_new.length ? [h('b', { text: pl(CH.findings_new.length, 'nowe ustalenie', 'nowe ustalenia', 'nowych ustaleń') }), ' (oznaczone niżej)'] : null,
      CH.findings_new.length && CH.findings_gone.length ? ' · ' : null,
      CH.findings_gone.length ? [h('b', { text: pl(CH.findings_gone.length, 'ustalenie zniknęło', 'ustalenia zniknęły', 'ustaleń zniknęło') }), ': ',
        CH.findings_gone.slice(0, 4).map((g, i) => [i ? '; ' : '', h('s', null, (R[g.repo]?.short || g.repo) + ': ', ticks(g.title))]), CH.findings_gone.length > 4 ? '…' : ''] : null) : null);
}

/* "Co widać od razu": every generated finding across the estate, heaviest first.
   opts.st ({feedOpen, feedAll}) and opts.save let each Jaskinia window keep its own toggles. */
function findingsFeed(opts = {}) {
  const FS = opts.st || UI;
  const saveOpen = opts.save || (() => savePref('feedOpen', UI.feedOpen));
  const list = h('ul', { class: 'finds' });
  const summary = h('div', { class: 'feed-sum' });
  const more = h('button', { class: 'btn ghost', type: 'button', onclick: () => { FS.feedAll = !FS.feedAll; opts.save?.(); draw(); } });
  const draw = () => {
    const all = ALL_FINDINGS.slice().sort((a, b) => SEV_W[b.sev] - SEV_W[a.sev] || R[b.repo].score - R[a.repo].score || (R[b.repo].last_ts || 0) - (R[a.repo].last_ts || 0));
    const open = all.filter(f => !decision[f.id]);
    const onlyOpen = FS.feedOpen, showAll = FS.feedAll;
    const pool = onlyOpen ? open : all;
    const top = pool.filter(f => f.sev === 'high' || f.sev === 'mid'), rest = pool.filter(f => f.sev === 'low' || f.sev === 'info');
    list.replaceChildren(...(showAll ? [...top, ...rest] : top).map(f => findingItem(f, true, draw)));
    if (!list.firstChild) list.append(h('li', { class: 'find empty', text: onlyOpen ? 'Wszystkie ustalenia z tej grupy mają już Twoją decyzję.' : 'Reguły nie znalazły nic poważnego.' }));
    const cnt = s0 => all.filter(f => f.sev === s0).length, dec = all.length - open.length;
    summary.replaceChildren(...['high', 'mid', 'low', 'info'].map(s0 => h('span', { class: 'sum s-' + s0 }, h('b', { text: fmt(cnt(s0)) }), ' ' + SEV[s0])),
      h('span', { class: 'sum dec' }, h('b', { text: fmt(dec) }), ' ' + plural(dec, 'decyzja', 'decyzje', 'decyzji')));
    more.textContent = showAll ? 'Pokaż tylko poważne i średnie' : `Pokaż też drobne i informacyjne (${rest.length})`;
  };
  const openT = h('label', { class: 'tog' }, h('input', { type: 'checkbox', checked: FS.feedOpen, onchange: e => { FS.feedOpen = e.target.checked; saveOpen(); draw(); } }), ' tylko bez Twojej decyzji');
  const sec = h('section', { class: 'wrap sec feed', 'aria-labelledby': 'h-feed' },
    h('div', { class: 'sec-h' },
      h('div', null, h('h2', { id: 'h-feed', text: 'Co widać od razu' }),
        h('p', { text: 'Ustalenia liczone regułami z gita i GitHuba przy każdym zrzucie, bez ręcznie pisanych ocen. To fakty z wagą: to, czy usunięcie straci commity, i to, czy nazwa coś znaczy, są rozdzielone. Decyzja należy do Ciebie.' })),
      h('div', { class: 'side' }, summary)),
    changesStrip(), h('div', { class: 'feed-tools' }, openT), list, h('div', { class: 'feed-more' }, more));
  draw(); sec._draw = draw;
  return sec;
}

/* Kataster: every plot as a dense row; filter, sort, unfold in place */
function mixBar(r) {
  const m = r.mix || {}, tot = Math.max(1, r.branches.length);
  const parts = [['aktywne', 'var(--h4)'], ['swieze', 'var(--h2)'], ['stare', 'var(--cold)'], ['wchloniete', 'repeating-linear-gradient(135deg, var(--hatch-strong) 0 2px, transparent 2px 5px), var(--ash)'], ['domyslna', 'var(--ink-3)']];
  return h('span', { class: 'kmix', 'data-tip': `${pl(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi')}: ${m.aktywne || 0} aktywnych (≤7 dni), ${m.swieze || 0} świeżych (≤21 dni), ${m.stare || 0} starych i niewchłoniętych, ${m.wchloniete || 0} w całości w ${r.default || 'main'}` },
    h('span', { class: 'mbar' }, parts.map(([k, bg]) => m[k] ? h('i', { style: { width: (100 * m[k] / tot).toFixed(2) + '%', background: bg } }) : null)),
    h('span', { class: 'mlab', text: r.branches.length ? pl(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi') : 'bez gałęzi' }));
}
function kv2(k, v) { return h('div', { class: 'kv2' }, h('span', { class: 'k', text: k }), h('span', { class: 'v' }, v)); }
function stateNote(r) {
  const st = r.state; if (!st) return null;
  const base = `${r.url}/blob/${st.sha || r.default}/${st.path}`;
  return h('figure', { class: 'snote' + (st.phase ? ' ph-' + (LIFE[st.phase === 'domknięty etap' || st.phase === 'odbudowa' ? '' : st.phase]?.cls || 'x') : '') },
    h('figcaption', null, 'Stan według repo · ', h('a', { href: base, target: '_blank', rel: 'noopener' }, h('code', { text: st.path })),
      st.date ? ' · notatka z ' + DF.format(new Date(st.date + 'T12:00:00Z')) : '', st.last_ts ? ' · plik zmieniony ' + ago(st.last_ts) : ''),
    st.status ? h('blockquote', null, h('a', { href: base + (st.status_line ? '#L' + st.status_line : ''), target: '_blank', rel: 'noopener', text: st.status })) : null,
    noteLag(r) > 14 ? h('p', { class: 'slag', text: `Ten plik zmienił się ${DS.format(new Date(st.last_ts * 1000))}, a ostatni commit w repo jest z ${DS.format(new Date(r.last_ts * 1000))} (${pl(Math.round(noteLag(r)), 'dzień', 'dni', 'dni')} później, być może na innej gałęzi). Notatka może nie opisywać bieżącej pracy.` }) : null,
    st.next?.length ? h('div', { class: 'snext' }, h('span', { class: 'k', text: (st.next_kind === 'pytanie' ? 'Otwarte pytanie według notatki' : 'Dalej według notatki') + (st.next_head ? ` (sekcja „${st.next_head}”)` : '') }),
      h('ul', null, st.next.map(n => h('li', null, h('a', { href: base + '#L' + n.line, target: '_blank', rel: 'noopener', text: n.t }))))) : null,
    h('p', { class: 'scite', text: 'Cytat z repo, bez tłumaczenia i bez oceny.' }));
}
function kDetail(r) {
  const fs = r.findings || [];
  const dflt = r.branches.find(b => b.roles.includes('domyślna'));
  const fresh = r.branches.filter(b => !b.roles.includes('domyślna')).sort((a, b) => b.ts - a.ts)[0];
  const decl = r.branches.filter(b => b.roles.includes('wskazana'));
  const grid = h('div', { class: 'kgrid' },
    kv2('domyślna gałąź', [h('code', { text: r.default || '—' }), dflt ? ' · ' + ago(dflt.ts) : '']),
    kv2('najświeższa gałąź', fresh ? [h('code', { text: fresh.n }), ' · ' + ago(fresh.ts)] : '—'),
    kv2('dokumenty wskazują', decl.length ? decl.slice(0, 3).map((b, i) => [i ? ', ' : '', h('code', { text: b.n })]) : 'żadnej gałęzi'),
    kv2('na domyślnej', r.tree.files != null ? `${pl(r.tree.files, 'plik', 'pliki', 'plików')} · kod ${fmt(r.tree.code_kb || 0)} KB · dokumenty ${fmt(r.tree.md_kb || 0)} KB` : '—'),
    kv2('commity', r.commits ? `${fmt(r.commits)} w ${pl(r.active_days, 'aktywnym dniu', 'aktywnych dniach', 'aktywnych dniach')}` : 'brak'),
    kv2('okres życia', r.first_ts ? `${day(r.first_ts)} → ${day(r.last_ts)}` : '—'),
    kv2('wejścia dla agenta', r.docs.length ? r.docs.slice(0, 4).map((d0, i) => [i ? ', ' : '', h('code', { text: d0.p })]) : 'brak'),
    kv2('opis na GitHubie', r.api === false ? 'nieznany (brak danych z API)' : r.desc || 'brak'));
  const finds = fs.length ? h('ul', { class: 'finds compact' }, fs.map(f => findingItem(f, false))) : h('p', { class: 'faint', text: 'Reguły nie znalazły tu nic do zgłoszenia.' });
  const links = h('div', { class: 'klinks' },
    h('a', { class: 'btn', href: routeFor(r.name), text: 'Karta świata →' }),
    h('a', { class: 'btn ghost', href: r.url, target: '_blank', rel: 'noopener', text: 'GitHub' }),
    r.pages && r.life !== 'zakończone' ? playA(r, { class: 'btn ghost' }, playIcon(), 'Zagraj') : null);
  return [grid, stateNote(r), h('h5', { class: 'ksub', text: 'Ustalenia' }), finds,
    r.branches.length ? h('h5', { class: 'ksub', text: 'Gałęzie' }) : null, r.branches.length ? branchTable(r, 300) : null, links].filter(Boolean);
}
function kRow(r, open, onOpen) {
  const isOpen = open.has(r.name);
  const det = h('div', { class: 'kdet', hidden: !isOpen });
  const fs = r.findings || [];
  const counts = ['high', 'mid', 'low'].map(s0 => [s0, fs.filter(f => f.sev === s0).length]).filter(([, n]) => n);
  const head = h('button', { class: 'khead', type: 'button', 'aria-expanded': String(isOpen) },
    sigil(r, 40),
    h('span', { class: 'kwho' },
      h('span', { class: 'kname' }, h('b', { text: r.short }), r.short !== r.name ? h('span', { class: 'code full', text: r.name }) : null,
        r.private ? h('span', { class: 'chip priv', text: 'prywatne' }) : null, live.pushed[r.name] ? h('span', { class: 'chip new', text: 'nowe od zrzutu' }) : null),
      h('span', { class: 'kline' }, lifeBadge(r.life), h('span', { class: 'kwhen', text: r.last_ts ? 'commit ' + ago(r.last_ts) : 'bez commitów' }),
        MOVED[r.name]?.commits > 0 ? h('span', { class: 'kdelta', title: 'Commity od poprzedniego zrzutu', text: '+' + MOVED[r.name].commits }) : null,
        r.state?.status && noteLag(r) > 14 ? h('span', { class: 'kdated', title: 'Notatka stanu jest dużo starsza niż ostatni commit w repo', text: 'notatka z ' + DS.format(new Date(r.state.last_ts * 1000)) }) : null,
        r.state?.status ? h('span', { class: 'kstate', text: r.state.status }) : (r.readme?.lead ? h('span', { class: 'kstate readme', text: r.readme.lead }) : null))),
    mixBar(r),
    h('span', { class: 'kbadges', 'aria-label': counts.map(([s0, n]) => `${n} ${SEV[s0]}`).join(', ') || 'bez ustaleń' },
      counts.length ? counts.map(([s0, n]) => h('span', { class: 'kb s-' + s0, 'data-tip': `${n} ${SEV[s0]}`, text: n })) : h('span', { class: 'kb none', text: '·' })),
    spark(r, 63, 96, 26),
    h('span', { class: 'kchev', 'aria-hidden': 'true' }));
  const row = h('article', { class: 'krow l-' + (LIFE[r.life]?.cls || 'x') + (isOpen ? ' open' : ''), role: 'listitem', 'data-repo': r.name }, head, det);
  head.addEventListener('click', () => {
    const now = !open.has(r.name);
    if (now) open.add(r.name); else open.delete(r.name);
    if (onOpen) onOpen(open); else savePref('katasterOpen', [...open]);
    row.classList.toggle('open', now); det.hidden = !now; head.setAttribute('aria-expanded', String(now));
    if (now && !det.firstChild) det.append(...kDetail(r));
  });
  if (isOpen) det.append(...kDetail(r));
  return row;
}
function famGroup(f, rs, open, filtered, onOpen) {
  const key = 'fam:' + f.id, st = senseOf(key);
  const q = st?.status === 'fix' && st.text ? st.text : f.question;
  return h('section', { class: 'fam', id: 'fam-' + f.id, 'aria-labelledby': 'h-' + f.id },
    h('div', { class: 'fam-h' },
      h('div', null, h('h3', { id: 'h-' + f.id, text: f.name }), h('p', { class: 'q', text: q }), senseBlock(key, f.question, () => render())),
      h('div', { class: 'meta' }, filtered ? `${rs.length} z ${f.repos.length} ${plural(f.repos.length, 'świata', 'światów', 'światów')}` : pl(rs.length, 'świat', 'światy', 'światów'), h('br'),
        pl(f.commits, 'commit', 'commity', 'commitów'), h('br'), 'ostatnio ', ago(f.last_ts))),
    h('div', { class: 'krows', role: 'list' }, rs.map(r => kRow(r, open, onOpen))));
}
/* opts (Jaskinia): st = this window's filters, open = Set of unfolded rows, save(), onOpen(set) */
function katasterSection(opts = {}) {
  const st = opts.st || UI.kat, open = opts.open || UI.katOpen, onOpen = opts.onOpen || null;
  const body = h('div', { class: 'kbody' }), chips = h('div', { class: 'kcounts', role: 'group', 'aria-label': 'Życie repo' });
  const save = opts.save || (() => savePref('kataster', st));
  const selects = {};
  const sel = (key, label, opts) => {
    const el = h('select', { onchange: e => { st[key] = e.target.value; save(); draw(); } }, opts.map(([v, t]) => h('option', { value: v, selected: st[key] === v, text: t })));
    selects[key] = el;
    return h('label', { class: 'ksel' }, h('span', { text: label }), el);
  };
  const q = h('input', { type: 'search', value: st.q, placeholder: 'repo, gałąź albo słowo z notatki stanu', 'aria-label': 'Szukaj w katastrze',
    oninput: e => { st.q = e.target.value; save(); draw(); } });
  const tools = h('div', { class: 'ktools' },
    h('label', { class: 'ksearch' }, h('span', { text: 'Szukaj' }), q),
    sel('life', 'Życie', [['all', 'wszystkie'], ...LIFE_ORDER.map(l => [l, LIFE[l].label])]),
    sel('prob', 'Ustalenia', [['all', 'wszystkie'], ['high', 'z poważnymi'], ['mid', 'z poważnymi lub średnimi'], ['clean', 'bez poważnych i średnich'], ['open', 'czekające na Twoją decyzję']]),
    sel('sort', 'Kolejność', [['fam', 'rodziny'], ['last', 'ostatni commit'], ['score', 'najwięcej ustaleń'], ['branches', 'najwięcej gałęzi'], ['commits', 'najwięcej commitów'], ['no', 'kolejność założenia']]));
  const match = r => {
    if (st.life !== 'all' && r.life !== st.life) return false;
    const fs = r.findings || [];
    if (st.prob === 'high' && !fs.some(f => f.sev === 'high')) return false;
    if (st.prob === 'mid' && !fs.some(f => f.sev === 'high' || f.sev === 'mid')) return false;
    if (st.prob === 'clean' && fs.some(f => f.sev === 'high' || f.sev === 'mid')) return false;
    if (st.prob === 'open' && !fs.some(f => f.sev !== 'info' && !decision[f.id])) return false;
    const t = st.q.trim().toLowerCase();
    if (t) {
      const hay = [r.name, r.short, r.state?.status, r.readme?.lead, r.desc, senseText(r), ...r.branches.map(b => b.n)].join(' ').toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  };
  const sorter = {
    last: (a, b) => (b.last_ts || 0) - (a.last_ts || 0), score: (a, b) => b.score - a.score || (b.last_ts || 0) - (a.last_ts || 0),
    branches: (a, b) => b.branches.length - a.branches.length, commits: (a, b) => b.commits - a.commits, no: (a, b) => a.no - b.no,
  };
  const draw = () => {
    const rs = D.repos.filter(match), filtered = rs.length !== D.repos.length;
    chips.replaceChildren(...LIFE_ORDER.map(l => {
      const n = D.repos.filter(r => r.life === l).length;
      return n ? h('button', { class: 'kc' + (st.life === l ? ' on' : ''), type: 'button', 'aria-pressed': String(st.life === l),
        onclick: () => { st.life = st.life === l ? 'all' : l; selects.life.value = st.life; save(); draw(); } }, lifeBadge(l), h('b', { text: n })) : null;
    }));
    body.replaceChildren();
    if (!rs.length) { body.append(h('p', { class: 'kempty', text: 'Nic nie pasuje do filtrów.' })); return; }
    if (st.sort === 'fam') {
      for (const f of D.families) {
        const fr = rs.filter(r => r.family === f.id).sort(sorter.last);
        if (fr.length) body.append(famGroup(f, fr, open, filtered, onOpen));
      }
    } else body.append(h('div', { class: 'krows', role: 'list' }, rs.sort(sorter[st.sort]).map(r => kRow(r, open, onOpen))));
  };
  const sec = h('section', { class: 'wrap sec kataster', 'aria-labelledby': 'h-fam' },
    h('div', { class: 'sec-h' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Rejestr gruntów · github.com/Jozzpoly' }), h('h2', { id: 'h-fam', text: 'Kataster' }),
        h('p', { text: 'Każda działka to jedno repo. Rozwiń wiersz, żeby zobaczyć stan zapisany w samym repo, ustalenia i wszystkie gałęzie. Podział na rodziny to propozycja Claude; możesz go potwierdzić, poprawić albo odrzucić.' })),
      chips),
    tools, body);
  draw(); sec._draw = draw;
  return sec;
}
function heatChip(r) {
  const lvl = heatOf(r.last_ts);
  return h('span', { class: 'heat l' + lvl, title: r.last_ts ? 'Ostatni commit: ' + when(r.last_ts) : '' },
    h('i', { style: { background: `var(${heatVar(lvl)})` } }), r.last_ts ? ago(r.last_ts) : 'puste');
}
/* Play. Inside the claude.ai artifact a game can only open in a new tab: frames of other sites are blocked there.
   A self-hosted build (render.py --host web) opens the game inside the page, in the player below. */
/* Where the page runs decides it: a self-hosted build (render.py --host web) and a page opened as a downloaded file
   (file:// on a computer, content:// on a phone) may frame other sites; the claude.ai artifact may not.
   window.__JASK_PLACE ('plik' | 'claude' | 'web') lets a test pretend to be one of them. */
const RUNS_LOCAL = (() => { try { if (window.__JASK_PLACE) return window.__JASK_PLACE === 'plik'; } catch { /* fine */ } return location.protocol === 'file:' || location.protocol === 'content:'; })();
const HOSTED = (typeof BIB_HOST !== 'undefined' && BIB_HOST === 'web') || RUNS_LOCAL || (() => { try { return window.__JASK_PLACE === 'web'; } catch { return false; } })();
function playA(r, attrs, ...kids) {
  const a = h('a', Object.assign({ href: r.pages, target: '_blank', rel: 'noopener' }, attrs), ...kids);
  a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.button) return; // Ctrl+click: the browser's new tab, as everywhere
    // Jaskinia decides: the game window when self-hosted (Shift: a new window beside); otherwise the link opens a new tab
    if (JASK && HOOK.play) { if (HOOK.play(r, { beside: e.shiftKey }) === true) e.preventDefault(); return; }
    if (e.shiftKey) return;
    if (HOSTED && !r.tab) { e.preventDefault(); openPlayer(r); } // a game that works only in its own tab (data/wejscia.json) keeps the link
  });
  if (JASK && !a.title) a.title = 'Zagraj w oknie gry · Shift: w nowym oknie obok · Ctrl: w nowej karcie';
  return a;
}
let playerOpen = false;
function openPlayer(r) {
  if (playerOpen) return; playerOpen = true;
  const back = document.activeElement;
  const frame = h('iframe', { class: 'pframe', src: r.pages, title: `${r.short}: gra`, allowfullscreen: '', referrerpolicy: 'no-referrer',
    allow: 'fullscreen; xr-spatial-tracking; gamepad; autoplay; clipboard-write; accelerometer; gyroscope; magnetometer; screen-wake-lock' });
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  const close = () => { scrim.remove(); box.remove(); playerOpen = false; document.removeEventListener('keydown', onKey, true); back?.focus?.({ preventScroll: true }); };
  const scrim = h('div', { class: 'scrim', onclick: () => close() });
  const box = h('div', { class: 'player', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Gra: ${r.short}` },
    h('header', null, sigil(r, 28), h('b', { text: r.short }), h('span', { class: 'pmeta', text: 'ostatni commit ' + ago(r.last_ts) }), h('span', { class: 'sp' }),
      h('button', { class: 'btn mini', type: 'button', text: 'Pełny ekran', onclick: () => { try { frame.requestFullscreen?.().catch(() => {}); } catch { /* optional */ } } }),
      h('a', { class: 'btn mini ghost', href: r.pages, target: '_blank', rel: 'noopener', text: 'Nowa karta' }),
      h('a', { class: 'btn mini ghost', href: routeFor(r.name), text: 'Karta świata', onclick: () => close() }),
      h('button', { class: 'btn mini', type: 'button', 'aria-label': 'Zamknij grę', text: 'Zamknij ✕', onclick: () => close() })),
    frame);
  $('#layer').append(scrim, box);
  document.addEventListener('keydown', onKey, true);
  box.querySelector('header button')?.focus();
}
function playIcon() { return s('svg', { viewBox: '0 0 14 14', 'aria-hidden': 'true' }, s('circle', { cx: 7, cy: 7, r: 6.3, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }), s('path', { d: 'M5.6 4.4 9.6 7 5.6 9.6z', fill: 'currentColor' })); }

/* ---------------- REPO CARD ---------------- */
function repoView(r) {
  const v = h('div', { class: 'view repo' });
  const fam = FAM[r.family];
  const key = 'repo:' + r.name;
  const decl = r.branches.filter(b => b.roles.includes('wskazana'));
  const header = h('section', { class: 'card-h', 'aria-labelledby': 'h-repo' },
    sigil(r, 148),
    h('div', { style: { minWidth: 0 } },
      h('h1', { id: 'h-repo', style: { fontStretch: r.short.length > 16 ? '86%' : '108%' }, text: r.short }),
      h('div', { class: 'sub' },
        h('span', { class: 'code', text: r.name }), lifeBadge(r.life), heatChip(r),
        r.private ? h('span', { class: 'chip priv', text: 'prywatne' }) : h('span', { class: 'chip', text: 'publiczne' }),
        h('span', { text: `nr ${r.no} w kolejności założenia` }),
        live.pushed[r.name] ? h('span', { class: 'chip new', text: 'nowe od zrzutu: ' + ago(live.pushed[r.name]) }) : null),
      h('div', { class: 'acts' },
        r.pages && r.life !== 'zakończone' ? playA(r, { class: 'btn hot' }, playIcon(), HOSTED ? 'Zagraj' : 'Zagraj na Pages') : null,
        h('a', { class: 'btn', href: r.url, target: '_blank', rel: 'noopener', text: 'Otwórz na GitHubie' }),
        cap.comments ? h('button', { class: 'btn', type: 'button', onclick: async e => {
          const b = e.currentTarget;
          try { await cap.comments.openComposer({ element: header }); }
          catch (err) { if (err?.code === 'unavailable' || err?.code === 'not_granted') { cap.comments = null; b.remove(); } toast('Komentarze są tu niedostępne.'); }
        }, text: 'Skomentuj' }) : null,
        cap.sample ? h('button', { class: 'btn', type: 'button', onclick: () => openAsk(`Opowiedz mi krótko o ${r.short}: co tu badam, gdzie żyje praca i co mogę sam wypróbować?`, r), text: 'Zapytaj o ten świat' }) : null),
      h('div', { class: 'sense' },
        h('div', { class: 'line' }, h('span', { class: 'lbl' }, 'Po co to jest', h('br'), h('small', { text: 'propozycja Claude' })),
          (() => { const t = h('p', { class: 'txt', id: 'sense-txt', text: senseText(r) }); return h('div', null, t, senseBlock(key, r.identity, () => { t.textContent = senseText(r); })); })()),
        r.readme?.lead ? h('div', { class: 'line' }, h('span', { class: 'lbl', text: 'README mówi' }), h('p', { class: 'txt readme' }, r.readme.upstream_box3d ? h('span', { class: 'chip bad', style: { marginRight: '8px' }, text: 'README silnika Box3D' }) : null, r.readme.lead)) : null,
        r.stated?.length ? h('div', { class: 'line' }, h('span', { class: 'lbl', text: 'Twoje słowa' }), h('div', { class: 'txt owner' }, r.stated.map(t => h('p', { text: t })))) : null)));

  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Ścieżka' },
    h('a', { href: '#panorama', text: 'Panorama' }), h('span', { text: '/' }),
    h('a', { href: '#fam-' + r.family, onclick: e => { e.preventDefault(); go('#panorama'); setTimeout(() => document.getElementById('fam-' + r.family)?.scrollIntoView({ block: 'start' }), 80); }, text: fam?.name }),
    h('span', { text: '/' }), h('span', { text: r.short }));

  const K = r.ci.def;
  const numbers = h('section', { class: 'panel', 'aria-labelledby': 'h-num' },
    h('h2', { id: 'h-num', text: 'Liczby' }),
    h('p', { class: 'hint', text: `Wszystkie gałęzie i cała historia. Stan zrzutu z ${when(SNAP)}.` }),
    h('div', { class: 'kv' },
      kvs(fmt(r.commits), plural(r.commits, 'commit', 'commity', 'commitów'), r.merges ? `${fmt(r.merges)} scaleń` : ''),
      kvs(fmt(r.active_days), plural(r.active_days, 'aktywny dzień', 'aktywne dni', 'aktywnych dni'), r.first_ts ? `od ${day(r.first_ts)}` : ''),
      kvs(fmt(r.branches.length), plural(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi'), r.alias_groups.length ? `${pl(r.alias_groups.length, 'grupa aliasów', 'grupy aliasów', 'grup aliasów')}` : ''),
      r.api === false ? kvs('?', 'pull requestów', 'nieznane: brak danych z API w tym zrzucie') : kvs(fmt(r.prs.total), 'pull requestów', `${fmt(r.prs.open)} otwartych (${fmt(r.prs.draft)} szkiców), ${fmt(r.prs.merged)} scalonych`),
      r.api === false ? kvs('?', 'przebiegi CI', 'nieznane: brak danych z API w tym zrzucie') : kvs(fmt(r.ci.runs), plural(r.ci.runs, 'przebieg CI', 'przebiegi CI', 'przebiegów CI'), K ? `na ${r.default}: ${ciWord(K.c)} ${ago(isoTs(K.t))}` : 'na gałęzi domyślnej: brak w ostatnich 100'),
      kvs(r.max_day ? fmt(r.max_day[1]) : '—', 'commitów w rekordowym dniu', r.max_day ? DF.format(new Date(r.max_day[0] + 'T12:00:00Z')) : ''),
      kvs(r.tree.code_kb != null ? fmt(r.tree.code_kb) + ' KB' : '—', 'kodu na ' + (r.default || 'main'), r.tree.md_kb != null ? `i ${fmt(r.tree.md_kb)} KB dokumentów w ${pl(r.tree.md || 0, 'pliku', 'plikach', 'plikach')} .md` : ''),
      kvs(r.stack.length ? r.stack.slice(0, 2).join(', ') : (r.langs[0]?.[0] || '—'), 'stos', r.stack.length > 2 ? r.stack.slice(2).join(', ') : (r.langs.slice(1, 3).map(l => l[0]).join(', ')), 'word')));

  const doorsList = h('ul', { class: 'doors' });
  for (const d of r.docs) doorsList.append(h('li', null,
    h('div', null, h('a', { href: `${r.url}/blob/${encodeURIComponent(r.default)}/${d.p}`, target: '_blank', rel: 'noopener' }, h('code', { text: d.p })), d.t ? h('span', { class: 't', text: d.t }) : null),
    h('span', { class: 'when', text: d.ts ? 'zmieniony ' + ago(d.ts) : '' })));
  for (const b of decl) doorsList.append(h('li', null,
    h('div', null, h('span', { class: 't', text: 'Dokumenty wskazują gałąź' }), h('a', { href: `${r.url}/tree/${encodeURIComponent(b.n)}`, target: '_blank', rel: 'noopener' }, h('code', { text: b.n })),
      h('span', { class: 't', text: 'w: ' + b.decl.join(', ') })),
    h('span', { class: 'when', text: 'commit ' + ago(b.ts) })));
  if (r.pages) doorsList.append(h('li', null, h('div', null, h('span', { class: 't', text: 'Strona GitHub Pages' }), h('a', { href: r.pages, target: '_blank', rel: 'noopener', text: r.pages })), h('span', { class: 'when', text: '' })));
  const doors = h('section', { class: 'panel', 'aria-labelledby': 'h-doors' },
    h('h2', { id: 'h-doors', text: 'Gdzie wejść' }),
    h('p', { class: 'hint', text: 'Dokumenty wejścia z gałęzi domyślnej i gałęzie, które same wskazują. Najnowsza gałąź nie musi być frontem.' }),
    r.docs.length || decl.length || r.pages ? doorsList : h('p', { class: 'faint', text: 'Brak dokumentów wejścia na gałęzi domyślnej.' }));

  const finds = r.findings || [];
  const nowPanel = h('div', { class: 'grid2 nowp' },
    h('section', { class: 'panel', 'aria-labelledby': 'h-state' }, h('h2', { id: 'h-state', text: 'Stan według repo' }),
      r.state ? stateNote(r) : h('p', { class: 'hint', text: r.empty ? 'Repo nie ma commitów.' : 'Repo nie ma notatki stanu (STATE, CURRENT, PROJECT_STATE…). Najbliżej jest README, cytowane wyżej.' })),
    h('section', { class: 'panel', 'aria-labelledby': 'h-finds' }, h('h2', { id: 'h-finds', text: 'Ustalenia' }),
      h('p', { class: 'hint', text: 'Liczone regułami z gita i GitHuba przy każdym zrzucie. Decyzję zapisać możesz tylko Ty.' }),
      finds.length ? h('ul', { class: 'finds compact' }, finds.map(f => findingItem(f, false))) : h('p', { class: 'faint', text: 'Reguły nie znalazły tu nic do zgłoszenia.' })));
  v.append(h('div', { class: 'wrap' }, crumbs, header, nowPanel, h('div', { class: 'grid2' }, numbers, doors)));
  if (r.branches.length) v.append(h('div', { class: 'wrap' }, forestPanel(r)));
  // lower body: two columns that both carry weight — time on the left, work in flight on the right
  const left = h('div', { class: 'col' }), right = h('div', { class: 'col' });
  left.append(rhythmPanel(r));
  if (r.commits) left.append(clockPanel(r));
  right.append(prPanel(r));
  if (r.issues.length) right.append(h('section', { class: 'panel' }, h('h2', { text: 'Otwarte issues' }),
    h('ul', { class: 'doors' }, r.issues.map(i => h('li', null, h('a', { href: `${r.url}/issues/${i.n}`, target: '_blank', rel: 'noopener', text: `#${i.n} ${i.t}` }), h('span'))))));
  const les = [...r.lessons_out.map(id => ['out', LESSON[id]]), ...r.lessons_in.map(id => ['in', LESSON[id]])];
  if (les.length) right.append(h('section', { class: 'panel', 'aria-labelledby': 'h-les' },
    h('h2', { id: 'h-les', text: 'Lekcje między światami' }),
    h('p', { class: 'hint', text: 'Lekcje, które przeszły do innego projektu albo z innego przyszły. Opisana jest też droga, którą przeszły.' }),
    h('div', { class: 'lessons one' }, les.map(([dir, l]) => lessonCard(l, dir)))));
  const rawBox = h('div');
  left.append(h('section', { class: 'panel', 'aria-labelledby': 'h-raw' },
    h('h2', { id: 'h-raw', text: 'Surowe dane' }),
    h('p', { class: 'hint', text: 'Ten sam rekord, z którego zbudowana jest karta. Surowe źródło to pełnoprawna droga.' }),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn', type: 'button', onclick: e => { if (rawBox.firstChild) { rawBox.replaceChildren(); e.target.textContent = 'Pokaż JSON'; } else { rawBox.replaceChildren(h('pre', { class: 'raw', text: JSON.stringify(rawRecord(r), null, 1) })); e.target.textContent = 'Ukryj JSON'; } }, text: 'Pokaż JSON' }),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => copyText(JSON.stringify(rawRecord(r), null, 1), 'Rekord skopiowany'), text: 'Kopiuj rekord' })),
    rawBox));
  v.append(h('div', { class: 'wrap grid2 lower' }, left, right));
  return v;
}
function rawRecord(r) { const { days, ...rest } = r; return { ...rest, days_active: Object.keys(days).length, sense: senseOf('repo:' + r.name) }; }
function kvs(v, l, sub, cls) { return h('div', { class: cls || null }, h('div', { class: 'v', text: v }), h('div', { class: 'l' }, l, sub ? h('div', { class: 'faint', text: sub }) : null)); }
function ciWord(c) { return { success: 'zielone', failure: 'czerwone', cancelled: 'przerwane', skipped: 'pominięte', in_progress: 'w toku', queued: 'w kolejce' }[c] || c || '—'; }

/* branch forest */
const ROLE_LABEL = { 'domyślna': 'domyślna', 'wskazana': 'wskazana w dokumentach', 'pr-otwarty': 'PR otwarty', 'pr-szkic': 'PR szkic', 'pr-scalony': 'PR scalony', 'pr-zamknięty': 'PR zamknięty', 'alias': 'alias (ten sam commit)', 'pusty-czubek': 'pusty commit na czubku', 'wchłonięta': 'wchłonięta przez ' };
function forestPanel(r, width) {
  const sec = h('section', { class: 'panel', 'aria-labelledby': 'h-forest' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Widok gałęzi' });
  const body = h('div');
  const show = mode => {
    $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
    body.replaceChildren(mode === 'las' ? forestChart(r, width) : branchTable(r));
  };
  seg.append(h('button', { type: 'button', 'data-m': 'las', onclick: () => show('las'), text: 'Las' }), h('button', { type: 'button', 'data-m': 'tabela', onclick: () => show('tabela'), text: 'Tabela' }));
  const counts = {};
  r.branches.forEach(b => b.roles.forEach(x => { counts[x] = (counts[x] || 0) + 1; }));
  sec.append(
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '14px', flexWrap: 'wrap' } },
      h('div', null, h('h2', { id: 'h-forest', text: 'Las gałęzi' }),
        h('p', { class: 'hint', text: `Każda linia to gałąź od miejsca odejścia od ${r.default} do ostatniego commita. Kolor oznacza wiek czubka. Znaczniki to fakty, nie werdykty; nic tu nie jest „do usunięcia”.` })),
      seg),
    h('div', { class: 'chips', style: { marginBottom: '12px' } },
      Object.entries(counts).filter(([k]) => !['świeża', 'ciepła', 'chłodna'].includes(k)).map(([k, n]) => h('span', { class: 'chip' + (k === 'wskazana' ? ' link' : ''), text: `${ROLE_LABEL[k] === 'wchłonięta przez ' ? 'wchłonięte przez ' + r.default : (ROLE_LABEL[k] || k)}: ${n}` }))),
    body);
  if (r.stems.length) sec.append(h('div', { style: { marginTop: '14px' } }, h('p', { class: 'hint', text: 'Pasma nazw, czyli gałęzie o wspólnym rdzeniu nazwy. To grupowanie mechaniczne, nie znaczenie:' }),
    h('div', { class: 'stems' }, r.stems.map(x => h('span', { class: 'chip', text: `${x.pre}/ ${x.stem} · ${x.n}` })))));
  show('las');
  return sec;
}
function forestChart(r, width) {
  const wrapW = width || Math.min(innerWidth - 40, 1272);
  const narrow = wrapW < 700;
  const labelW = narrow ? 0 : Math.min(320, Math.round(wrapW * 0.3));
  const W = Math.max(320, wrapW - 2), lane = narrow ? 30 : 18, top = 26;
  const brs = [...r.branches].sort((a, b) => {
    const pa = a.roles.includes('domyślna') ? 0 : a.roles.includes('wskazana') ? 1 : 2;
    const pb = b.roles.includes('domyślna') ? 0 : b.roles.includes('wskazana') ? 1 : 2;
    return pa - pb || b.ts - a.ts;
  });
  const t0 = Math.min(r.first_ts || Infinity, ...brs.map(b => b.fork || b.ts)), t1 = Math.max(nowS(), r.last_ts || 0);
  const X = t => labelW + 12 + ((t - t0) / Math.max(1, t1 - t0)) * (W - labelW - 40);
  const Hh = top + brs.length * lane + 10;
  const svg = s('svg', { class: 'forest', viewBox: `0 0 ${W} ${Hh}`, width: W, height: Hh, role: 'img', 'aria-label': `Las gałęzi ${r.short}: ${pl(brs.length, 'gałąź', 'gałęzie', 'gałęzi')}` });
  const ax = s('g', { class: 'axis' });
  const span = t1 - t0, stepD = span / DAY > 120 ? 30 : span / DAY > 40 ? 14 : span / DAY > 12 ? 7 : 1;
  const tick0 = Math.ceil(t0 / DAY / stepD) * stepD;
  for (let d = tick0; d * DAY <= t1; d += stepD) {
    const x = X(d * DAY);
    ax.append(s('line', { x1: x, x2: x, y1: top - 6, y2: Hh - 6 }), s('text', { x: x + 3, y: 14, text: DFS.format(new Date(d * DAY * 1000)) }));
  }
  svg.append(ax);
  brs.forEach((b, i) => {
    const y = top + i * lane + lane / 2;
    const lvl = heatOf(b.ts);
    const g = s('g', { class: 'lane', 'data-i': i });
    g.append(s('rect', { class: 'lane-bg', x: 0, y: y - lane / 2, width: W, height: lane }));
    {
      // wide: names in a left column; narrow (phone): the name rides just above its own line
      const maxC = labelW ? 40 : Math.floor((W - 16) / 6.6);
      const lbl = s('text', { class: 'lane-label' + (labelW ? '' : ' above'), x: 8, y: labelW ? y + 4 : y - 6, text: b.n.length > maxC ? b.n.slice(0, maxC - 1) + '…' : b.n });
      if (b.roles.includes('wskazana')) lbl.setAttribute('style', 'fill: var(--link); font-weight: 700');
      g.append(lbl);
    }
    const isDef = b.roles.includes('domyślna');
    const x1 = X(isDef ? (r.first_ts || b.ts) : (b.fork || b.ts)), x2 = X(b.ts);
    const col = isDef ? 'var(--ink)' : lvl <= 0 ? 'var(--cold)' : `var(${heatVar(lvl)})`;
    const sw = isDef ? 3.2 : Math.max(1.4, Math.min(5, 1 + Math.log2(1 + (b.a || 0)) * 0.7));
    g.append(s('line', { x1, x2: Math.max(x2, x1 + 1.5), y1: y, y2: y, stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': b.roles.includes('wchłonięta') ? '3 3' : null, opacity: b.roles.includes('wchłonięta') ? .65 : 1 }));
    if (!isDef && b.fork) g.append(s('circle', { cx: x1, cy: y, r: 2, fill: 'var(--ink-3)' }));
    if (b.empty) g.append(s('circle', { cx: x2, cy: y, r: 4.2, fill: 'var(--ground-2)', stroke: col, 'stroke-width': 1.6 }));
    else g.append(s('circle', { cx: x2, cy: y, r: 3.4, fill: col }));
    if (b.roles.includes('wskazana')) g.append(s('path', { d: `M${x2 + 9} ${y - 5} l5 5 l-5 5 l-5 -5 z`, fill: 'var(--link)' }));
    if (b.pr) {
      const prCol = b.pr.st === 'scalony' ? 'var(--ok)' : b.pr.st === 'zamknięty' ? 'var(--ink-3)' : 'var(--warn)';
      g.append(s('text', { x: x2 + (b.roles.includes('wskazana') ? 20 : 9), y: y + 4, 'font-size': 10.5, fill: prCol, 'font-weight': 700, text: '#' + b.pr.n }));
    }
    if (b.alias.length) g.append(s('text', { x: x2 + (b.pr ? 50 : 9), y: y + 4, 'font-size': 11, fill: 'var(--ink-3)', text: '≡' + (b.alias.length + 1) }));
    g.addEventListener('pointermove', e => {
      $$('.lane.on', svg).forEach(x => x.classList.remove('on')); g.classList.add('on');
      tip(e, [h('div', { class: 'tt', style: { fontFamily: 'var(--font-code)', fontSize: '13px' }, text: b.n }),
        h('div', { class: 'ts', text: b.s }),
        h('div', { class: 'tm', text: [
          `ostatni commit ${ago(b.ts)} (${when(b.ts)})`,
          isDef ? 'gałąź domyślna' : `${fmt(b.a ?? 0)} przed ${r.default}, ${fmt(b.b ?? 0)} za`,
          b.fork ? `odeszła ${day(b.fork)}` : null,
          b.pr ? `PR #${b.pr.n} ${b.pr.st}: ${b.pr.t}` : null,
          b.decl.length ? 'wskazana w: ' + b.decl.join(', ') : null,
          b.alias.length ? 'ten sam commit co: ' + b.alias.join(', ') : null,
          b.empty ? 'czubek to pusty commit (może być świadkiem CI)' : null].filter(Boolean).join(' · ') })]);
    });
    g.addEventListener('pointerleave', () => { g.classList.remove('on'); untip(); });
    const link = s('a', { href: `${r.url}/tree/${encodeURIComponent(b.n)}`, target: '_blank', rel: 'noopener', 'aria-label': `Gałąź ${b.n}, ostatni commit ${ago(b.ts)}` });
    link.append(g);
    svg.append(link);
  });
  const legend = h('div', { class: 'forest-legend' },
    h('span', { class: 'sw' }, s('svg', { width: 26, height: 8 }, s('line', { x1: 2, x2: 24, y1: 4, y2: 4, stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-linecap': 'round' })), r.default),
    h('span', { class: 'sw' }, s('svg', { width: 12, height: 12 }, s('path', { d: 'M6 1 l5 5 l-5 5 l-5 -5z', fill: 'var(--link)' })), 'wskazana w dokumentach'),
    h('span', { class: 'sw' }, h('b', { style: { color: 'var(--warn)' }, text: '#12' }), 'PR otwarty lub szkic'),
    h('span', { class: 'sw' }, h('b', { style: { color: 'var(--ok)' }, text: '#12' }), 'PR scalony'),
    h('span', { class: 'sw' }, s('svg', { width: 26, height: 8 }, s('line', { x1: 2, x2: 24, y1: 4, y2: 4, stroke: 'var(--cold)', 'stroke-width': 2, 'stroke-dasharray': '3 3' })), 'wchłonięta (0 commitów przed ' + r.default + ')'),
    h('span', { class: 'sw' }, h('b', { text: '≡3' }), 'alias: kilka nazw, jeden commit'),
    h('span', { class: 'sw' }, s('svg', { width: 12, height: 12 }, s('circle', { cx: 6, cy: 6, r: 4, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.6 })), 'pusty commit na czubku'));
  return h('div', { class: 'forest-wrap' }, h('div', { class: 'forest-scroll' }, svg), legend);
}
function branchTable(r, maxH) {
  let sortKey = 'ts', dir = -1;
  const wrap = h('div', { class: 'table-wrap', style: { maxHeight: (maxH || 560) + 'px' } });
  const cols = [['n', 'Gałąź'], ['ts', 'Ostatni commit'], ['a', 'Przed'], ['b', 'Za'], ['roles', 'Fakty'], ['s', 'Ostatnia wiadomość']];
  const draw = () => {
    const rows = [...r.branches].sort((x, y) => {
      const a = x[sortKey], b = y[sortKey];
      if (sortKey === 'roles') return dir * (String(x.roles).localeCompare(String(y.roles)));
      if (typeof a === 'string') return dir * a.localeCompare(b);
      return dir * ((a ?? -1) - (b ?? -1));
    });
    const t = h('table', { class: 't' },
      h('thead', null, h('tr', null, cols.map(([k, l]) => h('th', { scope: 'col', 'aria-sort': sortKey === k ? (dir > 0 ? 'ascending' : 'descending') : 'none', onclick: () => { if (sortKey === k) dir *= -1; else { sortKey = k; dir = k === 'n' || k === 's' ? 1 : -1; } draw(); } }, l, sortKey === k ? (dir > 0 ? ' ↑' : ' ↓') : '')))),
      h('tbody', null, rows.map(b => h('tr', null,
        h('td', null, h('a', { href: `${r.url}/tree/${encodeURIComponent(b.n)}`, target: '_blank', rel: 'noopener' }, h('code', { text: b.n }))),
        h('td', { class: 'n', title: when(b.ts), text: ago(b.ts) }),
        h('td', { class: 'n', text: b.a == null ? '—' : fmt(b.a) }),
        h('td', { class: 'n', text: b.b == null ? '—' : fmt(b.b) }),
        h('td', null, b.roles.filter(x => !['świeża', 'ciepła', 'chłodna'].includes(x)).map(x => x === 'wchłonięta' ? 'wchłonięta' : (ROLE_LABEL[x] || x)).join(', ') + (b.pr ? ` #${b.pr.n}` : '')),
        h('td', { text: b.s })))));
    wrap.replaceChildren(t);
  };
  draw();
  return wrap;
}
function rhythmPanel(r) {
  const sec = h('section', { class: 'panel', 'aria-labelledby': 'h-rh' }, h('h2', { id: 'h-rh', text: 'Rytm' }));
  if (!r.first_ts) { sec.append(h('p', { class: 'faint', text: 'Brak commitów.' })); return sec; }
  const first = Math.floor(r.first_ts / DAY), end = Math.floor(nowS() / DAY);
  const life = Math.max(1, end - first + 1);
  const start = Math.min(first, end - 20); // show at least three weeks, so a new repo is a bar, not a wall
  const n = Math.max(1, end - start + 1);
  const W = 600, Hh = 120, bw = W / n;
  const vals = []; let mx = 1;
  for (let i = 0; i < n; i++) { const dd = new Date((start + i) * DAY * 1000).toISOString().slice(0, 10); const v0 = r.days[dd] || 0; vals.push(v0); mx = Math.max(mx, v0); }
  const svg = s('svg', { class: 'rhythm', viewBox: `0 0 ${W} ${Hh + 2}`, role: 'img', 'aria-label': `Commity dzień po dniu od ${day(r.first_ts)}; rekord ${r.max_day?.[1]} dnia ${r.max_day?.[0]}` });
  svg.append(s('line', { x1: 0, x2: W, y1: Hh + 0.5, y2: Hh + 0.5, stroke: 'var(--rule-2)' }));
  vals.forEach((v0, i) => {
    if (!v0) return;
    const bh = Math.max(1.5, (Hh - 6) * Math.sqrt(v0 / mx));
    const lvl = heatOf((start + i) * DAY + DAY / 2);
    svg.append(s('rect', { x: i * bw, y: Hh - bh, width: Math.max(1, bw - (bw > 3 ? 1 : 0)), height: bh, fill: lvl >= 1 ? `var(${heatVar(lvl)})` : 'var(--cold)' }, s('title', { text: `${DS.format(new Date((start + i) * DAY * 1000))}: ${pl(v0, 'commit', 'commity', 'commitów')}` })));
  });
  sec.append(h('p', { class: 'hint', text: `Każdy słupek to jeden dzień od pierwszego commita. Wysokość rośnie z pierwiastkiem liczby commitów, więc widać też małe dni. Pracowało ${pl(r.active_days, 'dzień', 'dni', 'dni')} z ${fmt(life)}.` }), svg,
    h('div', { class: 'rhythm-ax' }, h('span', { text: day(start * DAY + DAY / 2) + (start < first ? ' (repo powstało ' + day(r.first_ts) + ')' : '') }), h('span', { text: 'dziś' })));
  if (r.coauthors?.length) sec.append(h('p', { class: 'hint', style: { marginTop: '12px' }, text: 'Współautorzy w commitach: ' + r.coauthors.map(([n0, c]) => `${n0} (${c})`).join(', ') + '.' }));
  return sec;
}
function prPanel(r) {
  const sec = h('section', { class: 'panel', 'aria-labelledby': 'h-pr' }, h('h2', { id: 'h-pr', text: 'Otwarte pull requesty' }));
  if (r.api === false) { sec.append(h('p', { class: 'hint' }, 'Ten zrzut nie ma danych z API GitHuba dla tego repo, więc nie wiem, czy są tu pull requesty. ', h('a', { href: `${r.url}/pulls`, target: '_blank', rel: 'noopener', text: 'Sprawdź na GitHubie' }))); return sec; }
  if (!r.prs.open_list.length) { sec.append(h('p', { class: 'hint', text: r.prs.total ? `Brak otwartych. Łącznie ${pl(r.prs.total, 'PR', 'PR-y', 'PR-ów')}, z czego ${fmt(r.prs.merged)} scalonych.` : 'To repo nie używa pull requestów.' })); return sec; }
  const FIRST = 4, list = r.prs.open_list;
  const card = p => h('div', { class: 'pr' },
    h('div', { class: 'top' }, h('a', { href: `${r.url}/pull/${p.n}`, target: '_blank', rel: 'noopener', text: `#${p.n} ${p.t}` }),
      h('span', { class: 'chip' + (p.draft ? ' hyp' : ''), text: p.draft ? 'szkic' : 'otwarty' }), h('span', { class: 'faint', style: { fontSize: '12px' }, text: 'zmiana ' + ago(isoTs(p.upd)) })),
    h('code', { class: 'faint', style: { fontSize: '11.5px' }, text: p.head }),
    p.body ? h('p', { class: 'body', text: p.body.replace(/[#*`>|_-]{1,3}/g, ' ').replace(/\s+/g, ' ').trim() }) : null);
  const box = h('div', { class: 'prs' }, list.slice(0, FIRST).map(card));
  sec.append(h('p', { class: 'hint', text: `${pl(r.prs.open, 'otwarty', 'otwarte', 'otwartych')}, ${pl(r.prs.draft, 'szkic', 'szkice', 'szkiców')}. Szkice PR bywają kapsułami wiedzy, a nie porzuconą pracą. Opis pochodzi z samego PR-a.` }), box);
  if (list.length > FIRST) {
    const more = h('button', { class: 'btn ghost', type: 'button', style: { marginTop: '12px' }, text: `Pokaż jeszcze ${list.length - FIRST}`,
      onclick: () => { box.append(...list.slice(FIRST).map(card)); more.remove(); } });
    sec.append(more);
  }
  if (r.prs.open > list.length) sec.append(h('p', { class: 'hint', style: { marginTop: '10px' } }, `Tu ${list.length} ostatnio zmienianych z ${r.prs.open}. `, h('a', { href: `${r.url}/pulls`, target: '_blank', rel: 'noopener', text: 'Wszystkie na GitHubie' })));
  return sec;
}

/* work clock: 24 h radial histogram + weekday strip. Hours are the local time recorded in each commit
   (99% carry +0200, Polish summer time); weekdays are counted in UTC. Ink only: this is not heat. */
const WD = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];
function clockChart(hours, size, label, center) {
  const S = size, cx = S / 2, cy = S / 2, r0 = S * 0.19, r1 = S * 0.39;
  const mx = Math.max(1, ...hours), peak = hours.indexOf(Math.max(...hours));
  const ang = hh => (hh / 24) * Math.PI * 2 - Math.PI / 2;
  const P = (a, rr) => `${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  const sector = (a0, a1, ra, rb) => `M${P(a0, rb)} A${rb} ${rb} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(a1, rb)} L${P(a1, ra)} A${ra} ${ra} 0 ${a1 - a0 > Math.PI ? 1 : 0} 0 ${P(a0, ra)} Z`;
  const svg = s('svg', { class: 'clock', viewBox: `0 0 ${S} ${S}`, width: S, height: S, role: 'img',
    'aria-label': `${label}: najwięcej commitów między ${peak}:00 a ${(peak + 1) % 24}:00, najmniej między ${hours.indexOf(Math.min(...hours))}:00 a ${(hours.indexOf(Math.min(...hours)) + 1) % 24}:00.` });
  svg.append(s('path', { class: 'night', d: sector(ang(22), ang(30), r0 - 4, r1 + 8) }));
  svg.append(s('circle', { class: 'ring', cx, cy, r: r1 }), s('circle', { class: 'ring', cx, cy, r: r0 + (r1 - r0) * Math.SQRT1_2 }), s('circle', { class: 'ring', cx, cy, r: r0 }));
  for (let i = 0; i < 24; i++) {
    const v = hours[i], a0 = ang(i) + 0.03, a1 = ang(i + 1) - 0.03;
    const rr = r0 + (r1 - r0) * Math.sqrt(v / mx);
    svg.append(s('path', { class: 'wedge' + (i === peak ? ' peak' : ''), d: sector(a0, a1, r0, Math.max(r0 + 0.8, rr)) },
      s('title', { text: `${i}:00–${(i + 1) % 24}:00 · ${pl(v, 'commit', 'commity', 'commitów')}` })));
  }
  for (let i = 0; i < 24; i += 1) {
    const a = ang(i), major = i % 6 === 0;
    svg.append(s('line', { class: 'tick' + (major ? ' major' : ''), x1: cx + Math.cos(a) * (r1 + 3), y1: cy + Math.sin(a) * (r1 + 3), x2: cx + Math.cos(a) * (r1 + (major ? 9 : 5)), y2: cy + Math.sin(a) * (r1 + (major ? 9 : 5)) }));
    if (major) svg.append(s('text', { class: 'hl', x: cx + Math.cos(a) * (r1 + 17), y: cy + Math.sin(a) * (r1 + 17) + 4, 'text-anchor': 'middle', text: i ? String(i) : '0:00' }));
  }
  const [c1, c2] = center || [`${peak}:00`, 'szczyt'];
  svg.append(s('text', { class: 'c1' + (S > 260 ? ' big' : ''), x: cx, y: cy + 2, 'text-anchor': 'middle', text: c1 }), s('text', { class: 'c2', x: cx, y: cy + (S > 260 ? 22 : 16), 'text-anchor': 'middle', text: c2 }));
  return h('figure', { class: 'clockfig' }, svg, h('figcaption', { class: 'clock-key' }, h('i', { 'aria-hidden': 'true' }), 'noc, 22:00–6:00'));
}
function weekStrip(wd) {
  const mx = Math.max(1, ...wd), tot = wd.reduce((a, b) => a + b, 0) || 1;
  return h('div', { class: 'week', role: 'img', 'aria-label': 'Dni tygodnia: ' + WD.map((d, i) => `${d} ${wd[i]}`).join(', ') },
    WD.map((d, i) => h('div', { class: 'wd' + (wd[i] === mx ? ' peak' : ''), 'data-tip': `${d}: ${pl(wd[i], 'commit', 'commity', 'commitów')}` },
      h('div', { class: 'wbar' }, h('i', { style: { height: (100 * wd[i] / mx).toFixed(1) + '%' } })),
      h('b', { text: d }), h('small', { text: Math.round(100 * wd[i] / tot) + '%' }))));
}
function clockPanel(r) {
  const sec = h('section', { class: 'panel', 'aria-labelledby': 'h-clock' }, h('h2', { id: 'h-clock', text: 'Zegar pracy' }),
    h('p', { class: 'hint', text: 'O której godzinie powstają commity (czas polski zapisany w commitach) i w które dni. Konto jest wspólne, więc zegar nie mówi, kto pisał.' }));
  sec.append(h('div', { class: 'clockrow' }, clockChart(r.hours, 210, 'Godziny commitów ' + r.short), weekStrip(r.weekdays)));
  return sec;
}
function lessonCard(l, dir) {
  return h('article', { class: 'lesson' },
    h('div', { class: 'lid', text: l.id }),
    h('h3', { text: l.title }),
    h('p', { class: 'ft' }, h('a', { href: routeFor(l.from), text: R[l.from]?.short || l.from }), ' do ', l.to.map((t, i) => [i ? ', ' : '', h('a', { href: routeFor(t), text: R[t]?.short || t })]), dir ? (dir === 'out' ? ' (stąd wyszła)' : ' (tu przyszła)') : ''),
    h('dl', null,
      h('dt', { text: 'Co działało' }), h('dd', { text: l.positive }),
      h('dt', { text: 'Co nie działało' }), h('dd', { text: l.negative }),
      h('dt', { text: 'Efekt u odbiorcy' }), h('dd', null, l.effect, ' ', l.effect_links.map(([t, u]) => [h('a', { href: u, target: '_blank', rel: 'noopener', text: t }), ' '])),
      h('dt', { text: 'Droga' }), h('dd', null, l.route, ' ', l.route_links.map(([t, u]) => [h('a', { href: u, target: '_blank', rel: 'noopener', text: t }), ' ']), h('a', { href: l.source, target: '_blank', rel: 'noopener', text: 'źródło lekcji' }))));
}

/* ---------------- HISTORY ---------------- */
function historyView() {
  const v = h('div', { class: 'view history' });
  const box = h('div', { class: 'ridge-box' });
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-hist' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-hist', text: 'Historia odkrywania' }),
      h('p', { text: 'Każdy grzbiet to jeden świat: commity dzień po dniu, od najstarszego u góry do najmłodszego na dole. GitHub pamięta tylko część drogi; resztę zna prolog po lewej.' })),
      h('div', { class: 'side', text: `${pl(D.estate.totals.active_days, 'aktywny dzień', 'aktywne dni', 'aktywnych dni')} estate’u` })),
    h('div', { class: 'hist', style: { marginTop: '22px' } },
      h('div', null, h('h3', { style: { fontFamily: 'var(--font-display)', fontStretch: '112%', fontSize: 'var(--t-xl)', marginBottom: '14px' }, text: 'Prolog' }),
        h('ol', { class: 'prolog' }, D.prolog.map(p => h('li', { class: p.kind + (p.when === 'kiedyś' ? ' future' : '') },
          h('div', { class: 'when', text: p.when }), h('div', { class: 'what', text: p.what }), h('div', { class: 'src', text: p.kind === 'stated' ? 'Twoje słowa' : 'z gita' }))))),
      box)));
  // the estate's clock: every commit from every repo, by hour and weekday
  const HRS = new Array(24).fill(0), WDS = new Array(7).fill(0);
  for (const r of D.repos) { (r.hours || []).forEach((n, i) => { HRS[i] += n; }); (r.weekdays || []).forEach((n, i) => { WDS[i] += n; }); }
  const quiet = HRS.indexOf(Math.min(...HRS)), loud = HRS.indexOf(Math.max(...HRS));
  const night = [22, 23, 0, 1, 2, 3, 4, 5].reduce((a, i) => a + HRS[i], 0), all = HRS.reduce((a, b) => a + b, 0) || 1;
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-clk' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-clk', text: 'Zegar estate’u' }),
      h('p', { text: `${pl(all, 'commit', 'commity', 'commitów')} ze wszystkich repo według godziny zapisanej w commicie (99% ma polski czas letni). Estate cichnie naprawdę tylko o świcie.` }))),
    h('div', { class: 'clock-big' },
      clockChart(HRS, 340, 'Godziny wszystkich commitów', [fmt(all), plural(all, 'commit', 'commity', 'commitów')]),
      h('div', { class: 'clock-facts' },
        fact(`${loud}:00`, 'najgłośniejsza godzina', pl(HRS[loud], 'commit', 'commity', 'commitów')),
        fact(`${quiet}:00`, 'najcichsza godzina', pl(HRS[quiet], 'commit', 'commity', 'commitów')),
        fact(Math.round(100 * night / all) + '%', 'commitów między 22:00 a 6:00', 'konto jest wspólne: zegar nie mówi, kto pisał'),
        h('div', { class: 'fact wide' }, h('div', { class: 'l', style: { marginBottom: '10px' }, text: 'Dni tygodnia (liczone w UTC, czyli 2 godziny wcześniej niż w Polsce)' }), weekStrip(WDS))))));
  const quotes = h('section', { class: 'wrap sec' }, h('div', { class: 'sec-h' }, h('div', null, h('h2', { text: 'Jak sam o tym mówisz' }))),
    h('div', { class: 'quotes', style: { marginTop: '16px', maxWidth: '80ch' } }, D.estate_stated.map(t => h('blockquote', { class: 'quote' }, h('p', { style: { fontSize: 'var(--t-l)' }, text: t }), h('cite', { text: 'Twoje słowa, rozmowa z 8–9 października 2026' })))));
  v.append(quotes);
  v._after = () => { box.replaceChildren(ridgeline(Math.round(box.getBoundingClientRect().width))); };
  return v;
}
function ridgeline(W) {
  const rs = D.repos.filter(r => r.first_ts && r.first_ts > Date.parse('2026-01-01') / 1000).sort((a, b) => a.first_ts - b.first_ts);
  const old = D.repos.filter(r => r.first_ts && r.first_ts <= Date.parse('2026-01-01') / 1000);
  const t0 = Date.parse('2026-05-01T00:00:00Z') / 1000, t1 = nowS();
  const nD = Math.ceil((t1 - t0) / DAY);
  const narrow = W < 640;
  // the label column is as wide as the longest name needs ("nr 15  Box3D Character Controller" must not be cut)
  const longest = Math.max(0, ...rs.map(r => `nr ${r.no}  ${r.short}`.length));
  const labelW = narrow ? 0 : Math.round(Math.min(280, Math.max(150, longest * 7 + 16))), rightW = narrow ? 0 : 70, rowH = narrow ? 24 : 27, amp = narrow ? 50 : 74, top = 30 + amp;
  const H = top + rs.length * rowH + 48;
  const X = d => labelW + (d / (nD - 1)) * (W - labelW - rightW - 8);
  let gmax = 1;
  const series = rs.map(r => { const vals = new Array(nD).fill(0); for (const [d, n] of Object.entries(r.days)) { const i = Math.floor((Date.parse(d + 'T12:00:00Z') / 1000 - t0) / DAY); if (i >= 0 && i < nD) vals[i] += n; } const sm = vals.map((v0, i) => (vals[i - 1] || 0) * 0.25 + v0 * 0.5 + (vals[i + 1] || 0) * 0.25); gmax = Math.max(gmax, ...sm); return { r, sm, raw: vals }; });
  const svg = s('svg', { class: 'ridges', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Kaskada: commity każdego świata dzień po dniu od maja 2026.' });
  const defs = s('defs');
  const gid = 'rg' + Math.random().toString(36).slice(2, 7);
  defs.append(s('linearGradient', { id: gid, x1: 0, y1: 1, x2: 0, y2: 0 },
    s('stop', { offset: '0%', 'stop-color': 'var(--plate)', 'stop-opacity': 1 }), s('stop', { offset: '55%', 'stop-color': 'var(--h2)', 'stop-opacity': .55 }), s('stop', { offset: '100%', 'stop-color': 'var(--h4)', 'stop-opacity': .95 })));
  svg.append(defs);
  const ax = s('g', { class: 'axis' });
  for (let m = 4; m <= 9; m++) {
    const ts = Date.UTC(2026, m, 1) / 1000; if (ts > t1) break;
    const x = X((ts - t0) / DAY);
    ax.append(s('line', { x1: x, x2: x, y1: 18, y2: H - 36 }), s('text', { x: x + 4, y: 14, text: new Intl.DateTimeFormat('pl-PL', { month: narrow ? 'short' : 'long', timeZone: 'UTC' }).format(new Date(ts * 1000)).replace('.', '') }));
  }
  svg.append(ax);
  const marks = s('g', { class: 'mark' });
  // markers sit on two label rows so neighbours never collide
  const mark = (dateStr, label, row) => {
    const x = X((Date.parse(dateStr + 'T12:00:00Z') / 1000 - t0) / DAY), ly = H - 22 + row * 14;
    marks.append(s('line', { x1: x, x2: x, y1: 20, y2: ly - 10 }), s('circle', { cx: x, cy: ly - 10, r: 2.2 }), s('text', { x: x - 6, y: ly, 'text-anchor': 'end', text: label }));
  };
  if (D.estate.totals.busiest_day) mark(D.estate.totals.busiest_day[0], `${DFS.format(new Date(D.estate.totals.busiest_day[0] + 'T12:00:00Z'))}: ${fmt(D.estate.totals.busiest_day[1])} commitów w jeden dzień`, 0);
  if (!narrow) mark('2026-10-03', 'powstaje Medium', 1);
  const overlay = s('g', { class: 'labels', 'pointer-events': 'none' });
  series.forEach((sr, i) => {
    const base = top + i * rowH;
    const g = s('g', { class: 'ridge' });
    let d = `M${X(0)} ${base}`;
    sr.sm.forEach((v0, j) => { d += ` L${X(j).toFixed(1)} ${(base - amp * Math.sqrt(v0 / gmax)).toFixed(1)}`; });
    d += ` L${X(nD - 1)} ${base} Z`;
    g.append(s('path', { class: 'area', d, fill: `url(#${gid})` }));
    g.append(s('line', { x1: X(0), x2: X(nD - 1), y1: base + 0.5, y2: base + 0.5, stroke: 'var(--rule)' }));
    if (narrow) overlay.append(s('text', { class: 'rl halo', x: 2, y: base - 5, text: sr.r.short })); // on top of every ridge
    else g.append(s('text', { class: 'rl', x: labelW - 10, y: base - 4, 'text-anchor': 'end', text: 'nr ' + sr.r.no + '  ' + sr.r.short }));
    if (rightW) g.append(s('text', { class: 'rn', x: W - 2, y: base - 4, 'text-anchor': 'end', text: fmt(sr.r.commits) }));
    g.append(s('rect', { x: 0, y: base - rowH, width: W, height: rowH, fill: 'transparent' }));
    g.addEventListener('pointermove', e => {
      const bx = svg.getBoundingClientRect(); const k = (e.clientX - bx.left) * (W / bx.width);
      const j = Math.max(0, Math.min(nD - 1, Math.round((k - labelW) / (W - labelW - rightW - 8) * (nD - 1))));
      const dd = new Date((t0 + j * DAY) * 1000);
      $$('.ridge.on', svg).forEach(x => x.classList.remove('on')); g.classList.add('on');
      tip(e, [h('div', { class: 'tt', text: sr.r.short }), h('div', { class: 'ts', text: `${DF.format(dd)}: ${pl(sr.raw[j], 'commit', 'commity', 'commitów')}` }), h('div', { class: 'tm', text: `założone ${day(sr.r.first_ts)} · razem ${pl(sr.r.commits, 'commit', 'commity', 'commitów')}` })]);
    });
    g.addEventListener('pointerleave', () => { g.classList.remove('on'); untip(); });
    g.addEventListener('click', () => go(routeFor(sr.r.name)));
    g.style.cursor = 'pointer';
    svg.append(g);
  });
  svg.append(marks, overlay);
  const box = h('div');
  box.append(svg);
  if (old.length) box.append(h('p', { class: 'hint', style: { marginTop: '10px', color: 'var(--ink-3)', fontSize: '13px' } }, 'Poza kaskadą (2025): ', old.map((r, i) => [i ? ', ' : '', h('a', { href: routeFor(r.name), text: r.short }), ` (${day(r.first_ts)}, ${pl(r.commits, 'commit', 'commity', 'commitów')})`]), '. ', D.repos.filter(r => !r.first_ts).map(r => `${r.short} nie ma żadnego commita.`).join(' ')));
  return box;
}

/* ---------------- KNOWLEDGE ---------------- */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
function knowledgeView() {
  const v = h('div', { class: 'view knowledge' });
  v.append(h('div', { class: 'wrap' }, h('aside', { class: 'dated', role: 'note' },
    h('b', { text: 'Datowany zapis, nie żywy stan. ' }),
    `Ta zakładka to notatki z rozmów o Bibliotece (z GPT, agentami i z Tobą, ${LDAY.format(new Date(D.ledger[0].t))} – ${LDAY.format(new Date(D.ledger[D.ledger.length - 1].t))}) z linkami do źródeł. Nie odświeża się sama i nie opisuje bieżącego stanu repo; bieżący stan pokazuje `,
    h('a', { href: '#panorama', onclick: e => { e.preventDefault(); go('#panorama'); setTimeout(() => document.getElementById('h-fam')?.scrollIntoView({ block: 'start' }), 80); }, text: 'Kataster' }), '.')));
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-laws' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-laws', text: 'Prawa Biblioteki' }),
      h('p', { text: 'Zasady, które wyłoniły się z nocnej rozmowy z GPT i z Twoich decyzji. Według nich Biblioteka jest zbudowana i według nich można ją sprawdzać.' })),
      h('div', { class: 'side', text: pl(D.laws.length, 'prawo', 'prawa', 'praw') })),
    h('div', { class: 'laws' }, D.laws.map((l, i) => h('article', { class: 'law numbered', id: 'law-' + l.id },
      h('div', { class: 'law-no', 'aria-hidden': 'true', text: ROMAN[i] }),
      h('h3', { text: l.title }), h('p', { text: l.text }),
      h('div', { class: 'o' }, h('span', { text: l.origin }), l.sources.map(([t, u]) => h('a', { href: u, target: '_blank', rel: 'noopener', text: t }))))))));
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-dna' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-dna', text: 'Wspólne DNA Twoich projektów' }),
      h('p', { text: 'Te same zasady wracają w różnych repo, choć nikt ich nie kopiował. Cytaty pochodzą z dokumentów, z linkiem do dokładnej wersji.' }))),
    h('div', { class: 'dna', style: { marginTop: '18px' } }, D.dna.map(d => h('div', { class: 'dna-item' }, h('h3', { text: d.title }),
      h('div', { class: 'quotes' }, d.quotes.map(([who, q, u]) => h('blockquote', { class: 'quote' }, h('p', { text: q }), h('cite', null, h('a', { href: u, target: '_blank', rel: 'noopener', text: who }))))))))));
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-flow' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-flow', text: 'Lekcje, które przeszły między światami' }),
      h('p', { text: 'Wszystkie trzy trafiły dziś do Combat Lab i zmieniły prawdziwe eksperymenty. Żadna nie została odkryta dzięki Medium; Medium było najwyżej zapisem. To rzetelny punkt wyjścia do następnej próby.' }))),
    flowDiagram(), h('div', { class: 'lessons' }, D.lessons.map(l => lessonCard(l))),
    h('div', { class: 'laws two', style: { marginTop: '22px' } }, D.methods.map(m => h('article', { class: 'law' }, h('h3', { text: m.title }), h('p', { text: m.text }), h('div', { class: 'o', text: m.origin }))))));
  const tbl = h('table', { class: 't cases' }, h('thead', null, h('tr', null, h('th', { text: 'Przypadek' }), h('th', { text: 'Co się stało' }), h('th', { text: 'Rodzaj' }), h('th', { text: 'Źródło' }))),
    h('tbody', null, D.cases.map(c => h('tr', null, h('td', { text: c.id }), h('td', { text: c.title }), h('td', { class: 'faint', text: c.kind }), h('td', null, h('a', { href: c.url, target: '_blank', rel: 'noopener', text: 'otwórz' }))))));
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-cases' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-cases', text: `Przypadki C1–C${D.cases.length}` }), h('p', { text: 'Prawdziwe zdarzenia z ostatnich dni, na których sprawdzamy każdy projekt Biblioteki. C16 to wpadka samej Biblioteki, zapisana od razu.' }))),
    h('div', { class: 'table-wrap', style: { marginTop: '16px' } }, tbl)));
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-led' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-led', text: `Dziennik rozmowy: ${LDAY.format(new Date(D.ledger[0].t))} – ${LDAY.format(new Date(D.ledger[D.ledger.length - 1].t))}` }), h('p', { text: 'Kto, kiedy i co wniósł do rozmowy o Bibliotece. Czas polski; datowany zapis, nie żywy stan.' }))),
    h('ol', { class: 'ledger', style: { marginTop: '10px' } }, (() => {
      let prev = '';
      return D.ledger.flatMap(e => {
        const k = DKEY.format(new Date(e.t)), out = [];
        if (k !== prev) { out.push(h('li', { class: 'day', text: LDAY.format(new Date(e.t)) })); prev = k; }
        out.push(h('li', { class: e.who === 'Ty' ? 'you' : '' },
          h('span', { class: 'tm', text: TF.format(new Date(e.t)) }), h('span', { class: 'who', text: e.who }),
          h('span', { class: 'what' }, e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener', text: e.what }) : e.what)));
        return out;
      });
    })())));
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-open' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-open', text: 'Otwarte' }))),
    h('ul', { style: { marginTop: '14px', display: 'grid', gap: '8px', maxWidth: '80ch', paddingLeft: '20px' } }, D.open.map(t => h('li', { text: t })))));
  return v;
}
function flowDiagram() {
  const W = 860, Hh = 250;
  const svg = s('svg', { class: 'flow', viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': 'Przepływ lekcji: Box3D Character Controller, Companion Brain i ReflexBrain oddały lekcje do Combat Lab.' });
  const donors = D.lessons.map(l => l.from);
  const nodes = donors.map((n, i) => ({ n, x: 20, y: 30 + i * 80, w: 270, hh: 46 }));
  const target = { n: 'Combat-Lab', x: W - 250, y: Hh / 2 - 26, w: 230, hh: 52 };
  nodes.forEach((nd, i) => {
    const l = D.lessons[i];
    const x1 = nd.x + nd.w, y1 = nd.y + nd.hh / 2, x2 = target.x, y2 = target.y + target.hh / 2 + (i - 1) * 12;
    const mx = (x1 + x2) / 2;
    const g = s('g', { class: 'edge' });
    g.append(s('path', { d: `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2 - 8} ${y2}` }), s('path', { d: `M${x2 - 10} ${y2 - 5} L${x2} ${y2} L${x2 - 10} ${y2 + 5}`, 'stroke-linejoin': 'round' }));
    g.append(s('text', { x: mx, y: (y1 + y2) / 2 - 8, 'text-anchor': 'middle', text: l.id }));
    svg.append(g);
  });
  for (const nd of [...nodes, target]) {
    const r = R[nd.n];
    const a = s('a', { href: routeFor(nd.n), class: 'node' });
    a.append(s('rect', { x: nd.x, y: nd.y, width: nd.w, height: nd.hh, rx: 8 }), s('text', { x: nd.x + 16, y: nd.y + nd.hh / 2 + 5, text: r?.short || nd.n }));
    svg.append(a);
  }
  return svg;
}

/* ---------------- AGENTS ---------------- */
function agentBrief() {
  const C = D.estate.coverage, lines = [];
  lines.push(`Biblioteka Jozzpoly: brief dla agentów. Zrzut ${D.estate.generated.replace('+00:00', '').replace('T', ' ')} UTC. Pokrycie ${C.collected}/${C.expected} repo (${C.public} publicznych, ${C.private} prywatnych).`);
  lines.push('Zasady: zdania o sensie to hipotezy Claude, chyba że Owner je potwierdził. Najnowsza gałąź to nie front; patrz pole „wskazana”. Nieodwracalne decyzje tylko bezpośrednio od Ownera. Nic nie znika, dopóki jego sens nie jest zapisany gdzie indziej.');
  for (const f of D.families) {
    lines.push(`\n## ${f.name}`);
    for (const n of f.repos) {
      const r = R[n], decl = r.branches.filter(b => b.roles.includes('wskazana')).map(b => b.n);
      const st = senseOf('repo:' + r.name);
      lines.push(`- ${r.name}${r.private ? ' (prywatne)' : ''} [${r.life}]: ${senseText(r)} [${st ? SENSE_WORD[st.status] : 'hipoteza'}]. Ostatni commit ${ago(r.last_ts)}; ${pl(r.commits, 'commit', 'commity', 'commitów')}, ${pl(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi')}, ${prOpenTxt(r)}.${decl.length ? ' Dokumenty wskazują: ' + decl.join(', ') + '.' : ''}${r.docs.length ? ' Wejście: ' + r.docs.slice(0, 4).map(d => d.p).join(', ') + '.' : ''}${r.pages ? ' Pages: ' + r.pages : ''}`);
      if (r.state?.status) lines.push(`  Stan według repo (${r.state.path}${r.state.date ? ', ' + r.state.date : ''}): „${r.state.status}”`);
      for (const f0 of (r.findings || []).filter(x => x.sev === 'high' || x.sev === 'mid')) {
        const d0 = decision[f0.id];
        lines.push(`  [${SEV[f0.sev]}] ${f0.title.replace(/`/g, '')}${d0 ? ` — decyzja Ownera: ${DECISION[d0.status] || d0.status} (${d0.at.slice(0, 10)})` : ''}`);
      }
    }
  }
  const forAgent = ALL_FINDINGS.filter(f0 => decision[f0.id]?.status === 'agent');
  if (forAgent.length) {
    lines.push('\n## Zlecone agentom przez Ownera (zapisane w Bibliotece, tylko właściciel może je zapisać)');
    for (const f0 of forAgent) lines.push(`- ${f0.repo}: ${f0.title.replace(/`/g, '')} (decyzja ${decision[f0.id].at.slice(0, 10)})`);
  }
  return lines.join('\n');
}
const SOURCES = ['GENERATOR.md', 'tools/regen.py', 'tools/save_list.py', 'tools/collect_git.py', 'tools/collect_gh.py', 'tools/findings.py', 'tools/knowledge.py', 'tools/build.py', 'tools/render.py',
  'tools/shoot.mjs', 'src/app.js', 'src/style.css', 'src/index.html.txt', 'package.json'];
function agentsView() {
  const C = D.estate.coverage;
  const v = h('div', { class: 'view agents' });
  const dl = async (name, data) => {
    if (!cap.downloads) return copyText(data, 'Skopiowane do schowka');
    try { await cap.downloads.save({ filename: name, data }); }
    catch (e) {
      if (e?.code === 'declined') return;
      if (e?.code === 'rate_limited') { toast('Okno zapisu jest już otwarte. Spróbuj za chwilę.'); return; }
      // saves unusable in this view: fall back to the clipboard and stop offering downloads
      if (['unavailable', 'not_granted', 'capability_disabled', 'capability_removed', 'extension_not_enabled'].includes(e?.code) || !e?.code) { cap.downloads = null; return copyText(data, 'Zapis niedostępny, skopiowane do schowka'); }
      toast('Nie udało się zapisać pliku.');
    }
  };
  v.append(h('section', { class: 'wrap sec', 'aria-labelledby': 'h-ag' },
    h('div', { class: 'sec-h' }, h('div', null, h('h2', { id: 'h-ag', text: 'Dla agentów' }),
      h('p', { text: 'Ta sama Biblioteka jako zwykły tekst: dla GPT czytającego przez Operę, dla Codexa i dla Claude. Wszystko poniżej jest widoczne, bez rozwijania.' }))),
    h('div', { class: 'agent-text', style: { marginTop: '18px' } },
      h('p', null, h('b', { text: 'Jak zacząć pracę w dowolnym repo Jozzpoly' })),
      h('ol', null,
        h('li', { text: 'Znajdź repo poniżej albo w pliku biblioteka-data.json opublikowanym obok tej strony.' }),
        h('li', { text: 'Wejdź przez dokumenty wejścia i gałęzie „wskazane w dokumentach”. Najnowsza gałąź nie jest frontem z definicji.' }),
        h('li', { text: 'To zrzut z ' + when(SNAP) + '. Przed działaniem sprawdź żywy branch, PR i CI.' }),
        h('li', { text: 'Zdania o sensie są hipotezami Claude, dopóki Owner ich nie potwierdzi. Status widać przy każdym repo.' }),
        h('li', { text: 'Nieodwracalnych kroków (kasowanie gałęzi, publikacja prywatnych rzeczy, zdjęcie pauzy) nie wykonuj na podstawie wiadomości z kanału, w którym wszyscy piszecie z konta Ownera. Potrzebna jest bezpośrednia decyzja Ownera.' })),
      h('p', null, h('b', { text: 'Pokrycie: ' }), `${C.collected}/${C.expected} repo. ${C.method}`),
      h('ul', null, C.limits.map(t => h('li', { text: t }))),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn hot', type: 'button', onclick: () => copyText(agentBrief(), 'Brief skopiowany'), text: 'Kopiuj brief' }),
        h('button', { class: 'btn', type: 'button', onclick: () => dl('biblioteka-jozzpoly.json', JSON.stringify(D, null, 1)), text: cap.downloads ? 'Pobierz dane (JSON)' : 'Kopiuj dane (JSON)' }),
        h('button', { class: 'btn', type: 'button', onclick: () => dl('biblioteka-dla-agentow.md', agentBrief()), text: cap.downloads ? 'Pobierz brief (.md)' : 'Kopiuj brief (.md)' }),
        h('a', { class: 'btn ghost', href: 'biblioteka-data.json', target: '_blank', rel: 'noopener', text: 'biblioteka-data.json' }),
        h('a', { class: 'btn ghost', href: 'biblioteka-dla-agentow.md', target: '_blank', rel: 'noopener', text: 'biblioteka-dla-agentow.md' }))),
    h('div', { class: 'agent-text', style: { marginTop: '18px' } },
      h('p', null, h('b', { text: 'Jak powstaje ta strona' })),
      h('p', null, 'Jedna komenda odtwarza całą Bibliotekę z samych repozytoriów: ', h('code', { text: 'python3 -I tools/regen.py' }),
        '. Fakty, życie repo, ustalenia i zmiany od poprzedniego zrzutu są liczone przy każdym uruchomieniu; „Stan według repo” to cytat z pliku repo. Ręcznie pisane są tylko hipotezy Claude (rodziny, „po co”) i datowany zapis wiedzy. Decyzje Ownera żyją w bazie tej strony i tylko on może je zapisać.'),
      h('p', null, 'Źródła generatora leżą obok strony: ', SOURCES.map((f, i) => [i ? ', ' : '', h('a', { href: 'zrodla/' + f, target: '_blank', rel: 'noopener' }, h('code', { text: f }))]), '.')),
    h('div', { class: 'agent-index', style: { marginTop: '26px' } }, D.families.flatMap(f => f.repos.map(n => {
      const r = R[n], decl = r.branches.filter(b => b.roles.includes('wskazana')).map(b => b.n), st = senseOf('repo:' + n);
      return h('p', null, h('b', { text: r.name }), ` (${f.name}${r.private ? ', prywatne' : ''}). ${senseText(r)} [${st ? SENSE_WORD[st.status] : 'hipoteza'}]. Ostatni commit ${ago(r.last_ts)}. ${pl(r.commits, 'commit', 'commity', 'commitów')}, ${pl(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi')}, ${prOpenTxt(r)}. `,
        decl.length ? ['Dokumenty wskazują: ', decl.map((d, i) => [i ? ', ' : '', h('code', { text: d })]), '. '] : null,
        r.docs.length ? ['Wejście: ', r.docs.slice(0, 4).map((d, i) => [i ? ', ' : '', h('code', { text: d.p })]), '. '] : null,
        h('a', { href: r.url, target: '_blank', rel: 'noopener', text: r.url }));
    })))));
  return v;
}

/* ---------------- footer ---------------- */
function renderFoot() {
  const C = D.estate.coverage;
  $('#foot').replaceChildren(h('div', { class: 'wrap' },
    h('div', null, h('b', { text: 'Pokrycie i granice pomiaru' }), h('p', { style: { marginTop: '6px' }, text: `${C.collected}/${C.expected} repo w zrzucie z ${when(SNAP)}. ${C.method}` }), h('ul', null, C.limits.map(t => h('li', { text: t })))),
    h('div', null, h('b', { text: 'Prywatność' }), h('p', { style: { marginTop: '6px' }, text: 'Strona jest prywatna i zawiera nazwy prywatnych repo. Zanim ją komuś udostępnisz, pamiętaj, że zobaczy je każdy z linkiem.' }),
      h('p', { style: { marginTop: '10px' } }, 'Zbudował Claude 9 października 2026 na podstawie gita, API GitHuba i nocnej rozmowy z GPT. Wcześniejszy ',
        h('a', { href: 'https://claude.ai/artifact/Bc26EDMWXzWRP8QM6GyAD8', target: '_blank', rel: 'noopener' }, h('em', { text: 'Kataster' })), ' zostaje jako wersja 0, czyli datowane miejsce.'))));
}

/* ---------------- command palette ---------------- */
let palOpen = false;
function openPalette(q0 = '') {
  if (palOpen) return; palOpen = true;
  const scrim = h('div', { class: 'scrim', onclick: () => close() });
  const input = h('input', { id: 'pal-q', type: 'search', placeholder: 'Szukaj świata, gałęzi, prawa, lekcji… albo zadaj pytanie', 'aria-label': 'Szukaj', autocomplete: 'off' });
  const res = h('div', { class: 'res', role: 'listbox' });
  const pal = h('div', { class: 'palette', role: 'dialog', 'aria-label': 'Szukaj w Bibliotece' }, input, res);
  $('#layer').append(scrim, pal);
  let items = [], sel = 0;
  const close = () => { scrim.remove(); pal.remove(); palOpen = false; document.removeEventListener('keydown', onKey, true); };
  const run = () => {
    const q = input.value.trim().toLowerCase();
    const toks = q.split(/\s+/).filter(Boolean);
    const match = t => toks.every(k => t.toLowerCase().includes(k));
    const groups = [];
    const repos = D.repos.filter(r => !q || match(`${r.name} ${r.short} ${r.identity} ${FAM[r.family]?.name}`)).slice(0, 8).map(r => ({ g: 'Światy', t: r.short, s: senseText(r), tag: ago(r.last_ts), act: () => go(routeFor(r.name)) }));
    groups.push(...repos);
    if (q) {
      const brs = [];
      for (const r of D.repos) for (const b of r.branches) if (match(b.n)) { brs.push({ g: 'Gałęzie', t: b.n, s: `${r.short} · ${ago(b.ts)}`, tag: b.roles.includes('wskazana') ? 'wskazana' : '', code: true, act: () => openUrl(`${r.url}/tree/${encodeURIComponent(b.n)}`) }); if (brs.length > 8) break; }
      groups.push(...brs.slice(0, 8));
      groups.push(...D.laws.filter(l => match(l.title + ' ' + l.text)).slice(0, 4).map(l => ({ g: 'Prawa', t: l.title, s: l.text, act: () => { go('#wiedza'); setTimeout(() => { const el = document.getElementById('law-' + l.id); if (!el) return; el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1900); }, 120); } })));
      groups.push(...D.lessons.filter(l => match(`${l.id} ${l.title} ${l.positive} ${l.negative}`)).map(l => ({ g: 'Lekcje', t: `${l.id}: ${l.title}`, s: `${R[l.from]?.short} → ${l.to.map(t => R[t]?.short).join(', ')}`, act: () => go('#wiedza') })));
      groups.push(...D.cases.filter(c => match(`${c.id} ${c.title}`)).slice(0, 4).map(c => ({ g: 'Przypadki', t: `${c.id}: ${c.title}`, s: c.kind, act: () => openUrl(c.url) })));
    } else {
      groups.push({ g: 'Widoki', t: 'Panorama', s: 'mapa i rodziny', act: () => go('#panorama') }, { g: 'Widoki', t: 'Historia', s: 'kaskada commitów i prolog', act: () => go('#historia') },
        { g: 'Widoki', t: 'Wiedza', s: 'prawa, DNA, lekcje, przypadki, dziennik', act: () => go('#wiedza') }, { g: 'Widoki', t: 'Dla agentów', s: 'tekst i dane', act: () => go('#agenci') });
    }
    if (cap.sample && q.length > 2) groups.unshift({ g: 'Zapytaj', t: `Zapytaj Bibliotekę: „${input.value.trim()}”`, s: 'Odpowiada Claude na podstawie zrzutu', ask: true, act: () => openAsk(input.value.trim()) });
    items = groups; sel = 0;
    res.replaceChildren();
    let lastG = null;
    items.forEach((it, i) => {
      if (it.g !== lastG) { res.append(h('div', { class: 'grp', text: it.g })); lastG = it.g; }
      res.append(h('div', { class: 'it' + (i === sel ? ' sel' : '') + (it.ask ? ' ask-it' : ''), role: 'option', 'data-i': i, onclick: () => { close(); it.act(); } },
        h('div', { style: { minWidth: 0 } }, it.code ? h('code', { text: it.t }) : h('span', { text: it.t }), it.s ? h('div', { class: 's', text: it.s }) : null),
        h('span', { class: 'tag', text: it.tag || '' })));
    });
    if (!items.length) res.append(h('div', { class: 'grp', text: 'Nic nie pasuje. Spróbuj innego słowa.' }));
  };
  const hl = () => $$('.it', res).forEach(el => el.classList.toggle('sel', +el.dataset.i === sel));
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); hl(); $('.it.sel', res)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); hl(); $('.it.sel', res)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) { close(); it.act(); } }
  }
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', run);
  input.value = q0; run(); input.focus();
}
$('#openPalette')?.addEventListener('click', () => openPalette());
if (!JASK) document.addEventListener('keydown', e => {
  if (palOpen) return;
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openPalette(); }
});

/* ---------------- Ask (sample) ---------------- */
let askState = null;
function digest(focus) {
  const lines = [];
  lines.push(`Zrzut: ${D.estate.generated.replace('+00:00', '').replace('T', ' ')} UTC (teraz: ${new Date().toISOString().slice(0, 16)} UTC). Pokrycie ${D.estate.coverage.collected}/${D.estate.coverage.expected} repo.`);
  for (const f of D.families) {
    lines.push(`\n# Rodzina: ${f.name}. Pytanie rodziny (hipoteza): ${f.question}`);
    for (const n of f.repos) {
      const r = R[n], decl = r.branches.filter(b => b.roles.includes('wskazana')).map(b => b.n), st = senseOf('repo:' + n);
      lines.push(`- ${r.name} (krótko: ${r.short}${r.private ? ', prywatne' : ''}). Sens: ${senseText(r)} [${st ? SENSE_WORD[st.status] : 'hipoteza'}]. README: ${(r.readme?.lead || '').slice(0, 220)}. Ostatni commit: ${ago(r.last_ts)}. Commity ${r.commits}, gałęzie ${r.branches.length}, ${r.api === false ? 'PR i CI: nieznane (API nie widziało tego repo w tym zrzucie). ' : `PR otwarte ${r.prs.open} (szkice ${r.prs.draft}), scalone ${r.prs.merged}. CI łącznie ${r.ci.runs}. `}${decl.length ? 'Dokumenty wskazują gałęzie: ' + decl.join(', ') + '. ' : ''}${r.alias_groups.length ? 'Aliasy: ' + r.alias_groups.map(g => g.join(' = ')).slice(0, 4).join('; ') + '. ' : ''}${r.pages ? 'Pages: ' + r.pages + '. ' : ''}${r.stated.length ? 'Słowa Ownera: ' + r.stated.join(' ') : ''} Życie: ${r.life}.${r.state?.status ? ` Stan według repo (${r.state.path}, ${r.state.date || 'bez daty'}): ${r.state.status}${r.state.next?.length ? ' Dalej: ' + r.state.next.map(x => x.t).join(' / ') : ''}.` : ''}${(r.findings || []).length ? ' Ustalenia: ' + r.findings.filter(x => x.sev !== 'info').map(x => `[${SEV[x.sev]}${decision[x.id] ? ', decyzja: ' + DECISION[decision[x.id].status] : ''}] ${x.title.replace(/`/g, '')}`).join(' ') : ''}`);
    }
  }
  lines.push('\n# Lekcje między światami');
  for (const l of D.lessons) lines.push(`- ${l.id} ${l.title} (${l.from} → ${l.to.join(', ')}). Działało: ${l.positive} Nie działało: ${l.negative} Efekt: ${l.effect} Droga: ${l.route}`);
  lines.push('\n# Prawa Biblioteki');
  for (const l of D.laws) lines.push(`- ${l.title}: ${l.text}`);
  if (focus) {
    lines.push(`\n# Szczegóły: ${focus.name}`);
    lines.push('Gałęzie (nazwa | ostatni commit | przed/za domyślną | fakty | PR):');
    for (const b of focus.branches.slice(0, 80)) lines.push(`${b.n} | ${ago(b.ts)} | ${b.a ?? '-'}/${b.b ?? '-'} | ${b.roles.join(',')} | ${b.pr ? '#' + b.pr.n + ' ' + b.pr.st + ': ' + b.pr.t : ''}`);
    lines.push('Dokumenty wejścia: ' + focus.docs.map(d => `${d.p} (${d.t || ''}, zmieniony ${ago(d.ts)})`).join('; '));
    lines.push('Otwarte PR: ' + focus.prs.open_list.map(p => `#${p.n} ${p.t}`).join('; '));
  }
  return lines.join('\n');
}
function mdLite(text) {
  const frag = document.createDocumentFragment();
  const names = D.repos.flatMap(r => [[r.name, r.name], [r.short, r.name]]).sort((a, b) => b[0].length - a[0].length);
  const inline = (t, parent) => {
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g; let last = 0, m;
    const pushText = str => {
      let i = 0;
      while (i < str.length) {
        let hit = null;
        for (const [nm, full] of names) { const j = str.indexOf(nm, i); if (j >= 0 && (!hit || j < hit.j)) hit = { j, nm, full }; }
        if (!hit) { parent.append(str.slice(i)); break; }
        parent.append(str.slice(i, hit.j), h('a', { href: routeFor(hit.full), text: hit.nm }));
        i = hit.j + hit.nm.length;
      }
    };
    while ((m = re.exec(t))) { pushText(t.slice(last, m.index)); const tok = m[0]; parent.append(tok.startsWith('**') ? h('b', { text: tok.slice(2, -2) }) : h('code', { text: tok.slice(1, -1) })); last = m.index + tok.length; }
    pushText(t.slice(last));
  };
  let list = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*[-*•]\s+/.test(line)) { if (!list) { list = h('ul'); frag.append(list); } const li = h('li'); inline(line.replace(/^\s*[-*•]\s+/, ''), li); list.append(li); continue; }
    list = null;
    if (!line.trim()) continue;
    const p = h('p'); inline(line.replace(/^#+\s*/, ''), p); frag.append(p);
  }
  return frag;
}
function openAsk(q0 = '', focus = null) {
  if (!cap.sample) { toast('Pytania do Claude są tu niedostępne.'); return; }
  if (askState) { askState.ta.value = q0 || askState.ta.value; askState.focus = focus || askState.focus; askState.ta.focus(); if (q0) askState.ask(); return; }
  const scrim = h('div', { class: 'scrim', onclick: () => close() });
  const out = h('div', { class: 'out', 'aria-live': 'polite' });
  const ta = h('textarea', { id: 'ask-q', placeholder: 'Zapytaj o dowolny świat, gałąź albo lekcję…', 'aria-label': 'Pytanie' });
  const askBtn = h('button', { class: 'btn hot', type: 'submit', text: 'Zapytaj' });
  const stopBtn = h('button', { class: 'btn ghost', type: 'button', hidden: true, text: 'Zatrzymaj' });
  const SUG = ['Co mogę dziś sam wypróbować?', 'Gdzie naprawdę żyje praca w LLM Live NPC?', 'Które repo mają aliasy gałęzi i ile ich jest?', 'Opowiedz historię Combat Lab w pięciu zdaniach.', 'Które światy zasilają teraz Feniksa i czym?', 'Co łączy Companion Brain i ReflexBrain?'];
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Zapytaj Bibliotekę' },
    h('header', null, h('h2', { text: 'Zapytaj Bibliotekę' }), h('button', { class: 'btn ghost', type: 'button', onclick: () => close(), 'aria-label': 'Zamknij', text: 'Zamknij' })),
    h('div', { class: 'sugg' }, SUG.map(t => h('button', { type: 'button', onclick: () => { ta.value = t; ask(); }, text: t }))),
    out,
    h('form', { onsubmit: e => { e.preventDefault(); ask(); } }, ta,
      h('div', { class: 'row-btns' }, h('span', { class: 'cost', text: 'Odpowiada Claude na Twoim koncie (zużywa limit). Odpowiedź to hipoteza: sprawdzaj w źródłach.' }), h('div', { style: { display: 'flex', gap: '8px' } }, stopBtn, askBtn))));
  $('#layer').append(scrim, drawer);
  let ctl = null;
  const close = () => { ctl?.abort(); scrim.remove(); drawer.remove(); askState = null; document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  async function ask() {
    const q = ta.value.trim(); if (!q) return;
    const focusRepo = askState.focus;
    const qa = h('div', { class: 'qa' }, h('div', { class: 'q', text: q }));
    const a = h('div', { class: 'a' }, h('span', { class: 'thinking' }, h('i'), 'Myślę…'));
    qa.append(a); out.prepend(qa); ta.value = '';
    ctl?.abort(); ctl = new AbortController();
    askBtn.disabled = true; stopBtn.hidden = false;
    stopBtn.onclick = () => ctl.abort();
    const prompt = `Jesteś Biblioteką projektów Jozza (Jozzpoly): pomagasz mu zrozumieć jego repozytoria. Odpowiadaj po polsku, zwięźle i konkretnie, prostym językiem (Jozz jest grafikiem i twórcą gier, nie programistą z wykształcenia). Opieraj się wyłącznie na danych poniżej; jeśli czegoś w nich nie ma, powiedz to wprost. Zdania o sensie oznaczone [hipoteza] to propozycje Claude, nie fakty. To zrzut, a nie żywy stan, więc przy decyzjach poleć sprawdzenie żywego brancha, PR i CI. Nie wymyślaj linków ani liczb. Używaj dokładnych nazw repo (np. ${D.repos[0].name}). Krótkie akapity albo lista.\n\n=== DANE BIBLIOTEKI ===\n${digest(focusRepo)}\n=== KONIEC DANYCH ===\n\nPytanie Jozza: ${q}`;
    try {
      const { text, truncated } = await cap.sample(prompt, { signal: ctl.signal, onText: ({ text }) => { a.replaceChildren(mdLite(text)); } });
      a.replaceChildren(mdLite(text));
      qa.append(h('div', { class: 'note', text: truncated ? 'Odpowiedź ucięta. Zapytaj o mniejszy kawałek.' : 'Hipoteza Claude na podstawie zrzutu z ' + when(SNAP) + '.' }));
    } catch (e) {
      if (e?.text) a.replaceChildren(mdLite(e.text)); else if (e?.code !== 'cancelled') a.replaceChildren();
      const msg = { cancelled: 'Zatrzymane.', not_granted: 'Ta strona nie ma zgody na pytania do Claude.', sampling_disabled: 'Pytania do Claude są wyłączone na tym koncie.', rate_limited: 'Za dużo pytań naraz albo limit konta. Spróbuj za chwilę.', session_expired: 'Sesja wygasła. Zaloguj się ponownie.', refused: 'Claude nie odpowie na to pytanie. Zadaj je inaczej.', prompt_too_large: 'Za dużo danych naraz. Zapytaj o jeden świat.', empty_completion: 'Claude nie dał odpowiedzi. Zapytaj prościej albo o mniej naraz.', not_declared: 'Ta wersja strony nie ma już pytań do Claude.', capability_disabled: 'Pytania do Claude nie działają w tym widoku.', capability_removed: 'Pytania do Claude nie działają w tym widoku.' }[e?.code] || 'Przerwane po drodze. Spróbuj jeszcze raz.';
      qa.append(h('div', { class: 'note', text: msg }));
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e?.code)) { cap.sample = null; const b = $('#openAsk'); if (b) b.hidden = true; }
    } finally { askBtn.disabled = false; stopBtn.hidden = true; }
  }
  askState = { ta, ask, focus };
  ta.value = q0; ta.focus();
  if (q0) ask();
}
$('#openAsk')?.addEventListener('click', () => { const rt = parseRoute(); openAsk('', rt.v === 'repo' ? R[rt.name] : null); });

/* ---------------- live check (mcp: Claude Code Remote) ---------------- */
function liveLabel() {
  if (live.state === 'busy') return 'Sprawdzam…';
  if (live.state === 'done') { const n = Object.keys(live.pushed).length; return n ? `Na żywo: ${fmt(n)} repo ze zmianami od zrzutu` : 'Na żywo: bez zmian od zrzutu'; }
  return 'Sprawdź na żywo';
}
async function liveCheck(ev) {
  const btn = ev?.currentTarget || $('#liveBtn');
  if (live.state === 'done') { showLivePop(btn); return; }
  if (!cap.mcp || live.state === 'busy') return;
  live.state = 'busy'; if (btn) btn.textContent = liveLabel();
  try {
    const res = await cap.mcp.callTool('Claude Code Remote', 'list_repos', { limit: 200 });
    const list = res?.payload?.repos || [];
    const known = new Set(D.repos.map(r => r.name.toLowerCase()));
    live.pushed = {}; live.extra = [];
    for (const it of list) {
      const nm = (it.full_name || '').split('/')[1] || '';
      const r = D.repos.find(x => x.name.toLowerCase() === nm.toLowerCase());
      const pt = isoTs(it.pushed_at);
      if (!r) { if (!known.has(nm.toLowerCase())) live.extra.push(nm); continue; }
      if (pt && pt > SNAP + 60) live.pushed[r.name] = pt;
    }
    live.state = 'done'; live.checkedAt = Date.now() / 1000; live.total = list.length;
    render(); setTimeout(() => showLivePop($('#liveBtn')), 60);
  } catch (e) {
    live.state = 'idle';
    const msg = { server_not_connected: 'Dodaj konektor Claude Code Remote w ustawieniach claude.ai.', needs_reauth: 'Połącz ponownie Claude Code Remote w ustawieniach.', not_in_manifest: 'Ta strona nie ma zgody na ten konektor.', approval_required: 'Potrzebna Twoja zgoda na odczyt listy repo.', server_unavailable: 'Konektor chwilowo nie odpowiada. Spróbuj za moment.' }[e?.code] || 'Nie udało się sprawdzić stanu na żywo.';
    toast(msg); if (btn) btn.textContent = liveLabel();
  }
}
function showLivePop(btn) {
  if (!btn) return;
  const old = $('.pop'); if (old) { old.remove(); return; }
  const rows = Object.entries(live.pushed).sort((a, b) => b[1] - a[1]);
  const pop = h('div', { class: 'pop', role: 'dialog', 'aria-label': 'Stan na żywo' },
    h('h3', { text: 'Stan na żywo' }),
    h('p', { class: 'muted', style: { marginTop: '6px' }, text: `Lista ${pl(live.total || 0, 'repo', 'repo', 'repo')} z konektora sprawdzona ${ago(live.checkedAt)}. Porównanie z ostatnim pushem; zrzut jest z ${when(SNAP)}.` }),
    rows.length ? h('ul', null, rows.map(([n, t]) => h('li', null, h('a', { href: routeFor(n), text: R[n].short }), h('span', { class: 'faint', text: 'push ' + ago(t) })))) : h('p', { style: { marginTop: '8px' }, text: 'Od zrzutu nikt nie wypchnął zmian.' }),
    live.extra.length ? h('p', { style: { marginTop: '10px', color: 'var(--warn)' }, text: `Na koncie jest repo spoza zrzutu: ${live.extra.join(', ')}. Pokrycie zrzutu jest niepełne.` }) : h('p', { class: 'faint', style: { marginTop: '10px' }, text: 'Pokrycie zgodne: na koncie nie ma repo spoza zrzutu.' }));
  btn.parentElement.append(pop);
  setTimeout(() => document.addEventListener('click', function off(e) { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('click', off); } }), 0);
}

/* ---------------- boot ---------------- */
if (!JASK) { renderFoot(); render(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { redrawSigils(); });
new MutationObserver(() => redrawSigils()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
let rsT = 0, lastW = innerWidth;
if (!JASK) addEventListener('resize', () => {
  clearTimeout(rsT);
  rsT = setTimeout(() => {
    if (Math.abs(innerWidth - lastW) < 24) return; // ignore mobile toolbar height changes
    lastW = innerWidth;
    const rt = parseRoute();
    if ((rt.v === 'panorama' || rt.v === 'historia' || rt.v === 'repo') && !document.querySelector('.decide textarea')) { const y = scrollY; render(); requestAnimationFrame(() => scrollTo(0, y)); }
  }, 260);
});

/* Jaskinia reuses every panel of the Library through this one door */
if (JASK) window.__BIB = {
  D, R, FAM, LIFE, LIFE_ORDER, SEV, SNAP, DAY, FOUNDED, FENIKS, CH, HOOK, HOSTED, RUNS_LOCAL, cap, UI, decision, sense,
  h, s, $, $$, fmt, pl, plural, ago, when, day, heatOf, heatVar, heatWord, cssv, hashStr, rng, routeFor, DF, DS, DFS, TF, LDAY, DKEY, isoTs,
  sigil, drawSigil, redrawSigils, spark, squarify, parcelMap, parcelValue, fitParcelLabels, tip, untip, toast, copyText, openUrl,
  seismo, fitTicks, playStrip, findingsFeed, findingItem, changesStrip, katasterSection, lifeBadge, sevTag, heatChip, mixBar, stateNote, kDetail,
  repoView, forestPanel, forestChart, branchTable, rhythmPanel, clockPanel, clockChart, weekStrip, prPanel, lessonCard,
  ridgeline, historyView, knowledgeView, agentsView, playA, playIcon, openPlayer, rawRecord, senseText, noteLag, fact,
};

(async () => {
  const [db, user, sample, mcp, downloads, comments] = await Promise.all(['db', 'user', 'sample', 'mcp', 'downloads', 'comments'].map(use));
  Object.assign(cap, { db, user, sample, mcp, downloads, comments });
  try { cap.isOwner = user ? !!(await user.isOwner()) : !!db; } catch { cap.isOwner = !!db; }
  if (sample) { const b = $('#openAsk'); if (b) b.hidden = false; }
  if (db) {
    // one coalesced re-render per burst of snapshots; never while the Owner is typing a correction
    let rt = 0;
    const soft = () => { clearTimeout(rt); rt = setTimeout(() => { if (document.querySelector('.decide textarea')) return; const y = scrollY; render(); requestAnimationFrame(() => { scrollTo(0, y); restoreFocus(); }); }, 60); };
    db.collection('sens').onSnapshot(snap => {
      for (const k of Object.keys(sense)) delete sense[k];
      snap.docs.forEach(d => { const x = d.data(); if (x) sense[d.id] = x; });
      soft();
    }, () => {});
    db.collection('decyzje').onSnapshot(snap => {
      for (const k of Object.keys(decision)) delete decision[k];
      snap.docs.forEach(d => { const x = d.data(); if (x) decision[d.id] = x; });
      soft();
    }, () => {});
  }
  if (mcp) { const b = $('#liveBtn'); if (b) b.hidden = false; }
  if (sample || mcp || db) { /* views read cap.* when they render */ }
  if (!db && (sample || mcp || comments)) { const y = scrollY; render(); requestAnimationFrame(() => scrollTo(0, y)); }
})();
})();
