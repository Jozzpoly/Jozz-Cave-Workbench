/* ---------- the store: what Jaskinia keeps, and how none of it gets lost ----------
   jaskinia:v2       the live state: workspaces (tabs), notes, saved layouts, the trash, per-window views
   jaskinia:kopie    automatic copies: before every risky step, and at most every few hours on start
   jaskinia:ratunek  a raw copy of anything that could not be read (so it can still be rescued by hand)
   jaskinia:v1       the first version's data: read once, migrated, never deleted
   Rules: loading repairs what it can and puts what it cannot into the trash; nothing is replaced silently;
   notes live outside the layouts, so undoing a layout change never rewinds what was written. */
const KEY = 'jaskinia:v2', KEY_V1 = 'jaskinia:v1', KEY_BAK = 'jaskinia:kopie', KEY_RESCUE = 'jaskinia:ratunek';
const BAK_MAX = 10, BAK_EVERY = 8 * 3600e3, TRASH_MAX = 200;
let store = null;
const notices = []; // what went wrong (or was done) while loading; told once, plainly
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return e || false; } };
const storageOK = (() => { try { const k = 'jaskinia:próba'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch { return false; } })();
const arr = x => Array.isArray(x) ? x : [];
const obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};

/* ---------- starting layouts ---------- */
const PRESETS = { przeglad: 'Przegląd', granie: 'Granie', statystyki: 'Statystyki', projekt: 'Projekt', sciana: 'Ściana' };
const PRESET_ICON = { przeglad: 't_mapa', granie: 't_gra', statystyki: 't_statystyki', projekt: 't_karta', sciana: 't_sciana' };
function allWinIds(st = store) { return new Set(st ? st.spaces.flatMap(sp => Object.keys(sp.L.wins)) : []); }
function newWinId(taken) {
  const used = allWinIds();
  let id;
  do id = 'w' + Math.random().toString(36).slice(2, 8); while (used.has(id) || (taken && taken.has(id)) || (typeof RT !== 'undefined' && RT.has(id)));
  if (taken) taken.add(id);
  return id;
}
function presetLayout(key) {
  const wins = {}, taken = new Set();
  const w = (type, z = 1) => { const id = newWinId(taken); wins[id] = { type, z, pin: null, st: {} }; return leaf(id); };
  let tree;
  if (key === 'przeglad') tree = row(0.6, col(0.74, w('mapa'), w('puls')), col(0.5, w('kataster'), w('karta', 0.9)));
  else if (key === 'granie') tree = row(0.33, col(0.58, w('zagraj'), w('spis')), col(0.6, w('gra'), row(0.5, w('stan'), w('rytm'))));
  else if (key === 'statystyki') tree = col(0.55, row(0.7, w('wykres'), w('zegar')), row(0.58, w('ranking'), w('rok')));
  else if (key === 'projekt') tree = row(0.5, w('karta', 0.9), col(0.56, w('galezie'), row(0.5, w('stan'), w('rytm'))));
  else if (key === 'sciana') tree = row(0.72, w('sciana'), w('karta', 0.85));
  else tree = w('wybor');
  return { tree, wins, floats: [], max: null, focus: null, stats: {} };
}
const defaultSel = () => (FRESH.find(r => r.pages && r.life !== 'zakończone') || FRESH[0]).name;
function freshStore() {
  const st = { v: 2, cur: 'przeglad', sel: defaultSel(), spaces: [], notes: {}, saved: [], trash: [], views: {} };
  const prev = store; store = st; // newWinId looks at the store being built
  for (const k of Object.keys(PRESETS)) st.spaces.push({ id: k, name: PRESETS[k], preset: k, purpose: '', L: presetLayout(k) });
  store = prev;
  return st;
}

/* ---------- window ids: a copy of a layout gets its own ids (two workspaces never share a window) ---------- */
function remapLayout(src, taken = new Set(), views = null) {
  const nl = clone(src), map = {};
  for (const old of Object.keys(src.wins)) map[old] = newWinId(taken);
  nl.wins = Object.fromEntries(Object.entries(nl.wins).map(([k, v]) => [map[k], v]));
  nl.tree = mapLeaves(nl.tree, l => leaf(map[l.id] || l.id));
  nl.floats = nl.floats.map(f => ({ ...f, id: map[f.id], anchor: f.anchor ? { ...f.anchor, leaves: (f.anchor.leaves || []).map(x => map[x] || x) } : null }));
  nl.max = nl.max ? map[nl.max] || null : null; nl.focus = nl.focus ? map[nl.focus] || null : null;
  if (views && store) for (const [o, n] of Object.entries(map)) if (views[o]) store.views[n] = clone(views[o]);
  return nl;
}

