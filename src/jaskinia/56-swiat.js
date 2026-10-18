/* ---------- Świat: the 3D runtime every 3D window shares (v6) ----------
   One three.js for the whole page (src/vendor/swiat3d.js: carried inside the build, started only when a 3D window first
   asks, so a Jaskinia without 3D windows pays nothing but the parse). One look: the theme's ground and ink, soft light,
   a metre grid. One way to stand inside: walking at 1:1 with a body 1.8 m tall. Units are metres, Y is up. */
let SW = null;
function swiat() {
  if (SW) return SW;
  if (typeof window.__SWIAT3D_FACTORY !== 'function') throw new Error(t('w tej Jaskini nie ma silnika 3D'));
  SW = window.__SWIAT3D_FACTORY();
  const { THREE, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } = SW;
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  return SW;
}
const SW_HUMAN = 1.8; // the body every scale is checked against
function fmtM(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v), s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : a >= 0.01 ? v.toFixed(2) : v.toPrecision(2);
  return (prefs.lang === 'en' ? s : s.replace('.', ',')) + ' m';
}
function fmtInt(n) { return Number.isFinite(n) ? Math.round(n).toLocaleString(prefs.lang === 'en' ? 'en-GB' : 'pl-PL') : '—'; }
/* the theme's colours, read from the page so a 3D window looks like the rest of Jaskinia */
function swColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  return { ground: v('--ground', '#0e111c'), ground2: v('--ground-2', '#121626'), plate: v('--plate', '#171c2e'), rule: v('--rule', '#262e47'),
    rule2: v('--rule-2', '#38425f'), ink: v('--ink', '#e9ebf3'), ink2: v('--ink-2', '#aeb4cb'), ink3: v('--ink-3', '#79809d'), hand: v('--hand', '#f2b14b') };
}
function swDispose(obj) {
  obj.traverse(o => {
    if (o.geometry) { o.geometry.disposeBoundsTree?.(); o.geometry.dispose(); }
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { for (const k of Object.keys(m)) { const x = m[k]; if (x && x.isTexture) x.dispose(); } m.dispose(); }
  });
}

