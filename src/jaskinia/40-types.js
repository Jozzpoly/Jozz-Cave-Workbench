/* ---------- what a window can show ----------
   follows: shows the selected project (unless the window is pinned to one)
   sized: drawn for the window's exact size, redrawn when it changes
   fill: fills the window without scrolling
   noZoom: the window's content zoom does not apply (the content has its own view)
   Names and descriptions are Polish source strings; t() shows them in the interface language. */
const GROUPS = [['all', 'Wszystkie projekty'], ['one', 'Zaznaczony projekt'], ['stat', 'Statystyki'], ['misc', 'Inne']];

function pad(...kids) { return h('div', { class: 'jk-pad' }, ...kids); }
/* what the colours mean: life as of the snapshot, calm when old, red only for what needs attention */
function lifeLegend() {
  return h('div', { class: 'jk-legend', 'aria-label': t('Kolor: życie projektu w chwili zrzutu') },
    h('span', { class: 'lg-cap', text: t('Ostatni commit (w chwili zrzutu):') }),
    [['--h5', 'dobę temu'], ['--h4', '3 dni'], ['--h3', 'tydzień'], ['--h2', '2 tygodnie'], ['--h1', 'miesiąc'], ['--h0', 'dawniej'], [null, 'pusto']].map(([c0, tx]) =>
      h('span', { class: 'lg-i' }, h('i', { class: c0 ? '' : 'hatched', style: c0 ? { background: `var(${c0})` } : null }), t(tx))),
    h('span', { class: 'lg-i lg-att' }, h('i', { class: 'att' }), t('ustalenia do decyzji')));
}
function noRepo() { return pad(h('p', { class: 'jk-empty', text: t('Zaznacz projekt: kliknij go na mapie, w katastrze, w spisie albo wybierz u góry.') })); }

/* the outliner: every project in one short list, by family */
function renderSpis(box, c) {
  const st = c.win.st;
  const q = h('input', { type: 'search', class: 'jk-in', placeholder: t('Szukaj projektu'), value: st.q || '', 'aria-label': t('Szukaj projektu') });
  const list = h('div', { class: 'spis', role: 'list' });
  const draw = () => {
    const qq = (st.q || '').trim().toLowerCase();
    list.replaceChildren();
    for (const f of D.families) {
      const rs = f.repos.map(n => R[n]).filter(r => !qq || `${r.name} ${r.short} ${f.name}`.toLowerCase().includes(qq)).sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
      if (!rs.length) continue;
      list.append(h('div', { class: 'spis-f' }, h('span', { text: f.name }), h('small', { text: rs.length })));
      for (const r of rs) {
        const lvl = r.life === 'zakończone' ? -1 : heatOf(r.last_ts);
        list.append(h('div', { class: 'spis-r', role: 'listitem', 'data-repo': r.name },
          h('button', { class: 'spis-b', type: 'button', onclick: () => c.select(r.name), title: `${r.short}: ${LIFE[r.life]?.label}, commit ${ago(r.last_ts)}` },
            sigil(r, 20), h('span', { class: 'nm', text: r.short }), h('i', { class: 'dot' + (lvl < 0 ? ' none' : ''), style: { background: lvl === 0 ? 'var(--h0)' : `var(${heatVar(lvl)})` } }), h('span', { class: 'ago', text: r.last_ts ? ago(r.last_ts) : t('puste') })),
          r.pages && r.life !== 'zakończone' ? B.playA(r, { class: 'spis-play', title: t('Zagraj: {0}', r.short), 'aria-label': t('Zagraj: {0}', r.short) }, icon('play', 12)) : null));
      }
    }
    if (!list.firstChild) list.append(h('p', { class: 'jk-empty', text: t('Nic nie pasuje.') }));
  };
  q.addEventListener('input', () => { st.q = q.value; c.save(); draw(); });
  draw();
  box.append(h('div', { class: 'jk-pad spis-w' }, q, list));
}

