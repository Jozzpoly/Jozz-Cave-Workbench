/* =========================================================
   Jaskinia — Jozz's workbench over all projects.
   Windows tile the screen; Jozz moves, splits, closes, floats, maximizes
   and re-purposes them. Panels come from the Library (window.__BIB).
   ========================================================= */
const B = window.__BIB;
const { D, R, FAM, LIFE, LIFE_ORDER, SNAP, DAY, h, s, fmt, pl, plural, ago, when, day, heatOf, heatVar, sigil, toast } = B;
const REPOS = D.repos;
const FRESH = REPOS.slice().sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = (p = '') => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
const NARROW_STAGE = 700; // below this width the phone layout shows one window at a time
const DSHORT = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const DSHORT_EN = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
const snapAgeDays = () => (Date.now() / 1000 - SNAP) / DAY;
/* who this build is (the top bar shows it, so a screen recording names its own version) and where it runs:
   'plik' a downloaded file, 'web' a server of Jozz's own, 'claude' inside claude.ai (other sites cannot open in a window there) */
const BUILD = (typeof JASK_BUILD !== 'undefined' && JASK_BUILD) || { v: '?', built: '', host: 'artifact' };
const VER = 'v' + BUILD.v;
const PLACE = B.RUNS_LOCAL ? 'plik' : B.HOSTED ? 'web' : 'claude';
const PLACE_NAME = { plik: 'plik na tym urządzeniu', web: 'własny serwer', claude: 'claude.ai' };

/* ---------- preferences: how Jaskinia looks and behaves on this device ---------- */
const PREFS_KEY = 'jaskinia:prefs';
const PREF_CHOICES = {
  theme: ['jaskinia', 'kataster', 'neon', 'piwnica'],
  scheme: ['auto', 'ciemna', 'jasna'],
  life: ['zielen', 'zar'],
  density: ['zwarta', 'srednia', 'duza'],
  lang: ['pl', 'en'],
  wheel: ['zoom', 'pan'],
  motion: ['full', 'less'],
  games: ['auto', 'okno', 'karta'],
};
const PREFS_DEF = { theme: 'jaskinia', scheme: 'auto', life: 'zielen', density: 'srednia', cz: 1, lang: 'pl', wheel: 'zoom', tips: true, motion: 'full', games: 'auto' };
function sanitizePrefs(p) {
  const out = { ...PREFS_DEF };
  if (!p || typeof p !== 'object') return out;
  for (const [k, list] of Object.entries(PREF_CHOICES)) if (list.includes(p[k])) out[k] = p[k];
  if (Number.isFinite(+p.cz)) out.cz = clamp(Math.round(+p.cz * 100) / 100, 0.6, 1.8);
  if (typeof p.tips === 'boolean') out.tips = p.tips;
  return out;
}
const prefs = (() => { try { return sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch { return sanitizePrefs({}); } })();
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); return true; } catch { return false; } }

/* ---------- interface language: Polish source strings, English beside them (05-i18n.js) ---------- */
function t(src, ...a) {
  let x = (prefs.lang === 'en' && typeof EN !== 'undefined' && EN[src] != null) ? EN[src] : src;
  if (typeof x === 'function') return x(...a);
  if (Array.isArray(x)) x = x[0];
  return a.length ? String(x).replace(/\{(\d)\}/g, (_, i) => a[+i] ?? '') : x;
}
/* a counted noun: Polish has three forms, English two (EN[one] = [singular, plural]) */
function tn(n, one, few, many) {
  if (prefs.lang === 'en' && typeof EN !== 'undefined' && Array.isArray(EN[one])) return `${fmt(n)} ${n === 1 ? EN[one][0] : EN[one][1]}`;
  return pl(n, one, few, many);
}
const dshort = d => (prefs.lang === 'en' ? DSHORT_EN : DSHORT).format(d);

