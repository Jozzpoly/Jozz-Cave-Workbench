/* ---------- statistics, computed from the snapshot ----------
   Day 0 is the snapshot day (UTC, like the commit day keys). Commits are Jozz's and the agents' together:
   the agents sign with his account, so they cannot be told apart. */
const STAT = (() => {
  const end = Math.floor(SNAP / DAY);
  const firsts = REPOS.filter(r => r.first_ts).map(r => Math.floor(r.first_ts / DAY));
  const accTs = D.estate.account && D.estate.account.created_ts;
  const accDay = accTs ? Math.floor(accTs / DAY) : null;
  const SPAN = end - Math.min(...firsts, accDay ?? Infinity) + 1;
  const per = REPOS.map(r => {
    const v = new Array(SPAN).fill(0);
    for (const [k, n] of Object.entries(r.days || {})) {
      const di = end - Math.floor(Date.parse(k + 'T12:00:00Z') / 1000 / DAY);
      if (di >= 0 && di < SPAN) v[di] += n;
    }
    const tips = r.branches.map(b => end - Math.floor(b.ts / DAY)).filter(di => di >= 0);
    const pre = {};
    for (const b of r.branches) { const k = b.n.includes('/') ? b.n.split('/')[0] : ''; pre[k] = (pre[k] || 0) + 1; }
    return { r, v, tips, pre };
  });
  return { end, SPAN, acc: accDay == null ? null : end - accDay, per, byName: Object.fromEntries(per.map(p => [p.r.name, p])) };
})();
/* "od początku" = where the real work starts; the whole history since the account was made is its own range (Owner, 14.10) */
const RANGES = [['7', '7 dni'], ['28', '28 dni'], ['90', '90 dni'], ['365', 'rok'], ['all', 'od początku'], ...(STAT.acc != null ? [['konto', 'od założenia konta', 'od konta']] : [])]; // [key, label, short label for the period buttons]
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const WDN = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'ndz'];
const diDate = di => new Date(((STAT.end - di) * DAY + DAY / 2) * 1000);
function diText(di, withYear = true) {
  const d = diDate(di);
  if (prefs.lang === 'en') return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' });
  return `${WDN[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}${withYear ? ' ' + d.getUTCFullYear() : ''}`;
}
const quant = (arr, q) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y), i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const pct = (a, b) => (b == null || !b) ? null : Math.round(((a - b) / b) * 100);
const sum = a => a.reduce((x, y) => x + y, 0);
function bin(v, k) { if (v.length <= k) return v.slice(); const out = new Array(k).fill(0); v.forEach((x, i) => { out[Math.min(k - 1, Math.floor((i / v.length) * k))] += x; }); return out; }
function linePath(v, w = 100, hh = 28) {
  const n = v.length, mx = Math.max(...v);
  if (!mx || n < 2) return `M0 ${hh - 1}L${w} ${hh - 1}`;
  return v.map((x, i) => `${i ? 'L' : 'M'}${(i / (n - 1) * w).toFixed(1)} ${(hh - 1 - (x / mx) * (hh - 4)).toFixed(1)}`).join('');
}

function statFilter(L) { const f = L.stats || (L.stats = {}); if (!RANGES.some(r => r[0] === f.range)) f.range = '28'; if (!Array.isArray(f.fams)) f.fams = []; return f; }
/* Where the real work starts: the oldest commit after which the work never went quiet for more than two months,
   unless what came before such a silence is a real part of the work (a tenth of all commits or more). A few early
   experiments followed by a year of nothing must not turn "od początku" into a long empty line (Owner, 14.10).
   Returns day indexes (0 = the snapshot day): start, the very first commit, and the thin prelude left out. */
