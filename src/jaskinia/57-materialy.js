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
/* changes one material record inside one transaction: read and written together, so what another tab saved a moment ago
   is changed, never replaced by an older copy held in memory. fn returns false when nothing needs writing. */
async function mpatch(id, fn) {
  const db = await mdb();
  return new Promise((res, rej) => {
    const tx = db.transaction('materialy', 'readwrite'), os = tx.objectStore('materialy');
    let out = null;
    const rq = os.get(id);
    rq.onsuccess = () => { out = rq.result || null; if (out && fn(out) !== false) os.put(out); };
    tx.oncomplete = () => res(out);
    tx.onerror = tx.onabort = () => rej(tx.error || new Error('IndexedDB'));
  });
}
async function sha256(blob) {
  const buf = await blob.arrayBuffer();
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const baseName = n => String(n || '').split(/[\\/]/).pop();
const stem = n => baseName(n).replace(/\.[^.]+$/, '');
const extOf = n => (/\.([^.]+)$/.exec(baseName(n)) || [])[1]?.toLowerCase() || '';
/* Settings revisions that survive older builds (v6.3). v6 and v6.1 tabs write a whole material record from memory, so an
   editor left open in an older tab could drop the revisions a newer one had made, and a place pinned to {material, set: 2}
   would no longer find its look (GPT's real-browser run, 18 Oct); two new tabs could also both number their change 2.
   The revisions now also live in a second database that older builds never open, and a new revision is numbered and
   written there in one transaction, so two tabs never take the same number. */
const SDB = 'jaskinia-materialy-ustawienia';
const MAT_APPLY_GRACE = 60e3; // how long a record may stay behind a revision another tab is applying (see matSets)
let sdbP = null;
function sdb() {
  if (!sdbP) sdbP = new Promise((res, rej) => {
    let rq;
    try { rq = indexedDB.open(SDB, 1); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('sets')) db.createObjectStore('sets', { keyPath: 'id' }); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error || new Error('IndexedDB'));
  });
  sdbP.catch(() => { sdbP = null; });
  return sdbP;
}
let SETS = null; // material id → its revisions, as the second database holds them
async function setsAll() {
  if (SETS) return SETS;
  const m = new Map();
  try { const db = await sdb(); await new Promise((res, rej) => { const rq = db.transaction('sets', 'readonly').objectStore('sets').getAll(); rq.onsuccess = () => { for (const r of rq.result || []) m.set(r.id, arr(r.sets)); res(); }; rq.onerror = () => rej(rq.error); }); }
  catch { /* no second database here: each record's own list is all there is */ }
  SETS = m;
  return SETS;
}
const unionSets = (...lists) => { const by = new Map(); for (const l of lists) for (const x of arr(l)) if (x && x.n != null && !by.has(x.n)) by.set(x.n, x); return [...by.values()].sort((a, b) => a.n - b.n); };
/* writes the whole list of revisions (list) and, when cfg is given, appends one more numbered after everything known; one
   transaction, so two tabs appending at once get two numbers. Resolves with { n: the new number (or the last), list }. */
async function setsWrite(id, list, cfg) {
  const db = await sdb();
  return new Promise((res, rej) => {
    const tx = db.transaction('sets', 'readwrite'), os = tx.objectStore('sets');
    let out = [], n = 0;
    const rq = os.get(id);
    rq.onsuccess = () => {
      out = unionSets(rq.result && rq.result.sets, list);
      n = out.length ? out[out.length - 1].n : 0;
      if (cfg) { n += 1; out.push({ n, ...cfg }); }
      os.put({ id, sets: out });
    };
    tx.oncomplete = () => { if (SETS) SETS.set(id, out); res({ n, list: out }); }; // the cache may have been dropped meanwhile (another tab)
    tx.onerror = tx.onabort = () => rej(tx.error || new Error('IndexedDB'));
  });
}

