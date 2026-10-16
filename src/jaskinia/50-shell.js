/* ---------- workspaces, windows and the hand that arranges them ---------- */
let space = null, L = null;  // the workspace on screen and its layout
const hist = {};             // workspace id -> {undo: [], redo: []} (this session only; copies cover the rest)
const RT = new Map();        // window id -> runtime parts (element, header, body…)
let root, bar, stage, tabsEl, tabsW, spaceBtn, undoBtn, redoBtn, selBox, statusEl, dropEl, compassEl, selStyle, dockEl, sheetEl, toastBox;
let rects = { wins: {}, divs: [] };
let phone = false;           // one window at a time (narrow screens)
let drag = null;             // the shell gesture in progress: {cancel()}
const pointer = { x: -1, y: -1 };
const coarse = matchMedia('(pointer: coarse)');

/* ---------- undo ---------- */
const H = () => hist[space.id] || (hist[space.id] = { undo: [], redo: [] });
function pushUndo(label, before) {
  logEv(label);
  const hh = H();
  hh.undo.push({ label, L: before });
  if (hh.undo.length > 120) hh.undo.shift();
  hh.redo = [];
  updateUndoUI();
}
function commit(label, fn) {
  const before = clone(L);
  if (fn(L) === false) return false;
  if (JSON.stringify(L) === JSON.stringify(before)) return false;
  pushUndo(label, before);
  afterChange();
  return true;
}
function undo() {
  const s0 = H().undo.pop();
  if (!s0) { jtoast(t('Nie ma czego cofnąć')); return; }
  H().redo.push({ label: s0.label, L: clone(L) });
  replaceL(s0.L);
  logEv(t('cofnięte: {0}', s0.label));
  jtoast(t('Cofnięte: {0}', s0.label));
}
function redo() {
  const s0 = H().redo.pop();
  if (!s0) { jtoast(t('Nie ma czego ponowić')); return; }
  H().undo.push({ label: s0.label, L: clone(L) });
  replaceL(s0.L);
  logEv(t('ponowione: {0}', s0.label));
  jtoast(t('Ponowione: {0}', s0.label));
}
function replaceL(nl) { space.L = L = nl; afterChange(); }
function afterChange() { closeMenus(); apply(); for (const id of allIds()) refreshWin(id); updateUndoUI(); renderDock(); persist(); }
function updateUndoUI() {
  const hh = H(), u = hh.undo[hh.undo.length - 1], r0 = hh.redo[hh.redo.length - 1];
  undoBtn.disabled = !u; redoBtn.disabled = !r0;
  undoBtn.title = u ? t('Cofnij: {0} (Ctrl+Z)', u.label) : t('Cofnij (Ctrl+Z): nic do cofnięcia');
  redoBtn.title = r0 ? t('Ponów: {0} (Ctrl+Shift+Z)', r0.label) : t('Ponów (Ctrl+Shift+Z): nic do ponowienia');
  undoBtn.setAttribute('aria-label', undoBtn.title); redoBtn.setAttribute('aria-label', redoBtn.title);
}

/* ---------- helpers ---------- */
const allIds = () => [...leafIds(L.tree), ...L.floats.map(f => f.id)];
const isFloat = id => L.floats.some(f => f.id === id);
const typeOf = w => TYPES[w && w.type] || TYPES.wybor;
const winTitle = id => { const w = L.wins[id]; return (w && w.title) || t(typeOf(w).name); };
const tname = id => '„' + winTitle(id) + '”';
const zEff = w => typeOf(w).noZoom ? 1 : Math.round((w.z || 1) * prefs.cz * 100) / 100;
function innerSize(rt, w) { const z = zEff(w); return { w: rt.body.clientWidth / z, h: rt.body.clientHeight / z }; }
function stageRect() { return stage.getBoundingClientRect(); }
const spaceName = sp => sp.preset && sp.name === PRESETS[sp.preset] ? t(sp.name) : sp.name;

/* ---------- chrome ---------- */
function buildChrome() {
  root = h('div', { class: 'jk' });
  const brand = h('button', { class: 'jk-brand', type: 'button', 'aria-haspopup': 'menu', title: t('Menu Jaskini: ustawienia, zapisane układy, kopie, kosz'), onclick: e => mainMenu(e.currentTarget) },
    h('span', { class: 'mark', 'aria-hidden': 'true' }), h('b', { text: 'Jaskinia' }), h('small', { class: 'jk-ver', text: VER, title: t('Wersja Jaskini: {0}, zbudowana {1}', VER, builtShort()) }), icon('chev', 12, 'cv'));
  const snap = h('button', { class: 'jk-snap', type: 'button', onclick: e => snapInfo(e.currentTarget) });
  tabsEl = h('div', { class: 'jk-tabs', role: 'tablist', 'aria-label': t('Twoje układy okien') });
  tabsEl.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabsEl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  tabsEl.addEventListener('scroll', () => tabArrows(), { passive: true });
  const addBtn = h('button', { class: 'jk-tab-add', type: 'button', title: t('Nowy układ'), 'aria-label': t('Nowy układ'), onclick: e => newSpaceMenu(e.currentTarget) }, icon('plus', 14));
  tabsW = h('nav', { class: 'jk-tabs-w', 'aria-label': t('Układy') },
    ibtn('arrowL', t('Przewiń układy w lewo'), () => { tabsEl.scrollBy({ left: -tabsEl.clientWidth * 0.7, behavior: 'smooth' }); }, 'jk-tarr l'),
    tabsEl,
    ibtn('arrowR', t('Przewiń układy w prawo'), () => { tabsEl.scrollBy({ left: tabsEl.clientWidth * 0.7, behavior: 'smooth' }); }, 'jk-tarr r'),
    ibtn('layers', t('Wszystkie układy'), e => allSpacesMenu(e.currentTarget), 'jk-tall'), addBtn);
  spaceBtn = h('button', { class: 'jk-spacebtn', type: 'button', 'aria-haspopup': 'menu', onclick: e => allSpacesMenu(e.currentTarget) });
  undoBtn = ibtn('undo', t('Cofnij'), () => undo(), 'jk-undo');
  redoBtn = ibtn('redo', t('Ponów'), () => redo(), 'jk-redo');
  statusEl = h('div', { class: 'jk-status' });
  selBox = h('div', { class: 'jk-selbox' });
  const helpBtn = h('button', { class: 'jk-help-b', type: 'button', onclick: e => openHelp(e.currentTarget) }, icon('help', 15), h('span', { text: t('Jak to działa') }));
  const uwBtn = h('button', { class: 'jk-uw-b', type: 'button', title: t('To mnie uwiera: zapisz uwagę przypiętą do tej chwili (Ctrl+.)'), 'aria-label': t('To mnie uwiera'), onclick: e => uwagaPop(e.currentTarget) }, icon('flag', 15));
  bar = h('header', { class: 'jk-bar' }, brand, snap, spaceBtn, tabsW,
    h('div', { class: 'jk-tools' }, statusEl, undoBtn, redoBtn, h('span', { class: 'jk-sep' }), selBox, uwBtn, helpBtn));
  stage = h('main', { class: 'jk-stage', 'aria-label': t('Okna') });
  dropEl = h('div', { class: 'jk-drop', hidden: true }, h('span'));
  compassEl = h('div', { class: 'jk-compass', hidden: true }, ['top', 'left', 'center', 'right', 'bottom'].map(z => h('i', { 'data-z': z }, icon(z === 'center' ? 'swap' : 'chev', 14))));
  stage.append(dropEl, compassEl);
  sheetEl = h('div', { class: 'jk-sheet', hidden: true, role: 'status' });
  dockEl = h('nav', { class: 'jk-dock', hidden: true, 'aria-label': t('Okna tego układu') });
  toastBox = h('div', { class: 'jk-toasts', 'aria-live': 'polite' });
  root.append(bar, stage, sheetEl, dockEl);
  document.body.prepend(root);
  document.body.append(toastBox);
  selStyle = h('style', { id: 'jk-selstyle' });
  document.head.append(selStyle);
  renderSnap();
}
/* how old the snapshot is, said in the bar itself: a day-old snapshot must not pass for today */
function snapAgeText() {
  const age = snapAgeDays();
  if (age < 1 / 24) return t('sprzed chwili');
  if (age < 1) return t('sprzed {0} godz.', Math.max(1, Math.round(age * 24)));
  return t('sprzed {0}', tn(Math.max(1, Math.round(age)), 'dnia', 'dni', 'dni'));
}
function builtShort() { return BUILD.built ? dshort(new Date(BUILD.built.replace('Z', ':00Z'))) : '?'; }
function renderSnap() {
  const el = bar.querySelector('.jk-snap'), age = snapAgeDays();
  fill(el, h('small', { text: t('zrzut') + ' · ' + snapAgeText() }), h('b', { text: dshort(new Date(SNAP * 1000)) }));
  el.classList.toggle('stale', age >= 1);
  el.classList.toggle('old', age > 7);
  el.title = t('Dane: zrzut repozytoriów z {0} ({1}). Commitów zrobionych później Jaskinia nie zna. Kolory pokazują stan z chwili zrzutu.', dshort(new Date(SNAP * 1000)), snapAgeText());
}

