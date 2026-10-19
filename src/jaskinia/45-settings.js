/* ---------- the look (themes) and the settings window ----------
   Like Blender's Preferences, the settings are a window type: open them anywhere, dock them, maximize them.
   Themes change tokens only (colours, type, shapes); the life colours are a separate choice. */
const THEMES = {
  jaskinia: { name: 'Jaskinia', desc: 'Granatowa noc biblioteki; zieleń znaczy życie. Ciemna albo jasna.', schemes: true },
  kataster: { name: 'Kataster', desc: 'Papier mapy geodety: atrament, ołówek, kreska.', fonts: null },
  neon: { name: 'Neon', desc: 'Czerń, cyjan i świecące linie.', fonts: 'family=Oxanium:wght@400..800&family=JetBrains+Mono:wght@400..700' },
  piwnica: { name: 'Piwnica', desc: 'Warsztat: drewno, blacha, taśma z etykieciarki, zielone diody.', fonts: 'family=Barlow+Condensed:wght@500;600;700;800&family=VT323' },
};
const LIFE_RAMPS = { zielen: { name: 'Zieleń', desc: 'Im żywszy projekt, tym bardziej zielony; stare uspokajają się do błękitu i tła.' }, zar: { name: 'Żar', desc: 'Jak dawna Biblioteka: świeże świeci pomarańczem.' } };
const DENSITY = { auto: 'Sam', zwarta: 'Zwarty', srednia: 'Średni', duza: 'Duży' };
function applyLook() {
  const de = document.documentElement, th = THEMES[prefs.theme] ? prefs.theme : 'jaskinia';
  de.dataset.jk = th;
  if (THEMES[th].schemes && prefs.scheme !== 'auto') de.dataset.theme = prefs.scheme === 'jasna' ? 'light' : 'dark';
  else if (th === 'kataster') de.dataset.theme = 'light';
  else if (th !== 'jaskinia') de.dataset.theme = 'dark';
  else delete de.dataset.theme;
  de.dataset.life = prefs.life;
  de.dataset.density = prefs.density === 'auto' ? (matchMedia('(pointer: coarse)').matches ? 'srednia' : 'zwarta') : prefs.density;
  de.dataset.motion = prefs.motion;
  de.lang = prefs.lang === 'en' ? 'en' : 'pl';
  B.HOOK.noTips = !prefs.tips;
  const f = THEMES[th].fonts;
  if (f && !document.querySelector(`link[data-jkfont="${th}"]`)) document.head.append(h('link', { rel: 'stylesheet', 'data-jkfont': th, href: `https://fonts.googleapis.com/css2?${f}&display=swap` }));
  requestAnimationFrame(() => B.redrawSigils());
}
/* a preference changed: apply it, keep it, redraw what depends on it */
function setPref(k, v) {
  if (prefs[k] === v) return;
  logEv(t('ustawienie: {0} = {1}', k, v));
  prefs[k] = v;
  const p = sanitizePrefs(prefs);
  Object.assign(prefs, p, { recent: prefs.recent });
  savePrefs();
  applyLook();
  if (k === 'lang') { relaunch(); return; }
  if (k === 'cz') { for (const [id, rt] of RT) { const w = L.wins[id]; if (w) rt.zoomer.style.zoom = zEff(w); } B.HOOK.refresh(); }
  if (k === 'density') { apply(); B.HOOK.refresh(); }
  if (k === 'theme' || k === 'scheme' || k === 'life') setTimeout(() => B.HOOK.refresh(), 30);
  if (k === 'games') B.HOOK.refresh();
  if (k === 'pixels') document.dispatchEvent(new CustomEvent('jk:pixels'));
}
/* rebuild the whole interface (after a language change): the store and the layouts stay as they are */
function relaunch() {
  closeMenus(); hideSheet();
  for (const id of [...RT.keys()]) dropWin(id);
  root.remove(); toastBox.remove(); selStyle.remove();
  buildChrome();
  updateSelStyle(); renderSelBox(); renderTabs(); updateUndoUI(); renderStatus();
  new ResizeObserver(() => apply()).observe(stage);
  apply();
  for (const id of allIds()) refreshWin(id);
}