/* every tab of this Jaskinia shares the library: a change in one tab tells the others, which read it again (v6.1) */
const MAT_BC = (() => { try { return new BroadcastChannel('jaskinia-materialy'); } catch { return null; } })();
function matEmit(detail, fromOther) {
  document.dispatchEvent(new CustomEvent('jk:materialy', { detail }));
  if (!fromOther && MAT_BC) { const { target, ...rest } = detail || {}; void target; try { MAT_BC.postMessage(rest); } catch { /* a closed channel: the other tabs read on their next start */ } }
}
if (MAT_BC) MAT_BC.onmessage = e => { MATS = null; SETS = null; matEmit({ ...(e.data || {}), other: true }, true); };

/* ---------- the library ---------- */
let MATS = null; // id → material, read once, then kept in step with every write
async function matAll() {
  if (!MATS) {
    const next = new Map();
    for (const m of await mall('materialy')) next.set(m.id, m);
    const known = await setsAll();
    // a record an older build rewrote: its revisions come back from the second database, and a turn or scale it changed
    // in place becomes one more revision (kept there, so its number never moves)
    for (const m of next.values()) {
      const list = matSets(m), have = known.get(m.id) || [];
      if (list.length !== have.length || list.some((x, i) => x.n !== have[i].n)) { try { await setsWrite(m.id, list); } catch { /* read-only here: shown, not kept */ } }
      // the record itself is healed too, so a v6.1 or v6.2 tab (which reads only the record) sees the revisions again;
      // healed in one transaction on the record as it is now, so a turn another tab saved meanwhile is not undone
      const ns = l => JSON.stringify(l.map(x => x.n));
      if (ns(unionSets(m.sets)) !== ns(list)) {
        try {
          const fresh = await mpatch(m.id, r => { const want = unionSets(r.sets, list); if (ns(unionSets(r.sets)) === ns(want)) return false; r.sets = want; });
          if (fresh) next.set(m.id, fresh);
        } catch { m.sets = list; /* shown, not kept */ }
      }
    }
    // his motion (v6.4): a build older than v6.3 writes whole records from memory and drops m.ruch; the mirror brings it back
    for (const [id, ru] of await ruchMirrors()) {
      const m = next.get(id);
      if (!m || (m.ruch && (m.ruch.at || 0) >= (ru.at || 0))) continue;
      try {
        const fresh = await mpatch(id, r => { if (r.ruch && (r.ruch.at || 0) >= (ru.at || 0)) return false; r.ruch = ru; });
        if (fresh) next.set(id, fresh);
      } catch { m.ruch = ru; /* shown, not kept */ }
    }
    MATS = next;
  }
  return MATS;
}
/* Ruch (v6.4) is mirrored beside the revisions, as a record "ruch:<id>" in the same second database, which v6.1 and v6.2
   never open; v6.3 reads that store too and sees an empty revision list under a key that is not a material, which it never
   shows. Written after the material record, so a reader in between finds the record newer and leaves it as it is. */
async function ruchMirrorWrite(id, ruch) {
  try {
    const db = await sdb();
    await new Promise((res, rej) => { const tx = db.transaction('sets', 'readwrite'); tx.objectStore('sets').put({ id: 'ruch:' + id, sets: [], ruch }); tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error || new Error('IndexedDB')); });
    return true;
  } catch { return false; /* no second database here: the record alone keeps it */ }
}
async function ruchMirrors() {
  const out = new Map();
  try {
    const db = await sdb();
    await new Promise((res, rej) => { const rq = db.transaction('sets', 'readonly').objectStore('sets').getAll(); rq.onsuccess = () => { for (const r of rq.result || []) if (String(r.id).startsWith('ruch:') && r.ruch) out.set(String(r.id).slice(5), r.ruch); res(); }; rq.onerror = () => rej(rq.error); });
  } catch { /* none here */ }
  return out;
}
async function matSave(m) { await mput('materialy', m); (await matAll()).set(m.id, m); }
/* a small change to a record (deleted, back again) made on the record as it is now, never on a window's copy of it:
   that copy may be older than a turn or scale another tab saved meanwhile (19 Oct, the same seam GPT found for settings) */
