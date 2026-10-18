/* ---------- Blockbench's own file (.bbmodel), read directly ----------
   What Jozz saves in Blockbench (format 4 and 5, Java block/free models: cubes, and meshes) becomes three.js without an
   export step: cubes with per-face UVs and face rotation, element and group pivots and rotations (Blockbench's ZYX order),
   inflate, the embedded pictures (pixel-sharp), and only what was visible when he saved it (all of it if nothing was).
   Pixels become metres the way Blockbench's own glTF export does it: 16 pixels are 1 metre. */
const BB_ORDER = 'ZYX';
function bbModel(j, mgr, missing) {
  const { THREE } = swiat();
  const CLAY = 0xb9b2a6; // the colour of a face without a picture, as in Materiały
  const S = 1 / 16, rad = THREE.MathUtils.degToRad;
  const res = j.resolution || { width: 16, height: 16 };
  // pictures: one material per texture (pixel-sharp, cut-out alpha, both sides for flat planes)
  const tl = new THREE.TextureLoader(mgr);
  const texs = (j.textures || []).map((tx, i) => {
    const uvw = tx.uv_width || res.width || tx.width || 16, uvh = tx.uv_height || res.height || tx.height || 16;
    let map = null;
    if (tx.source && /^data:image\//.test(tx.source)) {
      map = tl.load(tx.source);
      map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false;
    } else if (tx.name) missing.add(tx.name);
    const mat = new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : CLAY, roughness: 0.86, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide });
    mat.name = tx.name || 'texture ' + i;
    return { uuid: tx.uuid, uvw, uvh, mat };
  });
  const noTex = new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.86, side: THREE.DoubleSide });
  const texOf = v => { if (v === null || v === undefined || v === false) return null; if (typeof v === 'number') return texs[v] || null; return texs.find(x => x.uuid === v) || null; };
  // which elements and groups count: visible and exported (when nothing is visible, everything)
  const els = (j.elements || []).filter(e => e.export !== false);
  const anyVisible = els.some(e => e.visibility !== false);
  const shown = e => !anyVisible || e.visibility !== false;
  const byId = new Map(els.map(e => [e.uuid, e]));
  const groups = new Map((j.groups || []).map(g => [g.uuid, g]));
  const v3 = a => new THREE.Vector3((a?.[0] || 0) * S, (a?.[1] || 0) * S, (a?.[2] || 0) * S);
  // one cube: six faces, each a quad with its own UVs, texture and rotation
  const FACE = { // corners top-left, top-right, bottom-right, bottom-left, as Minecraft lays a face's picture
    north: (a, b) => [[b.x, b.y, a.z], [a.x, b.y, a.z], [a.x, a.y, a.z], [b.x, a.y, a.z]],
    south: (a, b) => [[a.x, b.y, b.z], [b.x, b.y, b.z], [b.x, a.y, b.z], [a.x, a.y, b.z]],
    east: (a, b) => [[b.x, b.y, b.z], [b.x, b.y, a.z], [b.x, a.y, a.z], [b.x, a.y, b.z]],
    west: (a, b) => [[a.x, b.y, a.z], [a.x, b.y, b.z], [a.x, a.y, b.z], [a.x, a.y, a.z]],
    up: (a, b) => [[a.x, b.y, a.z], [b.x, b.y, a.z], [b.x, b.y, b.z], [a.x, b.y, b.z]],
    down: (a, b) => [[a.x, a.y, b.z], [b.x, a.y, b.z], [b.x, a.y, a.z], [a.x, a.y, a.z]],
  };
  const NORM = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
  function cube(e, pivot) {
    const inf = (e.inflate || 0);
    const a = new THREE.Vector3(Math.min(e.from[0], e.to[0]) - inf, Math.min(e.from[1], e.to[1]) - inf, Math.min(e.from[2], e.to[2]) - inf).multiplyScalar(S);
    const b = new THREE.Vector3(Math.max(e.from[0], e.to[0]) + inf, Math.max(e.from[1], e.to[1]) + inf, Math.max(e.from[2], e.to[2]) + inf).multiplyScalar(S);
    const o = v3(e.origin);
    const pos = [], uv = [], nor = [], idx = [], grp = [];
    const mats = [];
    for (const side of Object.keys(FACE)) {
      const f = e.faces?.[side];
      if (!f) continue;
      const tx = texOf(f.texture);
      if (f.texture === null || f.texture === false) continue; // Blockbench: no texture means no face
      let mi = mats.indexOf(tx ? tx.mat : noTex);
      if (mi < 0) { mats.push(tx ? tx.mat : noTex); mi = mats.length - 1; }
      const c = FACE[side](a, b), n = NORM[side];
      const w = tx ? tx.uvw : res.width, hgt = tx ? tx.uvh : res.height;
      const [u1, v1, u2, v2] = f.uv || [0, 0, w, hgt];
      const quv = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]];
      const k = (((f.rotation || 0) / 90) % 4 + 4) % 4;
      const base = pos.length / 3;
      for (let i = 0; i < 4; i++) {
        const q = quv[(i - k + 4) % 4];
        pos.push(c[i][0] - o.x, c[i][1] - o.y, c[i][2] - o.z);
        uv.push(q[0] / w, 1 - q[1] / hgt);
        nor.push(...n);
      }
      const start = idx.length;
      idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
      grp.push([start, 6, mi]);
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    for (const [st, cnt, mi] of grp) g.addGroup(st, cnt, mi);
    const mesh = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
    mesh.name = e.name || 'cube';
    const holder = new THREE.Group();
    holder.position.copy(o).sub(pivot);
    const r = e.rotation || [0, 0, 0];
    holder.rotation.set(rad(r[0] || 0), rad(r[1] || 0), rad(r[2] || 0), BB_ORDER);
    holder.add(mesh);
    return holder;
  }
  // a Blockbench mesh element: vertices and polygons (triangles or quads) with their own UVs
  function polyMesh(e, pivot) {
    const o = v3(e.origin), keys = Object.keys(e.vertices || {});
    const P = new Map(keys.map(k => [k, e.vertices[k]]));
    const pos = [], uv = [], idx = [], grp = [], mats = [];
    for (const f of Object.values(e.faces || {})) {
      const vs = f.vertices || [];
      if (vs.length < 3) continue;
      const tx = texOf(f.texture);
      let mi = mats.indexOf(tx ? tx.mat : noTex);
      if (mi < 0) { mats.push(tx ? tx.mat : noTex); mi = mats.length - 1; }
      const w = tx ? tx.uvw : res.width, hgt = tx ? tx.uvh : res.height, base = pos.length / 3, start = idx.length;
      const ord = vs.length === 4 ? [vs[0], vs[1], vs[3], vs[2]] : vs; // Blockbench stores quads in a cross order
      for (const k of ord) { const p = P.get(k) || [0, 0, 0], q = f.uv?.[k] || [0, 0]; pos.push(p[0] * S, p[1] * S, p[2] * S); uv.push(q[0] / w, 1 - q[1] / hgt); }
      for (let i = 1; i + 1 < ord.length; i++) idx.push(base, base + i, base + i + 1);
      grp.push([start, idx.length - start, mi]);
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    for (const [st, cnt, mi] of grp) g.addGroup(st, cnt, mi);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
    mesh.name = e.name || 'mesh';
    const holder = new THREE.Group();
    holder.position.copy(o).sub(pivot);
    const r = e.rotation || [0, 0, 0];
    holder.rotation.set(rad(r[0] || 0), rad(r[1] || 0), rad(r[2] || 0), BB_ORDER);
    // a mesh element's vertices are relative to its origin, which the holder already stands on
    holder.add(mesh);
    return holder;
  }
  const element = (e, pivot) => (e.type === 'mesh' ? polyMesh(e, pivot) : e.from && e.to ? cube(e, pivot) : null);
  const used = new Set();
  // the outliner: groups (bones) with their own pivots and rotations; format 5 keeps group data in j.groups
  function node(n, parent, pivot) {
    if (typeof n === 'string') {
      const e = byId.get(n);
      if (!e) return;
      used.add(n);
      if (!shown(e)) return;
      const x = element(e, pivot);
      if (x) parent.add(x);
      return;
    }
    const g = { ...(groups.get(n.uuid) || {}), ...n };
    if (g.export === false || (anyVisible && g.visibility === false)) { markUsed(n); return; }
    const o = v3(g.origin);
    const obj = new THREE.Group();
    obj.name = g.name || 'group';
    obj.position.copy(o).sub(pivot);
    const r = g.rotation || [0, 0, 0];
    obj.rotation.set(rad(r[0] || 0), rad(r[1] || 0), rad(r[2] || 0), BB_ORDER);
    parent.add(obj);
    for (const c of n.children || []) node(c, obj, o);
  }
  function markUsed(n) { if (typeof n === 'string') used.add(n); else for (const c of n.children || []) markUsed(c); }
  const root = new THREE.Group();
  root.name = j.name || 'bbmodel';
  const zero = new THREE.Vector3();
  for (const n of j.outliner || []) node(n, root, zero);
  for (const e of els) if (!used.has(e.uuid) && shown(e)) { const x = element(e, zero); if (x) root.add(x); } // elements outside the outliner
  return root;
}

