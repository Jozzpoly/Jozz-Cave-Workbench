/* ---------- Ruch: his own parts, moved by his own hands (v6.4: a try, not the final language of Studio) ----------
   In several of his projects over the past months, agents tuned pivots and axes by numbers and the result still looked
   wrong to him. Here he picks a part of his own model, says how it moves (it turns, it slides, it stays), sees it move at
   once and drags it with the mouse. What he decides stays with the material, as data an agent can read
   (Jaskinia.materialy.ruch(id), and a .json file), so the next agent starts from his hands instead of guessing.

   Kinematic only: nothing here is physics, and the shape stays what Blockbench made. The rest pose is the truth: stopping
   and "Wyzeruj" put every part back exactly. A part is a group of the file, or his own set of cubes (Ctrl+click), because
   the groups a modelling tool makes are not always the parts he means (Astra on PR #4, 19 Oct). The axis is proposed
   from what the model already says: a cube named like an axis (his gears carry one called "Axis"), else the shape of the
   part (a wheel turns about its thinnest side, a piston slides along its longest). He changes either with one click.

   Data on the material record: m.ruch = { v: 1, at, parts: [{ id, name, kind: 'obrot' | 'przesuw', axis: [x, y, z],
   pivot: [x, y, z], range: null | [min, max], z, nodes: ['0.1', …], names: [['group', 'cube'], …] }] }. Axis and pivot
   are in the file's own frame (metres, Y up, 16 Blockbench pixels = 1 m), before the material's default turn and scale.
   nodes are child-index paths from the loaded model's root, names the same paths by name (a new version of the file is
   matched by names). A turn is in radians, a slide in metres of the file. An empty list means he decided nothing moves.
   z says where the axis came from ('klocek:<name>' a cube named like an axis, 'bryla' the shape, 'reka' his click), zp
   where the pivot came from (the same, or 'srodek', 'plik' for the group's pivot in Blockbench, 'wskazany' a cube he
   pointed at). What came from a proposal is proposed again when he changes how the part moves; what he chose stays. */
const RUCH_AXIS = /^(axis|axle|shaft|o[sś]|wa[lł](ek)?|pin|sworze[nń]|bolt)([^a-ząćęłńóśźż]|$)/i;
const RUCH_SPIN = 1.6; // rad/s: a calm turn that still reads as a machine
const RUCH_PERIOD = 2.4; // s: one swing of a hinge or a slide, there and back
const RUCH_HINT = {
  obrot: /(^|[^a-z])(whe[ae]l|ko[lł]o(?!r)|ko[lł]a|cog|gear|z[eę]bat|propel|[sś]mig|wirnik|rotor|fan|rim|tire|opon|axle|bearing|lo[zż]ysk)/i,
  przesuw: /(^|[^a-z])(piston|t[lł]ok|slid|rod|pr[eę]t|tele)/i,
};
/* names Blockbench gives by itself (a new group, a cube, the shapes its generator makes): they say nothing about the part */
const RUCH_DEFAULT = /^(group|grupa|bone|cube|mesh|octagon|hexadecagon|cylinder|sphere|·)?\s*\d*$/i;

/* a Blockbench cube sits in an unnamed holder; its name is the cube's */
const ruchName = n => (n && (n.name || (n.children?.length === 1 && n.children[0].isMesh ? n.children[0].name : ''))) || '';
const ruchInner = obj => obj?.children?.[0]?.children?.[0] || null;
function ruchPathOf(inner, n) {
  const p = [];
  for (let x = n; x !== inner; x = x.parent) { if (!x || !x.parent) return null; p.unshift(x.parent.children.indexOf(x)); }
  return p.join('.');
}
function ruchNodeAt(inner, path) {
  let x = inner;
  for (const i of String(path).split('.').filter(s0 => s0 !== '')) { x = x?.children?.[+i]; if (!x) return null; }
  return x !== inner ? x : null;
}
function ruchNames(inner, n) { const out = []; for (let x = n; x && x !== inner; x = x.parent) out.unshift(ruchName(x) || '·'); return out; }
/* the same node in another copy of the model (a new version of the file): by its names, by its place where names repeat */
function ruchFind(inner, names, path) {
  const at = path != null ? ruchNodeAt(inner, path) : null;
  if (at && (!names || JSON.stringify(ruchNames(inner, at)) === JSON.stringify(names))) return at;
  if (!names?.length) return null;
  const idx = String(path ?? '').split('.').map(Number);
  let x = inner;
  for (let i = 0; i < names.length; i++) {
    const kids = x.children.filter(c => (ruchName(c) || '·') === names[i]);
    if (!kids.length) return null;
    const same = x.children[idx[i]];
    x = kids.length === 1 || !kids.includes(same) ? kids[0] : same;
  }
  return x === inner ? null : x;
}
const ruchClean = a => a.map(v => { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; });
const ruchUnit = k => [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0];

/* the box of some nodes in the model's own frame (always measured in the rest pose) */
function ruchBox(inner, nodes) {
  const { THREE } = swiat();
  inner.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(inner.matrixWorld).invert(), m = new THREE.Matrix4(), box = new THREE.Box3(), bones = new Set();
  for (const n of nodes) n.traverse(o => {
    if (o.isBone) bones.add(o);
    if (!o.isMesh || o.isSkinnedMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
  });
  if (bones.size) box.union(ruchSkinBox(inner, bones));
  return box;
}
/* Blockbench's glTF export can keep his groups as bones of one skinned mesh (his Box3D models are made that way): a part
   is then a bone, and its shape is the vertices that bone moves. Measured in the rest pose, kept per model. */
const RUCH_SKIN = new WeakMap();
function ruchSkinBox(inner, bones) {
  const { THREE } = swiat();
  let cache = RUCH_SKIN.get(inner);
  if (!cache) RUCH_SKIN.set(inner, cache = new Map());
  const key = [...bones].map(b => b.uuid).sort().join(' ');
  if (cache.has(key)) return cache.get(key).clone();
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), inv = new THREE.Matrix4().copy(inner.matrixWorld).invert();
  inner.traverse(o => {
    if (!o.isSkinnedMesh || !o.skeleton) return;
    const ids = new Set();
    o.skeleton.bones.forEach((b, i) => { if (bones.has(b)) ids.add(i); });
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position;
    if (!ids.size || !si || !sw || !pos) return;
    o.skeleton.update();
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      let bj = -1, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bj = si.getComponent(i, k); } }
      if (ids.has(bj)) box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(m));
    }
  });
  cache.set(key, box.clone());
  return box;
}
/* which bone a point of a skinned mesh belongs to: the one that moves most of the face's corners */
function ruchBoneAt(x) {
  const o = x.object, f = x.face, g = o.geometry, si = g?.attributes.skinIndex, sw = g?.attributes.skinWeight;
  if (!o.isSkinnedMesh || !o.skeleton || !f || !si || !sw) return null;
  const score = new Map();
  for (const i of [f.a, f.b, f.c]) for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 0) { const j = si.getComponent(i, k); score.set(j, (score.get(j) || 0) + w); } }
  let best = -1, bw = 0;
  for (const [j, w] of score) if (w > bw) { bw = w; best = j; }
  return o.skeleton.bones[best] || null;
}
/* an empty node named like an axis: a point he (or his exporter) left on the axis, like Axis_WheelSpin_A and _B */
const ruchEmpty = n => { let m = false; n.traverse(o => { if (o.isMesh) m = true; }); return !m; };
const ruchAxisNamed = n => !!n && !n.isMesh && !!n.name && RUCH_AXIS.test(n.name);
/* a cube that names itself an axis: its middle is the pivot, and its long side the axis when that side is clearly the
   longest (a plate 16 by 15 named Axis gives a good middle, but its direction would mislead) */