function renderGame(box, c) {
  const r = c.repo;
  if (!r) { box.append(noRepo()); return; }
  const playable = REPOS.filter(x => x.pages && x.life !== 'zakończone').sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0));
  if (!r.pages || r.life === 'zakończone') {
    box.append(pad(h('p', { class: 'jk-empty', text: r.pages ? t('{0} jest zakończone; jego notatka prosi, żeby go nie pokazywać jako gry.', r.short) : t('{0} nie ma strony do grania.', r.short) }),
      h('p', { class: 'jk-sub', text: t('Te można uruchomić:') }),
      h('div', { class: 'jk-chips' }, playable.map(x => h('button', { class: 'jk-chip', type: 'button', onclick: () => c.pickProject(x.name) }, sigil(x, 18), x.short)))));
    return;
  }
  if (gamesInWindow()) {
    // a downloaded file or Jozz's own server may frame the game; if a site refuses frames, the link below still works
    box.append(h('div', { class: 'jk-game' }, h('iframe', { src: r.pages, title: `${r.short}: gra`, allowfullscreen: '', referrerpolicy: 'no-referrer',
      allow: 'fullscreen; xr-spatial-tracking; gamepad; autoplay; clipboard-write; accelerometer; gyroscope; magnetometer; screen-wake-lock' }),
      h('div', { class: 'jk-game-bar' }, h('span', { text: t('Gra nie rusza w oknie?') }), h('a', { class: 'jk-game-ext', href: r.pages, target: '_blank', rel: 'noopener' }, icon('ext', 13), t('Otwórz w nowej karcie')))));
    return;
  }
  const ch = (B.CH?.moved || []).find(m => m.repo === r.name);
  const fresh = r.branches.filter(b => !b.roles.includes('domyślna')).sort((a, b) => b.ts - a.ts).slice(0, 4);
  box.append(h('div', { class: 'jk-pad jk-launch' },
    h('div', { class: 'jl-top' }, sigil(r, 96), h('div', null,
      h('h2', { text: r.short }), h('p', { class: 'jl-sub' }, B.lifeBadge(r.life), ' · ', t('ostatni commit'), ' ', h('b', { text: ago(r.last_ts) })),
      h('div', { class: 'jl-acts' }, B.playA(r, { class: 'btn hot jl-play' }, B.playIcon(), t('Zagraj')), h('span', { class: 'jl-url', text: r.pages.replace('https://', '') })))),
    h('p', { class: 'jl-note', text: B.HOSTED ? t('Gra otworzy się w nowej karcie, bo tak jest ustawione (Ustawienia → Zachowanie → Gry). Może też grać w tym oknie.') : t('Gra otworzy się w nowej karcie: w claude.ai strona nie może pokazać innej strony w oknie. W Jaskini pobranej jako plik albo postawionej na własnym serwerze zagrasz w tym oknie.') }),
    ch ? h('p', { class: 'jl-ch' }, h('b', { text: t('Od poprzedniego zrzutu: ') }), [ch.commits ? '+' + tn(ch.commits, 'commit', 'commity', 'commitów') : null, ch.n_new_branches ? '+' + tn(ch.n_new_branches, 'gałąź', 'gałęzie', 'gałęzi') : null].filter(Boolean).join(', ') || t('przesunięte gałęzie')) : null,
    r.state?.status ? h('div', { class: 'jl-st' }, h('span', { class: 'k', text: t('Stan według repo') }), h('blockquote', { text: r.state.status })) : null,
    fresh.length ? h('div', { class: 'jl-br' }, h('span', { class: 'k', text: t('Ostatnio ruszane gałęzie') }),
      h('ul', null, fresh.map(b => h('li', null, h('code', { text: b.n }), h('span', { text: ' · ' + ago(b.ts) + (b.s ? ' · ' + b.s : '') }))))) : null));
}

function renderState(box, c) {
  const r = c.repo;
  if (!r) { box.append(noRepo()); return; }
  const fs = r.findings || [];
  box.append(pad(
    h('section', { class: 'panel' }, h('h2', { text: t('Stan według repo') }),
      r.state ? B.stateNote(r) : h('p', { class: 'hint', text: r.empty ? t('Repo nie ma commitów.') : t('Repo nie ma notatki stanu (STATE, CURRENT, PROJECT_STATE…).') })),
    h('section', { class: 'panel' }, h('h2', { text: t('Ustalenia') }),
      fs.length ? h('ul', { class: 'finds compact' }, fs.map(f => B.findingItem(f, false))) : h('p', { class: 'faint', text: t('Reguły nie znalazły tu nic do zgłoszenia.') })),
    B.prPanel(r)));
}

