/* Studio R1: native Jaskinia views sharing a single authored document.
   No L/store/RT/TYPES/iframe/window manager access. R1 experimental only.
   This is injected by the existing Jaskinia renderer before 90-start.js. */
(() => {
  'use strict';
  const API = window.Jaskinia?.ext;
  if (!API?.type || !API?.open) return;
  const M = StudioR1Model;
  const KEY = 'jaskinia-studio-r1:demo:1';
  const listeners = new Set();
  let warning = '';
  function restore() {
    try {
      const json = localStorage.getItem(KEY);
      if (!json) return M.make();
      const doc = JSON.parse(json);
      if (!M.valid(doc)) throw new Error('niezgodny format');
      return doc;
    } catch (e) {
      warning = 'Odczyt zapisanej wersji nie powiódł się — stare dane pozostawiono bez zmian. Eksportuj pracę przed dalszą edycją.';
      return M.make();
    }
  }
  const doc = M.history(restore());
  function save() {
    if (warning) return; // never silently overwrite unreadable original bytes
    try { localStorage.setItem(KEY, JSON.stringify(doc.get())); }
    catch (e) { warning = 'Autozapis niedostępny. Pobierz JSON, by zachować pracę.'; }
  }
  const state = () => ({ ...doc.info(), data: doc.get(), warning });
  function publish() { const v = state(); for (const fn of [...listeners]) { try { fn(v); } catch (e) { console.error(e); } } }
  function commit(changes) { if (doc.change(d => M.apply(d, changes))) { save(); publish(); return true; } return false; }
  function replace(d) { if (doc.replace(d)) { save(); publish(); } }
  function undo() { if (doc.undo()) { save(); publish(); } }
  function redo() { if (doc.redo()) { save(); publish(); } }
  function subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); }
  function exportDoc() {
    const payload = JSON.stringify(doc.get(), null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'Studio_R1_Dokument.json'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  async function importDoc(file) {
    if (!file || file.size > 1024 * 1024) throw new Error('Nieprawidłowy lub zbyt duży plik');
    const d = JSON.parse(await file.text());
    if (!M.valid(d)) throw new Error('Nieobsługiwany dokument. Ten R1 nie importuje projektów Asset Lab.');
    replace(d);
  }
  function elt(tag, cls, text) {
    const e = document.createElement(tag); if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const style = elt('style');
  style.textContent = `
  .studio-r1 { height:100%; min-height:150px; display:flex; flex-direction:column; gap:8px; color:inherit; font:inherit; padding:10px; box-sizing:border-box; overflow:auto; }
  .studio-r1 * {box-sizing:border-box;} .studio-r1 .r1-bar {display:flex; align-items:center; flex-wrap:wrap; gap:6px;}
  .studio-r1 button, .studio-r1 select {font:inherit; padding:5px 9px; color:inherit; background:rgba(125,150,185,.13);border:1px solid rgba(125,150,185,.4); border-radius:5px; cursor:pointer;}
  .studio-r1 button:disabled {opacity:.35;cursor:default;} .studio-r1 .r1-status{font-size:12px; opacity:.8;}
  .studio-r1 .r1-palette {display:flex; flex-wrap:wrap;gap:4px;} .studio-r1 .r1-swatch {width:32px;height:32px;padding:0;border:2px solid transparent;}
  .studio-r1 .r1-swatch[aria-pressed="true"] {outline:2px solid currentColor;outline-offset:2px;}
  .studio-r1 .r1-stage {flex:1; min-height:120px; display:grid; place-items:center; overflow:auto; background:repeating-conic-gradient(#111c2b 0% 25%,#243249 0% 50%) 50%/24px 24px; border:1px solid rgba(125,150,185,.4); border-radius:6px;}
  .studio-r1 canvas {image-rendering:pixelated; image-rendering:crisp-edges; touch-action:none; cursor:crosshair; display:block; max-width:100%;}
  .studio-r1 .r1-readonly canvas {cursor:default;}
  .studio-r1 .r1-note {font-size:12px;opacity:.75;} .studio-r1 .r1-warn {color:#efab72;}
  `;
  document.head.append(style);

  function image(canvas, data) {
    const ctx = canvas.getContext('2d', { alpha: false });
    const pixels = ctx.createImageData(M.SIDE, M.SIDE);
    for (let i = 0; i < data.pixels.length; i++) {
      const rgb = M.COLORS[data.pixels[i]].slice(1);
      pixels.data[i * 4] = parseInt(rgb.slice(0, 2), 16);
      pixels.data[i * 4 + 1] = parseInt(rgb.slice(2, 4), 16);
      pixels.data[i * 4 + 2] = parseInt(rgb.slice(4, 6), 16);
      pixels.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  function build(box, c, isPainter) {
    const root = elt('section', 'studio-r1');
    root.dataset.studioR1 = isPainter ? 'painter' : 'observer';
    const bar = elt('div', 'r1-bar');
    const heading = elt('strong', null, isPainter ? 'Studio R1 · Obraz' : 'Studio R1 · Obserwator');
    const status = elt('span', 'r1-status');
    bar.append(heading, status);
    const stage = elt('div', 'r1-stage' + (isPainter ? '' : ' r1-readonly'));
    const canvas = elt('canvas'); canvas.width = canvas.height = M.SIDE;
    canvas.style.width = isPainter ? 'min(100%, 390px)' : 'min(100%, 300px)';
    canvas.setAttribute('aria-label', isPainter ? 'Maluj w dokumencie Studio R1' : 'Podgląd wspólnego dokumentu');
    stage.append(canvas);
    const command = elt('div', 'r1-bar');
    const undoB = elt('button', null, 'Cofnij'); const redoB = elt('button', null, 'Ponów');
    const secondB = elt('button', null, isPainter ? 'Otwórz obserwator' : 'Otwórz edytor');
    const exportB = elt('button', null, 'Eksport JSON');
    const importB = elt('button', null, 'Otwórz JSON'); const file = elt('input');
    file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    command.append(undoB, redoB, secondB, exportB, importB, file);
    undoB.onclick = undo; redoB.onclick = redo;
    secondB.onclick = () => c.openType(isPainter ? 'studio-r1-observer' : 'studio-r1-painter', { fresh: true, w: .46, h: .66 });
    exportB.onclick = exportDoc;
    importB.onclick = () => file.click();
    file.onchange = async () => {
      if (!file.files?.[0]) return;
      try { await importDoc(file.files[0]); } catch (e) { alert(e.message); }
      file.value = '';
    };
    let selected = 3;
    const palette = elt('div', 'r1-palette');
    if (isPainter) for (let i = 0; i < M.COLORS.length; i++) {
      const b = elt('button', 'r1-swatch'); b.style.background = M.COLORS[i];
      b.title = 'Kolor ' + (i + 1); b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(i === selected));
      b.onclick = () => { selected = i; [...palette.children].forEach((x, j) => x.setAttribute('aria-pressed', String(j === selected))); };
      palette.append(b);
    }
    const note = elt('div', 'r1-note', isPainter
      ? 'Pociągnięcie myszy = jedna odwracalna zmiana. Drugi widok korzysta z tego samego dokumentu.'
      : 'Ten widok obserwuje źródło; jego zamknięcie nie zamyka ani nie usuwa dokumentu.');
    const warning = elt('div', 'r1-warn');
    root.append(bar, command, palette, stage, note, warning);
    box.append(root);
    const unsub = subscribe(({ data, canUndo, canRedo, warning: w }) => {
      image(canvas, data);
      status.textContent = 'rewizja ' + data.revision;
      undoB.disabled = !canUndo; redoB.disabled = !canRedo;
      warning.textContent = w;
    });
    c.onDispose(unsub);
    if (isPainter) {
      let drawing = null;
      const point = e => {
        const r = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / r.width * M.SIDE);
        const y = Math.floor((e.clientY - r.top) / r.height * M.SIDE);
        return x >= 0 && y >= 0 && x < M.SIDE && y < M.SIDE ? [x, y, selected] : null;
      };
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault(); drawing = new Map();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        const p = point(e); if (p) { drawing.set(p[0]+','+p[1], p); image(canvas, M.apply(doc.get(), [...drawing.values()])); }
      });
      canvas.addEventListener('pointermove', e => {
        if (!drawing) return;
        const p = point(e); if (!p) return;
        drawing.set(p[0]+','+p[1], p);
        image(canvas, M.apply(doc.get(), [...drawing.values()]));
      });
      const finish = () => { if (!drawing) return; const patches = [...drawing.values()]; drawing = null; if (!commit(patches)) publish(); };
      canvas.addEventListener('pointerup', finish);
      canvas.addEventListener('pointercancel', finish);
      c.onDispose(() => { if (drawing) finish(); });
    }
  }
  API.type('studio-r1-painter', {group:'misc', name:'Studio R1 — obraz', desc:'Izolowany test wspólnego dokumentu — możesz malować.', glyph:'t_wybor', fill:true, noZoom:true, sized:true, render:(box,c)=>build(box,c,true)});
  API.type('studio-r1-observer', {group:'misc', name:'Studio R1 — obserwator', desc:'Ten sam dokument w drugim oknie.', glyph:'t_wybor', fill:true, noZoom:true, sized:true, render:(box,c)=>build(box,c,false)});
})();
