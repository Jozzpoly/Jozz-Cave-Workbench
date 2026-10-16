/* ---------- przyrządy: the owner's labs and games running in a window ----------
   A window of type "przyrzad" (or "gra") holds a running page in an iframe, and Jaskinia never reloads it on its own:
   a theme or density change, a layout change, another layout and back, or a narrow window leave it loaded
   (types with `live: true`; see wantKey and HOOK.refresh in 50-shell.js). A language change still relaunches all of
   Jaskinia. Loaded is not always running: a page from another origin stops animating while its window is hidden with
   display:none (another layout), and size changes reach the page (docs/2026-10-16-szwy.md).

   A lab may talk to Jaskinia through a small, optional contract (docs/przyrzad/KONTRAKT.md):
     lab → Jaskinia   {jaskinia:1, type:'hello', name, version, wants:['remark']}   who it is
                      {jaskinia:1, type:'state', text, data}                         what is happening now
                      {jaskinia:1, type:'signals', values:{name: number}}            numbers to draw live
                      {jaskinia:1, type:'event', text, level}                        something happened (goes to the log)
                      {jaskinia:1, type:'flag'}                                      Ctrl+. pressed inside the lab
     Jaskinia → lab   {jaskinia:1, type:'hi', v:1}  {type:'state?'}  {type:'remark', text, at}  {type:'visible', visible}
   Messages are taken only from pages Jaskinia itself opened in a window. Everything a lab says is its own claim:
   Jaskinia shows it as text and never runs it. */
const LIVE = new Map();           // window id → the running page in that window
const liveSubs = new Set();       // signal windows and status bars that redraw when an instrument says something
const LIVE_SPAN = 10 * 60e3, LIVE_PTS = 6000, LIVE_SIGS = 24, LIVE_EVS = 300, LIVE_DATA = 8192;
const KEY_LIVE_RECENT = 'jaskinia:przyrzady';
const lstr = (v, n) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '';
function smallData(v) {
  if (v === undefined || v === null) return null;
  try { const s = JSON.stringify(v); return s.length <= LIVE_DATA ? JSON.parse(s) : { za_duze: s.length }; } catch { return null; }
}
function liveOf(src) { for (const e of LIVE.values()) if (e.frame && e.frame.contentWindow === src) return e; return null; }
function liveName(e) { return e.hello ? (e.hello.name + (e.hello.version ? ' ' + e.hello.version : '')) : (e.title || hostOf(e.url)); }
const DEMO_URL = 'pokaz:pilki'; // the demo lab carried inside the build (LAB_DEMO, docs/przyrzad/demo.html)
function hostOf(u) { if (u === DEMO_URL) return t('Piłki: pokaz kontraktu'); try { const x = new URL(u); return x.protocol === 'file:' ? x.pathname.split('/').pop() || u : x.host + (x.pathname.length > 1 ? x.pathname.replace(/\/$/, '') : ''); } catch { return u; } }
function liveTalk(e, msg) { try { e.frame.contentWindow?.postMessage({ jaskinia: 1, ...msg }, '*'); } catch { /* the page is gone */ } }
let liveRaf = 0, liveDirty = new Set();
function liveChanged(e) {
  liveDirty.add(e);
  if (!liveRaf) liveRaf = requestAnimationFrame(() => { liveRaf = 0; const d = [...liveDirty]; liveDirty = new Set(); for (const f of [...liveSubs]) for (const x of d) f(x); });
}