function ruchAxisCube(inner, nodes) {
  const { THREE } = swiat();
  inner.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(inner.matrixWorld).invert(), m = new THREE.Matrix4();
  let best = null;
  for (const n of nodes) n.traverse(o => {
    if (!o.isMesh || !RUCH_AXIS.test(o.name || '')) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, s0 = bb.getSize(new THREE.Vector3());
    const k = s0.x >= s0.y && s0.x >= s0.z ? 0 : s0.y >= s0.z ? 1 : 2;
    m.multiplyMatrices(inv, o.matrixWorld);
    const dir = new THREE.Vector3(...ruchUnit(k)).transformDirection(m);
    const len = [s0.x, s0.y, s0.z][k] * new THREE.Vector3().setFromMatrixScale(m).x;
    const sides = [s0.x, s0.y, s0.z].sort((a, b) => b - a);
    if (!best || len > best.len) best = { dir: ruchClean(dir.toArray().map(v => (Math.abs(v) > 0.99999 ? Math.sign(v) : Math.abs(v) < 1e-6 ? 0 : v))), center: ruchClean(bb.getCenter(new THREE.Vector3()).applyMatrix4(m).toArray()), len, name: o.name, sure: sides[0] >= 1.3 * sides[1] };
  });
  if (best) return best;
  // a skinned model: a bone named like an axis that moves vertices is a cube like any other; empty ones are points on it
  const pts = [];
  for (const n of nodes) n.traverse(o => {
    if (!ruchAxisNamed(o)) return;
    const bb = o.isBone ? ruchSkinBox(inner, new Set([o])) : null;
    if (bb && !bb.isEmpty()) {
      const s0 = bb.getSize(new THREE.Vector3()).toArray(), k = s0.indexOf(Math.max(...s0)), sides = [...s0].sort((a, b) => b - a);
      if (!best || s0[k] > best.len) best = { dir: ruchUnit(k), center: ruchClean(bb.getCenter(new THREE.Vector3()).toArray()), len: s0[k], name: o.name, sure: sides[0] >= 1.3 * sides[1] };
    } else if (ruchEmpty(o)) pts.push({ name: o.name, p: new THREE.Vector3().setFromMatrixPosition(m.multiplyMatrices(inv, o.matrixWorld)) });
  });
  if (best || !pts.length) return best;
  // two points make a line only when they are one axis's two ends (Axis_Spin_A and _B), never two axles (_Front, _Rear)
  const stem = s0 => s0.replace(/[\s_.-]*(a|b|1|2|start|end|begin|stop|l|r|left|right|lewy|prawy|lewa|prawa)$/i, '').toLowerCase();
  pts.sort((a, b) => a.name.localeCompare(b.name));
  const pair = pts.filter(q => stem(q.name) === stem(pts[0].name) && q.name !== pts[0].name).length ? pts.filter(q => stem(q.name) === stem(pts[0].name)) : [pts[0]];
  const a = pair[0].p, d = pair[pair.length - 1].p.clone().sub(a), line = pair.length > 1 && d.length() > 1e-6;
  const name = line ? pair[0].name.slice(0, stem(pair[0].name).length).replace(/[\s_.-]+$/, '') || pair[0].name : pair[0].name;
  return { dir: line ? ruchClean(d.normalize().toArray().map(v => (Math.abs(v) > 0.99999 ? Math.sign(v) : Math.abs(v) < 1e-6 ? 0 : v))) : [0, 0, 0], center: ruchClean(a.toArray()), len: d.length(), name, sure: line, points: pair.length };
}
/* the axis cube of a part: inside it, else a loose cube beside it in the same group (a wheel often keeps its Axis next
   to the group that holds its teeth) */
function ruchAxisFor(inner, nodes) {
  const own = ruchAxisCube(inner, nodes);
  if (own || nodes.length !== 1) return own;
  const n = nodes[0], up = n.parent;
  if (!up || up === inner) return null;
  // loose cubes beside it, and axis-named points or groups beside it; never another part's own group
  return ruchAxisCube(inner, up.children.filter(c => c !== n && (!c.name || ruchAxisNamed(c) || (c.isMesh && RUCH_AXIS.test(c.name)))));
}
/* how a part is called: his name for it; a name Blockbench gave by itself gets the nearest name of his in front */
function ruchLabel(inner, n) {
  const own = ruchName(n);
  if (own && !RUCH_DEFAULT.test(own)) return own;
  for (let x = n.parent; x && x !== inner; x = x.parent) { const a = ruchName(x); if (a && !RUCH_DEFAULT.test(a)) return `${a} › ${own || '·'}`; }
  return own || '·';
}
/* how far the part reaches along an axis */
function ruchReach(box, axis) { const s0 = box.getSize(new (swiat().THREE.Vector3)()); return Math.abs(s0.x * axis[0]) + Math.abs(s0.y * axis[1]) + Math.abs(s0.z * axis[2]); }
/* where a group of the file turns: the point Blockbench turns that group about */
function ruchOrigin(inner, n) {
  const { THREE } = swiat();
  if (!n || n.isMesh || ruchName(n) !== n.name) return null; // a cube's holder is not a group of his
  inner.updateMatrixWorld(true);
  return ruchClean(new THREE.Vector3().applyMatrix4(new THREE.Matrix4().copy(inner.matrixWorld).invert().multiply(n.matrixWorld)).toArray());
}
/* a proposal: from a cube named like an axis when the part has one, else from the shape */
function ruchPropose(kind, inner, nodes) {
  const { THREE } = swiat();
  const box = ruchBox(inner, nodes), size = box.getSize(new THREE.Vector3()).toArray(), ax = ruchAxisFor(inner, nodes);
  const k = kind === 'obrot' ? size.indexOf(Math.min(...size)) : size.indexOf(Math.max(...size));
  const axis = ax?.sure ? ax.dir : ruchUnit(k), z = ax?.sure ? 'klocek:' + ax.name : 'bryla';
  const pivot = ax ? ax.center : ruchClean(box.getCenter(new THREE.Vector3()).toArray()), zp = ax ? 'klocek:' + ax.name : 'bryla';
  return { axis, pivot, z, zp, range: kind === 'przesuw' ? ruchClean([0, ruchReach(box, axis) / 2]) : null };
}
/* one cycle of a part with a range, k from 0 to 1: from rest to one end, back, to the other end (if any), back */
function ruchWave(range, k) { const s0 = Math.sin(2 * Math.PI * k); return s0 >= 0 ? s0 * range[1] : -s0 * range[0]; }

