/* ---------- cheap feedback: a log of what happened, a note pinned to the moment, a package for Claude ----------
   jaskinia:dziennik  the last few hundred things that happened (time, what, in which layout), in this browser only
   jaskinia:uwagi     Jozz's "to mnie uwiera" notes; each is pinned to the moment the button was pressed, the layout,
                      the window, the project and the screen
   "Paczka dla Claude'a" puts them together with the version, the place, the device and the layouts. A screen recording
   can then be matched to the log second by second, and one round of feedback costs minutes instead of a night.
   Nothing leaves the device by itself: the package is a file (or text) Jozz hands over when he wants. */
const KEY_LOG = 'jaskinia:dziennik', KEY_UW = 'jaskinia:uwagi', LOG_MAX = 600;
let jlog = (() => { try { return arr(JSON.parse(lsGet(KEY_LOG) || '[]')).filter(e => e && e.t && e.a); } catch { return []; } })();
let uwagi = (() => { try { return arr(JSON.parse(lsGet(KEY_UW) || '[]')).filter(u => u && u.t && typeof u.text === 'string'); } catch { return []; } })();
let logT = 0, lastLogged = '';
function logEv(what, extra) {
  const a = String(what || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!a) return;
  const now = Date.now(), prev = jlog[jlog.length - 1];
  if (prev && prev.a === a && now - prev.t < 1500) { prev.n = (prev.n || 1) + 1; prev.t2 = now; return; } // a burst of the same thing is one line
  const e = { t: now, a };
  try { if (space) e.u = spaceName(space); } catch { /* before the first layout */ }
  if (extra) Object.assign(e, extra);
  jlog.push(e);
  if (jlog.length > LOG_MAX) jlog.splice(0, jlog.length - LOG_MAX);
  clearTimeout(logT); logT = setTimeout(saveLog, 700);
  lastLogged = a;
}
function saveLog() {
  clearTimeout(logT);
  if (lsSet(KEY_LOG, JSON.stringify(jlog)) !== true) { jlog = jlog.slice(-200); lsSet(KEY_LOG, JSON.stringify(jlog)); }
}
function saveUwagi() { return lsSet(KEY_UW, JSON.stringify(uwagi)) === true; }

/* the moment, in the owner's own clock: 2026-10-16 06:52:13.412 +02:00 */
function isoLocal(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), p = (n, k = 2) => String(Math.abs(n)).padStart(k, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)} ${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}
const hms = ms => isoLocal(ms).slice(11, 19);

/* what is on the screen right now: the context every note and the package carry */
function nowContext() {
  const f = L && L.focus && L.wins[L.focus] ? L.focus : (L && phone ? phoneCurrent() : null);
  return {
    t: Date.now(), u: space ? spaceName(space) : null,
    okno: f ? winTitle(f) : null, typ: f ? L.wins[f].type : null,
    projekt: store && store.sel ? (R[store.sel]?.short || store.sel) : null,
    max: L && L.max ? winTitle(L.max) : null,
    ekran: `${innerWidth}×${innerHeight}`, telefon: !!phone, v: VER,
  };
}