/* a renderer hands over the iframe it made; the entry lives as long as the window's content */
function attachLive(c, frame, url, title) {
  const id = c.id, old = LIVE.get(id);
  const e = { id, frame, url, title: title || '', hello: null, state: null, sigs: new Map(), evs: [], marks: [], last: old ? old.last : 0, since: Date.now(), evT: [], quiet: 0, vis: null, waiting: [] };
  LIVE.set(id, e);
  frame.addEventListener('load', () => { e.hello = null; e.state = null; e.since = Date.now(); liveTalk(e, { type: 'hi', v: 1 }); liveChanged(e); });
  c.onDispose(() => { if (LIVE.get(id) === e) { LIVE.delete(id); liveChanged(e); } });
  return e;
}
function trimSeries(s, now) {
  let cut = s.t.length - LIVE_PTS;
  while (cut < s.t.length && (cut < 0 ? now - s.t[0] > LIVE_SPAN : now - s.t[cut] > LIVE_SPAN)) cut = Math.max(cut, 0) + 1;
  if (cut > 0) { s.t.splice(0, cut); s.v.splice(0, cut); }
}
addEventListener('message', ev => {
  const d = ev.data;
  if (!d || typeof d !== 'object' || d.jaskinia !== 1 || typeof d.type !== 'string') return;
  const e = liveOf(ev.source);
  if (!e) return; // only pages Jaskinia itself opened in a window may talk to it
  const now = Date.now();
  if (d.type === 'hello') {
    const was = e.hello;
    e.hello = { name: lstr(d.name, 60) || t('bez nazwy'), version: lstr(d.version, 40), wants: Array.isArray(d.wants) ? d.wants.filter(x => typeof x === 'string').slice(0, 8) : [] };
    if (!was) { logEv(t('przyrząd {0} rozmawia z Jaskinią', liveName(e)), { przyrzad: e.hello.name }); rememberLive(e.url, liveName(e)); } // the picker learns the lab's own name
    updateHead(e.id);
  } else if (d.type === 'state') {
    e.state = { t: now, text: lstr(d.text, 240), data: smallData(d.data) };
    for (const f of e.waiting.splice(0)) f(e.state);
  } else if (d.type === 'signals') {
    if (!d.values || typeof d.values !== 'object') return;
    for (const [k0, v] of Object.entries(d.values).slice(0, LIVE_SIGS * 2)) {
      const k = lstr(k0, 32);
      if (!k || typeof v !== 'number' || !Number.isFinite(v)) continue;
      let s = e.sigs.get(k);
      if (!s) { if (e.sigs.size >= LIVE_SIGS) continue; s = { t: [], v: [] }; e.sigs.set(k, s); }
      s.t.push(now); s.v.push(v);
      trimSeries(s, now);
    }
  } else if (d.type === 'event') {
    const text = lstr(d.text, 200);
    if (!text) return;
    e.evs.push({ t: now, text, level: ['info', 'uwaga', 'blad'].includes(d.level) ? d.level : 'info' });
    if (e.evs.length > LIVE_EVS) e.evs.splice(0, e.evs.length - LIVE_EVS);
    e.evT = e.evT.filter(x => now - x < 1000);
    if (e.evT.length < 4) { e.evT.push(now); logEv(t('przyrząd {0}: {1}', e.hello ? e.hello.name : hostOf(e.url), text), { przyrzad: e.hello ? e.hello.name : null }); }
    else e.quiet++; // a burst: kept in the instrument's own list, not in the log
  } else if (d.type === 'flag') {
    e.last = now;
    uwagaPop(null, e.id);
  } else return;
  liveChanged(e);
});

/* which instrument is Jozz using: the focused window, else the one he touched last in this layout */
function liveHere() { return [...LIVE.values()].filter(e => L.wins[e.id] && RT.get(e.id)?.space === space?.id); }
/* For a remark (strict): only a lab Jozz is in, or touched in the last two minutes; a note about the cadastre must not get
   pinned to a lab running in a corner. For the Sygnały window: the lab he used last, or the only one there is. */
