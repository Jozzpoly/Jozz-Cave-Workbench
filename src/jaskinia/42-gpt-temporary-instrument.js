/* EXPERIMENT ONLY — GPT, 2026-10-16. Not a product feature or an agent authorization surface.
   Loaded after 40-types.js, before 50-shell.js on the isolated experimental branch. */
(() => {
  const PROTOCOL = 'jaskinia-instrument/1';
  const LAB_PATH = 'experiments/gpt-temporary-connected-instruments-2026-10-16/adapter.html';
  const labWindows = new Map();
  const randomId = () => [...crypto.getRandomValues(new Uint8Array(24))].map(x => x.toString(16).padStart(2,'0')).join('');
  const css = `.gpti{display:flex;flex-direction:column;gap:9px;padding:12px;height:100%;box-sizing:border-box;font:13px system-ui,sans-serif;color:var(--fg,inherit)}
.gpti .gpti-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.gpti label{font-weight:650}
.gpti input{flex:1;min-width:160px;max-width:100%;padding:6px 8px;border-radius:5px;background:var(--bg,transparent);color:inherit;border:1px solid #7777}
.gpti button{padding:7px 10px;border:1px solid #7777;border-radius:5px;background:var(--surface,#343a43);color:inherit;cursor:pointer}
.gpti button[aria-pressed="true"]{outline:2px solid #6bbdb3}.gpti .gpti-info{opacity:.8;font-size:12px;line-height:1.45}
.gpti .gpti-msg{border:1px solid #7776;padding:7px;min-height:34px;white-space:pre-wrap;overflow-wrap:anywhere}
.gpti iframe{display:block;flex:1;min-height:130px;width:100%;border:1px solid #7777;background:#0b131e;border-radius:5px}
.gpti .gpti-history{max-height:70px;overflow:auto;font:11px ui-monospace,monospace;opacity:.9}`;
  function make(tag, text, cls) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function fixtureURL() {
    const base = location.pathname.includes('/dist/') ? '../' : './';
    return new URL(base + LAB_PATH, location.href.startsWith('about:') ? 'https://jaskinia.invalid/dist/jaskinia-web.html' : location.href).href;
  }
  function canonicalURL(raw) {
    const u = new URL(raw, location.href);
    if (!['https:', 'http:'].includes(u.protocol)) throw Error('Tylko HTTP(S).');
    if (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname))
      throw Error('HTTP tylko dla lokalnego testu. Zdalnie użyj HTTPS.');
    if (u.username || u.password) throw Error('Adres nie może zawierać danych logowania.');
    return u.href;
  }
  function render(box, c) {
    const state = {
      id: c.id, linked: false, ready: false, pending: null, seq: 0,
      currentProject: null, lastAck: null, url: '', history: []
    };
    labWindows.set(c.id, state);
    const root = make('section', null, 'gpti');
    const style = make('style', css);
    const hint = make('div', 'Tymczasowy instrument GPT • oddzielna ramka, jawny handshake i ACK. Bez dostępu do prywatnej pamięci Jaskini.', 'gpti-info');
    const urlRow = make('div', null, 'gpti-row');
    const urlLabel = make('label', 'Adres instrumentu:');
    const input = make('input');
    input.type = 'url'; input.value = c.win.st.url || fixtureURL();
    input.setAttribute('aria-label', 'Adres instrumentu');
    const load = make('button', 'Załaduj instrument');
    const ctrl = make('div', null, 'gpti-row');
    const link = make('button', 'Połącz z wyborem projektu');
    link.setAttribute('aria-pressed', 'false');
    const one = make('button', 'Wyślij aktualny wybór');
    const ack = make('div', 'Nie połączono. Instrument nie dostał jeszcze żadnego polecenia.', 'gpti-msg');
    ack.setAttribute('role', 'status');
    const history = make('div', '', 'gpti-history');
    const frame = make('iframe');
    frame.title = 'GPT eksperymentalny instrument';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    urlRow.append(urlLabel, input, load);
    ctrl.append(link, one);
    root.append(style, hint, urlRow, ctrl, ack, history, frame);
    box.append(root);
    const channel = randomId();
    const nonce = randomId();
    const timers = new Set();
    let closed = false;
    function addHistory(tx) {
      state.history.push(tx);
      if (state.history.length > 8) state.history.shift();
      history.textContent = state.history.join(' | ');
    }
    function display(msg) { ack.textContent = msg; }
    function send(kind, payload) {
      if (closed || !frame.contentWindow) return;
      frame.contentWindow.postMessage({ protocol: PROTOCOL, channel, nonce, kind, ...payload }, '*');
    }
    function choose(name) {
      // This experiment is permitted to announce PUBLIC project names only.
      // A full private Jaskinia contains nonpublic projects: never leak their identity
      // to a remotely supplied iframe, even when its user has enabled linking.
      if (typeof R === 'undefined' || !R[name] || R[name].private !== false) {
        addHistory('Zatrzymano wybór prywatny lub nieznany');
        display('NIE WYSŁANO: projekt prywatny lub o nieznanej widoczności.');
        return;
      }
      if (!state.ready) { display('NIE WYKONANO: instrument nie potwierdził gotowości.'); return; }
      if (state.pending) { // Previous action may have happened. Never pretend to cancel it.
        clearTimeout(state.pending.timer);
        timers.delete(state.pending.timer);
        addHistory(`? poprzednie #${state.pending.seq}: wynik nieznany`);
      }
      const seq = ++state.seq;
      state.pending = { seq, name, timer: null };
      state.currentProject = name;
      display(`WYSŁANE #${seq}: ${name} · oczekiwanie na potwierdzenie (nie sukces)`);
      send('set-project', { seq, project: name });
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (state.pending?.seq !== seq) return;
        state.pending = null;
        addHistory(`? #${seq} ${name}: timeout`);
        display(`NIEPEWNE #${seq}: brak ACK. Nie ponawiam automatycznie.`);
      }, 1700);
      state.pending.timer = timer;
      timers.add(timer);
    }
    function onMessage(e) {
      const m = e.data;
      if (closed || e.source !== frame.contentWindow || !m || typeof m !== 'object' ||
          m.protocol !== PROTOCOL || m.channel !== channel || m.nonce !== nonce) return;
      if (m.kind === 'ready') {
        state.ready = true;
        display('Instrument READY (deklaracja ramki). Można przesyłać wybór projektu.');
        if (state.linked) choose(c.selName());
      } else if (m.kind === 'ack' && state.pending && m.seq === state.pending.seq && m.project === state.pending.name && m.applied === true) {
        const p = state.pending;
        clearTimeout(p.timer); timers.delete(p.timer);
        state.pending = null; state.lastAck = { seq: p.seq, project: p.name };
        addHistory(`ACK #${p.seq} ${p.name}`);
        display(`ACK ramki #${p.seq}: ${p.name}. To nie jest niezależny dowód efektu w zewnętrznej aplikacji.`);
      } else if (m.kind === 'ack') {
        addHistory('Odrzucono przestarzały lub niezgodny ACK');
      }
    }
    window.addEventListener('message', onMessage);
    c.onSel(name => { if (state.linked) choose(name); });
    // A hidden workspace is still alive in Jaskinia, but project selections made
    // in OTHER workspaces do not reach its c.onSel callback. Catch up upon return.
    // Observe only this window's hidden attribute; no global poll or shell patch.
    const hostWindow = box.closest('.win');
    const visibilityObserver = hostWindow ? new MutationObserver(() => {
      if (closed || hostWindow.hidden || !state.linked) return;
      const selected = c.selName();
      if (state.lastAck?.project !== selected &&
          (!state.pending || state.pending.name !== selected)) choose(selected);
    }) : null;
    visibilityObserver?.observe(hostWindow, { attributes: true, attributeFilter: ['hidden'] });
    c.onDispose(() => visibilityObserver?.disconnect());
    frame.addEventListener('load', () => {
      state.ready = false;
      if (state.pending) { clearTimeout(state.pending.timer); timers.delete(state.pending.timer); state.pending = null; }
      display('Załadowano dokument; trwa handshake. Nie utożsamiaj load z READY.');
      send('hello');
    });
    load.addEventListener('click', () => {
      try {
        const href = canonicalURL(input.value);
        state.url = href;
        c.win.st.url = href;
        c.save();
        state.ready = false;
        frame.src = href;
      } catch (err) { display(`Odrzucono adres: ${err.message}`); }
    });
    link.addEventListener('click', () => {
      state.linked = !state.linked;
      link.setAttribute('aria-pressed', String(state.linked));
      link.textContent = state.linked ? 'Rozłącz wybór projektu' : 'Połącz z wyborem projektu';
      if (state.linked) choose(c.selName());
      else display('Rozłączono. Jaskinia nadal działa, ramka nie otrzymuje nowych wyborów.');
    });
    one.addEventListener('click', () => choose(c.selName()));
    c.onDispose(() => {
      closed = true;
      window.removeEventListener('message', onMessage);
      for (const timer of timers) clearTimeout(timer);
      labWindows.delete(c.id);
    });
    // Do not auto-load external remote pages. The user must explicitly click Load.
  }
  TYPES.gpt_instrument_temp = {
    key: 'gpt_instrument_temp', group: 'misc', name: 'Instrument GPT — eksperyment',
    glyph: 't_dane', fill: true, noZoom: true,
    desc: 'Tymczasowy adapter iframe + jawny ACK; nie jest jeszcze Medium ani trwałą współpracą.',
    render,
  };
  // Read-only test observation. Not an authorized action API and not a stable public interface.
  window.__JASK_GPT_TEMP = { list: () => [...labWindows.values()].map(s => ({
    id: s.id, ready: s.ready, linked: s.linked, pending: s.pending?.seq ?? null,
    currentProject: s.currentProject, lastAck: s.lastAck, history: [...s.history]
  })) };
})();