function workStart(full) {
  const act = [];
  for (let di = full.length - 1; di >= 0; di--) if (full[di] > 0) act.push(di);
  if (!act.length) return { start: 0, first: 0, before: 0, preEnd: 0 };
  const total = sum(full);
  let start = act[0], before = 0, preEnd = 0, acc = 0;
  for (let i = 1; i < act.length; i++) {
    acc += full[act[i - 1]];
    if (act[i - 1] - act[i] > 60 && acc < total * 0.1) { start = act[i]; before = acc; preEnd = act[i - 1]; }
  }
  return { start, first: act[0], before, preEnd };
}
function statModel(f) {
  const fams = f.fams.filter(id => FAM[id]);
  const P = STAT.per.filter(p => !fams.length || fams.includes(p.r.family));
  const full = new Array(STAT.SPAN).fill(0);
  for (const p of P) p.v.forEach((x, i) => { full[i] += x; });
  const ws = workStart(full);
  const acct = f.range === 'konto' && STAT.acc != null, all = f.range === 'all' || acct; // all: the whole story, nothing to compare with
  const N = acct ? STAT.acc + 1 : all ? Math.max(7, ws.start + 1) : Math.min(STAT.SPAN, +f.range || 28);
  const cur = full.slice(0, N), prev = all ? null : full.slice(N, 2 * N);
  const nz = full.filter(x => x > 0);
  let best = 0, bestDi = -1;
  cur.forEach((x, di) => { if (x > best) { best = x; bestDi = di; } });
  return { f, N, all, acct, ws, fams, P, full, cur, prev, best, bestDi, p25: Math.round(quant(nz, 0.25)), p75: Math.round(quant(nz, 0.75)) };
}
const famLabel = fams => fams.length ? fams.map(id => FAM[id]?.name).join(' + ') : t('wszystkie rodziny');
const chartSpanNote = m => m.acct ? t('od założenia konta, {0}', diText(m.N - 1)) : m.all ? t('od {0}', diText(m.N - 1)) : t('{0} dni do zrzutu', m.N);
const rangeLabel = r => (RANGES.find(x => x[0] === r) || RANGES[1])[1];

function stHead(title, note) { return h('div', { class: 'st-h' }, h('h3', { text: title }), note ? h('span', { class: 'st-note', text: note }) : null); }
function deltaEl(p, sub) {
  if (p == null) return h('span', { class: 'st-delta eq', text: sub || t('bez porównania') });
  return h('span', { class: 'st-delta ' + (p > 0 ? 'up' : p < 0 ? 'dn' : 'eq'), text: p === 0 ? t('bez zmian wobec poprzednich') : t('{0} {1}% wobec poprzednich', p > 0 ? '▲' : '▼', Math.abs(p)) });
}
function sparkSvg(v, cls = '') {
  return s('svg', { class: 'st-spark ' + cls, viewBox: '0 0 100 28', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 'a', d: linePath(v) + 'L100 28L0 28Z' }), s('path', { class: 'l', d: linePath(v) }));
}

/* KPI tiles: the period against the period just before it */
function statKpis(m) {
  const { N, P, cur, prev, all } = m;
  const chron = cur.slice().reverse();
  const act = cur.filter(x => x > 0).length, prevAct = prev ? prev.filter(x => x > 0).length : null;
  const touched = P.filter(p => p.v.slice(0, N).some(x => x > 0)).length;
  const prevT = prev ? P.filter(p => p.v.slice(N, 2 * N).some(x => x > 0)).length : null;
  let br = 0, prevB = 0;
  for (const p of P) for (const di of p.tips) { if (di < N) br++; else if (di < 2 * N) prevB++; }
  const k = (label, value, d, sub, spark) => h('div', { class: 'st-kpi' }, h('span', { class: 'k', text: label }), h('b', null, value), d, sparkSvg(spark), h('small', { text: sub }));
  return h('div', { class: 'st-kpis' },
    k(t('Commity'), fmt(sum(cur)), deltaEl(all ? null : pct(sum(cur), sum(prev))), t('Ty i agenci razem, wszystkie gałęzie'), bin(chron, 40)),
    k(t('Aktywne dni'), [String(act), h('small', { class: 'of', text: ' ' + t('z {0}', N) })], deltaEl(all ? null : pct(act, prevAct)), t('dni, w których był choć jeden commit'), bin(chron.map(x => x > 0 ? 1 : 0), 40)),
    k(t('Ruszane projekty'), `${touched}`, deltaEl(all ? null : pct(touched, prevT)), t('z {0} w wybranych rodzinach', P.length), bin(chron, 40)),
    k(t('Gałęzie z ruchem'), `${br}`, deltaEl(all ? null : pct(br, prevB)), t('ostatni commit gałęzi w tym okresie'), bin(chron, 40)),
    k(t('Najlepszy dzień'), m.best ? fmt(m.best) : '—', h('span', { class: 'st-delta eq', text: m.best ? diText(m.bestDi) : t('cisza') }), m.best ? t('typowy aktywny dzień: {0}–{1}', m.p25, m.p75) : t('w tym okresie nic'), bin(chron, 40)));
}

/* commits day by day; colour = how long before the snapshot the day was, record marked, typical day as a band.
   Bars narrower than about 3 px cannot be read: then a bar is a week, and beyond that a month. */
