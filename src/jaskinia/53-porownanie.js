/* Jaskinia experimental A/B observatory.
   Read-only: existing LIVE telemetry, no message to labs, no new storage or runtime.
   Each selected instrument remains fully autonomous. */
const CMP_RANGES = [[10, '10 s'], [60, '1 min'], [300, '5 min']];
const CMP_COLORS = ['--link', '--warn'];

function cmpLabel(e) {
  const said = liveName(e);
  return e.title && e.title !== said ? e.title + ' · ' + said : said;
}
function cmpMetricOptions(e) { return e ? [...e.sigs.keys()].sort((a, b) => a.localeCompare(b, 'pl')) : []; }
function cmpSeries(e, metric, cutoff) {
  const s = e && e.sigs.get(metric);
  if (!s || !Array.isArray(s.t) || !Array.isArray(s.v)) return [];
  const out = [];
  for (let i = 0; i < Math.min(s.t.length, s.v.length); i++)
    if (s.t[i] >= cutoff && Number.isFinite(s.t[i]) && Number.isFinite(s.v[i]))
      out.push([s.t[i], s.v[i]]);
  return out;
}
function cmpCsvCell(value) {
  let s = String(value == null ? '' : value);
  // CSV is meant for spreadsheets; never allow lab-provided labels to become formulas.
  if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function cmpExport(a, b, ma, mb, span) {
  const now = Date.now(), cutoff = now - span * 1000;
  const rows = [['side', 'captured_utc', 'instrument_id', 'instrument_name', 'origin_url', 'signal', 'sample_utc', 'value']];
  for (const [side, e, metric] of [['A', a, ma], ['B', b, mb]]) {
    for (const [time, val] of cmpSeries(e, metric, cutoff))
      rows.push([side, new Date(now).toISOString(), e.id, liveName(e), e.url, metric, new Date(time).toISOString(), val]);
  }
  // A finite negative sample must remain numeric (-3.2), not be escaped as spreadsheet text.
  const csv = '\uFEFF' + rows.map(row => row.map((value, i) => i === 7 && typeof value === 'number' && Number.isFinite(value) ? String(value) : cmpCsvCell(value)).join(',')).join('\r\n') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'jaskinia-porownanie-' + new Date(now).toISOString().replace(/[:.]/g, '-') + '.csv';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return rows.length - 1;
}
function cmpDraw(canvas, a, b, ma, mb, span, el) {
  const width = Math.max(280, Math.floor(canvas.parentElement.clientWidth - 4 || 280));
  const height = 270;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);
  const now = Date.now(), cutoff = now - span * 1000;
  const lines = [cmpSeries(a, ma, cutoff), cmpSeries(b, mb, cutoff)];
  const all = lines.flat().map(p => p[1]);
  const styles = getComputedStyle(el);
  const color = k => styles.getPropertyValue(k).trim() || '#888';
  const ink = color('--ink-3'), rule = color('--rule-2');
  const left = 70, right = width - 16, top = 18, bottom = height - 38;
  g.font = '11px system-ui, sans-serif';
  if (!all.length || right <= left) {
    g.fillStyle = ink; g.fillText('Brak próbek dla wybranych sygnałów.', 12, 50); return;
  }
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max((hi - lo) * .12, Math.abs(hi) * .015, .001);
  lo -= pad; hi += pad;
  const x = t0 => left + (t0 - cutoff) / (span * 1000) * (right - left);
  const y = v => bottom - (v - lo) / (hi - lo) * (bottom - top);
  g.lineWidth = 1; g.strokeStyle = rule; g.fillStyle = ink;
  for (let n = 0; n <= 4; n++) {
    const yy = top + (bottom - top) * n / 4;
    g.beginPath(); g.moveTo(left, yy); g.lineTo(right, yy); g.stroke();
    g.textAlign = 'right'; g.fillText(fmtNum(hi - (hi - lo) * n / 4), left - 8, yy + 4);
  }
  g.textAlign = 'center';
  for (let n = 0; n <= 4; n++) {
    const seconds = span * (1 - n / 4);
    const xx = left + (right - left) * n / 4;
    g.beginPath(); g.moveTo(xx, top); g.lineTo(xx, bottom); g.stroke();
    g.fillText(n === 4 ? 'teraz' : '-' + Math.round(seconds) + ' s', xx, bottom + 19);
  }
  lines.forEach((points, i) => {
    if (!points.length) return;
    g.strokeStyle = color(CMP_COLORS[i]);
    g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath();
    for (let j = 0; j < points.length; j++) {
      const xx = x(points[j][0]), yy = y(points[j][1]);
      if (!j) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    if (points.length === 1) { const [t0, v] = points[0]; g.arc(x(t0), y(v), 3, 0, Math.PI * 2); }
    g.stroke();
  });
}

/* Deliberate one-click on-ramp, not a new runtime: both demos are independent v5 instruments. */
function cmpLaunchDemos(c) {
  const A = openWinOfType('przyrzad', { fresh: true, st: { url: DEMO_URL, title: 'Piłki A' }, w: .42, h: .46 });
  const B = openWinOfType('przyrzad', { fresh: true, st: { url: DEMO_URL, title: 'Piłki B' }, w: .42, h: .46 });
  // Place the two new lab windows next to each other, and the floating comparison below them.
  // Other windows and their run state are untouched. Nothing is linked or controlled.
  c.commit(t('porównanie: dwa pokazy'), () => {
    if (!phone) {
      const fA = L.floats.find(x => x.id === A), fB = L.floats.find(x => x.id === B);
      const fC = L.floats.find(x => x.id === c.id);
      if (fA) Object.assign(fA, { x: .025, y: .05, w: .43, h: .45 });
      if (fB) Object.assign(fB, { x: .545, y: .05, w: .43, h: .45 });
      if (fC) Object.assign(fC, { x: .14, y: .53, w: .72, h: .43 });
    }
    c.win.st.cmpA = A; c.win.st.cmpB = B;
    c.win.st.cmpMa = 'energia'; c.win.st.cmpMb = 'energia';
  });
  focusWin(c.id);
  if (phone) phoneSwitch(c.id);
}

function renderCompare(box, c) {
  const st = c.win.st, sources = liveHere();
  const selectId = (field, label, allowed) => {
    const sel = h('select', { class: 'jk-in cmp-select', 'aria-label': t(label) });
    sel.append(h('option', { value: '', text: t('Wybierz przyrząd') }));
    for (const e of allowed) sel.append(h('option', { value: e.id, text: cmpLabel(e) + ' · ' + e.id }));
    sel.value = st[field] || '';
    sel.addEventListener('change', () => c.commit(t('porównanie: wybór'), () => { st[field] = sel.value; st[field === 'cmpA' ? 'cmpMa' : 'cmpMb'] = ''; }));
    return sel;
  };
  const ids = new Set(sources.map(e => e.id));
  // Initial choice is convenient, but never silently rebind a missing saved instrument.
  if (st.cmpA === undefined && sources[0]) st.cmpA = sources[0].id;
  if (st.cmpB === undefined && sources[1]) st.cmpB = sources[1].id;
  if (sources.length && (st.cmpA || st.cmpB)) c.save();
  const a = ids.has(st.cmpA) ? LIVE.get(st.cmpA) : null;
  const b = ids.has(st.cmpB) ? LIVE.get(st.cmpB) : null;
  const same = !!a && a === b;
  const availableA = cmpMetricOptions(a), availableB = cmpMetricOptions(b);
  if (st.cmpMa === undefined || st.cmpMa === '') {
    const shared = availableA.find(x => availableB.includes(x));
    if (shared) st.cmpMa = shared; else if (availableA.length) st.cmpMa = availableA[0];
  }
  if (st.cmpMb === undefined || st.cmpMb === '') {
    if (availableB.includes(st.cmpMa)) st.cmpMb = st.cmpMa;
    else if (availableB.length) st.cmpMb = availableB[0];
  }
  const metric = (field, label, available) => {
    const sel = h('select', { class: 'jk-in cmp-select', 'aria-label': t(label) });
    sel.append(h('option', { value: '', text: t('Brak sygnału') }));
    for (const k of available) sel.append(h('option', { value: k, text: k }));
    sel.value = available.includes(st[field]) ? st[field] : '';
    sel.addEventListener('change', () => c.commit(t('porównanie: sygnał'), () => { st[field] = sel.value; }));
    return sel;
  };
  const span = CMP_RANGES.some(x => x[0] === st.cmpSpan) ? st.cmpSpan : 60;
  const controls = h('div', { class: 'cmp-controls' },
    h('label', null, h('strong', { text: t('Instrument A') }), selectId('cmpA', 'Instrument A', sources)),
    h('label', null, h('strong', { text: t('Instrument B') }), selectId('cmpB', 'Instrument B', sources)),
    h('label', null, h('strong', { text: t('Sygnał A') }), metric('cmpMa', 'Sygnał A', availableA)),
    h('label', null, h('strong', { text: t('Sygnał B') }), metric('cmpMb', 'Sygnał B', availableB)));
  const status = h('p', { class: 'cmp-status', role: 'status' });
  const caption = h('p', { class: 'cmp-caption' });
  const canvas = h('canvas', { class: 'cmp-canvas', role: 'img', 'aria-label': t('Dwa sygnały na wspólnej osi czasu') });
  const range = h('div', { class: 'jk-seg cmp-ranges', role: 'group', 'aria-label': t('Zakres czasu') },
    CMP_RANGES.map(([s0, label]) => h('button', { type: 'button', class: s0 === span ? 'on' : '', 'aria-pressed': String(s0 === span),
      onclick: () => c.commit(t('porównanie: zakres'), () => { st.cmpSpan = s0; }) }, label)));
  const exportBtn = h('button', { class: 'btn mini', type: 'button', text: t('Zapisz próbki CSV'), onclick: () => {
    const n = cmpExport(a, b, st.cmpMa, st.cmpMb, span);
    jtoast(t('Zapisano {0} próbek.', n));
  } });
  exportBtn.disabled = !a || !b || !availableA.includes(st.cmpMa) || !availableB.includes(st.cmpMb) || same;
  box.append(h('div', { class: 'cmp-root' },
    h('h2', { text: t('Porównanie na żywo') }),
    h('p', { class: 'jk-sub', text: t('Dwa niezależne laboratoria. Jedna oś czasu. Bez przejmowania ich sterowania ani restartowania.') }),
    phone ? h('p', { class: 'cmp-caveat', role: 'note', text: t('Na telefonie ukryte laboratoria mogą pauzować. Wykres pokazuje tylko otrzymane próbki; nie oznacza to dwóch nieprzerwanie działających światów.') }) : null,
    sources.length < 2 ? h('button', { class: 'btn hot cmp-start', type: 'button', onclick: () => cmpLaunchDemos(c) }, t('Uruchom dwa pokazy Piłki i ułóż próbę')) : null,
    controls,
    h('div', { class: 'cmp-toolbar' }, range, exportBtn),
    status,
    h('div', { class: 'cmp-plot' }, canvas),
    caption,
    h('p', { class: 'cmp-caveat', text: t('Wartości surowe. Równa nazwa sygnału nie gwarantuje równej jednostki ani znaczenia. CSV zapisuje próbki z ich rzeczywistymi czasami, nie rekonstruuje stanu świata.') })));
  let alive = true, frame = 0;
  let signature = '';
  const sourcesKey = () => liveHere().map(e => e.id + ':' + liveName(e) + ':' + [...e.sigs.keys()].sort().join('|')).join(';');
  const tick = () => {
    if (!alive) return;
    const key = sourcesKey();
    if (key !== signature) {
      c.rerender(); return;
    }
    const both = !!a && !!b && !same && availableA.includes(st.cmpMa) && availableB.includes(st.cmpMb);
    const now = Date.now();
    const last = e => { const s0 = e && e.sigs.get(e === a ? st.cmpMa : st.cmpMb); return s0 && s0.t.length ? s0.t[s0.t.length - 1] : 0; };
    const dataA = both ? cmpSeries(a, st.cmpMa, now - span * 1000) : [];
    const dataB = both ? cmpSeries(b, st.cmpMb, now - span * 1000) : [];
    const freshA = dataA.length && now - dataA[dataA.length - 1][0] < 2500;
    const freshB = dataB.length && now - dataB[dataB.length - 1][0] < 2500;
    status.textContent = !sources.length ? t('Uruchom dwa okna „Przyrząd”, np. dwa razy pokaz Piłki.')
      : !a || !b ? t('Wybierz dwa dostępne przyrządy w bieżącym układzie.')
      : same ? t('Wybierz dwa różne przyrządy.')
      : !both ? t('Czekam na liczby z obu przyrządów.')
      : dataA.length && dataB.length
        ? (freshA && freshB && a.vis === true && b.vis === true ? t('Dwa widoczne strumienie · {0} / {1} próbek w oknie', dataA.length, dataB.length)
          : t('Ślad pomiarów · przyrząd ukryty lub bez aktualnych sygnałów; ruch świata nie jest potwierdzony.'))
        : t('Nie ma jeszcze wspólnych obserwacji w wybranym zakresie czasu.');
    const newestA = last(a), newestB = last(b);
    const latest = (e, m, ts, data) => e && m ? (e === a ? 'A — ' : 'B — ') + cmpLabel(e) + ' / ' + m + ': ' +
      (data.length ? fmtNum(data[data.length - 1][1]) : '—') +
      (ts && now - ts > 2500 ? ' (' + t('próbki nie są świeże') + ')' : '') : '—';
    caption.textContent = latest(a, st.cmpMa, newestA, dataA) + '     ·     ' + latest(b, st.cmpMb, newestB, dataB);
    if (both) cmpDraw(canvas, a, b, st.cmpMa, st.cmpMb, span, box);
    else { const g = canvas.getContext('2d'); if (g) g.clearRect(0, 0, canvas.width, canvas.height); }
    if (st.cmpMa && st.cmpMb && st.cmpMa !== st.cmpMb) {
      caption.textContent += ' · ' + t('UWAGA: różne sygnały, bez wspólnej skali fizycznej.');
    }
  };
  const ask = () => { if (alive && !frame) frame = requestAnimationFrame(() => { frame = 0; tick(); }); };
  signature = sourcesKey();
  liveSubs.add(ask);
  const timer = setInterval(ask, 250);
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(ask) : null;
  resize?.observe(canvas.parentElement);
  c.onDispose(() => { alive = false; liveSubs.delete(ask); clearInterval(timer); resize?.disconnect(); if (frame) cancelAnimationFrame(frame); });
  ask();
}
TYPES.porownanie = {
  key: 'porownanie', group: 'live', name: 'Porównanie', glyph: 't_sygnaly',
  desc: 'Dwa uruchomione przyrządy i ich sygnały na wspólnej osi czasu, z eksportem próbek.',
  render: renderCompare, noZoom: true
};