async function matPatch(id, fn) {
  let r = null;
  try { r = await mpatch(id, fn); } catch { /* below */ }
  if (!r) { const m = (await matAll()).get(id); if (!m) return null; fn(m); await matSave(m); return m; }
  (await matAll()).set(id, r);
  return r;
}
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
  /* a companion is found by the path the model names it with (two "texture.png" in red/ and blue/ inside one glTF are two
     pictures: GPT and Feniks GPT, 18 Oct), else by its name when that name is unique among the companions */
  const byPath = new Map(), byName = new Map();
  for (const d of m.deps || []) {
    const bl = await fileBlob(d.sha), k = baseName(d.name).toLowerCase();
    byName.set(k, byName.has(k) ? null : bl);
    if (d.uri) byPath.set(normPath(String(d.uri).replace(/\\/g, '/')), bl);
  }
  const depFor = u => { const p = normPath(uriOf(String(u).split('?')[0]).replace(/\\/g, '/')); return byPath.get(p) || byName.get(baseName(p).toLowerCase()) || null; };
  const urls = [], missing = new Set();
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier(u => {
    if (/^(data|blob):/.test(u)) return u;
    const bl = depFor(u);
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
        let mtlText = '';
        if (mtl && depFor(mtl)) {
          mtlText = await depFor(mtl).text();
          const mats = new MTLLoader(mgr).parse(mtlText, '');
          mats.preload();
          ol.setMaterials(mats);
        } else if (mtl) missing.add(baseName(mtl));
        obj = ol.parse(text);
        /* An .obj's materials arrive as shiny Phong with no cut-outs (the owner, 18 Oct: his exports looked wrongly shaded
           and lost their transparent pixels).
           A Blockbench export (it says so in its first line) gets exactly the Blockbench look; any other .obj gets the same
           matte material with cut-outs where its picture has transparent pixels, and clay where it has no picture.
           Multi-material meshes keep one material per group. Sharp or smooth pixels: swPixels(), below. */
        const fromBB = /Made in Blockbench/i.test(text.slice(0, 300) + mtlText.slice(0, 300));
        const objMat = old => {
          if (!old) return bbLook(null, CLAY);
          const col = old.color && old.color.getHex() !== 0xffffff ? old.color.getHex() : null;
          let m2;
          if (fromBB) m2 = bbLook(old.map || null, col ?? CLAY);
          else {
            if (old.map) old.map.colorSpace = THREE.SRGBColorSpace;
            m2 = new THREE.MeshStandardMaterial({ map: old.map || null, color: old.map ? (col ?? 0xffffff) : (col ?? CLAY), roughness: 0.86, metalness: 0,
              alphaTest: old.map ? 0.05 : 0, side: THREE.DoubleSide, transparent: old.opacity < 1, opacity: old.opacity ?? 1 });
          }
          m2.name = old.name || '';
          old.dispose?.();
          return m2;
        };
        obj.traverse(x => { if (x.isMesh) x.material = Array.isArray(x.material) ? x.material.map(objMat) : objMat(x.material); });
      }
    }
    if (pending > 0) await Promise.race([settled, new Promise(r => setTimeout(r, 6000))]);
    swPixels(obj); // sharp or smooth pixels: the owner's one choice for every model
  } finally { setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 1500); }
  obj.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
  return { object: obj, animations: anims, missing: [...missing].filter(n => n && n !== ',' && !/^(blob|data):/.test(n) && !/^[0-9a-f-]{36}$/i.test(n)) };
}
/* the material's defaults: quarter turns about X, Y, Z and a scale, applied around its own origin */
/* Settings revisions (v6.1). Turning or scaling a material used to change it in place, so a place that pointed at the
   material's id would quietly change size and orientation (GPT-6, PR #4). Every change now adds a numbered revision
   and keeps the earlier ones: a place can pin the revision it was built with (Jaskinia.materialy.object(id, {set})) or
   follow the newest. A material from before v6.1 has one revision: its settings as they are. */