/* ---------- layout on screen ---------- */
function apply() {
  if (!stage) return;
  const W = stage.clientWidth, Hh = stage.clientHeight;
  if (!W || !Hh) return;
  const was = phone;
  phone = W < NARROW_STAGE;
  root.classList.toggle('phone', phone);
  const ids = allIds();
  for (const id of ids) if (!RT.has(id)) makeWin(id);
  for (const [id, rt] of [...RT]) {
    if (rt.space !== space.id) { rt.el.hidden = true; continue; }
    if (!L.wins[id]) { dropWin(id); continue; }
    rt.el.hidden = false;
  }
  if (phone) {
    const cur = phoneCurrent();
    for (const id of ids) { RT.get(id).el.classList.toggle('off', id !== cur); RT.get(id).el.classList.remove('behind'); place(id, { x: 0, y: 0, w: W, h: Hh }, false, 0, false); }
    rects = { wins: {}, divs: [] };
    drawDividers([]);
  } else {
    for (const id of ids) RT.get(id).el.classList.remove('off');
    rects = layoutRects(L.tree, W, Hh);
    for (const [id, r] of Object.entries(rects.wins)) place(id, r, false, 0);
    L.floats.forEach((f, i) => place(f.id, floatPx(f, W, Hh), true, i));
    if (L.max) place(L.max, { x: 0, y: 0, w: W, h: Hh }, isFloat(L.max), 0, true);
    for (const id of ids) RT.get(id).el.classList.toggle('behind', !!L.max && L.max !== id);
    drawDividers(L.max ? [] : rects.divs);
  }
  root.classList.toggle('has-max', !phone && !!L.max);
  if (was !== phone) { for (const id of ids) updateHead(id); hideSheet(); logEv(phone ? t('tryb telefonu: jedno okno naraz ({0})', `${W}×${Hh}`) : t('tryb biurka ({0})', `${W}×${Hh}`)); }
  renderDock();
  tabArrows();
}
function phoneCurrent() { const ids = allIds(); return ids.includes(L.focus) ? L.focus : ids[0]; }
function floatPx(f, W, Hh) {
  const w = Math.min(W, Math.max(Math.min(260, W), f.w * W)), hh = Math.min(Hh, Math.max(Math.min(150, Hh), f.h * Hh));
  return { x: clamp(f.x * W, 0, Math.max(0, W - 90)), y: clamp(f.y * Hh, 0, Math.max(0, Hh - 40)), w, h: hh };
}
function place(id, r, float, zi, maxed = false) {
  const rt = RT.get(id);
  if (!rt) return;
  const st = rt.el.style;
  st.left = Math.round(r.x) + 'px'; st.top = Math.round(r.y) + 'px'; st.width = Math.round(r.w) + 'px'; st.height = Math.round(r.h) + 'px';
  st.zIndex = maxed ? 30 : float ? String(10 + zi) : '';
  rt.el.classList.toggle('float', !!float && !maxed);
  rt.el.classList.toggle('maxed', !!maxed);
  rt.rect = r;
}
const divEls = new WeakMap();
function drawDividers(divs) {
  const keep = new Set(), hit = coarse.matches ? 22 : 10;
  for (const dv of divs) {
    let el = divEls.get(dv.node);
    if (!el || !el.isConnected) {
      el = h('div', { class: 'jk-div', role: 'separator', tabindex: 0, 'aria-label': t('Granica między oknami. Przeciągnij, żeby zmienić proporcje; dwuklik wyrównuje; strzałki przesuwają.') });
      el.addEventListener('pointerdown', e => divDown(e, el));
      el.addEventListener('dblclick', () => { const n = el._dv.node; commit(t('wyrównanie dwóch części'), () => { n.r = 0.5; }); });
      el.addEventListener('keydown', e => {
        const dv0 = el._dv, k = e.key, step = e.shiftKey ? 0.1 : 0.02;
        const dir = (dv0.d === 'row' && k === 'ArrowLeft') || (dv0.d === 'col' && k === 'ArrowUp') ? -1 : (dv0.d === 'row' && k === 'ArrowRight') || (dv0.d === 'col' && k === 'ArrowDown') ? 1 : 0;
        if (!dir) return;
        e.preventDefault();
        commit(t('zmiana proporcji okien'), () => { dv0.node.r = shareAt(dv0, (dv0.node.r + dir * step) * (dv0.span - GAP)); });
        requestAnimationFrame(() => divEls.get(dv0.node)?.focus());
      });
      divEls.set(dv.node, el);
      stage.append(el);
    }
    el._dv = dv;
    el.className = 'jk-div ' + (dv.d === 'row' ? 'jk-dv' : 'jk-dh') + (el.classList.contains('on') ? ' on' : '');
    el.setAttribute('aria-orientation', dv.d === 'row' ? 'vertical' : 'horizontal');
    el.setAttribute('aria-valuenow', String(Math.round(dv.node.r * 100)));
    if (dv.d === 'row') Object.assign(el.style, { left: (dv.x + dv.w / 2 - hit / 2) + 'px', top: dv.y + 'px', width: hit + 'px', height: dv.h + 'px' });
    else Object.assign(el.style, { left: dv.x + 'px', top: (dv.y + dv.h / 2 - hit / 2) + 'px', width: dv.w + 'px', height: hit + 'px' });
    keep.add(el);
  }
  for (const el of stage.querySelectorAll('.jk-div')) if (!keep.has(el)) el.remove();
}

/* ---------- a window ---------- */
function makeWin(id) {
  const el = h('section', { class: 'win', 'data-id': id });
  const typeBtn = h('button', { class: 'wtype', type: 'button', 'aria-haspopup': 'menu', title: t('Zmień, co pokazuje to okno'), onclick: e => typeMenu(id, e.currentTarget) });
  const ctx = h('div', { class: 'wctx' });
  const zv = h('button', { class: 'wzv', type: 'button', title: t('Powiększenie zawartości okna. Kliknij: 100%.'), onclick: () => setZoom(id, 1) });
  const zoomBox = h('span', { class: 'wzoom' }, ibtn('minus', t('Oddal zawartość okna'), () => zoomBy(id, -0.1)), zv, ibtn('plus', t('Przybliż zawartość okna'), () => zoomBy(id, 0.1)));
  const bFl = ibtn('float', t('Wyjmij: niech pływa nad resztą'), () => isFloat(id) ? dock(id) : floatWin(id), 'b-fl');
  const bMx = ibtn('max', t('Na cały ekran (Ctrl+Spacja)'), () => toggleMax(id), 'b-mx');
  const tools = h('div', { class: 'wtools' }, zoomBox,
    ibtn('splitRow', t('Podziel: nowe okno obok'), () => split(id, 'right'), 'b-sr'),
    ibtn('splitCol', t('Podziel: nowe okno pod spodem'), () => split(id, 'bottom'), 'b-sc'),
    bFl, bMx, ibtn('more', t('Więcej: menu okna'), e => winMenu(id, e.currentTarget), 'b-more'), ibtn('close', t('Zamknij okno'), () => closeW(id), 'b-x'));
  const back = h('button', { class: 'wback', type: 'button', title: t('Wróć do układu (Esc)'), onclick: () => toggleMax(id) }, icon('restore', 14), h('span', { text: t('Wróć do układu') }));
  const head = h('header', { class: 'whead' }, typeBtn, ctx, back, tools);
  const zoomer = h('div', { class: 'wz' });
  const body = h('div', { class: 'wbody' }, zoomer);
  el.append(head, body);
  for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const fh = h('div', { class: 'fh fh-' + d, 'aria-hidden': 'true' });
    fh.addEventListener('pointerdown', e => resizeDown(e, id, d));
    el.append(fh);
  }
  head.addEventListener('pointerdown', e => headDown(e, id));
  head.addEventListener('contextmenu', e => { if (e.target.closest('input, textarea, select')) return; e.preventDefault(); winMenu(id, null, { x: e.clientX, y: e.clientY }); });
  head.addEventListener('dblclick', e => { if (!phone && !e.target.closest('button, select, input, a, label')) toggleMax(id); });
  el.addEventListener('pointerdown', () => { focusWin(id); if (isFloat(id)) raiseFloat(id); }, true);
  el.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    const w = L.wins[id];
    if (!w || typeOf(w).noZoom) return; // the wall zooms its own view
    e.preventDefault();
    setZoom(id, w.z * Math.exp(-clamp(e.deltaY, -120, 120) * 0.0011), true);
  }, { passive: false });
  // two fingers over a window zoom its content, like Ctrl + wheel on the desk (the page itself never zooms: 05_MOBILE 01:03)
  let pin = null;
  const span = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) || 1;
  body.addEventListener('touchstart', e => {
    const w = L.wins[id];
    if (e.touches.length === 2 && w && !typeOf(w).noZoom) pin = { d0: span(e), z0: w.z || 1 };
  }, { passive: true });
  body.addEventListener('touchmove', e => {
    if (!pin || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    setZoom(id, pin.z0 * span(e) / pin.d0, true);
  }, { passive: false });
  const pinEnd = e => { if (pin && e.touches.length < 2) pin = null; };
  body.addEventListener('touchend', pinEnd, { passive: true });
  body.addEventListener('touchcancel', pinEnd, { passive: true });
  const ro = new ResizeObserver(() => { const rt = RT.get(id); if (!rt) return; clearTimeout(rt.timer); rt.timer = setTimeout(() => { if (RT.get(id) && L.wins[id] && rt.space === space.id) refreshWin(id); }, 120); });
  ro.observe(body);
  stage.insertBefore(el, dropEl);
  const rt = { id, el, head, typeBtn, ctx, tools, back, zoomer, body, ro, zv, bFl, bMx, key: null, view: null, timer: 0, space: space.id, busy: false, pending: false, disposers: [], onSel: null };
  RT.set(id, rt);
  return rt;
}
function dispose(rt) { const ds = rt.disposers.splice(0); for (const f of ds) { try { f(); } catch (err) { console.error(err); } } rt.onSel = null; }
function dropWin(id) { const rt = RT.get(id); if (!rt) return; dispose(rt); rt.ro.disconnect(); rt.el.remove(); RT.delete(id); }
function wantKey(id) {
  const w = L.wins[id], T = typeOf(w), rt = RT.get(id);
  const repo = T.follows ? (w.pin || store.sel) : null;
  let sz = '';
  if (T.sized) { const s0 = innerSize(rt, w); sz = Math.round(s0.w) + 'x' + Math.round(s0.h); }
  return JSON.stringify([w.type, repo, w.st, sz, T.stats ? L.stats : null, prefs.lang, T.zoomKey ? zEff(w) : 0, w.type === 'gra' ? gamesInWindow() : 0]);
}
function refreshWin(id) {
  const rt = RT.get(id), w = L.wins[id];
  if (!rt || !w) return;
  updateHead(id);
  if (rt.el.hidden || !rt.body.clientWidth) return; // drawn when it becomes visible
  if (rt.busy) { rt.pending = true; return; }       // never rebuilt under Jozz's hand
  const k = wantKey(id);
  if (k !== rt.key) renderWin(id, k);
}
function setBusy(id, on) {
  const rt = RT.get(id);
  if (!rt) return;
  rt.busy = !!on;
  if (!on && rt.pending) { rt.pending = false; refreshWin(id); }
}
function ctxFor(id, size, repoName) {
  const w = L.wins[id], rt = RT.get(id);
  return {
    id, win: w, L, size, repo: repoName ? R[repoName] : null, z: zEff(w), phone,
    selName: () => store.sel,
    select: n => select(n, 'win'),
    save: () => { if (rt && L.wins[id] === w) rt.key = wantKey(id); persist(); },
    commit: (label, fn) => commit(label, fn),
    setType: t0 => setType(id, t0),
    pickProject: n => pickProject(id, n),
    setStats: patch => setStats(patch),
    view: () => store.views[id] || null,
    setView: v => { store.views[id] = v; persist(); },
    busy: on => setBusy(id, on),
    onSel: fn => { if (rt) rt.onSel = fn; },
    onDispose: fn => { if (rt) rt.disposers.push(fn); },
    openType: (type, opts) => openWinOfType(type, opts),
    rerender: () => { if (rt) { rt.key = null; refreshWin(id); } },
  };
}
function renderWin(id, key) {
  const rt = RT.get(id), w = L.wins[id], T = typeOf(w);
  const repo = T.follows ? (w.pin || store.sel) : null;
  const same = rt.view && rt.view.type === w.type && rt.view.repo === repo;
  const scroll = same ? [rt.body.scrollTop, rt.body.scrollLeft] : [0, 0];
  B.untip();
  dispose(rt);
  rt.zoomer.replaceChildren();
  rt.zoomer.style.zoom = zEff(w);
  let after = null;
  try { after = T.render(rt.zoomer, ctxFor(id, innerSize(rt, w), repo)); }
  catch (err) { console.error(err); logEv(t('błąd okna {0}: {1}', w.type, err.message)); rt.zoomer.replaceChildren(h('p', { class: 'jk-err', text: t('To okno nie dało się narysować: {0}', err.message) })); }
  fixIds(rt.zoomer, id);
  rt.key = wantKey(id); // after drawing: a renderer may settle its own state (the wall places new cards once)
  void key;
  rt.view = { type: w.type, repo };
  rt.el.dataset.type = w.type;
  requestAnimationFrame(() => {
    try { after?.(); } catch (err) { console.error(err); }
    rt.body.scrollTop = scroll[0]; rt.body.scrollLeft = scroll[1];
  });
}
/* two windows of the same kind must not share element ids (labels would point at the wrong one) */
function fixIds(box, id) {
  const map = {};
  for (const el of box.querySelectorAll('[id]')) { if (el.closest('svg')) continue; const n = el.id + '--' + id; map[el.id] = n; el.id = n; }
  for (const el of box.querySelectorAll('[aria-labelledby]')) el.setAttribute('aria-labelledby', el.getAttribute('aria-labelledby').split(/\s+/).map(x => map[x] || x).join(' '));
  for (const el of box.querySelectorAll('label[for]')) { const f = el.getAttribute('for'); if (map[f]) el.setAttribute('for', map[f]); }
}
function updateHead(id) {
  const rt = RT.get(id), w = L.wins[id];
  if (!rt || !w) return;
  const T = typeOf(w);
  fill(rt.typeBtn, icon(T.glyph, 15), h('span', { class: 'tn', text: winTitle(id) }), icon('chev', 12, 'cv'));
  rt.typeBtn.title = w.title ? t('{0} — pokazuje: {1}. Kliknij, żeby zmienić.', w.title, t(T.name)) : t('Zmień, co pokazuje to okno');
  const kids = [];
  if (T.follows) {
    const n = w.pin || store.sel, r = R[n];
    kids.push(h('button', { class: 'jk-proj', type: 'button', title: w.pin ? t('To okno jest przypięte do tego projektu. Kliknij, żeby wybrać inny.') : t('Pokazuje zaznaczony projekt. Kliknij, żeby wybrać inny.'),
      onclick: e => openPicker(e.currentTarget, nm => pickProject(id, nm), n) }, r ? sigil(r, 18) : null, h('b', { text: r ? r.short : '—' }), icon('chev', 12)),
      h('button', { class: 'jk-pin' + (w.pin ? ' on' : ''), type: 'button', 'aria-pressed': String(!!w.pin),
        title: w.pin ? t('Przypięte: zaznaczanie innych projektów nie zmienia tego okna. Kliknij, żeby odpiąć.') : t('Przypnij: okno zostanie przy tym projekcie, gdy zaznaczysz inny'),
        onclick: () => togglePin(id) }, icon('pin', 13), h('span', { text: w.pin ? t('przypięte') : t('przypnij') })));
  }
  if (T.ctx && rt.body.clientWidth) kids.push(...[].concat(T.ctx(ctxFor(id, innerSize(rt, w), null))));
  fill(rt.ctx, kids);
  rt.zv.textContent = Math.round((T.noZoom ? 1 : w.z) * 100) + '%';
  rt.zv.disabled = !!T.noZoom;
  rt.el.classList.toggle('zoomed', !T.noZoom && Math.abs(w.z - 1) > 0.001);
  rt.el.classList.toggle('fill', !!T.fill);
  rt.el.classList.toggle('focused', L.focus === id);
  const fl = isFloat(id), mx = L.max === id;
  fill(rt.bFl, icon(fl ? 'dock' : 'float'));
  rt.bFl.title = fl ? t('Wstaw z powrotem do układu') : t('Wyjmij: niech pływa nad resztą');
  rt.bFl.setAttribute('aria-label', rt.bFl.title);
  fill(rt.bMx, icon(mx ? 'restore' : 'max'));
  rt.bMx.title = mx ? t('Wróć do układu (Esc)') : t('Na cały ekran (Ctrl+Spacja)');
  rt.bMx.setAttribute('aria-label', rt.bMx.title);
  rt.el.setAttribute('aria-label', t('Okno: {0}', winTitle(id)));
}

