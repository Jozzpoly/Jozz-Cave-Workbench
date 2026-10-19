/* ---------- addresses (v6.1): everything Jozz or an agent points at has a link ----------
   v6 handled only #repo~ clicks inside windows, silently swallowed every other #link ("Pełna historia" did nothing) and
   ignored the address the page was opened with, so neither Jozz nor an agent could open Jaskinia on a given thing.
     #repo~Name   a project: selected, with a card on screen that follows the selection
     #m~id        a material: the Materiały window shows it
     #uklad~id    a layout (a tab), by its id or its name
     #agenci, #notatki, #materialy, #historia, #wiedza, #mapa (#panorama), #sciana, #statystyki: that window
   The address follows the selected project through replaceState, which never adds a history step. While the phone's
   Back guard stands (50-shell.js: one history entry under the sheets), the address is left as it is: the entry under the
   guard keeps the same address, so stepping Back off the guard changes nothing and only closes the sheet. */
const ROUTE_WIN = { agenci: 'agenci', notatki: 'notatki', materialy: 'materialy', historia: 'historia', wiedza: 'wiedza', mapa: 'mapa', panorama: 'mapa', sciana: 'sciana', statystyki: 'statystyki', kataster: 'kataster', spis: 'spis', zagraj: 'zagraj' };
function readHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  try { return decodeURIComponent(raw); } catch { return raw; }
}
/* returns true when the address named something Jaskinia has. inner: a link clicked inside a window (it only selects,
   as before); otherwise the address came from outside (opened, typed, an agent) and the thing is put on screen */
function route(hash, inner) {
  const h0 = readHash(hash);
  if (!h0 || !store) return false;
  const i = h0.indexOf('~'), k = (i < 0 ? h0 : h0.slice(0, i)).toLowerCase(), v = i < 0 ? '' : h0.slice(i + 1);
  if (k === 'repo') {
    const n = R[v] ? v : Object.keys(R).find(x => x.toLowerCase() === v.toLowerCase());
    if (!n) { jtoast(t('Nie znam projektu „{0}”.', v)); return false; }
    select(n, 'win');
    if (!inner && !phone && !allIds().some(id => typeOf(L.wins[id]).follows && !L.wins[id].pin)) openWinOfType('karta', { free: true, w: 0.5, h: 0.8 });
    if (!inner) logEv(t('adres: {0}', '#' + h0));
    return true;
  }
  if (k === 'm' && v) { showMaterial(v); logEv(t('adres: {0}', '#' + h0)); return true; }
  if (k === 'uklad' && v) {
    const sp = store.spaces.find(s => s.id === v) || store.spaces.find(s => s.name.toLowerCase() === v.toLowerCase());
    if (!sp) { jtoast(t('Nie ma układu „{0}”.', v)); return false; }
    setSpace(sp.id);
    return true;
  }
  const type = ROUTE_WIN[k];
  if (type && TYPES[type]) { openWinOfType(type, { free: true, w: 0.62, h: 0.82 }); logEv(t('adres: {0}', '#' + h0)); return true; }
  return false;
}
function showMaterial(id) {
  const ex = allIds().find(w => L.wins[w].type === 'materialy');
  const wid = openWinOfType('materialy', ex ? {} : { st: { sel: id }, w: 0.7, h: 0.82 });
  if (ex) document.dispatchEvent(new CustomEvent('jk:materialy', { detail: { show: id, target: wid } }));
}
/* the address bar names what is selected (a copied link opens Jaskinia on it) */
function setAddress(hash) {
  if (location.hash === hash || backGuard.on) return;
  try { history.replaceState(history.state, '', hash); } catch { /* a host that forbids it keeps its own address */ }
}
addEventListener('hashchange', () => { route(location.hash); });
/* called at the end of boot(): the address the page was opened with */
function routeStart() {
  const h0 = location.hash;
  if (h0 && h0.length > 1) setTimeout(() => route(h0), 0);
}

/* ---------- "Dla agentów": the same Jaskinia as plain text ----------
   For GPT reading Jozz's Jaskinia through Opera, for Codex and for Claude. Everything is visible without opening anything:
   what is on screen, Jozz's notes (newest first: this is where he leaves words for agents), the materials and their
   addresses, then the Library's brief. It only reads; agents act through their own tools and ask Jozz to decide. */
