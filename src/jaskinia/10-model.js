/* ---------- the layout model (pure; no DOM) ----------
   L = { tree, wins: {id: {type, z, pin, st}}, floats: [{id, x, y, w, h, anchor}], max, focus, stats }
   tree = {t:'w', id} | {t:'s', d:'row'|'col', r, a, b}
   'row' puts a left of b, 'col' puts a above b; r is a's share. Floats are fractions of the stage. */
const GAP = 4, MINW = 170, MINH = 92, EDGE = 18;

const leaf = id => ({ t: 'w', id });
const row = (r, a, b) => ({ t: 's', d: 'row', r, a, b });
const col = (r, a, b) => ({ t: 's', d: 'col', r, a, b });
function leafIds(n, out = []) { if (!n) return out; if (n.t === 'w') out.push(n.id); else { leafIds(n.a, out); leafIds(n.b, out); } return out; }
const hasLeaf = (n, id) => leafIds(n).includes(id);
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
function without(n, id) {
  if (!n) return null;
  if (n.t === 'w') return n.id === id ? null : n;
  const a = without(n.a, id), b = without(n.b, id);
  if (!a) return b;
  if (!b) return a;
  return a === n.a && b === n.b ? n : { ...n, a, b };
}
/* put a new window `id` on one side of the node that `match` finds; share = the new window's part */
function wrap(old, side, id, share) {
  const NEW = leaf(id);
  if (side === 'left') return row(share, NEW, old);
  if (side === 'right') return row(1 - share, old, NEW);
  if (side === 'top') return col(share, NEW, old);
  return col(1 - share, old, NEW);
}
function wrapWhere(n, match, side, id, share) {
  if (match(n)) return wrap(n, side, id, share);
  if (n.t === 'w') return n;
  const a = wrapWhere(n.a, match, side, id, share), b = wrapWhere(n.b, match, side, id, share);
  return a === n.a && b === n.b ? n : { ...n, a, b };
}
const splitAt = (tree, target, side, id, share = 0.5) => wrapWhere(tree, n => n.t === 'w' && n.id === target, side, id, share);
function mapLeaves(n, f) { return n.t === 'w' ? f(n) : { ...n, a: mapLeaves(n.a, f), b: mapLeaves(n.b, f) }; }
const swapLeaves = (n, x, y) => mapLeaves(n, l => l.id === x ? leaf(y) : l.id === y ? leaf(x) : l);
const replaceLeaf = (n, oldId, newId) => mapLeaves(n, l => l.id === oldId ? leaf(newId) : l);

function minSize(n, axis) {
  if (n.t === 'w') return axis === 'w' ? MINW : MINH;
  const ma = minSize(n.a, axis), mb = minSize(n.b, axis);
  return (n.d === 'row') === (axis === 'w') ? ma + GAP + mb : Math.max(ma, mb);
}
/* rectangles for every tiled window and every border between two parts */
function layoutRects(tree, W, H) {
  const out = { wins: {}, divs: [] };
  (function go(n, x, y, w, hh) {
    if (n.t === 'w') { out.wins[n.id] = { x, y, w, h: hh }; return; }
    if (n.d === 'row') {
      const aw = Math.round((w - GAP) * n.r);
      go(n.a, x, y, aw, hh);
      out.divs.push({ node: n, d: 'row', x: x + aw, y, w: GAP, h: hh, x0: x, y0: y, span: w });
      go(n.b, x + aw + GAP, y, w - aw - GAP, hh);
    } else {
      const ah = Math.round((hh - GAP) * n.r);
      go(n.a, x, y, w, ah);
      out.divs.push({ node: n, d: 'col', x, y: y + ah, w, h: GAP, x0: x, y0: y, span: hh });
      go(n.b, x, y + ah + GAP, w, hh - ah - GAP);
    }
  })(tree, 0, 0, W, H);
  return out;
}
/* the share a split gets when its border is dragged to p px from the split's start; both sides keep a usable size */
function shareAt(div, p) {
  const n = div.node, axis = div.d === 'row' ? 'w' : 'h';
  const room = div.span - GAP;
  if (room <= 0) return n.r;
  const lo = minSize(n.a, axis), hi = room - minSize(n.b, axis);
  if (hi < lo) return clamp(p / room, 0.15, 0.85);
  return clamp(p, lo, hi) / room;
}
/* where a dragged window would land: next to an edge of the window under the pointer, or in its place (swap).
   Close to the outer edge of the whole screen it lands along that whole edge. */