/* ---------- notes: their text lives here, the windows only point at it ---------- */
function noteText(id) { return (store.notes[id] && store.notes[id].text) || ''; }
function noteSet(id, text) {
  if (!id) return;
  const n = store.notes[id];
  if (n && n.text === text) return;
  store.notes[id] = { text: String(text), upd: Date.now() };
  persist();
}
function noteNew(text = '') { const id = uid('n'); store.notes[id] = { text, upd: Date.now() }; return id; }
function notesIn(L0, out = new Set()) {
  for (const w of Object.values(L0.wins || {})) {
    if (w.type === 'notatki' && w.st && w.st.note) out.add(w.st.note);
    if (w.type === 'sciana' && w.st && Array.isArray(w.st.notes)) for (const n of w.st.notes) if (n && n.id) out.add(n.id);
  }
  return out;
}
function notesReferenced() { const out = new Set(); for (const sp of store.spaces) notesIn(sp.L, out); return out; }
function orphanNotes() {
  const used = notesReferenced();
  return Object.entries(store.notes).filter(([id, n]) => !used.has(id) && n.text.trim()).map(([id, n]) => ({ id, text: n.text, upd: n.upd || 0 })).sort((a, b) => b.upd - a.upd);
}
function noteTitle(text) { const l = String(text || '').split('\n').map(x => x.trim()).find(Boolean) || ''; return l.length > 48 ? l.slice(0, 46) + '…' : l; }
/* a notes window always points at a note that exists (v1 kept the text inside the window) */
function ensureNoteWin(st, w) {
  w.st = obj(w.st);
  if (typeof w.st.text === 'string') { const id = uid('n'); st.notes[id] = { text: w.st.text, upd: Date.now() }; w.st.note = id; delete w.st.text; return; }
  if (!w.st.note || typeof w.st.note !== 'string') { delete w.st.note; return; } // the window makes its note when it is first drawn
  if (!st.notes[w.st.note]) st.notes[w.st.note] = { text: '', upd: Date.now(), gone: true };
}