/* ---------- icons: 16×16, stroked with currentColor ---------- */
const ICONS = {
  splitRow: 'M2.5 3.5h11v9h-11z M8 3.5v9',
  splitCol: 'M2.5 3.5h11v9h-11z M2.5 8h11',
  float: 'M5.5 5.5V2.5h8v7h-3 M2.5 6.5h8v7h-8z',
  dock: 'M2.5 2.5h11v11h-11z M8 5v5.5 M5.5 8 8 10.5 10.5 8',
  max: 'M2.5 6V2.5H6 M10 2.5h3.5V6 M13.5 10v3.5H10 M6 13.5H2.5V10',
  restore: 'M6 2.5V6H2.5 M13.5 6H10V2.5 M10 13.5V10h3.5 M2.5 10H6v3.5',
  close: 'M4 4l8 8 M12 4l-8 8',
  plus: 'M8 3v10 M3 8h10',
  minus: 'M3 8h10',
  chev: 'M4.5 6.5 8 10l3.5-3.5',
  more: 'M3.5 8h.01 M8 8h.01 M12.5 8h.01',
  pin: 'M6 2.5h4 M7 2.5v3.8L4.6 9h6.8L9 6.3V2.5 M8 9v4.5',
  undo: 'M5.5 3.5 2.5 6.5l3 3 M2.8 6.5H10a3.5 3.5 0 0 1 0 7H7',
  redo: 'M10.5 3.5l3 3-3 3 M13.2 6.5H6a3.5 3.5 0 0 0 0 7h3',
  help: 'M6 6.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4 M8 12.2v.01',
  play: 'M5 3.2v9.6l7.5-4.8z',
  ext: 'M9 2.5h4.5V7 M13.5 2.5 7.5 8.5 M11.5 9.5v4h-9v-9h4',
  search: 'M7 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z M10.3 10.3l3.2 3.2',
  check: 'M3.5 8.5l3 3 6-7',
  reset: 'M3 8a5 5 0 1 0 1.5-3.6 M3 2.5v3h3',
  copy: 'M5.5 5.5h8v8h-8z M2.5 10.5v-8h8',
  swap: 'M3 5.5h9.5L10 3 M13 10.5H3.5L6 13',
  menu: 'M2.5 4.5h11 M2.5 8h11 M2.5 11.5h11',
  gear: 'M8 5.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z M8 1.8v1.8 M8 12.4v1.8 M1.8 8h1.8 M12.4 8h1.8 M3.6 3.6l1.3 1.3 M11.1 11.1l1.3 1.3 M3.6 12.4l1.3-1.3 M11.1 4.9l1.3-1.3',
  trash: 'M3 4.5h10 M6.5 4.5V3h3v1.5 M4.5 4.5l.7 9h5.6l.7-9 M7 7v4.5 M9 7v4.5',
  save: 'M3 2.5h8l2 2v9H3z M5.5 2.5v3.5h4.5V2.5 M5 13.5V9.5h6v4',
  download: 'M8 2.5v8 M4.8 7.5 8 10.7l3.2-3.2 M2.5 13.5h11',
  upload: 'M8 10.5v-8 M4.8 5.7 8 2.5l3.2 3.2 M2.5 13.5h11',
  fit: 'M2.5 6V2.5H6 M10 2.5h3.5V6 M13.5 10v3.5H10 M6 13.5H2.5V10 M5.5 5.5h5v5h-5z',
  frame: 'M2.5 5h11v8.5h-11z M2.5 5V2.5h5.5V5',
  note: 'M3 2.5h10v7l-4 4H3z M9 13.5v-4h4',
  link: 'M6.5 9.5l3-3 M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1 M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1',
  pencil: 'M10.5 2.5l3 3-7.5 7.5H3v-3z M9 4l3 3',
  arrowL: 'M10 3.5 5.5 8l4.5 4.5',
  arrowR: 'M6 3.5 10.5 8 6 12.5',
  palette: 'M8 2a6 6 0 1 0 0 12c1 0 1.3-.8.9-1.6-.5-.9 0-1.9 1.1-1.9H12a2 2 0 0 0 2-2C14 4.6 11.3 2 8 2z M5 7.5h.01 M6.5 5h.01 M9.5 5h.01',
  globe: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z M2 8h12 M8 2c1.8 1.8 2.5 3.8 2.5 6S9.8 12.2 8 14 M8 2C6.2 3.8 5.5 5.8 5.5 8s.7 4.2 2.5 6',
  keyboard: 'M2 4.5h12v7H2z M4.5 7h.01 M7 7h.01 M9.5 7h.01 M12 7h.01 M5 9.5h6',
  info: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z M8 7.5v4 M8 5v.01',
  archive: 'M2.5 3h11v3h-11z M3.5 6v7.5h9V6 M6.5 9h3',
  layers: 'M8 2.5 14 6 8 9.5 2 6z M2 9l6 3.5L14 9',
  eye: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  grid4: 'M2.5 2.5h4.5v4.5H2.5z M9 2.5h4.5v4.5H9z M2.5 9h4.5v4.5H2.5z M9 9h4.5v4.5H9z',
  spread: 'M5.5 8H1.5 M3.5 6l-2 2 2 2 M10.5 8h4 M12.5 6l2 2-2 2 M6.5 4.5h3v7h-3z',
  phone: 'M4.5 1.5h7v13h-7z M7 12.5h2',
  warn: 'M8 2.5 14 13H2z M8 6.5v3.2 M8 11.6v.01',
  flag: 'M3.5 14V2.5 M3.5 3h8.5l-2.2 3.2 2.2 3.3H3.5',
  hand: 'M5.5 8V3.8a1 1 0 0 1 2 0V7.5 M7.5 7V2.8a1 1 0 0 1 2 0V7.5 M9.5 7.2V3.8a1 1 0 0 1 2 0v5.4c0 2.8-1.8 4.3-4 4.3-1.8 0-2.6-.8-3.6-2.3L2.5 8.6a1 1 0 0 1 1.6-1.2l1.4 1.4',
  /* window types */
  t_wybor: 'M2.5 2.5h11v11h-11z M8 5.5v5 M5.5 8h5',
  t_mapa: 'M2.5 2.5h11v11h-11z M8.5 2.5v11 M2.5 9h6 M8.5 6.5h5 M5 9v4.5',
  t_sciana: 'M2 3h6v4.5H2z M9.5 2.5h4.5v3H9.5z M9.5 7h4.5v6.5H9.5z M2 9h5.5v4.5H2z',
  t_kataster: 'M2.5 4h1 M5.5 4h8 M2.5 8h1 M5.5 8h8 M2.5 12h1 M5.5 12h8',
  t_spis: 'M2.5 3.5h5 M4.5 6.5h4 M4.5 9.5h6 M2.5 12.5h5 M3 3.5v6h1.5',
  t_puls: 'M1.5 13.5h13 M3 13.5v-3 M5 13.5v-6 M7 13.5v-2 M9 13.5V4 M11 13.5V9 M13 13.5v-5',
  t_historia: 'M1.5 6c2 0 2-3 4-3s2 3 4 3 2-1.5 5-1.5 M1.5 10c2 0 3-2.5 4.5-2.5S8 10 10 10s3-1 4.5-1 M1.5 13.5h13',
  t_ustalenia: 'M8 2.5 14 13H2z M8 6.5v3.2 M8 11.6v.01',
  t_zmiany: 'M3.2 6.5A5 5 0 0 1 12.5 5 M12.8 9.5A5 5 0 0 1 3.5 11 M12.5 2v3h-3 M3.5 14v-3h3',
  t_zagraj: 'M2.5 3.5h5v4h-5z M8.5 3.5h5v4h-5z M2.5 8.5h5v4h-5z M8.5 8.5h5v4h-5z',
  t_gra: 'M8 1.8a6.2 6.2 0 1 1 0 12.4A6.2 6.2 0 0 1 8 1.8z M6.6 5.3v5.4L10.8 8z',
  t_karta: 'M2.5 2.5h11v11h-11z M5 5.5h6 M5 8h6 M5 10.5h3.5',
  t_galezie: 'M4.5 2.5v11 M4.5 9.5c0-3 7-2 7-6.5 M4.5 6.5c0-2 3.5-1.5 3.5-4',
  t_rytm: 'M1.5 13.5h13 M3 13.5v-2 M4.5 13.5v-5 M6 13.5v-1 M7.5 13.5v-7 M9 13.5v-3 M10.5 13.5v-8 M12 13.5v-4 M13.5 13.5v-2',
  t_stan: 'M3 4.5h4v4H5.2c0 1.5.6 2.5 1.8 3 M9 4.5h4v4h-1.8c0 1.5.6 2.5 1.8 3',
  t_statystyki: 'M2.5 13.5h11 M4 13.5V8 M7 13.5V5 M10 13.5V9.5 M13 13.5V3',
  t_wykres: 'M1.5 13.5h13 M2.5 11 5.5 7l3 3 5-6.5',
  t_ranking: 'M2.5 13.5v-4h3.5v4 M6 13.5V5h4v8.5 M10 13.5V8h3.5v5.5 M1.5 13.5h13',
  t_rok: 'M2.5 3.5h11v10h-11z M2.5 6.5h11 M5.5 3.5v10 M8.5 3.5v10 M11 3.5v10 M2.5 9.5h11',
  t_zegar: 'M8 1.8a6.2 6.2 0 1 1 0 12.4A6.2 6.2 0 0 1 8 1.8z M8 4.5V8l2.5 1.8',
  t_notatki: 'M3.5 2.5h7l2 2v9h-9z M5.5 6.5h5 M5.5 9h5 M5.5 11.5h3',
  t_dane: 'M6 2.5c-2 0-2 1-2 2.5s0 2.5-1.5 3c1.5.5 1.5 1.5 1.5 3s0 2.5 2 2.5 M10 2.5c2 0 2 1 2 2.5s0 2.5 1.5 3c-1.5.5-1.5 1.5-1.5 3s0 2.5-2 2.5',
  t_wiedza: 'M8 4c-1.5-1-3.5-1.5-5.5-1.5v10c2 0 4 .5 5.5 1.5 1.5-1 3.5-1.5 5.5-1.5v-10C11.5 2.5 9.5 3 8 4z M8 4v10',
  t_ustawienia: 'M8 5.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z M8 1.8v1.8 M8 12.4v1.8 M1.8 8h1.8 M12.4 8h1.8 M3.6 3.6l1.3 1.3 M11.1 11.1l1.3 1.3 M3.6 12.4l1.3-1.3 M11.1 4.9l1.3-1.3',
};
function icon(name, size = 16, cls = '') {
  return s('svg', { class: 'ic ' + cls, viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': 'true' },
    s('path', { d: ICONS[name] || ICONS.t_wybor }));
}
function ibtn(name, label, onclick, cls = '') {
  return h('button', { class: 'ib ' + cls, type: 'button', title: label, 'aria-label': label, onclick }, icon(name));
}
/* replaceChildren that tolerates the null/false holes h() already tolerates (v1 printed the word "null") */
function fill(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false && k !== '')); return el; }