function dropZone(rect, px, py, stageW, stageH) {
  if (stageW && (px < EDGE || py < EDGE || px > stageW - EDGE || py > stageH - EDGE)) {
    const d = { left: px, right: stageW - px, top: py, bottom: stageH - py };
    return 'root-' + Object.keys(d).reduce((m, k) => d[k] < d[m] ? k : m, 'left');
  }
  const fx = (px - rect.x) / rect.w, fy = (py - rect.y) / rect.h;
  const d = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy };
  const side = Object.keys(d).reduce((m, k) => d[k] < d[m] ? k : m, 'left');
  return d[side] > 0.3 ? 'center' : side;
}
function zoneRect(rect, zone, stageW, stageH) {
  if (zone.startsWith('root-')) {
    const side = zone.slice(5), k = 0.3;
    if (side === 'left') return { x: 0, y: 0, w: stageW * k, h: stageH };
    if (side === 'right') return { x: stageW * (1 - k), y: 0, w: stageW * k, h: stageH };
    if (side === 'top') return { x: 0, y: 0, w: stageW, h: stageH * k };
    return { x: 0, y: stageH * (1 - k), w: stageW, h: stageH * k };
  }
  const { x, y, w, h: hh } = rect;
  if (zone === 'left') return { x, y, w: w / 2, h: hh };
  if (zone === 'right') return { x: x + w / 2, y, w: w / 2, h: hh };
  if (zone === 'top') return { x, y, w, h: hh / 2 };
  if (zone === 'bottom') return { x, y: y + hh / 2, w, h: hh / 2 };
  return { x, y, w, h: hh };
}
/* ---- structural changes; each returns true when the layout changed ---- */
function moveTiled(L, id, target, zone) {
  if (!hasLeaf(L.tree, id)) return false;
  if (zone.startsWith('root-')) {
    const t = without(L.tree, id);
    if (!t) return false;
    L.tree = wrap(t, zone.slice(5), id, 0.3);
    return true;
  }
  if (id === target || !hasLeaf(L.tree, target)) return false;
  if (zone === 'center') { L.tree = swapLeaves(L.tree, id, target); return true; }
  const t = without(L.tree, id);
  if (!t) return false;
  L.tree = splitAt(t, target, zone, id, 0.5);
  return true;
}
function dockFloat(L, id, target, zone) {
  const fi = L.floats.findIndex(f => f.id === id);
  if (fi < 0) return false;
  const f = L.floats[fi];
  if (zone.startsWith('root-')) { L.floats.splice(fi, 1); L.tree = wrap(L.tree, zone.slice(5), id, 0.3); return true; }
  if (!hasLeaf(L.tree, target)) return false;
  if (zone === 'center') { // the tiled window takes the float's spot above the rest
    L.tree = replaceLeaf(L.tree, target, id);
    L.floats[fi] = { id: target, x: f.x, y: f.y, w: f.w, h: f.h, anchor: null };
  } else {
    L.floats.splice(fi, 1);
    L.tree = splitAt(L.tree, target, zone, id, 0.5);
  }
  return true;
}
/* the window's neighbours on the other side of its split: enough to put it back where it was */
function anchorOf(tree, id) {
  let res = null;
  (function go(n) {
    if (!n || n.t === 'w' || res) return;
    if (n.a.t === 'w' && n.a.id === id) { res = { leaves: leafIds(n.b), side: n.d === 'row' ? 'left' : 'top', share: n.r }; return; }
    if (n.b.t === 'w' && n.b.id === id) { res = { leaves: leafIds(n.a), side: n.d === 'row' ? 'right' : 'bottom', share: 1 - n.r }; return; }
    go(n.a); go(n.b);
  })(tree);
  return res;
}
function floatOut(L, id, rect) {
  if (!hasLeaf(L.tree, id) || leafIds(L.tree).length < 2) return false;
  const anchor = anchorOf(L.tree, id);
  L.tree = without(L.tree, id);
  L.floats.push({ id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, anchor });
  return true;
}
function biggestLeaf(tree) {
  const r = layoutRects(tree, 1600, 900).wins;
  return Object.keys(r).sort((a, b) => r[b].w * r[b].h - r[a].w * r[a].h)[0];
}
function dockBack(L, id) {
  const fi = L.floats.findIndex(f => f.id === id);
  if (fi < 0) return false;
  const f = L.floats[fi], a = f.anchor;
  L.floats.splice(fi, 1);
  const share = clamp((a && a.share) || 0.4, 0.15, 0.85);
  const ids = leafIds(L.tree);
  if (a && a.leaves && a.leaves.length && a.leaves.every(x => ids.includes(x))) {
    const before = L.tree;
    L.tree = wrapWhere(L.tree, n => sameSet(leafIds(n), a.leaves), a.side, id, share);
    if (L.tree !== before) return true;
  }
  const still = a && a.leaves ? a.leaves.find(x => ids.includes(x)) : null;
  L.tree = splitAt(L.tree, still || biggestLeaf(L.tree), (a && a.side) || 'right', id, share);
  return true;
}
function closeWin(L, id) {
  const fi = L.floats.findIndex(f => f.id === id);
  if (fi >= 0) L.floats.splice(fi, 1);
  else if (!hasLeaf(L.tree, id)) return false;
  else if (leafIds(L.tree).length < 2) { // the last tiled window stays, emptied
    L.wins[id] = { type: 'wybor', z: 1, pin: null, st: {} };
    if (L.max === id) L.max = null;
    return true;
  } else L.tree = without(L.tree, id);
  delete L.wins[id];
  if (L.max === id) L.max = null;
  if (L.focus === id) L.focus = null;
  return true;
}
function splitWin(L, id, side, newId, type = 'wybor') {
  if (!hasLeaf(L.tree, id)) return false;
  L.tree = splitAt(L.tree, id, side, newId, 0.5);
  L.wins[newId] = { type, z: 1, pin: null, st: {} };
  return true;
}
/* repair whatever came back from storage; false = unusable */
function validLayout(L, known) {
  if (!L || typeof L !== 'object' || !L.tree || !L.wins || typeof L.wins !== 'object') return false;
  let bad = false;
  (function chk(n) {
    if (!n || typeof n !== 'object') { bad = true; return; }
    if (n.t === 'w') { if (typeof n.id !== 'string') bad = true; return; }
    if (n.t !== 's' || (n.d !== 'row' && n.d !== 'col')) { bad = true; return; }
    n.r = clamp(+n.r || 0.5, 0.05, 0.95); chk(n.a); chk(n.b);
  })(L.tree);
  if (bad) return false;
  const ids = leafIds(L.tree);
  if (!ids.length || new Set(ids).size !== ids.length) return false;
  L.floats = Array.isArray(L.floats) ? L.floats.filter(f => f && typeof f.id === 'string' && L.wins[f.id] && !ids.includes(f.id)) : [];
  for (const f of L.floats) { f.w = clamp(+f.w || 0.4, 0.08, 1); f.h = clamp(+f.h || 0.4, 0.08, 1); f.x = clamp(+f.x || 0, 0, 0.95); f.y = clamp(+f.y || 0, 0, 0.95); }
  for (const id of [...ids, ...L.floats.map(f => f.id)]) {
    const w = L.wins[id];
    if (!w || typeof w !== 'object') return false;
    /* Every Jaskinia downloaded to one computer shares the same file:// storage, so an older or a public build may open
       layouts written by a newer one. A window type or a pinned project it does not know is kept aside, not erased,
       and comes back in a Jaskinia that knows it. */
    if (w.lost && typeof w.lost === 'object') {
      if (w.lost.type && w.type === 'wybor' && known[w.lost.type]) w.type = w.lost.type;
      if (w.lost.type && w.type !== 'wybor') delete w.lost.type;   // back, or Jozz put something else here
      if (w.lost.pin && !w.pin && R[w.lost.pin]) w.pin = w.lost.pin;
      if (w.lost.pin && w.pin) delete w.lost.pin;                  // back, or Jozz pinned it elsewhere
      if (!w.lost.type && !w.lost.pin) delete w.lost;
    } else delete w.lost;
    if (!known[w.type]) { w.lost = { ...(w.lost && typeof w.lost === 'object' ? w.lost : {}), type: String(w.type) }; w.type = 'wybor'; }
    w.z = clamp(+w.z || 1, 0.5, 2.5);
    w.st = w.st && typeof w.st === 'object' ? w.st : {};
    if (w.pin && !R[w.pin]) { w.lost = { ...(w.lost && typeof w.lost === 'object' ? w.lost : {}), pin: String(w.pin) }; w.pin = null; }
  }
  for (const k of Object.keys(L.wins)) if (!ids.includes(k) && !L.floats.some(f => f.id === k)) delete L.wins[k];
  if (L.max && !L.wins[L.max]) L.max = null;
  if (L.focus && !L.wins[L.focus]) L.focus = null;
  L.stats = L.stats && typeof L.stats === 'object' ? L.stats : {};
  return true;
}