/* ---------- reading what was saved ---------- */
function safeJSON(x) { try { return JSON.parse(JSON.stringify(x)); } catch { return String(x); } }
function rescue(raw) {
  if (raw == null) return;
  let list = [];
  try { list = arr(JSON.parse(lsGet(KEY_RESCUE) || '[]')); } catch { list = []; }
  if (list.some(x => x.raw === raw)) return;
  list.unshift({ at: Date.now(), raw: String(raw) });
  while (list.length > 3) list.pop();
  if (lsSet(KEY_RESCUE, JSON.stringify(list)) !== true) lsSet(KEY_RESCUE, JSON.stringify(list.slice(0, 1)));
}
function rescued() { try { return arr(JSON.parse(lsGet(KEY_RESCUE) || '[]')); } catch { return []; } }
function migrateV1(raw) {
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || !Array.isArray(o.spaces)) return null;
  return { v: 2, cur: o.cur, sel: o.sel, spaces: o.spaces.map(sp => sp && ({ id: sp.id, name: sp.name, preset: sp.preset, purpose: '', L: sp.L })).filter(Boolean), notes: {}, saved: [], trash: [], views: {} };
}
function repair(st) {
  st.v = 2;
  st.notes = obj(st.notes); st.saved = arr(st.saved); st.trash = arr(st.trash); st.views = obj(st.views);
  for (const [k, n] of Object.entries(st.notes)) if (!n || typeof n !== 'object' || typeof n.text !== 'string') delete st.notes[k];
  const seenSp = new Set(), seenWin = new Set(), good = [];
  const prev = store; store = st;
  for (const sp of arr(st.spaces)) {
    if (!sp || typeof sp !== 'object') continue;
    const name = typeof sp.name === 'string' && sp.name.trim() ? sp.name.slice(0, 60) : 'Układ';
    if (!validLayout(sp.L, TYPES)) {
      st.trash.unshift({ id: uid('k'), kind: 'broken', name, at: Date.now(), data: safeJSON(sp) });
      notices.push({ kind: 'broken', name });
      continue;
    }
    if (typeof sp.id !== 'string' || seenSp.has(sp.id)) sp.id = uid('u');
    if (Object.keys(sp.L.wins).some(id => seenWin.has(id))) sp.L = remapLayout(sp.L, new Set(seenWin));
    Object.keys(sp.L.wins).forEach(id => seenWin.add(id));
    seenSp.add(sp.id);
    sp.name = name;
    sp.preset = PRESETS[sp.preset] ? sp.preset : null;
    sp.purpose = typeof sp.purpose === 'string' ? sp.purpose.slice(0, 400) : '';
    for (const w of Object.values(sp.L.wins)) { if (w.type === 'notatki') ensureNoteWin(st, w); if (typeof w.title !== 'string') delete w.title; else w.title = w.title.slice(0, 60); }
    good.push(sp);
  }
  store = prev;
  if (!good.length) {
    const f = freshStore();
    good.push(...f.spaces);
    if (arr(st.spaces).length) notices.push({ kind: 'presets' });
  }
  st.spaces = good;
  if (!st.spaces.some(sp => sp.id === st.cur)) st.cur = st.spaces[0].id;
  if (!R[st.sel]) st.sel = defaultSel();
  st.saved = st.saved.filter(x => x && typeof x.id === 'string' && x.data && typeof x.data === 'object' && (x.kind === 'space' || x.kind === 'all'));
  st.trash = st.trash.filter(x => x && typeof x.id === 'string' && typeof x.kind === 'string').slice(0, TRASH_MAX);
  for (const k of Object.keys(st.views)) if (!seenWin.has(k) || !st.views[k] || typeof st.views[k] !== 'object') delete st.views[k];
  return st;
}
function loadStore() {
  let st = null;
  const raw = lsGet(KEY);
  if (raw != null) {
    try { st = JSON.parse(raw); } catch { st = null; }
    if (!st || typeof st !== 'object' || !Array.isArray(st.spaces)) {
      rescue(raw);
      const b = readBackups()[0];
      st = b ? fromSnapshot(b.data) : null;
      notices.push(b ? { kind: 'restored', at: b.at } : { kind: 'lost' });
    }
  } else {
    const r1 = lsGet(KEY_V1);
    if (r1 != null) {
      st = migrateV1(r1);
      if (st) notices.push({ kind: 'migrated' }); else { rescue(r1); notices.push({ kind: 'lost' }); }
    }
  }
  const out = repair(st || freshStore());
  synced(raw, out);
  if (raw == null || JSON.stringify(out) !== raw) dirty = true; // a repaired or migrated state is written at the next chance
  return out;
}

/* ---------- several tabs (v6.1) ----------
   Every tab keeps its own copy in memory. v6 wrote that whole copy on every hide, so an older tab, closed last,
   overwrote the layouts and notes made in a newer one. Now a tab writes only after it changed something (dirty), takes
   in what another tab wrote (the 'storage' event, in 50-shell.js) without restarting running windows, and merges both
   sides against the last state they shared (a three-way merge by layout, note, view, saved state and trash item):
   - what only one side changed is kept;
   - a note changed on both sides keeps its newer text;
   - a layout changed on both sides keeps this tab's version.
   When the other tab's note or layout loses, it goes into an automatic copy, and Jozz is told once. */
let dirty = false;      // this tab changed something that is not written yet
let lastText = null;    // the KEY's value this tab last wrote or took in
let base = null;        // that state in parts: the common ancestor of the next merge
/* Two tabs can write in the same moment, each before it sees the other's write. Each written state therefore names
   itself (rev) and the state it grew from (par), and a tab keeps the last few states it wrote or took in: a state that
   comes in is merged against the state it grew from, so a tab never mistakes "the other tab had not seen my change yet"
   for "the other tab removed my change". */
