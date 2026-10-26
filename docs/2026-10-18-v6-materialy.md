# Jaskinia v6: Materiały, a shared 3D stage, Wejdź

The owner's feedback of 17 Oct stopped the "Okazy" catalogue (321 byte-distinct builds of ~450 branches): byte-distinct
is not experience-distinct, and nobody needs every near-identical version on a wall. Representations of different
experiment directions stay welcome, but each repository is treated on its own, slowly, mostly with GPT. The catalogue
is shelved in the private generator as a donor. On 18 Oct he gave Claude the Jaskinia/Studio line together with Astra
(Feniks Studio): Studio uses Jaskinia's workbench instead of building a second shell.

**Shared goal (proposed to Astra on [PR #2](https://github.com/Jozzpoly/Jozz-Cave-Workbench/pull/2#issuecomment-6244986594)):**
in Jaskinia Jozz makes his own places from his own materials, steps inside them at 1:1 and develops them further, by
himself and with agents. v6 is Claude's half of the first step: the materials, the 3D look, and standing inside.
Astra's half is the place document and its editor (composition, variants, return to work).

## What the owner can do now

- **Bring his own models.** Drop **Blockbench's own `.bbmodel`** (straight from a save, no export), `.glb`, `.gltf`
  (with its `.bin` and pictures), `.obj` (with its `.mtl` and pictures) or pictures alone anywhere in Jaskinia, or use
  "Dodaj" in a "Materiały" window (group "Studio"). "Folder" takes a whole folder, such as Blockbench's saves, and
  reads only the models and the pictures they use; every other file (`.vox` included) is never opened.
  - `.bbmodel` (formats 4 and 5, checked on the owner's own saves): cubes with per-face UVs and face rotation,
    element and group pivots and rotations in Blockbench's ZYX order, inflate, mesh elements, embedded pictures kept
    pixel-sharp, and only what was visible when it was saved. 16 pixels are 1 metre, as in Blockbench's glTF export.
    Animations are not played yet.
  - Two `model.gltf` files in `hull/` and `thruster/` become "hull · model" and "thruster · model", not two versions
    of one material.
  - Blockbench glTF exports keep their embedded textures, skins and animations.
- **See them as they are.** A lit stage in the theme's colours: soft shadows, a metre grid, a 1.8 m person beside the
  model, and the size in metres (`11,0 m × 7,59 m × 10,4 m`), triangles, textures, a skeleton, animations to play.
- **Fix orientation and scale without touching the file.** Quarter turns about X, Y, Z and a scale (×1, ×1/16 for
  Blockbench pixels, ×1/100 for centimetres, …) are the material's defaults; a tiny or a huge model gets a hint.
- **Keep versions.** The same bytes again add nothing. A changed file with the same name becomes v2 of the same
  material, and v1 stays. Nothing is replaced silently, and deleting is soft, with "Cofnij".
- **Step inside (Wejdź).** A sky comes up over the theme's ground, and a body 1.8 m tall walks over the model with gravity: walls are solid, a step up to 0.55 m
  is climbed by walking into it, Space jumps, Shift runs, F flies. On a phone, the left thumb walks and the right one
  looks. A big flat model, such as a map, is entered from above its middle.
- **His own models are one click away.** Where the page can reach GitHub (a file on disk or his server, not claude.ai),
  an empty library offers his models from his public repositories: the house, stairs and test map from Box3D, the
  Blockbench vehicle parts, M6 from JV Web, the VAW blocks and a Blockbench animation.
- **Zagraj no longer takes over the game being played** (M1). The game in a window that followed the selection is
  pinned to what it shows. A second game opens beside the first, sharing the width. Zagraj on a game already open goes
  to its window.

## Architecture

| piece | where | notes |
|---|---|---|
| 3D runtime | `src/vendor/swiat3d.js`, built by `tools/swiat/build.mjs` | three.js 0.180.0, GLTFLoader, OBJLoader/MTLLoader, OrbitControls, RoomEnvironment, BufferGeometryUtils, SkeletonUtils, three-mesh-bvh 0.9.2. It is carried inside the page (no CDN, so it works from `file://` and in claude.ai) and only defines `window.__SWIAT3D_FACTORY`: three.js starts when a 3D window first asks. Adds about 0.85 MB to the page. |
| stage and walk | `src/jaskinia/56-swiat.js` | `swStage(host)`: renderer, light, theme colours (`--ground`, `--plate`, `--hand`, …), metre grid, framing, the 1.8 m person. It renders only when something changed, never in a hidden window, and lowers its pixel ratio while frames are slow. `swWalk(stage)`: a capsule (r 0.3, 1.8 m) against a BVH of the model and the ground, with ~300 substeps a second and a step-up probe. |
| materials | `src/jaskinia/56b-blockbench.js` | `bbModel(json)`: Blockbench's `.bbmodel` to three.js, as described above |
| `src/jaskinia/57-materialy.js` | IndexedDB `jaskinia-materialy`: `pliki` (bytes by SHA-256) and `materialy`. A material is a main file plus its companions. Its id is `m` plus the first 20 hex digits of its SHA-256 (or of the main and companion hashes). The `Materiały` window type is `live`, so a theme or layout change never rebuilds the stage. In claude.ai, glTF textures load through `<img>`, because the page may not `fetch()` its own `blob:` URLs. |
| public API | `src/jaskinia/58-api.js` | `window.Jaskinia` (v1), below. `JASK` is already the Library's flag, hence the full name. |

The materials stay outside layout undo, like notes. A window remembers only which material it shows (`st.sel`) and
whether the person is on (`store.views`).

## `window.Jaskinia` (v1): for Studio and other tools

```js
Jaskinia.ext.type(key, { name, glyph, desc, group: 'studio', render(box, c), ctx, live, liveKey, fill, noZoom })
Jaskinia.ext.icon(name, svgPathData)      // 16×16, stroked with currentColor
Jaskinia.ext.strings({ 'Polski tekst': 'English text' })
Jaskinia.ext.open(type, opts) / .toast(msg, action, ms) / .t(src, ...args)

Jaskinia.materialy.list() / .get(id) / .versions(id)
Jaskinia.materialy.object(id, { ground })  // → Promise<THREE.Object3D>, a fresh copy with the material's turns and scale
Jaskinia.materialy.import(files) / .on(fn) // fn gets { added, changed, removed }

Jaskinia.swiat.three()                    // → { THREE, GLTFLoader, OrbitControls, MeshBVH, … }, one copy for the page
Jaskinia.swiat.stage(host) / .walk(stage) / .human  // 1.8
```

A window type registered later brings back windows of that type that an older build kept aside (`w.lost`). In a
place document a material is referenced by its id. A new version has a new id, and nothing in a document is swapped
silently.

## Checks

`node tools/jk6_test.mjs [shots] [models]` runs 51 checks in SwiftShader with real models from the owner's
repositories. The page itself does not need the network. The checks cover:
- import, facts in metres, versions and dedupe;
- orientation and scale, the API object, and the 3D stage surviving a theme change;
- walking: the house stops the body, the stairs are climbed, a map is landed on;
- a file drop anywhere, and a refused drop that never navigates away;
- soft delete, the library surviving a reload, two games side by side, phone and claude.ai;
- a window type registered from outside after a build that did not know it (GPT-6's seam check);
- companion files in a material's identity, on the VAW Blockbench sample (Medium's counterexample);
- a folder of the owner's Blockbench saves (with a `.vox` file that must stay unopened), and the naming of same-named files.

SwiftShader takes seconds per frame for this scene, so the walking checks hold the drawing loop and move the body
with `simulate()`. On a real GPU the same scene draws in milliseconds.

## Limits, honestly

- **Formats.** Draco/meshopt-compressed glTF, KTX2 textures and FBX are not read yet. Several models in one file
  are one material, so choosing a node is for later.
- **Storage.** Materials live in one browser. On GitHub Pages that storage is shared with every page of
  `jozzpoly.github.io` (see the origin notes in [2026-10-16-szwy.md](2026-10-16-szwy.md)).
- **Walking.** The model is collided as it stands. Skinned meshes collide in their rest pose, and animated parts do
  not push the body.
- **Mouse.** Pointer lock needs a click. In some embeddings (claude.ai) the mouse may not lock: dragging to look is
  then the phone's way.

## Next (state at the end of 18 Oct, for whoever continues)

1. **Astra's place editor** on `window.Jaskinia`: her move, and she has not answered yet. When she does, settle three
   things on PR #2: how her document references materials, `object(id)` copies in her scene, and `walk()` on her stage.
2. **`materialy.pack(ids)` / `unpack(file)`:** one file that carries the bytes. It moves materials between the
   artifact, Pages and downloaded files, and lets a place export carry its materials (Medium's continuity check).
3. **Folder sync:** keep the folder handle (File System Access API), so that a Blockbench save becomes a new
   version with one "Odśwież z folderu", without picking files again.
4. **Blockbench:** play animations (keyframes on groups), and handle `box_uv` cubes saved without face UVs.
5. **The owner's own pass decides the next forging:** a real GPU, the real mouse lock, his saves.
   - Tests here run in SwiftShader and cannot judge feel.
   - The per-repository curation of experiment directions (the shelved Okazy) belongs to the GPT line, slowly.

