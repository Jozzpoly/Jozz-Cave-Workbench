/* ---------- Materiały: Jozz's own models and textures, kept in this browser (v6) ----------
   What he makes in Blockbench or Blender comes in by dropping the files anywhere in Jaskinia (.glb, .gltf with its .bin
   and pictures, .obj with its .mtl and pictures, or pictures alone). Each file is kept once, by the SHA-256 of its bytes,
   in IndexedDB ("jaskinia-materialy"); a material is a main file with what it needs. Dropping a changed file with the
   same name makes a new version of that material, never a silent replacement. Orientation and scale are the material's
   defaults (non-destructive), checked against a body 1.8 m tall. Nothing here enters layout undo; deleting is soft. */
const MDB = 'jaskinia-materialy';
const MAT_MODEL = /\.(glb|gltf|obj|bbmodel)$/i, MAT_PIC = /\.(png|jpe?g|webp|gif|bmp|tga)$/i, MAT_SIDE = /\.(bin|mtl|png|jpe?g|webp|gif|bmp|tga|ktx2)$/i;
let mdbP = null;
function mdb() {
  if (!mdbP) mdbP = new Promise((res, rej) => {
    let rq;
    try { rq = indexedDB.open(MDB, 1); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('pliki')) db.createObjectStore('pliki', { keyPath: 'sha' });
      if (!db.objectStoreNames.contains('materialy')) db.createObjectStore('materialy', { keyPath: 'id' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error || new Error('IndexedDB'));
    rq.onblocked = () => rej(new Error(t('inna karta Jaskini trzyma bazę materiałów')));
  });
  mdbP.catch(() => { mdbP = null; });
  return mdbP;
}
async function mdo(store, mode, fn) {
  const db = await mdb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode), os = tx.objectStore(store);
    let out;
    const rq = fn(os);
    if (rq) rq.onsuccess = () => { out = rq.result; };
    tx.oncomplete = () => res(out);
    tx.onerror = tx.onabort = () => rej(tx.error || new Error('IndexedDB'));
  });
}
const mget = (store, key) => mdo(store, 'readonly', os => os.get(key));
const mput = (store, val) => mdo(store, 'readwrite', os => os.put(val));
const mall = store => mdo(store, 'readonly', os => os.getAll());
async function sha256(blob) {
  const buf = await blob.arrayBuffer();
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const baseName = n => String(n || '').split(/[\\/]/).pop();
const stem = n => baseName(n).replace(/\.[^.]+$/, '');
const extOf = n => (/\.([^.]+)$/.exec(baseName(n)) || [])[1]?.toLowerCase() || '';
/* every tab of this Jaskinia shares the library: a change in one tab tells the others, which read it again (v6.1) */
const MAT_BC = (() => { try { return new BroadcastChannel('jaskinia-materialy'); } catch { return null; } })();
function matEmit(detail, fromOther) {
  document.dispatchEvent(new CustomEvent('jk:materialy', { detail }));
  if (!fromOther && MAT_BC) { const { target, ...rest } = detail || {}; void target; try { MAT_BC.postMessage(rest); } catch { /* a closed channel: the other tabs read on their next start */ } }
}
if (MAT_BC) MAT_BC.onmessage = e => { MATS = null; matEmit(e.data || {}, true); };

/* ---------- the library ---------- */
let MATS = null; // id → material, read once, then kept in step with every write
async function matAll() {
  if (!MATS) { MATS = new Map(); for (const m of await mall('materialy')) MATS.set(m.id, m); }
  return MATS;
}
async function matSave(m) { await mput('materialy', m); (await matAll()).set(m.id, m); }
/* what the list shows: the newest version of every material that was not deleted */
async function matList() {
  const all = [...(await matAll()).values()].filter(m => !m.gone);
  const top = new Map();
  for (const m of all) { const k = m.root || m.id, p = top.get(k); if (!p || (m.ver || 1) > (p.ver || 1)) top.set(k, m); }
  return [...top.values()].sort((a, b) => (b.added || 0) - (a.added || 0));
}
async function matVersions(m) { return [...(await matAll()).values()].filter(x => (x.root || x.id) === (m.root || m.id) && !x.gone).sort((a, b) => (a.ver || 1) - (b.ver || 1)); }
async function fileBlob(sha) { const f = await mget('pliki', sha); if (!f) throw new Error(t('brakuje zapisanego pliku')); return f.data; }

/* ---------- loading: a material becomes a three.js object ---------- */
const CLAY = 0xb9b2a6;
async function matLoad(m) {
  const { THREE, GLTFLoader, OBJLoader, MTLLoader } = swiat();
  const deps = new Map();
  for (const d of m.deps || []) deps.set(baseName(d.name).toLowerCase(), await fileBlob(d.sha));
  const urls = [], missing = new Set();
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier(u => {
    if (/^(data|blob):/.test(u)) return u;
    const k = decodeURIComponent(baseName(u.split('?')[0])).toLowerCase(), bl = deps.get(k);
    if (bl) { const x = URL.createObjectURL(bl); urls.push(x); return x; }
    missing.add(baseName(decodeURIComponent(u.split('?')[0])));
    return 'data:,';
  });
  // wait for what the loaders fetch after parsing (an .obj's textures), never for nothing
  let pending = 0, idle = null;
  const settled = new Promise(r => { idle = r; });
  const s0 = mgr.itemStart.bind(mgr), e0 = mgr.itemEnd.bind(mgr), x0 = mgr.itemError.bind(mgr);
  mgr.itemStart = u => { pending++; s0(u); };
  mgr.itemEnd = u => { e0(u); if (--pending <= 0) idle(); };
  mgr.itemError = u => { x0(u); missing.add(baseName(decodeURIComponent(String(u).split('?')[0]))); };
  let obj, anims = [];
  try {
    if (m.kind === 'tekstura') {
      const bl = await fileBlob(m.main.sha), url = URL.createObjectURL(bl); urls.push(url);
      const tex = await new THREE.TextureLoader(mgr).loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      const px = Math.max(tex.image?.width || 0, tex.image?.height || 0);
      if (px && px <= 256) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapNearestFilter; }
      obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      obj.position.y = 0.5;
      const g = new THREE.Group(); g.add(obj); obj = g;
    } else {
      const ext = extOf(m.main.name), bl = await fileBlob(m.main.sha);
      if (ext === 'bbmodel') {
        obj = bbModel(JSON.parse(await bl.text()), mgr, missing);
      } else if (ext === 'glb' || ext === 'gltf') {
        const data = ext === 'glb' ? await bl.arrayBuffer() : await bl.text();
        const loader = new GLTFLoader(mgr);
        // in claude.ai a page may not fetch() its own blob: URLs, which GLTFLoader's ImageBitmapLoader does for every
        // texture; an <img> may show them, so there the pictures go through TextureLoader
        if (PLACE === 'claude') loader.register(p => { p.textureLoader = new THREE.TextureLoader(p.options.manager); return { name: 'JASKINIA_img_textures' }; });
        const gl = await new Promise((res, rej) => loader.parse(data, '', res, rej));
        obj = gl.scene; anims = gl.animations || [];
      } else {
        const text = await bl.text(), mtl = (/^mtllib\s+(.+?)\s*$/m.exec(text) || [])[1];
        const ol = new OBJLoader(mgr);
        if (mtl && deps.has(baseName(mtl).toLowerCase())) {
          const mats = new MTLLoader(mgr).parse(await deps.get(baseName(mtl).toLowerCase()).text(), '');
          mats.preload();
          ol.setMaterials(mats);
        } else if (mtl) missing.add(baseName(mtl));
        obj = ol.parse(text);
        // an OBJ without its own materials gets clay instead of plain white
        obj.traverse(x => { if (x.isMesh && (!x.material || x.material.type === 'MeshPhongMaterial') && !x.material?.map) { const old = x.material; x.material = new THREE.MeshStandardMaterial({ color: old?.color && old.color.getHex() !== 0xffffff ? old.color : CLAY, roughness: 0.82 }); old?.dispose?.(); } });
      }
    }
    if (pending > 0) await Promise.race([settled, new Promise(r => setTimeout(r, 6000))]);
  } finally { setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 1500); }
  obj.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
  return { object: obj, animations: anims, missing: [...missing].filter(n => n && n !== ',' && !/^(blob|data):/.test(n) && !/^[0-9a-f-]{36}$/i.test(n)) };
}
/* the material's defaults: quarter turns about X, Y, Z and a scale, applied around its own origin */
/* Settings revisions (v6.1). Turning or scaling a material used to change it in place, so a place that pointed at the
   material's id would quietly change size and orientation (GPT-6, PR #4). Every change now adds a numbered revision
   and keeps the earlier ones: a place can pin the revision it was built with (Jaskinia.materialy.object(id, {set})) or
   follow the newest. A material from before v6.1 has one revision: its settings as they are. */