function renderAgents(box, c) {
  const sp = store.spaces.find(s => s.id === store.cur), sel = R[store.sel];
  const notes = Object.entries(store.notes).filter(([, n]) => n && n.text && n.text.trim()).map(([id, n]) => ({ id, text: n.text, upd: n.upd || 0 })).sort((a, b) => b.upd - a.upd);
  const used = notesReferenced();
  const wrap = h('div', { class: 'wrap sec agents-jk' });
  const sec = (title, ...kids) => h('section', { class: 'agent-text' }, h('h2', { text: title }), ...kids);
  const winList = allIds().map(id => { const w = L.wins[id]; return `${winTitle(id)}${w.pin ? ' (' + t('przypięte: {0}', R[w.pin]?.short || w.pin) + ')' : ''}`; });
  wrap.append(
    sec(t('Dla agentów'),
      h('p', { text: t('Ta sama Jaskinia jako zwykły tekst: dla GPT czytającego przez Operę, dla Codexa i dla Claude. Zasady pracy są w kompasie Jaskini (issue #5 w repo Jozz-Cave-Workbench). Ta strona tylko czyta; decyzje podejmuje Jozz.') }),
      h('ul', null,
        h('li', { text: t('Jaskinia {0}, zbudowana {1}, miejsce: {2}.', VER, BUILD.built || '?', t(PLACE_NAME[PLACE])) }),
        h('li', { text: t('Układ na ekranie: {0} ({1}). Okna: {2}.', sp ? spaceName(sp) : '?', '#uklad~' + store.cur, winList.join(', ') || '—') }),
        h('li', { text: sel ? t('Zaznaczony projekt: {0} ({1}).', sel.name, '#repo~' + sel.name) : t('Nic nie jest zaznaczone.') }),
        h('li', { text: t('Układy: {0}.', store.spaces.map(s => `${spaceName(s)} (#uklad~${s.id})`).join(', ')) }))),
    sec(t('Uwagi Jozza o Jaskini („To mnie uwiera”)'),
      uwagi.length ? h('p', { class: 'muted', text: t('{0}, najnowsze pierwsze. Każda jest przypięta do chwili, układu, okna i projektu. To jego bezpośredni feedback z używania: czytaj je przed pracą nad Jaskinią.', tn(uwagi.length, 'uwaga', 'uwagi', 'uwag')) }) : h('p', { text: t('Jozz nie ma jeszcze uwag.') }),
      ...uwagi.slice().reverse().map(u => h('article', { class: 'agent-note' },
        h('h3', { text: noteTitle(u.text) || t('Uwaga') }),
        h('p', { class: 'muted', text: [isoLocal(u.t).slice(0, 19), u.v, u.u && t('układ „{0}”', u.u), u.okno && t('okno „{0}”', u.okno), u.projekt && t('projekt {0}', u.projekt), u.przyrzad && (u.przyrzad.nazwa || u.przyrzad.adres), u.edited && t('poprawiona {0}', isoLocal(u.edited).slice(0, 16))].filter(Boolean).join(' · ') }),
        h('pre', { class: 'agent-note-text', text: u.text }),
        uwAnswer(u) ? h('p', { class: 'agent-ans', text: t('Odpowiedź ({0}, {1}): {2}', 'v' + uwAnswer(u).v, t(UW_STAN[uwAnswer(u).stan] || uwAnswer(u).stan), uwAnswer(u).odp) }) : h('p', { class: 'agent-ans open', text: t('Bez odpowiedzi: otwarta.') })))),
    sec(t('Notatki Jozza'),
      notes.length ? h('p', { class: 'muted', text: t('{0}, najnowsze pierwsze. Notatki bez okna też tu są.', tn(notes.length, 'notatka', 'notatki', 'notatek')) }) : h('p', { text: t('Jozz nie ma jeszcze notatek.') }),
      ...notes.map(n => h('article', { class: 'agent-note' },
        h('h3', { text: noteTitle(n.text) || t('Notatka') }),
        h('p', { class: 'muted', text: [n.upd ? dshort(new Date(n.upd)) : '', used.has(n.id) ? '' : t('bez okna')].filter(Boolean).join(' · ') }),
        h('pre', { class: 'agent-note-text', text: n.text })))),
    sec(t('Adresy'),
      h('ul', null,
        h('li', { text: t('#repo~Nazwa: projekt z kartą na ekranie') }),
        h('li', { text: t('#m~id: materiał w oknie Materiały') }),
        h('li', { text: t('#uklad~id: układ (karta u góry)') }),
        h('li', { text: t('#agenci, #notatki, #materialy, #historia, #wiedza, #mapa, #sciana, #statystyki: to okno') }))));
  const mats = sec(t('Materiały'), h('p', { class: 'muted', text: t('Czytam bibliotekę…') }));
  wrap.append(mats);
  box.append(wrap);
  let alive = true;
  c.onDispose(() => { alive = false; });
  matList().then(list => {
    if (!alive) return;
    mats.replaceChildren(h('h2', { text: t('Materiały') }), list.length
      ? h('ul', null, list.map(m => h('li', { text: `${m.name}${(m.ver || 1) > 1 ? ' v' + m.ver : ''} (#m~${m.id}): ${m.main?.name || ''}${m.deps?.length ? ', ' + tn(m.deps.length, 'plik towarzyszący', 'pliki towarzyszące', 'plików towarzyszących') : ''}` })))
      : h('p', { text: t('Biblioteka materiałów jest pusta.') }));
  }).catch(err => { if (alive) mats.replaceChildren(h('h2', { text: t('Materiały') }), h('p', { text: t('Biblioteka materiałów nie działa w tej przeglądarce: {0}', err.message) })); });
  if (B.agentsView) box.append(B.agentsView());
}
ICONS.t_agenci = 'M3 3.5h10v7H7.5L4.5 13v-2.5H3z M5.5 6.5h5 M5.5 8.5h3';
Object.assign(TYPES, {
  agenci: { key: 'agenci', group: 'misc', name: 'Dla agentów', glyph: 't_agenci', desc: 'Jaskinia jako zwykły tekst dla agentów: co jest na ekranie, Twoje notatki, materiały i adresy.', render: renderAgents },
});