/* a stage: canvas, light, ground, grid, an orbiting camera; renders only when something changed */
function swStage(host, o = {}) {
  const S = swiat(), { THREE, OrbitControls, RoomEnvironment } = S;
  const canvas = h('canvas', { class: 'sw-cv' });
  host.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!o.still, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const env = pmrem.fromScene(envScene, 0.04).texture;
  envScene.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.(); });
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 4000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.55);
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ziemia';
  const grid = new THREE.Group();
  scene.add(ground, grid);
  const root = new THREE.Group(); // what the window shows
  const extra = new THREE.Group(); // helpers: the body for scale
  scene.add(root, extra);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  let need = true, raf = 0, alive = true, bounds = null, gridKey = '';
  const ticks = new Set();
  const st = { THREE, S, renderer, scene, camera, controls, root, extra, ground, canvas, host, get bounds() { return bounds; } };
  st.redraw = () => { need = true; };
  st.tick = fn => { ticks.add(fn); need = true; return () => ticks.delete(fn); };
  controls.addEventListener('change', st.redraw);
  /* colours follow the theme; called again when it changes */
  st.paint = () => {
    const c = swColors();
    const bg = new THREE.Color(c.ground);
    scene.background = bg;
    if (!scene.fog) scene.fog = new THREE.Fog(bg, 50, 400); // ranges set by frame()
    else scene.fog.color.copy(bg);
    ground.material.color.set(c.plate);
    hemi.color.set(c.ink); hemi.groundColor.set(c.ground2);
    gridKey = '';
    if (bounds) layGrid();
    need = true;
  };
  function layGrid() {
    const c = swColors(), size = bounds ? bounds.size : 10;
    const span = Math.max(12, Math.ceil(size * 3 / 10) * 10), key = span + c.rule2 + c.ink3;
    if (key === gridKey) return;
    gridKey = key;
    for (const g of grid.children.splice(0)) { g.geometry.dispose(); g.material.dispose(); }
    const mk = (step, col, op) => {
      const pts = [];
      for (let x = -span; x <= span + 1e-6; x += step) { pts.push(x, 0, -span, x, 0, span, -span, 0, x, span, 0, x); }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false }));
      grid.add(l);
    };
    if (span <= 80) mk(1, c.rule2, 0.5);
    mk(5, c.ink3, 0.32);
    ground.scale.set(span * 8, span * 8, 1);
  }
  /* look at what the window shows: a pleasant three-quarter view, the sun and the shadows sized to it */
  st.frame = (keepView) => {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 0.05), size = box.getSize(new THREE.Vector3());
    bounds = { box, center: box.getCenter(new THREE.Vector3()), radius: r, size: Math.max(size.x, size.y, size.z), dims: size };
    const y0 = box.min.y;
    ground.position.y = y0 - 0.001; grid.position.y = y0 + 0.0005;
    ground.position.x = grid.position.x = Math.round(bounds.center.x);
    ground.position.z = grid.position.z = Math.round(bounds.center.z);
    layGrid();
    sun.position.copy(bounds.center).add(new THREE.Vector3(r * 1.6, r * 2.6, r * 1.1));
    sun.target.position.copy(bounds.center);
    const sc = sun.shadow.camera, e = r * 1.4;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = r * 0.1; sc.far = r * 6;
    sc.updateProjectionMatrix();
    camera.near = Math.max(0.01, r / 200); camera.far = r * 60 + 50;
    scene.fog.near = r * 4; scene.fog.far = r * 4 + Math.max(30, r * 14);
    if (!keepView) {
      const fov = camera.fov * Math.PI / 180, dist = r / Math.sin(fov / 2) * 1.08;
      const dir = new THREE.Vector3(0.95, 0.55, 1.25).normalize();
      camera.position.copy(bounds.center).addScaledVector(dir, dist);
      controls.target.copy(bounds.center);
    }
    camera.updateProjectionMatrix();
    controls.minDistance = r * 0.05; controls.maxDistance = r * 20 + 20;
    controls.update();
    need = true;
    return bounds;
  };
  st.set = obj => {
    for (const ch of root.children.splice(0)) { ch.parent = null; swDispose(ch); }
    if (obj) { obj.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); root.add(obj); }
    st.frame();
  };
  /* the body: 1.8 m, beside the thing, so its size is felt and not only read */
  let body = null;
  st.human = on => {
    if (!on) { if (body) { extra.remove(body); swDispose(body); body = null; } need = true; return; }
    if (!body) {
      // a plain mannequin, 1.8 m: legs, body, arms, head (made of capsules, so it reads as a person from any side)
      const c = swColors(), mat = new THREE.MeshStandardMaterial({ color: c.hand, roughness: 0.55, metalness: 0 });
      body = new THREE.Group();
      const cap = (r, len, x, y, z, rz = 0) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; body.add(m); return m; };
      cap(0.075, 0.72, -0.1, 0.075 + 0.36, 0);        // legs: 0 → 0.87
      cap(0.075, 0.72, 0.1, 0.075 + 0.36, 0);
      cap(0.17, 0.36, 0, 0.87 + 0.17 + 0.18, 0);      // body: 0.87 → 1.57
      cap(0.055, 0.56, -0.255, 1.12, 0, 0.06);         // arms
      cap(0.055, 0.56, 0.255, 1.12, 0, -0.06);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), mat); head.position.y = SW_HUMAN - 0.11; head.castShadow = true; body.add(head);
      body.name = 'człowiek 1,8 m';
      extra.add(body);
    }
    const b = bounds || st.frame(true);
    body.position.set(b.box.max.x + 0.45 + Math.min(1, b.size * 0.08), b.box.min.y, b.center.z);
    need = true;
  };
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, hh = host.clientHeight;
    if (!w || !hh) return;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh; camera.updateProjectionMatrix();
    need = true;
  });
  ro.observe(host);
  let last = performance.now();
  /* resolution follows the device: while frames come slower than ~30 a second the stage draws fewer pixels, and gives
     them back when there is room (a phone walking through a house stays fluid; a desk keeps its full sharpness) */
  const prMax = Math.min(2, window.devicePixelRatio || 1);
  let pr = prMax, slow = 0, quick = 0, held = false, lastAdj = 0;
  const adapt = (frameMs, now) => {
    if (frameMs > 40) { slow++; quick = 0; } else if (frameMs < 22) { quick++; slow = 0; } else { slow = quick = 0; }
    if (now - lastAdj < 900) return;
    if (slow >= 12 && pr > 0.5) { pr = Math.max(0.5, pr * 0.8); renderer.setPixelRatio(pr); lastAdj = now; slow = 0; need = true; }
    else if (quick >= 60 && pr < prMax) { pr = Math.min(prMax, pr * 1.15); renderer.setPixelRatio(pr); lastAdj = now; quick = 0; need = true; }
  };
  const loop = now => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const raw = now - last; last = now;
    const dt = Math.min(0.12, raw / 1000);
    if (held || !canvas.isConnected || !canvas.clientWidth || document.hidden) return; // a window in another layout costs nothing
    let more = controls.update();
    for (const f of ticks) { if (f(dt) === true) more = true; }
    if (need || more || ticks.size) {
      need = false;
      renderer.render(scene, st.camera);
      if (more || ticks.size) adapt(raw, now); else slow = quick = 0;
    }
  };
  /* tests and agents: stop the loop (nothing moves, nothing draws), draw one frame by hand */
  st.hold = on => { held = !!on; if (!held) { last = performance.now(); need = true; } };
  st.draw = () => { controls.update(); renderer.render(scene, st.camera); };
  st.quality = () => ({ pixelRatio: pr, max: prMax });
  raf = requestAnimationFrame(loop);
  st.camera = camera;
  st.paint();
  st.dispose = () => {
    alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
    swDispose(root); swDispose(extra); grid.children.forEach(g => { g.geometry.dispose(); g.material.dispose(); });
    ground.geometry.dispose(); ground.material.dispose(); env.dispose(); pmrem.dispose();
    renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove();
  };
  return st;
}

