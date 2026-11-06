/* GPT-6 experimental Worldbench organ — isolated research branch only.
   Native Jaskinia windows, not a substitute shell. No direct ownership of game data.
   First donor: Combat Lab P10b read-only physical witness. NOT a replay/checkpoint. */
const WB_PROTOCOL = 'jozz-worldbench/v0';
const WB_LIMIT = 32000;
let wbCounter = 0;
const wbPending = new Map();
const wbActionPending = new Map();

function wbBeside(anchor, type, opts = {}) {
  if (!store || !L || !L.wins[anchor]) throw Error('Worldbench: anchor window no longer exists');
  if (!TYPES[type]) throw Error('Worldbench: unknown window type');
  const side = ['left', 'right', 'top', 'bottom'].includes(opts.side) ? opts.side : 'right';
  const share = Number.isFinite(opts.share) ? Math.max(0.15, Math.min(0.80, opts.share)) : 0.40;
  const id = newWinId();
  const added = commit('Worldbench: natywne okno obok', () => {
    L.wins[id] = { type, z: 1, pin: opts.pin || null, st: { ...(opts.st || {}) } };
    winBeside(anchor, id, side, share); // actual Jaskinia split / native float arrangement
  });
  if (!added) throw Error('Worldbench: native layout was not accepted');
  if (opts.focus !== false) { focusWin(id); if (phone) phoneSwitch(id); }
  return id;
}
// Put two ACTUAL native instrument windows beside an existing tiled leaf, atomically.
// Do not replace or restart any existing instrument; undo removes both as one layout change.
function wbLaunch(url) {
  const safe = liveSafeUrl(url);
  if (!safe) throw Error('Worldbench: expected a valid http(s)/file instrument URL');
  const base = L.focus && hasLeaf(L.tree, L.focus) ? L.focus : leafIds(L.tree)[0];
  if (!base) throw Error('Worldbench: there is no tiled anchor');
  const lab = newWinId(), microscope = newWinId();
  const added = commit('Worldbench: para instrument + mikroskop', () => {
    L.wins[lab] = { type: 'przyrzad', z: 1, pin: null, st: {url: safe, title: 'Combat Lab / próbka'} };
    winBeside(base, lab, 'right', 0.58);
    L.wins[microscope] = { type: 'gpt6_mikroskop', z: 1, pin: null, st: {source: lab} };
    winBeside(lab, microscope, 'right', 0.37);
  });
  if (!added) throw Error('Worldbench: native pair could not be composed');
  focusWin(lab);
  if (phone) phoneSwitch(lab);
  return {lab, microscope};
}
// Alternative to cramming two new instruments into the existing crowded workspace.
// This is a NEW explicitly named experiment session; it does NOT pretend to move or
// teleport an existing running lab into another Jaskinia space.
function wbLaunchFocus(url) {
  const safe=liveSafeUrl(url);
  if(!safe) throw Error('Worldbench: expected actual lab URL');
  const from=store.cur;
  const lab=newWinId(), microscope=newWinId();
  const layout={
    tree:row(phone ? 0.5 : 0.71,leaf(lab),leaf(microscope)),
    wins:{
      [lab]:{type:'przyrzad',z:1,pin:null,st:{url:safe,title:'Combat Lab · fizyczny świat'}},
      [microscope]:{type:'gpt6_mikroskop',z:1,pin:null,st:{source:lab}}
    },
    floats:[],max:null,focus:lab,stats:{}
  };
  const sp=addSpace('Combat Lab · Badanie',layout,null,from,
    'Izolowana sesja eksperymentalna: żywy świat + natywny mikroskop. Sam świat ma własne niezależne życie.');
  return {lab,microscope,spaceId:sp.id,from,independentRuntime:true};
}

