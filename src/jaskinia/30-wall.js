/* ---------- the wall of projects, second life ----------
   A big canvas. Every project is a card at a place Jozz chose; frames and notes are his own structure.
   Places are world coordinates and never move by themselves: no relaxing, no reshuffling, ever.
   The view (camera) pans and zooms over the world; a card shows more when it is bigger on screen
   (semantic zoom: its size on the wall and the zoom of the view both count, nobody gets pushed away).
   Separate gestures, never glued together:
     drag a card                  move it (on touch: hold a moment first; a quick drag pans)
     drag empty space             pan the view          wheel / pinch / + − 0     zoom, fit
     corner of the selected item  resize it (the corner sits outside the card, so small cards can still be moved)
     Shift + drag empty           pick several cards    double-click empty        a new note
   Arranging happens only on request (Ułóż…), and every change is one step of undo. */
const WALL_DRV = [['a28', 'aktywność 28 dni'], ['a90', 'aktywność 90 dni'], ['c', 'wszystkie commity'], ['br', 'liczba gałęzi'], ['eq', 'równo']];
const WALLS = new Map();     // window id -> live wall (for the header buttons)
const WALL_PICK = new Map(); // window id -> picked item keys ('c:repo', 'n:id', 'f:id'), kept across redraws
const WZMIN = 0.12, WZMAX = 4, WGAP = 18;
const TONES = ['zolty', 'mieta', 'roz', 'niebo', 'papier'];
const TONE_NAMES = { zolty: 'żółta', mieta: 'miętowa', roz: 'różowa', niebo: 'niebieska', papier: 'papierowa' };

function wallMeasure(r, drv) {
  const p = STAT.byName[r.name];
  if (!p) return 0;
  if (drv === 'a28') return sum(p.v.slice(0, 28));
  if (drv === 'a90') return sum(p.v.slice(0, 90));
  if (drv === 'c') return r.commits || 0;
  if (drv === 'br') return r.branches.length;
  return 1;
}
function wallVmax(drv) { return Math.max(1, ...REPOS.map(r => wallMeasure(r, drv))); }
/* the size a card gets from the measure; a size set by hand wins */
function wallSizeOf(st, r, vmax) {
  const c0 = st.cards[r.name];
  if (c0 && c0.w && c0.h) return { w: c0.w, h: c0.h, hand: true };
  if (st.size === 'eq') return { w: 176, h: 116 };
  const m = wallMeasure(r, st.size);
  if (!m) return { w: 118, h: 98 };
  const w = Math.round(150 + 210 * Math.sqrt(m / vmax));
  return { w, h: Math.round(w * 0.62) };
}
/* level of detail from the size ON SCREEN */
const wallLod = (sw, sh) => sw < 36 || sh < 26 ? 'D' : sw < 150 || sh < 92 ? 'S' : sw < 240 || sh < 150 ? 'M' : sw < 340 || sh < 222 ? 'L' : 'XL';
const LOD_NAME = { D: 'kropka', S: 'znaczek', M: 'karta', L: 'karta ze stanem', XL: 'pełna karta' };

/* ---- arranging (only when asked) ---- */
function shelfPack(items, maxW, gap) {
  let x = 0, y = 0, rowH = 0, W = 0;
  for (const it of items) {
    if (x > 0 && x + it.w > maxW) { y += rowH + gap; x = 0; rowH = 0; }
    it.px = x; it.py = y; x += it.w + gap; rowH = Math.max(rowH, it.h); W = Math.max(W, x - gap);
  }
  return { w: W, h: y + rowH };
}
/* rows of items whose width is chosen so the whole fills a view of the given shape as well as it can */
function bestShelf(items, gap, aspect) {
  const maxW = Math.max(...items.map(b => b.w)), total = items.reduce((a, b) => a + b.w + gap, 0) - gap;
  let best = null;
  for (let i = 0; i <= 32; i++) {
    const w = maxW + (total - maxW) * i / 32, box = shelfPack(items, w, gap);
    const score = Math.min(aspect / box.w, 1 / box.h); // how big it would be on screen
    if (!best || score > best.score * 1.0001) best = { w, score };
  }
  return { ...shelfPack(items, best.w, gap), score: best.score };
}
function arrangeGroups(groups, sizeOf, { aspect = 1.7, frames = true, sort = true } = {}) {
  const PAD = frames ? 22 : 0, LAB = frames ? 36 : 0, FG = frames ? 54 : WGAP;
  aspect = clamp(aspect || 1.6, 0.4, 2.8);
  // try a few shapes for the family blocks; keep the arrangement that shows everything largest
  let best = null;
  for (const inner of frames ? [0.7, 1, 1.35, 1.8, 2.4] : [aspect]) {
    const blocks = groups.filter(g => g.repos.length).map(g => {
      const its = g.repos.map(n => ({ n, ...sizeOf(n) }));
      if (sort) its.sort((a, b) => b.h - a.h || b.w - a.w);
      const area = its.reduce((a, i) => a + (i.w + WGAP) * (i.h + WGAP), 0);
      const box = shelfPack(its, Math.max(Math.max(...its.map(i => i.w)), Math.sqrt(area * inner)), WGAP);
      return { g, its, w: box.w + PAD * 2, h: box.h + PAD * 2 + LAB, pos: its.map(i => [i.px, i.py]) };
    });
    if (sort) blocks.sort((a, b) => b.h - a.h);
    const res = frames || blocks.length > 1 ? bestShelf(blocks, FG, aspect) : { score: 1 };
    if (!best || res.score > best.score) best = { blocks, score: res.score, pos: blocks.map(b => [b.px || 0, b.py || 0]) };
  }
  const blocks = best.blocks;
  blocks.forEach((b, i) => { [b.px, b.py] = best.pos[i]; b.its.forEach((it, j) => { [it.px, it.py] = b.pos[j]; }); });
  const cards = {}, out = [];
  for (const b of blocks) {
    if (frames) out.push({ id: 'f' + uid(), x: b.px, y: b.py, w: b.w, h: b.h, label: b.g.label, tone: b.g.tone || '', auto: b.g.kind });
    for (const it of b.its) cards[it.n] = { x: b.px + PAD + it.px + it.w / 2, y: b.py + PAD + LAB + it.py + it.h / 2 };
  }
  return { cards, frames: out };
}
function wallArrange(st, kind, aspect = 1.6) {
  const vmax = wallVmax(st.size), sizeOf = n => wallSizeOf(st, R[n], vmax);
  if (kind === 'zycie') {
    const groups = LIFE_ORDER.map(l => ({ key: l, kind: 'zycie', label: LIFE[l]?.label || l, repos: REPOS.filter(r => r.life === l).sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0)).map(r => r.name) }));
    return arrangeGroups(groups, sizeOf, { sort: false, aspect });
  }
  if (kind === 'swiezosc') {
    return arrangeGroups([{ key: 'all', label: '', repos: FRESH.map(r => r.name) }], sizeOf, { frames: false, sort: false, aspect });
  }
  const groups = D.families.map(f => ({ key: f.id, kind: 'rodziny', label: f.name, repos: f.repos.filter(n => R[n]).sort((a, b) => (R[b].last_ts || 0) - (R[a].last_ts || 0)) }));
  return arrangeGroups(groups, sizeOf, { aspect });
}
/* put an arrangement into the wall: cards move, hand sizes stay, frames made by an earlier arrangement are replaced, Jozz's own stay */
function wallApplyArrangement(st, lay) {
  for (const [n, p] of Object.entries(lay.cards)) { const c0 = st.cards[n] || (st.cards[n] = {}); c0.x = p.x; c0.y = p.y; delete c0.nowe; }
  st.frames = arr(st.frames).filter(f => !f.auto).concat(lay.frames);
}
function wallBBox(st, vmax) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y, w, hh) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + hh); };
  for (const r of REPOS) { const c0 = st.cards[r.name]; if (c0 && Number.isFinite(c0.x)) { const sz = wallSizeOf(st, r, vmax); add(c0.x - sz.w / 2, c0.y - sz.h / 2, sz.w, sz.h); } }
  for (const n of arr(st.notes)) add(n.x, n.y, n.w, n.h);
  if (st.showFrames !== false) for (const f of arr(st.frames)) add(f.x, f.y, f.w, f.h);
  return x0 === Infinity ? { x: 0, y: 0, w: 800, h: 500 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/* the first wall, the first version's wall, and projects that appeared since: placed once, then they are Jozz's.
   The very first arrangement waits until the window's shape is known (a phone gets a tall wall, a desk a wide one). */
const wallFresh = st => st.v !== 2 || !st.cards || typeof st.cards !== 'object';
function wallPrepare(st, aspect = 1.6) {
  let changed = false;
  if (wallFresh(st)) {
    const old = { pins: obj(st.pins), hand: obj(st.hand), drv: st.drv, links: st.links };
    for (const k of Object.keys(st)) delete st[k];
    Object.assign(st, { v: 2, size: WALL_DRV.some(d => d[0] === old.drv) ? old.drv : 'a28', links: !!old.links, showFrames: true, mini: true, cards: {}, notes: [], frames: [] });
    for (const [n, hs] of Object.entries(old.hand)) if (R[n] && hs && hs.w > 20 && hs.h > 20) st.cards[n] = { w: Math.round(hs.w), h: Math.round(hs.h) };
    const lay = wallArrange(st, 'rodziny', aspect);
    wallApplyArrangement(st, lay);
    const pins = Object.entries(old.pins).filter(([n, p]) => R[n] && p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pins.length) { const bb = wallBBox(st, wallVmax(st.size)); for (const [n, p] of pins) Object.assign(st.cards[n], { x: bb.x + p.x * bb.w, y: bb.y + p.y * bb.h }); }
    changed = true;
  }
  if (!WALL_DRV.some(d => d[0] === st.size)) st.size = 'a28';
  st.notes = arr(st.notes).filter(n => n && n.id && [n.x, n.y, n.w, n.h].every(Number.isFinite));
  st.frames = arr(st.frames).filter(f => f && f.id && [f.x, f.y, f.w, f.h].every(Number.isFinite));
  for (const n of st.notes) if (!store.notes[n.id]) store.notes[n.id] = { text: '', upd: Date.now(), gone: true };
  const missing = REPOS.filter(r => !st.cards[r.name] || !Number.isFinite(st.cards[r.name].x) || !Number.isFinite(st.cards[r.name].y));
  if (missing.length) {
    const vmax = wallVmax(st.size), bb = wallBBox(st, vmax);
    let y = bb.y, x = bb.x + bb.w + 80, colW = 0;
    for (const r of missing) {
      const sz = wallSizeOf(st, r, vmax);
      if (y + sz.h > bb.y + Math.max(bb.h, 400)) { y = bb.y; x += colW + WGAP; colW = 0; }
      st.cards[r.name] = { ...(st.cards[r.name] || {}), x: x + sz.w / 2, y: y + sz.h / 2, nowe: true };
      y += sz.h + WGAP; colW = Math.max(colW, sz.w);
    }
    changed = true;
  }
  return changed;
}
/* push overlapping cards apart, only as much as needed (asked for, never automatic) */
function wallSeparate(st) {
  const vmax = wallVmax(st.size);
  const its = REPOS.map(r => { const c0 = st.cards[r.name], sz = wallSizeOf(st, r, vmax); return { n: r.name, x: c0.x, y: c0.y, w: sz.w, h: sz.h }; });
  let moved = 0;
  for (let k = 0; k < 400; k++) {
    let any = false;
    for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) {
      const a = its[i], b = its[j];
      const ox = (a.w + b.w) / 2 + 12 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 + 12 - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      any = true;
      if (ox / (a.w + b.w) < oy / (a.h + b.h)) { const s0 = a.x < b.x ? -1 : a.x > b.x ? 1 : (i % 2 ? 1 : -1); a.x += s0 * ox / 2; b.x -= s0 * ox / 2; }
      else { const s0 = a.y < b.y ? -1 : a.y > b.y ? 1 : 1; a.y += s0 * oy / 2; b.y -= s0 * oy / 2; }
    }
    if (!any) break;
  }
  for (const it of its) { const c0 = st.cards[it.n]; if (Math.abs(c0.x - it.x) > 0.5 || Math.abs(c0.y - it.y) > 0.5) { c0.x = Math.round(it.x); c0.y = Math.round(it.y); moved++; } }
  return moved;
}