const SETTINGS_SECS = [
  ['wyglad', 'Wygląd', 'palette'], ['zachowanie', 'Zachowanie', 'hand'], ['jezyk', 'Język', 'globe'],
  ['uklady', 'Układy i zapisy', 'layers'], ['kopie', 'Kopie automatyczne', 'archive'], ['kosz', 'Kosz', 'trash'],
  ['dane', 'Eksport i import', 'download'], ['skroty', 'Skróty i gesty', 'keyboard'], ['o', 'O Jaskini', 'info'],
];
function renderSettings(box, c) {
  const st = c.win.st;
  if (!SETTINGS_SECS.some(x => x[0] === st.sec)) st.sec = 'wyglad';
  const nav = h('nav', { class: 'set-nav', 'aria-label': t('Działy ustawień') });
  const pane = h('div', { class: 'set-pane' });
  const draw = () => {
    fill(nav, SETTINGS_SECS.map(([k, label, ic]) => h('button', { class: 'set-n' + (st.sec === k ? ' on' : ''), type: 'button', 'aria-current': st.sec === k ? 'page' : null,
      onclick: () => { st.sec = k; c.save(); draw(); pane.scrollTop = 0; box.closest('.wbody')?.scrollTo?.(0, 0); } }, icon(ic, 15), h('span', { text: t(label) }),
      k === 'kosz' ? countBadge(store.trash.filter(x => x.kind !== 'broken').length + orphanNotes().length) : null)));
    const sec = SET_SECTIONS[st.sec];
    fill(pane, h('h2', { class: 'set-h', text: t(SETTINGS_SECS.find(x => x[0] === st.sec)[1]) }), sec(c, draw));
  };
  draw();
  box.append(h('div', { class: 'set' }, nav, pane));
  const onStore = () => { if (pane.isConnected && !pane.contains(document.activeElement)) draw(); };
  document.addEventListener('jk:store', onStore);
  c.onDispose(() => document.removeEventListener('jk:store', onStore));
}
const storeChanged = () => document.dispatchEvent(new CustomEvent('jk:store'));
function countBadge(n) { return n ? h('b', { class: 'set-count', text: n }) : null; }
function setSeg(name, cur, opts, onPick) {
  return h('div', { class: 'set-seg', role: 'radiogroup', 'aria-label': name }, opts.map(([v, label]) =>
    h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur === v), class: cur === v ? 'on' : '', onclick: () => onPick(v) }, t(label))));
}
function setRow(label, desc, ctl) { return h('div', { class: 'set-row' }, h('div', { class: 'set-l' }, h('b', { text: label }), desc ? h('small', { text: desc }) : null), h('div', { class: 'set-c' }, ctl)); }
function setCard(title, ...kids) { return h('section', { class: 'set-card' }, title ? h('h3', { text: title }) : null, ...kids); }
const when2 = ms => dshort(new Date(ms));