const known = new Map(); // rev -> parts
function ancestorFor(theirs) { return (theirs && theirs.par && known.get(theirs.par)) || base; }
let onForeign = null;   // set by the shell: takes in a state written by another tab (text) before this tab writes
const asMap = (list, key = 'id') => Object.fromEntries(arr(list).filter(x => x && x[key] != null).map(x => [x[key], JSON.stringify(x)]));
const jsonMap = o => Object.fromEntries(Object.entries(obj(o)).map(([k, v]) => [k, JSON.stringify(v)]));
function partsOf(st) { return { spaces: asMap(st.spaces), order: arr(st.spaces).map(s => s.id), notes: jsonMap(st.notes), views: jsonMap(st.views), saved: asMap(st.saved), trash: asMap(st.trash) }; }
function synced(text, st) {
  lastText = text; base = partsOf(st);
  if (st && st.rev) { known.set(st.rev, base); while (known.size > 16) known.delete(known.keys().next().value); }
}
const sameMap = (a, b) => { const ka = Object.keys(a); return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]); };
/* the same layouts, notes, views, saved states and trash (cur and sel are each tab's own) */
function sameParts(x, y) { const a = partsOf(x), b = partsOf(y); return a.order.join('\n') === b.order.join('\n') && ['spaces', 'notes', 'views', 'saved', 'trash'].every(k => sameMap(a[k], b[k])); }
/* each map: id -> JSON text. pick(ours, theirs) settles a real conflict and says which one lost */
function merge3(b, o, t0, pick) {
  const out = {}, lost = [];
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t0)])) {
    const bv = b[k], ov = o[k], tv = t0[k];
    let v;
    if (ov === tv) v = ov;
    else if (ov === bv) v = tv;          // only the other tab changed it (or removed it)
    else if (tv === bv) v = ov;          // only this tab did
    else if (ov === undefined) v = tv;   // removed here, changed there: keep the change (the trash has the removal anyway)
    else if (tv === undefined) v = ov;
    else { v = pick(ov, tv); lost.push(v === ov ? { k, side: 'theirs', v: tv } : { k, side: 'ours', v: ov }); }
    if (v !== undefined) out[k] = v;
  }
  return { out, lost };
}
const newerNote = (a, b) => ((JSON.parse(b).upd || 0) > (JSON.parse(a).upd || 0) ? b : a);
/* one layout changed in both tabs: merged window by window. Its shape (the tree of windows, the floating ones, which one
   is maximised) is one thing: if both tabs rearranged it, this tab's shape stays and the other one is reported lost.
   A window's own state, the name and the focus are taken from whichever side changed them (this tab's on a tie). */
function mergeSpace(bv, ov, tv) {
  const sB = bv ? JSON.parse(bv) : null, sO = JSON.parse(ov), sT = JSON.parse(tv);
  const shape = s => s && JSON.stringify([s.L.tree, s.L.floats, s.L.max]);
  const meta = s => s && JSON.stringify([s.name, s.preset, s.purpose, s.L.stats, s.L.focus]);
  const take = (f, quiet) => { const b = f(sB), o = f(sO), t0 = f(sT); if (o === t0 || t0 === b) return { s: sO }; if (o === b) return { s: sT }; return { s: sO, clash: !quiet }; };
  const sh = take(shape), me = take(meta, true);
  const wins = merge3(sB ? jsonMap(sB.L.wins) : {}, jsonMap(sO.L.wins), jsonMap(sT.L.wins), a => a).out;
  const out = clone(sO);
  out.name = me.s.name; out.preset = me.s.preset; out.purpose = me.s.purpose;
  out.L = { ...clone(sh.s.L), stats: clone(me.s.L.stats), focus: me.s.L.focus, wins: {} };
  const ids = new Set([...leafIds(out.L.tree), ...arr(out.L.floats).map(f => f.id)]);
  for (const id of ids) out.L.wins[id] = wins[id] ? JSON.parse(wins[id]) : (sh.s.L.wins[id] ? clone(sh.s.L.wins[id]) : { type: 'wybor', z: 1, pin: null, st: {} });
  if (out.L.focus && !ids.has(out.L.focus)) out.L.focus = null;
  if (out.L.max && !ids.has(out.L.max)) out.L.max = null;
  return { v: JSON.stringify(out), clash: !!sh.clash };
}
/* returns { st, lost }: st is the merged store (this tab's cur and sel); lost lists what lost a real conflict, with the side
   it came from ('ours' or 'theirs'), so the caller can keep that side in an automatic copy */