function matSets(m) { return m.sets && m.sets.length ? m.sets : [{ n: 1, rot: [...(m.rot || [0, 0, 0])], scale: m.scale || 1, at: m.added || 0 }]; }
function matSetting(m, n) {
  const list = matSets(m);
  if (n == null) return list[list.length - 1];
  const s = list.find(x => x.n === n);
  if (!s) throw new Error(t('materiał {0} nie ma ustawień nr {1}', m.id, n));
  return s;
}
function matWrap(obj, m, set) {
  const { THREE } = swiat();
  const cfg = set || { rot: m.rot || [0, 0, 0], scale: m.scale || 1 };
  const g = new THREE.Group(), r = cfg.rot || [0, 0, 0];
  g.name = m.name;
  g.rotation.set(r[0] * Math.PI / 2, r[1] * Math.PI / 2, r[2] * Math.PI / 2, 'XYZ');
  const s = cfg.scale || 1;
  g.scale.set(s, s, s);
  g.add(obj);
  const outer = new THREE.Group(); outer.add(g); outer.name = m.name;
  return outer;
}
/* stand it on the ground in the middle (for looking at it; a place keeps the material's own origin) */
function matGround(outer) {
  const { THREE } = swiat();
  outer.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(outer);
  if (box.isEmpty()) return outer;
  const c = box.getCenter(new THREE.Vector3());
  outer.children[0].position.set(-c.x, -box.min.y, -c.z);
  return outer;
}
function matFacts(obj, anims) {
  const { THREE } = swiat();
  let tris = 0, meshes = 0, skin = false;
  const mats = new Set(), texs = new Set();
  obj.traverse(x => {
    if (!x.isMesh) return;
    meshes++;
    const g = x.geometry;
    tris += (g.index ? g.index.count : g.attributes.position?.count || 0) / 3;
    if (x.isSkinnedMesh) skin = true;
    for (const mt of [].concat(x.material || [])) { mats.add(mt); for (const k of Object.keys(mt)) { const v = mt[k]; if (v && v.isTexture) texs.add(v.source || v); } }
  });
  obj.updateMatrixWorld(true);
  const sz = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  return { tris: Math.round(tris), meshes, mats: mats.size, texs: texs.size, anims: (anims || []).map(a => a.name || '—'), skin, size: [sz.x, sz.y, sz.z] };
}