/* notes: the window shows one note; the text lives in the store, outside undo, and other windows with the same note follow live */
function renderNotes(box, c) {
  if (!c.win.st.note) { c.win.st.note = noteNew(); c.save(); } // a notes window always has somewhere to write
  const id = c.win.st.note;
  const ta = h('textarea', { class: 'jk-notes', placeholder: t('Twoje notatki. Zapisują się same, w tej przeglądarce. Cofanie układu (Ctrl+Z) ich nie rusza.'), 'aria-label': t('Notatki'), spellcheck: 'true' });
  ta.value = noteText(id);
  const gone = store.notes[id]?.gone;
  let tm = 0;
  ta.addEventListener('input', () => {
    clearTimeout(tm);
    tm = setTimeout(() => { noteSet(id, ta.value); document.dispatchEvent(new CustomEvent('jk:note', { detail: { id, from: ta } })); }, 250);
  });
  ta.addEventListener('blur', () => { clearTimeout(tm); noteSet(id, ta.value); });
  const onNote = e => { if (e.detail.id === id && e.detail.from !== ta && document.activeElement !== ta) ta.value = noteText(id); };
  document.addEventListener('jk:note', onNote);
  c.onDispose(() => { document.removeEventListener('jk:note', onNote); clearTimeout(tm); if (ta.value !== noteText(id)) noteSet(id, ta.value); });
  box.append(h('div', { class: 'jk-pad jk-notes-w' }, gone && !noteText(id) ? h('p', { class: 'jk-sub warn', text: t('Tekstu tej notatki tu nie ma: został usunięty na zawsze albo nie przyszedł z importem. Okno zaczyna od pustej kartki.') }) : null, ta));
}
function notesCtx(c) {
  const id = c.win.st.note, title = noteTitle(noteText(id)) || t('pusta notatka');
  return [h('button', { class: 'jk-tb note-pick', type: 'button', title: t('Która notatka jest w tym oknie'), onclick: e => notesMenu(e.currentTarget, c) }, icon('note', 13), h('span', { text: title }), icon('chev', 12))];
}
function notesMenu(anchor, c) {
  const cur = c.win.st.note, used = notesReferenced();
  const all = Object.entries(store.notes).filter(([, n]) => n.text.trim() || false).sort((a, b) => (b[1].upd || 0) - (a[1].upd || 0));
  openMenu(anchor, [
    { head: t('Notatka w tym oknie') },
    ...all.slice(0, 14).map(([id, n]) => ({ label: noteTitle(n.text) || t('bez tytułu'), log: t('notatka'), desc: (used.has(id) ? '' : t('bez okna · ')) + dshort(new Date(n.upd || 0)), checked: id === cur,
      act: () => { if (id !== cur) c.commit(t('inna notatka w oknie'), () => { c.win.st.note = id; }); } })),
    { sep: true },
    { label: t('Nowa, pusta notatka'), icon: 'plus', act: () => c.commit(t('nowa notatka'), () => { c.win.st.note = noteNew(); }) },
    { label: t('Odłóż tę notatkę do kosza'), desc: t('okno dostanie pustą kartkę; tekst czeka w koszu'), icon: 'trash', disabled: !noteText(cur).trim(),
      act: () => { c.commit(t('notatka do kosza'), () => { c.win.st.note = noteNew(); }); jtoast(t('Notatka jest w koszu (Ustawienia → Kosz).'), { label: t('Cofnij'), act: () => undo() }); } },
  ]);
}

function renderRaw(box, c) {
  const r = c.repo;
  if (!r) { box.append(noRepo()); return; }
  const txt = JSON.stringify(B.rawRecord(r), null, 1);
  box.append(pad(h('div', { class: 'jk-row' }, h('button', { class: 'btn', type: 'button', onclick: () => B.copyText(txt, t('Rekord skopiowany')) }, icon('copy', 14), t('Kopiuj rekord')),
    h('span', { class: 'faint', text: `${r.name} · ${t('zrzut z')} ${when(SNAP)}` })), h('pre', { class: 'raw', text: txt })));
}