/* the moving parts of one model: rest frames taken once and every pose computed from them, so nesting composes (a gear
   on a turning carrier turns with it) and the rest comes back exactly */
function ruchRig(inner) {
  const { THREE } = swiat();
  let parts = [];
  const vals = new Map();
  const T = new THREE.Matrix4(), A = new THREE.Matrix4(), B = new THREE.Matrix4(), L = new THREE.Matrix4(), ax = new THREE.Vector3(), pv = new THREE.Vector3();
  const rig = {
    get parts() { return parts; },
    vals,
    ver: 0, // counts poses: a skinned mesh's bounds are measured again after the parts moved
    /* the parts back where the file put them; their values are kept (apply() brings the pose back) */
    restPose() { for (const p of parts) for (const x of p.nodes) { x.n.position.copy(x.pos); x.n.quaternion.copy(x.quat); x.n.scale.copy(x.scl); } rig.ver++; },
    rest() { rig.restPose(); for (const k of vals.keys()) vals.set(k, 0); },
    build(defs) {
      rig.rest(); parts = []; vals.clear();
      inner.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(inner.matrixWorld).invert();
      for (const d of defs) {
        const ns = d.nodes.map(p => ruchNodeAt(inner, p)).filter(Boolean);
        if (!ns.length) continue;
        parts.push({ def: d, nodes: ns.map(n => {
          const pRest = new THREE.Matrix4().multiplyMatrices(inv, n.parent.matrixWorld);
          return { n, pos: n.position.clone(), quat: n.quaternion.clone(), scl: n.scale.clone(), rest: n.matrix.clone(), pRest, pRestInv: pRest.clone().invert() };
        }) });
        vals.set(d.id, 0);
      }
    },
    apply() {
      for (const p of parts) {
        const d = p.def, v = vals.get(d.id) || 0;
        ax.fromArray(d.axis).normalize(); pv.fromArray(d.pivot);
        if (d.kind === 'obrot') T.makeTranslation(pv.x, pv.y, pv.z).multiply(A.makeRotationAxis(ax, v)).multiply(B.makeTranslation(-pv.x, -pv.y, -pv.z));
        else T.makeTranslation(ax.x * v, ax.y * v, ax.z * v);
        for (const x of p.nodes) { L.copy(x.pRestInv).multiply(T).multiply(x.pRest).multiply(x.rest); L.decompose(x.n.position, x.n.quaternion, x.n.scale); }
      }
      rig.ver++;
    },
    /* the innermost moving part that holds this object */
    partOf(o) { for (let x = o; x && x !== inner; x = x.parent) for (const p of parts) if (p.nodes.some(y => y.n === x)) return p; return null; },
    /* for agents: set(name, id or index, value) moves one part, rest() puts all back */
    set(key, v) { const p = typeof key === 'number' ? parts[key] : parts.find(q => q.def.name === key || q.def.id === key); if (!p) return false; vals.set(p.def.id, v); rig.apply(); return true; },
  };
  return rig;
}
/* parts as they are kept: plain arrays, nothing of three.js */
const ruchPlain = d => ({ id: d.id, name: d.name, kind: d.kind, axis: [...d.axis], pivot: [...d.pivot], range: d.range ? [...d.range] : null, z: d.z || '', zp: d.zp || d.z || '', nodes: [...d.nodes], names: (d.names || []).map(x => [...x]) });

/* what an agent gets: the parts, where they sit in the file, how they move */
function ruchJson(m, parts) {
  return {
    jaskinia: 'ruch v1',
    co: 'Ruch nadany przez Jozza w Materiałach: kinematyka, nie fizyka. Oś i punkt w układzie pliku (metry, Y w górę, 16 pikseli Blockbencha = 1 m), przed domyślnym obrotem i skalą materiału. Obrót w radianach, przesuw w metrach pliku. range null przy obrocie: kręci się bez końca. Pozycja spoczynkowa to model taki, jak w pliku.',
    material: { id: m.id, name: m.name, wersja: m.ver || 1, plik: m.main?.name || '', sha256: m.main?.sha || '', skala: m.scale || 1, obrot: m.rot || [0, 0, 0] },
    parts: (parts || m.ruch?.parts || []).map(p => ({ name: p.name, kind: p.kind === 'obrot' ? 'obrót' : 'przesuw', axis: p.axis, pivot: p.pivot, range: p.range, skad: { os: p.z || '', punkt: p.zp || p.z || '' }, nodes: p.nodes, names: p.names })),
  };
}

/* the "Ruch" mode of one Materiały window.
   opt: { save(id, parts) → Promise, saveFile(name, text) → Promise<bool>, older(m) → Promise<record of an older version
   with motion, or null>, onState({ on, n }) } */