/* the small picture of a material, drawn by one hidden stage that goes away when idle */
let thumbStage = null, thumbIdle = 0;
async function matThumb(obj) {
  if (!thumbStage) {
    const host = h('div', { class: 'sw-thumbhost', 'aria-hidden': 'true' });
    document.body.append(host);
    thumbStage = swStage(host, { still: true });
  }
  clearTimeout(thumbIdle);
  thumbIdle = setTimeout(() => { if (thumbStage) { const hh = thumbStage.host; thumbStage.dispose(); hh.remove(); thumbStage = null; } }, 8000);
  const st = thumbStage;
  st.paint();
  st.set(obj);
  st.controls.update();
  st.renderer.setSize(384, 240, false); st.camera.aspect = 384 / 240; st.camera.updateProjectionMatrix();
  st.renderer.render(st.scene, st.camera);
  const url = st.canvas.toDataURL('image/webp', 0.86);
  st.root.remove(obj); // the caller owns it
  return url.startsWith('data:image/webp') ? url : st.canvas.toDataURL('image/jpeg', 0.86);
}

/* ---------- import ---------- */
/* A model names its files by relative uri. From a folder, two models may each have their own "texture.png" (dom/ and
   wieza/): v6 matched by bare name, so both models took both pictures and one of them showed the other's (Feniks GPT's
   counterexample, 18 Oct). The file is now the one at that path beside the model, or the nearest one with that name. */
const relOf = f => String(f.rel || f.blob?.webkitRelativePath || '').replace(/\\/g, '/');
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
const normPath = p => { const o = []; for (const seg of String(p).split('/')) { if (seg === '..') o.pop(); else if (seg && seg !== '.') o.push(seg); } return o.join('/').toLowerCase(); };
function sideFor(side, from, uri) {
  const want = baseName(uri).toLowerCase(), cands = side.filter(s => baseName(s.name).toLowerCase() === want);
  if (cands.length < 2) return cands[0] || null;
  const fromRel = relOf(from), at = normPath(dirOf(fromRel) + String(uri).replace(/\\/g, '/')), d = dirOf(fromRel).toLowerCase();
  return cands.find(s => normPath(relOf(s)) === at) || cands.find(s => dirOf(relOf(s)).toLowerCase() === d) || cands.find(s => relOf(s).toLowerCase().startsWith(d)) || null;
}
const uriOf = u => { try { return decodeURIComponent(u); } catch { return u; } };
/* files: File objects (or {name, blob, rel}); from: where they came from ('plik' or 'repo:Owner/Repo/path') */
async function matImport(files, from = 'plik', label, onStep) {
  const list = [...files].map(f => ({ name: f.name, blob: f.blob || f, rel: f.rel || '' })).filter(f => f.name);
  const mains = list.filter(f => MAT_MODEL.test(f.name));
  const side = list.filter(f => !MAT_MODEL.test(f.name) && MAT_SIDE.test(f.name));
  const pics = list.filter(f => MAT_PIC.test(f.name));
  const skipped = list.filter(f => !MAT_MODEL.test(f.name) && !MAT_SIDE.test(f.name)).map(f => f.name);
  const out = [];
  const fresh = new Set(); // bytes this import wrote: what a failed model leaves behind is removed at the end
  const store = async f => { const sha = await sha256(f.blob); if (!(await mget('pliki', sha))) { await mput('pliki', { sha, name: baseName(f.name), size: f.blob.size, data: f.blob }); fresh.add(sha); } return { name: baseName(f.name), sha, size: f.blob.size }; };
  const all = await matAll();
  const used = new Set();
  const jobs = mains.length ? mains.map(f => ({ main: f, kind: 'model' })) : pics.map(f => ({ main: f, kind: 'tekstura' }));
  // names: a file's stem, but "model.gltf" in hull/ and in fuel/ are two things, not two versions of one
  const GENERIC = /^(model|scene|untitled|mesh|object|export|texture|new|test)$/i;
  const stems = new Map();
  for (const job of jobs) { const k = stem(job.main.name).toLowerCase(); stems.set(k, (stems.get(k) || 0) + 1); }
  const nameOf = job => {
    const st0 = stem(job.main.name), rel = relOf(job.main);
    const parent = rel.split('/').slice(-2, -1)[0] || '';
    return parent && rel.includes('/') && (GENERIC.test(st0) || stems.get(st0.toLowerCase()) > 1) ? parent + ' · ' + st0 : st0;
  };
  let step = 0;
  for (const job of jobs) {
    onStep?.(++step, jobs.length, job.main.name);
    const main = await store(job.main);
    // the main file's companions: for a .gltf its buffers and pictures, for an .obj its .mtl and the .mtl's pictures,
    // each found by its path beside the file that names it (sideFor)
    let deps = [];
    if (job.kind === 'model' && extOf(main.name) !== 'glb') {
      const txt = await job.main.blob.text();
      const wanted = []; // { uri, from }
      if (extOf(main.name) === 'gltf') { try { const j = JSON.parse(txt); for (const x of [...(j.buffers || []), ...(j.images || [])]) if (x.uri && !/^data:/.test(x.uri)) wanted.push({ uri: uriOf(x.uri), from: job.main }); } catch { /* the loader will say */ } }
      else {
        const ml = (/^mtllib\s+(.+?)\s*$/m.exec(txt) || [])[1];
        if (ml) {
          wanted.push({ uri: ml, from: job.main });
          const mf = sideFor(side, job.main, ml);
          if (mf) for (const mm of (await mf.blob.text()).matchAll(/^\s*map_\w+\s+(?:-\S+\s+\S+\s+)*(.+?)\s*$/gm)) wanted.push({ uri: mm[1], from: mf });
        }
      }
      const took = new Set();
      for (const w of wanted) { const s = sideFor(side, w.from, w.uri); if (s && !took.has(s)) { took.add(s); deps.push(await store(s)); used.add(s); } }
    }
    deps.sort((a, b) => a.name.localeCompare(b.name));
    const id = 'm' + (deps.length ? (await sha256(new Blob([main.sha + deps.map(d => d.name + d.sha).join('')]))) : main.sha).slice(0, 20);
    if (all.has(id) && !all.get(id).gone) { out.push({ id, again: true }); continue; }
    const name = (jobs.length === 1 && label) || nameOf(job);
    const prev = [...all.values()].filter(x => !x.gone && x.kind === job.kind && x.name.toLowerCase() === name.toLowerCase()).sort((a, b) => (b.ver || 1) - (a.ver || 1))[0];
    const m = all.get(id) || { id, name, kind: job.kind, main, deps, added: Date.now(), from, rot: prev ? prev.rot : [0, 0, 0], scale: prev ? prev.scale : 1,
      root: prev ? (prev.root || prev.id) : id, ver: prev ? (prev.ver || 1) + 1 : 1 };
    delete m.gone;
    try {
      const { object, animations, missing } = await matLoad(m);
      m.missing = missing;
      const wrapped = matGround(matWrap(object, m));
      m.facts = matFacts(wrapped, animations);
      m.facts.src = '';
      m.thumb = await matThumb(wrapped);
      swDispose(wrapped);
    } catch (err) {
      out.push({ id, error: err.message || String(err), name: main.name });
      continue;
    }
    await matSave(m);
    out.push({ id, name: m.name, ver: m.ver, prev: prev ? prev.id : null });
  }
  if (fresh.size && out.some(x => x.error)) { // bytes of a model that could not be read do not stay in the browser for nothing
    const refd = new Set();
    for (const x of (await matAll()).values()) { refd.add(x.main?.sha); for (const d of x.deps || []) refd.add(d.sha); }
    for (const sha of fresh) if (!refd.has(sha)) { try { await mdo('pliki', 'readwrite', os => os.delete(sha)); } catch { /* kept; harmless */ } }
  }
  const unusedSide = mains.length ? side.filter(s => !used.has(s) && !/\.(bin|mtl)$/i.test(s.name) && !MAT_PIC.test(s.name)).map(s => s.name) : [];
  if (out.some(x => !x.error && !x.again)) matEmit({ added: out.filter(x => !x.error && !x.again).map(x => x.id) });
  return { done: out, skipped: [...skipped, ...unusedSide] };
}
/* what the toast says after an import */
function matSay(res, sel) {
  const ok = res.done.filter(x => !x.error && !x.again), again = res.done.filter(x => x.again), bad = res.done.filter(x => x.error);
  const parts = [];
  if (ok.length === 1) parts.push(ok[0].prev ? t('Nowa wersja: {0} (v{1})', ok[0].name, ok[0].ver) : t('Dodano: {0}', ok[0].name));
  else if (ok.length) parts.push(t('Dodano: {0}', tn(ok.length, 'materiał', 'materiały', 'materiałów')));
  if (again.length) parts.push(t('już w bibliotece: {0}', tn(again.length, 'plik', 'pliki', 'plików')));
  if (bad.length) parts.push(t('nie dało się wczytać: {0} ({1})', bad.map(x => x.name).join(', '), bad[0].error));
  if (res.skipped.length) parts.push(t('pominięte: {0}', res.skipped.slice(0, 4).join(', ')));
  if (parts.length) jtoast(parts.join(' · '), null, bad.length ? 9000 : 4200);
  const first = ok[0] || again[0];
  if (first && sel) sel(first.id);
  return first ? first.id : null;
}