/* stats windows share one period and one family filter per workspace */
function statsCtx(c) {
  const f = statFilter(c.L), ranged = !!(TYPES[c.win.type] || {}).ranged;
  const seg = ranged ? h('div', { class: 'jk-seg', role: 'group', 'aria-label': t('Okres') },
    RANGES.map(([k, tx, short]) => h('button', { type: 'button', class: f.range === k ? 'on' : '', 'aria-pressed': String(f.range === k), text: t(short || tx), title: short ? t(tx) : null, onclick: () => c.setStats({ range: k }) }))) : null;
  const fam = h('button', { class: 'jk-tb fam', type: 'button', title: ranged ? t('Okres i rodziny: wspólne dla wszystkich okien statystyk w tym układzie') : t('Rodziny: wspólne dla wszystkich okien statystyk w tym układzie'),
    onclick: e => openStatsMenu(e.currentTarget, c, ranged) }, ranged ? h('span', { class: 'rl', text: t(rangeLabel(f.range)) + ' ·' }) : null, h('span', { class: 'fl', text: famLabel(f.fams) }), icon('chev', 12));
  return [seg, fam].filter(Boolean);
}
function openStatsMenu(anchor, c, ranged) {
  const f = statFilter(c.L);
  openMenu(anchor, [
    ...(ranged ? [{ head: t('Okres') }, ...RANGES.map(([k, tx]) => ({ label: t(tx), checked: f.range === k, act: () => c.setStats({ range: k }) })), { sep: true }] : []),
    { head: t('Rodziny') },
    { label: t('Wszystkie rodziny'), checked: !f.fams.length, act: () => c.setStats({ fams: [] }) },
    ...D.families.map(fm => ({ label: fm.name, checked: f.fams.includes(fm.id),
      act: () => c.setStats({ fams: f.fams.includes(fm.id) ? f.fams.filter(x => x !== fm.id) : [...f.fams, fm.id] }) })),
  ]);
}
function renderStatsAll(box, c) {
  const m = statModel(statFilter(c.L)), W = c.size.w;
  const grid = h('div', { class: 'st-grid' },
    h('div', { class: 'st-pl wide' }, statKpis(m)),
    h('section', { class: 'st-pl main' }, stHead(t('Commity dzień po dniu'), `${chartSpanNote(m)} · ${famLabel(m.fams)}`),
      statChart(m, W >= 1100 ? (W - 52) * 0.64 : W - 46, 260, c.select)),
    h('section', { class: 'st-pl side' }, stHead(t('Kiedy powstają commity'), t('od początku')), statHours(m)),
    h('section', { class: 'st-pl main' }, stHead(t('Projekty w okresie'), t('{0} dni · kliknij, żeby zaznaczyć', m.N)), statRanking(m, c.select, c.selName())),
    h('section', { class: 'st-pl side' }, stHead(t('Rodzaje gałęzi'), t('po przedrostku nazwy')), statKinds(m)),
    h('section', { class: 'st-pl main' }, stHead(t('Rok w commitach'), t('ostatnie 53 tygodnie')), statYear(m, W >= 1100 ? (W - 52) * 0.64 : W - 46)),
    h('section', { class: 'st-pl side' }, stHead(t('Ciekawostki'), t('liczone z danych')), statFacts(m)));
  box.append(h('div', { class: 'jk-pad st' }, grid, h('p', { class: 'st-foot', text: t('Commity to praca Twoja i agentów razem: agenci podpisują się Twoim kontem, więc dziś nie da się ich rozdzielić. Ślad agenta dają tylko gałęzie codex/.') })));
}
function renderChart(box, c) {
  const m = statModel(statFilter(c.L));
  const kp = statKpis(m), chartBox = h('div', { class: 'st-chartbox' });
  const sec = h('section', { class: 'st-pl flat' }, stHead(t('Commity dzień po dniu'), `${chartSpanNote(m)} · ${famLabel(m.fams)}`), chartBox);
  box.append(h('div', { class: 'jk-pad st' }, kp, sec));
  return () => { // the chart takes whatever height the numbers above it leave
    const body = box.closest('.wbody');
    if (!body) return;
    const top = (chartBox.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop) / c.z;
    chartBox.append(statChart(m, chartBox.clientWidth, clamp(c.size.h - top - 34, 150, 1400), c.select));
  };
}
function renderRanking(box, c) {
  const m = statModel(statFilter(c.L));
  box.append(h('div', { class: 'jk-pad st' }, h('section', { class: 'st-pl flat' }, stHead(t('Projekty w okresie'), t('{0} dni · {1} · kliknij, żeby zaznaczyć', m.N, famLabel(m.fams))), statRanking(m, c.select, c.selName()))));
}
function renderYear(box, c) {
  const m = statModel(statFilter(c.L));
  box.append(h('div', { class: 'jk-pad st' }, h('section', { class: 'st-pl flat' }, stHead(t('Rok w commitach'), `${t('ostatnie 53 tygodnie')} · ${famLabel(m.fams)}`), statYear(m, c.size.w - 30)),
    h('section', { class: 'st-pl flat' }, stHead(t('Ciekawostki'), t('liczone z danych')), statFacts(m))));
}
function renderWhen(box, c) {
  const m = statModel(statFilter(c.L));
  box.append(h('div', { class: 'jk-pad st' }, h('section', { class: 'st-pl flat' }, stHead(t('Kiedy powstają commity'), famLabel(m.fams)), statHours(m)),
    h('section', { class: 'st-pl flat' }, stHead(t('Rodzaje gałęzi'), t('po przedrostku nazwy')), statKinds(m))));
}