/* ---------- what you can do to a window ---------- */
function setType(id, type) {
  if (!TYPES[type] || !L.wins[id]) return;
  rememberType(type);
  commit(t('zmiana okna na {0}', t(TYPES[type].name)), () => {
    const w = L.wins[id];
    if (w.type === type) return false;
    w.type = type; w.st = {};
    if (type === 'notatki') w.st.note = noteNew();
    if (!TYPES[type].follows) w.pin = null;
  });
}
function rememberType(type) {
  const r = (Array.isArray(prefs.recent) ? prefs.recent : []).filter(x => x !== type && TYPES[x]);
  r.unshift(type);
  prefs.recent = r.slice(0, 6);
  savePrefs();
}
function split(id, side, type = 'wybor') {
  if (isFloat(id)) return splitFloat(id, side, type);
  const nid = newWinId();
  if (phone) side = 'bottom';
  if (commit(t('podział okna {0}', tname(id)), () => { if (!splitWin(L, id, side, nid, type)) return false; if (type === 'notatki') L.wins[nid].st.note = noteNew(); })) { focusWin(nid); if (phone) apply(); return nid; }
  return null;
}
/* dividing a floating window: the new window floats beside it (04_PC 00:50: "Pływające okno najpierw wstaw do układu" twice).
   Halves of a big float; a small one gets a twin next to it. */