function matSets(m) {
  let list = unionSets(SETS && SETS.get(m.id), m.sets);
  if (!list.length) return [{ n: 1, rot: [...(m.rot || [0, 0, 0])], scale: m.scale || 1, at: m.added || 0 }];
  const last = list[list.length - 1];
  const same = s => !!s && JSON.stringify(s.rot || [0, 0, 0]) === JSON.stringify(m.rot || [0, 0, 0]) && (s.scale || 1) === (m.scale || 1);
  // A record that still looks exactly like the revision it names (m.set), with a newer revision taken moments ago, is
  // only behind it: a tab is applying it right now. Nothing was changed in place, so nothing is added (19 Oct: a tab
  // reading in that moment used to add the old look as one more revision, and the newest one after it). Still behind a
  // minute later means that apply never finished, or an older build wrote back its copy: the record's look counts again.
  // a record that never named one (imported, never turned or scaled) shows revision 1 (Astra's probe on PR #4, 19 Oct:
  // the first change of a fresh material still left the gap open)
  const own = list.find(x => x.n === (m.set ?? 1));
  const applying = same(own) && Date.now() - (last.at || 0) < MAT_APPLY_GRACE;
  if (!same(last) && !applying)
    list = [...list, { n: last.n + 1, rot: [...(m.rot || [0, 0, 0])], scale: m.scale || 1, at: m.upd || Date.now(), by: 'starsza wersja' }];
  return list;
}
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
  const fresh = new Set(); // bytes this import wrote
  const store = async f => { const sha = await sha256(f.blob); if (!(await mget('pliki', sha))) { await mput('pliki', { sha, name: baseName(f.name), size: f.blob.size, data: f.blob, at: Date.now() }); fresh.add(sha); } return { name: baseName(f.name), sha, size: f.blob.size }; };
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
      for (const w of wanted) { const s = sideFor(side, w.from, w.uri); if (s && !took.has(s)) { took.add(s); deps.push({ ...(await store(s)), uri: w.uri }); used.add(s); } }
    }
    deps.sort((a, b) => a.name.localeCompare(b.name));
    const id = 'm' + (deps.length ? (await sha256(new Blob([main.sha + deps.map(d => d.name + d.sha).join('')]))) : main.sha).slice(0, 20);
    if (all.has(id) && !all.get(id).gone) { out.push({ id, again: true }); continue; }
    const name = (jobs.length === 1 && label) || nameOf(job);
    const prev = [...all.values()].filter(x => !x.gone && x.kind === job.kind && x.name.toLowerCase() === name.toLowerCase()).sort((a, b) => (b.ver || 1) - (a.ver || 1))[0];
    // a material deleted before and dropped again comes back as it is stored now (another tab may have turned it since)
    const old = all.has(id) ? ((await mget('materialy', id).catch(() => null)) || all.get(id)) : null;
    const m = old || { id, name, kind: job.kind, main, deps, added: Date.now(), from, rot: prev ? prev.rot : [0, 0, 0], scale: prev ? prev.scale : 1,
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
    if (old) await matPatch(id, r => { delete r.gone; Object.assign(r, { missing: m.missing, facts: m.facts, thumb: m.thumb }); });
    else await matSave(m);
    out.push({ id, name: m.name, ver: m.ver, prev: prev ? prev.id : null });
  }
  if (fresh.size && out.some(x => x.error)) setTimeout(() => matSweep(), MAT_SWEEP_AGE + 1000); // what a failed model left, later
  const unusedSide = mains.length ? side.filter(s => !used.has(s) && !/\.(bin|mtl)$/i.test(s.name) && !MAT_PIC.test(s.name)).map(s => s.name) : [];
  if (out.some(x => !x.error && !x.again)) matEmit({ added: out.filter(x => !x.error && !x.again).map(x => x.id) });
  return { done: out, skipped: [...skipped, ...unusedSide] };
}
/* Bytes no material uses (a model that could not be read leaves its files) go, but only once they are old enough that no
   import still running in any tab can be about to use them: v6.1 removed them at the end of the failed import, and a
   second import sharing a picture could save a material whose picture had just gone (GPT, 18 Oct). Files written by an
   older build carry no time and are never swept here. */
const MAT_SWEEP_AGE = 10 * 60e3;
async function matSweep() {
  try {
    const refd = new Set();
    for (const x of await mall('materialy')) { refd.add(x.main?.sha); for (const d of x.deps || []) refd.add(d.sha); }
    const old = (await mdo('pliki', 'readonly', os => os.getAllKeys())) || [];
    for (const sha of old) {
      if (refd.has(sha)) continue;
      const f = await mget('pliki', sha);
      if (f && f.at && Date.now() - f.at > MAT_SWEEP_AGE) await mdo('pliki', 'readwrite', os => os.delete(sha));
    }
  } catch { /* kept; harmless */ }
}
/* A new turn or scale of a material (v6.3): measured first, then numbered once in the second database (two tabs never
   take one number) and written onto the record as it is at that moment, in one transaction, so what another tab wrote
   meanwhile stays (GPT, 18 Oct: a window kept its own copy of the record and saved it over a newer one). */