function activeLive(strict) {
  const here = liveHere();
  if (!here.length) return null;
  const f = here.find(e => e.id === L.focus);
  if (f) return f;
  const best = here.slice().sort((a, b) => b.last - a.last)[0];
  if (best.last && Date.now() - best.last < (strict ? 2 : 15) * 60e3) return best;
  return strict ? null : here.length === 1 ? here[0] : best;
}
function touchLive(id) { const e = LIVE.get(id); if (e) e.last = Date.now(); }
// clicking into a lab moves the keyboard into its page; the parent only sees itself lose focus
addEventListener('blur', () => setTimeout(() => {
  const f = document.activeElement;
  if (!f || f.tagName !== 'IFRAME') return;
  const e = [...LIVE.values()].find(x => x.frame === f);
  if (e) { e.last = Date.now(); if (L.focus !== e.id && L.wins[e.id]) focusWin(e.id); }
}, 0));
/* the moment of the flag: ask the instrument for its state now, but never make Jozz wait for it */
function askState(e, ms = 400) {
  return new Promise(res => {
    if (!e || !e.hello) { res(e ? e.state : null); return; }
    let done = false;
    const fin = s => { if (!done) { done = true; res(s); } };
    e.waiting.push(fin);
    liveTalk(e, { type: 'state?' });
    setTimeout(() => fin(e.state), ms);
  });
}
function liveCtxOf(e) {
  if (!e) return null;
  return { okno: e.id, nazwa: e.hello ? e.hello.name : null, wersja: e.hello ? e.hello.version : null, adres: e.url, rozmawia: !!e.hello,
    stan: e.state ? e.state.text : null, dane: e.state ? e.state.data : null, stan_z: e.state ? isoLocal(e.state.t) : null };
}
function remarkToLive(e, text, at) {
  if (!e) return;
  e.marks.push(at);
  if (e.marks.length > 200) e.marks.splice(0, e.marks.length - 200);
  if (e.hello && e.hello.wants.includes('remark')) liveTalk(e, { type: 'remark', text, at: isoLocal(at) });
  liveChanged(e);
}
/* a lab may rest while its window is hidden (another layout, behind a maximized window, another window on the phone) */
function liveVisibility() {
  for (const e of LIVE.values()) {
    const rt = RT.get(e.id);
    const vis = !!(rt && !rt.el.hidden && !rt.el.classList.contains('off') && !rt.el.classList.contains('behind') && !document.hidden);
    if (vis !== e.vis) { e.vis = vis; liveTalk(e, { type: 'visible', visible: vis }); }
  }
}
document.addEventListener('visibilitychange', liveVisibility);

/* ---------- what the window shows ---------- */
function liveSafeUrl(u) {
  u = String(u || '').trim();
  if (!u) return null;
  if (u === DEMO_URL) return u;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$)/.test(u)) u = 'https://' + u; // "jozzpoly.github.io/x"
  try { const x = new URL(u, location.href); return ['http:', 'https:', 'file:'].includes(x.protocol) ? x.href : null; } catch { return null; }
}
function liveRecent() { try { return arr(JSON.parse(lsGet(KEY_LIVE_RECENT) || '[]')).filter(x => x && liveSafeUrl(x.url)).slice(0, 8); } catch { return []; } }
function rememberLive(url, title, project) {
  const all = liveRecent(), was = all.find(x => x.url === url), l = all.filter(x => x.url !== url);
  l.unshift({ url, title: lstr(title, 60) || (was ? was.title : ''), project: project || (was ? was.project : null), at: Date.now() });
  lsSet(KEY_LIVE_RECENT, JSON.stringify(l.slice(0, 8)));
}
const LIVE_ALLOW = 'fullscreen; xr-spatial-tracking; gamepad; autoplay; clipboard-write; accelerometer; gyroscope; magnetometer; screen-wake-lock';
function liveFrame(url, title) {
  if (url === DEMO_URL) return h('iframe', { srcdoc: typeof LAB_DEMO === 'string' ? LAB_DEMO : '', title: title || hostOf(url), allow: LIVE_ALLOW });
  return h('iframe', { src: url, title: title || url, allowfullscreen: '', referrerpolicy: 'no-referrer', allow: LIVE_ALLOW });
}