function splitFloat(id, side, type) {
  const W = stage.clientWidth || 1600, Hh = stage.clientHeight || 900, nid = newWinId();
  const ok = commit(t('podział pływającego okna {0}', tname(id)), () => {
    const f = L.floats.find(x => x.id === id);
    if (!f) return false;
    L.wins[nid] = { type, z: 1, pin: null, st: {} };
    if (type === 'notatki') L.wins[nid].st.note = noteNew();
    let n;
    if (side === 'right') {
      if (f.w * W / 2 >= 260) { f.w /= 2; n = { x: f.x + f.w, y: f.y, w: f.w, h: f.h }; }
      else n = { x: Math.min(f.x + f.w, Math.max(0, 1 - f.w)), y: f.y, w: f.w, h: f.h };
    } else {
      if (f.h * Hh / 2 >= 150) { f.h /= 2; n = { x: f.x, y: f.y + f.h, w: f.w, h: f.h }; }
      else n = { x: f.x, y: Math.min(f.y + f.h, Math.max(0, 1 - f.h)), w: f.w, h: f.h };
    }
    L.floats.push({ id: nid, ...n, anchor: null });
  });
  if (!ok) return null;
  focusWin(nid);
  return nid;
}
/* after a session of splitting (04_PC: about 20 "Pusty" windows), the empty ones go in one step */
function emptyWins() { return allIds().filter(id => L.wins[id] && L.wins[id].type === 'wybor'); }
function closeEmpty() {
  const ids = emptyWins();
  if (!ids.length) { jtoast(t('Nie ma pustych okien.')); return; }
  let n = 0;
  if (commit(t('zamknięcie pustych okien'), () => { for (const id of ids) if (L.wins[id] && allIds().length > 1 && closeWin(L, id)) n++; return n ? undefined : false; }))
    jtoast(t('Zamknięte puste okna: {0}.', n), { label: t('Cofnij'), act: () => undo() });
}
function closeW(id) {
  const name = tname(id);
  if (commit(t('zamknięcie okna {0}', name), () => closeWin(L, id))) jtoast(t('Zamknięte: {0}.', name), { label: t('Cofnij'), act: () => undo() });
}
function floatWin(id) {
  if (phone) return;
  const rt = RT.get(id), W = stage.clientWidth, Hh = stage.clientHeight;
  if (leafIds(L.tree).length < 2) { jtoast(t('To jedyne okno w układzie: zostaje na miejscu.')); return; }
  const r = rt.rect || { x: W * 0.2, y: Hh * 0.15, w: W * 0.5, h: Hh * 0.5 };
  const w = clamp(r.w * 0.8, Math.min(380, W * 0.9), W * 0.7), hh = clamp(r.h * 0.8, Math.min(260, Hh * 0.9), Hh * 0.8);
  const x = clamp(r.x + (r.w - w) / 2 + 24, 0, W - w), y = clamp(r.y + (r.h - hh) / 2 + 24, 0, Hh - hh);
  commit(t('wyjęcie okna {0}', tname(id)), () => floatOut(L, id, { x: x / W, y: y / Hh, w: w / W, h: hh / Hh }));
}
function dock(id) { commit(t('wstawienie okna {0} do układu', tname(id)), () => dockBack(L, id)); }
function raiseFloat(id) {
  const i = L.floats.findIndex(f => f.id === id);
  if (i < 0 || i === L.floats.length - 1) return;
  L.floats.push(L.floats.splice(i, 1)[0]);
  apply(); persist();
}
function toggleMax(id) {
  if (!L.wins[id] || phone) return;
  L.max = L.max === id ? null : id;
  logEv(L.max ? t('na cały ekran: {0}', tname(id)) : t('powrót do układu z {0}', tname(id)));
  closeMenus(); apply();
  for (const x of allIds()) updateHead(x);
  persist();
  if (L.max) RT.get(id)?.back.focus({ preventScroll: true });
}
function focusWin(id) {
  if (L.focus === id) return;
  const prev = L.focus;
  L.focus = id;
  if (prev) RT.get(prev)?.el.classList.remove('focused');
  RT.get(id)?.el.classList.add('focused');
  persist();
}
function phoneSwitch(id) {
  if (!L.wins[id]) return;
  focusWin(id);
  apply();
  hideSheet();
}
function setZoom(id, z, quiet) {
  const w = L.wins[id];
  if (!w || typeOf(w).noZoom) return;
  z = Math.round(clamp(z, 0.5, 2.5) * 100) / 100;
  if (Math.abs(z - 1) < 0.03) z = 1;
  if (z === w.z) return;
  w.z = z;
  const rt = RT.get(id);
  rt.zoomer.style.zoom = zEff(w);
  updateHead(id);
  clearTimeout(rt.timer);
  rt.timer = setTimeout(() => refreshWin(id), quiet ? 160 : 0);
  persist();
}
const zoomBy = (id, d) => setZoom(id, (L.wins[id]?.z || 1) + d);
function togglePin(id) {
  const w = L.wins[id];
  if (!w) return;
  if (w.pin) commit(t('odpięcie okna {0}', tname(id)), () => { w.pin = null; });
  else commit(t('przypięcie okna {0} do {1}', tname(id), R[store.sel]?.short), () => { w.pin = store.sel; });
}
function pickProject(id, name) {
  const w = L.wins[id];
  if (!w || !R[name]) return;
  if (w.pin) commit(t('przypięcie okna {0} do {1}', tname(id), R[name].short), () => { w.pin = name; });
  else select(name, 'picker');
}
function setStats(patch) {
  Object.assign(statFilter(L), patch);
  persist();
  closeMenus();
  for (const id of allIds()) if (typeOf(L.wins[id]).stats) refreshWin(id);
}
function select(name, via) {
  if (!R[name]) return;
  const changed = store.sel !== name;
  if (changed) { store.sel = name; updateSelStyle(); renderSelBox(); persist(); logEv(t('zaznaczony: {0}', R[name].short)); }
  for (const id of allIds()) { refreshWin(id); RT.get(id)?.onSel?.(name); }
  if (changed && phone && via === 'win') showSelSheet(name);
}
function updateSelStyle() {
  const n = String(store.sel || '').replace(/["\\]/g, '');
  selStyle.textContent = n ? `.jk .krow[data-repo="${n}"] > .khead, .jk .spis-r[data-repo="${n}"], .jk .st-tbl tr[data-repo="${n}"] > td { background: var(--sel-bg); }
.jk .krow[data-repo="${n}"] > .khead, .jk .spis-r[data-repo="${n}"] { box-shadow: inset 3px 0 0 var(--sel); }
.jk .st-tbl tr[data-repo="${n}"] > td:first-child { box-shadow: inset 3px 0 0 var(--sel); }
.jk .parcel[data-repo="${n}"] rect.ring { stroke-width: 3.5; stroke: var(--sel); }
.jk .wc[data-repo="${n}"] > .wc-box { outline: 2px solid var(--sel); outline-offset: 3px; }` : '';
}
/* open (or reuse) a window of a kind: the phone switches to it, a desk gets a floating one */
function openWinOfType(type, opts = {}) {
  const ex = allIds().find(id => L.wins[id].type === type && (!opts.free || !L.wins[id].pin));
  if (ex && !opts.fresh) {
    if (opts.st) commit(t('okno {0}', tname(ex)), () => { Object.assign(L.wins[ex].st, opts.st); });
    focusWin(ex);
    if (phone) phoneSwitch(ex);
    else if (isFloat(ex)) { raiseFloat(ex); apply(); }
    else if (L.max && L.max !== ex) toggleMax(ex);
    RT.get(ex)?.el.classList.add('flash');
    setTimeout(() => RT.get(ex)?.el.classList.remove('flash'), 700);
    return ex;
  }
  const id = newWinId(), W = stage.clientWidth, Hh = stage.clientHeight;
  const fw = opts.w || 0.6, fh = opts.h || 0.78;
  commit(t('otwarcie okna {0}', t(TYPES[type].name)), () => {
    L.wins[id] = { type, z: 1, pin: opts.pin || null, st: { ...(opts.st || {}) } };
    if (type === 'notatki' && !L.wins[id].st.note) L.wins[id].st.note = noteNew();
    if (phone || !W) { const host = phoneCurrent() || leafIds(L.tree)[0]; L.tree = splitAt(L.tree, host, 'bottom', id, 0.5); }
    else L.floats.push({ id, x: (1 - fw) / 2, y: (1 - fh) / 2.4, w: fw, h: fh, anchor: null });
  });
  focusWin(id);
  if (phone) phoneSwitch(id);
  return id;
}

/* ---------- gestures: borders ---------- */
function divDown(e, el) {
  if (e.button !== 0) return;
  e.preventDefault();
  closeMenus();
  const before = clone(L), dv0 = el._dv;
  el.setPointerCapture(e.pointerId);
  root.classList.add('dragging', dv0.d === 'row' ? 'cur-ew' : 'cur-ns');
  el.classList.add('on');
  const sr = stageRect();
  const move = ev => {
    const dv = el._dv;
    const p = dv.d === 'row' ? ev.clientX - sr.left - dv.x0 : ev.clientY - sr.top - dv.y0;
    const r = shareAt(dv, p - GAP / 2);
    if (r !== dv.node.r) { dv.node.r = r; apply(); }
  };
  const done = (ev, cancel) => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    try { el.releasePointerCapture(ev.pointerId); } catch { /* gone */ }
    root.classList.remove('dragging', 'cur-ew', 'cur-ns'); el.classList.remove('on');
    drag = null;
    if (cancel) { replaceL(before); return; }
    if (JSON.stringify(before.tree) !== JSON.stringify(L.tree)) { pushUndo(t('zmiana proporcji okien'), before); persist(); }
  };
  const up = ev => done(ev, false);
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  drag = { cancel: () => done({ pointerId: e.pointerId }, true) };
}

/* ---------- gestures: carrying a window by its bar (on a phone: swiping to the next window) ---------- */
function headDown(e, id) {
  if (e.button !== 0) return;
  if (phone) { swipeDown(e, id); return; }
  if (L.max === id) return;
  // the bar's empty space and the window's name are both handles; a click on the name still opens its menu
  if (!e.target.closest('.wtype') && e.target.closest('button, select, input, a, textarea, label')) return;
  const rt = RT.get(id), fl = isFloat(id);
  const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
  const before = clone(L);
  let started = false, target = null, zone = null;
  const f = fl ? L.floats.find(x => x.id === id) : null, f0 = f ? { ...f } : null;
  let ghost = null;
  const W = () => stage.clientWidth, Hh = () => stage.clientHeight;
  const begin = () => {
    started = true;
    closeMenus();
    try { rt.head.setPointerCapture(pid); } catch { /* fine */ }
    root.classList.add('dragging');
    if (!fl) {
      rt.el.classList.add('lifted');
      const T = typeOf(L.wins[id]);
      ghost = h('div', { class: 'jk-ghost' }, icon(T.glyph, 15), h('b', { text: winTitle(id) }), h('span', { text: t('upuść przy krawędzi innego okna albo na jego środku') }));
      document.body.append(ghost);
    }
  };
  const showZone = ev => {
    const sr = stageRect(), px = ev.clientX - sr.left, py = ev.clientY - sr.top;
    target = null; zone = null;
    if (!fl) {
      for (const [wid, r] of Object.entries(rects.wins)) {
        if (wid === id) continue;
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) { target = wid; break; }
      }
      const z = dropZone(target ? rects.wins[target] : { x: 0, y: 0, w: 1, h: 1 }, px, py, W(), Hh());
      if (z.startsWith('root-') || target) zone = z;
      if (zone && !zone.startsWith('root-') && !target) zone = null;
      showDrop(zone ? zoneRect(target ? rects.wins[target] : null, zone, W(), Hh()) : null, zone);
      ghost.style.left = Math.min(ev.clientX + 14, innerWidth - ghost.offsetWidth - 8) + 'px';
      ghost.style.top = Math.min(ev.clientY + 14, innerHeight - ghost.offsetHeight - 8) + 'px';
    } else {
      // a floating window docks only on the five squares that appear over the window beneath it
      for (const [wid, r] of Object.entries(rects.wins)) if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) { target = wid; break; }
      if (target) {
        const r = rects.wins[target], cx = r.x + r.w / 2, cy = r.y + r.h / 2, cell = 38, gap = 4;
        compassEl.hidden = false;
        compassEl.style.left = (cx - cell * 1.5 - gap) + 'px'; compassEl.style.top = (cy - cell * 1.5 - gap) + 'px';
        const dx = px - cx, dy = py - cy, half = cell / 2;
        const inCell = (ox, oy) => Math.abs(dx - ox) <= half && Math.abs(dy - oy) <= half;
        const step = cell + gap;
        zone = inCell(0, 0) ? 'center' : inCell(-step, 0) ? 'left' : inCell(step, 0) ? 'right' : inCell(0, -step) ? 'top' : inCell(0, step) ? 'bottom' : null;
        for (const i of compassEl.children) i.classList.toggle('on', i.dataset.z === zone);
        showDrop(zone ? zoneRect(r, zone) : null, zone);
      } else { compassEl.hidden = true; showDrop(null); }
    }
  };
  const move = ev => {
    if (ev.pointerId !== pid) return;
    pointer.x = ev.clientX; pointer.y = ev.clientY;
    if (!started) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; begin(); }
    if (fl) {
      f.x = clamp(f0.x + (ev.clientX - sx) / W(), 0, 1 - 90 / W());
      f.y = clamp(f0.y + (ev.clientY - sy) / Hh(), 0, 1 - 40 / Hh());
      apply();
    }
    showZone(ev);
  };
  const finish = (ev, cancel) => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    try { rt.head.releasePointerCapture(pid); } catch { /* gone */ }
    root.classList.remove('dragging'); rt.el.classList.remove('lifted');
    ghost?.remove(); showDrop(null); compassEl.hidden = true;
    drag = null;
    if (!started) return;
    swallowClick();
    if (cancel) { replaceL(before); return; }
    if (fl) {
      // the undo step goes back to where the float was before this drag
      if (target && zone && dockFloat(L, id, target, zone)) { pushUndo(t('wstawienie okna {0} do układu', tname(id)), before); afterChange(); }
      else if (f.x !== f0.x || f.y !== f0.y) { pushUndo(t('przesunięcie pływającego okna {0}', tname(id)), before); persist(); }
    } else if (zone) {
      const label = zone === 'center' ? t('zamiana miejscami: {0} i {1}', tname(id), tname(target)) : t('przeniesienie okna {0}', tname(id));
      commit(label, () => moveTiled(L, id, target, zone));
    }
  };
  const up = ev => { if (ev.pointerId === pid) finish(ev, false); };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  drag = { cancel: () => finish(null, true) };
}
/* a drag that ended on a button must not also click it */
function swallowClick() {
  const swallow = ce => { ce.stopPropagation(); ce.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, true), 0);
}
function swipeDown(e, id) {
  if (e.target.closest('input, select, textarea')) return;
  const sx = e.clientX, sy = e.clientY, pid = e.pointerId, rt = RT.get(id);
  let dx = 0, moved = false;
  const move = ev => {
    if (ev.pointerId !== pid) return;
    dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!moved && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) moved = true;
    if (moved) rt.el.style.transform = `translateX(${dx * 0.35}px)`;
  };
  const up = ev => {
    if (ev.pointerId !== pid) return;
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    rt.el.style.transform = '';
    if (!moved) return;
    swallowClick();
    const ids = allIds(), i = ids.indexOf(id);
    if (Math.abs(dx) > 60 && ids.length > 1) phoneSwitch(ids[(i + (dx < 0 ? 1 : -1) + ids.length) % ids.length]);
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}
function showDrop(r, zone) {
  if (!r) { dropEl.hidden = true; return; }
  dropEl.hidden = false;
  Object.assign(dropEl.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  const tx = { center: 'zamień miejscami', left: 'wstaw z lewej', right: 'wstaw z prawej', top: 'wstaw u góry', bottom: 'wstaw na dole',
    'root-left': 'wstaw wzdłuż całej lewej krawędzi', 'root-right': 'wstaw wzdłuż całej prawej krawędzi', 'root-top': 'wstaw wzdłuż całej górnej krawędzi', 'root-bottom': 'wstaw wzdłuż całej dolnej krawędzi' }[zone] || '';
  dropEl.firstChild.textContent = t(tx);
  dropEl.classList.toggle('swap', zone === 'center');
}

/* ---------- gestures: stretching a floating window from any edge ---------- */
function resizeDown(e, id, dir) {
  if (e.button !== 0 || !isFloat(id) || L.max === id || phone) return;
  e.preventDefault(); e.stopPropagation();
  const f = L.floats.find(x => x.id === id), W = stage.clientWidth, Hh = stage.clientHeight;
  const before = clone(L), p0 = floatPx(f, W, Hh), sx = e.clientX, sy = e.clientY, el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  root.classList.add('dragging');
  const MINW = Math.min(260, W), MINH = Math.min(150, Hh);
  const move = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    let { x, y, w, h: hh } = p0;
    if (dir.includes('e')) w = clamp(p0.w + dx, MINW, W - p0.x);
    if (dir.includes('s')) hh = clamp(p0.h + dy, MINH, Hh - p0.y);
    if (dir.includes('w')) { const nx = clamp(p0.x + dx, 0, p0.x + p0.w - MINW); w = p0.w + (p0.x - nx); x = nx; }
    if (dir.includes('n')) { const ny = clamp(p0.y + dy, 0, p0.y + p0.h - MINH); hh = p0.h + (p0.y - ny); y = ny; }
    Object.assign(f, { x: x / W, y: y / Hh, w: w / W, h: hh / Hh });
    apply();
  };
  const done = (ev, cancel) => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    try { el.releasePointerCapture(ev.pointerId); } catch { /* gone */ }
    root.classList.remove('dragging');
    drag = null;
    if (cancel) { replaceL(before); return; }
    if (JSON.stringify(before.floats) !== JSON.stringify(L.floats)) { pushUndo(t('zmiana rozmiaru pływającego okna {0}', tname(id)), before); persist(); }
  };
  const up = ev => done(ev, false);
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  drag = { cancel: () => done({ pointerId: e.pointerId }, true) };
}

/* ---------- menus and pop-ups ---------- */
let openPop = null;
/* On a phone, Back closes the sheet on top instead of leaving Jaskinia (05_MOBILE 02:45: Back took Jozz out of Jaskinia
   while a sheet was open). One history entry of our own stands under the sheets. It is pushed when the first sheet opens and is never
   taken back by code (a history.back() racing a new sheet once walked out of the page): after a sheet closes by a tap, the
   entry simply stays, so the next sheet reuses it, and a Back with nothing open only steps off it. */