function statChart(m, W, H, select) {
  const { N, cur, P } = m;
  W = Math.max(200, Math.floor(W)); H = Math.max(120, Math.floor(H));
  let k = 1;
  if (W / N < 3) k = 7;
  if (W / Math.ceil(N / 7) < 3) k = 30;
  const nb = Math.ceil(N / k);
  const bins = []; // chronological; bin covers day indexes [lo, hi] (di 0 = the snapshot day)
  for (let r0 = nb - 1; r0 >= 0; r0--) {
    const lo = r0 * k, hi = Math.min(N - 1, lo + k - 1);
    let v = 0;
    for (let di = lo; di <= hi; di++) v += cur[di] || 0;
    bins.push({ lo, hi, v });
  }
  let p25 = m.p25, p75 = m.p75;
  if (k > 1) { // the typical bin, from the whole history binned the same way
    const vals = [];
    for (let lo = 0; lo < m.full.length; lo += k) { let v = 0; for (let di = lo; di < lo + k && di < m.full.length; di++) v += m.full[di]; if (v) vals.push(v); }
    p25 = Math.round(quant(vals, 0.25)); p75 = Math.round(quant(vals, 0.75));
  }
  const padB = 22, padT = 24, ch = H - padB - padT;
  const mx = Math.max(1, ...bins.map(b => b.v)), bw = W / nb;
  const y = v => padT + ch - (v / mx) * ch;
  const unit = k === 1 ? t('dzień') : k === 7 ? t('tydzień') : t('miesiąc');
  const svg = s('svg', { class: 'st-chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': t('Commity, jeden słupek to {0}. Najwięcej {1}.', unit, fmt(Math.max(...bins.map(b => b.v)))) });
  const mon = i => (prefs.lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : MON)[i];
  // "od początku" leaves out a thin prelude: say so at the left edge, where it would have been
  const brk = m.all && !m.acct && m.ws.before > 0;
  let bandLabel = null;
  if (p75 > 0) {
    const y1 = y(Math.min(p75, mx)), y2 = y(Math.min(p25, mx));
    svg.append(s('rect', { class: 'band', x: 0, y: y1, width: W, height: Math.max(1, y2 - y1) }));
    bandLabel = s('text', { class: 'band-t', x: 6, y: brk && y1 - 5 < 28 ? Math.min(y2 - 3, y1 + 13) : Math.max(11, y1 - 5), text: k === 1 ? t('typowy aktywny dzień: {0}–{1} commitów', p25, p75) : t('typowy aktywny {0}: {1}–{2} commitów', unit, p25, p75) });
  }
  svg.append(s('line', { class: 'base', x1: 0, x2: W, y1: padT + ch + 0.5, y2: padT + ch + 0.5 }));
  const g = s('g');
  let best = -1;
  bins.forEach((b, i) => { if (best < 0 || b.v > bins[best].v) best = i; });
  bins.forEach((b, i) => {
    if (!b.v) return;
    const lvl = heatOf((STAT.end - b.lo) * DAY + DAY / 2);
    const bh = Math.max(1.5, (b.v / mx) * ch);
    g.append(s('rect', { class: 'bar' + (i === best ? ' rec' : ''), x: i * bw + Math.min(1, bw * 0.15), y: padT + ch - bh, width: Math.max(0.8, bw - Math.min(2, bw * 0.3)), height: bh,
      fill: lvl >= 1 ? `var(${heatVar(lvl)})` : 'var(--cold)' })); // older than a month: neutral blue, still plainly visible
  });
  svg.append(g);
  if (bandLabel) svg.append(bandLabel); // above the bars, with a halo so it stays readable
  if (best >= 0 && bins[best].v) {
    const cx = best * bw + bw / 2, ty = y(bins[best].v) - 3;
    svg.append(s('path', { class: 'rec-mark', d: `M${cx - 4} ${ty - 6} L${cx + 4} ${ty - 6} L${cx} ${ty} Z` }),
      s('text', { class: 'rec-t', x: clamp(cx, 44, W - 44), y: Math.max(10, ty - 10), 'text-anchor': 'middle', text: t('rekord {0}', fmt(bins[best].v)) }));
  }
  if (brk) {
    const a = diDate(m.ws.first), b = diDate(m.ws.preEnd), ya = a.getUTCFullYear(), yb = b.getUTCFullYear();
    const when = a.getUTCMonth() === b.getUTCMonth() && ya === yb ? `${mon(a.getUTCMonth())} ${ya}` : `${mon(a.getUTCMonth())}${ya !== yb ? ' ' + ya : ''}–${mon(b.getUTCMonth())} ${yb}`;
    svg.append(s('text', { class: 'brk-t', x: 6, y: 13 }, s('tspan', { class: 'brk-a', text: '‹ ' }),
      t('wcześniej {0}, {1} · pokazuje je „od konta”', tn(m.ws.before, 'commit', 'commity', 'commitów'), when)));
  }
  // x labels: days for a week, weeks for a month; beyond that month starts, thinned to quarters or years as they crowd
  const ax = s('g', { class: 'ax' });
  const pxMonth = W / (N / 30.44), stride = pxMonth >= 42 ? 1 : pxMonth >= 24 ? 3 : pxMonth >= 6 ? 12 : 24;
  let lastEnd = -99;
  bins.forEach((b, i) => {
    const d = diDate(b.hi), d2 = diDate(b.lo), M = d2.getUTCMonth(), Y = d2.getUTCFullYear();
    let lab = null;
    if (k === 1 && N <= 7) lab = `${d.getUTCDate()} ${mon(d.getUTCMonth())}`;
    else if (k === 1 && N <= 35) { if (i % 7 === 0) lab = `${d.getUTCDate()} ${mon(d.getUTCMonth())}`; }
    else if ((k === 1 ? d.getUTCDate() === 1 : d.getUTCDate() === 1 || d.getUTCMonth() !== M) && M % Math.min(stride, 12) === 0 && (stride < 24 || Y % 2 === 0))
      lab = stride >= 12 ? String(Y) : mon(M) + (M === 0 ? ' ' + Y : '');
    const x = i * bw, w = lab ? lab.length * 6.2 + 2 : 0;
    if (lab && x >= lastEnd + 10 && x + w <= W) { lastEnd = x + w; ax.append(s('text', { x: x + 1, y: H - 6, text: lab }), s('line', { x1: x + 0.5, x2: x + 0.5, y1: padT + ch + 1, y2: padT + ch + 5 })); }
  });
  svg.append(ax);
  const guide = s('line', { class: 'guide', x1: 0, x2: 0, y1: padT, y2: padT + ch, visibility: 'hidden' });
  svg.append(guide);
  const at = e => { const bb = svg.getBoundingClientRect(); return clamp(Math.floor((e.clientX - bb.left) / bb.width * nb), 0, nb - 1); };
  const topIn = b => { let top = null, tv = 0; for (const p of P) { let v = 0; for (let di = b.lo; di <= b.hi; di++) v += p.v[di] || 0; if (v > tv) { tv = v; top = p.r; } } return { top, tv }; };
  const when0 = b => k === 1 ? diText(b.lo) : `${diText(b.hi, false)} – ${diText(b.lo)}`;
  svg.addEventListener('pointermove', e => {
    const i = at(e), b = bins[i];
    guide.setAttribute('x1', i * bw + bw / 2); guide.setAttribute('x2', i * bw + bw / 2); guide.setAttribute('visibility', 'visible');
    const { top, tv } = topIn(b);
    B.tip(e, [h('div', { class: 'tt', text: tn(b.v, 'commit', 'commity', 'commitów') }), h('div', { class: 'ts', text: when0(b) }),
      h('div', { class: 'tm', text: top ? t('najwięcej: {0} ({1})', top.short, tv) + (select ? t(' · kliknij, żeby zaznaczyć') : '') : t('cisza') })]);
  });
  svg.addEventListener('pointerleave', () => { guide.setAttribute('visibility', 'hidden'); B.untip(); });
  if (select) svg.addEventListener('click', e => { const { top } = topIn(bins[at(e)]); if (top) select(top.name); });
  return svg;
}