/* ---- one card, drawn for its size on screen ---- */
function wallFindings(r) { return (r.findings || []).filter(f => (f.sev === 'high' || f.sev === 'mid') && !B.decision[f.id]); }
/* the red bubble: findings waiting for a decision; it sits on the card's corner, outside the card, so it never hides the name */
function wallAtt(r, lod) {
  const fs = wallFindings(r);
  return fs.length && lod !== 'D' ? h('span', { class: 'wc-att' + (fs.some(f => f.sev === 'high') ? ' high' : ''), title: t('{0} do decyzji', tn(fs.length, 'ustalenie', 'ustalenia', 'ustaleń')), text: fs.length }) : null;
}
function wallCardInner(r, lod, sw, sh) {
  const att = null;
  if (lod === 'D') return [h('i', { class: 'wc-dot' })];
  if (lod === 'S') {
    const two = sh >= 40 && r.short.length * 6.6 > sw - 14, nameH = two ? 28 : 15;
    const sg = Math.round(Math.min(sw - 24, sh - nameH - 20, 60));
    return [sg >= 16 ? h('div', { class: 'wc-badge' }, sigil(r, sg)) : null, h('div', { class: 'wc-sname' + (two ? ' two' : ''), lang: 'en', text: r.short }), att];
  }
  const p = STAT.byName[r.name], v28 = p ? p.v.slice(0, 28).reverse() : [];
  const big = lod === 'L' || lod === 'XL', wide = sw / sh > 2.1;
  const head = h('div', { class: 'wc-head' }, sigil(r, lod === 'XL' ? 46 : 32),
    h('div', { class: 'wc-tt' }, h('b', { class: 'wc-name', text: r.short }), h('span', { class: 'wc-meta' }, B.lifeBadge(r.life), ' ', r.last_ts ? ago(r.last_ts) : t('bez commitów'))));
  const foot = h('div', { class: 'wc-foot' });
  if (big || wide) foot.append(h('span', { class: 'wc-nums', text: `${fmt(r.commits)} · ${tn(r.branches.length, 'gałąź', 'gałęzie', 'gałęzi')} · ${r.prs.open} PR` }));
  if ((big || wide) && r.pages && r.life !== 'zakończone') foot.append(B.playA(r, { class: 'wc-play' }, B.playIcon(), t('Zagraj')));
  if (wide) return [h('div', { class: 'wc-in wide' }, head, sparkSvg(v28, 'wc-sp'), foot.firstChild ? foot : null), att];
  // what fits is decided by the card's real height: the bottom row first, then activity, the state quote, the next step
  const GAPV = 7, LINE = 16;
  let room = sh - 22 - (lod === 'XL' ? 46 : 34);
  if (foot.firstChild) room -= 28 + GAPV;
  const sparkH = lod === 'XL' ? 44 : 24;
  const showSpark = room >= sparkH + GAPV;
  if (showSpark) room -= sparkH + GAPV;
  const quote = big ? (r.state?.status || r.readme?.lead || '') : '';
  const lines = quote ? Math.min(lod === 'XL' ? 4 : 2, Math.floor((room - GAPV) / LINE)) : 0;
  if (lines > 0) room -= lines * LINE + GAPV;
  const next = lod === 'XL' && r.state?.next?.length && room >= LINE + GAPV ? r.state.next[0].t : '';
  return [h('div', { class: 'wc-in' }, head,
    lines > 0 ? h('p', { class: 'wc-st' + (r.state?.status ? '' : ' rd'), style: { webkitLineClamp: String(lines) }, text: quote }) : null,
    showSpark ? (lod === 'XL' ? B.spark(r, 28, 280, 44) : sparkSvg(v28, 'wc-sp')) : null,
    next ? h('p', { class: 'wc-next', text: '→ ' + next }) : null,
    foot.firstChild ? foot : null), att];
}