/* ---------- Wejdź: standing inside at 1:1 ----------
   A capsule 1.8 m tall (radius 0.3) walks over whatever the stage shows, with gravity and the ground under it;
   everything it can touch is baked once into a BVH (three-mesh-bvh). Mouse and keys on a desk, two thumbs on a phone. */
function swWalk(stage, o = {}) {
  const { THREE, StaticGeometryGenerator, MeshBVH, BufferGeometryUtils } = swiat();
  const b = stage.bounds || stage.frame(true);
  stage.root.updateMatrixWorld(true);
  // what the body can touch: the thing itself and a ground far wider than it
  const parts = [];
  let hasMesh = false;
  stage.root.traverse(x => { if (x.isMesh) hasMesh = true; });
  if (hasMesh) {
    const gen = new StaticGeometryGenerator(stage.root);
    gen.attributes = ['position'];
    const gg = gen.generate();
    parts.push(gg.index ? gg.toNonIndexed() : gg);
    if (gg.index) gg.dispose();
  }
  const span = Math.max(200, b.size * 20);
  const gp = new THREE.PlaneGeometry(span, span).toNonIndexed();
  gp.rotateX(-Math.PI / 2); gp.translate(b.center.x, b.box.min.y, b.center.z);
  gp.deleteAttribute('normal'); gp.deleteAttribute('uv');
  parts.push(gp);
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position') p.deleteAttribute(k);
  const geom = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  geom.boundsTree = new MeshBVH(geom);
  const collider = new THREE.Mesh(geom);
  collider.updateMatrixWorld(true);

  const R = 0.3, SEGL = SW_HUMAN - 2 * R, EYE = 0.07; // the capsule: top sphere centre is the position, eyes a little above it
  const pos = new THREE.Vector3(), vel = new THREE.Vector3();
  const seg = new THREE.Line3(), tbox = new THREE.Box3(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), dv = new THREE.Vector3();
  let yaw = 0, pitch = 0, onGround = false, fly = false, run = false, dragLook = false;
  const keys = new Set();
  const spawn = () => {
    // in front of the thing, looking at it; a big flat thing (a map) is entered from above its middle
    const big = b.dims.x > 30 || b.dims.z > 30;
    if (big) { pos.set(b.center.x, b.box.max.y + 2, b.center.z); yaw = 0; }
    else { pos.set(b.center.x, b.box.min.y + SW_HUMAN - R + 0.05, b.box.max.z + Math.max(2.2, b.dims.z * 0.6)); yaw = 0; }
    pitch = big ? -0.25 : -0.05; vel.set(0, 0, 0);
  };
  spawn();
  const cam = new THREE.PerspectiveCamera(72, stage.camera.aspect, 0.03, stage.camera.far);
  const prevCam = stage.camera;
  stage.camera = cam;
  stage.controls.enabled = false;
  const fogNear = stage.scene.fog.near, fogFar = stage.scene.fog.far;
  stage.scene.fog.near = Math.max(25, b.radius * 2); stage.scene.fog.far = Math.max(120, b.radius * 10);
  const hideBody = stage.extra.visible;
  stage.extra.visible = false;
  // a sky while walking: the theme's ground overhead, lighter toward the horizon, so standing inside feels like outdoors
  const sc = swColors(), skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(sc.ground) }, mid: { value: new THREE.Color(sc.rule2).lerp(new THREE.Color(sc.ink3), 0.35) }, low: { value: new THREE.Color(sc.plate) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(mid, low, clamp(-y * 6.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -1;
  sky.onBeforeRender = (r, sc2, camera) => { sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); sky.updateMatrixWorld(); };
  stage.scene.add(sky);
  const fogCol = stage.scene.fog.color.clone();
  stage.scene.fog.color.copy(skyMat.uniforms.mid.value);

  // the HUD
  const host = stage.host;
  const hint = h('div', { class: 'sw-hint' });
  const exitB = h('button', { class: 'jk-tb sw-exit', type: 'button', onclick: () => end() }, icon('close', 12), h('span', { text: t('Wyjdź') }));
  const flyB = h('button', { class: 'jk-tb sw-fly', type: 'button', title: t('Lot: bez grawitacji i ścian (F)'), onclick: () => setFly(!fly) }, h('span', { text: t('Lot') }));
  const veil = h('button', { class: 'sw-veil', type: 'button', onclick: () => lock() }, h('b', { text: t('Kliknij, żeby wejść') }), h('span', { text: t('mysz rozgląda się, WASD idzie, Spacja skacze, Shift biegnie, F lata, Esc puszcza mysz') }));
  const cross = h('div', { class: 'sw-cross', 'aria-hidden': 'true' });
  const touch = matchMedia('(pointer: coarse)').matches;
  const stick = h('div', { class: 'sw-stick', hidden: !touch }, h('i'));
  const jumpB = h('button', { class: 'sw-jump', type: 'button', hidden: !touch, text: t('Skok') });
  const hud = h('div', { class: 'sw-hud' }, cross, hint, h('div', { class: 'sw-top' }, flyB, exitB), stick, jumpB, touch ? null : veil);
  host.append(hud);
  host.classList.add('sw-walking');
  const setFly = on => { fly = on; flyB.classList.toggle('on', fly); vel.set(0, 0, 0); };
  const say = () => { hint.textContent = fly ? t('lot: Spacja w górę, C w dół, F wraca na ziemię') : dragLook ? t('przeciągnij myszą, żeby się rozejrzeć; WASD idzie') : ''; };
  say();

  // desk: pointer lock, keys
  const cv = stage.canvas;
  // where the page may not lock the mouse (some embeddings), dragging looks around instead
  const noLock = () => { if (dragLook) return; dragLook = true; veil.hidden = true; say(); };
  const lock = () => {
    if (dragLook) return;
    try { const p = cv.requestPointerLock?.(); if (!cv.requestPointerLock) noLock(); else p?.catch?.(() => noLock()); } catch { noLock(); }
  };
  const locked = () => document.pointerLockElement === cv;
  const onLockChange = () => { veil.hidden = locked() || touch || dragLook; };
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', noLock);
  // the first move after the mouse is locked can carry a jump across the whole screen (a known browser quirk): skip it,
  // and never turn more than a quarter turn from one event
  let fresh = true;
  const onMouse = e => {
    if (!locked()) { fresh = true; return; }
    if (fresh) { fresh = false; return; }
    const mx = clamp(e.movementX, -300, 300), my = clamp(e.movementY, -300, 300);
    yaw -= mx * 0.0022; pitch = clamp(pitch - my * 0.0022, -1.5, 1.5);
  };
  document.addEventListener('mousemove', onMouse);
  const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyF']);
  let inside = true; // the last press was in this window (keys then belong to the walk)
  const onDocDown = e => { inside = host.contains(e.target); };
  document.addEventListener('pointerdown', onDocDown, true);
  const active = () => locked() || (inside && !/^(input|textarea|select)$/i.test(document.activeElement?.tagName || ''));
  const onKey = e => {
    if (e.key === 'Escape' && (locked() || inside)) {
      // the first Esc lets go of the mouse (the browser usually does it itself), the next one leaves
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.type !== 'keydown') return;
      if (locked()) { try { document.exitPointerLock(); } catch { /* fine */ } return; }
      end(); return;
    }
    if (!active() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!MOVE.has(e.code)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'keydown') {
      if (e.code === 'KeyF' && !e.repeat) { setFly(!fly); say(); return; }
      if (e.code === 'Space' && !fly && onGround && !e.repeat) { vel.y = 4.4; onGround = false; }
      keys.add(e.code);
    } else keys.delete(e.code);
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  const onBlur = () => keys.clear();
  window.addEventListener('blur', onBlur);
  // phone: the left thumb walks (a stick), the right one looks, a button jumps
  const tstate = { id: null, x: 0, y: 0, dx: 0, dy: 0, look: null, lx: 0, ly: 0 };
  const onTouchDown = e => {
    if (e.pointerType === 'mouse' && dragLook && e.button === 0 && !e.target.closest('button')) { tstate.look = e.pointerId; tstate.lx = e.clientX; tstate.ly = e.clientY; try { host.setPointerCapture(e.pointerId); } catch { /* fine */ } return; }
    if (e.pointerType !== 'touch' || e.target.closest('button')) return;
    const r = host.getBoundingClientRect(), left = e.clientX - r.left < r.width * 0.45;
    if (left && tstate.id === null) { tstate.id = e.pointerId; tstate.x = e.clientX; tstate.y = e.clientY; tstate.dx = tstate.dy = 0; stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px'; stick.classList.add('on'); }
    else if (!left && tstate.look === null) { tstate.look = e.pointerId; tstate.lx = e.clientX; tstate.ly = e.clientY; }
    else return;
    e.preventDefault();
    try { host.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  const onTouchMove = e => {
    if (e.pointerId === tstate.id) { tstate.dx = clamp((e.clientX - tstate.x) / 50, -1, 1); tstate.dy = clamp((e.clientY - tstate.y) / 50, -1, 1); stick.firstChild.style.transform = `translate(${tstate.dx * 22}px, ${tstate.dy * 22}px)`; }
    else if (e.pointerId === tstate.look) { yaw -= (e.clientX - tstate.lx) * 0.006; pitch = clamp(pitch - (e.clientY - tstate.ly) * 0.006, -1.5, 1.5); tstate.lx = e.clientX; tstate.ly = e.clientY; }
  };
  const onTouchUp = e => {
    if (e.pointerId === tstate.id) { tstate.id = null; tstate.dx = tstate.dy = 0; stick.classList.remove('on'); stick.firstChild.style.transform = ''; }
    if (e.pointerId === tstate.look) tstate.look = null;
  };
  host.addEventListener('pointerdown', onTouchDown);
  host.addEventListener('pointermove', onTouchMove);
  host.addEventListener('pointerup', onTouchUp);
  host.addEventListener('pointercancel', onTouchUp);
  jumpB.addEventListener('pointerdown', e => { e.preventDefault(); if (fly) return; if (onGround) { vel.y = 4.4; onGround = false; } });

  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), wish = new THREE.Vector3();
  const STEP = 0.55, ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const tv3 = new THREE.Vector3(), tv4 = new THREE.Vector3(), tv5 = new THREE.Vector3(), tv6 = new THREE.Vector3(), fseg = new THREE.Line3(), fbox = new THREE.Box3();
  let grounded = 0; // a few substeps of memory, so a step is still climbed when the ground flickers between substeps
  /* does a body standing with its top sphere at p touch nothing? */
  const free = p => {
    fseg.start.copy(p); fseg.end.copy(p); fseg.end.y -= SEGL;
    fbox.makeEmpty(); fbox.expandByPoint(fseg.start); fbox.expandByPoint(fseg.end);
    fbox.min.addScalar(-R); fbox.max.addScalar(R);
    let hit = false;
    geom.boundsTree.shapecast({
      intersectsBounds: bb => bb.intersectsBox(fbox),
      intersectsTriangle: tri => { if (tri.closestPointToSegment(fseg, tv5, tv6) < R - 0.02) { hit = true; return true; } return false; },
    });
    return !hit;
  };
  const step = dt => {
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    wish.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(side);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(side);
    if (tstate.id !== null) { wish.addScaledVector(fwd, -tstate.dy); wish.addScaledVector(side, tstate.dx); }
    run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (wish.lengthSq() > 1) wish.normalize();
    if (fly) {
      const sp = (run ? 14 : 5) * Math.max(1, b.size / 40);
      const look = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const v = new THREE.Vector3().addScaledVector(side, wish.dot(side)).addScaledVector(look, wish.dot(fwd));
      if (keys.has('Space')) v.y += 1;
      if (keys.has('KeyC')) v.y -= 1;
      pos.addScaledVector(v, sp * dt);
      return;
    }
    const sp = run ? 6.2 : 2.8;
    // small steps (as in three-mesh-bvh's character example), so fast moves do not pass through walls
    const N = Math.max(1, Math.min(40, Math.ceil(dt * 300))), h1 = dt / N; // about 300 small steps a second, whatever the frame rate
    for (let i = 0; i < N; i++) {
      const was = onGround || grounded > 0;
      vel.y += onGround ? 0 : h1 * -9.81;
      pos.addScaledVector(vel, h1);
      const bx = pos.x, bz = pos.z;
      pos.addScaledVector(wish, sp * h1);
      seg.start.copy(pos); seg.end.copy(pos).y -= SEGL;
      tbox.makeEmpty(); tbox.expandByPoint(seg.start); tbox.expandByPoint(seg.end);
      tbox.min.addScalar(-R); tbox.max.addScalar(R);
      geom.boundsTree.shapecast({
        intersectsBounds: bb => bb.intersectsBox(tbox),
        intersectsTriangle: tri => {
          const d = tri.closestPointToSegment(seg, tv, tv2);
          if (d < R) { const depth = R - d, dir = tv2.sub(tv).normalize(); seg.start.addScaledVector(dir, depth); seg.end.addScaledVector(dir, depth); }
        },
      });
      dv.subVectors(seg.start, pos);
      onGround = dv.y > Math.abs(h1 * vel.y * 0.25);
      const off = Math.max(0, dv.length() - 1e-5);
      dv.normalize().multiplyScalar(off);
      pos.add(dv);
      if (!onGround) { dv.normalize(); vel.addScaledVector(dv, -dv.dot(vel)); } else vel.set(0, 0, 0);
      // a step up to STEP high is climbed by walking into it: look a little ahead of the body for the top of the step
      if (was && wish.lengthSq() > 0.04) {
        const want = sp * h1 * Math.sqrt(wish.lengthSq()), moved = Math.hypot(pos.x - bx, pos.z - bz);
        if (moved < want * 0.4) {
          tv3.set(wish.x, 0, wish.z).normalize();
          ray.origin.set(pos.x + tv3.x * (R + 0.08), pos.y + STEP, pos.z + tv3.z * (R + 0.08));
          const hit = geom.boundsTree.raycastFirst(ray, THREE.DoubleSide);
          const foot = pos.y - SEGL - R;
          if (hit) {
            const rise = hit.point.y - foot;
            if (rise > 0.03 && rise <= STEP) { const ny = hit.point.y + SEGL + R + 0.01; if (free(tv4.set(pos.x, ny, pos.z))) { pos.y = ny; vel.y = 0; } }
          }
        }
      }
      grounded = onGround ? 3 : Math.max(0, grounded - 1);
    }
    if (pos.y < b.box.min.y - 40) spawn(); // fell off the world: back to the door
  };
  const syncCam = () => { cam.position.set(pos.x, pos.y + EYE, pos.z); cam.rotation.set(pitch, yaw, 0, 'YXZ'); };
  const untick = stage.tick(dt => {
    step(dt);
    syncCam();
    const w = stage.host.clientWidth, hh = stage.host.clientHeight;
    if (w && hh && Math.abs(cam.aspect - w / hh) > 1e-3) { cam.aspect = w / hh; cam.updateProjectionMatrix(); }
    return true;
  });
  if (!touch && o.lock) lock();
  let ended = false;
  function end() {
    if (ended) return;
    ended = true;
    untick();
    if (locked()) document.exitPointerLock?.();
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('pointerlockerror', noLock);
    document.removeEventListener('mousemove', onMouse);
    document.removeEventListener('pointerdown', onDocDown, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('blur', onBlur);
    host.removeEventListener('pointerdown', onTouchDown);
    host.removeEventListener('pointermove', onTouchMove);
    host.removeEventListener('pointerup', onTouchUp);
    host.removeEventListener('pointercancel', onTouchUp);
    hud.remove(); host.classList.remove('sw-walking');
    geom.disposeBoundsTree(); geom.dispose();
    stage.camera = prevCam; stage.controls.enabled = true;
    stage.scene.fog.near = fogNear; stage.scene.fog.far = fogFar; stage.scene.fog.color.copy(fogCol);
    stage.scene.remove(sky); sky.geometry.dispose(); skyMat.dispose();
    stage.extra.visible = hideBody;
    stage.redraw();
    o.onEnd?.();
  }
  return { end, get pos() { return pos.clone(); }, get onGround() { return onGround; }, get fly() { return fly; }, keys,
    face(y, p = 0) { yaw = y; pitch = p; }, place(x, y, z) { pos.set(x ?? pos.x, y ?? pos.y, z ?? pos.z); vel.set(0, 0, 0); },
    /* run the body for a while without drawing (tests, or an agent checking that a place can be walked) */
    simulate(sec, hold = []) { for (const k of hold) keys.add(k); for (let tt = 0; tt < sec; tt += 1 / 60) step(1 / 60); for (const k of hold) keys.delete(k); syncCam(); } };
}