function statRanking(m, select, selName) {
  const { N, P, cur, all } = m;
  const total = sum(cur) || 1;
  const rows = P.map(p => ({ p, v: sum(p.v.slice(0, N)), pv: all ? null : sum(p.v.slice(N, 2 * N)) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  if (!rows.length) return h('p', { class: 'st-empty', text: t('W tym okresie i tych rodzinach nie było commitów.') });
  const tb = h('tbody');
  rows.forEach((x, i) => {
    const r = x.p.r, d = all ? null : pct(x.v, x.pv);
    tb.append(h('tr', { class: r.name === selName ? 'sel' : null, 'data-repo': r.name, tabindex: 0,
      onclick: () => select?.(r.name), onkeydown: e => { if (e.key === 'Enter') select?.(r.name); } },
      h('td', { class: 'rk', text: i + 1 }),
      h('td', null, h('span', { class: 'st-nm' }, sigil(r, 22), h('b', { text: r.short }), h('span', { class: 'st-fam', text: FAM[r.family]?.name || '' }))),
      h('td', { class: 'n', text: fmt(x.v) }),
      h('td', { class: 'sh' }, h('span', { class: 'st-share' }, h('i', { style: { width: (100 * x.v / total).toFixed(1) + '%' } })), h('small', { text: Math.round(100 * x.v / total) + '%' })),
      h('td', { class: 'n ' + (d == null ? (all ? 'eq' : 'up') : d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'), text: d == null ? (all ? '—' : t('nowy')) : `${d > 0 ? '▲' : d < 0 ? '▼' : ''} ${Math.abs(d)}%` }),
      h('td', { class: 'sp' }, sparkSvg(bin(x.p.v.slice(0, N).reverse(), 40), 'thin'))));
  });
  return h('div', { class: 'st-tw' }, h('table', { class: 'st-tbl' },
    h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: t('projekt') }), h('th', { class: 'n', text: t('commity') }), h('th', { text: t('udział') }), h('th', { class: 'n', text: all ? t('zmiana') : t('wobec poprz. {0} dni', N) }), h('th', { text: t('przebieg') }))), tb));
}

function statHours(m) {
  const H = new Array(24).fill(0), Wd = new Array(7).fill(0);
  for (const p of m.P) { (p.r.hours || []).forEach((v, i) => { H[i] += v; }); (p.r.weekdays || []).forEach((v, i) => { Wd[i] += v; }); }
  const hm = Math.max(1, ...H), wm = Math.max(1, ...Wd), tot = sum(H) || 1;
  const night = [22, 23, 0, 1, 2, 3, 4, 5].reduce((a, i) => a + H[i], 0);
  const bars = (vals, mx, lab, cls) => h('div', { class: 'st-mb ' + cls }, vals.map((v, i) => h('div', { class: 'mb' + (v === mx ? ' peak' : '') + (cls === 'hrs' && (i >= 22 || i < 6) ? ' night' : ''), title: `${lab(i)}: ${tn(v, 'commit', 'commity', 'commitów')}` },
    h('i', { style: { height: Math.max(v ? 2 : 0, 100 * v / mx).toFixed(1) + '%' } }), h('em', { text: cls === 'hrs' ? (i % 3 === 0 ? String(i) : '') : WDN[i] }))));
  return h('div', { class: 'st-hours' },
    h('p', { class: 'st-cap', text: t('Godzina zapisana w commicie (prawie zawsze polski czas). Ciemniejsze tło: noc, 22:00–6:00.') }),
    bars(H, hm, i => `${i}:00–${(i + 1) % 24}:00`, 'hrs'),
    bars(Wd, wm, i => WDN[i], 'wds'),
    h('p', { class: 'st-note2' }, t('Najwięcej o '), h('b', { text: H.indexOf(hm) + ':00' }), t(', w '), h('b', { text: t(WDN[Wd.indexOf(wm)]) }), t('. Nocą powstaje {0}% commitów. Dni tygodnia liczone w UTC. Od początku, bez względu na wybrany okres.', Math.round(100 * night / tot))));
}
function statKinds(m) {
  const pre = {};
  for (const p of m.P) for (const [k, n] of Object.entries(p.pre)) pre[k] = (pre[k] || 0) + n;
  const arr = Object.entries(pre).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const km = Math.max(1, ...arr.map(x => x[1]));
  return h('div', { class: 'st-kinds' },
    h('ul', null, arr.map(([k, v]) => h('li', null, h('code', { text: k ? k + '/' : t('(bez przedrostka)') }), h('span', { class: 'kb' }, h('i', { style: { width: (100 * v / km).toFixed(1) + '%' } })), h('em', { text: v })))),
    h('p', { class: 'st-note2' }, t('Przedrostek nazwy gałęzi mówi, czym była praca. Tylko '), h('code', { text: 'codex/' }), t(' mówi, który agent pracował.')));
}
function statYear(m, W) {
  const { full } = m;
  const yearVals = full.slice(0, 371).filter(x => x > 0);
  const q1 = quant(yearVals, 0.25), q2 = quant(yearVals, 0.5), q3 = quant(yearVals, 0.8);
  const wd0 = (diDate(0).getUTCDay() + 6) % 7; // weekday of the snapshot day, Monday = 0
  const weeks = 53, start = weeks * 7 - 1 - (6 - wd0); // di of the Monday 52 weeks back
  const cell = clamp(Math.floor((Math.max(260, W) - 34) / weeks) - 2, 6, 15), g = 2, step = cell + g;
  const Wv = 30 + weeks * step, Hv = 18 + 7 * step;
  const svg = s('svg', { class: 'st-year', viewBox: `0 0 ${Wv} ${Hv}`, width: Wv, height: Hv, role: 'img', 'aria-label': t('Rok w commitach: {0} aktywnych dni w ostatnich 53 tygodniach.', yearVals.length) });
  [0, 2, 4].forEach(i => svg.append(s('text', { class: 'wd', x: 0, y: 18 + i * step + cell - 1, text: WDN[i] })));
  let lastM = -1;
  for (let wk = 0; wk < weeks; wk++) {
    for (let d = 0; d < 7; d++) {
      const di = start - (wk * 7 + d);
      if (di < 0) continue;
      const v = di < STAT.SPAN ? full[di] : 0;
      const lvl = !v ? 0 : v <= q1 ? 1 : v <= q2 ? 2 : v <= q3 ? 3 : 4;
      const x = 30 + wk * step, y = 18 + d * step;
      svg.append(s('rect', { class: 'c l' + lvl, x, y, width: cell, height: cell, rx: 2 }, s('title', { text: `${diText(di)}: ${tn(v, 'commit', 'commity', 'commitów')}` })));
      if (d === 0) { const dt = diDate(di); if (dt.getUTCMonth() !== lastM && dt.getUTCDate() <= 7) { lastM = dt.getUTCMonth(); svg.append(s('text', { class: 'mo', x, y: 11, text: MON[lastM] })); } }
    }
  }
  return h('div', { class: 'st-yw' }, svg, h('div', { class: 'st-legend' }, t('mniej'), [0, 1, 2, 3, 4].map(l => h('i', { class: 'l' + l })), t('więcej')));
}
function statFacts(m) {
  const { full, P } = m;
  let run = 0, bestRun = 0, runEnd = 0;
  for (let di = STAT.SPAN - 1; di >= 0; di--) { if (full[di] > 0) { run++; if (run > bestRun) { bestRun = run; runEnd = di; } } else run = 0; }
  let allBest = 0, allBestDi = 0;
  full.forEach((x, di) => { if (x > allBest) { allBest = x; allBestDi = di; } });
  const mostBr = P.slice().sort((a, b) => b.r.branches.length - a.r.branches.length)[0];
  const seen = P.filter(p => p.r.api !== false), mostPr = seen.slice().sort((a, b) => b.r.prs.open - a.r.prs.open)[0]; // a repo the API did not see has no count
  const ws = m.ws, activeSince = full.slice(0, ws.start + 1).filter(x => x > 0).length;
  const T = D.estate.totals;
  const f = (k, v, sub) => h('li', null, h('span', { text: k }), h('b', { text: v }), h('small', { text: sub }));
  return h('ul', { class: 'st-facts' },
    f(t('rekord dnia'), allBest ? tn(allBest, 'commit', 'commity', 'commitów') : '—', allBest ? diText(allBestDi) : ''),
    f(t('najdłuższa seria'), tn(bestRun, 'dzień', 'dni', 'dni') + t(' z rzędu'), bestRun ? t('do {0}', diText(runEnd)) : ''),
    f(t('najwięcej gałęzi'), mostBr ? mostBr.r.short : '—', mostBr ? tn(mostBr.r.branches.length, 'gałąź', 'gałęzie', 'gałęzi') : ''),
    f(t('najwięcej otwartych PR'), mostPr && mostPr.r.prs.open ? mostPr.r.short : seen.length ? '—' : '?', mostPr && mostPr.r.prs.open ? tn(mostPr.r.prs.open, 'otwarty', 'otwarte', 'otwartych') : seen.length ? t('brak') : t('nie wiem: brak danych z API')),
    f(t('aktywne dni od początku'), t('{0} z {1}', activeSince, ws.start + 1),
      ws.before ? t('od {0}; pierwszy commit {1}', diText(ws.start), diText(ws.first)) : t('pierwszy commit {0}', diText(ws.first))),
    f(t('całość na GitHubie'), tn(T.commits, 'commit', 'commity', 'commitów'), t('{0} repo · {1} gałęzi · {2} przebiegów CI · {3} PR', T.repos, T.branches, fmt(T.ci_runs), T.prs)));
}
