/* Studio R2 — native Jaskinia authoring/source and living-world views.
   The authored frame sequence and the active simulation never share a clock.
   Experimental, on an isolated stacked branch. */
(() => {
  'use strict';
  const API=window.Jaskinia?.ext;
  if(!API?.type||!API?.open)return;
  const M=StudioR2Model;
  const KEY='jaskinia-studio-r2:source:1';
  let warning='',blocked=false;
  const subscribers=new Set(),viewers=new Set();
  function load() {
    try {
      const raw=localStorage.getItem(KEY);
      if(!raw)return M.sample();
      const parsed=JSON.parse(raw);
      if(!M.valid(parsed))throw Error('Nieznany format');
      return M.clone(parsed);
    } catch(e) {
      blocked=true;
      warning='Poprzedni zapis jest nieczytelny. Nie nadpisuję go. Pobierz JSON przed dalszą pracą.';
      return M.sample();
    }
  }
  const H=M.history(load()), sim=M.world();
  function state(){return {document:H.get(),history:H.info(),warning};}
  function emit(){const s=state();for(const fn of [...subscribers]){try{fn(s);}catch(e){console.error(e);}}}
  function save() {
    if(blocked)return;
    try{localStorage.setItem(KEY,JSON.stringify(H.get()));}
    catch(e){blocked=true;warning='Zapis lokalny nie działa. Wyeksportuj JSON, zanim zamkniesz program.';}
  }
  const mutate=fn=>{const changed=H.change(fn);if(changed){save();emit();}return changed;};
  const undo=()=>{if(H.undo()){save();emit();}};
  const redo=()=>{if(H.redo()){save();emit();}};
  function replace(d){if(!M.valid(d))throw Error('To nie jest dokument Studio R2');if(H.replace(d)){save();emit();}}
  function subscribe(fn){subscribers.add(fn);fn(state());return()=>subscribers.delete(fn);}

  // Other tabs can author the same material. An external write must never be
  // silently overwritten by this tab's older in-memory snapshot.
  const storageListener=e=>{
    if(e.key!==KEY)return;
    blocked=true;
    warning='Ten sam dokument zmieniono w innej karcie. Nie nadpisuję obcej pracy. Wyeksportuj swój JSON.';
    emit();
  };
  window.addEventListener('storage',storageListener);
  // Lazy execution: a dormant lab must not animate forever just because Jaskinia loaded it.
  // Source and world state survive closing the view; simulation time deliberately pauses
  // while nobody observes this isolated research world (not a game-server policy).
  let last=0,raf=0;
  function watch(fn){
    viewers.add(fn);fn(sim.snap());
    if(!raf){last=performance.now();raf=requestAnimationFrame(step);}
    return ()=>{
      viewers.delete(fn);
      if(!viewers.size&&raf){cancelAnimationFrame(raf);raf=0;}
    };
  }
  function step(now){
    raf=0;
    if(!viewers.size)return;
    sim.tick(now-last);last=now;
    const snapshot=sim.snap();
    for(const fn of [...viewers]){try{fn(snapshot);}catch(e){console.error(e);}}
    raf=requestAnimationFrame(step);
  }

  const css=document.createElement('style');
  css.textContent=[
    '.studio-r2{font:inherit;color:inherit;height:100%;min-height:170px;box-sizing:border-box;display:flex;flex-direction:column;gap:7px;padding:9px;overflow:auto;}',
    '.studio-r2 *{box-sizing:border-box;}',
    '.studio-r2 .r2-bar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}',
    '.studio-r2 button,.studio-r2 select{font:inherit;color:inherit;background:rgba(115,145,180,.16);border:1px solid rgba(126,165,205,.42);padding:5px 8px;border-radius:5px;cursor:pointer;}',
    '.studio-r2 button[aria-pressed="true"]{outline:2px solid #79c8e8;outline-offset:1px;}',
    '.studio-r2 button:disabled{opacity:.35;cursor:default;}',
    '.studio-r2 .r2-status{font-size:12px;opacity:.75;}',
    '.studio-r2 .r2-main{display:flex;gap:9px;flex:1;min-height:140px;flex-wrap:wrap;}',
    '.studio-r2 .r2-stage{flex:1;min-width:150px;min-height:155px;display:grid;place-items:center;overflow:hidden;background:repeating-conic-gradient(#1a2535 0 25%,#2b3544 0 50%) 50%/20px 20px;border:1px solid rgba(126,165,205,.35);border-radius:6px;}',
    '.studio-r2 .r2-stage canvas{image-rendering:pixelated;max-width:100%;max-height:100%;touch-action:none;cursor:crosshair;}',
    '.studio-r2 .r2-palette{display:flex;flex-wrap:wrap;gap:5px;}',
    '.studio-r2 .r2-swatch{width:29px;height:29px;padding:0;background-size:9px 9px;}',
    '.studio-r2 .r2-note{font-size:12px;opacity:.78;line-height:1.3;}',
    '.studio-r2 .r2-warn{font-size:12px;color:#edb078;}',
    '.studio-r2 .r2-preview{width:112px;height:150px;border:1px solid rgba(126,165,205,.32);background:#121d2b;image-rendering:pixelated;}',
    '.studio-r2 .r2-side{display:flex;flex-direction:column;gap:6px;min-width:124px;}',
    '.studio-r2 .r2-world canvas{width:100%;height:auto;cursor:grab;touch-action:none;}',
    '.studio-r2 .r2-world canvas:active{cursor:grabbing;}'
  ].join('\n');
  document.head.append(css);
  const node=(tag,cl,text)=>{
    const el=document.createElement(tag);if(cl)el.className=cl;if(text!==undefined)el.textContent=text;return el;
  };
  const button=(label,on)=>{const el=node('button',null,label);el.type='button';el.onclick=on;return el;};
  const drawPixels=(canvas,pixels)=>{
    const ctx=canvas.getContext('2d');
    const img=ctx.createImageData(M.W,M.H);
    for(let i=0;i<pixels.length;i++){
      const color=M.PALETTE[pixels[i]];
      if(color==='transparent')continue;
      const k=i*4;img.data[k]=parseInt(color.slice(1,3),16);
      img.data[k+1]=parseInt(color.slice(3,5),16);
      img.data[k+2]=parseInt(color.slice(5,7),16);img.data[k+3]=255;
    }
    ctx.clearRect(0,0,M.W,M.H);ctx.putImageData(img,0,0);
  };
  function frameCanvases(doc){
    return doc.frames.map(f=>{
      const c=node('canvas');c.width=M.W;c.height=M.H;drawPixels(c,f.pixels);return c;
    });
  }
  function download() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(H.get(),null,2)],{type:'application/json'}));
    const a=node('a');a.href=url;a.download='Studio_R2_Animacja_Zrodlo.json';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1800);
  }
  function base(kind) {
    const root=node('section','studio-r2');root.dataset.studioR2=kind;
    root.tabIndex=0;
    const header=node('div','r2-bar'), title=node('strong',null,kind==='source'?'Studio R2 · Źródło':'Studio R2 · Żywy świat');
    const status=node('span','r2-status');header.append(title,status);
    const controls=node('div','r2-bar'),main=node('div','r2-main');
    const warningEl=node('div','r2-warn');
    root.append(header,controls,main,warningEl);
    return {root,header,status,controls,main,warningEl};
  }
  function sourceView(box,ctx) {
    const ui=base('source'),{root,status,controls,main,warningEl}=ui;
    let selectedFrame=0,selectedColor=2,tool='brush',hover=null,pending=null,previewLive=true;
    let doc=H.get(),renderedRev=-1,framesCache=[],disposed=false,previewLast=performance.now(),previewTime=0;
    const framebar=node('div','r2-bar'),tools=node('div','r2-bar'),palette=node('div','r2-palette');
    const undoBtn=button('Cofnij',undo),redoBtn=button('Ponów',redo);
    const worldBtn=button('Otwórz żywy świat',()=>ctx.openType('studio-r2-world',{w:.48,h:.7}));
    const saveBtn=button('Eksport JSON',download),openBtn=button('Otwórz JSON',()=>file.click());
    const file=node('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    file.onchange=async()=>{if(!file.files?.length)return;
      try{const f=file.files[0];if(f.size>1024*1024)throw Error('Plik zbyt duży');
        const parsed=JSON.parse(await f.text());replace(parsed);
      }catch(e){API.toast('R2: '+e.message);}
      file.value='';
    };
    controls.append(undoBtn,redoBtn,worldBtn,saveBtn,openBtn,file);
    const bBrush=button('B · Pędzel',()=>setTool('brush'));
    const bErase=button('E · Gumka',()=>setTool('erase'));
    const bPick=button('I · Pipeta',()=>setTool('pick'));
    tools.append(bBrush,bErase,bPick);
    function setTool(t){tool=t;[bBrush,bErase,bPick].forEach((b,i)=>b.setAttribute('aria-pressed',String(['brush','erase','pick'][i]===t)));}
    setTool('brush');
    for(let i=0;i<M.PALETTE.length;i++){
      const b=button('',()=>{selectedColor=i;tool='brush';setTool('brush');swatches();});
      b.className='r2-swatch';b.style.background=M.PALETTE[i]==='transparent'
        ? 'repeating-conic-gradient(#aaa 0 25%,#444 0 50%) 50%/8px 8px':M.PALETTE[i];
      b.title=(i?'Kolor ':'Przezroczystość ') + i;b.setAttribute('aria-label',b.title);
      palette.append(b);
    }
    function swatches(){[...palette.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedColor)));}
    swatches();
    const stage=node('div','r2-stage'),canvas=node('canvas');canvas.width=M.W;canvas.height=M.H;
    canvas.style.width='min(100%, 360px)';
    canvas.setAttribute('aria-label','Rysuj wybraną klatkę ręcznie');
    stage.append(canvas);
    const side=node('div','r2-side'),preview=node('canvas','r2-preview');
    preview.width=M.W;preview.height=M.H;
    const previewBtn=button('Podgląd: żywy',()=>{previewLive=!previewLive;previewBtn.textContent=previewLive?'Podgląd: żywy':'Podgląd: klatka';});
    const durationSelect=node('select');durationSelect.setAttribute('aria-label','Czas wybranej klatki');
    for(const n of [90,120,150,170,190,240,360,500,800]){
      const opt=node('option',null,n+' ms');opt.value=n;durationSelect.append(opt);
    }
    durationSelect.onchange=()=>mutate(d=>M.duration(d,selectedFrame,Number(durationSelect.value)));
    side.append(node('strong',null,'Podgląd niezależny'),preview,previewBtn,node('span','r2-note','Oglądaj ruch podczas edycji dowolnej klatki.'),
      node('label','r2-note','Czas klatki:'),durationSelect);
    main.append(stage,side);
    root.insertBefore(framebar,main);root.insertBefore(tools,main);root.insertBefore(palette,main);
    root.append(node('div','r2-note','Klikaj klatki we własnym tempie. Prawy przycisk = pipeta. Zmiana źródła nie resetuje cząstek ani ruchu statku.'));
    box.append(root);
    function paint() {
      let imageDoc=doc;
      if(pending?.size){
        try{imageDoc=M.edit(doc,selectedFrame,[...pending.values()]);}catch(e){}
      }
      drawPixels(canvas,imageDoc.frames[selectedFrame].pixels);
      if(hover){
        const c=canvas.getContext('2d');c.strokeStyle='#83e6ef';c.lineWidth=.09;
        c.strokeRect(hover[0]+.06,hover[1]+.06,.88,.88);
      }
    }
    function frameButtons() {
      framebar.replaceChildren(node('span','r2-note','Edytowana klatka:'));
      doc.frames.forEach((f,i)=>{
        const b=button((i+1).toString(),()=>{selectedFrame=i;frameButtons();paint();updateDuration();});
        b.setAttribute('aria-pressed',String(selectedFrame===i));b.title='Klatka '+(i+1)+' — '+f.duration+' ms';
        framebar.append(b);
      });
    }
    function updateDuration() {
      let ms=doc.frames[selectedFrame].duration;
      if(![...durationSelect.options].some(x=>Number(x.value)===ms)){
        const option=node('option',null,ms+' ms');option.value=ms;durationSelect.append(option);
      }
      durationSelect.value=ms;
    }
    function onDoc(s){
      doc=s.document;
      if(selectedFrame>=doc.frames.length)selectedFrame=0;
      if(renderedRev!==doc.revision){framesCache=frameCanvases(doc);renderedRev=doc.revision;}
      root.dataset.sourceRev=String(doc.revision);
      status.textContent='rewizja '+doc.revision+' · '+M.sequenceMs(doc)+' ms/cykl';
      undoBtn.disabled=!s.history.canUndo;redoBtn.disabled=!s.history.canRedo;
      warningEl.textContent=s.warning;
      frameButtons();updateDuration();paint();
    }
    const unsubscribe=subscribe(onDoc);
    function pos(e) {
      const r=canvas.getBoundingClientRect();
      if(r.width<=0||r.height<=0)return null;
      const x=Math.floor((e.clientX-r.left)/r.width*M.W),y=Math.floor((e.clientY-r.top)/r.height*M.H);
      return x>=0&&x<M.W&&y>=0&&y<M.H?[x,y]:null;
    }
    function pickAt(p) {
      selectedColor=doc.frames[selectedFrame].pixels[p[1]*M.W+p[0]];
      swatches();setTool('brush');
    }
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      const p=pos(e);if(!p)return;
      if(e.button===2||tool==='pick'){pickAt(p);return;}
      if(e.button!==0)return;
      e.preventDefault();root.focus({preventScroll:true});
      pending=new Map();canvas.setPointerCapture(e.pointerId);
      pending.set(p.join(','),[...p,tool==='erase'?0:selectedColor]);hover=p;paint();
    });
    canvas.addEventListener('pointermove',e=>{
      hover=pos(e);
      if(pending&&hover)pending.set(hover.join(','),[...hover,tool==='erase'?0:selectedColor]);
      paint();
    });
    function finish(){
      if(!pending)return;
      const changes=[...pending.values()];pending=null;
      if(changes.length)mutate(d=>M.edit(d,selectedFrame,changes));
      paint();
    }
    canvas.addEventListener('pointerup',finish);
    canvas.addEventListener('pointercancel',finish);
    canvas.addEventListener('pointerleave',()=>{hover=null;if(!pending)paint();});
    root.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase(),modified=(e.ctrlKey||e.metaKey)&&!e.altKey;
      const typing=!!e.target.closest('input,textarea,select,[contenteditable="true"]');
      // Scope document history to the focused editor. Prevent the older Jaskinia shell
      // from interpreting Ctrl+Z/Y as undo/redo of window layout.
      if(modified&&(k==='z'||k==='y')){
        e.stopPropagation();
        if(typing)return; // native text editing keeps its own undo
        e.preventDefault();
        if(k==='z'&&e.shiftKey||k==='y')redo();else undo();
        return;
      }
      if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
      if(k==='b'||k==='e'||k==='i'){setTool({b:'brush',e:'erase',i:'pick'}[k]);e.preventDefault();}
    });
    function previewLoop(now){
      if(disposed)return;
      const delta=Math.min(150,Math.max(0,now-previewLast));previewLast=now;
      if(previewLive)previewTime+=delta;
      if(framesCache.length){
        const idx=previewLive?M.frameAt(doc,previewTime):selectedFrame;
        const c=preview.getContext('2d');
        c.clearRect(0,0,M.W,M.H);c.drawImage(framesCache[idx],0,0);
      }
      requestAnimationFrame(previewLoop);
    }
    requestAnimationFrame(previewLoop);
    ctx.onDispose(()=>{disposed=true;unsubscribe();finish();});
  }
  function worldView(box,ctx){
    const ui=base('world'),{root,status,controls,main,warningEl}=ui;
    const pauseBtn=button('Pauza świata',()=>{sim.pause(!sim.paused);});
    const autoBtn=button('Steruj ręcznie',()=>{sim.auto(!sim.snap().auto);});
    const clearBtn=button('Wyczyść ślad',()=>sim.clear());
    const sourceBtn=button('Otwórz źródło',()=>ctx.openType('studio-r2-source',{w:.46,h:.7}));
    controls.append(pauseBtn,autoBtn,clearBtn,sourceBtn);
    const stage=node('div','r2-stage r2-world'),canvas=node('canvas');canvas.width=740;canvas.height=430;
    canvas.setAttribute('aria-label','Żywy świat: przeciągnij statek, by pozostawić ślad ognia');
    stage.append(canvas);main.append(stage);
    root.append(node('div','r2-note','To samo źródło steruje istniejącymi i nowymi cząstkami. Zmień piksele w drugim oknie, nie zatrzymując świata.'));
    box.append(root);
    let doc=H.get(),cachedRev=-1,images=[],disposed=false,dragging=false;
    const redrawSource=s=>{doc=s.document;warningEl.textContent=s.warning;};
    const unsubSource=subscribe(redrawSource);
    const g=canvas.getContext('2d');
    function frames(){
      if(cachedRev!==doc.revision){images=frameCanvases(doc);cachedRev=doc.revision;}
    }
    function render(s){
      if(disposed)return;
      frames();
      const w=canvas.width,h=canvas.height;
      g.fillStyle='#0d1a29';g.fillRect(0,0,w,h);
      g.fillStyle='#1d344a';
      for(let i=0;i<55;i++){const x=(i*193+77)%w,y=(i*89+37)%h;g.fillRect(x,y,2,2);}
      const spriteW=39,spriteH=52;
      for(const p of s.particles){
        const sourceIndex=M.frameAt(doc,p.age);
        g.globalAlpha=Math.max(.04,(1850-p.age)/1850)*.78;
        g.drawImage(images[sourceIndex],p.x*w-spriteW/2,p.y*h,spriteW,spriteH);
      }
      g.globalAlpha=1;
      const x=s.ship.x*w,y=s.ship.y*h;
      g.fillStyle='#91cee0';
      g.beginPath();g.moveTo(x,y-25);g.lineTo(x+16,y+22);g.lineTo(x-16,y+22);g.closePath();g.fill();
      g.fillStyle='#2a5376';g.fillRect(x-5,y-7,10,16);
      g.fillStyle='#ebf6fa';g.fillRect(x-3,y-11,6,7);
      status.textContent=(s.paused?'PAUZA · ':'ŻYJE · ')+'t='+(s.timeMs/1000).toFixed(1)+' s · cząstki '+s.particles.length+' · źródło r'+doc.revision;
      root.dataset.simMs=String(Math.round(s.timeMs));
      root.dataset.emitted=String(s.created);
      root.dataset.sourceRev=String(doc.revision);
      root.dataset.worldPaused=String(s.paused);
      pauseBtn.textContent=s.paused?'Wznów świat':'Pauza świata';
      autoBtn.textContent=s.auto?'Steruj ręcznie':'Ruch automatyczny';
    }
    const unsubWorld=watch(render);
    function move(e){
      const b=canvas.getBoundingClientRect();
      if(!b.width||!b.height)return;
      const x=(e.clientX-b.left)/b.width,y=(e.clientY-b.top)/b.height;
      sim.move(x,y);autoBtn.textContent='Ruch automatyczny';
    }
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      e.preventDefault();dragging=true;canvas.setPointerCapture(e.pointerId);move(e);
    });
    canvas.addEventListener('pointermove',e=>{if(dragging)move(e);});
    canvas.addEventListener('pointerup',()=>{dragging=false;});
    canvas.addEventListener('pointercancel',()=>{dragging=false;});
    ctx.onDispose(()=>{disposed=true;unsubSource();unsubWorld();dragging=false;});
  }
  API.type('studio-r2-source',{group:'studio',name:'Studio R2 — źródło',desc:'Ręcznie edytuj klatki i obserwuj ich żywe zastosowanie.',glyph:'t_wybor',fill:true,noZoom:true,sized:false,render:sourceView});
  API.type('studio-r2-world',{group:'studio',name:'Studio R2 — świat',desc:'Żywy ruch i cząstki z tego samego dokumentu, bez resetu przy edycji.',glyph:'t_wybor',fill:true,noZoom:true,sized:false,render:worldView});
})();