function renderWall(box, c) {
  const st = c.win.st;
  let pending = wallFresh(st);
  if (!pending && wallPrepare(st)) c.save();
  const picked = WALL_PICK.get(c.id) || new Set();
  WALL_PICK.set(c.id, picked);
  const el = h('div', { class: 'wall2', tabindex: 0, role: 'application', 'aria-roledescription': t('ściana projektów'),
    'aria-label': t('Ściana projektów. Przeciągnij kartę, żeby ją przenieść; puste miejsce przesuwa widok; kółko przybliża; 0 pokazuje wszystko.') });
  const grid = h('div', { class: 'w2-grid', 'aria-hidden': 'true' });
  const lFrames = h('div', { class: 'w2-layer' });
  const links = s('svg', { class: 'w2-links', 'aria-hidden': 'true' });
  const lItems = h('div', { class: 'w2-layer items' });
  const selBoxEl = h('div', { class: 'w2-sel', hidden: true }, h('span', { class: 'w2-handle', 'data-handle': '1', title: t('Ciągnij, żeby zmienić rozmiar') }));
  const band = h('div', { class: 'w2-band', hidden: true });
  const readout = h('div', { class: 'w2-read', hidden: true });
  const mini = h('canvas', { class: 'w2-mini', 'data-mini': '1', 'aria-hidden': 'true' });
  const zv = h('button', { class: 'w2-zv', type: 'button', title: t('Pokaż wszystko (0)') });
  const zbar = h('div', { class: 'w2-zbar' },
    ibtn('minus', t('Oddal (−)'), () => zoomAt(cam.z / 1.25)), zv, ibtn('plus', t('Przybliż (+)'), () => zoomAt(cam.z * 1.25)),
    ibtn('fit', t('Pokaż wszystko (0)'), () => fit(true)));
  zv.addEventListener('click', () => fit(true));
  el.append(grid, lFrames, links, lItems, selBoxEl, band, readout, mini, zbar);
  box.append(el);

  let W = 0, H = 0;
  let cam = (c.view() && c.view().cam) || null;
  let g = null;              // the gesture in progress
  const live = new Map();   // item key -> {x, y, w, h} (world, top-left) while the hand holds it
  const els = new Map();    // item key -> {el, k}
  let vmK = null, vmV = 1;
  const vm = () => { if (vmK !== st.size) { vmK = st.size; vmV = wallVmax(st.size); } return vmV; }; // follows the measure Jozz picks

  /* ---- world ↔ screen ---- */
  const sx = wx => (wx - cam.cx) * cam.z + W / 2, sy = wy => (wy - cam.cy) * cam.z + H / 2;
  const wx = px => (px - W / 2) / cam.z + cam.cx, wy = py => (py - H / 2) / cam.z + cam.cy;
  /* the whole wall in view; on a tall narrow screen (a phone held upright) the width fills and the wall scrolls down */
  function fitCam(all) {
    const bb = wallBBox(st, vm()), tall = W / H < 0.8, m = tall ? 14 : 40;
    const zw = (W - m * 2) / Math.max(1, bb.w), zh = (H - m * 2) / Math.max(1, bb.h);
    if (tall && !all && zh < zw * 0.9) { const z = clamp(zw, WZMIN, 1.6); return { cx: bb.x + bb.w / 2, cy: bb.y + (H / 2 - m) / z, z }; }
    const z = clamp(Math.min(zw, zh), WZMIN, 1.6);
    return { cx: bb.x + bb.w / 2, cy: bb.y + bb.h / 2, z };
  }
  let camT = 0;
  const saveCam = () => { clearTimeout(camT); camT = setTimeout(() => c.setView({ ...(c.view() || {}), cam: { cx: Math.round(cam.cx), cy: Math.round(cam.cy), z: Math.round(cam.z * 1000) / 1000 } }), 250); };
  let lastFit = 0;
  function fit(animate, all) {
    // a second press right after the first shows the whole wall even on a tall screen
    if (!all && Date.now() - lastFit < 1500) all = true;
    lastFit = Date.now();
    const to = fitCam(all);
    if (!animate || prefs.motion === 'less') { cam = to; paint(); saveCam(); return; }
    const from = { ...cam }, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 260), e = 1 - (1 - k) ** 3; cam = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, z: from.z + (to.z - from.z) * e }; paint(); if (k < 1) requestAnimationFrame(step); else saveCam(); };
    requestAnimationFrame(step);
  }
  function zoomAt(z, px = W / 2, py = H / 2) {
    z = clamp(z, WZMIN, WZMAX);
    const ax = wx(px), ay = wy(py);
    cam.z = z; cam.cx = ax - (px - W / 2) / z; cam.cy = ay - (py - H / 2) / z;
    paint(); saveCam();
  }

  /* ---- what is on the wall right now (world rects, top-left) ---- */
  const placed = r => st.cards[r.name] && Number.isFinite(st.cards[r.name].x);
  function cardRect(r) {
    const k = 'c:' + r.name, lv = live.get(k);
    const sz = lv && lv.w ? { w: lv.w, h: lv.h, hand: true } : wallSizeOf(st, r, vm());
    const c0 = st.cards[r.name];
    const cx = lv ? lv.x + sz.w / 2 : c0.x, cy = lv ? lv.y + sz.h / 2 : c0.y;
    return { k, kind: 'c', r, x: cx - sz.w / 2, y: cy - sz.h / 2, w: sz.w, h: sz.h, hand: !!sz.hand, nowe: !!c0.nowe };
  }
  const noteRect = n => { const lv = live.get('n:' + n.id); return { k: 'n:' + n.id, kind: 'n', n, x: lv ? lv.x : n.x, y: lv ? lv.y : n.y, w: lv && lv.w ? lv.w : n.w, h: lv && lv.h ? lv.h : n.h }; };
  const frameRect = f => { const lv = live.get('f:' + f.id); return { k: 'f:' + f.id, kind: 'f', f, x: lv ? lv.x : f.x, y: lv ? lv.y : f.y, w: lv && lv.w ? lv.w : f.w, h: lv && lv.h ? lv.h : f.h }; };
  function itemByKey(k) {
    if (k.startsWith('c:')) { const r = R[k.slice(2)]; return r && st.cards[r.name] ? cardRect(r) : null; }
    if (k.startsWith('n:')) { const n = st.notes.find(x => x.id === k.slice(2)); return n ? noteRect(n) : null; }
    const f = st.frames.find(x => x.id === k.slice(2)); return f ? frameRect(f) : null;
  }

  /* ---- painting ---- */
  let painting = 0;
  const paint = () => { if (!painting) painting = requestAnimationFrame(paintNow); };
  function paintNow() {
    painting = 0;
    if (!W || !H || !cam) return;
    const z = cam.z, gs = 24 * z;
    grid.style.backgroundSize = gs >= 6 ? `${gs}px ${gs}px` : '0 0';
    grid.style.backgroundPosition = `${(W / 2 - cam.cx * z) % gs}px ${(H / 2 - cam.cy * z) % gs}px`;
    const seen = new Set();
    // frames (below everything)
    for (const f of st.showFrames === false ? [] : st.frames) {
      const it = frameRect(f), k = it.k;
      seen.add(k);
      let e = els.get(k);
      const sw = it.w * z, sh = it.h * z;
      const far = z < 0.3; // so far away that the cards are dots: the frame says its name across itself
      const key = `${f.label}|${f.tone}|${far ? 'far' : 'near'}`;
      if (!e || e.k !== key) {
        const ne = h('div', { class: 'wf tone-' + (f.tone || 'none') + (far ? ' far' : ''), 'data-k': k },
          h('div', { class: 'wf-lab', 'data-grip': '1', title: t('Ciągnij, żeby przenieść ramkę razem z zawartością. Dwuklik: zmień nazwę.') }, h('span', { text: f.label || t('Ramka') })),
          far && f.label ? h('div', { class: 'wf-big', 'aria-hidden': 'true', text: f.label }) : null);
        if (e) e.el.replaceWith(ne); else lFrames.append(ne);
        e = { el: ne, k: key }; els.set(k, e);
      }
      place(e.el, it, z);
      e.el.style.setProperty('--fz', String(clamp(z * 1.4, 0.45, 1.12)));
      e.el.style.setProperty('--fbig', Math.round(clamp(Math.min(sw / Math.max(4, (f.label || '').length) * 1.3, sh * 0.16), 11, 30)) + 'px');
      e.el.classList.toggle('picked', picked.has(k));
    }
    // cards and notes
    for (const r of REPOS) {
      if (!st.cards[r.name] || !Number.isFinite(st.cards[r.name].x)) continue;
      const it = cardRect(r), sw = it.w * z, sh = it.h * z;
      seen.add(it.k);
      if (sx(it.x + it.w) < -60 || sx(it.x) > W + 60 || sy(it.y + it.h) < -60 || sy(it.y) > H + 60) { const e0 = els.get(it.k); if (e0) e0.el.hidden = true; continue; }
      const lod = wallLod(sw, sh);
      // rebuild when the representation changes (detail level, or a size bucket that changes what fits)
      const key = `${lod}|${lod === 'S' ? Math.round(sw / 12) : Math.round(sh / 16)}|${Math.round(sw / sh * 4)}|${it.hand ? 'h' : ''}${it.nowe ? 'n' : ''}`;
      let e = els.get(it.k);
      if (!e || e.k !== key) {
        const lvl = r.life === 'zakończone' ? -2 : heatOf(r.last_ts);
        const ne = h('div', { class: `wc lod-${lod}`, 'data-k': it.k, 'data-repo': r.name, tabindex: lod === 'D' ? -1 : 0, role: 'button',
          'aria-label': `${r.short}, ${LIFE[r.life]?.label || ''}, ${t('ostatni commit')} ${ago(r.last_ts)}`,
          style: { '--life': lvl === -2 ? 'var(--ash)' : lvl === -1 ? 'var(--ash)' : lvl === 0 ? 'var(--h0)' : `var(${heatVar(lvl)})` } },
          h('div', { class: 'wc-box' + (lvl === -1 ? ' empty' : '') }, ...wallCardInner(r, lod, sw, sh)), wallAtt(r, lod),
          it.nowe && lod !== 'D' ? h('span', { class: 'wc-new', text: t('nowe') }) : null);
        if (lod === 'D') ne.title = r.short;
        if (it.hand) ne.classList.add('hand');
        if (e) { ne.hidden = false; e.el.replaceWith(ne); } else lItems.append(ne);
        e = { el: ne, k: key }; els.set(it.k, e);
      }
      e.el.hidden = false;
      place(e.el, it, z);
      e.el.classList.toggle('picked', picked.has(it.k));
      e.el.classList.toggle('live', live.has(it.k));
    }
    for (const n of st.notes) {
      const it = noteRect(n), k = it.k, sw = it.w * z, sh = it.h * z;
      seen.add(k);
      const small = sw < 84 || sh < 56;
      const key = `${small ? 's' : 'l'}|${n.tone}`;
      let e = els.get(k);
      if (!e || e.k !== key) {
        const ne = h('div', { class: 'wn tone-' + (n.tone || 'zolty') + (small ? ' small' : ''), 'data-k': k },
          h('div', { class: 'wn-grip', 'data-grip': '1', title: t('Ciągnij, żeby przenieść notatkę') }, h('i'), h('i'), h('i')),
          small ? h('p', { class: 'wn-mini', text: noteTitle(noteText(n.id)) || '…' }) : noteArea(n));
        if (e) e.el.replaceWith(ne); else lItems.append(ne);
        e = { el: ne, k: key }; els.set(k, e);
      }
      place(e.el, it, z);
      e.el.style.setProperty('--nz', String(clamp(z, 0.55, 1.6)));
      e.el.classList.toggle('picked', picked.has(k));
      e.el.classList.toggle('live', live.has(k));
    }
    for (const [k, e] of els) if (!seen.has(k)) { e.el.remove(); els.delete(k); }
    paintLinks(z);
    paintSel(z);
    paintMini();
    zv.textContent = Math.round(z * 100) + '%';
  }
  function place(node, it, z) {
    const s0 = node.style;
    s0.left = Math.round(sx(it.x)) + 'px'; s0.top = Math.round(sy(it.y)) + 'px';
    s0.width = Math.max(4, Math.round(it.w * z)) + 'px'; s0.height = Math.max(4, Math.round(it.h * z)) + 'px';
  }
  function noteArea(n) {
    const ta = h('textarea', { class: 'wn-text', placeholder: t('Notatka…'), 'aria-label': t('Notatka na ścianie'), spellcheck: 'true' });
    ta.value = noteText(n.id);
    let tm = 0;
    ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => noteSet(n.id, ta.value), 250); });
    ta.addEventListener('blur', () => { clearTimeout(tm); noteSet(n.id, ta.value); });
    ta.addEventListener('pointerdown', e => e.stopPropagation()); // typing and selecting text are the textarea's own
    ta.addEventListener('keydown', e => e.stopPropagation());
    ta.addEventListener('wheel', e => { if (ta.scrollHeight > ta.clientHeight) e.stopPropagation(); }, { passive: true });
    return ta;
  }
  function paintLinks(z) {
    links.setAttribute('width', W); links.setAttribute('height', H);
    links.replaceChildren();
    if (!st.links) return;
    for (const l of D.lessons || []) for (const to of l.to || []) {
      const a = R[l.from] && st.cards[l.from] && cardRect(R[l.from]), b = R[to] && st.cards[to] && cardRect(R[to]);
      if (!a || !b) continue;
      const ax = sx(a.x + a.w / 2), ay = sy(a.y + a.h / 2), bx = sx(b.x + b.w / 2), by = sy(b.y + b.h / 2);
      const mx = (ax + bx) / 2, my = Math.min(ay, by) - 40 * clamp(z, 0.4, 1.4);
      links.append(s('path', { d: `M${ax} ${ay} Q${mx} ${my} ${bx} ${by}` }), s('text', { x: mx, y: my + 14, 'text-anchor': 'middle', text: l.id }));
    }
  }
  /* the outline and the single resize corner of what is picked */
  function paintSel(z) {
    const ks = [...picked].filter(k => itemByKey(k));
    if (!ks.length || g?.type === 'band') { selBoxEl.hidden = true; return; }
    const its = ks.map(itemByKey);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of its) { x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + it.h); }
    const pad = 5;
    selBoxEl.hidden = false;
    Object.assign(selBoxEl.style, { left: (sx(x0) - pad) + 'px', top: (sy(y0) - pad) + 'px', width: ((x1 - x0) * z + pad * 2) + 'px', height: ((y1 - y0) * z + pad * 2) + 'px' });
    selBoxEl.classList.toggle('one', ks.length === 1);
    selBoxEl.firstChild.hidden = ks.length !== 1 || !!g && g.type === 'move';
  }
  function paintMini() {
    const bb = wallBBox(st, vm()), vw = W / cam.z, vh = H / cam.z, vx = cam.cx - vw / 2, vy = cam.cy - vh / 2;
    const show = st.mini !== false && (vx > bb.x + 2 || vy > bb.y + 2 || vx + vw < bb.x + bb.w - 2 || vy + vh < bb.y + bb.h - 2) && W > 560 && H > 380; // on a phone the corner map would cover the cards
    mini.hidden = !show;
    if (!show) return;
    const MW = 168, MH = 112, dpr = Math.min(2, devicePixelRatio || 1);
    const ux = Math.min(bb.x, vx), uy = Math.min(bb.y, vy), uw = Math.max(bb.x + bb.w, vx + vw) - ux, uh = Math.max(bb.y + bb.h, vy + vh) - uy;
    const k = Math.min(MW / uw, MH / uh);
    mini.width = MW * dpr; mini.height = MH * dpr; mini.style.width = MW + 'px'; mini.style.height = MH + 'px';
    const g2 = mini.getContext('2d');
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, MW, MH);
    const ox = (MW - uw * k) / 2, oy = (MH - uh * k) / 2, X = x => ox + (x - ux) * k, Y = y => oy + (y - uy) * k;
    g2.strokeStyle = B.cssv('--rule-2'); g2.lineWidth = 1;
    if (st.showFrames !== false) for (const f of st.frames) g2.strokeRect(X(f.x) + 0.5, Y(f.y) + 0.5, f.w * k, f.h * k);
    for (const r of REPOS) { if (!st.cards[r.name] || !Number.isFinite(st.cards[r.name].x)) continue; const it = cardRect(r), lvl = r.life === 'zakończone' ? -1 : heatOf(r.last_ts); g2.fillStyle = B.cssv(lvl < 0 ? '--ash' : lvl === 0 ? '--h0' : heatVar(lvl)) || '#888'; g2.fillRect(X(it.x), Y(it.y), Math.max(1.5, it.w * k), Math.max(1.5, it.h * k)); }
    g2.fillStyle = B.cssv('--warn') || '#cc9';
    for (const n of st.notes) g2.fillRect(X(n.x), Y(n.y), Math.max(1.5, n.w * k), Math.max(1.5, n.h * k));
    g2.strokeStyle = B.cssv('--hand') || '#fb4'; g2.lineWidth = 1.5;
    g2.strokeRect(X(vx), Y(vy), vw * k, vh * k);
    mini._map = { X0: ox, Y0: oy, k, ux, uy };
  }

  /* ---- the hand ---- */
  const ptrs = new Map();    // pointerId -> {x, y, type}
  let lastTap = { t: 0, x: 0, y: 0, k: '' };
  const localXY = e => { const b = el.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width || 1), y: (e.clientY - b.top) * (H / b.height || 1) }; };
  function classify(target) {
    if (target.closest('[data-handle]')) return { kind: 'handle' };
    if (target.closest('[data-mini]')) return { kind: 'mini' };
    if (target.closest('.w2-zbar')) return { kind: 'ui' };
    const it = target.closest('[data-k]');
    if (!it) return { kind: 'empty' };
    const k = it.dataset.k;
    if (k.startsWith('n:')) return target.closest('[data-grip]') ? { kind: 'item', k } : { kind: 'noteBody', k };
    if (k.startsWith('f:')) return target.closest('[data-grip]') ? { kind: 'item', k } : { kind: 'empty', frame: k };
    return { kind: 'item', k };
  }
  let lastTouch = 0;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') lastTouch = Date.now();
    if (e.target.closest('a, button:not(.w2-handle), select, textarea, input')) return;
    const p = localXY(e);
    ptrs.set(e.pointerId, { x: p.x, y: p.y, type: e.pointerType });
    if (ptrs.size === 2 && [...ptrs.values()].every(q => q.type === 'touch')) { startPinch(); e.preventDefault(); return; }
    if (ptrs.size > 1) return;
    const what = classify(e.target);
    if (what.kind === 'ui') return;
    if (e.pointerType === 'mouse' && e.button === 1) { e.preventDefault(); begin(e, { type: 'pan', cam0: { ...cam }, sx: p.x, sy: p.y }); return; }
    if (e.button !== 0) return;
    el.focus({ preventScroll: true });
    if (what.kind === 'mini') { begin(e, { type: 'mini' }); miniJump(p); return; }
    if (what.kind === 'handle') { const k = [...picked][0], it = itemByKey(k); if (!it) return; begin(e, { type: 'resize', k, it0: { ...it }, sx: p.x, sy: p.y }); return; }
    if (what.kind === 'noteBody') { pick(what.k, e.shiftKey); return; }
    if (what.kind === 'item') {
      const touch = e.pointerType === 'touch', grip = e.target.closest('[data-grip]');
      if (touch && !grip) { begin(e, { type: 'hold', k: what.k, sx: p.x, sy: p.y, cam0: { ...cam }, timer: setTimeout(() => arm(), 380) }); return; }
      begin(e, { type: 'press', k: what.k, sx: p.x, sy: p.y, shift: e.shiftKey });
      return;
    }
    // empty wall
    if (e.pointerType !== 'touch' && (e.shiftKey || e.ctrlKey || e.metaKey)) { begin(e, { type: 'band', sx: p.x, sy: p.y, add: true }); return; }
    begin(e, { type: 'press-empty', sx: p.x, sy: p.y, cam0: { ...cam }, frame: what.frame });
  });
  function begin(e, gest) {
    g = { ...gest, pid: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    c.busy(true);
    e.preventDefault();
  }
  function arm() {
    if (!g || g.type !== 'hold') return;
    g.type = 'armed';
    const e0 = els.get(g.k);
    e0?.el.classList.add('lifted');
    try { navigator.vibrate?.(12); } catch { /* not allowed */ }
  }
  el.addEventListener('pointermove', e => {
    const q = ptrs.get(e.pointerId);
    if (!q) return;
    const p = localXY(e);
    q.x = p.x; q.y = p.y;
    if (g && g.type === 'pinch') { pinchMove(); return; }
    if (!g || e.pointerId !== g.pid) return;
    const dx = p.x - g.sx, dy = p.y - g.sy, dist = Math.hypot(dx, dy);
    if (g.type === 'press' || g.type === 'armed') { if (dist > 4) startMove(); }
    else if (g.type === 'hold') { if (dist > 9) { clearTimeout(g.timer); g.type = 'pan'; } }
    else if (g.type === 'press-empty') { if (dist > 4) g.type = 'pan'; }
    if (g.type === 'pan') { cam.cx = g.cam0.cx - dx / cam.z; cam.cy = g.cam0.cy - dy / cam.z; paint(); }
    else if (g.type === 'move') moveTo(dx, dy, p);
    else if (g.type === 'resize') resizeTo(dx, dy, p);
    else if (g.type === 'band') bandTo(p);
    else if (g.type === 'mini') miniJump(p);
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (g && g.type === 'pinch') { if (ptrs.size < 2) { saveCam(); g = null; c.busy(false); } return; }
    if (!g || e.pointerId !== g.pid) return;
    const gg = g; g = null;
    clearTimeout(gg.timer);
    try { el.releasePointerCapture(e.pointerId); } catch { /* gone */ }
    const cancel = e.type === 'pointercancel';
    if (gg.type === 'press') { if (!cancel) clickItem(gg.k, gg.shift); }
    else if (gg.type === 'hold') { if (!cancel) clickItem(gg.k, false); }
    else if (gg.type === 'armed') { els.get(gg.k)?.el.classList.remove('lifted'); if (!cancel) itemMenu(gg.k, null, { x: e.clientX, y: e.clientY }); }
    else if (gg.type === 'press-empty') { if (!cancel) clickEmpty(gg, e); }
    else if (gg.type === 'pan' || gg.type === 'mini') saveCam();
    else if (gg.type === 'move') endMove(gg, cancel);
    else if (gg.type === 'resize') endResize(gg, cancel);
    else if (gg.type === 'band') endBand(gg);
    readout.hidden = true;
    c.busy(false);
    paint();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  function pick(k, add) {
    if (add) { if (picked.has(k)) picked.delete(k); else picked.add(k); }
    else { picked.clear(); picked.add(k); }
    paint();
  }
  function clickItem(k, add) {
    const now = Date.now(), again = lastTap.k === k && now - lastTap.t < 400;
    lastTap = { t: again ? 0 : now, x: 0, y: 0, k };
    pick(k, add);
    if (k.startsWith('c:')) c.select(k.slice(2));
    if (!again) return;
    // a double click: a card opens its whole story, a frame wants a new name
    if (k.startsWith('c:')) c.openType('karta', { free: true });
    else if (k.startsWith('f:')) renameFrame(k.slice(2));
  }
  function clickEmpty(gg, e) {
    const now = Date.now(), p = { x: gg.sx, y: gg.sy };
    if (!lastTap.k && now - lastTap.t < 400 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 24) { lastTap.t = 0; addNote(wx(p.x), wy(p.y)); return; }
    lastTap = { t: now, x: p.x, y: p.y, k: '' };
    if (gg.frame) { pick(gg.frame, e.shiftKey); return; }
    if (picked.size) { picked.clear(); paint(); }
  }
  /* what moves with what: picked cards together; a frame carries what lies inside it */
  function startMove() {
    if (!picked.has(g.k)) { picked.clear(); picked.add(g.k); }
    const keys = new Set(picked);
    for (const k of [...keys]) if (k.startsWith('f:')) {
      const f = itemByKey(k);
      for (const r of REPOS.filter(placed)) { const it = cardRect(r), cx = it.x + it.w / 2, cy = it.y + it.h / 2; if (cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h) keys.add(it.k); }
      for (const n of st.notes) { const cx = n.x + n.w / 2, cy = n.y + n.h / 2; if (cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h) keys.add('n:' + n.id); }
    }
    g.items = [...keys].map(itemByKey).filter(Boolean).map(it => ({ k: it.k, x0: it.x, y0: it.y, w: it.kind === 'c' && it.hand ? it.w : 0, h: it.kind === 'c' && it.hand ? it.h : 0 }));
    g.type = 'move';
    els.get(g.k)?.el.classList.remove('lifted');
    el.classList.add('moving');
  }
  function moveTo(dx, dy, p) {
    const dwx = dx / cam.z, dwy = dy / cam.z;
    for (const it of g.items) live.set(it.k, { x: it.x0 + dwx, y: it.y0 + dwy, w: it.w, h: it.h });
    g.dwx = dwx; g.dwy = dwy;
    const main = itemByKey(g.k);
    readout.hidden = false;
    readout.textContent = g.items.length > 1 ? t('Przesuwasz: {0}', tn(g.items.length, 'rzecz', 'rzeczy', 'rzeczy')) : t('Przesuwasz: {0}', main?.r ? main.r.short : main?.kind === 'n' ? t('notatkę') : t('ramkę'));
    Object.assign(readout.style, { left: clamp(p.x + 16, 6, W - 220) + 'px', top: clamp(p.y + 18, 4, H - 34) + 'px' });
    edgePan(p);
    paint();
  }
  /* near the edge of the window the view follows the hand */
  function edgePan(p) {
    const m = 28, v = 9 / cam.z;
    let ddx = p.x < m ? -v : p.x > W - m ? v : 0, ddy = p.y < m ? -v : p.y > H - m ? v : 0;
    if (!ddx && !ddy) return;
    cam.cx += ddx; cam.cy += ddy; g.sx -= ddx * cam.z; g.sy -= ddy * cam.z;
  }
  function endMove(gg, cancel) {
    el.classList.remove('moving');
    const moves = gg.items.map(it => ({ k: it.k, x: Math.round(it.x0 + (gg.dwx || 0)), y: Math.round(it.y0 + (gg.dwy || 0)) }));
    live.clear();
    if (cancel || (!gg.dwx && !gg.dwy)) { paint(); return; }
    const one = moves.length === 1 ? itemByKey(moves[0].k) : null;
    const label = one ? (one.r ? t('przesunięcie karty {0}', one.r.short) : one.kind === 'n' ? t('przesunięcie notatki') : t('przesunięcie ramki')) : t('przesunięcie {0}', tn(moves.length, 'rzeczy', 'rzeczy', 'rzeczy'));
    c.commit(label, () => {
      for (const m of moves) {
        if (m.k.startsWith('c:')) { const n = m.k.slice(2), sz = wallSizeOf(st, R[n], vm()), c0 = st.cards[n]; c0.x = m.x + sz.w / 2; c0.y = m.y + sz.h / 2; delete c0.nowe; }
        else if (m.k.startsWith('n:')) { const n = st.notes.find(x => x.id === m.k.slice(2)); if (n) { n.x = m.x; n.y = m.y; } }
        else { const f = st.frames.find(x => x.id === m.k.slice(2)); if (f) { f.x = m.x; f.y = m.y; } }
      }
    });
    c.save();
  }
  function resizeTo(dx, dy, p) {
    const it = g.it0, z = cam.z;
    const min = it.kind === 'c' ? 40 : it.kind === 'n' ? 60 : 120;
    const w = Math.round(clamp(it.w + dx / z, min, 2400)), hh = Math.round(clamp(it.h + dy / z, min * 0.7, 2400));
    live.set(it.k, { x: it.x, y: it.y, w, h: hh });
    g.w = w; g.h = hh;
    readout.hidden = false;
    readout.textContent = it.kind === 'c' ? `${it.r.short}: ${w}×${hh} · ${t(LOD_NAME[wallLod(w * z, hh * z)])}` : `${w}×${hh}`;
    Object.assign(readout.style, { left: clamp(p.x + 16, 6, W - 240) + 'px', top: clamp(p.y + 18, 4, H - 34) + 'px' });
    paint();
  }
  function endResize(gg, cancel) {
    live.clear();
    if (cancel || !gg.w) { paint(); return; }
    const it = gg.it0;
    c.commit(it.kind === 'c' ? t('rozmiar karty {0}', it.r.short) : it.kind === 'n' ? t('rozmiar notatki') : t('rozmiar ramki'), () => {
      if (it.kind === 'c') { const c0 = st.cards[it.r.name]; c0.w = gg.w; c0.h = gg.h; c0.x = it.x + gg.w / 2; c0.y = it.y + gg.h / 2; }
      else if (it.kind === 'n') Object.assign(it.n, { w: gg.w, h: gg.h });
      else Object.assign(it.f, { w: gg.w, h: gg.h });
    });
    c.save();
  }
  function bandTo(p) {
    const x0 = Math.min(p.x, g.sx), y0 = Math.min(p.y, g.sy), x1 = Math.max(p.x, g.sx), y1 = Math.max(p.y, g.sy);
    band.hidden = false;
    Object.assign(band.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
    g.box = { x0: wx(x0), y0: wy(y0), x1: wx(x1), y1: wy(y1) };
  }
  function endBand(gg) {
    band.hidden = true;
    if (!gg.box) return;
    const b = gg.box;
    const inside = it => it.x < b.x1 && it.x + it.w > b.x0 && it.y < b.y1 && it.y + it.h > b.y0;
    if (!gg.add) picked.clear();
    for (const r of REPOS.filter(placed)) { const it = cardRect(r); if (inside(it)) picked.add(it.k); }
    for (const n of st.notes) { const it = noteRect(n); if (inside(it)) picked.add(it.k); }
  }
  function miniJump(p) {
    const m = mini._map;
    if (!m) return;
    const r = mini.getBoundingClientRect(), b = el.getBoundingClientRect();
    const mx = p.x - (r.left - b.left), my = p.y - (r.top - b.top);
    cam.cx = m.ux + (mx - m.X0) / m.k; cam.cy = m.uy + (my - m.Y0) / m.k;
    paint();
  }
  /* two fingers: zoom around their middle, follow it */
  function startPinch() {
    if (g) { clearTimeout(g.timer); if (g.type === 'move') { live.clear(); el.classList.remove('moving'); } }
    const [a, b] = [...ptrs.values()];
    g = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam0: { ...cam } };
    c.busy(true);
    readout.hidden = true;
  }
  function pinchMove() {
    const [a, b] = [...ptrs.values()];
    if (!a || !b) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const z = clamp(g.cam0.z * d / g.d0, WZMIN, WZMAX);
    const ax = (g.m0.x - W / 2) / g.cam0.z + g.cam0.cx, ay = (g.m0.y - H / 2) / g.cam0.z + g.cam0.cy; // world point that started under the fingers
    cam = { z, cx: ax - (m.x - W / 2) / z, cy: ay - (m.y - H / 2) / z };
    paint();
  }
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const p = localXY(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
    if (e.ctrlKey || (prefs.wheel === 'zoom' && !e.shiftKey)) zoomAt(cam.z * Math.exp(-clamp(dy, -160, 160) * 0.0016), p.x, p.y);
    else { cam.cx += (e.shiftKey && !dx ? dy : dx) / cam.z; cam.cy += (e.shiftKey && !dx ? 0 : dy) / cam.z; paint(); saveCam(); }
  }, { passive: false });
  el.addEventListener('contextmenu', e => {
    if (e.target.closest('textarea, input')) return;
    e.preventDefault();
    if (g || ptrs.size || lastTouch > Date.now() - 900) return; // a finger holding a card: its own menu comes on release
    const what = classify(e.target), p = localXY(e);
    if (what.kind === 'item' || what.kind === 'noteBody') { if (!picked.has(what.k)) pick(what.k, false); itemMenu(what.k, null, { x: e.clientX, y: e.clientY }); }
    else wallHereMenu(null, { x: e.clientX, y: e.clientY }, wx(p.x), wy(p.y));
  });
  /* keys: 0 fits, + and − zoom, arrows nudge what is picked (one undo step per burst), Delete removes notes and frames */
  let nudge = null;
  el.addEventListener('keydown', e => {
    if (e.target.closest('textarea, input')) return;
    const k = e.key;
    if (k === '0' || k === 'Home') { e.preventDefault(); fit(true); return; }
    if (k === '9') { e.preventDefault(); fit(true, true); return; }
    if (k === '+' || k === '=') { e.preventDefault(); zoomAt(cam.z * 1.25); return; }
    if (k === '-' || k === '_') { e.preventDefault(); zoomAt(cam.z / 1.25); return; }
    if (k === 'Escape' && picked.size) { picked.clear(); paint(); return; }
    if ((k === 'Delete' || k === 'Backspace') && picked.size) { e.preventDefault(); removePicked(); return; }
    if (k === 'Enter') { const card = e.target.closest('.wc'); if (card) clickItem(card.dataset.k, false); return; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (!dir || !picked.size) return;
    e.preventDefault();
    const step = e.shiftKey ? 40 : 8;
    if (!nudge) nudge = { items: [...picked].map(itemByKey).filter(Boolean).map(it => ({ k: it.k, x0: it.x, y0: it.y, w: it.kind === 'c' && it.hand ? it.w : 0, h: it.kind === 'c' && it.hand ? it.h : 0 })), dx: 0, dy: 0 };
    nudge.dx += dir[0] * step; nudge.dy += dir[1] * step;
    for (const it of nudge.items) live.set(it.k, { x: it.x0 + nudge.dx, y: it.y0 + nudge.dy, w: it.w, h: it.h });
    paint();
    clearTimeout(nudge.t);
    nudge.t = setTimeout(() => { const n0 = nudge; nudge = null; endMove({ items: n0.items, dwx: n0.dx, dwy: n0.dy }, false); }, 700);
  });

  /* ---- things Jozz adds ---- */
  function addNote(x, y, text = '') {
    const id = noteNew(text), w = 220, hh = 150;
    if (x == null) { x = cam.cx; y = cam.cy; }
    c.commit(t('nowa notatka na ścianie'), () => { st.notes.push({ id, x: Math.round(x - w / 2), y: Math.round(y - 20), w, h: hh, tone: 'zolty' }); });
    c.save();
    picked.clear(); picked.add('n:' + id);
    paint();
    requestAnimationFrame(() => els.get('n:' + id)?.el.querySelector('textarea')?.focus());
  }
  function addFrame(x, y) {
    const ks = [...picked].map(itemByKey).filter(it => it && it.kind !== 'f');
    let fr;
    if (ks.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const it of ks) { x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + it.h); }
      fr = { id: 'f' + uid(), x: Math.round(x0 - 22), y: Math.round(y0 - 58), w: Math.round(x1 - x0 + 44), h: Math.round(y1 - y0 + 80), label: t('Nowa ramka'), tone: '' };
    } else {
      if (x == null) { x = cam.cx; y = cam.cy; }
      fr = { id: 'f' + uid(), x: Math.round(x - 220), y: Math.round(y - 150), w: 440, h: 300, label: t('Nowa ramka'), tone: '' };
    }
    c.commit(t('nowa ramka'), () => { st.showFrames = true; st.frames.push(fr); });
    c.save();
    picked.clear(); picked.add('f:' + fr.id);
    paint();
    setTimeout(() => renameFrame(fr.id), 30);
  }
  function renameFrame(id) {
    const f = st.frames.find(x => x.id === id), e0 = els.get('f:' + id);
    if (!f || !e0) return;
    promptPop(e0.el.querySelector('.wf-lab'), t('Nazwa ramki'), f.label, v => { c.commit(t('nazwa ramki'), () => { f.label = v || t('Ramka'); }); c.save(); paint(); });
  }
  function removePicked() {
    const ns = [...picked].filter(k => k.startsWith('n:')), fs = [...picked].filter(k => k.startsWith('f:'));
    if (!ns.length && !fs.length) { jtoast(t('Karty projektów zostają na ścianie; usunąć możesz notatki i ramki.')); return; }
    for (const k of ns) { const n = st.notes.find(x => x.id === k.slice(2)); if (n) toTrash('wallnote', noteTitle(noteText(n.id)) || t('notatka'), { win: c.id, note: n }); }
    c.commit(ns.length && fs.length ? t('usunięcie notatek i ramek') : ns.length ? t('notatka ze ściany do kosza') : t('usunięcie ramki'), () => {
      st.notes = st.notes.filter(n => !picked.has('n:' + n.id));
      st.frames = st.frames.filter(f => !picked.has('f:' + f.id));
    });
    c.save();
    picked.clear();
    paint();
    if (ns.length) jtoast(t('Notatka jest w koszu.'), { label: t('Cofnij'), act: () => undo() });
  }
  function tone(k, v) {
    c.commit(t('kolor'), () => { const it = itemByKey(k); if (it?.n) it.n.tone = v; if (it?.f) it.f.tone = v; });
    c.save(); paint();
  }
  function itemMenu(k, anchor, at) {
    const it = itemByKey(k);
    if (!it) return;
    if (it.kind === 'c') {
      const r = it.r;
      openMenu(anchor, [
        { head: r.short },
        { label: t('Karta projektu'), icon: 't_karta', act: () => { c.select(r.name); c.openType('karta', { free: true }); } },
        r.pages && r.life !== 'zakończone' ? { label: t('Zagraj'), icon: 'play', act: () => B.openUrl(r.pages) } : null,
        { label: t('Otwórz na GitHubie'), icon: 'ext', act: () => B.openUrl(r.url) },
        { sep: true },
        it.hand ? { label: t('Rozmiar z miary'), desc: t('oddaj rozmiar mierze „{0}”', t(WALL_DRV.find(d => d[0] === st.size)?.[1] || '')), icon: 'reset', act: () => { c.commit(t('rozmiar karty {0} z miary', r.short), () => { const c0 = st.cards[r.name]; delete c0.w; delete c0.h; }); c.save(); paint(); } } : null,
        picked.size > 1 ? { label: t('Ramka wokół zaznaczonych'), icon: 'frame', act: () => addFrame() } : { label: t('Ramka wokół tej karty'), icon: 'frame', act: () => addFrame() },
      ], at);
      return;
    }
    const items = [{ head: it.kind === 'n' ? t('Notatka') : (it.f.label || t('Ramka')) }];
    if (it.kind === 'f') items.push({ label: t('Zmień nazwę'), icon: 'pencil', act: () => renameFrame(it.f.id) },
      { label: t('Dopasuj do zawartości'), icon: 'fit', act: () => fitFrame(it.f) });
    const tones = it.kind === 'f' ? ['', ...TONES] : TONES;
    items.push({ sep: true }, { head: t('Kolor') }, ...tones.map(v => ({ label: v ? t(TONE_NAMES[v]) : t('bez koloru'), checked: ((it.kind === 'n' ? it.n.tone : it.f.tone) || '') === v, act: () => tone(k, v) })));
    items.push({ sep: true }, { label: it.kind === 'n' ? t('Do kosza') : t('Usuń ramkę (karty zostają)'), icon: 'trash', danger: true, act: () => { picked.clear(); picked.add(k); removePicked(); } });
    openMenu(anchor, items, at);
  }
  function fitFrame(f) {
    const inside = REPOS.filter(placed).map(cardRect).filter(it => { const cx = it.x + it.w / 2, cy = it.y + it.h / 2; return cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h; });
    if (!inside.length) { jtoast(t('W tej ramce nie ma kart.')); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of inside) { x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + it.h); }
    c.commit(t('ramka dopasowana'), () => Object.assign(f, { x: Math.round(x0 - 22), y: Math.round(y0 - 58), w: Math.round(x1 - x0 + 44), h: Math.round(y1 - y0 + 80) }));
    c.save(); paint();
  }
  function wallHereMenu(anchor, at, x, y) {
    openMenu(anchor, [
      { head: t('Ściana') },
      { label: t('Nowa notatka tutaj'), icon: 'note', hint: t('dwuklik'), act: () => addNote(x, y) },
      { label: t('Nowa ramka tutaj'), icon: 'frame', act: () => addFrame(x, y) },
      { sep: true },
      { label: t('Pokaż wszystko'), icon: 'fit', hint: '0', act: () => fit(true) },
      { label: t('Ułóż…'), icon: 'grid4', sub: b => arrangeMenu(b, c) },
    ], at);
  }

  const api = { fit: () => fit(true), addNote: () => addNote(), addFrame: () => addFrame(), zoomBy: f => zoomAt(cam.z * f), picked, cam: () => cam, aspect: () => (W && H ? W / H : 1.6) };
  WALLS.set(c.id, api);
  c.onSel(name => { const k = 'c:' + name; if (!(picked.size === 1 && picked.has(k))) { if (![...picked].some(x => x === k)) { picked.clear(); picked.add(k); } } paint(); });
  const ro = new ResizeObserver(() => {
    const nw = el.clientWidth, nh = el.clientHeight;
    if (!nw || !nh) return;
    W = nw; H = nh;
    if (pending) { pending = false; wallPrepare(st, W / H < 0.8 ? clamp(W / H * 0.7, 0.4, 0.7) : W / H); c.save(); cam = null; }
    if (!cam) { cam = fitCam(); saveCam(); }
    paintNow();
  });
  ro.observe(el);
  const onTheme = () => paint();
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-jk', 'data-theme', 'data-life'] });
  c.onDispose(() => { ro.disconnect(); mo.disconnect(); clearTimeout(camT); if (nudge) clearTimeout(nudge.t); cancelAnimationFrame(painting); if (WALLS.get(c.id) === api) WALLS.delete(c.id); });
}