function mergeStores(b0, ours, theirs) {
  const B0 = b0 || { spaces: {}, order: [], notes: {}, views: {}, saved: {}, trash: {} };
  const O = partsOf(ours), T = partsOf(theirs);
  const sp = merge3(B0.spaces, O.spaces, T.spaces, a => a);
  for (const x of sp.lost.splice(0)) { // both sides changed one layout: merge it by window instead of choosing one whole
    const m = mergeSpace(B0.spaces[x.k], O.spaces[x.k], T.spaces[x.k]);
    sp.out[x.k] = m.v;
    if (m.clash) sp.lost.push({ k: x.k, side: 'theirs', v: T.spaces[x.k] });
  }
  const nt = merge3(B0.notes, O.notes, T.notes, newerNote);
  const vw = merge3(B0.views, O.views, T.views, a => a);   // views are cameras and choices: this tab's win quietly
  const sv = merge3(B0.saved, O.saved, T.saved, a => a), tr = merge3(B0.trash, O.trash, T.trash, a => a);
  const ordO = O.order.join('\n') !== B0.order.join('\n');  // this tab reordered its tabs: its order wins
  const pref = ordO ? O.order : T.order, rest = ordO ? T.order : O.order;
  const ids = [...pref, ...rest].filter((id, i, a) => sp.out[id] && a.indexOf(id) === i);
  for (const id of Object.keys(sp.out)) if (!ids.includes(id)) ids.push(id);
  const parse = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, JSON.parse(v)]));
  const byAt = m => Object.values(m).map(v => JSON.parse(v)).sort((a, b) => (b.at || 0) - (a.at || 0));
  const st = { v: 2, cur: ours.cur, sel: ours.sel, spaces: ids.map(id => JSON.parse(sp.out[id])), notes: parse(nt.out), views: parse(vw.out), saved: byAt(sv.out), trash: byAt(tr.out), rev: theirs.rev || null, par: theirs.par || null };
  const lost = [...sp.lost.map(x => ({ ...x, kind: 'space', name: JSON.parse(x.v).name })), ...nt.lost.map(x => ({ ...x, kind: 'note', name: noteTitle(JSON.parse(x.v).text) }))];
  return { st, lost };
}

/* ---------- writing ---------- */
let saveT = 0, saveProblem = null, onSaveProblem = null;
function persistNow() {
  clearTimeout(saveT);
  if (!storageOK || !store || !dirty) return; // nothing new here: an old copy never goes over a newer one
  const now = lsGet(KEY);
  if (now != null && now !== lastText && onForeign) onForeign(now); // another tab wrote first: merge, then write
  store.par = store.rev || null; store.rev = uid('r'); // this state, grown from the one this tab last shared
  const txt = JSON.stringify(store);
  let ok = lsSet(KEY, txt) === true;
  if (!ok) { trimBackups(Math.max(1, Math.floor(readBackups().length / 2))); ok = lsSet(KEY, txt) === true; }
  if (ok) { synced(txt, store); dirty = false; }
  const p = ok ? null : 'full';
  if (p !== saveProblem) { saveProblem = p; onSaveProblem?.(p); }
}
function persist() { dirty = true; clearTimeout(saveT); saveT = setTimeout(persistNow, 250); }

/* ---------- snapshots: a whole Jaskinia in one object (copies, saved states, export) ---------- */
function snapshotAll(st = store) {
  return { spaces: clone(st.spaces), cur: st.cur, sel: st.sel, notes: clone(st.notes), views: clone(st.views) };
}
function fromSnapshot(d) {
  d = obj(d);
  return { v: 2, cur: d.cur, sel: d.sel, spaces: arr(d.spaces), notes: obj(d.notes), saved: [], trash: [], views: obj(d.views) };
}
const sig = o => { const t0 = JSON.stringify(o); let x = 2166136261; for (let i = 0; i < t0.length; i++) { x ^= t0.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36) + ':' + t0.length; };

/* ---------- automatic copies ---------- */
function readBackups() { try { return arr(JSON.parse(lsGet(KEY_BAK) || '[]')).filter(b => b && b.data && b.at); } catch { return []; } }
function writeBackups(list) {
  while (list.length) { if (lsSet(KEY_BAK, JSON.stringify(list)) === true) return true; list.pop(); }
  lsSet(KEY_BAK, '[]');
  return false;
}
function trimBackups(n) { const l = readBackups(); writeBackups(l.slice(0, Math.max(0, l.length - n))); }
/* `forgotten`: what is about to leave the trash for good. A copy holds the layouts, notes and views, not the trash, so
   the things deleted for good ride along in it; restoring that copy puts them back in the trash (GPT's review of v3
   found that the promise "it stays in the copy made now" was not true for layouts and saved states).
   Returns null when the copy could not be written: the caller must not delete then. */