/* a tiny window drawn in a theme's own tokens */
function themePreview(th) {
  const p = h('div', { class: 'th-prev', 'data-jk': th, 'data-life': prefs.life, 'aria-hidden': 'true' },
    h('div', { class: 'tp-bar' }, h('i', { class: 'tp-mark' }), h('b', { text: 'Jaskinia' }), h('span', { class: 'tp-tab on', text: t('Przegląd') }), h('span', { class: 'tp-tab', text: t('Granie') })),
    h('div', { class: 'tp-win' }, h('div', { class: 'tp-head' }, h('span', { text: t('Mapa działek') })),
      h('div', { class: 'tp-map' }, ['--h5', '--h4', '--h3', '--h2', '--h1', '--h0', '--h0', '--h2'].map((v, i) => h('i', { class: 'tp-p p' + i, style: { background: `var(${v})` } })))));
  return p;
}
const SET_SECTIONS = {
  wyglad(c, draw) {
    const th = prefs.theme;
    return h('div', { class: 'set-body' },
      setCard(t('Motyw'),
        h('div', { class: 'th-grid' }, Object.entries(THEMES).map(([k, T]) => h('button', { class: 'th-card' + (th === k ? ' on' : ''), type: 'button', 'aria-pressed': String(th === k),
          onclick: () => { setPref('theme', k); draw(); } }, themePreview(k), h('b', { text: t(T.name) }), h('small', { text: t(T.desc) })))),
        THEMES[th].schemes ? setRow(t('Jasność'), t('„Jak system” idzie za ustawieniem telefonu albo komputera.'),
          setSeg(t('Jasność'), prefs.scheme, [['auto', 'Jak system'], ['ciemna', 'Ciemna'], ['jasna', 'Jasna']], v => { setPref('scheme', v); draw(); }))
          : h('p', { class: 'set-note', text: t('Ten motyw ma jedną jasność: tak został pomyślany.') })),
      setCard(t('Kolory życia'),
        h('p', { class: 'set-note', text: t('Kolor działki, karty i słupka mówi, jak dawno był ostatni commit w chwili zrzutu. Czerwień jest zarezerwowana dla tego, co wymaga uwagi.') }),
        h('div', { class: 'ramp-grid' }, Object.entries(LIFE_RAMPS).map(([k, X]) => h('button', { class: 'ramp' + (prefs.life === k ? ' on' : ''), type: 'button', 'aria-pressed': String(prefs.life === k), onclick: () => { setPref('life', k); draw(); } },
          h('span', { class: 'ramp-s', 'data-life': k }, ['--h5', '--h4', '--h3', '--h2', '--h1', '--h0'].map(v => h('i', { style: { background: `var(${v})` } }))),
          h('b', { text: t(X.name) }), h('small', { text: t(X.desc) }))))),
      setCard(t('Rozmiar'),
        setRow(t('Rozmiar interfejsu'), t('Paski, przyciski i zakładki. „Sam”: zwarty przy myszy, jak w Blenderze, żeby miejsce należało do treści; na dotyku większy.'), setSeg(t('Rozmiar interfejsu'), prefs.density, Object.entries(DENSITY), v => { setPref('density', v); draw(); })),
        setRow(t('Powiększenie treści okien'), t('Ile znaczy „100%” w oknie. Każde okno możesz dalej przybliżać po swojemu (Ctrl+kółko).'), zoomSlider(draw))),
      setCard(t('Modele 3D'),
        setRow(t('Piksele tekstur'), t('„Ostre”: każdy piksel tekstury widać tak, jak w Blockbench; tak są pomyślane modele pixel-art. „Gładkie”: tekstury się wygładzają, lepiej dla zdjęć i dużych tekstur.'),
          setSeg(t('Piksele tekstur'), prefs.pixels, [['ostre', 'Ostre'], ['gladkie', 'Gładkie']], v => { setPref('pixels', v); draw(); }))));
  },
  zachowanie(c, draw) {
    return h('div', { class: 'set-body' },
      setCard(t('Ściana'), setRow(t('Kółko myszy na ścianie'), t('Przybliża jak w Blenderze i na mapach, albo przesuwa widok jak na touchpadzie. Ctrl+kółko zawsze przybliża.'),
        setSeg(t('Kółko myszy'), prefs.wheel, [['zoom', 'Przybliża'], ['pan', 'Przesuwa']], v => { setPref('wheel', v); draw(); }))),
      setCard(t('Gry'), B.HOSTED
        ? setRow(t('Gdzie otwierać gry'), t('„Samo”: na komputerze w oknie obok mapy, na telefonie w nowej karcie, gdzie gra ma cały ekran.'),
          setSeg(t('Gry'), prefs.games, [['auto', 'Samo'], ['okno', 'W oknie'], ['karta', 'W nowej karcie']], v => { setPref('games', v); draw(); }))
        : h('p', { class: 'set-note', text: t('W claude.ai gry zawsze otwierają się w nowej karcie: ta strona nie może pokazać innej strony w oknie. W Jaskini pobranej jako plik albo na własnym serwerze możesz grać w oknie.') })),
      setCard(t('Podpowiedzi i ruch'),
        setRow(t('Dymki z podpowiedziami'), t('Dymki nad mapą, wykresem i lasem gałęzi. Na dotyku nie pokazują się nigdy.'), setSeg(t('Dymki'), prefs.tips ? 'on' : 'off', [['on', 'Pokazuj'], ['off', 'Ukryj']], v => { setPref('tips', v === 'on'); draw(); })),
        setRow(t('Animacje'), t('Płynne przejścia kart i stref upuszczania.'), setSeg(t('Animacje'), prefs.motion, [['full', 'Pełne'], ['less', 'Oszczędne']], v => { setPref('motion', v); draw(); }))));
  },
  jezyk(c, draw) {
    return h('div', { class: 'set-body' },
      setCard(t('Język interfejsu'),
        setSeg(t('Język'), prefs.lang, [['pl', 'Polski'], ['en', 'English']], v => setPref('lang', v)),
        h('p', { class: 'set-note', text: t('Po angielsku jest na razie sama Jaskinia: paski, menu, okna, ustawienia, statystyki i ściana. Wnętrza paneli z Biblioteki (karta projektu, kataster, ustalenia, wiedza) są jeszcze po polsku, tak jak dane z repozytoriów.') })));
  },
  uklady(c, draw) {
    const spaces = store.spaces, saved = store.saved;
    return h('div', { class: 'set-body' },
      setCard(t('Twoje układy'),
        h('div', { class: 'set-acts' },
          h('button', { class: 'btn', type: 'button', onclick: () => { saveCurrent(); storeChanged(); } }, icon('save', 14), t('Zapisz obecny układ')),
          h('button', { class: 'btn ghost', type: 'button', onclick: e => promptPop(e.currentTarget, t('Nazwa zapisu całej Jaskini'), t('Cała Jaskinia {0}', when2(Date.now())), v => { saveAllState(v || t('Cała Jaskinia')); storeChanged(); jtoast(t('Zapisana cała Jaskinia.')); }) }, icon('archive', 14), t('Zapisz całą Jaskinię'))),
        h('ul', { class: 'set-list' }, spaces.map((sp, i) => h('li', { class: sp.id === store.cur ? 'cur' : null },
          h('div', { class: 'sl-main' }, h('b', { text: spaceName(sp) }), h('small', { text: (sp.purpose ? sp.purpose + ' · ' : '') + tn(leafIds(sp.L.tree).length + sp.L.floats.length, 'okno', 'okna', 'okien') })),
          h('div', { class: 'sl-acts' },
            sp.id !== store.cur ? h('button', { class: 'jk-tb', type: 'button', onclick: () => setSpace(sp.id) }, t('Pokaż')) : h('span', { class: 'set-cur', text: t('na ekranie') }),
            ibtn('info', t('Po co ten układ'), e => purposeSpace(sp.id, e.currentTarget)),
            ibtn('save', t('Zapisz'), () => { saveSpaceState(sp); storeChanged(); jtoast(t('Zapisany układ „{0}”.', spaceName(sp))); }),
            ibtn('arrowL', t('Przesuń wyżej'), () => { moveSpace(sp.id, -1); draw(); }, i ? '' : 'invisible'),
            ibtn('arrowR', t('Przesuń niżej'), () => { moveSpace(sp.id, 1); draw(); }, i < spaces.length - 1 ? '' : 'invisible'),
            ibtn('trash', t('Usuń do kosza'), () => { deleteSpace(sp.id); draw(); }, spaces.length < 2 ? 'invisible' : '')))))),
      setCard(t('Zapisane'),
        saved.length ? h('ul', { class: 'set-list' }, saved.map(x => h('li', null,
          h('div', { class: 'sl-main' }, h('b', { text: x.name }), h('small', { text: (x.kind === 'all' ? t('cała Jaskinia') + ' · ' + tn(arr(x.data.spaces).length, 'układ', 'układy', 'układów') : t('układ „{0}”', x.data.name || x.from)) + ' · ' + when2(x.at) })),
          h('div', { class: 'sl-acts' },
            x.kind === 'space' ? h('button', { class: 'jk-tb', type: 'button', title: t('Dodaj jako nową zakładkę'), onclick: () => openSaved(x.id) }, t('Otwórz obok')) : null,
            x.kind === 'space' ? h('button', { class: 'jk-tb', type: 'button', title: t('Zastąp układ na ekranie (Ctrl+Z cofa)'), onclick: () => loadSavedInto(x.id, store.cur) }, t('Wczytaj tutaj')) : null,
            x.kind === 'all' ? h('button', { class: 'jk-tb', type: 'button', title: t('Zastąp całą Jaskinię tym zapisem (najpierw zrobię kopię)'), onclick: e => askPop(e.currentTarget, { text: t('Wczytać całą Jaskinię z zapisu „{0}”? Obecny stan trafi do kopii automatycznych.', x.name), ok: t('Wczytaj'), okClass: '' }, () => openSaved(x.id)) }, t('Wczytaj całość')) : null,
            ibtn('pencil', t('Zmień nazwę'), e => promptPop(e.currentTarget, t('Nazwa zapisu'), x.name, v => { if (v) { x.name = v; persist(); draw(); } })),
            ibtn('trash', t('Usuń do kosza'), () => { const i = store.saved.indexOf(x); store.saved.splice(i, 1); toTrash('saved', x.name, x); draw(); jtoast(t('Zapis „{0}” jest w koszu.', x.name)); })))))
          : h('p', { class: 'set-note', text: t('Jeszcze nic. Ctrl+S zapisuje układ na ekranie pod jego nazwą i godziną; zapis przeżyje każde przestawianie i reset.') })));
  },
  kopie(c, draw) {
    const list = readBackups(), resc = rescued();
    const why = w => ({ auto: t('automatyczna'), 'przed resetem': t('przed resetem'), 'przed przywróceniem kopii': t('przed przywróceniem kopii'), 'przed wczytaniem zapisu': t('przed wczytaniem zapisu'), 'przed importem': t('przed importem'), 'przed usunięciem na zawsze': t('przed usunięciem na zawsze'), 'przed usunięciem notatki na zawsze': t('przed usunięciem notatki'), ręczna: t('ręczna') }[w] || w);
    return h('div', { class: 'set-body' },
      setCard(t('Kopie automatyczne'),
        h('p', { class: 'set-note', text: t('Jaskinia robi kopię co kilka godzin (przy otwarciu) i zawsze przed resetem, importem, wczytaniem całości i usuwaniem na zawsze. Trzyma {0} ostatnich. Żyją w tej przeglądarce, obok samej Jaskini.', BAK_MAX) }),
        h('div', { class: 'set-acts' }, h('button', { class: 'btn', type: 'button', onclick: () => { makeBackup('ręczna'); draw(); jtoast(t('Kopia zrobiona.')); } }, icon('archive', 14), t('Zrób kopię teraz')),
          h('button', { class: 'btn warn', type: 'button', onclick: e => askReset(e.currentTarget) }, icon('reset', 14), t('Zresetuj całą Jaskinię…'))),
        list.length ? h('ul', { class: 'set-list' }, list.map(b => h('li', null,
          h('div', { class: 'sl-main' }, h('b', { text: when2(b.at) }), h('small', { text: why(b.why) + ' · ' + tn(b.n || arr(b.data.spaces).length, 'układ', 'układy', 'układów') + ' · ' + arr(b.data.spaces).map(sp => sp.name).slice(0, 5).join(', ') })),
          h('div', { class: 'sl-acts' },
            h('button', { class: 'jk-tb', type: 'button', onclick: e => askPop(e.currentTarget, { text: t('Przywrócić całą Jaskinię z kopii z {0}? Obecny stan najpierw trafi do kopii, więc to też da się odwrócić.', when2(b.at)), ok: t('Przywróć'), okClass: '' }, () => restoreBackup(b.id)) }, t('Przywróć całość')),
            h('button', { class: 'jk-tb', type: 'button', onclick: e => openMenu(e.currentTarget, [{ head: t('Otwórz jeden układ z tej kopii jako nową zakładkę') },
              ...arr(b.data.spaces).map(sp => ({ label: sp.name, desc: tn(leafIds(sp.L.tree).length + arr(sp.L.floats).length, 'okno', 'okna', 'okien'), act: () => { const nl = validLayout(clone(sp.L), TYPES) ? remapLayout(clone(sp.L), new Set(), obj(b.data.views)) : null; if (nl) addSpace(sp.name, nl, sp.preset, null, sp.purpose || ''); } }))]) }, t('Weź jeden układ…'))))))
          : h('p', { class: 'set-note', text: t('Jeszcze nie ma kopii.') })),
      resc.length ? setCard(t('Schowek ratunkowy'),
        h('p', { class: 'set-note', text: t('Dane, których Jaskinia nie umiała odczytać. Nie są usuwane. Skopiuj je i daj Claude: da się z nich odzyskać, co zostało.') }),
        h('ul', { class: 'set-list' }, resc.map(x => h('li', null, h('div', { class: 'sl-main' }, h('b', { text: when2(x.at) }), h('small', { text: tn(String(x.raw).length, 'znak', 'znaki', 'znaków') })),
          h('div', { class: 'sl-acts' }, h('button', { class: 'jk-tb', type: 'button', onclick: () => B.copyText(String(x.raw), t('Skopiowane')) }, t('Kopiuj'))))))) : null);
  },
  kosz(c, draw) {
    const items = store.trash, orphans = orphanNotes();
    const kindLabel = it => ({ space: t('układ'), saved: t('zapis'), wallnote: t('notatka ze ściany'), broken: t('uszkodzone dane') }[it.kind] || it.kind);
    const forever = (anchor, label, fn) => askPop(anchor, { title: t('Usunąć na zawsze?'), text: t('„{0}” zniknie z kosza i nie da się tego cofnąć z poziomu Jaskini (zostanie tylko w kopii automatycznej robionej teraz).', label), ok: t('Usuń na zawsze'), okClass: 'danger big' }, fn);
    const empty = !items.length && !orphans.length;
    return h('div', { class: 'set-body' },
      setCard(null, h('p', { class: 'set-note', text: t('Tu trafia wszystko, co usuniesz: układy, zapisy, notatki ze ściany i notatki, których nie pokazuje już żadne okno. Leży tu, dopóki sam nie usuniesz na zawsze.') })),
      orphans.length ? setCard(t('Notatki bez okna'), h('ul', { class: 'set-list' }, orphans.map(n => h('li', null,
        h('div', { class: 'sl-main' }, h('b', { text: noteTitle(n.text) || t('bez tytułu') }), h('small', { text: when2(n.upd) + ' · ' + tn(n.text.length, 'znak', 'znaki', 'znaków') })),
        h('div', { class: 'sl-acts' },
          h('button', { class: 'jk-tb', type: 'button', onclick: () => { openWinOfType('notatki', { st: { note: n.id }, fresh: true, w: 0.42, h: 0.6 }); draw(); } }, t('Otwórz w oknie')),
          ibtn('copy', t('Kopiuj tekst'), () => B.copyText(n.text, t('Skopiowane'))),
          h('button', { class: 'jk-tb danger', type: 'button', onclick: e => forever(e.currentTarget, noteTitle(n.text) || t('notatka'), () => { forgetNote(n.id); draw(); }) }, t('Usuń na zawsze'))))))) : null,
      items.length ? setCard(t('Usunięte'), h('ul', { class: 'set-list' }, items.map(it => h('li', null,
        h('div', { class: 'sl-main' }, h('b', { text: it.name || t('bez nazwy') }), h('small', { text: kindLabel(it) + ' · ' + t('usunięte {0}', when2(it.at)) })),
        h('div', { class: 'sl-acts' },
          it.kind !== 'broken' ? h('button', { class: 'jk-tb', type: 'button', onclick: () => { restoreTrash(it.id); draw(); } }, t('Przywróć')) : h('button', { class: 'jk-tb', type: 'button', onclick: () => B.copyText(JSON.stringify(it.data), t('Skopiowane')) }, t('Kopiuj dane')),
          h('button', { class: 'jk-tb danger', type: 'button', onclick: e => forever(e.currentTarget, it.name || kindLabel(it), () => { forgetTrash(it.id); draw(); }) }, t('Usuń na zawsze'))))))) : null,
      empty ? setCard(null, h('p', { class: 'jk-empty', text: t('Kosz jest pusty.') })) : null,
      !empty ? h('div', { class: 'set-danger' }, h('button', { class: 'btn danger big', type: 'button', onclick: e => askPop(e.currentTarget, { title: t('Opróżnić cały kosz?'), text: t('Wszystko w koszu ({0}) zniknie na zawsze. Zanim to zrobię, zapiszę kopię automatyczną.', items.length + orphans.length), ok: t('Opróżnij kosz na zawsze'), okClass: 'danger big' }, () => {
        if (storageOK && !makeBackup('przed usunięciem na zawsze', store.trash)) { jtoast(t('Nie udało się zrobić kopii przed usunięciem, więc nic nie usunąłem. Pamięć przeglądarki jest pełna: wyeksportuj Jaskinię albo usuń stare kopie.')); return; }
        store.trash = []; for (const n of orphanNotes()) delete store.notes[n.id]; persist(); draw(); jtoast(t('Kosz jest pusty.'));
      }) }, icon('trash', 15), t('Opróżnij kosz…'))) : null);
  },
  dane(c, draw) {
    const out = h('div', { class: 'set-out' });
    const offer = (kind) => {
      const txt = exportText(kind, space), name = kind === 'all' ? `jaskinia-${new Date().toISOString().slice(0, 10)}.json` : `jaskinia-uklad-${slug(spaceName(space))}.json`;
      saveFile(name, txt).then(ok => { if (!ok) showText(); });
      function showText() {
        const ta = h('textarea', { class: 'jk-in set-ta', readonly: true, rows: 8, 'aria-label': t('Dane do skopiowania') });
        ta.value = txt;
        fill(out, h('p', { class: 'set-note', text: t('Ta przeglądarka nie pozwala tu zapisać pliku. Skopiuj tekst i wklej go na drugim urządzeniu w polu importu (albo zapisz jako plik .json).') }), ta,
          h('button', { class: 'btn', type: 'button', onclick: () => B.copyText(txt, t('Skopiowane')) }, icon('copy', 14), t('Kopiuj')));
        ta.focus(); ta.select();
      }
    };
    const inp = h('textarea', { class: 'jk-in set-ta', rows: 5, placeholder: t('Wklej tu tekst eksportu Jaskini…'), 'aria-label': t('Tekst do importu') });
    const file = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'set-file', 'aria-label': t('Plik do importu') });
    const res = h('div', { class: 'set-out' });
    const tryImport = text => {
      let o;
      try { o = parseImport(text); } catch (err) { fill(res, h('p', { class: 'set-err', text: err.message })); return; }
      const d = o.data, n = o.kind === 'space' ? 1 : arr(d.spaces).length;
      fill(res, h('p', { class: 'set-note', text: o.kind === 'space' ? t('W środku: układ „{0}”.', d.name || '?') : t('W środku: cała Jaskinia, {0}.', tn(n, 'układ', 'układy', 'układów')) }),
        h('div', { class: 'set-acts' },
          h('button', { class: 'btn', type: 'button', onclick: () => { importAdd(o); fill(res); inp.value = ''; } }, icon('plus', 14), o.kind === 'space' ? t('Dodaj jako nową zakładkę') : t('Dodaj jako nowe zakładki')),
          o.kind === 'all' ? h('button', { class: 'btn warn', type: 'button', onclick: e => askPop(e.currentTarget, { text: t('Zastąpić całą Jaskinię importem? Obecny stan najpierw trafi do kopii automatycznych.'), ok: t('Zastąp'), okClass: 'warn' }, () => { importReplace(o); fill(res); inp.value = ''; }) }, icon('upload', 14), t('Zastąp całą Jaskinię')) : null));
    };
    file.addEventListener('change', () => { const f = file.files && file.files[0]; if (!f) return; f.text().then(tryImport, () => fill(res, h('p', { class: 'set-err', text: t('Nie da się przeczytać tego pliku.') }))); file.value = ''; });
    return h('div', { class: 'set-body' },
      setCard(t('Eksport'), h('p', { class: 'set-note', text: t('Plik z układami, notatkami i zapisami. Na innym urządzeniu (albo po wyczyszczeniu przeglądarki) wczytasz go w imporcie. Modeli z Materiałów w nim nie ma: zostają w bibliotece tej przeglądarki, a ich pliki masz u siebie na dysku.') }),
        h('div', { class: 'set-acts' },
          h('button', { class: 'btn', type: 'button', onclick: () => offer('all') }, icon('download', 14), t('Cała Jaskinia')),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => offer('space') }, icon('download', 14), t('Tylko „{0}”', spaceName(space)))), out),
      setCard(t('Import'), h('div', { class: 'set-acts' }, h('label', { class: 'btn ghost set-filel' }, icon('upload', 14), t('Wybierz plik…'), file)),
        inp, h('div', { class: 'set-acts' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => tryImport(inp.value) }, t('Sprawdź wklejony tekst'))), res));
  },
  skroty() {
    const k = (keys, what) => h('tr', null, h('td', null, keys.map((x, i) => [i ? ' ' : null, h('kbd', { text: x })])), h('td', { text: what }));
    return h('div', { class: 'set-body' },
      setCard(t('Klawiatura'), h('table', { class: 'set-keys' }, h('tbody', null,
        k(['Ctrl', 'Z'], t('cofnij zmianę układu')), k(['Ctrl', 'Shift', 'Z'], t('ponów')), k(['Ctrl', 'S'], t('zapisz układ na ekranie')), k(['Ctrl', ','], t('ustawienia')),
        k(['Ctrl', 'Spacja'], t('okno pod myszą na cały ekran i z powrotem')), k(['Esc'], t('wróć do układu; przerwij przeciąganie')), k(['F2'], t('zmień nazwę okna')),
        k(['Ctrl', t('kółko')], t('przybliż zawartość okna (na ścianie: widok)'))))),
      setCard(t('Ściana'), h('table', { class: 'set-keys' }, h('tbody', null,
        k([t('przeciągnij kartę')], t('przenieś (na dotyku: przytrzymaj chwilę)')), k([t('przeciągnij puste')], t('przesuń widok')), k([t('kółko')], t('przybliż widok (albo przesuń: Ustawienia → Zachowanie)')),
        k(['Shift', t('przeciągnij puste')], t('zaznacz kilka kart ramką')), k(['Shift', t('klik')], t('dodaj kartę do zaznaczenia')), k([t('róg zaznaczonej karty')], t('zmień jej rozmiar')),
        k([t('dwuklik na pustym')], t('nowa notatka')), k(['0'], t('pokaż wszystko')), k(['+', '−'], t('przybliż, oddal')), k([t('strzałki')], t('przesuń zaznaczone karty'))))),
      setCard(t('Okna'), h('table', { class: 'set-keys' }, h('tbody', null,
        k([t('pasek okna')], t('przenieś okno; upuść przy krawędzi innego albo na środku')), k([t('dwuklik na pasku')], t('na cały ekran')),
        k([t('szczelina')], t('zmień proporcje; dwuklik wyrównuje')), k([t('prawy klik')], t('menu okna albo zakładki'))))));
  },
  o() {
    let bytes = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('jaskinia:')) bytes += (localStorage.getItem(k) || '').length * 2; } } catch { /* no storage */ }
    const C = D.estate.coverage, T = D.estate.totals;
    return h('div', { class: 'set-body' },
      setCard(t('Dane'), h('ul', { class: 'set-facts' },
        h('li', null, h('span', { text: t('zrzut repozytoriów') }), h('b', { text: when(SNAP) })),
        h('li', null, h('span', { text: t('pokrycie') }), h('b', { text: `${C.collected}/${C.expected} repo` })),
        h('li', null, h('span', { text: t('razem') }), h('b', { text: `${fmt(T.commits)} commitów · ${T.branches} gałęzi` })),
        h('li', null, h('span', { text: t('zapis Jaskini w tej przeglądarce') }), h('b', { text: storageOK ? `${Math.round(bytes / 1024)} KB` : t('niedostępny') })))),
      setCard(t('Gdzie to wszystko jest'), h('p', { class: 'set-note', text: t('Układy, notatki, zapisy, kopie, kosz i Materiały są tylko w tej przeglądarce, na tym urządzeniu. Nigdzie ich nie wysyłam. Kilka kart Jaskini naraz scala swoje zmiany. Żeby przenieść Jaskinię, użyj eksportu (bez modeli). Dane o projektach to zrzut z GitHuba wbudowany w stronę: odświeża go Claude (regen).') })),
      setCard(t('Wersja'), h('ul', { class: 'set-facts' },
        h('li', null, h('span', { text: t('wersja') }), h('b', { text: 'Jaskinia ' + VER })),
        h('li', null, h('span', { text: t('zbudowana') }), h('b', { text: builtShort() })),
        h('li', null, h('span', { text: t('działa jako') }), h('b', { text: t(PLACE_NAME[PLACE]) }))),
        h('p', { class: 'set-note', text: PLACE === 'plik' ? t('To plik na tym urządzeniu: nowa wersja Jaskini to nowy plik. Twój zapis zostaje w przeglądarce, ale jeśli nowa kopia go nie widzi, przenieś go eksportem i importem.') : PLACE === 'claude' ? t('Jaskinia działa w claude.ai: nowa wersja pojawia się pod tym samym linkiem.') : t('Jaskinia działa na Twoim serwerze.') })));
  },
};
function zoomSlider(draw) {
  const v = Math.round(prefs.cz * 100);
  const out = h('output', { text: v + '%' });
  const r = h('input', { type: 'range', min: 60, max: 180, step: 5, value: v, 'aria-label': t('Powiększenie treści okien') });
  r.addEventListener('input', () => { out.textContent = r.value + '%'; });
  r.addEventListener('change', () => { setPref('cz', +r.value / 100); draw(); });
  return h('div', { class: 'set-range' }, r, out, v !== 100 ? h('button', { class: 'jk-tb', type: 'button', onclick: () => { setPref('cz', 1); draw(); } }, '100%') : null);
}
const slug = s0 => String(s0).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'uklad';
/* offer a file: the artifact's downloads capability, a plain download on Jozz's own hosting, else false (show the text) */
async function saveFile(name, text) {
  try {
    const dl = B.cap && B.cap.downloads;
    if (dl && dl.save) { await dl.save({ filename: name, data: text }); jtoast(t('Plik gotowy: {0}', name)); return true; }
  } catch (err) { if (err && err.code === 'declined') return true; }
  if (B.HOSTED) {
    try {
      const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name, style: { display: 'none' } });
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return true;
    } catch { return false; }
  }
  return false;
}
function importAdd(o) {
  const d = o.data;
  const list = o.kind === 'space' ? [{ name: d.name, preset: d.preset, purpose: d.purpose, L: d.L, views: d.views }] : arr(d.spaces).map(sp => ({ ...sp, views: d.views }));
  for (const [id, n] of Object.entries(obj(d.notes))) if (!store.notes[id]) store.notes[id] = typeof n === 'string' ? { text: n, upd: Date.now() } : n;
  let added = 0, last = null;
  for (const sp of list) {
    const L0 = clone(sp.L);
    if (!validLayout(L0, TYPES)) continue;
    const nl = remapLayout(L0, new Set(), obj(sp.views));
    for (const w of Object.values(nl.wins)) if (w.type === 'notatki') ensureNoteWin(store, w);
    const s0 = { id: uid('u'), name: uniqueName(sp.name || t('Import')), preset: PRESETS[sp.preset] ? sp.preset : null, purpose: sp.purpose || '', L: nl };
    store.spaces.push(s0); added++; last = s0;
  }
  if (o.kind === 'all' && Array.isArray(d.saved)) for (const x of d.saved) if (x && x.id && !store.saved.some(y => y.id === x.id)) store.saved.push(x);
  persist();
  if (last) setSpace(last.id);
  jtoast(added ? t('Dodane z importu: {0}.', tn(added, 'układ', 'układy', 'układów')) : t('W imporcie nie było żadnego układu, który da się odczytać.'));
}
function importReplace(o) {
  const before = makeBackup('przed importem');
  const d = o.data;
  for (const [id, n] of Object.entries(obj(d.notes))) store.notes[id] = typeof n === 'string' ? { text: n, upd: Date.now() } : n;
  store.spaces = arr(d.spaces); store.cur = d.cur; if (R[d.sel]) store.sel = d.sel;
  Object.assign(store.views, obj(d.views));
  if (Array.isArray(d.saved)) for (const x of d.saved) if (x && x.id && !store.saved.some(y => y.id === x.id)) store.saved.push(x);
  rebuildAll();
  jtoast(t('Jaskinia wczytana z importu.'), before ? { label: t('Cofnij'), act: () => restoreBackup(before.id, true) } : null);
}