/* ---------- Jozz's own models from his public repositories ---------- */
const MAT_REPO = [
  ['Dom', 'Box3d_FunProject', 'data/meshes/building.obj', 'Box3D'],
  ['Schody', 'Box3d_FunProject', 'data/meshes/stairs.obj', 'Box3D'],
  ['Mapa testowa', 'Box3d_FunProject', 'data/meshes/test_map01.obj', 'Box3D'],
  ['Nadwozie', 'Box3d_FunProject', 'assets/source/Nadwozie.gltf', 'Box3D · Blockbench'],
  ['Koła terenowe', 'Box3d_FunProject', 'assets/source/Offroad_Big_Wheels.gltf', 'Box3D · Blockbench'],
  ['Wywrotka', 'Box3d_FunProject', 'assets/source/Asset_Dumper.gltf', 'Box3D · Blockbench'],
  ['M6 R3', 'JV-Box3D-Web-Public', 'vehicles/m6-owner-r3/models/m6-owner-full-rig-r3.glb', 'JV Web'],
  ['Kadłub', 'voxel-aeronautics-workshop', 'assets/visual_packs/local_working_visuals/models/blocks/hull/model.gltf', 'VAW · Blockbench'],
  ['Silnik', 'voxel-aeronautics-workshop', 'assets/visual_packs/local_working_visuals/models/blocks/thruster/model.gltf', 'VAW · Blockbench'],
  ['Animacja testowa', 'voxel-aeronautics-workshop', 'tools/blockbench_import_studio/assets/real_blockbench_regression/test_anim.gltf', 'VAW · Blockbench'],
];
const repoUrl = (repo, path) => `https://raw.githubusercontent.com/Jozzpoly/${repo}/main/${path}`;
async function matFromRepo(row) {
  const [label, repo, path] = row;
  const r = await fetch(repoUrl(repo, path), { cache: 'no-cache' });
  if (!r.ok) throw new Error(t('repo odpowiedziało {0}', r.status));
  const blob = await r.blob();
  return matImport([{ name: baseName(path), blob }], 'repo:Jozzpoly/' + repo + '/' + path, label);
}