/* the parcel map: zooming in magnifies it (the window scrolls), zooming out gives each parcel more room */
function renderMap(box, c) {
  const z = c.z, k = Math.max(1, z);
  const W = Math.floor(c.size.w * k - 20), Hh = Math.floor(c.size.h * k - 52);
  const { svg } = B.parcelMap(Math.max(240, W), Math.max(140, Hh));
  if (z > 1) Object.assign(svg.style, { width: Math.max(240, W) + 'px', height: Math.max(140, Hh) + 'px', maxWidth: 'none' }); // magnified: the window scrolls
  box.append(h('div', { class: 'jk-pad jk-map' + (z > 1 ? ' big' : '') }, svg, lifeLegend()));
  return () => { B.fitParcelLabels(svg); document.fonts?.ready?.then(() => B.fitParcelLabels(svg)); };
}

const TYPES = {
  wybor: { name: 'Pusty', glyph: 't_wybor', desc: 'Wybierz, co ma tu być.', sized: true, render: (box, c) => box.append(lostNote(c), chooser(c)) },
  mapa: { group: 'all', name: 'Mapa działek', glyph: 't_mapa', sized: true, fill: true, zoomKey: true,
    desc: 'Każde repo to działka w swojej rodzinie. Kolor: jak żywy był projekt w chwili zrzutu.', render: renderMap },
  sciana: { group: 'all', name: 'Ściana projektów', glyph: 't_sciana', fill: true, noZoom: true,
    desc: 'Twoja ściana: karty projektów, ramki i notatki. Układasz je ręką; przybliżenie pokazuje więcej.', render: renderWall, ctx: wallCtx },
  kataster: { group: 'all', name: 'Kataster', glyph: 't_kataster',
    desc: 'Wszystkie repo w wierszach: szukaj, filtruj, sortuj, rozwijaj szczegóły i gałęzie.',
    render(box, c) {
      const st = c.win.st;
      st.kat = Object.assign({ q: '', life: 'all', prob: 'all', sort: 'fam' }, st.kat || {});
      const open = new Set(Array.isArray(st.open) ? st.open : []);
      const sec = B.katasterSection({ st: st.kat, open, save: () => c.save(), onOpen: set => { st.open = [...set]; c.save(); } });
      sec.addEventListener('click', e => { const head = e.target.closest('.khead'); if (head) c.select(head.closest('.krow').dataset.repo); });
      box.append(sec);
    } },
  spis: { group: 'all', name: 'Spis projektów', glyph: 't_spis', desc: 'Krótka lista według rodzin, z wyszukiwarką. Klik zaznacza projekt.', render: renderSpis },
  zagraj: { group: 'all', name: 'Do zagrania', glyph: 't_zagraj', desc: 'Projekty ze stroną do grania, najświeższe pierwsze.',
    render(box) { const sec = B.playStrip(); box.append(sec || pad(h('p', { class: 'jk-empty', text: t('Żaden projekt nie ma strony do grania.') }))); } },
  ustalenia: { group: 'all', name: 'Ustalenia', glyph: 't_ustalenia', desc: 'Co reguły znalazły w repo, od poważnych do drobnych.',
    render(box, c) { const st = c.win.st; st.feed = Object.assign({ feedOpen: false, feedAll: false }, st.feed || {}); box.append(B.findingsFeed({ st: st.feed, save: () => c.save() })); } },
  zmiany: { group: 'all', name: 'Od poprzedniego zrzutu', glyph: 't_zmiany', desc: 'Co się ruszyło między dwoma ostatnimi zrzutami.',
    render(box) { box.append(pad(B.changesStrip() || h('p', { class: 'jk-empty', text: t('Nie ma poprzedniego zrzutu do porównania.') }))); } },
  karta: { group: 'one', follows: true, name: 'Karta projektu', glyph: 't_karta', desc: 'Wszystko o jednym projekcie: po co jest, liczby, stan, wejścia, gałęzie, PR.',
    render(box, c) { box.append(c.repo ? B.repoView(c.repo) : noRepo()); } },
  gra: { group: 'one', follows: true, name: 'Gra', glyph: 't_gra', fill: true, noZoom: true, desc: 'Zagraj w zaznaczony projekt.', render: renderGame },
  galezie: { group: 'one', follows: true, sized: true, name: 'Gałęzie', glyph: 't_galezie', desc: 'Las gałęzi zaznaczonego projektu albo ich tabela.',
    render(box, c) {
      const r = c.repo;
      if (!r) { box.append(noRepo()); return; }
      box.append(pad(r.branches.length ? B.forestPanel(r, Math.floor(c.size.w - 30)) : h('p', { class: 'jk-empty', text: t('To repo nie ma gałęzi.') })));
    } },
  rytm: { group: 'one', follows: true, name: 'Rytm i zegar', glyph: 't_rytm', desc: 'Commity dzień po dniu i godziny pracy zaznaczonego projektu.',
    render(box, c) { const r = c.repo; box.append(r ? pad(B.rhythmPanel(r), r.commits ? B.clockPanel(r) : null) : noRepo()); } },
  stan: { group: 'one', follows: true, name: 'Stan według repo', glyph: 't_stan', desc: 'Notatka stanu z samego repo, ustalenia i otwarte pull requesty.', render: renderState },
  dane: { group: 'one', follows: true, name: 'Surowe dane', glyph: 't_dane', desc: 'Rekord zaznaczonego projektu w JSON, do skopiowania.', render: renderRaw },
  statystyki: { group: 'stat', stats: true, ranged: true, sized: true, name: 'Statystyki: wszystko', glyph: 't_statystyki', desc: 'Liczby okresu, wykres, ranking, godziny, rok i ciekawostki naraz.', render: renderStatsAll, ctx: statsCtx },
  wykres: { group: 'stat', stats: true, ranged: true, sized: true, name: 'Commity dzień po dniu', glyph: 't_wykres', desc: 'Liczby okresu i wykres dzienny z rekordem i typowym dniem.', render: renderChart, ctx: statsCtx },
  ranking: { group: 'stat', stats: true, ranged: true, name: 'Projekty w okresie', glyph: 't_ranking', desc: 'Ile commitów dostał każdy projekt i jak to się zmieniło.', render: renderRanking, ctx: statsCtx },
  rok: { group: 'stat', stats: true, sized: true, name: 'Rok w commitach', glyph: 't_rok', desc: 'Kalendarz ostatnich 53 tygodni i ciekawostki.', render: renderYear, ctx: statsCtx },
  zegar: { group: 'stat', stats: true, name: 'Kiedy i jak', glyph: 't_zegar', desc: 'Godziny, dni tygodnia i rodzaje gałęzi.', render: renderWhen, ctx: statsCtx },
  puls: { group: 'stat', sized: true, fill: true, name: 'Puls', glyph: 't_puls', desc: 'Wszystkie repo razem, dzień po dniu od maja.',
    render(box, c) { const sec = B.seismo(); const svg = sec.querySelector('svg'); svg.style.height = Math.max(50, c.size.h - 74) + 'px'; box.append(sec); } },
  historia: { group: 'stat', sized: true, name: 'Historia', glyph: 't_historia', desc: 'Każdy projekt jako grzbiet w czasie, od najstarszego do najmłodszego.',
    render(box, c) { box.append(pad(B.ridgeline(Math.max(300, Math.floor(c.size.w - 30))))); } },
  notatki: { group: 'misc', name: 'Notatki', glyph: 't_notatki', desc: 'Twoje notatki. Zapisują się same; cofanie układu ich nie rusza.', render: renderNotes, ctx: notesCtx },
  wiedza: { group: 'misc', name: 'Wiedza', glyph: 't_wiedza', desc: 'Prawa Biblioteki, wspólne DNA projektów, lekcje i dziennik rozmów.', render(box) { box.append(B.knowledgeView()); } },
  ustawienia: { group: 'misc', name: 'Ustawienia', glyph: 't_ustawienia', desc: 'Wygląd, motywy, język, zapisane układy, kopie, kosz i przenoszenie.', render: renderSettings },
};
for (const [k, T] of Object.entries(TYPES)) T.key = k;