/* ---------- "to mnie uwiera": one line now, pinned to this second ---------- */
function uwagaPop(anchor) {
  const ctx = nowContext();
  const where = [ctx.u && t('układ „{0}”', ctx.u), ctx.okno && t('okno „{0}”', ctx.okno), ctx.projekt && t('projekt {0}', ctx.projekt)].filter(Boolean).join(' · ');
  let close = null;
  const inp = h('textarea', { class: 'jk-in', rows: 4, maxlength: 2000, 'aria-label': t('Co Cię uwiera?'), placeholder: t('Co Cię uwiera albo cieszy? Jedno zdanie wystarczy.') });
  const ok = () => {
    const text = inp.value.trim();
    close();
    if (!text) return;
    uwagi.push({ ...ctx, text });
    const saved = saveUwagi();
    logEv(t('uwaga: {0}', noteTitle(text)));
    jtoast(saved ? t('Uwaga zapisana ({0}). Paczka dla Claude\'a: Ustawienia → Uwagi i paczka.', uwagi.length) : t('Uwagi nie da się zapisać w tej przeglądarce. Skopiuj ją: Ustawienia → Uwagi i paczka.'),
      { label: t('Pokaż'), act: () => openSettings('uwagi') });
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ok(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
  const el = h('div', { class: 'jk-menu jk-confirm jk-uwaga', role: 'dialog', 'aria-label': t('To mnie uwiera') },
    h('h3', { text: t('To mnie uwiera') }),
    h('p', { class: 'uw-ctx', text: t('Chwila {0}', hms(ctx.t)) + (where ? ' · ' + where : '') }),
    inp,
    h('div', { class: 'jk-row' }, h('button', { class: 'btn', type: 'button', text: t('Zapisz'), onclick: ok }), h('button', { class: 'btn ghost', type: 'button', text: t('Anuluj'), onclick: () => close() }),
      h('small', { class: 'uw-hint', text: phone ? '' : 'Ctrl+Enter' })));
  close = showPopover(el, anchor || bar.querySelector('.jk-uw-b') || bar);
  inp.focus();
}

/* ---------- the package ---------- */
function packageData(withNotes) {
  const C = D.estate.coverage;
  const notesInfo = Object.values(store.notes);
  return {
    app: 'jaskinia-paczka', v: 1,
    zrobiona: isoLocal(Date.now()), zrobiona_utc: new Date().toISOString(),
    jaskinia: { wersja: VER, zbudowana: BUILD.built, host: BUILD.host, dziala_jako: PLACE, plik: (location.pathname || '').split('/').pop() || '', protokol: location.protocol },
    urzadzenie: {
      okno: `${innerWidth}×${innerHeight}`, ekran: `${screen.width}×${screen.height}`, dpr: devicePixelRatio || 1, dotyk: coarse.matches, telefon: !!phone,
      przegladarka: navigator.userAgent, jezyk: navigator.language, strefa: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),
      zapis: storageOK ? (saveProblem ? 'pełny' : 'działa') : 'niedostępny',
    },
    dane: { zrzut: D.estate.generated, pokrycie: `${C.collected}/${C.expected}`, wiek_dni: Math.round(snapAgeDays() * 10) / 10 },
    ustawienia: { ...prefs },
    na_ekranie: nowContext(),
    uklady: store.spaces.map(sp => ({ nazwa: spaceName(sp), preset: sp.preset, cel: sp.purpose || '', okna: allIdsOf(sp.L).length, uklad: sp.L })),
    widoki: store.views,
    uwagi: uwagi.map(u => ({ ...u, czas: isoLocal(u.t) })),
    dziennik: jlog.map(e => ({ ...e, czas: isoLocal(e.t) })),
    notatki: withNotes ? store.notes : { liczba: notesInfo.length, znakow: notesInfo.reduce((a, n) => a + (n.text || '').length, 0), tresc: 'pominięta (Ustawienia → Uwagi i paczka → dołącz treść notatek)' },
    licznik: { zapisy: store.saved.length, kosz: store.trash.length, kopie: readBackups().length },
  };
}
function allIdsOf(L0) { return [...leafIds(L0.tree), ...arr(L0.floats).map(f => f.id)]; }
/* the same, short, as text to paste straight into a chat (on a phone that is one copy and one paste) */
function packageText(maxLog = 160) {
  const p = packageData(false), n = p.na_ekranie, s0 = p.ustawienia;
  const lines = [];
  lines.push(`# Paczka z Jaskini (${p.jaskinia.wersja}, ${p.zrobiona.slice(0, 16)}, ${t(PLACE_NAME[PLACE])})`);
  lines.push(`Urządzenie: okno ${p.urzadzenie.okno}, ekran ${p.urzadzenie.ekran}, dpr ${p.urzadzenie.dpr}, ${p.urzadzenie.dotyk ? 'dotyk' : 'mysz'}${p.urzadzenie.telefon ? ', tryb telefonu' : ''}. ${p.urzadzenie.przegladarka}`);
  lines.push(`Dane: zrzut ${p.dane.zrzut} (${p.dane.wiek_dni} dnia), pokrycie ${p.dane.pokrycie}. Zapis w przeglądarce: ${p.urzadzenie.zapis}.`);
  lines.push(`Na ekranie: układ „${n.u}”${n.okno ? `, okno „${n.okno}”` : ''}${n.projekt ? `, zaznaczony ${n.projekt}` : ''}${n.max ? `, na całym ekranie „${n.max}”` : ''}.`);
  lines.push(`Ustawienia: motyw ${s0.theme}, kolory ${s0.life}, rozmiar ${s0.density}, język ${s0.lang}, kółko ${s0.wheel}, gry ${s0.games}.`);
  lines.push(`Układy: ${p.uklady.map(u => `${u.nazwa} (${u.okna})`).join(', ')}.`);
  lines.push('');
  lines.push(`## Uwagi (${p.uwagi.length})`);
  if (!p.uwagi.length) lines.push('brak');
  for (const u of p.uwagi) lines.push(`- ${u.czas.slice(0, 19)} · ${[u.u, u.okno, u.projekt].filter(Boolean).join(' / ')} · ${u.ekran}${u.telefon ? ' telefon' : ''}: ${u.text.replace(/\s*\n\s*/g, ' ⏎ ')}`);
  lines.push('');
  const tail = p.dziennik.slice(-maxLog);
  lines.push(`## Dziennik (ostatnie ${tail.length} z ${p.dziennik.length})`);
  for (const e of tail) lines.push(`${e.czas.slice(0, 19)}${e.n ? ` (×${e.n})` : ''} [${e.u || ''}] ${e.a}`);
  return lines.join('\n');
}
function offerPackage(out, withNotes) {
  const stamp = isoLocal(Date.now()).slice(0, 16).replace(/[: ]/g, '-');
  const txt = JSON.stringify(packageData(withNotes), null, 1), name = `jaskinia-paczka-${stamp}.json`;
  logEv(t('paczka dla Claude\'a'));
  saveFile(name, txt).then(ok => {
    if (ok) { fill(out, h('p', { class: 'set-note', text: t('Gotowe: {0}. Wyślij ten plik Claude\'owi (albo GPT) razem z nagraniem.', name) })); return; }
    const ta = h('textarea', { class: 'jk-in set-ta', readonly: true, rows: 8, 'aria-label': t('Paczka do skopiowania') });
    ta.value = txt;
    fill(out, h('p', { class: 'set-note', text: t('Ta przeglądarka nie pozwala tu zapisać pliku. Skopiuj paczkę i wklej ją do rozmowy (albo zapisz jako plik .json).') }), ta,
      h('button', { class: 'btn', type: 'button', onclick: () => B.copyText(txt, t('Skopiowane')) }, icon('copy', 14), t('Kopiuj')));
  });
}

/* ---------- the settings section ---------- */
SET_SECTIONS.uwagi = (c, draw) => {
  const out = h('div', { class: 'set-out' });
  const withNotes = h('input', { type: 'checkbox', id: 'uw-notes' });
  const list = uwagi.slice().reverse();
  return h('div', { class: 'set-body' },
    setCard(t('To mnie uwiera'),
      h('p', { class: 'set-note', text: t('Szybka uwaga przypięta do chwili: zapisuje godzinę co do sekundy, układ, okno, projekt i rozmiar ekranu. Przycisk z chorągiewką u góry albo Ctrl+. (na telefonie: menu pod logo).') }),
      h('div', { class: 'set-acts' }, h('button', { class: 'btn', type: 'button', onclick: e => uwagaPop(e.currentTarget) }, icon('flag', 14), t('Nowa uwaga'))),
      list.length ? h('ul', { class: 'set-list' }, list.map(u => h('li', null,
        h('div', { class: 'sl-main' }, h('b', { text: u.text }), h('small', { text: [isoLocal(u.t).slice(0, 19), u.u, u.okno, u.projekt, u.ekran + (u.telefon ? ' · ' + t('telefon') : ''), u.v].filter(Boolean).join(' · ') })),
        h('div', { class: 'sl-acts' },
          ibtn('copy', t('Kopiuj'), () => B.copyText(u.text, t('Skopiowane'))),
          ibtn('trash', t('Usuń uwagę'), () => {
            const i = uwagi.indexOf(u); if (i < 0) return;
            uwagi.splice(i, 1); saveUwagi(); draw();
            jtoast(t('Uwaga usunięta.'), { label: t('Cofnij'), act: () => { uwagi.splice(i, 0, u); saveUwagi(); draw(); } });
          })))))
        : h('p', { class: 'set-note', text: t('Jeszcze żadnej uwagi.') })),
    setCard(t('Paczka dla Claude\'a'),
      h('p', { class: 'set-note', text: t('Jeden plik z wersją Jaskini, urządzeniem, ustawieniami, układami, Twoimi uwagami i dziennikiem ostatnich ruchów (z godzinami). Z nim nagranie da się dopasować do tego, co działo się w Jaskini, co do sekundy. Plik nie zawiera treści Twoich notatek, chyba że to zaznaczysz.') }),
      h('label', { class: 'set-check', for: 'uw-notes' }, withNotes, h('span', { text: t('dołącz treść notatek z okien i ze ściany') })),
      h('div', { class: 'set-acts' },
        h('button', { class: 'btn', type: 'button', onclick: () => offerPackage(out, withNotes.checked) }, icon('download', 14), t('Zrób paczkę (plik)')),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { logEv(t('paczka dla Claude\'a (tekst)')); B.copyText(packageText(), t('Skopiowane: wklej to do rozmowy')); } }, icon('copy', 14), t('Kopiuj jako tekst do rozmowy'))),
      out),
    setCard(t('Dziennik'),
      h('p', { class: 'set-note', text: t('Co działo się w Jaskini: zmiany układu, przełączanie, zaznaczanie, menu, komunikaty, błędy. Tylko w tej przeglądarce; {0} ostatnich wpisów.', LOG_MAX) }),
      jlog.length ? h('ol', { class: 'set-log' }, jlog.slice(-40).reverse().map(e => h('li', null, h('time', { text: hms(e.t) }), h('span', { text: (e.u ? '[' + e.u + '] ' : '') + e.a + (e.n ? ` ×${e.n}` : '') })))) : h('p', { class: 'set-note', text: t('Dziennik jest pusty.') }),
      jlog.length ? h('div', { class: 'set-acts' }, h('button', { class: 'btn ghost', type: 'button', onclick: e => askPop(e.currentTarget, { text: t('Wyczyścić dziennik ({0} wpisów)? Uwagi zostają.', jlog.length), ok: t('Wyczyść'), okClass: 'warn' }, () => { jlog = []; saveLog(); draw(); }) }, icon('trash', 14), t('Wyczyść dziennik'))) : null));
};
SETTINGS_SECS.splice(SETTINGS_SECS.findIndex(x => x[0] === 'dane') + 1, 0, ['uwagi', 'Uwagi i paczka', 'flag']);

/* ---------- what gets logged without anyone asking ---------- */
addEventListener('error', e => logEv(t('błąd: {0}', (e.message || '?') + (e.filename ? '' : ''))));
addEventListener('unhandledrejection', e => logEv(t('błąd: {0}', String(e.reason && e.reason.message || e.reason || '?'))));
document.addEventListener('visibilitychange', () => logEv(document.hidden ? t('karta w tle') : t('powrót do karty')));
{
  let rsz = 0;
  addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => logEv(t('rozmiar okna przeglądarki: {0}', `${innerWidth}×${innerHeight}`)), 900); });
}
addEventListener('pagehide', () => saveLog());
