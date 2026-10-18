/* ---------- window.Jaskinia: what other tools may use (v6) ----------
   A small, deliberate surface, so that work living in another repository (Feniks Studio first) can add its own windows
   and use Jozz's materials and the shared 3D look without editing src/jaskinia/*. `JASK` is already the Library's flag,
   hence the full name. Version 1; anything not listed here is internal and may change. */
const JASKINIA_API = {
  v: 1,
  build: JASK_BUILD,
  /* register a window type. def: { name, glyph?, desc?, group? ('studio' by default), render(box, c), ctx?(c), live?, liveKey?, fill?, noZoom? }
     Windows of this type saved earlier (kept aside as "lost" by a build that did not know it) come back. */
  ext: {
    type(key, def) {
      if (!/^[a-z][a-z0-9_-]{1,31}$/.test(key)) throw new Error('Jaskinia.ext.type: key must be a short lowercase name');
      if (TYPES[key] && !TYPES[key].ext) throw new Error('Jaskinia.ext.type: "' + key + '" is a built-in window type');
      if (typeof def?.render !== 'function') throw new Error('Jaskinia.ext.type: render(box, c) is required');
      TYPES[key] = { group: 'studio', glyph: 't_wybor', desc: '', ...def, key, ext: true };
      if (typeof store !== 'undefined' && store) {
        let back = 0;
        for (const sp of store.spaces) for (const w of Object.values(sp.L.wins)) if (w.type === 'wybor' && w.lost && w.lost.type === key) { w.type = key; delete w.lost.type; if (!w.lost.pin) delete w.lost; back++; }
        if (back && typeof L !== 'undefined' && L) { persist(); for (const id of allIds()) { const rt = RT.get(id); if (rt) rt.key = null; refreshWin(id); } }
      }
      return TYPES[key];
    },
    /* a 16×16 icon drawn with currentColor: one SVG path */
    icon(name, d) { if (!/^[a-z][a-z0-9_]{1,31}$/.test(name) || typeof d !== 'string') throw new Error('Jaskinia.ext.icon(name, pathData)'); ICONS[name] = d; },
    /* English beside Polish source strings, for t() */
    strings(dict) { if (typeof EN !== 'undefined') for (const [k, v] of Object.entries(dict || {})) if (EN[k] == null) EN[k] = v; },
    t: (s, ...a) => t(s, ...a),
    toast: (msg, action, ms) => jtoast(msg, action, ms),
    open: (type, opts) => openWinOfType(type, opts || {}),
  },
  /* Jozz's materials: list(), get(id), object(id, {ground}) → Promise<THREE.Object3D> (a fresh copy with the material's
     orientation and scale; with ground: true it also stands on the ground in the middle), import(files), versions(id).
     An id is "m" + the start of the SHA-256 of the material's bytes: the same bytes are the same material, everywhere. */
  materialy: {
    list: () => matList(),
    get: async id => (await matAll()).get(id) || null,
    versions: async id => { const m = (await matAll()).get(id); return m ? matVersions(m) : []; },
    async object(id, o = {}) {
      const m = (await matAll()).get(id);
      if (!m) throw new Error('no material ' + id);
      const { object, animations } = await matLoad(m);
      const g = matWrap(object, m);
      g.userData.material = id;
      g.userData.animations = animations;
      return o.ground ? matGround(g) : g;
    },
    import: files => matImport(files),
    on(fn) { const f = e => fn(e.detail || {}); document.addEventListener('jk:materialy', f); return () => document.removeEventListener('jk:materialy', f); },
  },
  /* the shared 3D runtime: three() → { THREE, GLTFLoader, OrbitControls, … } (one copy for the page),
     stage(host) → a lit stage with a metre grid, walk(stage) → first-person at 1:1 */
  swiat: {
    three: () => swiat(),
    stage: (host, o) => swStage(host, o || {}),
    walk: (stage, o) => swWalk(stage, o || {}),
    human: SW_HUMAN,
  },
};
window.Jaskinia = JASKINIA_API;