const backGuard = { on: (() => { try { return !!(history.state && history.state.jkSheet); } catch { return false; } })() };
function guardBack() {
  if (backGuard.on) return;
  try { history.pushState({ jkSheet: 1 }, ''); backGuard.on = true; } catch { /* a host that forbids history: Back stays the browser's */ }
}
addEventListener('popstate', e => {
  backGuard.on = !!(e.state && e.state.jkSheet);
  if (openPop) openPop.close(true);
});
function showPopover(el, anchor, at, opts = {}) {
  closeMenus();
  const asSheet = phone && opts.sheet !== false;
  if (asSheet) { el.classList.add('sheet'); guardBack(); }
  document.body.append(el);
  if (!asSheet) {
    const r = at ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : anchor.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x = r.left, y = r.bottom + 4;
    if (x + w > innerWidth - 8) x = Math.max(8, r.right - w);
    if (y + hh > innerHeight - 8) y = Math.max(8, r.top - hh - 4);
    if (y + hh > innerHeight - 8) y = Math.max(8, innerHeight - 8 - hh);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  const scrim = asSheet ? h('div', { class: 'jk-scrim', onclick: () => close() }) : null;
  if (scrim) document.body.insertBefore(scrim, el);
  // the scrim closes a sheet on its own click, so the tap never reaches what lies beneath it
  const outside = ev => { if (scrim && ev.target === scrim) return; if (!el.contains(ev.target) && !(anchor && anchor.contains(ev.target))) close(); };
  const onKey = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); anchor?.focus?.(); } };
  const close = () => {
    el.remove(); scrim?.remove();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', onKey, true);
    if (openPop && openPop.el === el) openPop = null;
  };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  document.addEventListener('keydown', onKey, true);
  openPop = { el, close };
  return close;
}
function closeMenus() { if (openPop) openPop.close(); }
function openMenu(anchor, items, at, cls = '', opts = {}) {
  const el = h('div', { class: 'jk-menu ' + cls, role: 'menu' });
  const head0 = items.find(it => it && it.head);
  logEv(t('menu: {0}', head0 ? head0.head : (items.find(it => it && it.label)?.label || '…')));
  const btns = [];
  let close = null;
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { el.append(h('div', { class: 'mi-sep', role: 'separator' })); continue; }
    if (it.head) { el.append(h('div', { class: 'mi-head', text: it.head })); continue; }
    if (it.note) { el.append(h('p', { class: 'mi-note', text: it.note })); continue; }
    const b = h('button', { class: 'mi' + (it.checked ? ' on' : '') + (it.danger ? ' danger' : '') + (it.sub ? ' has-sub' : ''), type: 'button', disabled: !!it.disabled,
      role: it.checked != null ? 'menuitemradio' : 'menuitem', 'aria-checked': it.checked != null ? String(!!it.checked) : null,
      onclick: () => { if (it.sub) { it.sub(b); return; } logEv(t('wybrane: {0}', it.label)); close(); it.act?.(); } },
      h('span', { class: 'mi-i' }, it.icon ? icon(it.icon, 15) : it.checked ? icon('check', 15) : null),
      h('span', { class: 'mi-l' }, h('span', { text: it.label }), it.desc ? h('small', { text: it.desc }) : null),
      it.hint ? h('kbd', { class: 'mi-h', text: it.hint }) : it.sub ? icon('arrowR', 13, 'mi-sub') : null);
    btns.push(b); el.append(b);
  }
  el.addEventListener('keydown', e => {
    const i = btns.indexOf(document.activeElement);
    const nav = d => { let j = i; for (let k = 0; k < btns.length; k++) { j = (j + d + btns.length) % btns.length; if (!btns[j].disabled) { btns[j].focus(); break; } } };
    if (e.key === 'ArrowDown') { e.preventDefault(); nav(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); nav(-1); }
    else if (e.key === 'Home') { e.preventDefault(); (btns.find(b => !b.disabled))?.focus(); }
  });
  close = showPopover(el, anchor, at, opts);
  if (!coarse.matches) (btns.find(b => b.classList.contains('on') && !b.disabled) || btns.find(b => !b.disabled))?.focus({ preventScroll: true });
  return close;
}
/* a question with two answers, built into the page (the artifact viewer has no confirm()) */
function askPop(anchor, { title, text, ok, okClass = 'danger', cancel = t('Zostaw') }, onOk) {
  let close = null;
  const el = h('div', { class: 'jk-menu jk-confirm', role: 'alertdialog', 'aria-label': title || text },
    title ? h('h3', { text: title }) : null,
    h('p', null, ...[].concat(text)),
    h('div', { class: 'jk-row' },
      h('button', { class: 'btn ' + okClass, type: 'button', text: ok, onclick: () => { close(); onOk(); } }),
      h('button', { class: 'btn ghost', type: 'button', text: cancel, onclick: () => close() })));
  close = showPopover(el, anchor);
  el.querySelector('.btn.ghost').focus();
  return close;
}
function typeItems(cur, act) {
  const items = [];
  for (const [g, label] of GROUPS) {
    items.push({ head: t(label) });
    for (const T of Object.values(TYPES).filter(x => x.group === g)) items.push({ label: t(T.name), desc: t(T.desc), icon: T.glyph, checked: cur === T.key, act: () => act(T.key) });
  }
  return items;
}
function typeMenu(id, anchor) {
  const w = L.wins[id];
  if (!w) return;
  openMenu(anchor, typeItems(w.type, k => setType(id, k)), null, 'types');
}
function winMenu(id, anchor, at) {
  const w = L.wins[id];
  if (!w) return;
  const T = typeOf(w), fl = isFloat(id), mx = L.max === id;
  openMenu(anchor, [
    { head: t('Okno: {0}', winTitle(id)) },
    { label: t('Zmień, co pokazuje…'), icon: T.glyph, act: () => typeMenu(id, RT.get(id).typeBtn) },
    { label: t('Zmień nazwę okna…'), icon: 'pencil', hint: 'F2', act: () => renameWin(id) },
    w.title ? { label: t('Przywróć nazwę „{0}”', t(T.name)), icon: 'reset', act: () => commit(t('nazwa okna'), () => { delete w.title; }) } : null,
    { sep: true },
    !phone ? { label: t('Podziel: nowe okno obok'), icon: 'splitRow', act: () => split(id, 'right') } : null,
    { label: phone ? t('Dodaj okno pod tym') : t('Podziel: nowe okno pod spodem'), icon: 'splitCol', act: () => split(id, 'bottom') },
    !phone ? { label: mx ? t('Wróć do układu') : t('Na cały ekran'), icon: mx ? 'restore' : 'max', hint: mx ? 'Esc' : 'Ctrl+Spacja', act: () => toggleMax(id) } : null,
    !phone ? (fl ? { label: t('Wstaw z powrotem do układu'), icon: 'dock', act: () => dock(id) }
      : { label: t('Wyjmij: niech pływa nad resztą'), icon: 'float', disabled: leafIds(L.tree).length < 2, act: () => floatWin(id) }) : null,
    T.follows ? { label: w.pin ? t('Odepnij od {0}', R[w.pin]?.short) : t('Przypnij do {0}', R[store.sel]?.short), icon: 'pin', act: () => togglePin(id) } : null,
    w.type === 'sciana' ? { sep: true } : null,
    w.type === 'sciana' ? { label: t('Pokaż wszystko'), icon: 'fit', hint: '0', act: () => WALLS.get(id)?.fit() } : null,
    w.type === 'sciana' ? { label: t('Nowa notatka'), icon: 'note', act: () => WALLS.get(id)?.addNote() } : null,
    w.type === 'sciana' ? { label: t('Ułóż…'), icon: 'grid4', sub: b => arrangeMenu(b, ctxFor(id, innerSize(RT.get(id), w), null)) } : null,
    w.type === 'sciana' ? { label: t('Widok ściany…'), icon: 'eye', sub: b => wallViewMenu(b, ctxFor(id, innerSize(RT.get(id), w), null)) } : null,
    { sep: true },
    !T.noZoom ? { label: t('Przybliż zawartość'), icon: 'plus', hint: phone ? t('dwa palce') : 'Ctrl+kółko', act: () => zoomBy(id, 0.1) } : null,
    !T.noZoom ? { label: t('Oddal zawartość'), icon: 'minus', act: () => zoomBy(id, -0.1) } : null,
    !T.noZoom ? { label: t('Powiększenie 100%'), icon: 'reset', disabled: w.z === 1, act: () => setZoom(id, 1) } : null,
    { sep: true },
    { label: t('Zamknij okno'), icon: 'close', danger: true, act: () => closeW(id) },
  ], at);
}
function renameWin(id) {
  const rt = RT.get(id), w = L.wins[id];
  if (!rt || !w) return;
  closeMenus();
  const inp = h('input', { class: 'jk-win-in', value: w.title || '', placeholder: t(typeOf(w).name), 'aria-label': t('Nazwa okna'), maxlength: 60 });
  let done = false;
  const end = ok => {
    if (done) return; done = true;
    const v = inp.value.trim();
    inp.remove(); rt.typeBtn.hidden = false;
    if (ok && v !== (w.title || '')) commit(t('nazwa okna'), () => { if (v) w.title = v; else delete w.title; });
    else updateHead(id);
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); end(true); } else if (e.key === 'Escape') { e.preventDefault(); end(false); } });
  inp.addEventListener('blur', () => end(true));
  rt.typeBtn.hidden = true;
  rt.typeBtn.after(inp);
  inp.focus(); inp.select();
}
function openPicker(anchor, onPick, current) {
  const input = h('input', { type: 'search', class: 'jk-in', placeholder: t('Szukaj projektu…'), 'aria-label': t('Szukaj projektu'), autocomplete: 'off' });
  const list = h('div', { class: 'pk-list', role: 'listbox' });
  const el = h('div', { class: 'jk-menu jk-picker', role: 'dialog', 'aria-label': t('Wybierz projekt') }, input, list);
  let items = [], idx = 0, close = null;
  const pick = r => { close(); onPick(r.name); };
  const hl = () => items.forEach((it, i) => it.el.classList.toggle('kb', i === idx));
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    list.replaceChildren(); items = [];
    for (const f of D.families) {
      const rs = f.repos.map(n => R[n]).filter(r => !q || `${r.name} ${r.short} ${f.name}`.toLowerCase().includes(q)).sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
      if (!rs.length) continue;
      list.append(h('div', { class: 'pk-g', text: f.name }));
      for (const r of rs) {
        const b = h('button', { class: 'pk-i' + (r.name === current ? ' cur' : ''), type: 'button', role: 'option', 'aria-selected': String(r.name === current), onclick: () => pick(r) },
          sigil(r, 22), h('span', { class: 'nm', text: r.short }), B.lifeBadge(r.life), h('span', { class: 'ago', text: r.last_ts ? ago(r.last_ts) : t('puste') }));
        items.push({ el: b, r });
        list.append(b);
      }
    }
    if (!items.length) list.append(h('p', { class: 'jk-empty', text: t('Nic nie pasuje.') }));
    idx = Math.max(0, items.findIndex(it => it.r.name === current));
    if (q) idx = 0;
    hl();
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); hl(); items[idx]?.el.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); hl(); items[idx]?.el.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[idx]) pick(items[idx].r); }
  });
  draw();
  close = showPopover(el, anchor);
  if (!coarse.matches) input.focus();
  items[idx]?.el.scrollIntoView({ block: 'nearest' });
}
function renderSelBox() {
  const r = R[store.sel];
  fill(selBox,
    h('button', { class: 'jk-selb', type: 'button', title: t('Zaznaczony projekt. Okna z jednym projektem pokazują właśnie jego. Kliknij, żeby wybrać inny.'),
      onclick: e => openPicker(e.currentTarget, n => select(n, 'picker'), store.sel) },
    r ? sigil(r, 22) : null, h('span', { class: 'sl' }, h('small', { text: t('zaznaczony') }), h('b', { text: r ? r.short : '—' })), icon('chev', 12)),
    r && r.pages && r.life !== 'zakończone' ? B.playA(r, { class: 'btn hot mini jk-selplay', title: t('Zagraj: {0}', r.short) }, B.playIcon(), t('Zagraj')) : null);
}