async function matApplySettings(id, patch) {
  const m = await mget('materialy', id);
  if (!m) throw new Error(t('Nie ma w bibliotece materiału {0}.', id));
  const look = { rot: [...(patch.rot || m.rot || [0, 0, 0])], scale: patch.scale ?? m.scale ?? 1 };
  // measured and drawn first (the slow part), so the number is taken and the record written right after each other
  let facts = null, thumb = null;
  try {
    const probe = { ...m, ...look };
    const { object, animations } = await matLoad(probe);
    const wrapped = matGround(matWrap(object, probe));
    facts = { ...matFacts(wrapped, animations), src: m.facts?.src || '' };
    thumb = await matThumb(wrapped);
    swDispose(wrapped);
  } catch { /* the old picture stays */ }
  await setsAll();
  const list = matSets((await mget('materialy', id)) || m);
  const cfg = { ...look, at: Date.now() };
  let n, sets;
  try { ({ n, list: sets } = await setsWrite(id, list, cfg)); }
  catch { n = list[list.length - 1].n + 1; sets = [...list, { n, ...cfg }]; }
  // a tab that numbered its change later and already wrote it keeps its look: the record always shows the newest revision
  const put = r => (r.set != null && r.set > n) ? Object.assign(r, { sets: unionSets(r.sets, sets) })
    : Object.assign(r, { rot: cfg.rot, scale: cfg.scale, sets: unionSets(r.sets, sets), set: n, upd: Date.now() }, facts ? { facts } : {}, thumb ? { thumb } : {});
  let now = null;
  try { now = await mpatch(id, put); } catch { /* written below the old way */ }
  if (now) (await matAll()).set(id, now);
  else { now = put((await mget('materialy', id)) || m); await matSave(now); }
  matEmit({ changed: [id] });
  return { n, m: now };
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

/* ---------- Jozz's own models from his public repositories ----------
   Only what he made. Box3d_FunProject's data/meshes (a house, stairs, a test map) came with the original Box3D in its
   first commit (Erin Catto's; the house is named like a commercial asset pack), so they were never his and are not
   offered (the owner, 18 Oct: they are not his, and models without rights should go). */
const MAT_REPO = [
  ['Nadwozie', 'Box3d_FunProject', 'assets/source/Nadwozie.gltf', 'Box3D · Blockbench'],
  ['Koła terenowe', 'Box3d_FunProject', 'assets/source/Offroad_Big_Wheels.gltf', 'Box3D · Blockbench'],
  ['Wywrotka', 'Box3d_FunProject', 'assets/source/Asset_Dumper.gltf', 'Box3D · Blockbench'],
  ['M6 R3', 'JV-Box3D-Web-Public', 'vehicles/m6-owner-r3/models/m6-owner-full-rig-r3.glb', 'JV Web'],
  ['Kadłub', 'voxel-aeronautics-workshop', 'assets/visual_packs/local_working_visuals/models/blocks/hull/model.gltf', 'VAW · Blockbench'],
  ['Silnik', 'voxel-aeronautics-workshop', 'assets/visual_packs/local_working_visuals/models/blocks/thruster/model.gltf', 'VAW · Blockbench'],
  ['Animacja testowa', 'voxel-aeronautics-workshop', 'tools/blockbench_import_studio/assets/real_blockbench_regression/test_anim.gltf', 'VAW · Blockbench'],
];
/* A library that already holds them (brought here by v6) lets them go once, out loud and with Cofnij; after Cofnij they stay. */
const MAT_NOT_HIS = /^repo:Jozzpoly\/Box3d_FunProject\/data\/meshes\//;
async function matDropNotHis(all) {
  const bad = [...all.values()].filter(m => !m.gone && !m.keep && MAT_NOT_HIS.test(m.from || ''));
  if (!bad.length) return [];
  for (const m of bad) await matPatch(m.id, r => { r.gone = Date.now(); r.goneWhy = 'nie-jozza'; });
  matEmit({ removed: bad.map(m => m.id) });
  const names = [...new Set(bad.map(m => m.name))].join(', ');
  jtoast(t('Usunąłem z biblioteki modele, które nie są Twoje: {0}. Przyszły z pierwotnego Box3D, nie od Ciebie.', names), { label: t('Cofnij'), act: async () => {
    for (const m of bad) await matPatch(m.id, r => { delete r.gone; delete r.goneWhy; r.keep = true; });
    matEmit({ changed: bad.map(m => m.id) });
  } }, 12000);
  return bad;
}
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
  /* Ruch (v6.4, 57b-ruch.js): his parts, set in motion by his hands; kept on the material record, read by agents */
  const ruch = ruchWindow(view, {
    save: async (id, parts) => {
      const ru = { v: 1, at: Date.now(), parts };
      const r = await matPatch(id, rec => { rec.ruch = ru; });
      await ruchMirrorWrite(id, ru); // after the record: an older build that rewrites the record cannot take it away
      if (r && cur && cur.id === id) cur = r;
      matEmit({ changed: [id], ruch: true });
    },
    saveFile: (name, text) => saveFile(name, text),
    older: async m => (await matVersions(m)).filter(v => v.id !== m.id && (v.ver || 1) < (m.ver || 1) && v.ruch?.parts?.length).sort((a, b) => (b.ver || 1) - (a.ver || 1))[0] || null,
    onState: ({ on, n }) => {
      for (const b of bar.querySelectorAll('.mt-ruchb')) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); const i = b.querySelector('.mt-n'); if (i) i.textContent = n ? String(n) : ''; }
      if (on && actions.some(a => a.isRunning())) { for (const a of actions) a.stop(); stage?.redraw(); } // the file's own animation would fight his hand
      if (!!c.view()?.ruch !== on) c.setView({ ...(c.view() || {}), ruch: on });
    },
  });
  window.__jkRuch = ruch; // the last Materiały window's Ruch: for the tests and for an agent
  if (c.view()?.ruch) ruch.start();
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
    // a quarter turn from the turn it has now (another tab may have turned it since this bar was drawn)
    const qt = (axis, dir) => async () => { const r = [...(((await matAll()).get(m.id) || m).rot || [0, 0, 0])]; r[axis] = (r[axis] + dir + 4) % 4; await setDefaults(m, { rot: r }); };
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
      h('button', { class: 'jk-tb mt-px' + (prefs.pixels !== 'gladkie' ? ' on' : ''), type: 'button', 'aria-pressed': String(prefs.pixels !== 'gladkie'),
        title: t('Ostre piksele tekstur, jak w Blockbench (wyłącz, żeby wygładzić). To samo ustawienie jest w Ustawieniach → Wygląd.'),
        onclick: () => setPref('pixels', prefs.pixels === 'gladkie' ? 'ostre' : 'gladkie') }, icon('t_piksele', 13), h('span', { text: t('Ostre piksele') })),
      h('span', { class: 'mt-gap' }),
      m.kind !== 'tekstura' ? h('button', { class: 'jk-tb mt-ruchb' + (ruch.on ? ' on' : ''), type: 'button', 'aria-pressed': String(ruch.on),
        title: t('Ruch: kliknij część swojego modelu i powiedz, jak się rusza (obraca się, przesuwa się)'), onclick: () => ruch.toggle() },
        icon('ruch', 13), h('span', { text: t('Ruch') }), h('i', { class: 'mt-n', text: m.ruch?.parts?.length ? String(m.ruch.parts.length) : '' })) : null,
      h('button', { class: 'jk-tb mt-del', type: 'button', title: t('Usuń z biblioteki (da się cofnąć)'), onclick: () => remove(m) }, icon('trash', 13)),
      h('button', { class: 'mt-go', type: 'button', title: t('Stań obok w skali 1:1 i chodź (WASD, mysz). Esc wychodzi.'), onclick: () => enter() }, icon('t_wejdz', 15), h('span', { text: t('Wejdź') }))].filter(Boolean));
  }
  async function setDefaults(m0, patch) {
    const { m } = await matApplySettings(m0.id, patch);
    show(m.id, true);
  }
  async function remove(m) {
    await matPatch(m.id, r => { r.gone = Date.now(); });
    matEmit({ removed: [m.id] });
    jtoast(t('Usunięto z biblioteki: {0}', m.name), { label: t('Cofnij'), act: async () => { await matPatch(m.id, r => { delete r.gone; }); matEmit({ changed: [m.id] }); sel(m.id); } });
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
    if (!cur) { ruch.detach(); cap.replaceChildren(); vers.replaceChildren(); bar.replaceChildren(); if (stage) { stage.set(null); stage.human(false); } curObj = null; drawList(); return; }
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
      if (cur.kind === 'tekstura') ruch.detach(); else ruch.attach(curObj, cur, S);
      drawBar(cur);
      say('');
    } catch (err) { say(t('Nie dało się pokazać {0}: {1}', cur.name, err.message), 'err'); }
    drawList();
  }
  function enter() {
    if (!stage || !curObj) return;
    if (walk) { walk.end(); walk = null; return; }
    if (ruch.on) ruch.off(); // inside, the parts stand where the file put them
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
    if (cur && (d.removed || []).includes(cur.id)) {
      if (!d.other) return; // remove() picks the next one itself
      // deleted in another tab: this window lets it go too and shows the next one (not in the middle of a walk)
      if (!walk) { drawList(); matList().then(rest => { if (alive) sel(rest[0]?.id || null); }); return; }
    }
    // another tab turned, scaled or restored the one shown here: show it as it is now (a walk inside it is not broken)
    if (d.other && cur && !walk && (d.changed || []).includes(cur.id)) show(cur.id, true);
    drawList();
  };
  document.addEventListener('jk:materialy', onLib);
  const onPx = () => { const on = prefs.pixels !== 'gladkie'; for (const b of bar.querySelectorAll('.mt-px')) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
  document.addEventListener('jk:pixels', onPx);
  c.onDispose(() => {
    alive = false;
    document.removeEventListener('jk:materialy', onLib);
    document.removeEventListener('jk:pixels', onPx);
    if (walk) walk.end();
    ruch.dispose();
    if (window.__jkRuch === ruch) delete window.__jkRuch;
    mixer?.stopAllAction();
    stage?.dispose();
  });
  // the theme can change under a window that is never rebuilt
  const mo = new MutationObserver(() => { stage?.paint(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-jk', 'data-theme', 'style'] });
  c.onDispose(() => mo.disconnect());
  matAll().then(async all => {
    if (!alive) return;
    const dropped = await matDropNotHis(all);
    if (!alive) return;
    drawList();
    if (st.sel && all.get(st.sel) && !all.get(st.sel).gone) { show(st.sel); return; }
    if (st.sel && !dropped.some(m => m.id === st.sel)) jtoast(t('Nie ma w bibliotece materiału {0}.', st.sel));
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
const HAD_STORE = !!(lsGet('jaskinia:v3') || lsGet('jaskinia:v2')); // read before the shell boots and writes it
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
ICONS.t_piksele = 'M2.5 2.5h5v5h-5z M8.5 8.5h5v5h-5z M8.5 2.5h5v5h-5z M2.5 8.5h5v5h-5z M5 5h.01 M11 11h.01';
ICONS.t_obrot = 'M12.8 6.2A5 5 0 1 0 13 9.5 M13.2 3v3.4H9.8';
if (!ICONS.plus) ICONS.plus = 'M8 3v10 M3 8h10';
if (!ICONS.trash) ICONS.trash = 'M3 4.5h10 M6.5 4.5V3h3v1.5 M4.5 4.5l.7 9h5.6l.7-9';
GROUPS.splice(GROUPS.findIndex(g => g[0] === 'misc'), 0, ['studio', 'Studio']);
Object.assign(TYPES, {
  materialy: { key: 'materialy', group: 'studio', live: true, liveKey: () => ['m'], fill: true, noZoom: true, name: 'Materiały', glyph: 't_materialy',
    desc: 'Twoje modele i tekstury: upuść pliki, zobacz je w świetle, sprawdź skalę przy człowieku 1,8 m i wejdź do środka.', render: renderMaterialy },
});
matDropAnywhere();