function wbExpectedOrigin(e) {
  if (e.url === DEMO_URL) return location.origin === 'null' ? '*' : location.origin;
  try {
    const u = new URL(e.url, location.href);
    return ['http:', 'https:'].includes(u.protocol) ? u.origin : '*';
  } catch { return '*'; }
}
function wbMeta(e) {
  return {hostObservedAt: new Date().toISOString(), hostWindowId: e.id,
    address: e.url, hello: e.hello ? {...e.hello} : null,
    lastReportedState: e.state ? {text:e.state.text,data:e.state.data,at:new Date(e.state.t).toISOString()} : null,
    lastEvents: e.evs.slice(-12).map(v=>({text:v.text,level:v.level,at:new Date(v.t).toISOString()})),
    signals: Object.fromEntries([...e.sigs].map(([k,v])=>[k,{sampleCount:v.v.length,
      latest:v.v.length ? v.v[v.v.length - 1] : null}])),
    sourceClaimsAreNotIndependentVerification: true};
}
function wbCapture(id) {
  const e = LIVE.get(id);
  if (!e || !e.frame?.contentWindow || !L.wins[id])
    return Promise.reject(Error('Worldbench: source window closed'));
  const host = wbMeta(e);
  if (!e.hello?.wants.includes('evidence'))
    return Promise.resolve({kind:'host-telemetry-only',host,source:null,
      limitation:'This lab did not opt into the physical witness protocol.'});
  const requestId = 'wb-' + (++wbCounter) + '-' + Math.random().toString(36).slice(2, 12);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      wbPending.delete(requestId);
      resolve({kind:'witness-timeout',host,source:null,
        limitation:'No verified protocol reply from the specific instrument frame.'});
    }, 1600);
    wbPending.set(requestId, {e, resolve, timer, host});
    try {
      // A WASM-backed module may start listening AFTER the iframe load "hi".
      // Re-handshake in the same task before requesting evidence; messages are ordered.
      const origin=wbExpectedOrigin(e);
      e.frame.contentWindow.postMessage({jaskinia:1,type:'hi',v:1}, origin);
      e.frame.contentWindow.postMessage({protocol:WB_PROTOCOL,type:'capture?',id:requestId}, origin);
    }
    catch { clearTimeout(timer); wbPending.delete(requestId);
      resolve({kind:'witness-message-failed',host,source:null}); }
  });
}
addEventListener('message', event => {
  const d = event.data;
  if (!d || d.protocol !== WB_PROTOCOL || d.type !== 'capture' || typeof d.id !== 'string') return;
  const pending = wbPending.get(d.id);
  if (!pending || liveOf(event.source) !== pending.e) return; // source-bound request, no broadcast trust
  const expectedOrigin=wbExpectedOrigin(pending.e);
  if (expectedOrigin !== '*' && event.origin !== expectedOrigin) return; // navigation cannot silently change provenance
  wbPending.delete(d.id);
  clearTimeout(pending.timer);
  if (d.ok !== true || !d.record || typeof d.record !== 'object') {
    pending.resolve({kind:'witness-rejected',host:pending.host,source:null,
      limitation:String(d.error || 'source declined').slice(0,180)});
    return;
  }
  try {
    const raw = JSON.stringify(d.record);
    if (raw.length > WB_LIMIT) throw Error('over size limit');
    const source = JSON.parse(raw);
    if (source.contract !== WB_PROTOCOL || source.restorable !== false ||
        source.kind !== 'read-only-physical-witness') throw Error('invalid provenance shape');
    pending.resolve({kind:'source-reported-physical-witness',host:pending.host,source,
      limitation:'Source self-report, not solver snapshot, not replayable, not Owner acceptance.'});
  } catch (err) {
    pending.resolve({kind:'invalid-witness',host:pending.host,source:null,
      limitation:String(err.message).slice(0,180)});
  }
});
// Narrow, per-lab authoring route: only physical P10b actions from owner-granted lab UI.
// The host cannot grant permission, directly mutate Rapier or claim solver authority.
function wbAction(id, action, expected) {
  const e = LIVE.get(id);
  if (!e || !e.frame?.contentWindow || !L.wins[id])
    return Promise.reject(Error('Worldbench: source window closed'));
  if (!e.hello?.wants.includes('evidence'))
    return Promise.reject(Error('Worldbench: not an action-capable source'));
  if (!['p10b.aperture.widen','p10b.aperture.narrow'].includes(action))
    return Promise.reject(Error('Worldbench: unsupported action'));
  if (!expected || typeof expected.runtimeId !== 'string' ||
      expected.runtimeId.length > 100 || !Number.isFinite(expected.aperture) ||
      !Number.isSafeInteger(expected.edits))
    return Promise.reject(Error('Worldbench: get exact live source witness first'));
  const idReq = 'wba-' + (++wbCounter) + '-' + Math.random().toString(36).slice(2,12);
  return new Promise(resolve => {
    const timer = setTimeout(()=>{
      wbActionPending.delete(idReq);
      resolve({kind:'action-timeout',ok:false,error:'No source action receipt; do not retry blindly.'});
    },1600);
    wbActionPending.set(idReq,{e,resolve,timer,action,expected});
    try {
      const origin=wbExpectedOrigin(e);
      e.frame.contentWindow.postMessage({jaskinia:1,type:'hi',v:1},origin);
      e.frame.contentWindow.postMessage({protocol:WB_PROTOCOL,type:'action?',
        id:idReq,action,expected},origin);
    }catch(err){
      clearTimeout(timer);wbActionPending.delete(idReq);
      resolve({kind:'action-send-failed',ok:false,error:String(err.message||err).slice(0,180)});
    }
  });
}
addEventListener('message',event=>{
  const d=event.data;
  if (!d || d.protocol!==WB_PROTOCOL || d.type!=='action' || typeof d.id!=='string') return;
  const pending=wbActionPending.get(d.id);
  if (!pending || liveOf(event.source)!==pending.e) return;
  const origin=wbExpectedOrigin(pending.e);
  if (origin!=='*' && event.origin!==origin) return;
  wbActionPending.delete(d.id);
  clearTimeout(pending.timer);
  if(d.ok!==true) {
    pending.resolve({kind:'source-refused-action',ok:false,
      error:String(d.error||'source refused').slice(0,180)});
    return;
  }
  try {
    const raw=JSON.stringify(d.record);
    if(raw.length>WB_LIMIT) throw Error('source record over size limit');
    const record=JSON.parse(raw);
    if(record.contract!==WB_PROTOCOL || record.restorable!==false ||
      record.kind!=='read-only-physical-witness' || 
      record.runtimeId!==pending.expected.runtimeId ||
      record.simulation?.materialEvents?.edits!==pending.expected.edits+1 ||
      !Number.isFinite(d.result?.after) ||
      record.simulation?.aperture?.width!==d.result.after ||
      d.result.action!==pending.action ||
      d.result.before!==pending.expected.aperture)
      throw Error('source receipt inconsistent with expected before/after');
    pending.resolve({kind:'source-reported-physical-edit',ok:true,action:pending.action,
      record,result:d.result,
      limitation:'Source-reported effect; not independent physics verification or rollback proof.'});
  }catch(err){pending.resolve({kind:'invalid-action-receipt',ok:false,error:String(err.message||err).slice(0,180)});}
});