/* ---------- the phone: a dock of this workspace's windows, a sheet after picking a project ---------- */
function renderDock() {
  if (!dockEl) return;
  dockEl.hidden = !phone;
  fill(spaceBtn, h('span', { class: 'sn', text: space ? spaceName(space) : '' }), icon('chev', 12));
  if (!phone) return;
  const ids = allIds(), cur = phoneCurrent();
  fill(dockEl,
    h('div', { class: 'dk-list', role: 'tablist' }, ids.map(id => {
      const b = h('button', { class: 'dk-i' + (id === cur ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(id === cur), onclick: () => phoneSwitch(id) },
        icon(typeOf(L.wins[id]).glyph, 18), h('span', { text: winTitle(id) }));
      b.addEventListener('contextmenu', e => { e.preventDefault(); winMenu(id, b); });
      return b;
    })),
    h('button', { class: 'dk-add', type: 'button', title: t('Dodaj okno'), 'aria-label': t('Dodaj okno'), onclick: e => openMenu(e.currentTarget, [{ head: t('Nowe okno pokaże…') }, ...typeItems(null, k => { const nid = split(phoneCurrent(), 'bottom', k); if (nid) rememberType(k); })], null, 'types') }, icon('plus', 18)));
  requestAnimationFrame(() => dockEl.querySelector('.dk-i.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
}
let sheetT = 0;
function showSelSheet(name) {
  const r = R[name], cur = L.wins[phoneCurrent()];
  if (!r || (cur && typeOf(cur).follows && !cur.pin)) return; // the window on screen already follows the selection
  clearTimeout(sheetT);
  fill(sheetEl, sigil(r, 34), h('div', { class: 'sh-t' }, h('b', { text: r.short }), h('span', null, B.lifeBadge(r.life), ' ', r.last_ts ? ago(r.last_ts) : t('bez commitów'))),
    h('button', { class: 'btn mini', type: 'button', onclick: () => { hideSheet(); openWinOfType('karta', { free: true }); } }, icon('t_karta', 14), t('Karta')),
    r.pages && r.life !== 'zakończone' ? B.playA(r, { class: 'btn hot mini' }, B.playIcon(), t('Zagraj')) : null,
    ibtn('close', t('Zamknij'), () => hideSheet()));
  sheetEl.hidden = false;
  sheetT = setTimeout(hideSheet, 7000);
}
function hideSheet() { clearTimeout(sheetT); if (sheetEl) sheetEl.hidden = true; }

/* ---------- toasts that can take a step back ---------- */
function jtoast(msg, action, ms) {
  logEv(t('komunikat: {0}', msg));
  const el = h('div', { class: 'jk-toast', role: 'status' }, h('span', { text: msg }),
    action ? h('button', { class: 'jk-toast-b', type: 'button', text: action.label, onclick: () => { el.remove(); action.act(); } }) : null);
  toastBox.append(el);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  setTimeout(() => el.remove(), ms || (action ? 7000 : 2800));
}

/* ---------- the main menu (the brand) ---------- */
function mainMenu(anchor) {
  const nTrash = store.trash.filter(x => x.kind !== 'broken').length + orphanNotes().length;
  openMenu(anchor, [
    { head: 'Jaskinia' },
    { label: t('Ustawienia'), desc: t('wygląd, motywy, język, zachowanie'), icon: 'gear', hint: 'Ctrl+,', act: () => openSettings('wyglad') },
    { sep: true },
    { label: t('Zapisz ten układ'), desc: t('zapamiętaj „{0}” w obecnym kształcie', spaceName(space)), icon: 'save', hint: 'Ctrl+S', act: () => saveCurrent() },
    { label: t('Zapisane układy i kopie…'), icon: 'archive', act: () => openSettings('uklady') },
    { label: nTrash ? t('Kosz ({0})', nTrash) : t('Kosz'), desc: t('usunięte układy i notatki bez okna'), icon: 'trash', act: () => openSettings('kosz') },
    { label: t('Eksport i import…'), desc: t('przenieś Jaskinię na inne urządzenie'), icon: 'download', act: () => openSettings('dane') },
    { sep: true },
    { label: t('To mnie uwiera…'), desc: t('uwaga przypięta do tej chwili'), icon: 'flag', hint: 'Ctrl+.', act: () => uwagaPop(anchor) },
    { label: t('Uwagi i paczka dla Claude\'a…'), desc: uwagi.length ? tn(uwagi.length, 'uwaga', 'uwagi', 'uwag') : t('dziennik, wersja, urządzenie'), icon: 'archive', act: () => openSettings('uwagi') },
    { sep: true },
    { label: t('Zresetuj całą Jaskinię…'), desc: t('układy startowe; najpierw zrobię kopię'), icon: 'reset', act: () => askReset(anchor) },
    { sep: true },
    { label: t('Jak to działa'), icon: 'help', act: () => openHelp(anchor) },
    { label: t('O danych: zrzut z {0}', dshort(new Date(SNAP * 1000))), icon: 'info', act: () => snapInfo(anchor) },
  ]);
}
function snapInfo(anchor) {
  const C = D.estate.coverage, age = snapAgeDays();
  const el = h('div', { class: 'jk-menu jk-helpbox', role: 'dialog', 'aria-label': t('O danych') },
    h('h3', { text: t('Skąd są dane') }),
    h('p', { class: 'hb-ver' }, h('b', { text: 'Jaskinia ' + VER }), ' · ' + t('zbudowana {0}', builtShort()) + ' · ' + t('działa jako: {0}', t(PLACE_NAME[PLACE]))),
    h('p', null, t('Zrzut repozytoriów z {0} ({1}). Pokrycie: {2} z {3} repo.', dshort(new Date(SNAP * 1000)), snapAgeText(), C.collected, C.expected)),
    h('p', null, t('Kolory życia pokazują stan w chwili zrzutu, nie dziś: stary zrzut nie udaje, że projekty umarły. Czego nie ma w zrzucie, tego Jaskinia nie wie: commity zrobione później tu nie istnieją, a na Pulsie dni po zrzucie są zakreskowane.')),
    age > 7 ? h('p', { class: 'warn', text: t('Zrzut ma ponad tydzień. Poproś Claude o odświeżenie (regen), żeby zobaczyć nowe commity.') }) : null);
  showPopover(el, anchor);
}
function askReset(anchor) {
  askPop(anchor, { title: t('Zresetować całą Jaskinię?'), text: t('Wszystkie zakładki wrócą do pięciu układów startowych. Najpierw zapiszę kopię obecnej Jaskini (Ustawienia → Kopie), więc to da się odwrócić. Notatki, zapisane układy i kosz zostają.'), ok: t('Zresetuj'), okClass: 'warn' }, () => resetAll());
}
function resetAll() {
  const b = makeBackup('przed resetem');
  const f = freshStore();
  store.spaces = f.spaces; store.cur = f.cur;
  rebuildAll();
  jtoast(t('Jaskinia ma znowu układy startowe.'), b ? { label: t('Cofnij'), act: () => restoreBackup(b.id, true) } : null);
}
/* everything on screen comes back from the store (after a reset, a restored copy, an import) */
function rebuildAll() {
  for (const id of [...RT.keys()]) dropWin(id);
  for (const k of Object.keys(hist)) delete hist[k];
  repair(store);
  persist();
  setSpace(store.cur);
  updateSelStyle(); renderSelBox();
}
function restoreBackup(id, quiet) {
  const b = readBackups().find(x => x.id === id);
  if (!b) { jtoast(t('Tej kopii już nie ma.')); return; }
  const before = makeBackup('przed przywróceniem kopii');
  const d = clone(b.data);
  store.spaces = arr(d.spaces); store.cur = d.cur; store.sel = d.sel;
  for (const [k, n] of Object.entries(obj(d.notes))) if (!store.notes[k] || (n.upd || 0) > (store.notes[k].upd || 0)) store.notes[k] = n;
  Object.assign(store.views, obj(d.views));
  rebuildAll();
  if (!quiet) jtoast(t('Przywrócona kopia z {0}.', dshort(new Date(b.at))), before ? { label: t('Cofnij'), act: () => restoreBackup(before.id, true) } : null);
}
function saveCurrent(name) {
  const it = saveSpaceState(space, name);
  jtoast(t('Zapisany układ „{0}” ({1}).', it.name, dshort(new Date(it.at))), { label: t('Pokaż'), act: () => openSettings('uklady') });
}
function openSettings(sec) {
  return openWinOfType('ustawienia', { st: { sec }, w: 0.62, h: 0.84 });
}
function openHelp(anchor) {
  const li = (k, tx) => h('li', null, h('b', { text: k }), ' ', tx);
  const el = h('div', { class: 'jk-menu jk-helpbox', role: 'dialog', 'aria-label': t('Jak to działa') },
    h('h3', { text: t('Jak tu pracować') }),
    phone ? h('ul', null,
      li(t('Na dole:'), t('okna tego układu. Dotknij, żeby przejść; przesuń palcem po pasku okna w bok, żeby przejść do następnego.')),
      li(t('Plus na dole:'), t('nowe okno w tym układzie.')),
      li(t('Nazwa u góry:'), t('Twoje układy: przełącz albo zrób nowy.')),
      li(t('Nazwa okna:'), t('co okno pokazuje. Trzy kropki: reszta (przypnij, zmień nazwę, zamknij).')),
      li(t('Ściana:'), t('przytrzymaj kartę, żeby ją przenieść; dwa palce przybliżają.')))
      : h('ul', null,
        li(t('Szczelina między oknami:'), t('przeciągnij, żeby zmienić proporcje. Dwuklik wyrównuje.')),
        li(t('Pasek okna:'), t('złap i upuść na innym oknie. Przy jego krawędzi okno wstawi się obok, na środku zamienią się miejscami. Przy krawędzi całego ekranu wstawi się wzdłuż niej.')),
        li(t('Nazwa okna'), t('(np. „Mapa działek ▾”): wybierasz, co okno pokazuje. F2 albo menu okna: własna nazwa.')),
        li(t('Przyciski na pasku:'), t('podziel obok, podziel pod spodem, wyjmij (okno pływa), na cały ekran, menu, zamknij. Prawy klik na pasku otwiera to samo menu.')),
        li(t('Dwuklik na pasku albo Ctrl+Spacja:'), t('okno na cały ekran i z powrotem do układu. Esc też wraca.')),
        li(t('Ctrl + kółko myszy nad oknem:'), t('przybliża tylko to okno. Klik na procentach wraca do 100%.')),
        li(t('Zakładki u góry'), t('to Twoje układy. Dwuklik zmienia nazwę, prawy klik: zapisz, przywróć, powiel, usuń (do kosza). Przestawiasz je przeciągając.')),
        li(t('Ściana:'), t('przeciągnij kartę, żeby ją przenieść; puste miejsce przesuwa widok; kółko przybliża; róg zaznaczonej karty zmienia jej rozmiar.')),
        li('Ctrl+Z / Ctrl+Shift+Z', t('cofa i ponawia zmiany układu. Notatek to nie cofa: one żyją osobno.')),
        li('Ctrl+S', t('zapisuje obecny układ pod nazwą i godziną (Menu Jaskini → Zapisane układy).'))),
    h('p', { class: 'hb-foot', text: t('Wszystko zapisuje się samo, w tej przeglądarce. Co kilka godzin i przed każdym ryzykownym krokiem Jaskinia robi kopię. Usunięte rzeczy trafiają do kosza.') }));
  showPopover(el, anchor);
}

/* ---------- workspaces ---------- */
function renderTabs() {
  fill(tabsEl, store.spaces.map(sp => {
    const b = h('button', { class: 'jk-tab' + (sp.id === store.cur ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(sp.id === store.cur), 'data-sp': sp.id,
      title: (sp.purpose ? sp.purpose + '\n' : '') + t('Układ „{0}”. Dwuklik: zmień nazwę. Prawy klik: więcej.', spaceName(sp)) }, h('span', { text: spaceName(sp) }));
    b.addEventListener('click', () => { if (tabJustMoved) return; if (sp.id !== store.cur) setSpace(sp.id); });
    b.addEventListener('dblclick', () => renameSpace(sp.id));
    b.addEventListener('contextmenu', e => { e.preventDefault(); spaceMenu(sp.id, b, { x: e.clientX, y: e.clientY }); });
    b.addEventListener('pointerdown', e => tabDown(e, sp.id, b));
    return b;
  }));
  requestAnimationFrame(() => { tabsEl.querySelector('.jk-tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); tabArrows(); });
  renderDock();
}
function tabArrows() {
  if (!tabsW) return;
  const over = tabsEl.scrollWidth > tabsEl.clientWidth + 2;
  tabsW.classList.toggle('over', over);
  tabsW.classList.toggle('at-start', tabsEl.scrollLeft < 4);
  tabsW.classList.toggle('at-end', tabsEl.scrollLeft + tabsEl.clientWidth > tabsEl.scrollWidth - 4);
}
function setSpace(id) {
  const sp = store.spaces.find(x => x.id === id) || store.spaces[0];
  closeMenus(); hideSheet();
  if (!space || space.id !== sp.id) logEv(t('układ: {0}', spaceName(sp)), { u: spaceName(sp) });
  store.cur = sp.id; space = sp; L = sp.L;
  renderTabs(); updateUndoUI();
  apply();
  for (const wid of allIds()) refreshWin(wid);
  persist();
}
function uniqueName(base) {
  let n = base, i = 2;
  while (store.spaces.some(sp => sp.name === n)) n = `${base} ${i++}`;
  return n;
}
function addSpace(name, layout, preset, after, purpose = '') {
  const id = uid('u');
  const sp = { id, name: uniqueName(name), preset: preset || null, purpose, L: layout };
  const i = after ? store.spaces.findIndex(x => x.id === after) : -1;
  if (i >= 0) store.spaces.splice(i + 1, 0, sp); else store.spaces.push(sp);
  setSpace(id);
  jtoast(t('Nowy układ: {0}', spaceName(sp)));
  return sp;
}
function newSpaceMenu(anchor) {
  const saved = store.saved.filter(x => x.kind === 'space').slice(0, 8);
  openMenu(anchor, [
    { head: t('Nowy układ') },
    { label: t('Pusty: jedno okno do wypełnienia'), icon: 't_wybor', act: () => addSpace(t('Mój układ'), presetLayout('pusty')) },
    { label: t('Kopia układu „{0}”', spaceName(space)), icon: 'copy', act: () => addSpace(spaceName(space) + ' ' + t('(kopia)'), remapLayout(L, new Set(), store.views), null, space.id, space.purpose) },
    { sep: true }, { head: t('Gotowe układy') },
    ...Object.entries(PRESETS).map(([k, n]) => ({ label: t(n), icon: PRESET_ICON[k], act: () => addSpace(t(n), presetLayout(k), k) })),
    saved.length ? { sep: true } : null, saved.length ? { head: t('Z zapisanych') } : null,
    ...saved.map(x => ({ label: x.name, desc: dshort(new Date(x.at)), icon: 'archive', act: () => openSaved(x.id) })),
  ]);
}
function allSpacesMenu(anchor) {
  openMenu(anchor, [
    { head: t('Twoje układy') },
    ...store.spaces.map(sp => ({ label: spaceName(sp), desc: sp.purpose || tn(leafIds(sp.L.tree).length + sp.L.floats.length, 'okno', 'okna', 'okien'), checked: sp.id === store.cur, act: () => setSpace(sp.id) })),
    { sep: true },
    { label: t('Nowy układ…'), icon: 'plus', act: () => newSpaceMenu(anchor) },
    emptyWins().length > 1 ? { label: t('Zamknij puste okna ({0})', emptyWins().length), icon: 'close', act: () => closeEmpty() } : null,
    { label: t('Ten układ: więcej…'), icon: 'more', act: () => spaceMenu(space.id, anchor) },
  ], null, 'spaces');
}
function spaceMenu(id, anchor, at) {
  const sp = store.spaces.find(x => x.id === id);
  if (!sp) return;
  const i = store.spaces.indexOf(sp);
  const mine = store.saved.filter(x => x.kind === 'space' && (x.from === sp.name || x.data.name === sp.name));
  openMenu(anchor, [
    { head: t('Układ: {0}', spaceName(sp)) },
    { label: t('Zmień nazwę'), icon: 'pencil', act: () => renameSpace(id) },
    { label: sp.purpose ? t('Po co ten układ: zmień…') : t('Po co ten układ…'), desc: sp.purpose || t('jedno zdanie, które przypomni Ci, do czego go zrobiłeś'), icon: 'info', act: () => purposeSpace(id, anchor) },
    { sep: true },
    { label: t('Zapisz ten układ'), icon: 'save', hint: id === store.cur ? 'Ctrl+S' : null, act: () => { const it = saveSpaceState(sp); jtoast(t('Zapisany układ „{0}” ({1}).', it.name, dshort(new Date(it.at))), { label: t('Pokaż'), act: () => openSettings('uklady') }); } },
    { label: t('Przywróć…'), icon: 'reset', sub: b => openMenu(b, [
      { head: t('Przywróć „{0}” do…', spaceName(sp)) },
      sp.preset && PRESETS[sp.preset] ? { label: t('Ustawienia startowego „{0}”', t(PRESETS[sp.preset])), icon: PRESET_ICON[sp.preset], act: () => resetSpace(id) } : null,
      ...mine.slice(0, 10).map(x => ({ label: x.name, desc: t('zapisany {0}', dshort(new Date(x.at))), icon: 'archive', act: () => loadSavedInto(x.id, id) })),
      !mine.length && !(sp.preset && PRESETS[sp.preset]) ? { note: t('Nie ma do czego wracać: ten układ nie ma ustawienia startowego ani zapisów. Zapisz go (Ctrl+S), a będzie.') } : null,
      { sep: true }, { label: t('Wszystkie zapisane…'), icon: 'archive', act: () => openSettings('uklady') },
    ]) },
    { label: t('Powiel'), icon: 'copy', act: () => addSpace(spaceName(sp) + ' ' + t('(kopia)'), remapLayout(sp.L, new Set(), store.views), null, id, sp.purpose) },
    id === store.cur ? { label: t('Zamknij puste okna'), desc: emptyWins().length ? tn(emptyWins().length, 'okno „Pusty”', 'okna „Pusty”', 'okien „Pusty”') : t('nie ma pustych'), icon: 'close', disabled: !emptyWins().length, act: () => closeEmpty() } : null,
    { label: t('Eksportuj ten układ…'), icon: 'download', act: () => openSettings('dane') },
    { sep: true },
    i > 0 ? { label: t('Przesuń w lewo'), icon: 'arrowL', act: () => moveSpace(id, -1) } : null,
    i < store.spaces.length - 1 ? { label: t('Przesuń w prawo'), icon: 'arrowR', act: () => moveSpace(id, 1) } : null,
    { sep: true },
    { label: t('Usuń układ (do kosza)'), icon: 'trash', danger: true, disabled: store.spaces.length < 2, act: () => deleteSpace(id) },
  ], at);
}
function moveSpace(id, d) {
  const i = store.spaces.findIndex(x => x.id === id), j = i + d;
  if (i < 0 || j < 0 || j >= store.spaces.length) return;
  const [sp] = store.spaces.splice(i, 1);
  store.spaces.splice(j, 0, sp);
  renderTabs(); persist();
}
function resetSpace(id) {
  if (id !== store.cur) setSpace(id);
  const nl = presetLayout(space.preset);
  const before = clone(L);
  space.L = L = nl;
  pushUndo(t('przywrócenie układu startowego'), before);
  afterChange();
  jtoast(t('Przywrócony układ startowy.'), { label: t('Cofnij'), act: () => undo() });
}
function loadSavedInto(savedId, spaceId) {
  const x = store.saved.find(s0 => s0.id === savedId);
  if (!x) return;
  if (spaceId !== store.cur) setSpace(spaceId);
  const nl = layoutFromSaved(x.data);
  if (!nl) { jtoast(t('Tego zapisu nie da się odczytać.')); return; }
  const before = clone(L);
  space.L = L = nl;
  pushUndo(t('wczytanie zapisu „{0}”', x.name), before);
  afterChange();
  jtoast(t('Wczytany zapis „{0}”.', x.name), { label: t('Cofnij'), act: () => undo() });
}
function openSaved(savedId) {
  const x = store.saved.find(s0 => s0.id === savedId);
  if (!x) return;
  if (x.kind === 'all') { restoreSavedAll(x); return; }
  const nl = layoutFromSaved(x.data);
  if (!nl) { jtoast(t('Tego zapisu nie da się odczytać.')); return; }
  addSpace(x.data.name || x.name, nl, x.data.preset, null, x.data.purpose || '');
}
function restoreSavedAll(x) {
  const before = makeBackup('przed wczytaniem zapisu');
  const d = clone(x.data);
  for (const [k, text] of Object.entries(obj(d.notes))) if (!store.notes[k]) store.notes[k] = { text: typeof text === 'string' ? text : text.text || '', upd: Date.now() };
  store.spaces = arr(d.spaces); store.cur = d.cur; if (R[d.sel]) store.sel = d.sel;
  Object.assign(store.views, obj(d.views));
  rebuildAll();
  jtoast(t('Wczytana cała Jaskinia z zapisu „{0}”.', x.name), before ? { label: t('Cofnij'), act: () => restoreBackup(before.id, true) } : null);
}
function renameSpace(id) {
  const sp = store.spaces.find(x => x.id === id);
  const tab = tabsEl.querySelector(`[data-sp="${id}"]`);
  if (!sp) return;
  if (!tab || phone) { promptPop(spaceBtn, t('Nazwa układu'), sp.name, v => { if (v && v !== sp.name) { sp.name = v.slice(0, 60); renderTabs(); persist(); } }); return; }
  closeMenus();
  const inp = h('input', { class: 'jk-tab-in', value: spaceName(sp), 'aria-label': t('Nazwa układu'), maxlength: 60 });
  let done = false;
  const end = ok => {
    if (done) return; done = true;
    const v = inp.value.trim();
    if (ok && v && v !== spaceName(sp)) { sp.name = v; persist(); }
    renderTabs();
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); end(true); } else if (e.key === 'Escape') { e.preventDefault(); end(false); } });
  inp.addEventListener('blur', () => end(true));
  tab.replaceWith(inp);
  inp.focus(); inp.select();
}
/* a small form in a pop-up: one line of text */
function promptPop(anchor, label, value, onOk, multi) {
  let close = null;
  const inp = h(multi ? 'textarea' : 'input', { class: 'jk-in', value: value || '', 'aria-label': label, maxlength: multi ? 400 : 60, rows: multi ? 3 : null });
  if (multi) inp.value = value || '';
  const ok = () => { close(); onOk(inp.value.trim()); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) { e.preventDefault(); ok(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
  const el = h('div', { class: 'jk-menu jk-confirm', role: 'dialog', 'aria-label': label }, h('label', { class: 'jk-lab', text: label }), inp,
    h('div', { class: 'jk-row' }, h('button', { class: 'btn', type: 'button', text: t('Zapisz'), onclick: ok }), h('button', { class: 'btn ghost', type: 'button', text: t('Anuluj'), onclick: () => close() })));
  close = showPopover(el, anchor);
  inp.focus(); inp.select?.();
}
function purposeSpace(id, anchor) {
  const sp = store.spaces.find(x => x.id === id);
  if (!sp) return;
  promptPop(anchor && anchor.isConnected ? anchor : (tabsEl.querySelector(`[data-sp="${id}"]`) || spaceBtn), t('Po co ten układ? (jedno zdanie dla siebie)'), sp.purpose || '', v => { sp.purpose = v; renderTabs(); persist(); }, true);
}
function deleteSpace(id) {
  const i = store.spaces.findIndex(x => x.id === id);
  if (i < 0 || store.spaces.length < 2) return;
  const [sp] = store.spaces.splice(i, 1);
  const tr = toTrash('space', sp.name, { sp, idx: i, views: viewsOf(sp.L) });
  for (const [wid, rt] of [...RT]) if (rt.space === sp.id) dropWin(wid);
  delete hist[sp.id];
  if (store.cur === id) setSpace(store.spaces[Math.max(0, i - 1)].id); else { renderTabs(); persist(); }
  jtoast(t('Układ „{0}” jest w koszu.', spaceName(sp)), { label: t('Przywróć'), act: () => restoreTrash(tr.id) });
}
function restoreTrash(trId) {
  const i = store.trash.findIndex(x => x.id === trId);
  if (i < 0) return false;
  const it = store.trash[i];
  if (it.kind === 'space') {
    const sp = clone(it.data.sp);
    const used = allWinIds();
    if (Object.keys(sp.L.wins).some(id => used.has(id))) sp.L = remapLayout(sp.L, new Set(), it.data.views);
    else Object.assign(store.views, obj(it.data.views));
    if (store.spaces.some(x => x.id === sp.id)) sp.id = uid('u');
    store.spaces.splice(clamp(it.data.idx ?? store.spaces.length, 0, store.spaces.length), 0, sp);
    store.trash.splice(i, 1);
    setSpace(sp.id);
    jtoast(t('Przywrócony układ „{0}”.', spaceName(sp)));
  } else if (it.kind === 'saved') {
    store.saved.unshift(it.data);
    store.trash.splice(i, 1);
    persist();
    jtoast(t('Przywrócony zapis „{0}”.', it.name));
  } else if (it.kind === 'wallnote') {
    const host = store.spaces.find(sp => sp.L.wins[it.data.win]);
    store.trash.splice(i, 1);
    if (!host) { persist(); jtoast(t('Ściany tej notatki już nie ma. Jej tekst czeka w koszu jako notatka bez okna.')); return true; }
    if (host.id !== store.cur) setSpace(host.id);
    commit(t('przywrócenie notatki na ścianie'), () => { const ws = L.wins[it.data.win].st; ws.notes = arr(ws.notes); ws.notes.push(it.data.note); });
  } else return false;
  persist();
  return true;
}
function forgetTrash(trId) {
  const i = store.trash.findIndex(x => x.id === trId);
  if (i < 0) return;
  makeBackup('przed usunięciem na zawsze');
  const [it] = store.trash.splice(i, 1);
  if (it.kind === 'wallnote' && it.data?.note?.id && !notesReferenced().has(it.data.note.id)) delete store.notes[it.data.note.id];
  persist();
}
function forgetNote(noteId) {
  if (notesReferenced().has(noteId)) return;
  makeBackup('przed usunięciem notatki na zawsze');
  delete store.notes[noteId];
  persist();
}
let tabJustMoved = false;
function tabDown(e, id, tab) {
  if (e.button !== 0 || e.pointerType === 'touch') return; // a finger scrolls the tabs; reordering is in the tab's menu
  const sx = e.clientX;
  let started = false;
  const move = ev => {
    const dx = ev.clientX - sx;
    if (!started) { if (Math.abs(dx) < 8) return; started = true; tab.classList.add('moving'); try { tab.setPointerCapture(e.pointerId); } catch { /* fine */ } }
    tab.style.transform = `translateX(${dx}px)`;
  };
  const up = ev => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
    if (!started) return;
    tabJustMoved = true;
    setTimeout(() => { tabJustMoved = false; }, 0);
    tab.classList.remove('moving'); tab.style.transform = '';
    const tabs = [...tabsEl.querySelectorAll('.jk-tab')].filter(x => x !== tab);
    let to = tabs.length;
    for (let i = 0; i < tabs.length; i++) { const b = tabs[i].getBoundingClientRect(); if (ev.clientX < b.left + b.width / 2) { to = i; break; } }
    const from = store.spaces.findIndex(x => x.id === id);
    const [sp] = store.spaces.splice(from, 1);
    store.spaces.splice(to, 0, sp);
    renderTabs(); persist();
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
}

/* ---------- what the store wants Jozz to know ---------- */
function renderStatus() {
  const items = [];
  if (!storageOK) items.push({ cls: 'bad', label: t('Bez zapisu'), text: t('Ta przeglądarka nie pozwala tej stronie zapisywać. Zmiany znikną po zamknięciu karty. Eksportuj Jaskinię (Menu → Eksport), żeby je zachować.') });
  else if (saveProblem) items.push({ cls: 'bad', label: t('Zapis nie działa'), text: t('Pamięć przeglądarki dla tej strony jest pełna. Usunąłem najstarsze kopie automatyczne, ale to nie wystarczyło. Opróżnij kosz albo wyeksportuj Jaskinię.') });
  fill(statusEl, items.map(it => h('button', { class: 'jk-stat ' + it.cls, type: 'button', onclick: e => { const el = h('div', { class: 'jk-menu jk-helpbox', role: 'dialog' }, h('h3', { text: it.label }), h('p', { text: it.text })); showPopover(el, e.currentTarget); } }, icon('warn', 14), h('span', { text: it.label }))));
}
function showNotices() {
  if (!notices.length) return;
  const lines = notices.map(n => ({
    migrated: t('Jaskinia przeniosła Twoje układy i notatki do nowej wersji. Stary zapis został nietknięty.'),
    restored: t('Zapis Jaskini był uszkodzony. Wczytałem kopię z {0}; surowe dane leżą w schowku ratunkowym (Ustawienia → Kopie).', dshort(new Date(n.at || 0))),
    lost: t('Zapisu Jaskini nie dało się odczytać i nie było kopii. Surowe dane leżą w schowku ratunkowym (Ustawienia → Kopie).'),
    broken: t('Układ „{0}” był uszkodzony: odłożyłem go do kosza, reszta działa.', n.name),
    presets: t('Żaden zapisany układ nie dał się odczytać, więc są układy startowe. Stare dane są w koszu.'),
  }[n.kind])).filter(Boolean);
  const quiet = notices.every(n => n.kind === 'migrated');
  const el = h('div', { class: 'jk-banner' + (quiet ? '' : ' warn'), role: 'status' },
    icon(quiet ? 'info' : 'warn', 16), h('div', null, lines.map(x => h('p', { text: x }))),
    !quiet ? h('button', { class: 'btn mini', type: 'button', text: t('Pokaż'), onclick: () => { el.remove(); openSettings('kopie'); } }) : null,
    ibtn('close', t('Zamknij'), () => el.remove()));
  stage.append(el);
  if (quiet) setTimeout(() => el.remove(), 9000);
  notices.length = 0;
}

/* ---------- keys ---------- */
function bindKeys() {
  document.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') B.untip(); }, { passive: true, capture: true });
  document.addEventListener('keydown', e => {
    const tg = e.target, typing = /^(input|textarea|select)$/i.test(tg.tagName || '') || tg.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      if (drag) { e.preventDefault(); drag.cancel(); return; }
      if (openPop) return;
      if (L.max && !typing) { e.preventDefault(); toggleMax(L.max); }
      return;
    }
    if (mod && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      if (L.max) { toggleMax(L.max); return; }
      const under = document.elementFromPoint(pointer.x, pointer.y)?.closest('.win')?.dataset.id;
      const id = (under && L.wins[under]) ? under : (L.focus && L.wins[L.focus]) ? L.focus : leafIds(L.tree)[0];
      toggleMax(id);
      return;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrent(); return; }
    if (mod && e.key === ',') { e.preventDefault(); openSettings('wyglad'); return; }
    if (mod && e.key === '.') { e.preventDefault(); uwagaPop(); return; }
    if (typing) return;
    const k = e.key.toLowerCase();
    if (mod && !e.altKey && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && !e.altKey && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 'F2' && L.focus && L.wins[L.focus]) { e.preventDefault(); renameWin(L.focus); }
  });
}

/* a game opens inside a window only where frames are possible (a downloaded file, Jozz's own server) and he wants it there;
   by default the desk opens a window and the phone a new tab, where the game gets the whole screen */
function gamesInWindow() { return !!B.HOSTED && (prefs.games === 'okno' || (prefs.games !== 'karta' && !phone)); }

/* ---------- start ---------- */
function firstHint() {
  if (lsGet('jaskinia:hint') === '1') return;
  const el = h('div', { class: 'jk-hint', role: 'status' },
    h('p', null, h('b', { text: t('Ten ekran układasz Ty. ') }), phone ? t('Na dole są okna tego układu, u góry Twoje układy. Nazwa okna zmienia, co pokazuje.') : t('Przeciągaj szczeliny między oknami, przenoś okna za pasek, dziel je, zamykaj i zmieniaj, co pokazują (klik w nazwę okna).')),
    h('button', { class: 'btn mini', type: 'button', text: t('Pokaż wszystkie ruchy'), onclick: e => openHelp(e.currentTarget) }),
    ibtn('close', t('Zamknij wskazówkę'), () => { el.remove(); lsSet('jaskinia:hint', '1'); }));
  root.append(el);
}
function boot() {
  applyLook();
  buildChrome();
  store = loadStore();
  logEv(t('start: Jaskinia {0}, {1}, okno {2}', VER, t(PLACE_NAME[PLACE]), `${innerWidth}×${innerHeight}`), { v: VER, place: PLACE });
  space = store.spaces.find(sp => sp.id === store.cur) || store.spaces[0];
  L = space.L;
  updateSelStyle(); renderSelBox(); renderTabs(); updateUndoUI();
  bindKeys();
  onSaveProblem = () => renderStatus();
  renderStatus();
  stage.addEventListener('click', e => { // links inside windows select instead of navigating away
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const href = decodeURIComponent(a.getAttribute('href'));
    if (href.startsWith('#repo~')) select(href.slice(6), 'win');
  });
  B.HOOK.go = hash => { const m = /^#repo~(.+)$/.exec(decodeURIComponent(hash)); if (m && R[m[1]]) select(m[1], 'win'); };
  B.HOOK.refresh = () => { for (const id of allIds()) { const rt = RT.get(id); if (rt) rt.key = null; refreshWin(id); } };
  B.HOOK.play = r => {
    select(r.name);
    logEv(t('zagraj: {0} ({1})', r.short, gamesInWindow() ? t('w oknie') : t('w nowej karcie')));
    if (!gamesInWindow()) return false; // the link opens the game in a new tab
    const gid = allIds().find(id => L.wins[id].type === 'gra');
    if (gid) { const w = L.wins[gid]; if (w.pin && w.pin !== r.name) commit(t('gra: {0}', r.short), () => { w.pin = r.name; }); focusWin(gid); if (phone) phoneSwitch(gid); }
    else openWinOfType('gra', { pin: r.name, fresh: true, w: 0.72, h: 0.86 });
    return true;
  };
  new ResizeObserver(() => apply()).observe(stage);
  addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); });
  apply();
  for (const id of allIds()) refreshWin(id);
  maybeAutoBackup();
  showNotices();
  firstHint();
  window.__JASK = { get L() { return L; }, get store() { return store; }, get phone() { return phone; }, RT, WALLS, apply, select, commit, undo, redo, setSpace, layoutRects, leafIds, rects: () => rects, prefs, openSettings, readBackups, persistNow, get log() { return jlog; }, get uwagi() { return uwagi; }, packageData, packageText };
}