/* ---------- the window ---------- */
function renderMaterialy(box, c) {
  const st = c.win.st;
  const view = h('div', { class: 'mt-view' });
  const cap = h('div', { class: 'mt-cap' });
  const vers = h('div', { class: 'mt-vers' });
  const bar = h('div', { class: 'mt-bar' });
  const msg = h('div', { class: 'mt-msg', hidden: true });
  const empty = h('div', { class: 'mt-empty', hidden: true });
  const dropHint = h('div', { class: 'mt-drophint', hidden: true }, h('b', { text: t('Upuść tutaj') }), h('span', { text: t('pliki .bbmodel, modele .glb, .gltf, .obj (z plikami obok) albo obrazki') }));
  view.append(cap, vers, bar, msg, empty, dropHint);
  const grid = h('div', { class: 'mt-grid', role: 'listbox', 'aria-label': t('Materiały') });
  const count = h('span', { class: 'mt-count' });
  const input = h('input', { type: 'file', multiple: true, hidden: true, accept: '.bbmodel,.glb,.gltf,.obj,.mtl,.bin,.png,.jpg,.jpeg,.webp,.gif' });
  const addB = h('button', { class: 'jk-tb mt-add', type: 'button', title: t('Dodaj pliki z dysku (albo upuść je gdziekolwiek w Jaskini)'), onclick: () => input.click() }, icon('plus', 12), h('span', { text: t('Dodaj') }));
  // a whole folder at once (Blockbench's saves): its models with their pictures; files of other kinds are not read
  const dirIn = h('input', { type: 'file', multiple: true, hidden: true, webkitdirectory: '', class: 'mt-dirin' });
  const dirB = h('button', { class: 'jk-tb mt-add', type: 'button', title: t('Dodaj cały folder: modele z ich teksturami, reszta plików nie jest czytana'), onclick: () => dirIn.click() }, icon('t_folder', 12), h('span', { text: t('Folder') }));
  const repoBox = h('section', { class: 'mt-repo' });
  const side = h('div', { class: 'mt-side' }, h('div', { class: 'mt-head' }, h('b', { text: t('Materiały') }), count, dirB, addB, input, dirIn), grid, repoBox,
    h('p', { class: 'mt-note', text: t('Pliki zostają w tej przeglądarce. Upuść model w dowolne miejsce Jaskini, a trafi tutaj. Ten sam plik z nową treścią to nowa wersja, nie podmiana.') }));
  const root = h('div', { class: 'mt' }, view, side);
  box.append(h('div', { class: 'mt-c' }, root));

  let stage = null, cur = null, curObj = null, mixer = null, untickMixer = null, actions = [], walk = null, human = !!(c.view()?.human ?? true), alive = true, token = 0;
  const say = (text, kind) => { msg.hidden = !text; msg.textContent = text || ''; msg.className = 'mt-msg' + (kind ? ' ' + kind : ''); };
  const ensureStage = () => {
    if (stage) return stage;
    try { stage = swStage(view); } catch (err) { say(t('Nie udało się uruchomić 3D: {0}', err.message), 'err'); return null; }
    view.prepend(stage.canvas);
    window.__jkStage = stage; // the last 3D stage opened: for tests and for an agent looking at what Jozz sees
    return stage;
  };
  const sel = id => { if (st.sel !== id) { st.sel = id; c.save(); } show(id); };
  async function drawList() {
    const items = await matList();
    if (!alive) return;
    count.textContent = items.length ? String(items.length) : '';
    grid.replaceChildren(...items.map(m => {
      const d = m.facts?.size || [0, 0, 0];
      const tile = h('button', { class: 'mt-tile' + (cur && (cur.root || cur.id) === (m.root || m.id) ? ' on' : ''), type: 'button', role: 'option', 'aria-selected': String(!!cur && (cur.root || cur.id) === (m.root || m.id)), title: m.name, onclick: () => sel(m.id) },
        h('span', { class: 'mt-pic' }, m.thumb ? h('img', { src: m.thumb, alt: '', draggable: 'false' }) : null, (m.ver || 1) > 1 ? h('i', { class: 'mt-v', text: 'v' + m.ver }) : null),
        h('span', { class: 'mt-name', text: m.name }),
        h('span', { class: 'mt-dim', text: m.kind === 'tekstura' ? t('tekstura') : `${fmtM(Math.max(d[0], d[2]))} · ${fmtM(d[1])}` }));
      return tile;
    }));
    empty.hidden = !!items.length;
    if (!items.length) drawEmpty();
    drawRepo(items);
  }
  function drawEmpty() {
    empty.replaceChildren(h('div', { class: 'mt-empty-in' },
      h('b', { text: t('Przynieś swoje modele') }),
      h('p', { text: t('Upuść tu pliki z Blockbencha (.bbmodel, prosto z zapisu) albo eksporty z Blockbencha i Blendera: .glb, .gltf (z .bin i teksturami obok), .obj (z .mtl). Zobaczysz je w świetle, przy człowieku 1,8 m, i wejdziesz do środka.') }),
      h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, icon('plus', 14), t('Wybierz pliki'))));
  }
  function drawRepo(items) {
    if (PLACE === 'claude') { repoBox.replaceChildren(h('p', { class: 'mt-note', text: t('W claude.ai ta strona nie sięga do Twoich repo. W Jaskini z pliku albo z serwera przyniesiesz stąd swoje modele z GitHuba.') })); return; }
    const have = new Set(items.map(m => m.from));
    const rows = MAT_REPO.filter(r => !have.has('repo:Jozzpoly/' + r[1] + '/' + r[2]));
    if (!rows.length) { repoBox.replaceChildren(); return; }
    repoBox.replaceChildren(h('h4', { text: t('Z Twoich repo') }),
      h('div', { class: 'jk-chips' }, rows.map(r => h('button', { class: 'jk-chip mt-rchip', type: 'button', title: `${r[1]}/${r[2]}`, onclick: async ev => {
        const b = ev.currentTarget; b.disabled = true; b.classList.add('busy');
        try { const res = await matFromRepo(r); matSay(res, sel); } catch (err) { jtoast(t('Nie przyniosłem {0}: {1}', r[0], err.message)); }
        finally { if (b.isConnected) { b.disabled = false; b.classList.remove('busy'); } }
      } }, icon('t_materialy', 13), h('span', { text: r[0] }), h('small', { text: r[3] })))));
  }
  function drawCap(m) {
    const f = m.facts || {}, d = f.size || [0, 0, 0];
    const facts = m.kind === 'tekstura' ? [t('tekstura')] : [
      `${fmtM(d[0])} × ${fmtM(d[1])} × ${fmtM(d[2])}`,
      tn(f.tris || 0, 'trójkąt', 'trójkąty', 'trójkątów'),
      f.texs ? tn(f.texs, 'tekstura', 'tekstury', 'tekstur') : t('bez tekstur'),
      f.skin ? t('ze szkieletem') : null,
    ].filter(Boolean);
    const warn = [];
    if (m.missing?.length) warn.push(t('brakuje plików: {0}. Upuść je razem z modelem.', m.missing.join(', ')));
    if (m.kind === 'model' && Math.max(...d) > 0 && Math.max(...d) < 0.3) warn.push(t('Bardzo mały przy człowieku. Może skala ×16 (piksele Blockbencha) albo ×100 (centymetry)?'));
    if (m.kind === 'model' && Math.max(...d) > 400) warn.push(t('Bardzo duży. Może skala ×1/100 (centymetry)?'));
    cap.replaceChildren(h('b', { text: m.name }), h('span', { text: facts.join(' · ') }), ...warn.map(w => h('em', { text: w })));
  }
  async function drawVers(m) {
    const vs = await matVersions(m);
    vers.replaceChildren(...(vs.length > 1 ? vs.map(v => h('button', { class: 'jk-tb' + (v.id === m.id ? ' on' : ''), type: 'button', title: t('wersja {0} z {1}', v.ver || 1, dshort(new Date(v.added || 0))), onclick: () => sel(v.id) }, 'v' + (v.ver || 1))) : []));
  }
  function drawBar(m) {
    const qt = (axis, dir) => async () => { const r = [...(m.rot || [0, 0, 0])]; r[axis] = (r[axis] + dir + 4) % 4; await setDefaults(m, { rot: r }); };
    const sc = v => async () => { await setDefaults(m, { scale: v }); };
    const isS = v => Math.abs((m.scale || 1) - v) < 1e-9;
    bar.replaceChildren(...[
      h('button', { class: 'jk-tb' + (human ? ' on' : ''), type: 'button', title: t('Człowiek 1,8 m obok, do porównania'), onclick: ev => { human = !human; c.setView({ ...(c.view() || {}), human }); ev.currentTarget.classList.toggle('on', human); stage?.human(human && !!curObj); } }, icon('t_czlowiek', 13), h('span', { text: t('1,8 m') })),
      h('button', { class: 'jk-tb', type: 'button', title: t('Obróć materiał o ćwierć obrotu (zostaje jego domyślnym ustawieniem)'), onclick: ev => openMenu(ev.currentTarget, [
        { head: t('Obrót materiału') },
        { label: t('Postaw: X +90°'), act: qt(0, 1) }, { label: t('Postaw: X −90°'), act: qt(0, -1) },
        { label: t('Obróć: Y +90°'), act: qt(1, 1) }, { label: t('Obróć: Y −90°'), act: qt(1, -1) },
        { label: t('Przechyl: Z +90°'), act: qt(2, 1) }, { label: t('Przechyl: Z −90°'), act: qt(2, -1) },
        { label: t('Jak w pliku'), act: async () => setDefaults(m, { rot: [0, 0, 0] }) },
      ]) }, icon('t_obrot', 13), h('span', { text: t('Obrót') })),
      h('button', { class: 'jk-tb', type: 'button', title: t('Skala materiału: ile metrów ma jedna jednostka pliku'), onclick: ev => openMenu(ev.currentTarget, [
        { head: t('Skala: teraz ×{0}', fmtScale(m.scale || 1)) },
        { label: '×1', desc: t('jednostka = metr (Blender, glTF)'), act: sc(1), checked: isS(1) },
        { label: '×1/16', desc: t('jednostka = piksel Blockbencha'), act: sc(1 / 16), checked: isS(1 / 16) },
        { label: '×16', desc: t('model był zmniejszony o 16'), act: sc(16), checked: isS(16) },
        { label: '×1/100', desc: t('jednostka = centymetr'), act: sc(0.01), checked: isS(0.01) },
        { label: '×100', desc: t('model jest 100 razy za mały'), act: sc(100), checked: isS(100) },
        { label: '×2', act: sc((m.scale || 1) * 2) }, { label: '×½', act: sc((m.scale || 1) / 2) },
      ]) }, h('span', { text: t('Skala ×{0}', fmtScale(m.scale || 1)) })),
      actions.length ? h('button', { class: 'jk-tb', type: 'button', title: t('Animacje z pliku'), onclick: ev => openMenu(ev.currentTarget, [
        { head: t('Animacje') },
        ...actions.map((a, i) => ({ label: a.getClip().name || t('animacja {0}', i + 1), checked: a.isRunning(), act: () => { for (const b of actions) b.stop(); a.reset().play(); stage?.redraw(); } })),
        { label: t('Zatrzymaj'), act: () => { for (const b of actions) b.stop(); stage?.redraw(); } },
      ]) }, icon('t_gra', 13), h('span', { text: tn(actions.length, 'animacja', 'animacje', 'animacji') })) : null,
      h('span', { class: 'mt-gap' }),
      h('button', { class: 'jk-tb mt-del', type: 'button', title: t('Usuń z biblioteki (da się cofnąć)'), onclick: () => remove(m) }, icon('trash', 13)),
      h('button', { class: 'mt-go', type: 'button', title: t('Stań obok w skali 1:1 i chodź (WASD, mysz). Esc wychodzi.'), onclick: () => enter() }, icon('t_wejdz', 15), h('span', { text: t('Wejdź') }))].filter(Boolean));
  }
  async function setDefaults(m, patch) {
    const list = matSets(m);
    Object.assign(m, patch);
    const n = list[list.length - 1].n + 1;
    m.sets = [...list, { n, rot: [...(m.rot || [0, 0, 0])], scale: m.scale || 1, at: Date.now() }];
    m.set = n;
    try {
      const { object, animations } = await matLoad(m);
      const wrapped = matGround(matWrap(object, m));
      m.facts = { ...matFacts(wrapped, animations), src: m.facts?.src || '' };
      m.thumb = await matThumb(wrapped);
      swDispose(wrapped);
    } catch { /* keep the old picture */ }
    await matSave(m);
    matEmit({ changed: [m.id] });
    show(m.id, true);
  }
  async function remove(m) {
    m.gone = Date.now();
    await matSave(m);
    matEmit({ removed: [m.id] });
    jtoast(t('Usunięto z biblioteki: {0}', m.name), { label: t('Cofnij'), act: async () => { delete m.gone; await matSave(m); matEmit({ changed: [m.id] }); sel(m.id); } });
    const rest = await matList();
    sel(rest[0]?.id || null);
  }
  async function show(id, keepView) {
    const my = ++token;
    if (walk) { walk.end(); walk = null; }
    const all = await matAll();
    const m = id ? all.get(id) : null;
    if (my !== token || !alive) return;
    cur = m && !m.gone ? m : null;
    for (const tile of grid.children) tile.classList.toggle('on', !!cur && tile.title === cur.name);
    if (!cur) { cap.replaceChildren(); vers.replaceChildren(); bar.replaceChildren(); if (stage) { stage.set(null); stage.human(false); } curObj = null; drawList(); return; }
    drawCap(cur); drawVers(cur);
    bar.replaceChildren(); curObj = null; // nothing can be entered until this one stands on the stage
    const S = ensureStage();
    if (!S) return;
    say(t('Wczytuję {0}…', cur.name));
    try {
      const { object, animations, missing } = await matLoad(cur);
      if (my !== token || !alive) { swDispose(object); return; }
      if (missing.length && !(cur.missing || []).length) { cur.missing = missing; drawCap(cur); }
      curObj = matGround(matWrap(object, cur));
      const cam = keepView ? S.camera.position.clone() : null, tgt = keepView ? S.controls.target.clone() : null;
      S.set(curObj);
      if (cam) { S.camera.position.copy(cam); S.controls.target.copy(tgt); S.controls.update(); }
      mixer?.stopAllAction(); untickMixer?.(); untickMixer = null; mixer = null;
      actions = [];
      if (animations.length) {
        const { THREE } = swiat();
        mixer = new THREE.AnimationMixer(curObj);
        actions = animations.map(a => mixer.clipAction(a));
        actions[0].play();
        untickMixer = S.tick(dt => { mixer.update(dt); return actions.some(a => a.isRunning()); });
      }
      S.human(human, !!keepView);
      drawBar(cur);
      say('');
    } catch (err) { say(t('Nie dało się pokazać {0}: {1}', cur.name, err.message), 'err'); }
    drawList();
  }
  function enter() {
    if (!stage || !curObj) return;
    if (walk) { walk.end(); walk = null; return; }
    logEv(t('wejście: {0}', cur.name));
    walk = swWalk(stage, { lock: true, onEnd: () => { walk = null; root.classList.remove('walking'); if (window.__jkWalk) delete window.__jkWalk; } });
    window.__jkWalk = walk; // for the tests and for a curious agent: where the body is
    root.classList.add('walking');
  }
  // files: the button, a drop on this window (the drop anywhere else in Jaskinia comes as an event)
  input.addEventListener('change', async () => { const fs = [...input.files]; input.value = ''; if (fs.length) matSay(await matImport(fs), sel); });
  dirIn.addEventListener('change', async () => {
    const all = [...dirIn.files]; dirIn.value = '';
    const fs = all.filter(f => !/(^|\/)(node_modules|\.git)\//.test(f.webkitRelativePath || '') && (MAT_MODEL.test(f.name) || MAT_SIDE.test(f.name)));
    if (!fs.some(f => MAT_MODEL.test(f.name))) { jtoast(t('W tym folderze nie ma modeli (.bbmodel, .glb, .gltf, .obj).')); return; }
    say(t('Wczytuję folder…'));
    const res = await matImport(fs, 'folder', null, (i, n, name) => say(t('Wczytuję {0} z {1}: {2}', i, n, name)));
    say('');
    matSay(res, sel);
  });
  let dragN = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  root.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragN++; dropHint.hidden = false; });
  root.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; dropHint.hidden = true; } });
  root.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  root.addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); e.stopPropagation(); dragN = 0; dropHint.hidden = true;
    matSay(await matImport([...e.dataTransfer.files]), sel);
  });
  const onLib = e => {
    const d = e.detail || {};
    if (d.target === c.id && d.added?.length) { sel(d.added[0]); return; }
    if (d.target === c.id && d.show) { matAll().then(all => { if (!alive) return; const m = all.get(d.show); if (m && !m.gone) sel(d.show); else jtoast(t('Nie ma w bibliotece materiału {0}.', d.show)); }); return; }
    if (cur && (d.removed || []).includes(cur.id)) return; // remove() picks the next one itself
    drawList();
  };
  document.addEventListener('jk:materialy', onLib);
  c.onDispose(() => {
    alive = false;
    document.removeEventListener('jk:materialy', onLib);
    if (walk) walk.end();
    mixer?.stopAllAction();
    stage?.dispose();
  });
  // the theme can change under a window that is never rebuilt
  const mo = new MutationObserver(() => { stage?.paint(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-jk', 'data-theme', 'style'] });
  c.onDispose(() => mo.disconnect());
  matAll().then(all => {
    if (!alive) return;
    drawList();
    if (st.sel && all.get(st.sel) && !all.get(st.sel).gone) { show(st.sel); return; }
    if (st.sel) jtoast(t('Nie ma w bibliotece materiału {0}.', st.sel));
    matList().then(items => { if (alive && items[0]) sel(items[0].id); });
  })
    .catch(err => { say(t('Biblioteka materiałów nie działa w tej przeglądarce: {0}', err.message), 'err'); });
}
function fmtScale(v) {
  const f = [[1 / 16, '1/16'], [0.01, '1/100'], [0.5, '½'], [0.25, '¼']].find(x => Math.abs(x[0] - v) < 1e-9);
  if (f) return f[1];
  return (Math.round(v * 1000) / 1000).toString().replace('.', prefs.lang === 'en' ? '.' : ',');
}

/* one quiet word for Jozz on his first start of v6, when he comes from an older Jaskinia (a first start ever has its own hint) */
const HAD_STORE = !!lsGet('jaskinia:v2'); // read before the shell boots and writes it
function v6Hint() {
  if (!HAD_STORE || lsGet('jaskinia:v6') === '1') return;
  lsSet('jaskinia:v6', '1');
  setTimeout(() => jtoast(t('Nowe w v6: Materiały. Upuść swój model z Blockbencha albo Blendera, zobacz go w skali przy człowieku i wejdź do środka.'),
    { label: t('Otwórz'), act: () => openWinOfType('materialy', { w: 0.72, h: 0.84 }) }, 15000), 1500);
}

/* a file dropped anywhere in Jaskinia goes to the materials (the first Materiały window, or a new one) */
function matDropAnywhere() {
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragover', e => { if (hasFiles(e) && !e.defaultPrevented) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('drop', async e => {
    if (!hasFiles(e) || e.defaultPrevented) return;
    e.preventDefault(); // a dropped file never navigates away from Jaskinia
    const fs = [...e.dataTransfer.files];
    if (!fs.some(f => MAT_MODEL.test(f.name) || MAT_PIC.test(f.name))) { jtoast(t('Tego tu nie wezmę: {0}. Materiały to .bbmodel, .glb, .gltf, .obj i obrazki.', fs.map(f => f.name).slice(0, 3).join(', '))); return; }
    const id = openWinOfType('materialy', { w: 0.7, h: 0.82 }); // the one already open comes forward, or a new one
    const res = await matImport(fs);
    const first = matSay(res, null);
    if (first) matEmit({ added: [first], target: id });
  });
}

