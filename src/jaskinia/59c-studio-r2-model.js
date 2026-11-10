/* Studio R2 — independent source animation and world simulation.
   Synthetic test material only. Not a universal project format. */
const StudioR2Model = (() => {
  'use strict';
  const W = 24, H = 32, FORMAT = 'jaskinia-studio-r2/source-v1';
  const PALETTE = Object.freeze(['transparent', '#ef704d', '#ffad55', '#ffe194', '#faf4cb', '#579fb7', '#273d67']);
  const MAX_FRAMES = 12;
  const same = (a,b) => JSON.stringify(a.frames) === JSON.stringify(b.frames);
  function sample() {
    const frames = [];
    for (let k = 0; k < 4; k++) {
      const pixels = Array(W*H).fill(0), length = [14,22,17,27][k];
      for (let y=1; y<=length; y++) {
        const width = Math.max(1, Math.floor((5*(length+2-y))/length) + ((k+y)%4===0 ? 1 : 0));
        for(let x=12-width; x<=11+width; x++) {
          if(x<0||x>=W||y>=H) continue;
          const edge = Math.abs(x-11.5) / (width+0.4);
          pixels[y*W+x] = edge>.73 ? 1 : edge>.42 ? 2 : y<Math.ceil(length*.38) ? 4 : 3;
        }
      }
      frames.push({duration:[170,130,190,150][k],pixels});
    }
    return {format:FORMAT,width:W,height:H,revision:0,frames};
  }
  function valid(d) {
    return !!d && d.format===FORMAT && d.width===W && d.height===H &&
      Number.isSafeInteger(d.revision) && d.revision>=0 &&
      Array.isArray(d.frames) && d.frames.length>=1 && d.frames.length<=MAX_FRAMES &&
      d.frames.every(f=>f && Number.isInteger(f.duration) && f.duration>=50 && f.duration<=3000 &&
        Array.isArray(f.pixels) && f.pixels.length===W*H && f.pixels.every(n=>Number.isInteger(n)&&n>=0&&n<PALETTE.length));
  }
  function clone(d) {
    if(!valid(d)) throw Error('Nieobsługiwany lub uszkodzony dokument Studio R2');
    return {format:FORMAT,width:W,height:H,revision:d.revision,
      frames:d.frames.map(f=>({duration:f.duration,pixels:f.pixels.slice()}))};
  }
  function edit(d,idx,changes) {
    const next=clone(d);
    if(!Number.isInteger(idx)||idx<0||idx>=next.frames.length) throw Error('Błędna klatka');
    if(!Array.isArray(changes)||changes.length>W*H*3) throw Error('Za duże pociągnięcie');
    const pixels=next.frames[idx].pixels;
    for(const p of changes) {
      if(!Array.isArray(p)||p.length!==3) throw Error('Błędny punkt');
      const [x,y,c]=p;
      if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(c)||x<0||x>=W||y<0||y>=H||c<0||c>=PALETTE.length)throw Error('Punkt poza obszarem');
      pixels[y*W+x]=c;
    }
    return same(d,next) ? d : {...next,revision:d.revision+1};
  }
  function duration(d,idx,ms) {
    const next=clone(d);
    if(!Number.isInteger(idx)||idx<0||idx>=next.frames.length||!Number.isInteger(ms)||ms<50||ms>3000)throw Error('Niepoprawny czas');
    next.frames[idx].duration=ms;
    return same(d,next)?d:{...next,revision:d.revision+1};
  }
  function sequenceMs(d) { return d.frames.reduce((s,f)=>s+f.duration,0); }
  function frameAt(d,ms) {
    const cycle=sequenceMs(d);
    let t=((ms%cycle)+cycle)%cycle;
    for(let i=0;i<d.frames.length;i++){if(t<d.frames[i].duration)return i;t-=d.frames[i].duration;}
    return d.frames.length-1;
  }
  function history(initial) {
    let d=clone(initial),past=[],future=[];
    return {
      get:()=>clone(d),info:()=>({canUndo:past.length>0,canRedo:future.length>0}),
      change(fn) {
        const next=fn(d);
        if(!valid(next))throw Error('Niepoprawny stan po edycji');
        if(same(d,next))return false;
        past.push(d);if(past.length>70)past.shift();
        future=[];d=clone({...next,revision:d.revision+1});return true;
      },
      replace(source) {
        const next=clone(source);
        if(same(next,d))return false;
        past.push(d);if(past.length>70)past.shift();
        future=[];d={...next,revision:d.revision+1};return true;
      },
      undo(){if(!past.length)return false;future.push(d);d={...past.pop(),revision:d.revision+1};return true;},
      redo(){if(!future.length)return false;past.push(d);d={...future.pop(),revision:d.revision+1};return true;}
    };
  }
  // This state is deliberately separate from the authored pixels and from the viewport.
  function world() {
    let t=0, paused=false, auto=true, ship={x:.5,y:.27}, accum=0, created=0;
    let particles=[];
    function move(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Niepoprawna pozycja');
      ship={x:Math.min(.95,Math.max(.05,x)),y:Math.min(.85,Math.max(.08,y))};
      auto=false;
    }
    function tick(dtMs) {
      if(paused)return;
      const dt=Math.min(100,Math.max(0,Number(dtMs)||0));
      if(!dt)return;
      t+=dt;
      if(auto)ship={x:.5+.28*Math.sin(t/940),y:.25+.055*Math.sin(t/610)};
      for(const p of particles){p.age+=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;}
      particles=particles.filter(p=>p.age<1850 && p.y<1.3 && p.x>-.4 && p.x<1.4);
      accum+=dt;
      while(accum>=76) {
        accum-=76;const id=++created;
        particles.push({id,x:ship.x,y:ship.y+.06,vx:Math.sin(id*1.73)*.06,vy:.16+(id%5)*.014,age:0});
      }
      if(particles.length>90) particles.splice(0,particles.length-90);
    }
    function snap() {
      return {timeMs:t,paused,auto,created,ship:{...ship},particles:particles.map(p=>({...p}))};
    }
    return {tick,snap,move,pause(v){paused=!!v;},auto(v){auto=!!v;},
      clear(){particles=[];accum=0;},get paused(){return paused;}};
  }
  return Object.freeze({W,H,FORMAT,PALETTE,sample,valid,clone,edit,duration,sequenceMs,frameAt,history,world});
})();