function makeBackup(why, forgotten, from = store) {
  if (!storageOK || !from) return null;
  const data = snapshotAll(from), list = readBackups(), s0 = sig({ s: data.spaces, n: data.notes });
  const keep = arr(forgotten).filter(Boolean).map(x => clone(x));
  if (list[0] && list[0].sig === s0) {
    if (why === 'auto' && !keep.length) return list[0];
    if (why !== 'auto') { list[0].why = why; list[0].at = Date.now(); }
    if (keep.length) list[0].data.forgotten = [...arr(list[0].data.forgotten), ...keep];
    return writeBackups(list) ? list[0] : null;
  }
  if (keep.length) data.forgotten = keep;
  const b = { id: uid('b'), at: Date.now(), why, sig: s0, n: data.spaces.length, data };
  list.unshift(b);
  return writeBackups(list.slice(0, BAK_MAX)) ? b : null;
}
function maybeAutoBackup() { const b = readBackups()[0]; if (!b || Date.now() - b.at > BAK_EVERY) makeBackup('auto'); }

/* ---------- saved layouts (Jozz saves them on purpose) ---------- */
function referencedNotes(spaces) { const used = new Set(); for (const sp of spaces) notesIn(sp.L, used); return Object.fromEntries([...used].filter(id => store.notes[id]).map(id => [id, store.notes[id].text])); }
function viewsOf(L0) { return Object.fromEntries(Object.keys(L0.wins).filter(id => store.views[id]).map(id => [id, clone(store.views[id])])); }
function saveSpaceState(sp, name) {
  const it = { id: uid('z'), kind: 'space', name: name || sp.name, at: Date.now(), from: sp.name,
    data: { name: sp.name, preset: sp.preset, purpose: sp.purpose || '', L: clone(sp.L), notes: referencedNotes([sp]), views: viewsOf(sp.L) } };
  store.saved.unshift(it);
  persist();
  return it;
}
function saveAllState(name) {
  const d = snapshotAll();
  const it = { id: uid('z'), kind: 'all', name, at: Date.now(), from: '', data: { ...d, notes: referencedNotes(store.spaces) } };
  store.saved.unshift(it);
  persist();
  return it;
}
/* a saved layout comes back with its own window ids; notes that were deleted for good come back from the saved text */
function layoutFromSaved(data) {
  const L0 = clone(data.L);
  if (!validLayout(L0, TYPES)) return null;
  for (const [id, text] of Object.entries(obj(data.notes))) if (!store.notes[id]) store.notes[id] = { text, upd: Date.now() };
  return remapLayout(L0, new Set(), obj(data.views));
}

/* ---------- trash ---------- */
function toTrash(kind, name, data, extra = {}) {
  const it = { id: uid('k'), kind, name, at: Date.now(), data: clone(data), ...extra };
  store.trash.unshift(it);
  if (store.trash.length > TRASH_MAX) store.trash.length = TRASH_MAX;
  persist();
  return it;
}

/* ---------- export / import ---------- */
function exportText(kind, sp) {
  const at = new Date().toISOString();
  if (kind === 'space') return JSON.stringify({ app: 'jaskinia', v: 2, kind: 'space', at, data: { name: sp.name, preset: sp.preset, purpose: sp.purpose || '', L: sp.L, notes: referencedNotes([sp]), views: viewsOf(sp.L) } }, null, 1);
  return JSON.stringify({ app: 'jaskinia', v: 2, kind: 'all', at, data: { ...snapshotAll(), saved: store.saved } }, null, 1);
}
/* returns {kind, data} or throws an Error with a sentence for Jozz */
function parseImport(text) {
  let o;
  try { o = JSON.parse(String(text || '').trim()); } catch { throw new Error(t('To nie jest plik Jaskini: nie da się go odczytać jako JSON.')); }
  if (o && o.app === 'jaskinia' && (o.kind === 'space' || o.kind === 'all') && o.data) return o;
  if (o && Array.isArray(o.spaces)) return { app: 'jaskinia', v: o.v || 1, kind: 'all', data: o }; // a raw store (v1 or v2)
  throw new Error(t('To nie wygląda na układ Jaskini.'));
}