/* the strip under a running page: who it is, what it says is happening, and the way out to a tab */
function liveBar(c, e, extUrl) {
  const dot = h('span', { class: 'lv-dot', 'aria-hidden': 'true' }), who = h('b', { class: 'lv-who' }), what = h('span', { class: 'lv-what' });
  const bar = h('div', { class: 'jk-game-bar lv-bar' }, dot, who, what,
    h('button', { class: 'jk-tb lv-sig', type: 'button', title: t('Sygnały tego przyrządu w oknie obok'), onclick: () => signalsBeside(c.id) }, icon('t_sygnaly', 13), h('span', { text: t('Sygnały') })),
    h('button', { class: 'jk-tb lv-flag', type: 'button', title: t('To mnie uwiera: uwaga przypięta do tego przyrządu i tej chwili (w labie: Ctrl+.)'), onclick: ev => { touchLive(c.id); uwagaPop(ev.currentTarget, c.id); } }, icon('flag', 13)),
    e.url === DEMO_URL ? null : h('a', { class: 'jk-game-ext', href: extUrl || e.url, target: '_blank', rel: 'noopener', title: t('Gra nie rusza w oknie? Otwórz w nowej karcie') }, icon('ext', 13), t('Nowa karta')));
  const draw = () => {
    const on = !!e.hello;
    bar.classList.toggle('on', on);
    who.textContent = on ? liveName(e) : (e.title || hostOf(e.url));
    who.title = e.url;
    what.textContent = on ? (e.state ? e.state.text : t('rozmawia z Jaskinią')) : t('nie rozmawia z Jaskinią (to nic złego)');
    what.title = on ? t('Tak mówi sam przyrząd') : t('Strona działa, tylko nie zna kontraktu przyrządu: nie mówi Jaskini, co się w niej dzieje.');
  };
  const sub = x => { if (x === e) draw(); };
  liveSubs.add(sub);
  c.onDispose(() => liveSubs.delete(sub));
  draw();
  return bar;
}

function renderLive(box, c) {
  const st = c.win.st;
  if (!st.url) { box.append(livePicker(c)); return; }
  if (!B.HOSTED && st.url !== DEMO_URL) { // the demo is carried inside, so it runs even where other sites cannot be embedded
    box.append(pad(h('p', { class: 'jk-empty', text: t('W claude.ai przyrząd nie może działać w oknie: ta strona nie pozwala osadzać innych stron.') }),
      h('p', null, h('a', { class: 'btn', href: st.url, target: '_blank', rel: 'noopener' }, icon('ext', 14), t('Otwórz w nowej karcie'))),
      h('p', { class: 'jk-sub', text: t('Jaskinia pobrana jako plik albo pod własnym adresem uruchomi go w oknie.') })));
    return;
  }
  const frame = liveFrame(st.url, st.title);
  const e = attachLive(c, frame, st.url, st.title);
  box.append(h('div', { class: 'jk-game jk-live' }, frame, liveBar(c, e)));
}
function livePicker(c) {
  const go = (url0, title, project) => {
    const url = liveSafeUrl(url0);
    if (!url) { jtoast(t('Tego adresu nie uruchomię: tylko http, https albo plik.')); return; }
    rememberLive(url, title, project);
    c.commit(t('przyrząd: {0}', title || hostOf(url)), () => { Object.assign(c.win.st, { url, title: lstr(title, 60), project: project || null }); });
  };
  const urlIn = h('input', { class: 'jk-in', type: 'text', inputmode: 'url', placeholder: 'https://…', 'aria-label': t('Adres strony do uruchomienia'), autocomplete: 'off', spellcheck: 'false' });
  const pages = REPOS.filter(r => r.pages && r.life !== 'zakończone').sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
  const recent = liveRecent();
  return h('div', { class: 'jk-pad lv-pick' },
    h('p', { class: 'ch-lead', text: t('Co uruchomić w tym oknie?') }),
    h('section', null, h('h4', { text: t('Pokaz') }),
      h('div', { class: 'jk-chips' }, h('button', { class: 'jk-chip', type: 'button', title: t('Mały lab z fizyką piłek, który zna kontrakt przyrządu: mówi, co się w nim dzieje, wysyła liczby i zdarzenia, i przyjmuje Twoje uwagi. Działa bez sieci.'), onclick: () => go(DEMO_URL, t('Piłki'), null) }, icon('t_sygnaly', 14), t('Piłki: pokaz kontraktu')))),
    recent.length ? h('section', null, h('h4', { text: t('Ostatnio') }),
      h('div', { class: 'jk-chips' }, recent.map(x => h('button', { class: 'jk-chip', type: 'button', title: x.url, onclick: () => go(x.url, x.title, x.project) }, icon('t_przyrzad', 14), x.title || hostOf(x.url))))) : null,
    h('section', null, h('h4', { text: t('Strony projektów') }),
      h('div', { class: 'jk-chips' }, pages.map(r => h('button', { class: 'jk-chip', type: 'button', title: r.pages, onclick: () => go(r.pages, r.short, r.name) }, sigil(r, 18), r.short)))),
    h('section', null, h('h4', { text: t('Inny adres') }),
      h('form', { class: 'lv-url', onsubmit: ev => { ev.preventDefault(); go(urlIn.value); } }, urlIn, h('button', { class: 'btn', type: 'submit' }, t('Uruchom')))),
    h('p', { class: 'jk-sub', text: t('Lab, który zna kontrakt przyrządu, powie Jaskini, kim jest, co się w nim dzieje i jakie ma liczby. Każda inna strona też zadziała, tylko po cichu. Jaskinia sama jej nie zrestartuje.') }));
}
function liveHeadCtx(c) {
  const st = c.win.st;
  if (!st.url) return [];
  const e = LIVE.get(c.id);
  return [h('button', { class: 'jk-tb lv-head', type: 'button', title: st.url, onclick: ev => openMenu(ev.currentTarget, [
    { head: e ? liveName(e) : (st.title || hostOf(st.url)) },
    { label: t('Uruchom tu coś innego…'), icon: 'swap', act: () => c.commit(t('przyrząd: zmiana'), () => { c.win.st = {}; }) },
    { label: t('Uruchom od nowa'), desc: t('przeładuj stronę; jej własny zapis zostaje'), icon: 'reset', act: () => { const ee = LIVE.get(c.id); if (ee) { ee.frame.src = ee.url; logEv(t('przyrząd uruchomiony od nowa: {0}', liveName(ee))); } } },
    { label: t('Sygnały obok'), icon: 't_sygnaly', act: () => signalsBeside(c.id) },
    st.url === DEMO_URL ? null : { label: t('Otwórz w nowej karcie'), icon: 'ext', act: () => { window.open(st.url, '_blank', 'noopener'); } },
  ]) }, icon('t_przyrzad', 13), h('span', { text: e && e.hello ? liveName(e) : (st.title || hostOf(st.url)) }), icon('chev', 12))];
}