/* ---------- registration ---------- */
ICONS.t_materialy = 'M8 1.8 13.6 5v6.1L8 14.2 2.4 11.1V5z M2.4 5 8 8.1 13.6 5 M8 8.1v6.1';
ICONS.t_wejdz = 'M9.5 2.5h4v11h-4 M2 8h7.5 M6.5 5l3 3-3 3';
ICONS.t_czlowiek = 'M8 2a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 8 2z M5.5 14l.7-5.2-1.4-1.6 1.6-1.3h3.2l1.6 1.3-1.4 1.6.7 5.2 M8 9.5V14';
ICONS.t_folder = 'M2 4.5h4l1.5 1.5H14v7H2z';
ICONS.t_obrot = 'M12.8 6.2A5 5 0 1 0 13 9.5 M13.2 3v3.4H9.8';
if (!ICONS.plus) ICONS.plus = 'M8 3v10 M3 8h10';
if (!ICONS.trash) ICONS.trash = 'M3 4.5h10 M6.5 4.5V3h3v1.5 M4.5 4.5l.7 9h5.6l.7-9';
GROUPS.splice(GROUPS.findIndex(g => g[0] === 'misc'), 0, ['studio', 'Studio']);
Object.assign(TYPES, {
  materialy: { key: 'materialy', group: 'studio', live: true, liveKey: () => ['m'], fill: true, noZoom: true, name: 'Materiały', glyph: 't_materialy',
    desc: 'Twoje modele i tekstury: upuść pliki, zobacz je w świetle, sprawdź skalę przy człowieku 1,8 m i wejdź do środka.', render: renderMaterialy },
});
matDropAnywhere();
