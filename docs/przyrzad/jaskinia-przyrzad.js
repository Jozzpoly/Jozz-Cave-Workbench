/* Jaskinia instrument contract, v1: a drop-in for any lab or game page.
   Load it with a script tag (src="jaskinia-przyrzad.js") or paste it into an inline script. The contract: docs/przyrzad/KONTRAKT.md

   Jaskinia.hello({ name: 'MiniFeniks', version: 'kampania 04', wants: ['remark'] });   // who you are (once, at start)
   Jaskinia.state('Dzień 3, 14:20 · Ania niesie deski', { dzien: 3 });                  // what is happening now
   Jaskinia.signals({ fps: 58, zapas: 12 });                                             // numbers to draw live, a few times a second
   Jaskinia.event('Ania porzuciła zamiar: brak desek', 'uwaga');                         // something happened ('info' | 'uwaga' | 'blad')
   Jaskinia.onRemark(r => trace.push(r));      // the owner's remark from Jaskinia's flag: { text, at }
   Jaskinia.onStateRequest(() => ({ text, data }));   // optional: a fresh state for the moment of the flag
   Jaskinia.onVisible(v => paused = !v);       // optional: the window was hidden or shown again

   Opened on its own (no Jaskinia around) every call does nothing, so the lab never depends on it. Ctrl+. inside the
   page asks Jaskinia for the "To mnie uwiera" note, pinned to this lab and this second. */
(() => {
  if (window.Jaskinia) return;
  const host = window.parent !== window ? window.parent : null;
  const send = m => { if (host) try { host.postMessage({ jaskinia: 1, ...m }, '*'); } catch { /* not allowed: fine */ } };
  let hello = null, last = null, stateFn = null;
  const remarkFns = [], visFns = [];
  addEventListener('message', ev => {
    if (!host || ev.source !== host) return;           // only the page that holds this lab
    const d = ev.data;
    if (!d || d.jaskinia !== 1) return;
    if (d.type === 'hi' && hello) send({ type: 'hello', ...hello });
    else if (d.type === 'state?') { let s = last; try { if (stateFn) s = stateFn() || last; } catch { /* keep the last one */ } if (s) send({ type: 'state', text: s.text, data: s.data }); }
    else if (d.type === 'remark') for (const f of remarkFns) try { f({ text: String(d.text || ''), at: String(d.at || '') }); } catch { /* the lab's problem */ }
    else if (d.type === 'visible') for (const f of visFns) try { f(!!d.visible); } catch { /* the lab's problem */ }
  });
  addEventListener('keydown', ev => { if (host && (ev.ctrlKey || ev.metaKey) && ev.key === '.') { ev.preventDefault(); send({ type: 'flag' }); } }, true);
  window.Jaskinia = {
    active: !!host,
    hello(h) { hello = { name: String(h && h.name || ''), version: String(h && h.version || ''), wants: Array.isArray(h && h.wants) ? h.wants : [] }; send({ type: 'hello', ...hello }); },
    state(text, data) { last = { text: String(text || ''), data }; send({ type: 'state', text: last.text, data }); },
    signals(values) { send({ type: 'signals', values }); },
    event(text, level) { send({ type: 'event', text: String(text || ''), level }); },
    onRemark(fn) { remarkFns.push(fn); },
    onStateRequest(fn) { stateFn = fn; },
    onVisible(fn) { visFns.push(fn); },
  };
})();