/* ---------- Sygnały: the instrument's numbers, live ---------- */
function signalsBeside(id) {
  if (!L.wins[id]) return;
  const existing = allIds().find(k => L.wins[k].type === 'sygnaly' && L.wins[k].st.src === id);
  if (existing) { focusWin(existing); return; }
  const nid = newWinId(), side = phone ? 'bottom' : 'right';
  const ok = isFloat(id)
    ? commit(t('sygnały przyrządu'), () => { const f = L.floats.find(x => x.id === id); L.wins[nid] = { type: 'sygnaly', z: 1, pin: null, st: { src: id } }; L.floats.push({ id: nid, x: clamp(f.x + f.w * 0.55, 0, 0.9), y: f.y, w: Math.max(0.24, f.w * 0.45), h: f.h }); })
    : commit(t('sygnały przyrządu'), () => { if (!splitWin(L, id, side, nid, 'sygnaly')) return false; L.wins[nid].st = { src: id }; });
  if (ok) { focusWin(nid); if (phone) apply(); }
}
function signalsSource(st) { return st.src ? LIVE.get(st.src) || null : activeLive(); }
const SIG_SPANS = [[10, '10 s'], [60, '1 min'], [300, '5 min']];
function signalsCtx(c) {
  const st = c.win.st, e = signalsSource(st), span = SIG_SPANS.some(s => s[0] === st.span) ? st.span : 60;
  const pick = h('button', { class: 'jk-tb', type: 'button', title: t('Z którego przyrządu czytać'), onclick: ev => openMenu(ev.currentTarget, [
    { head: t('Sygnały z przyrządu') },
    { label: t('Tego, którego właśnie używam'), checked: !st.src, act: () => c.commit(t('sygnały: z używanego przyrządu'), () => { c.win.st.src = null; }) },
    ...liveHere().map(x => ({ label: liveName(x), checked: st.src === x.id, act: () => c.commit(t('sygnały z przyrządu'), () => { c.win.st.src = x.id; }) })),
  ]) }, icon('t_przyrzad', 13), h('span', { text: e ? liveName(e) : t('brak przyrządu') }), icon('chev', 12));
  const seg = h('div', { class: 'jk-seg sg-span', role: 'group', 'aria-label': t('Ile czasu pokazać') }, SIG_SPANS.map(([v, lab]) =>
    h('button', { type: 'button', class: v === span ? 'on' : '', 'aria-pressed': String(v === span), onclick: () => c.commit(t('sygnały: {0}', lab), () => { c.win.st.span = v; }) }, lab)));
  return [pick, seg];
}
function renderSignals(box, c) {
  const st = c.win.st, span = (SIG_SPANS.some(s => s[0] === st.span) ? st.span : 60) * 1000;
  const head = h('div', { class: 'sg-head' }), rows = h('div', { class: 'sg-rows' }), evs = h('ol', { class: 'sg-evs' });
  const wrap = h('div', { class: 'sg' }, head, rows, evs);
  box.append(wrap);
  const rowEls = new Map();
  let shownFor = null, raf = 0, alive = true, lastHead = '', lastEvs = '';
  const ask = () => { if (!raf && alive) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  const sub = () => ask();
  liveSubs.add(sub);
  const tick = setInterval(ask, 200); // the time axis moves even when the lab is silent
  c.onDispose(() => { alive = false; liveSubs.delete(sub); clearInterval(tick); if (raf) cancelAnimationFrame(raf); });
  const cs = getComputedStyle(box);
  const col = n => cs.getPropertyValue(n).trim() || '#888';
  const COLS = ['--hand', '--link', '--ok', '--warn', '--bad', '--ink-2'];
  function paint() {
    if (!alive || !wrap.isConnected || !box.clientWidth) return;
    const e = signalsSource(st);
    if (e !== shownFor) { shownFor = e; rowEls.clear(); rows.replaceChildren(); lastHead = ''; lastEvs = ''; }
    if (!e) {
      const k = 'none';
      if (lastHead !== k) { lastHead = k; fill(head, h('p', { class: 'jk-empty', text: st.src ? t('Przyrządu, z którego czytało to okno, już tu nie ma.') : t('Tu pojawią się liczby z działającego przyrządu.') }),
        h('p', { class: 'jk-sub', text: t('Uruchom lab w oknie „Przyrząd” albo „Gra”. Jeśli zna kontrakt przyrządu, jego sygnały będą się tu rysować na żywo.') })); evs.replaceChildren(); }
      return;
    }
    const hk = liveName(e) + '|' + (e.state ? e.state.text : '') + '|' + e.sigs.size;
    if (hk !== lastHead) {
      lastHead = hk;
      fill(head, h('p', { class: 'sg-who' }, h('b', { text: liveName(e) }), e.state ? h('span', { text: ' · ' + e.state.text }) : null),
        !e.hello ? h('p', { class: 'jk-sub', text: t('Ta strona nie rozmawia z Jaskinią, więc nie wysyła liczb.') })
          : !e.sigs.size ? h('p', { class: 'jk-sub', text: t('Przyrząd rozmawia z Jaskinią, ale jeszcze nie wysłał żadnych liczb.') }) : null);
    }
    // until the lab has run for the whole span, the axis starts where its numbers start, so the plot is never mostly empty
    const now = Date.now(), first = Math.min(...[...e.sigs.values()].map(x => x.t.length ? x.t[0] : now)), t0 = Math.max(now - span, Math.min(first, now - 2000));
    let i = 0;
    for (const [name, s] of e.sigs) {
      let r = rowEls.get(name);
      if (!r) {
        const cv = h('canvas', { class: 'sg-cv', role: 'img', 'aria-label': name });
        r = { el: h('div', { class: 'sg-row' }, h('span', { class: 'sg-name', text: name }), h('b', { class: 'sg-val' }), h('span', { class: 'sg-rng' }), cv), cv, color: COLS[rowEls.size % COLS.length] };
        rowEls.set(name, r); rows.append(r.el);
      }
      const last = s.v[s.v.length - 1];
      r.el.querySelector('.sg-val').textContent = fmtNum(last);
      plotSeries(r, s, t0, now, e, col);
      i++;
    }
    const ek = e.evs.length + ':' + (e.evs.length ? e.evs[e.evs.length - 1].t : 0) + ':' + e.marks.length;
    if (ek !== lastEvs) {
      lastEvs = ek;
      const items = [...e.evs.slice(-6).map(x => ({ t: x.t, text: x.text, cls: 'ev-' + x.level })), ...e.marks.slice(-3).map(m => ({ t: m, text: t('Twoja uwaga'), cls: 'ev-uwaga-jozz' }))]
        .sort((a, b) => b.t - a.t).slice(0, 6);
      fill(evs, items.map(x => h('li', { class: x.cls }, h('time', { text: hms(x.t) }), h('span', { text: x.text }))));
    }
    void i;
  }
  function plotSeries(r, s, t0, t1, e, colOf) {
    const cv = r.cv, dpr = devicePixelRatio || 1, w = cv.clientWidth, hh = cv.clientHeight;
    if (!w || !hh) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    let i0 = 0;
    while (i0 < s.t.length && s.t[i0] < t0) i0++;
    i0 = Math.max(0, i0 - 1);
    let lo = Infinity, hi = -Infinity;
    for (let i = i0; i < s.v.length; i++) { if (s.v[i] < lo) lo = s.v[i]; if (s.v[i] > hi) hi = s.v[i]; }
    const X = tt => (tt - t0) / (t1 - t0) * w;
    g.lineWidth = 1;
    g.strokeStyle = colOf('--rule');
    for (const ev of e.evs) if (ev.t >= t0) { const x = Math.round(X(ev.t)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hh); g.stroke(); }
    g.strokeStyle = colOf('--hand');
    g.setLineDash([3, 3]);
    for (const m of e.marks) if (m >= t0) { const x = Math.round(X(m)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hh); g.stroke(); }
    g.setLineDash([]);
    r.el.querySelector('.sg-rng').textContent = Number.isFinite(lo) ? fmtNum(lo) + ' … ' + fmtNum(hi) : '';
    if (!Number.isFinite(lo)) return;
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const Y = v => hh - 3 - (v - lo) / (hi - lo) * (hh - 6);
    g.strokeStyle = colOf(r.color);
    g.lineWidth = 1.6;
    g.beginPath();
    for (let i = i0; i < s.v.length; i++) { const x = X(s.t[i]), y = Y(s.v[i]); if (i === i0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
}
function fmtNum(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const s = a >= 1e5 ? v.toExponential(2) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : a === 0 ? '0' : v.toPrecision(2);
  return prefs.lang === 'en' ? s : s.replace('.', ',');
}

/* ---------- the types ---------- */
GROUPS.splice(GROUPS.findIndex(g => g[0] === 'misc'), 0, ['live', 'Na żywo']);
Object.assign(TYPES, {
  przyrzad: { key: 'przyrzad', group: 'live', live: true, fill: true, noZoom: true, name: 'Przyrząd', glyph: 't_przyrzad', liveKey: st => [st.url || ''],
    desc: 'Twój lab, gra albo narzędzie pod dowolnym adresem. Jaskinia go sama nie restartuje.', render: renderLive, ctx: liveHeadCtx },
  sygnaly: { key: 'sygnaly', group: 'live', name: 'Sygnały', glyph: 't_sygnaly', desc: 'Liczby z działającego przyrządu, na żywo, z jego zdarzeniami i Twoimi uwagami.',
    render: renderSignals, ctx: signalsCtx },
});