/* an empty window: in a big one every kind with a sentence, in a small one a button and the kinds used lately */
/* a window this Jaskinia cannot draw: written by a newer build (see repairLayout); it keeps its data and comes back there */
function lostNote(c) {
  const lost = c.win.lost;
  if (!lost || !lost.type) return null;
  return h('p', { class: 'jk-sub warn ch-lost', text: t('Tu było okno „{0}”, którego ta wersja Jaskini ({1}) nie zna. Jego dane czekają: w nowszej Jaskini wróci samo. Wybierz coś innego, a je zastąpisz.', lost.type, VER) });
}
function chooser(c) {
  const recent = (Array.isArray(prefs.recent) ? prefs.recent : []).filter(k => TYPES[k] && k !== 'wybor').slice(0, 6);
  const small = c.size.w < 440 || c.size.h < 300;
  const tile = T => h('button', { class: 'ch-tile', type: 'button', 'data-type': T.key, onclick: () => c.setType(T.key) }, icon(T.glyph, 22), h('b', { text: t(T.name) }), h('span', { text: t(T.desc) }));
  if (small) {
    const pick = h('button', { class: 'btn ch-pick', type: 'button', onclick: e => openMenu(e.currentTarget, typeItems(null, k => c.setType(k)), null, 'types') }, icon('t_wybor', 16), t('Wybierz, co pokazać'), icon('chev', 12));
    return h('div', { class: 'chooser small' }, h('p', { class: 'ch-lead', text: t('Co ma tu być?') }), pick,
      recent.length ? h('div', { class: 'ch-recent' }, recent.map(k => h('button', { class: 'ch-mini', type: 'button', title: t(TYPES[k].desc), onclick: () => c.setType(k) }, icon(TYPES[k].glyph, 16), h('span', { text: t(TYPES[k].name) })))) : null);
  }
  return h('div', { class: 'chooser' },
    h('p', { class: 'ch-lead', text: t('Co ma pokazywać to okno?') }),
    recent.length ? h('section', { class: 'ch-g' }, h('h4', { text: t('Ostatnio wybierane') }), h('div', { class: 'ch-grid' }, recent.map(k => tile(TYPES[k])))) : null,
    GROUPS.map(([g, label]) => h('section', { class: 'ch-g' }, h('h4', { text: t(label) }),
      h('div', { class: 'ch-grid' }, Object.values(TYPES).filter(T => T.group === g).map(tile)))));
}