function arrangeMenu(anchor, c) {
  const st = c.win.st;
  const go = (kind, label) => { const a = WALLS.get(c.id)?.aspect() || 1.6; c.commit(label, () => wallApplyArrangement(st, wallArrange(st, kind, a))); c.save(); setTimeout(() => WALLS.get(c.id)?.fit(), 40); };
  openMenu(anchor, [
    { head: t('Ułóż karty od nowa') },
    { note: t('Karty zmienią miejsca (Ctrl+Z cofa). Rozmiary ustawione ręką, Twoje ramki i notatki zostają.') },
    { label: t('Według rodzin'), desc: t('ramka dla każdej rodziny, najżywsze pierwsze'), icon: 'frame', act: () => go('rodziny', t('ułożenie ściany według rodzin')) },
    { label: t('Według życia'), desc: t('żywe, stygnące, uśpione…'), icon: 'layers', act: () => go('zycie', t('ułożenie ściany według życia')) },
    { label: t('Według świeżości'), desc: t('siatka od ostatnio ruszanych'), icon: 'grid4', act: () => go('swiezosc', t('ułożenie ściany według świeżości')) },
    { sep: true },
    { label: t('Rozsuń nachodzące karty'), desc: t('tylko tyle, ile trzeba; reszta stoi'), icon: 'spread', act: () => { let n = 0; c.commit(t('rozsunięcie kart'), () => { n = wallSeparate(st); return n ? undefined : false; }); c.save(); jtoast(n ? t('Rozsunięte: {0}.', tn(n, 'karta', 'karty', 'kart')) : t('Nic na siebie nie nachodzi.')); } },
  ]);
}
function wallViewMenu(anchor, c) {
  const st = c.win.st, api = WALLS.get(c.id);
  const flip = (k, label) => { c.commit(label, () => { st[k] = st[k] === false ? true : !st[k]; }); c.save(); };
  openMenu(anchor, [
    { head: t('Widok ściany') },
    { label: t('Pokaż wszystko'), icon: 'fit', hint: '0', act: () => api?.fit() },
    { sep: true },
    { label: t('Ramki'), checked: st.showFrames !== false, act: () => flip('showFrames', st.showFrames !== false ? t('ukrycie ramek') : t('pokazanie ramek')) },
    { label: t('Powiązania (lekcje)'), desc: t('co przeszło z projektu do projektu'), checked: !!st.links, act: () => flip('links', st.links ? t('ukrycie powiązań') : t('pokazanie powiązań')) },
    { label: t('Mapka w rogu'), checked: st.mini !== false, act: () => flip('mini', st.mini !== false ? t('ukrycie mapki') : t('pokazanie mapki')) },
    { sep: true },
    { label: t('Nowa ramka'), desc: t('wokół zaznaczonych albo na środku'), icon: 'frame', act: () => api?.addFrame() },
  ]);
}
function wallCtx(c) {
  const st = c.win.st;
  const sel = h('select', { class: 'jk-sel-in', 'aria-label': t('Rozmiar kart według'),
    onchange: e => { c.commit(t('rozmiar kart według: {0}', e.target.selectedOptions[0].text), () => { st.size = e.target.value; }); c.save(); } },
    WALL_DRV.map(([v, tx]) => h('option', { value: v, selected: (st.size || 'a28') === v, text: t(tx) })));
  return [h('label', { class: 'jk-ctl' }, h('span', { text: t('Rozmiar według') }), sel),
    h('button', { class: 'jk-tb', type: 'button', title: t('Ułóż karty od nowa: według rodzin, życia albo świeżości'), onclick: e => arrangeMenu(e.currentTarget, c) }, icon('grid4', 13), h('span', { class: 'lab', text: t('Ułóż…') })),
    h('button', { class: 'jk-tb', type: 'button', title: t('Nowa notatka na środku widoku (albo dwuklik w pustym miejscu)'), onclick: () => WALLS.get(c.id)?.addNote() }, icon('note', 13), h('span', { class: 'lab', text: t('Notatka') })),
    h('button', { class: 'jk-tb', type: 'button', title: t('Ramki, powiązania, mapka'), onclick: e => wallViewMenu(e.currentTarget, c) }, icon('eye', 13), h('span', { class: 'lab', text: t('Widok') }))];
}