function ruchWindow(view, opt) {
  const panel = h('div', { class: 'mt-ruch', hidden: true, role: 'region', 'aria-label': t('Ruch') });
  view.append(panel);
  let on = false, stage = null, inner = null, mat = null, rig = null, defs = [], pomoc = null, carried = null;
  let sel = null, custom = [], hoverN = null, playing = false, untick = null, untickPrev = null, pickPivot = false, drag = null, down = null;
  let savedP = Promise.resolve(), tPlay = 0, moveRaf = 0, lastMove = null, valEl = null, gen = 0, hitVer = -1;
  const saveTs = new Map();
  let THREE = null, ray = null, ndc = null;
  const state = () => opt.onState?.({ on, n: defs.length });
  const api = {
    get on() { return on; }, get defs() { return defs; }, get sel() { return sel; }, get playing() { return playing; }, get rig() { return rig; }, get carried() { return carried; },
    get saved() { return savedP; }, get inner() { return inner; },
    toggle() { on ? api.off() : api.start(); return on; },
    start() { on = true; panel.hidden = false; view.classList.add('ruch'); if (inner) attachObj(); draw(); state(); },
    off() { halt(); on = false; panel.hidden = true; view.classList.remove('ruch'); clearPomoc(); sel = null; custom = []; pickPivot = false; hoverN = null; if (stage) stage.canvas.style.cursor = ''; stage?.redraw(); state(); },
    /* a new object on the stage: another material, or the same one drawn again (another tab turned it, its scale changed) */
    attach(o, m, st) {
      const keep = mat && m && mat.id === m.id && sel && inner ? { part: sel.part?.id || null, paths: sel.nodes.map(n => ruchPathOf(inner, n)), custom: sel.custom, guessed: !!sel.guessed, label: sel.label || null, leaf: sel.leaf ? ruchPathOf(inner, sel.leaf) : null } : null;
      halt(); clearPomoc();
      stage = st; mat = m; inner = ruchInner(o); rig = null; carried = null; gen++;
      sel = null; custom = []; hoverN = null; pickPivot = false;
      defs = (m?.ruch?.parts || []).map(ruchPlain);
      if (on && inner) {
        attachObj();
        if (keep) {
          const ns = keep.paths.map(p => ruchNodeAt(inner, p)).filter(Boolean);
          const part = keep.part ? defs.find(d => d.id === keep.part) || null : null;
          if (ns.length === keep.paths.length) { sel = { part, nodes: ns, custom: keep.custom, guessed: keep.guessed, label: keep.label, leaf: keep.leaf ? ruchNodeAt(inner, keep.leaf) : null }; if (keep.custom && !keep.guessed) custom = [...ns]; }
          drawPomoc();
        }
        draw();
      }
      state();
    },
    detach() { halt(); clearPomoc(); inner = rig = mat = null; defs = []; sel = null; custom = []; gen++; if (on) draw(); state(); },
    dispose() { api.detach(); unlisten(); panel.remove(); },
    play: () => play(), stop: () => stop(true),
    json: () => (mat ? ruchJson(mat, defs) : null),
    /* for tests and agents: what a click on that node would do (add: as with Ctrl) */
    pick(node, add) { if (!inner || !on || !node) return false; click({ hit: { object: node.isMesh ? node : node.getObjectByProperty('isMesh', true) || node }, add: !!add }); return true; },
    kind: k => setKind(k),
  };
  function attachObj() {
    ({ THREE } = swiat());
    ray = ray || new THREE.Raycaster(); ndc = ndc || new THREE.Vector2();
    rig = ruchRig(inner);
    rig.build(defs);
    drawPomoc();
    if (mat && !mat.ruch && opt.older) { // a new version of a file he already set in motion: his motion comes along, by names
      const my = gen;
      opt.older(mat).then(prev => {
        if (my !== gen || !prev?.ruch?.parts?.length || defs.length) return;
        const moved = [];
        for (const p of prev.ruch.parts) {
          const ns = p.nodes.map((path, i) => ruchFind(inner, p.names?.[i], path));
          if (ns.length && ns.every(Boolean)) moved.push({ ...ruchPlain(p), nodes: ns.map(n => ruchPathOf(inner, n)), names: ns.map(n => ruchNames(inner, n)) });
        }
        if (!moved.length) return;
        carried = { from: prev.ver || 1, n: moved.length, of: prev.ruch.parts.length };
        defs = moved;
        rig.build(defs); changed(); drawPomoc(); draw(); state();
      }).catch(() => { /* no older versions here */ });
    }
  }
  /* ---- helpers drawn in the model's frame: the part pointed at, the chosen one, the axes ---- */
  function clearPomoc() { if (pomoc) { pomoc.parent?.remove(pomoc); pomoc.traverse(x => { x.geometry?.dispose(); x.material?.dispose(); }); pomoc = null; } }
  const lineMat = (color, op) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false });
  function boxLines(box, color, op) { const b = new THREE.Box3Helper(box, color); b.material.dispose(); b.material = lineMat(color, op); b.renderOrder = 20; return b; }
  function axisLines(d, box, color, op) {
    const a = new THREE.Vector3().fromArray(d.axis).normalize(), p = new THREE.Vector3().fromArray(d.pivot);
    const len = Math.max(0.06, box.getSize(new THREE.Vector3()).length() * 0.62), cr = len * 0.08;
    const pts = [p.clone().addScaledVector(a, -len), p.clone().addScaledVector(a, len)];
    for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const u = new THREE.Vector3(...v); if (Math.abs(u.dot(a)) > 0.9) continue; pts.push(p.clone().addScaledVector(u, -cr), p.clone().addScaledVector(u, cr)); }
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, op));
    l.renderOrder = 21;
    return l;
  }
  function drawPomoc() {
    clearPomoc();
    if (!on || !inner || !inner.parent || !THREE) return;
    const c = swColors();
    pomoc = new THREE.Group(); pomoc.name = 'ruch: pomoc'; pomoc.userData.ruchPomoc = true;
    pomoc.matrixAutoUpdate = false; pomoc.matrix.copy(inner.matrix);
    rig?.restPose(); // boxes and axes where the file puts them
    for (const d of defs) {
      const ns = d.nodes.map(p => ruchNodeAt(inner, p)).filter(Boolean);
      if (!ns.length) continue;
      const chosen = sel?.part === d;
      pomoc.add(axisLines(d, ruchBox(inner, ns), chosen ? c.hand : c.ink2, chosen ? 0.95 : 0.5));
    }
    if (sel) { const ns = sel.nodes.filter(Boolean); if (ns.length) pomoc.add(boxLines(ruchBox(inner, ns), c.hand, 0.9)); }
    if (hoverN && !(sel && hoverN.every(n => sel.nodes.includes(n)))) pomoc.add(boxLines(ruchBox(inner, hoverN), c.ink3, 0.7));
    rig?.apply(); // and the pose comes back where his hand left it
    inner.parent.add(pomoc);
    stage?.redraw();
  }
  /* ---- pointing and clicking on the stage ---- */
  function hit(e) {
    if (!stage || !inner) return null;
    const r = stage.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    if (rig && rig.ver !== hitVer) { hitVer = rig.ver; inner.traverse(o => { if (o.isSkinnedMesh) { o.boundingSphere = null; o.boundingBox = null; } }); } // a skinned mesh keeps its bounds from before the parts moved
    const x = ray.intersectObject(inner, true).find(y => y.object.isMesh) || null;
    const b = x && x.object.isSkinnedMesh ? ruchBoneAt(x) : null;
    return b ? { ...x, object: b, mesh: x.object } : x;
  }
  // the cube clicked (its holder), and the part he most likely means by it, read from how he builds his wheels: a group
  // holding a cube named like an axis is one wheel with its shaft; inside it, a group with an axis of its own is another
  // wheel and stays out; a group Blockbench named by itself is passed over for the nearest name of his. The path in the
  // panel reaches every level when the guess is wrong.
  const elementOf = mesh => (mesh.parent && mesh.parent !== inner && !mesh.parent.name ? mesh.parent : mesh);
  const isAxisCube = c => (!c.name && c.children.length === 1 && c.children[0].isMesh && RUCH_AXIS.test(c.children[0].name || '')) || (c.isMesh && RUCH_AXIS.test(c.name || '')) || ruchAxisNamed(c);
  const holdsAxis = g => { let f = false; g.traverse(o => { if (!f && o !== g && (o.isMesh ? RUCH_AXIS.test(o.name || '') : ruchAxisNamed(o))) f = true; }); return f; };
  function partFor(el) {
    if (!el.isBone && (!el.parent || el.parent === inner)) return { nodes: [el] };
    for (let g = el.isBone ? el : el.parent; g && g !== inner; g = g.parent) { // a bone is a group itself: his cubes are baked into its mesh
      if (g.children.some(isAxisCube)) {
        const others = g.children.filter(c => c.name && holdsAxis(c)); // wheels of their own inside this one
        if (!others.length) return { nodes: [g] };
        return { nodes: g.children.filter(c => !others.includes(c)), custom: true, label: ruchLabel(inner, g) };
      }
      if (!RUCH_DEFAULT.test(ruchName(g))) return { nodes: [g] };
    }
    return { nodes: [el.parent] };
  }
  function onHover(e) {
    if (!on || drag || e.buttons) return;
    if (e.target !== stage?.canvas) { if (hoverN) { hoverN = null; drawPomoc(); } return; } // over the panel: nothing is pointed at
    lastMove = e;
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      if (!on || !stage || !inner) return;
      const x = lastMove && hit(lastMove), p = x && rig?.partOf(x.object);
      const ns = !x ? null : p ? p.nodes.map(y => y.n) : partFor(elementOf(x.object)).nodes;
      stage.canvas.style.cursor = pickPivot ? 'crosshair' : p ? 'grab' : x ? 'pointer' : '';
      if ((ns?.[0] || null) !== (hoverN?.[0] || null) || (ns?.length || 0) !== (hoverN?.length || 0)) { hoverN = ns; drawPomoc(); }
    });
  }
  function onDown(e) {
    if (!on || !inner || e.button !== 0 || e.target !== stage?.canvas) return;
    const x = hit(e);
    if (pickPivot) {
      e.stopPropagation(); e.preventDefault();
      pickPivot = false;
      const d = sel?.part;
      if (x && d) { rig.restPose(); const p = ruchBox(inner, [elementOf(x.object)]).getCenter(new THREE.Vector3()).toArray(); rig.apply(); setPivot(p, 'wskazany'); }
      else draw();
      return;
    }
    const p = x && rig?.partOf(x.object);
    if (p && !(e.ctrlKey || e.metaKey)) { // a moving part: his hand takes it (a show running stops where it is)
      e.stopPropagation(); e.preventDefault();
      if (playing) stop(false);
      cancelPreview(true);
      stage.controls.enabled = false;
      sel = { part: p.def, nodes: p.nodes.map(y => y.n), custom: false, leaf: elementOf(x.object) }; custom = [];
      drag = { def: p.def, x0: e.clientX, y0: e.clientY, v0: rig.vals.get(p.def.id) || 0, last: null, acc: 0 };
      stage.canvas.style.cursor = 'grabbing';
      drawPomoc(); draw();
      return;
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), hit: x, add: e.ctrlKey || e.metaKey };
  }
  function onDrag(e) {
    if (!drag || !stage || !inner) return;
    e.preventDefault();
    const d = drag.def, cam = stage.camera, r = stage.canvas.getBoundingClientRect();
    inner.updateMatrixWorld(true);
    const pw = new THREE.Vector3().fromArray(d.pivot).applyMatrix4(inner.matrixWorld);
    const aw = new THREE.Vector3().fromArray(d.axis).transformDirection(inner.matrixWorld);
    const scr = v => { const q = v.clone().project(cam); return [r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height]; };
    const [px, py] = scr(pw);
    let v;
    if (d.kind === 'obrot') {
      const toCam = cam.position.clone().sub(pw), facing = aw.dot(toCam) / Math.max(1e-9, toCam.length());
      if (Math.abs(facing) > 0.2) { // the axis looks at him: the part follows the hand around the pivot, like a dial
        const ang = Math.atan2(e.clientY - py, e.clientX - px);
        if (drag.last === null) drag.last = Math.atan2(drag.y0 - py, drag.x0 - px);
        let da = ang - drag.last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        drag.last = ang; drag.acc += facing > 0 ? -da : da;
      } else drag.acc = (e.clientX - drag.x0) * 0.012; // the axis lies across the screen: sideways turns it
      v = drag.v0 + drag.acc;
    } else {
      const sc = new THREE.Vector3().setFromMatrixScale(inner.matrixWorld).x || 1;
      rig.restPose();
      const k = Math.max(0.01, ruchReach(ruchBox(inner, d.nodes.map(p => ruchNodeAt(inner, p)).filter(Boolean)), d.axis) * sc);
      rig.apply();
      const [qx, qy] = scr(pw.clone().addScaledVector(aw, k)), sx = qx - px, sy = qy - py, sl = Math.hypot(sx, sy);
      const dw = sl > 2 ? ((e.clientX - drag.x0) * sx + (e.clientY - drag.y0) * sy) / (sl * sl) * k : 0;
      v = drag.v0 + dw / sc;
    }
    if (d.range) { v = Math.min(d.range[1], Math.max(d.range[0], v)); if (d.kind === 'obrot') drag.acc = v - drag.v0; }
    rig.vals.set(d.id, v);
    rig.apply(); stage.redraw(); showVal();
  }
  function onUp(e) {
    if (drag) { drag = null; if (stage) { stage.controls.enabled = true; stage.canvas.style.cursor = ''; } return; }
    const d0 = down; down = null;
    if (!d0 || !on) return;
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 5 || performance.now() - d0.t > 700) return; // that was a turn of the view
    click(d0);
  }
  function click(d0) {
    const x = d0.hit;
    if (!x) { if (!custom.length) { sel = null; drawPomoc(); draw(); } return; }
    const el = elementOf(x.object);
    if (d0.add) { // his own part, cube by cube, starting from what is chosen (a part already moving is left as it is)
      if (!custom.length && sel && !sel.part) custom = [...sel.nodes];
      const i = custom.indexOf(el);
      if (i >= 0) custom.splice(i, 1); else if (!custom.some(n => isIn(el, n))) custom.push(el);
      sel = custom.length ? { part: null, nodes: [...custom], custom: true, leaf: null } : null;
      drawPomoc(); draw(); return;
    }
    custom = [];
    const p = rig?.partOf(x.object);
    if (p) sel = { part: p.def, nodes: p.nodes.map(y => y.n), custom: false, leaf: el };
    else { const g = partFor(el); sel = { part: null, nodes: g.nodes, custom: !!g.custom, guessed: !!g.custom, label: g.label || null, leaf: el }; }
    drawPomoc(); draw();
  }
  const isIn = (n, g) => { for (let x = n; x && x !== inner; x = x.parent) if (x === g) return true; return false; };
  function choose(n, leaf) { // a level of the path: the part it already is, or the node alone
    const d = owned(n);
    sel = d ? { part: d, nodes: d.nodes.map(p => ruchNodeAt(inner, p)).filter(Boolean), custom: false, leaf } : { part: null, nodes: [n], custom: false, leaf };
    custom = [];
    drawPomoc(); draw();
  }
  const onLeave = () => { if (hoverN && !drag) { hoverN = null; drawPomoc(); } };
  const listen = () => {
    view.addEventListener('pointerleave', onLeave);
    view.addEventListener('pointermove', onHover, true);
    view.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onDrag, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  };
  const unlisten = () => {
    view.removeEventListener('pointerleave', onLeave);
    view.removeEventListener('pointermove', onHover, true);
    view.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onDrag, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
  };
  listen();
  /* ---- the parts ---- */
  const owned = n => defs.find(d => d.nodes.some(p => ruchNodeAt(inner, p) === n)) || null;
  function setKind(kind) {
    if (!sel || !inner || !rig) return;
    stop(true);
    let d = sel.part;
    if (kind === 'stoi') {
      if (d) { defs = defs.filter(x => x !== d); sel = { ...sel, part: null }; }
    } else if (d) {
      if (d.kind !== kind) {
        const pr = ruchPropose(kind, inner, sel.nodes), was = v => v === 'bryla' || String(v).startsWith('klocek');
        d.kind = kind; d.range = pr.range;
        if (was(d.z)) { d.axis = pr.axis; d.z = pr.z; }
        if (was(d.zp)) { d.pivot = pr.pivot; d.zp = pr.zp; }
      }
    } else {
      const taken = sel.nodes.map(owned).find(Boolean);
      if (taken) { jtoast(t('Ten kawałek należy już do części „{0}”. Najpierw ją zatrzymaj (Stoi).', taken.name)); return; }
      const pr = ruchPropose(kind, inner, sel.nodes);
      d = { id: 'r' + Date.now().toString(36) + (++ruchSeq).toString(36), name: selName(),
        kind, axis: pr.axis, pivot: pr.pivot, range: pr.range, z: pr.z, zp: pr.zp, nodes: sel.nodes.map(n => ruchPathOf(inner, n)), names: sel.nodes.map(n => ruchNames(inner, n)) };
      defs = [...defs, d];
      sel = { ...sel, part: d, custom: false };
      custom = [];
    }
    rig.build(defs);
    changed(); drawPomoc(); draw(); state();
    if (d && kind !== 'stoi') preview(d);
  }
  function setAxis(a, z, pivot) {
    const d = sel?.part; if (!d) return;
    stop(true);
    d.axis = ruchClean(a); d.z = z;
    if (pivot) { d.pivot = ruchClean(pivot); d.zp = z; }
    if (d.kind === 'przesuw' && d.range) { rig.restPose(); const reach = ruchReach(ruchBox(inner, sel.nodes), d.axis); d.range = ruchClean([0, Math.min(d.range[1] - d.range[0], reach) || reach / 2]); }
    rig.build(defs); changed(); drawPomoc(); draw(); preview(d);
  }
  function setPivot(p, z) { const d = sel?.part; if (!d) return; stop(true); d.pivot = ruchClean(p); d.zp = z; rig.build(defs); changed(); drawPomoc(); draw(); preview(d); }
  function setRange(r) { const d = sel?.part; if (!d) return; stop(true); d.range = r ? ruchClean(r) : null; rig.build(defs); changed(); draw(); preview(d); }
  // kept a moment later (a drag of chips in a row is one write), per material: switching models never drops a change
  function changed() {
    if (!mat) return;
    const id = mat.id, parts = defs.map(ruchPlain);
    mat = { ...mat, ruch: { v: 1, at: Date.now(), parts } };
    clearTimeout(saveTs.get(id));
    savedP = new Promise(res => { saveTs.set(id, setTimeout(() => { saveTs.delete(id); Promise.resolve().then(() => opt.save(id, parts)).catch(err => jtoast(t('Nie zapisałem ruchu: {0}', err.message))).finally(res); }, 200)); });
  }
  /* ---- moving ---- */
  // the moment a part gets its motion it shows it, once, then rests
  function preview(d) {
    if (playing || !stage || !rig) return;
    cancelPreview();
    let tt = 0;
    const dur = d.kind === 'obrot' && !d.range ? 1.6 : 1.3;
    const end = stage.tick(dt => {
      tt += dt;
      const k = Math.min(1, tt / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      rig.vals.set(d.id, d.kind === 'obrot' && !d.range ? 2 * Math.PI * e : d.range ? ruchWave(d.range, k) : 0);
      if (k >= 1) { rig.vals.set(d.id, 0); end(); untickPrev = null; }
      rig.apply(); showVal(d);
      return true;
    });
    untickPrev = { end, d };
  }
  // keep: the part stays where the preview had it (his hand took it), else it goes back to rest
  function cancelPreview(keep) {
    if (!untickPrev) return;
    const { end, d } = untickPrev;
    end(); untickPrev = null;
    if (!keep && rig) { rig.vals.set(d.id, 0); rig.apply(); stage?.redraw(); }
  }
  function play() {
    if (!rig || !rig.parts.length || !stage) return;
    stop(false); cancelPreview();
    rig.rest();
    playing = true; tPlay = 0;
    untick = stage.tick(dt => {
      tPlay += dt;
      for (const p of rig.parts) {
        const d = p.def;
        if (d.kind === 'obrot' && !d.range) rig.vals.set(d.id, ((rig.vals.get(d.id) || 0) + RUCH_SPIN * dt) % (2 * Math.PI));
        else if (d.range) rig.vals.set(d.id, ruchWave(d.range, tPlay / RUCH_PERIOD));
      }
      rig.apply(); showVal();
      return true;
    });
    drawPomoc(); draw();
  }
  function stop(toRest) {
    if (untick) { untick(); untick = null; }
    const was = playing;
    playing = false;
    if (toRest) { cancelPreview(); if (rig) { rig.rest(); stage?.redraw(); } }
    if (was && on) draw();
    else if (toRest) showVal();
  }
  function halt() { stop(true); cancelPreview(); drag = null; down = null; if (stage) stage.controls.enabled = true; }
  /* ---- the panel ---- */
  // what the chosen pieces are called: his name for the group, or the first piece and how many more (his own part)
  function selName() {
    if (!sel) return '';
    if (sel.label) return sel.label;
    const first = ruchLabel(inner, sel.nodes[0]) || t('część');
    return sel.custom && sel.nodes.length > 1 ? `${first} + ${sel.nodes.length - 1}` : first;
  }
  const deg = v => Math.round(v * 180 / Math.PI);
  function valText(d) {
    const v = rig?.vals.get(d.id) || 0;
    const turn = v - 2 * Math.PI * Math.round(v / (2 * Math.PI)); // a wheel turned back by a quarter says −90°, not 270°
    return d.kind === 'obrot' ? `${deg(d.range ? v : turn)}°`.replace('-', '−') : fmtM(v * (mat?.scale || 1));
  }
  function showVal(d0) { const d = d0 || sel?.part; if (valEl && d && sel?.part === d) valEl.textContent = valText(d); }
  function chip(label, act, o = {}) {
    return h('button', { class: 'jk-tb' + (o.on ? ' on' : '') + (o.hint ? ' hint' : '') + (o.cls ? ' ' + o.cls : ''), type: 'button', title: o.title || (label ? null : o.aria) || null, 'aria-label': label ? null : (o.title || o.aria || null), 'aria-pressed': o.on != null ? String(!!o.on) : null, onclick: act, disabled: o.dis || null },
      o.icon ? icon(o.icon, 12) : null, label ? h('span', { text: label }) : null);
  }
  function draw() {
    if (!on) return;
    valEl = null;
    const close = chip('', () => api.off(), { icon: 'close', title: t('Zamknij Ruch (to, co nadałeś, zostaje)') });
    if (!inner) { panel.replaceChildren(h('div', { class: 'rc-h' }, h('b', { text: t('Ruch') }), h('span', { class: 'mt-gap' }), close), h('p', { class: 'rc-hint', text: t('Wybierz model z listy.') })); return; }
    const d = sel?.part || null;
    const rows = [h('div', { class: 'rc-h' }, h('b', { text: t('Ruch') }), h('span', { class: 'rc-try', title: t('Próba: kinematyka do wypróbowania, nie fizyka i nie gotowy język Studia'), text: t('próba') }),
      h('span', { class: 'mt-gap' }),
      defs.length ? chip(playing ? t('Zatrzymaj') : t('Pokaż ruch'), () => (playing ? stop(true) : play()), { icon: playing ? 'stop' : 'play', on: playing, cls: 'rc-play', title: playing ? t('Wszystko wraca do spoczynku') : t('Wszystkie części ruszają naraz') }) : null,
      close)];
    if (carried) rows.push(h('p', { class: 'rc-note', text: t('Ruch przeniesiony z wersji {0}: {1} z {2}.', carried.from, carried.n, carried.of) }));
    if (!sel) rows.push(h('p', { class: 'rc-hint', text: defs.length ? t('Kliknij część, żeby ją zmienić, albo chwyć ruchomą i przeciągnij.') : t('Kliknij część swojego modelu i powiedz, jak się rusza. Ctrl+klik dobiera klocki do Twojej własnej części.') }));
    else {
      if (!sel.custom || sel.guessed) { // where the part sits in his file: every level can be chosen
        const chain = [];
        for (let x = sel.leaf || sel.nodes[0]; x && x !== inner; x = x.parent) if (ruchName(x)) chain.unshift(x);
        if (chain.length > 1 || (chain.length === 1 && chain[0] !== sel.nodes[0])) rows.push(h('div', { class: 'rc-path', role: 'group', 'aria-label': t('Poziom w pliku') }, chain.map((x, i) => [i ? h('i', { text: '›', 'aria-hidden': 'true' }) : null,
          h('button', { class: 'rc-crumb' + (sel.nodes.length === 1 && sel.nodes[0] === x ? ' on' : ''), type: 'button', title: t('Wybierz ten poziom'), onclick: () => choose(x, sel.leaf) }, ruchName(x))])));
      }
      const name = d ? d.name : sel.custom && !sel.guessed ? t('Twoja część: {0}', selName()) : selName();
      const guess = !d ? Object.keys(RUCH_HINT).find(k => RUCH_HINT[k].test(sel.nodes.map(n => ruchNames(inner, n).join(' ')).join(' '))) : null;
      valEl = d ? h('span', { class: 'rc-val', text: valText(d) }) : null;
      rows.push(h('div', { class: 'rc-name' }, h('b', { text: name }), d ? h('span', { text: d.kind === 'obrot' ? t('obraca się') : t('przesuwa się') }) : null, valEl));
      rows.push(h('div', { class: 'rc-row', role: 'group', 'aria-label': t('Jak się rusza') },
        chip(t('Stoi'), () => setKind('stoi'), { on: !d }),
        chip(t('Obraca się'), () => setKind('obrot'), { on: d?.kind === 'obrot', hint: guess === 'obrot', icon: 't_obrot', title: guess === 'obrot' ? t('Nazwa w pliku mówi, że to się kręci') : '' }),
        chip(t('Przesuwa się'), () => setKind('przesuw'), { on: d?.kind === 'przesuw', hint: guess === 'przesuw', icon: 'ruch_przesuw', title: guess === 'przesuw' ? t('Nazwa w pliku mówi, że to się przesuwa') : '' })));
      if (d) {
        rig.restPose();
        const ax = ruchAxisFor(inner, sel.nodes), box = ruchBox(inner, sel.nodes), org = sel.nodes.length === 1 ? ruchOrigin(inner, sel.nodes[0]) : null;
        rig.apply();
        const fromCube = String(d.z).startsWith('klocek'), same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-5);
        const isA = a => d.axis.every((v, i) => Math.abs(Math.abs(v) - a[i]) < 1e-6);
        rows.push(h('div', { class: 'rc-row', role: 'group', 'aria-label': t('Oś') }, h('span', { class: 'rc-k', text: t('Oś') }),
          ...[0, 1, 2].map(k => chip('XYZ'[k], () => setAxis(ruchUnit(k), 'reka'), { on: isA(ruchUnit(k)), cls: 'rc-ax rc-ax' + k, title: t('Oś {0} pliku, jak w Blockbench', 'XYZ'[k]) })),
          ax?.sure ? chip(t('z „{0}”', ax.name), () => setAxis(ax.dir, 'klocek:' + ax.name, ax.center), { on: fromCube, title: t('Oś i punkt z klocka, który nazwałeś osią') }) : null,
          chip('', () => setAxis(d.axis.map(v => -v), d.z), { icon: 'swap', title: d.kind === 'obrot' ? t('Odwróć kierunek obrotu') : t('Odwróć kierunek przesuwu') })));
        if (d.kind === 'obrot') {
          const mid = ruchClean(box.getCenter(new THREE.Vector3()).toArray());
          const atMid = same(d.pivot, mid);
          // the group's own pivot in Blockbench, when it sits on the part (one left at the model's origin was never set)
          const near = org && box.clone().expandByScalar(box.getSize(new THREE.Vector3()).length() * 0.02 + 1e-6).containsPoint(new THREE.Vector3(...org)) && org.some((v, i) => Math.abs(v - mid[i]) > 1e-4);
          rows.push(h('div', { class: 'rc-row', role: 'group', 'aria-label': t('Punkt obrotu') }, h('span', { class: 'rc-k', text: t('Punkt') }),
            ax ? chip(t('„{0}”', ax.name), () => setPivot(ax.center, 'klocek:' + ax.name), { on: same(d.pivot, ax.center), title: t('Środek klocka, który nazwałeś osią') }) : null,
            chip(t('środek'), () => setPivot(mid, 'srodek'), { on: atMid, title: t('Środek tej części') }),
            near ? chip(t('z pliku'), () => setPivot(org, 'plik'), { on: same(d.pivot, org), title: t('Punkt obrotu tej grupy ustawiony w Blockbench') }) : null,
            chip(pickPivot ? t('kliknij klocek…') : t('wskaż klocek'), () => { pickPivot = !pickPivot; draw(); }, { on: pickPivot || d.zp === 'wskazany', title: t('Kliknij klocek modelu: jego środek będzie punktem obrotu') })));
          const R = Math.PI / 180, isR = (a, b) => !!d.range && Math.abs(d.range[0] - a * R) < 1e-4 && Math.abs(d.range[1] - b * R) < 1e-4;
          rows.push(h('div', { class: 'rc-row', role: 'group', 'aria-label': t('Zakres') }, h('span', { class: 'rc-k', text: t('Zakres') }),
            chip(t('bez końca'), () => setRange(null), { on: !d.range, title: t('Kręci się dookoła: koło, zębatka, śmigło') }),
            chip('±30°', () => setRange([-30 * R, 30 * R]), { on: isR(-30, 30) }),
            chip('±90°', () => setRange([-90 * R, 90 * R]), { on: isR(-90, 90) }),
            chip('0–90°', () => setRange([0, 90 * R]), { on: isR(0, 90), title: t('Jak klapa albo drzwi: w jedną stronę') })));
        } else {
          const reach = ruchReach(box, d.axis), len = d.range ? d.range[1] - d.range[0] : 0;
          rows.push(h('div', { class: 'rc-row', role: 'group', 'aria-label': t('Skok') }, h('span', { class: 'rc-k', text: t('Skok') }),
            ...[[0.25, '¼'], [0.5, '½'], [1, '1']].map(([f, l]) => chip(l, () => setRange([0, reach * f]), { on: Math.abs(len - reach * f) < reach * 1e-3 + 1e-9, title: t('{0} długości tej części: {1}', l, fmtM(reach * f * (mat?.scale || 1))) }))));
        }
      }
    }
    if (defs.length) rows.push(h('div', { class: 'rc-list', role: 'group', 'aria-label': t('Ruchome części') }, defs.map(x => h('button', { class: 'jk-chip' + (sel?.part === x ? ' on' : ''), type: 'button', onclick: () => { const ns = x.nodes.map(p => ruchNodeAt(inner, p)).filter(Boolean); custom = []; sel = { part: x, nodes: ns, custom: false, leaf: null }; drawPomoc(); draw(); } },
      icon(x.kind === 'obrot' ? 't_obrot' : 'ruch_przesuw', 11), h('span', { text: x.name })))));
    rows.push(h('div', { class: 'rc-foot' },
      defs.length ? chip(t('Wyzeruj'), () => stop(true), { icon: 'reset', title: t('Wszystkie części wracają do spoczynku') }) : null,
      h('span', { class: 'mt-gap' }),
      defs.length ? chip(t('Plik dla agentów'), async () => {
        const text = JSON.stringify(api.json(), null, 2);
        if (await opt.saveFile(`${slug(mat?.name || 'model')}-ruch.json`, text)) return;
        try { await navigator.clipboard.writeText(text); jtoast(t('Skopiowałem ruch do schowka (JSON dla agentów).')); } catch { jtoast(t('Ta przeglądarka nie daje tu zapisać pliku ani skopiować.')); }
      }, { icon: 'download', title: t('Części, osie i zakresy jako JSON: agent zbuduje z tego prawdziwy mechanizm') }) : null));
    panel.replaceChildren(...rows);
  }
  return api;
}
let ruchSeq = 0;
ICONS.ruch = 'M8 7.4v1.2 M3.2 8a4.8 4.8 0 0 1 8.2-3.4 M12.8 8a4.8 4.8 0 0 1-8.2 3.4 M11.6 2.2v2.6H9 M4.4 13.8v-2.6H7';
ICONS.ruch_przesuw = 'M2 5.5h5v5H2z M7 8h6.5 M11 5.5l2.5 2.5L11 10.5';
ICONS.stop = 'M4.5 4.5h7v7h-7z';
