/* Studio R1 — intentionally narrow, pure authored-document model.
   Isolated experiment: do not promote its format as a universal Studio format. */
const StudioR1Model = (() => {
  'use strict';
  const SIDE = 24;
  const FORMAT = 'jaskinia-studio-r1/1';
  const COLORS = Object.freeze(['#131b29', '#315d86', '#67c4ed', '#ffb85a', '#f5f4de', '#e76e67']);
  function make() {
    const pixels = new Array(SIDE * SIDE).fill(0);
    for (let y = 3; y < 17; y++) for (let x = 9; x < 15; x++) pixels[y * SIDE + x] = 1;
    for (let y = 6; y < 15; y++) for (let x = 10; x < 14; x++) pixels[y * SIDE + x] = 2;
    for (let y = 17; y < 21; y++) for (let x = 10; x < 14; x++) pixels[y * SIDE + x] = y % 2 ? 3 : 4;
    return { format: FORMAT, width: SIDE, height: SIDE, revision: 0, pixels };
  }
  function valid(d) {
    return !!d && d.format === FORMAT && d.width === SIDE && d.height === SIDE && Number.isSafeInteger(d.revision) && d.revision >= 0 && Array.isArray(d.pixels) && d.pixels.length === SIDE * SIDE && d.pixels.every(p => Number.isInteger(p) && p >= 0 && p < COLORS.length);
  }
  function clone(d) { if (!valid(d)) throw new Error('Niepoprawny dokument Studio R1'); return { ...d, pixels: d.pixels.slice() }; }
  function apply(d, changes) {
    const next = clone(d);
    for (const ch of changes) {
      if (!Array.isArray(ch) || ch.length !== 3) throw new Error('Niepoprawna zmiana');
      const [x, y, color] = ch;
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(color) || x < 0 || y < 0 || x >= SIDE || y >= SIDE || color < 0 || color >= COLORS.length) throw new Error('Zmiana poza płótnem');
      next.pixels[y * SIDE + x] = color;
    }
    if (next.pixels.every((c, i) => c === d.pixels[i])) return d;
    next.revision = d.revision + 1;
    return next;
  }
  function history(first) {
    let cur = clone(first), undo = [], redo = [];
    const info = () => ({ canUndo: undo.length > 0, canRedo: redo.length > 0 });
    return {
      get: () => clone(cur),
      info,
      change(fn) {
        const next = fn(cur);
        if (!valid(next)) throw new Error('Dokument niepoprawny po zmianie');
        if (next === cur || next.pixels.every((c, i) => c === cur.pixels[i])) return false;
        undo.push(cur);
        if (undo.length > 80) undo.shift();
        redo = []; cur = clone(next); return true;
      },
      replace(d) {
        const next = clone(d);
        if (next.pixels.every((c, i) => c === cur.pixels[i])) return false;
        undo.push(cur);
        if (undo.length > 80) undo.shift();
        redo = []; cur = { ...next, revision: cur.revision + 1 }; return true;
      },
      undo() {
        if (!undo.length) return false;
        redo.push(cur); cur = { ...undo.pop(), revision: cur.revision + 1 }; return true;
      },
      redo() {
        if (!redo.length) return false;
        undo.push(cur); cur = { ...redo.pop(), revision: cur.revision + 1 }; return true;
      }
    };
  }
  return Object.freeze({ SIDE, FORMAT, COLORS, make, valid, clone, apply, history });
})();