JASKINIA_API.ext.worldbench = Object.freeze({
  v: 0, openBeside: wbBeside, launch: wbLaunch, launchFocus: wbLaunchFocus, capture: wbCapture, action: wbAction,
});

function wbMicroscope(box, c) {
  const sheet = document.createElement('section');
  sheet.className = 'gpt6-wb';
  const style = document.createElement('style');
  style.textContent = `
  .gpt6-wb{height:100%;box-sizing:border-box;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:9px;font:12px/1.45 system-ui,sans-serif;color:var(--fg,inherit)}
  .gpt6-wb h3{margin:0;font-size:15px}.gpt6-wb p{margin:0;opacity:.75}
  .gpt6-wb input,.gpt6-wb select,.gpt6-wb textarea{box-sizing:border-box;width:100%;min-width:0;padding:7px;border:1px solid #667382;border-radius:5px;background:#172432;color:#eef4fa}
  .gpt6-wb button{font:inherit;border:1px solid #667382;border-radius:5px;padding:7px;background:#25465d;color:#fff;cursor:pointer}
  .gpt6-wb .wb-row{display:flex;gap:5px;flex-wrap:wrap}.gpt6-wb .wb-row button{flex:1;min-width:90px}
  .gpt6-wb pre{white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;background:#101a25;color:#d9e6ed;padding:9px;border-radius:5px}
  .gpt6-wb strong{font-size:12px}.gpt6-wb .wb-warning{border-left:3px solid #dfaa5c;padding-left:7px}
  .gpt6-wb .wb-context{font-size:12px;line-height:1.5;padding:8px;border:1px solid #476b76;
    border-radius:6px;background:#142b34;white-space:pre-line}
  .gpt6-wb .wb-context b{color:#9de6ca}`;
  sheet.append(style);
  const h = document.createElement('h3'); h.textContent = 'Worldbench · żywy mikroskop v0'; sheet.append(h);
  const explanation=document.createElement('p');
  explanation.textContent='Natywny warsztat Jaskini. Obserwuje rzeczywiste przyrządy; nie tworzy kopii ich świata.';
  sheet.append(explanation);
  const input=document.createElement('input');input.placeholder='URL izolowanego buildu Combat Lab P10b';
  input.autocomplete='off';input.spellcheck=false;sheet.append(input);
  const open=document.createElement('button');open.textContent='Otwórz lab w natywnym oknie obok';sheet.append(open);
  const focusBtn=document.createElement('button');
  focusBtn.textContent='Nowa pracownia: duży świat + mikroskop';
  sheet.append(focusBtn);
  focusBtn.onclick=()=>{
    try{
      const url=liveSafeUrl(input.value);
      if(!url)throw Error('Podaj adres prawdziwego uruchamialnego Labu');
      wbLaunchFocus(url); // genuinely new space and NEW runtime, never claims same instance
    }catch(err){const n=sheet.querySelector('.wb-warning');if(n)n.textContent=String(err.message||err);}
  };
  const select=document.createElement('select');select.setAttribute('aria-label','Działający przyrząd');sheet.append(select);
  const context=document.createElement('div');
  context.className='wb-context';context.textContent='Czekam na stan zaznaczonego ciała…';
  sheet.append(context);
  const row=document.createElement('div');row.className='wb-row';sheet.append(row);
  const capture=document.createElement('button');capture.textContent='Uchwyć moment';
  const mark=document.createElement('button');mark.textContent='Uwaga do przyrządu';
  const exportBtn=document.createElement('button');exportBtn.textContent='Eksportuj odczyty';
  row.append(capture,mark,exportBtn);
  const edits=document.createElement('div');edits.className='wb-row';
  const widen=document.createElement('button');widen.textContent='Poszerz fizyczną szczelinę';
  const narrow=document.createElement('button');narrow.textContent='Cofnij poszerzenie';
  widen.disabled=true;narrow.disabled=true;
  edits.append(widen,narrow);sheet.append(edits);
  const status=document.createElement('p');status.className='wb-warning';
  status.textContent='Odczyty są deklaracjami źródła; brak odtwarzania, gwarancji identycznego replay i trwałości po zamknięciu.';sheet.append(status);
  const out=document.createElement('pre');out.textContent='Wybierz działający przyrząd i pobierz odczyt.';sheet.append(out);
  const observations=[];
  let lastWitness=null,lastSourceId=null;
  const current=()=>LIVE.get(select.value);
  const fmt=(x,unit='')=>Number.isFinite(x)?x.toFixed(2)+unit:'?';
  const refreshContext=()=>{
    const e=current();
    if(!e?.hello){context.textContent='Wybierz żywy Lab. Prawda o świecie należy do jego fizyki.';return;}
    const d=e.state?.data;
    const a=d?.selectedActor;
    if(!a){
      context.textContent='Przyrząd: '+liveName(e)+'\n'+
        (e.state?.text||'Nie zgłosił jeszcze fizycznego kontekstu.');
      return;
    }
    context.textContent=
      'AKTYWNE CIAŁO · '+String(a.kind||'?')+' #'+a.id+
      '\nPozycja: '+fmt(a.x,' m')+' / '+fmt(a.y,' m')+
      '  ·  prędkość: '+fmt(Math.hypot(a.vx,a.vy),' m/s')+
      '\nMasa: '+fmt(a.mass,' kg')+'  ·  postawa: '+String(a.stance||'brak')+
      '\nRzeczywiste chwyty: '+(Number.isInteger(d.selectedGripCount)?d.selectedGripCount:'?')+
      '  ·  szczelina: '+fmt(d.aperture,' m')+
      '\nEdycje źródła: '+(Number.isInteger(d.worldEdits)?d.worldEdits:'?')+
      '  ·  krok solvera: '+(Number.isInteger(d.tick)?d.tick:'?')+
      '\nTo odczyt źródła, nie rekonstrukcja świata.';
  };
  const controls=()=>{
    const capable=lastWitness?.capabilities?.operations||[];
    widen.disabled=!lastWitness||lastSourceId!==select.value||!capable.includes('p10b.aperture.widen');
    narrow.disabled=!lastWitness||lastSourceId!==select.value||!capable.includes('p10b.aperture.narrow');
  };
  select.onchange=()=>{lastWitness=null;lastSourceId=null;controls();refreshContext();};
  const change=async action=>{
    const e=current();
    if(!e||!lastWitness||lastSourceId!==e.id){
      status.textContent='Najpierw uchwyć ten sam żywy świat.';return;
    }
    const t=lastWitness.simulation;
    const expected={runtimeId:lastWitness.runtimeId,
      aperture:t.aperture.width,edits:t.materialEvents.edits};
    widen.disabled=true;narrow.disabled=true;
    status.textContent='Źródło samodzielnie sprawdza uprawnienie i fizyczną zmianę…';
    try {
      const receipt=await wbAction(e.id,action,expected);
      if(!receipt.ok){status.textContent=receipt.kind+': '+receipt.error+
        ' · Na pauzie w Labie włącz „Zezwól na edycję z Jaskini” i pobierz świeży odczyt.';return;}
      observations.push({kind:receipt.kind,host:wbMeta(e),source:receipt.record,
        result:receipt.result,limitation:receipt.limitation});
      if(observations.length>30)observations.shift();
      lastWitness=receipt.record;
      lastSourceId=e.id;
      status.textContent='Źródło potwierdziło rzeczywistą zmianę szczeliny: '+
        receipt.result.before+' → '+receipt.result.after+' m. Nie jest to solver checkpoint.';
      out.textContent=JSON.stringify({receipt:receipt.result,
        tick:receipt.record.simulation.tick,runtimeId:receipt.record.runtimeId,
        capability:receipt.record.capabilities},null,2);
    }catch(err){status.textContent='Błąd: '+String(err.message||err);}
    finally{controls();}
  };
  widen.onclick=()=>change('p10b.aperture.widen');
  narrow.onclick=()=>change('p10b.aperture.narrow');
  const options=()=> {
    const chosen=select.value || c.win.st?.source || '';
    const here=liveHere().filter(e=>e.id!==c.id);
    select.replaceChildren();
    if (!here.length) { const o=document.createElement('option');o.textContent='Brak działających przyrządów';o.value='';select.append(o);return; }
    for(const e of here) {const o=document.createElement('option');o.value=e.id;o.textContent=liveName(e);select.append(o);}
    if(here.some(e=>e.id===chosen))select.value=chosen;
    else select.value=here[0].id;
    controls();refreshContext();
  };
  let refreshTimer=0;
  const subscriber=()=>{refreshContext();clearTimeout(refreshTimer);refreshTimer=setTimeout(options,200);};
  liveSubs.add(subscriber);
  c.onDispose(()=>{clearTimeout(refreshTimer);liveSubs.delete(subscriber);});
  options();
  open.onclick=()=>{
    try {
      const url=liveSafeUrl(input.value);
      if(!url)throw Error('Podaj prawdziwy URL zbudowanego laboratorium');
      const id=wbBeside(c.id,'przyrzad',{side:'left',share:.65,focus:true,
        st:{url,title:'Combat Lab · eksperyment'}});
      c.win.st.source=id;c.save();options();
      status.textContent='Działający przyrząd otwarto w prawdziwym oknie Jaskini. Zapis świata nadal należy do niego.';
    }catch(err){status.textContent=String(err.message||err);}
  };
  capture.onclick=async()=>{
    const e=current(); if(!e){status.textContent='Wybierz działające okno.';return;}
    capture.disabled=true;status.textContent='Pobieranie aktualnego odczytu — bez zatrzymywania symulacji…';
    try {
      const r=await wbCapture(e.id);
      observations.push(r);
      if(observations.length>30)observations.shift();
      lastWitness=r.kind==='source-reported-physical-witness'?r.source:null;
      lastSourceId=e.id;
      controls();
      status.textContent=r.kind+' · '+observations.length+' odczyt(y). Weryfikacja niezależna: nie.';
      const sim=r.source?.simulation;
      const short=sim ? {tick:sim.tick,fixture:sim.fixture,actors:sim.actors,
        cargo:sim.cargo,grips:sim.grips,aperture:sim.aperture,paused:r.source.paused,
        runtimeId:r.source.runtimeId} : {state:r.host.lastReportedState,limitation:r.limitation};
      out.textContent=JSON.stringify(short,null,2).slice(0,12000);
      const prior=observations.at(-2)?.source;
      if(sim && prior?.runtimeId && prior.runtimeId===r.source.runtimeId) {
        const before=prior.simulation?.actors?.find(a=>a.id===sim.selected);
        const after=sim.actors?.find(a=>a.id===sim.selected);
        if(before&&after)out.textContent+='\n\nTen sam runtime / wybrane ciało Δ: '+
          JSON.stringify({dx:+(after.x-before.x).toFixed(4),dy:+(after.y-before.y).toFixed(4),
            dticks:sim.tick-prior.simulation.tick})+'\nOpis różnicy, nie kontrolowane A/B.';
      }
    }catch(err){status.textContent='Odczyt nie powiódł się: '+String(err.message||err);}
    finally{capture.disabled=false;}
  };
  mark.onclick=()=>{const e=current();if(!e){status.textContent='Brak przyrządu';return;}uwagaPop(null,e.id);};
  exportBtn.onclick=()=>{
    if(!observations.length){status.textContent='Najpierw pobierz choć jeden odczyt.';return;}
    const data={format:'gpt6-worldbench-observations/v0',exportedAt:new Date().toISOString(),
      warning:'NOT SOLVER SNAPSHOT; NOT REPLAY; SOURCE-REPORTED AND LIMITED',observations};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download='worldbench-observations-'+Date.now()+'.json';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  box.append(sheet);
}
JASKINIA_API.ext.type('gpt6_mikroskop',{
  group:'studio',glyph:'t_przyrzad',name:'Worldbench · mikroskop (GPT-6)',desc:'Natywny obserwator działających przyrządów. Eksperyment.',
  fill:true,noZoom:true,live:true,liveKey:()=>['gpt6-worldbench-v0'],render:wbMicroscope
});
