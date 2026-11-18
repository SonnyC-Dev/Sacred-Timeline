/* ============================ PALETTES ============================ */
const PHASES = {
  1:{name:"Phase One",   c:"#4ea6ff", c2:"#1f5c96", glow:"rgba(78,166,255,.30)",  tag:"Assembling"},
  2:{name:"Phase Two",   c:"#a678ff", c2:"#5b34a3", glow:"rgba(166,120,255,.28)", tag:"Expansion"},
  3:{name:"Phase Three", c:"#ffc23d", c2:"#a3711a", glow:"rgba(255,194,61,.24)",  tag:"Infinity"},
  4:{name:"Phase Four",  c:"#3ddc97", c2:"#1c7d55", glow:"rgba(61,220,151,.24)",  tag:"Aftermath"},
  5:{name:"Phase Five",  c:"#ff77c2", c2:"#a33a7c", glow:"rgba(255,119,194,.26)", tag:"Incursion"},
  6:{name:"Phase Six",   c:"#ff5347", c2:"#99251d", glow:"rgba(255,83,71,.26)",   tag:"Doomsday"}
};
const SAGAS = {infinity:"The Infinity Saga", multiverse:"The Multiverse Saga"};
const ERAS = ["Before the suit","Earth gets an Avengers","Cracks in the shield",
              "The Infinity War","After the Blip","New threats","Outside the timeline"];

/* ============================ DATA ============================
   The 62 titles live in the #titledata block near the top of <body>, so the
   dataset can be edited without touching code. Each entry:
     id  short key        ti  title            t   film | series | special
     y   release year     r   release date     p   phase 1-6
     c   chronology rank  e   era index        w   when it is set
     min film runtime     ep  episode count    tmin series total runtime
     q   search override  sea per-season entry branch alternate reality
   Provenance for the runtimes and counts is in the README. */
/*TITLES*/

const POS = {};
DATA.slice().sort((a,b)=>a.r.localeCompare(b.r)).forEach((m,i)=>POS[m.id]={rel:i+1});
DATA.slice().sort((a,b)=>a.c-b.c).forEach((m,i)=>POS[m.id].chr=i+1);
const BY_ID = Object.fromEntries(DATA.map(m=>[m.id,m]));

/* ============================ STATE ============================ */
/* No key ships in this file, so it is safe to commit and to host publicly.
   Artwork, runtimes and episode counts are all embedded already — a key is
   only needed to fetch newly added titles. Paste one in Settings → Artwork
   when you need it; it is stored in your browser, never in this file.
   After the project split, keep it in src/config.local.js and gitignore that. */
const DEFAULT_TMDB="";

const KEY="mcu-tracker:v1", MKEY="mcu-meta:v2";
/* local calendar dates (UK time), not UTC: toISOString() is UTC, which in
   summer time files anything logged between midnight and 1am under the day before */
const ymd = d=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today = ()=> ymd(new Date());
let state = {watched:{}, extra:{}, hidden:{}, sort:"release", show:"all", series:true, q:"", phase:0, tmdb:DEFAULT_TMDB, view:"list",
             liveSearch:false, theme:"phase", fx:true, compact:false, maxlen:0, hideFuture:false};
/* Poster paths baked into this file. Images load straight from the public
   image CDN via <img>, which isn’t subject to the cross-origin rules that
   block the API — so this works on devices where fetching doesn’t.
   Fill from an exported backup's "meta" section. */
/* Artwork, runtimes and episode counts. Kept inline rather than in a separate
   data block: some hosts strip non-JS script tags, which silently killed the
   whole page. In src/ the placeholder below stays empty and dev-loader.js
   supplies the data; build.ps1 / build.py write it in for the single file. */
/*ARTWORK*/

/* ============================ INTRO ============================
   A comic you open, over #intro:
     cover    — a comic cover (first poster + "SACRED TIMELINE" masthead) floats
                over a drifting wall of poster panels until a tap, click, Enter
                or Space opens it. Posters keep loading while it waits, so by
                the time it opens the flip is ready: no blank pages.
     flip     — the cover and pages turn on a left hinge with a slight paper
                bend, a camera push-in and two red flashes at top speed (spaced
                >400ms apart: under 3 flashes a second)
     title    — the last page reveals the comic's red title page; the camera
                levels, then pushes in until the printed title IS the title card
                while a Bifröst beam sweeps across
     landing  — the card arcs up into the page title, carrying an exact copy of
                it that cross-fades in, so it lands invisibly; the page ripples
                in around it and the masthead decode plays on the real title
   Every step waits for its animation to finish, never a timer, so a busy phone
   can slow it down but not knock it out of step. Only transform and opacity
   animate. Once running, any tap or key skips; Esc skips from the cover.
   Not shown: reduced motion, Effects off, already played in this tab, or the
   CSS failsafe already fired. Built-in posters only, so no network needed. */
const INTRO=(()=>{
  const el=document.getElementById("intro"), title=document.querySelector(".title");
  let finish, appReady, ended=false, running=false, openedAt=0;
  const done=new Promise(r=>finish=r), ready=new Promise(r=>appReady=r);
  const reveal=[];                               /* page fade-ups, finished at once on skip */
  const end=fast=>{
    if(ended) return; ended=true;
    removeEventListener("pointerdown",onInput,true); removeEventListener("keydown",onInput,true);
    reveal.forEach(a=>{ try{ a.finish(); }catch(e){} });
    if(el){ el.classList.add("gone"); setTimeout(()=>el.remove(),fast?400:450); }
    if(title) title.style.opacity="";
    finish();
  };
  let seen=false;
  try{ seen=!!sessionStorage.getItem("mcu-intro"); sessionStorage.setItem("mcu-intro","1"); }catch(e){}
  if(!el || seen || getComputedStyle(el).visibility==="hidden" ||
     matchMedia("(prefers-reduced-motion: reduce)").matches || typeof el.animate!=="function"){
    if(el) el.remove(); finish(); return {done, skip:()=>{}, ready:()=>{}};
  }
  el.classList.add("run");                      /* the script has it: cancel the CSS failsafe */
  if(title) title.style.opacity="0";            /* the card lands here later */

  /* before opening: tap / click / Enter / Space opens, Esc skips.
     once running: any tap or key skips (after a moment, so the opening tap can't) */
  let open; const opened=new Promise(r=>open=r);
  function onInput(e){
    if(running){ if(performance.now()-openedAt>500) end(true); return; }
    if(e.type==="keydown"){
      if(e.key==="Escape") return end(true);
      if(e.key!=="Enter" && e.key!==" ") return;
      e.preventDefault();
    }
    open();
  }
  addEventListener("pointerdown",onInput,true); addEventListener("keydown",onInput,true);
  /* a hidden tab pauses animations, so their "finished" never arrives: end it */
  document.addEventListener("visibilitychange",()=>{ if(running && document.hidden) end(true); });

  const $i=s=>el.querySelector(s);
  const bg=$i(".intro-bg"), panels=$i(".intro-panels"), dots=$i(".intro-dots"), stage=$i(".intro-stage"),
        card=$i(".intro-card"), flash=$i(".intro-flash"), beams=[...el.querySelectorAll(".intro-beam")],
        logo=$i(".intro-logo"), span=logo.firstElementChild, word=logo.querySelector("b"), hint=$i(".intro-hint");
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const fin=a=>a.finished.catch(()=>{});        /* a cancelled animation counts as done */
  const phone=innerWidth<=620;
  const pics=Object.values(BUILTIN_ART).map(a=>a.p).filter(p=>/^(data:|assets\/)/.test(p||""));
  for(let i=pics.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pics[i],pics[j]]=[pics[j],pics[i]]; }

  /* posters: download + decode in batches; the deck keeps filling in the background */
  const DECK=18, deck=[];
  const prep=p=>{ const i=new Image(); i.decoding="async"; i.src=p; return i.decode().then(()=>p,()=>null); };
  (async()=>{ for(let k=0;deck.length<DECK && k<pics.length;k+=6)
    (await Promise.all(pics.slice(k,k+6).map(prep))).forEach(p=>{ if(p && deck.length<DECK) deck.push(p); }); })();
  const until=(test,ms)=>new Promise(r=>{ const t0=performance.now(), i=setInterval(()=>{
    if(test()||performance.now()-t0>ms){ clearInterval(i); r(test()); } },50); });

  /* the Bifröst: a rainbow beam (and its glow) sweeping across */
  const sweep=()=>beams.map((b,i)=>b.animate([
    {opacity:0,transform:"rotate(-16deg) scaleX(0)",transformOrigin:"0 50%"},
    {opacity:i?.8:1,transform:"rotate(-16deg) scaleX(1)",transformOrigin:"0 50%",offset:.4},
    {opacity:0,transform:"rotate(-16deg) scaleX(1) scaleY(.15)",transformOrigin:"0 50%"}],
    {duration:1250,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"}));

  (async()=>{
    /* load: a cover poster plus one page, and the app's list built underneath */
    if(!await until(()=>deck.length>=2,6000)) return end(true);
    await Promise.race([ready,wait(3000)]);
    if(ended) return;
    const SW=stage.offsetWidth, SH=stage.offsetHeight;

    /* a turning page with a gentle bend: three hinged strips, each with its own
       slice of the image and of one shared shadow, so the outer strips can
       trail a few degrees behind the hinge the way paper flexes */
    const CUTS=[.56,.26,.18], EASE_TURN="cubic-bezier(.45,.05,.55,.95)";
    const turnPage=(src,dur)=>{
      const turn=document.createElement("div"); turn.className="intro-turn";
      const strips=[]; let parent=turn, x=0;
      CUTS.forEach((c,n)=>{
        const st=document.createElement("div"); st.className="intro-strip";
        st.style.cssText=`left:${n?CUTS[n-1]*SW:0}px;width:${c*SW}px`;
        st.innerHTML=`<div class="intro-face"${n<CUTS.length-1?' style="right:-1px"':""}><img alt=""><i></i></div>`;
        const img=st.querySelector("img"), shade=st.querySelector("i");
        img.src=src; img.style.cssText=`left:${-x}px;width:${SW}px;height:${SH}px`;
        shade.style.cssText=`background-size:${SW}px 100%;background-position:${-x}px 0`;
        parent.appendChild(st); strips.push(st); parent=st; x+=c*SW;
      });
      stage.appendChild(turn);
      const T={duration:dur,easing:EASE_TURN,fill:"forwards"};
      const a=turn.animate([{transform:"rotateY(0deg)"},{transform:"rotateY(-118deg)"}],T);
      strips[1].animate([{transform:"rotateY(0)"},{transform:"rotateY(8deg)",offset:.4},{transform:"rotateY(3deg)",offset:.75},{transform:"rotateY(0)"}],T);
      strips[2].animate([{transform:"rotateY(0)"},{transform:"rotateY(10deg)",offset:.45},{transform:"rotateY(4deg)",offset:.8},{transform:"rotateY(0)"}],T);
      turn.querySelectorAll(".intro-face i").forEach(s=>s.animate([{opacity:0},{opacity:.5,offset:.5},{opacity:.9}],{duration:dur,fill:"forwards"}));
      fin(a).then(()=>turn.remove());
      return a;
    };

    /* the cover: drawn once onto a canvas so it can turn like any other page */
    const cover=await (async()=>{
      try{ await document.fonts.ready; }catch(e){}
      const W=Math.round(SW*2), H=Math.round(SH*2), c=document.createElement("canvas");
      c.width=W; c.height=H; const g=c.getContext("2d");
      const img=new Image(); img.src=deck[0]; await img.decode();
      const r=Math.max(W/img.naturalWidth,H/img.naturalHeight);
      g.drawImage(img,(W-img.naturalWidth*r)/2,(H-img.naturalHeight*r)/2,img.naturalWidth*r,img.naturalHeight*r);
      /* print texture: faint halftone over the art, and a soft gloss */
      const dot=document.createElement("canvas"); dot.width=dot.height=6;
      const dg=dot.getContext("2d"); dg.fillStyle="rgba(0,0,0,.18)"; dg.beginPath(); dg.arc(3,3,1.2,0,6.283); dg.fill();
      g.fillStyle=g.createPattern(dot,"repeat"); g.fillRect(0,0,W,H);
      const gl=g.createLinearGradient(0,0,W,H);
      gl.addColorStop(0,"rgba(255,255,255,.14)"); gl.addColorStop(.45,"rgba(255,255,255,0)");
      g.fillStyle=gl; g.fillRect(0,0,W,H);
      /* masthead: red band, white title, black rule */
      const bh=Math.round(H*.17);
      g.fillStyle="#e62429"; g.fillRect(0,0,W,bh);
      g.fillStyle="#0b0b10"; g.fillRect(0,bh,W,Math.max(2,Math.round(H*.008)));
      const line=(text,size,cx,cy,maxW,sy)=>{
        g.font=`700 ${size}px "Space Grotesk","Segoe UI",sans-serif`;
        if("letterSpacing" in g) g.letterSpacing=`${-.03*size}px`;
        const fit=Math.min(1,maxW/g.measureText(text).width);
        g.save(); g.translate(cx,cy); g.scale(fit,fit*sy); g.fillText(text,0,0); g.restore();
      };
      g.textAlign="center"; g.textBaseline="middle"; g.fillStyle="#fff";
      line("SACRED TIMELINE",bh*.6,W/2,bh/2+bh*.03,W*.9,1.22);
      /* issue box, bottom left */
      const pad=W*.05, bw=W*.24, bx=pad, by=H-pad-H*.07, bb=H*.07;
      g.fillStyle="#fff"; g.fillRect(bx,by,bw,bb);
      g.strokeStyle="#0b0b10"; g.lineWidth=Math.max(2,W*.008); g.strokeRect(bx,by,bw,bb);
      g.fillStyle="#0b0b10"; line(`No. ${DATA.length}`,bb*.5,bx+bw/2,by+bb/2,bw*.84,1);
      return c.toDataURL("image/jpeg",.9);
    })().catch(()=>deck[0]);

    /* the wall behind, sized for the screen */
    if(phone) panels.style.gridTemplateColumns="repeat(6,1fr)";
    pics.slice(DECK).concat(pics).slice(0,phone?18:40).forEach(p=>{
      const i=new Image(); i.src=p; i.alt=""; i.decoding="async"; panels.appendChild(i); });
    if(ended) return;

    /* the cover screen: the book floats over the drifting wall until opened */
    card.src=cover;
    panels.animate([{opacity:0},{opacity:.18}],{duration:1400,fill:"forwards"});
    panels.animate([{transform:"translate(-50%,-50%) rotate(-8deg) scale(1.06)"},{transform:"translate(-42%,-55%) rotate(-8deg) scale(.97)"}],
                   {duration:16000,direction:"alternate",iterations:Infinity,easing:"ease-in-out"});
    dots.animate([{opacity:0},{opacity:.5}],{duration:1200,fill:"forwards"});
    stage.style.opacity="1";
    await fin(stage.animate([{transform:"translateY(40px) rotateX(28deg) scale(.7)",opacity:0},
                             {transform:"rotateY(-8deg) rotateX(5deg) scale(.96)",opacity:1}],
                            {duration:700,easing:"cubic-bezier(.2,.8,.3,1)"}));
    const idle=stage.animate([{transform:"translateY(0) rotateY(-8deg) rotateX(5deg) scale(.96)"},
                              {transform:"translateY(-7px) rotateY(-4deg) rotateX(3deg) scale(.96)"}],
                             {duration:3000,direction:"alternate",iterations:Infinity,easing:"ease-in-out"});
    hint.textContent=matchMedia("(hover:none)").matches?"Tap to open":"Click to open";
    const pulse=hint.animate([{opacity:.35},{opacity:.9}],{duration:1600,direction:"alternate",iterations:Infinity,easing:"ease-in-out"});
    await opened;
    if(ended) return;
    running=true; openedAt=performance.now();
    const safety=setTimeout(()=>end(true),20000);

    /* the flip: the cover first, then the pages that are ready (slow, fast, slow) */
    const pages=deck.slice(1);
    const seq=[cover,...pages], n=seq.length;
    const gap=i=>Math.round(92+118*Math.pow(Math.abs(i/Math.max(1,n-1)-.45)*1.65,1.4));
    let flipTotal=900; for(let i=1;i<n-1;i++) flipTotal+=gap(i);
    const from=getComputedStyle(stage).transform; idle.cancel();
    pulse.cancel(); hint.animate([{opacity:.9},{opacity:0}],{duration:300,fill:"forwards"});
    stage.animate([{transform:from},{transform:"scale(1.06) rotateY(5deg) rotateX(-2deg)"}],
                  {duration:flipTotal+900,easing:"ease-in-out",fill:"forwards"});
    /* the comic's title page sits under every page, revealed by the last turn */
    const tpage=document.createElement("div"); tpage.className="intro-tpage";
    tpage.innerHTML='<i class="tp-bg"></i><span><b>Sacred Timeline</b></span>';
    const tspan=tpage.firstElementChild.nextElementSibling, tword=tspan.firstElementChild, tbg=tpage.firstElementChild;
    tspan.style.fontSize=(SW*.1)+"px";
    stage.insertBefore(tpage,card);
    const SC=1.06, FLAT=`translate(0px,0px) scale(${SC})`;
    const flashAt=new Set([Math.round(n*.4),Math.round(n*.72)]);
    for(let i=0;i<n && !ended;i++){
      if(i===n-1){
        /* last turn: the camera levels so the title page ends flat and square-on */
        stage.animate([{transform:getComputedStyle(stage).transform},{transform:FLAT}],{duration:700,easing:"ease-in-out",fill:"forwards"});
        card.style.visibility="hidden";
        await fin(turnPage(seq[i],720));
        break;
      }
      turnPage(seq[i],i===0?1000:Math.max(260,Math.round(gap(i)*2.4)));
      card.src=seq[i+1];
      if(flashAt.has(i)) flash.animate([{opacity:0},{opacity:.38},{opacity:0}],{duration:140});
      await wait(i===0?650:gap(i));
    }
    await wait(380);
    if(ended) return;

    /* lock the card over the printed title, then push in on both together. Both
       moves are linear in the same eased progress, so the words stay locked on
       every frame; the red page fades as the card's band fades in */
    const P=tword.getBoundingClientRect(), W0=word.getBoundingClientRect(), L0=logo.getBoundingClientRect();
    const m0=P.width/W0.width, m=1/m0;
    const lockCard=`translate(${P.left-(W0.left-L0.left)*m0-L0.left}px,${P.top-(W0.top-L0.top)*m0-L0.top}px) scale(${m0})`;
    const S=stage.getBoundingClientRect(), cx=S.left+S.width/2, cy=S.top+S.height/2;
    const dx=(W0.left+W0.width/2)-cx-(P.left+P.width/2-cx)*m, dy=(W0.top+W0.height/2)-cy-(P.top+P.height/2-cy)*m;
    const NONE_RED={backgroundColor:"rgba(230,36,41,0)",boxShadow:"0 0 0 rgba(230,36,41,0)"},
          RED={backgroundColor:"#e62429",boxShadow:"0 0 60px rgba(230,36,41,.45)"};
    /* swap the printed words for the card's words in the same frame */
    Object.assign(span.style,NONE_RED);
    logo.style.transformOrigin="0 0"; logo.style.transform=lockCard; logo.style.opacity="1";
    tspan.style.visibility="hidden";
    const Z={duration:1100,easing:"cubic-bezier(.6,0,.25,1)",fill:"forwards"};
    const zoom=stage.animate([{transform:FLAT},{transform:`translate(${dx}px,${dy}px) scale(${SC*m})`}],Z);
    logo.animate([{transform:lockCard},{transform:"translate(0px,0px) scale(1)"}],Z);
    tbg.animate([{opacity:1},{opacity:1,offset:.25},{opacity:0}],Z);
    span.animate([NONE_RED,{...NONE_RED,offset:.25},RED],Z);
    $i(".intro-stack").animate([{opacity:1},{opacity:0}],{duration:500,fill:"forwards"});
    await wait(360);
    const beam=sweep();
    await fin(zoom);
    if(ended) return;
    stage.style.visibility="hidden";
    logo.style.transform=""; span.style.backgroundColor=""; span.style.boxShadow="";
    logo.classList.add("on");                    /* the sheen */
    await Promise.all(beam.map(fin));
    await wait(900);                             /* hold on the card */
    if(ended) return;

    /* landing */
    clearTimeout(safety);
    const D=1050, EASE="cubic-bezier(.45,0,.2,1)";
    const fadeOut=[bg,dots,flash,panels].map(x=>x.animate([{opacity:getComputedStyle(x).opacity},{opacity:0}],
                                                    {duration:D*.8,delay:D*.15,easing:"ease-in-out",fill:"forwards"}));
    /* the page arrives around the title: a quick ripple from the top down */
    [".sub",".tabs",".constellation",".tally",".countdown:not([hidden])",".nextup:not([hidden])","#controls","#list .group"]
      .map(s=>document.querySelector(s)).filter(Boolean)
      .forEach((p,i)=>reveal.push(p.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],
        {duration:560,delay:D*.45+i*70,easing:"cubic-bezier(.2,.8,.3,1)",fill:"backwards"})));
    const to=title&&title.getBoundingClientRect();
    if(to && to.bottom>0 && to.top<innerHeight && to.width>0){
      const rg=document.createRange(); rg.selectNodeContents(title); const tt=rg.getBoundingClientRect();
      const L=logo.getBoundingClientRect(), W=word.getBoundingClientRect();
      const s=tt.height/W.height, ex=tt.left-(W.left-L.left)*s-L.left, ey=tt.top-(W.top-L.top)*s-L.top;
      const at=(x,y,k)=>`translate(${x}px,${y}px) scale(${k})`;
      /* the card arcs its words onto the title's words, with a small lift first */
      const fly=logo.animate([{transform:"none"},{transform:at(-6,8,1.04),offset:.12},
                              {transform:at(ex*.4,ey*.7,1+(s-1)*.55),offset:.5},{transform:at(ex,ey,s)}],
                             {duration:D,easing:EASE,fill:"forwards"});
      /* an exact copy of the title rides inside the card at 1/s of its size, so
         when the card reaches scale s it IS the title: same place, font, case */
      const ghost=title.cloneNode(true); ghost.removeAttribute("id"); ghost.className="title intro-ghost";
      ghost.style.cssText=`left:${(W.left-L.left)-(tt.left-to.left)/s}px;top:${(W.top-L.top)-(tt.top-to.top)/s}px;`+
        `width:${to.width/s}px;font-size:${parseFloat(getComputedStyle(title).fontSize)/s}px;opacity:0`;
      logo.appendChild(ghost);
      /* capitals fade out as the title fades in, passing rather than stacking */
      span.animate([{opacity:1,...RED},{opacity:1,offset:.28},{opacity:0,...NONE_RED,offset:.62},{opacity:0,...NONE_RED}],
                   {duration:D,easing:EASE,fill:"forwards"});
      ghost.animate([{opacity:0},{opacity:0,offset:.3},{opacity:1,offset:.68},{opacity:1}],{duration:D,easing:EASE,fill:"forwards"});
      await fin(fly);
      if(title) title.style.opacity="";           /* identical pixels: the swap is invisible */
      logo.style.visibility="hidden";
    } else {
      await fin(logo.animate([{opacity:1},{opacity:0}],{duration:400,fill:"forwards"}));
    }
    await Promise.all(fadeOut.map(fin));
    end(false);
    if(window.__bifrost) setTimeout(()=>window.__bifrost(),150);   /* hand-off beam over the stars */
  })().catch(()=>end(true));

  return {done, skip:()=>end(true), ready:()=>appReady()};
})();

let meta = {};   /* id -> {p:poster path or url, min, ep, epmin} */
let openIds = new Set(), justMarked=null, cursorId=null;
let themePhase=0, settledPhase=1;

/* Storage: uses Claude's artifact storage when present, the browser’s own
   store when the file is opened or hosted anywhere else. Sandboxed frames
   block both, so every path is probed rather than assumed. */
const hasLocal=(()=>{ try{ localStorage.setItem("__p","1"); localStorage.removeItem("__p"); return true; }
                      catch(e){ return false; } })();
const store={
  async get(k){
    if(window.storage) return await window.storage.get(k);
    if(!hasLocal) throw new Error("no store");
    const v=localStorage.getItem(k);
    if(v===null) throw new Error("no key");
    return {key:k,value:v};
  },
  async set(k,v){
    if(window.storage) return await window.storage.set(k,v);
    if(!hasLocal) throw new Error("no store");
    localStorage.setItem(k,v); return {key:k,value:v};
  }
};

/* Stray promise rejections (storage misses, interrupted transitions) are
   expected here and shouldn’t surface as uncaught errors. */
addEventListener("unhandledrejection",e=>{ e.preventDefault(); console.warn("handled:",e.reason); });

async function load(){
  try{ const r=await store.get(KEY); if(r&&r.value) Object.assign(state, JSON.parse(r.value)); }catch(e){}
  try{ const r=await store.get(MKEY); if(r&&r.value) meta=JSON.parse(r.value); }catch(e){}
  if(!state.extra || typeof state.extra!=="object") state.extra={};
  if(!state.hidden || typeof state.hidden!=="object") state.hidden={};
  /* old records carried a date and a count; turn those into a dated list */
  for(const id in state.watched){
    const r=state.watched[id];
    if(!Array.isArray(r.w)) r.w=Array(Math.max(1,r.n||1)).fill(r.d||today());
    r.n=r.w.length; r.d=r.w[r.w.length-1];
  }

  /* TMDB lists a runtime for Avengers: Doomsday before it has one. Drop it
     rather than let a placeholder sit in the time totals as though it were real. */
  if(meta.avd) delete meta.avd.min;

  /* Merge the built-in artwork with whatever this browser has stored.
     Precedence for the image: a stored embedded image (you imported it) beats
     a built-in one, but a built-in embedded image beats a stored web link —
     a link is useless anywhere the image host is blocked.
     Only a stored data: image counts as "you imported it". A stored assets/
     path is just a copy of the src/ project's built-in poster, and must never
     beat the single file's embedded one (it would point at a missing file). */
  for(const id in BUILTIN_ART){
    const b=BUILTIN_ART[id], cur=meta[id]||{};
    const curEmbedded=/^data:/.test(cur.p||""), builtEmbedded=isLocal(b.p);
    let p;
    if(curEmbedded) p=cur.p;
    else if(builtEmbedded) p=b.p;
    else p=cur.p||b.p;
    meta[id]=Object.assign({}, b, cur, {p});
  }
  state.q=""; state.view="list";
  /* a previously saved key that isn’t a valid v3 key is dropped, so the
     built-in one takes over rather than a bad paste sticking around */
  if(!/^[a-f0-9]{32}$/i.test(state.tmdb||"")) state.tmdb=DEFAULT_TMDB;
}
let t1,t2;
function save(){
  SYNC.noteChange();                           /* records which titles changed, for sync */
  clearTimeout(t1); t1=setTimeout(async()=>{
    try{ await store.set(KEY, JSON.stringify({watched:state.watched,extra:state.extra,hidden:state.hidden,sort:state.sort,show:state.show,
      series:state.series,tmdb:state.tmdb,liveSearch:state.liveSearch,
      theme:state.theme,fx:state.fx,compact:state.compact,maxlen:state.maxlen,hideFuture:state.hideFuture})); }
    catch(e){ say("Can't save to this browser. Export a backup to keep your progress."); }
  },300);
}
function saveMeta(){
  clearTimeout(t2); t2=setTimeout(async()=>{ try{ await store.set(MKEY, JSON.stringify(meta)); }
    catch(e){ say("Can't save artwork to this browser: it may be full. Your watch progress is unaffected."); } },900);
}

/* ---------- sync between devices (GitHub Gist) ----------
   Optional. Given a GitHub token allowed to read and write Gists, this browser
   keeps the tracker in a secret Gist on that account: one Gist per tracker
   name, so two people can share an account and keep separate trackers.
   Synced: watched, extra (ratings, notes, episodes), hidden. Not synced:
   artwork and display preferences, which belong to each device.
   Merging is per title. Every save() records which titles changed and when
   (removals included); on sync, the newer change to each title wins on both
   sides. If neither side has a record (data from before sync was switched
   on), the device's own version is kept and titles only one side has are
   added. The token stays in this browser: never in backups, progress codes
   or the project. */
const SYNC=(()=>{
  const SKEY="mcu-sync:v1", API="https://api.github.com", FILE="sacred-timeline.json",
        PARTS=["watched","extra","hidden"];
  let cfg=null;                                  /* {token, name, gist, stamps, last} */
  let snap={}, pushT=null, busy=false, again=false, status="";
  const k=(p,id)=>p+":"+id;
  const snapshot=()=>{ const s={}; PARTS.forEach(p=>{ for(const id in state[p]) s[k(p,id)]=JSON.stringify(state[p][id]); }); return s; };
  const persist=()=>store.set(SKEY,cfg?JSON.stringify(cfg):"").catch(()=>{});
  const desc=n=>`Sacred Timeline sync — ${n}`;
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);

  async function gh(path,opt={}){
    const r=await fetch(API+path,{...opt,cache:"no-store",headers:{Accept:"application/vnd.github+json",
      Authorization:`Bearer ${cfg.token}`,"X-GitHub-Api-Version":"2022-11-28"}});
    if(r.status===401) throw new Error("token");
    if(r.status===404) throw new Error("missing");
    if(r.status===403) throw new Error(r.headers.get("x-ratelimit-remaining")==="0"?"busy":"permission");
    if(!r.ok) throw new Error("net");
    return r.json();
  }
  const body=()=>JSON.stringify({app:"sacred-timeline",v:1,saved:new Date().toISOString(),
    watched:state.watched,extra:state.extra,hidden:state.hidden,stamps:cfg.stamps});
  const write=()=>gh(`/gists/${cfg.gist}`,{method:"PATCH",body:JSON.stringify({files:{[FILE]:{content:body()}}})});

  async function findOrCreate(){
    for(let page=1;page<=5;page++){
      const list=await gh(`/gists?per_page=100&page=${page}`);
      const hit=list.find(g=>g.description===desc(cfg.name) && g.files && g.files[FILE]);
      if(hit) return hit.id;
      if(list.length<100) break;
    }
    return (await gh("/gists",{method:"POST",body:JSON.stringify({description:desc(cfg.name),public:false,
      files:{[FILE]:{content:body()}}})})).id;
  }

  /* per title: the newer change wins; returns which sides need updating */
  function merge(remote){
    const rs=remote.stamps||{}, ls=cfg.stamps, keys=new Set([...Object.keys(rs),...Object.keys(ls)]);
    PARTS.forEach(p=>{ Object.keys(remote[p]||{}).forEach(id=>keys.add(k(p,id))); Object.keys(state[p]).forEach(id=>keys.add(k(p,id))); });
    let local=false, out=false;
    for(const key of keys){
      const i=key.indexOf(":"), p=key.slice(0,i), id=key.slice(i+1);
      if(!PARTS.includes(p)) continue;
      const lt=ls[key]||0, rt=rs[key]||0, lv=state[p][id], rv=(remote[p]||{})[id];
      if(JSON.stringify(lv)===JSON.stringify(rv)){ if(rt>lt) ls[key]=rt; continue; }
      if(rt>lt || (rt===lt && lv===undefined)){
        if(rv===undefined) delete state[p][id]; else state[p][id]=rv;
        if(rt) ls[key]=rt; else delete ls[key];
        local=true;
      } else out=true;
    }
    return {local,out};
  }

  async function sync(){
    if(!cfg) return;
    if(busy){ again=true; return; }
    busy=true; clearTimeout(pushT); show("Syncing…");
    try{
      if(!cfg.gist){ cfg.gist=await findOrCreate(); await persist(); }
      const f=((await gh(`/gists/${cfg.gist}`)).files||{})[FILE];
      const remote=f ? JSON.parse(f.truncated ? await (await fetch(f.raw_url,{cache:"no-store"})).text() : f.content||"{}") : {};
      const {local,out}=merge(remote);
      if(local){ snap=snapshot(); save(); render(true); renderStats(); renderSettings(); }
      if(out || !f) await write();
      cfg.last=Date.now(); await persist(); show();
    }catch(e){
      if(e.message==="missing" && cfg.gist){ cfg.gist=null; await persist(); again=true; return; }   /* Gist deleted: make a new one */
      show({token:"GitHub didn’t accept the token. Check it and connect again.",
            permission:"The token can’t use Gists. It needs Gists: read and write.",
            busy:"GitHub is limiting requests right now. It will try again later."}[e.message]
           || "Couldn’t reach GitHub. Changes are kept here and will sync later.");
    }finally{ busy=false; if(again){ again=false; sync(); } }
  }

  /* called by save(): note which titles changed, then sync shortly after */
  function noteChange(){
    const cur=snapshot();
    if(cfg){
      const now=Date.now();
      for(const key in cur) if(cur[key]!==snap[key]) cfg.stamps[key]=now;
      for(const key in snap) if(!(key in cur)) cfg.stamps[key]=now;
      persist(); clearTimeout(pushT); pushT=setTimeout(sync,2500);
    }
    snap=cur;
  }

  function ago(t){
    const s=Math.round((Date.now()-t)/1000);
    return s<45?"just now":s<5400?`${Math.max(1,Math.round(s/60))} min ago`:new Date(t).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  }
  function show(msg){
    status=msg || (cfg&&cfg.last?`Synced ${ago(cfg.last)}.`:"");
    const el=document.getElementById("syncStatus"); if(el) el.textContent=status;
  }

  /* after a while away, pull on return; send anything pending when leaving */
  document.addEventListener("visibilitychange",()=>{
    if(!cfg) return;
    if(document.hidden){ if(pushT){ clearTimeout(pushT); sync(); } }
    else if(Date.now()-(cfg.last||0)>20000) sync();
  });

  return {
    async init(){
      try{ const r=await store.get(SKEY); if(r&&r.value) cfg=JSON.parse(r.value); }catch(e){}
      snap=snapshot();
      if(cfg){ show(); sync(); }
    },
    noteChange,
    async connect(token,name){
      cfg={token:token.trim(),name:name.trim()||"Me",gist:null,stamps:{},last:0};
      await persist(); await sync();
      if(!cfg.last){ cfg=null; await persist(); }        /* it didn't work: forget the token again */
      renderSettings(); show(status);
    },
    async disconnect(){ cfg=null; clearTimeout(pushT); await persist(); status=""; renderSettings(); },
    now:sync,
    card(){
      if(cfg) return `
        <p id="syncStatus">${esc(status||"Syncing…")}</p>
        <div class="artrow">
          <button class="btn primary" id="syncNow">Sync now</button>
          <button class="btn" id="syncOff">Stop syncing on this device</button>
          <span style="color:var(--ink-faint);font-size:11.5px;flex:1 1 220px;line-height:1.5">Tracker “${esc(cfg.name)}”. Watched titles, ratings, notes, episodes and hidden titles sync; artwork and display settings stay with each device.</span>
        </div>`;
      return `
        <p id="syncStatus">${esc(status)||"Keep this tracker the same on every device. It is saved in a secret Gist on your GitHub account."}</p>
        <div class="artrow">
          <input type="text" id="syncName" placeholder="Tracker name, e.g. Me or Mum" autocomplete="off" maxlength="40">
          <input type="password" id="syncToken" placeholder="GitHub token" autocomplete="off">
          <button class="btn primary" id="syncOn">Connect</button>
        </div>
        <details class="pasteart">
          <summary>How to get a token</summary>
          <p>On github.com: your picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Give it a name, choose an expiry, then under Account permissions set <em>Gists</em> to <em>Read and write</em>. Generate it, copy it, and paste it above.</p>
          <p style="margin-top:8px">Use the same tracker name on each of your devices. Someone else using the same account picks a different name and gets a separate tracker. The token is kept in this browser only.</p>
        </details>`;
    },
    wire(){
      const on=$("#syncOn"), now=$("#syncNow"), off=$("#syncOff");
      if(on) on.addEventListener("click",()=>{
        const t=$("#syncToken").value, n=$("#syncName").value;
        if(!t.trim()){ toast("Paste a GitHub token first."); return; }
        on.disabled=true; on.textContent="Connecting…";
        SYNC.connect(t,n);
      });
      if(now) now.addEventListener("click",()=>sync());
      if(off) off.addEventListener("click",()=>{
        if(confirm("Stop syncing on this device? Your progress stays here and in the Gist; this device just stops updating it.")) SYNC.disconnect();
      });
    }
  };
})();

/* ---------- length ---------- */
function hhmm(min){
  if(!min) return "";
  const h=Math.floor(min/60), m=Math.round(min%60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function episodesOf(m){
  /* a season entry keeps its own count — TMDB reports the whole series,
     which would turn Loki S1 into 12 episodes and What If…? S1 into 26 */
  if(m.sea) return m.ep||0;
  const e=meta[m.id]||{};
  return e.ep||m.ep||0;
}
function totalMinutes(m){
  const e=meta[m.id]||{};
  if(m.t==="series"){
    if(m.tmin) return m.tmin;                /* sourced total, most reliable */
    const eps=episodesOf(m);
    return (eps && e.epmin) ? eps*e.epmin : 0;
  }
  return e.min||m.min||0;
}
/* ---------- watched state ----------
   A title is one of three things: not started, part way through, or done.
   Only series can be part way through: their record carries an episode count.
   Older records have no episode count, which means watched in full. */
function rec(m){ return state.watched[m.id]; }

/* ---------- watch history ----------
   A record holds w: every date you watched it, oldest first. Older records
   only had a date and a count, so those are read as repeats of that date. */
function views(m){
  const r=rec(m); if(!r) return [];
  if(Array.isArray(r.w) && r.w.length) return r.w;
  return Array(Math.max(1, r.n||1)).fill(r.d||today());
}
function viewCount(m){ return views(m).length; }
function lastView(m){ const v=views(m); return v[v.length-1]||""; }
function addView(id,date){
  const r=state.watched[id]; if(!r) return;
  const w=views(BY_ID[id]).slice(); w.push(date||today()); w.sort();
  state.watched[id]=Object.assign({},r,{w, d:w[w.length-1], n:w.length});
}
function dropView(id,i){
  const r=state.watched[id]; if(!r) return;
  const w=views(BY_ID[id]).slice();
  if(w.length<=1) return;
  w.splice(i,1);
  state.watched[id]=Object.assign({},r,{w, d:w[w.length-1], n:w.length});
}
function editView(id,i,date){
  const r=state.watched[id]; if(!r) return;
  const w=views(BY_ID[id]).slice(); w[i]=date; w.sort();
  state.watched[id]=Object.assign({},r,{w, d:w[w.length-1], n:w.length});
}

/* ---------- ratings and notes ----------
   Kept apart from the watch log so they survive resetting it. */
function extraOf(id){ return state.extra[id]||{}; }
function setExtra(id,patch){
  const e=Object.assign({},state.extra[id],patch);
  if(!e.rate && !e.note) delete state.extra[id]; else state.extra[id]=e;
  save();
}
function epsSeenOf(m){
  const r=rec(m); if(!r) return 0;
  if(m.t!=="series") return 0;
  return r.ep===undefined ? episodesOf(m) : r.ep;
}
function isDone(m){
  const r=rec(m); if(!r) return false;
  if(m.t!=="series") return true;
  const tot=episodesOf(m);
  return r.ep===undefined || !tot || r.ep>=tot;
}
function isPart(m){
  const r=rec(m);
  return !!(r && m.t==="series" && r.ep!==undefined && r.ep>0 && r.ep<episodesOf(m));
}
function started(m){ return !!rec(m); }
/* minutes actually watched, counting a part-finished series proportionally */
function minutesSeen(m){
  const tot=totalMinutes(m); if(!tot) return 0;
  if(isDone(m)) return tot;
  if(isPart(m)){ const e=episodesOf(m); return e ? Math.round(tot*epsSeenOf(m)/e) : 0; }
  return 0;
}

function lengthLabel(m){
  if(m.t==="series"){
    const eps=episodesOf(m);
    if(!eps) return "";
    const tot=totalMinutes(m);
    return tot ? `${eps} episodes · ${hhmm(tot)}` : `${eps} episodes`;
  }
  return hhmm(totalMinutes(m));
}
function say(t){ const s=$("#status"); s.textContent=t; if(t) setTimeout(()=>{ if(s.textContent===t) s.textContent=""; },4500); }
const $ = s=>document.querySelector(s);

/* ============================ THEME ============================ */
const THEMES={phase:"Timeline",stark:"Stark",tva:"TVA"};
function applyPrefs(){
  const b=document.body;
  b.classList.toggle("theme-stark", state.theme==="stark");
  b.classList.toggle("theme-tva",   state.theme==="tva");
  b.classList.toggle("compact",     !!state.compact);
  b.classList.toggle("nofx",        !state.fx);
}
const fxOn=()=> state.fx && !matchMedia("(prefers-reduced-motion: reduce)").matches;

let lastBif=0;
function applyTheme(p, preview){
  if(!preview) settledPhase=p;
  if(p===themePhase) return;
  const first = themePhase===0;
  themePhase=p;
  const pal=PHASES[p]||{c:"#8fa4c8",c2:"#3c4e6b",glow:"rgba(120,150,200,.22)"};
  const rs=document.documentElement.style;
  rs.setProperty("--accent",pal.c); rs.setProperty("--accent-2",pal.c2); rs.setProperty("--glow",pal.glow);
  if(!preview && !first && fxOn() && window.__bifrost && Date.now()-lastBif>3200){
    lastBif=Date.now(); window.__bifrost();
  }
}

/* ============================ STARFIELD ============================ */
(function(){
  const cv=$("#stars"), ctx=cv.getContext("2d");
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small=innerWidth<=620;
  let stars=[],w=0,h=0,dpr=Math.min(devicePixelRatio||1,small?1.5:2),scrollY=0;
  function size(){
    w=innerWidth;h=innerHeight;cv.width=w*dpr;cv.height=h*dpr;
    cv.style.width=w+"px";cv.style.height=h+"px";ctx.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:Math.round(w*h/(small?16000:9000))},()=>({
      x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.25+.25,
      z:Math.random()*.8+.2,t:Math.random()*6.28,s:Math.random()*.02+.004}));
  }
  addEventListener("scroll",()=>{scrollY=window.scrollY;
    $("#controls").classList.toggle("stuck", window.scrollY>10);},{passive:true});
  addEventListener("resize",size); size();
  const BIF=["#4ea6ff","#a678ff","#ffc23d","#3ddc97","#ff77c2","#ff5347"];
  let beams=[];
  window.__bifrost=()=>{ if(reduce||beams.length>2) return;
    beams.push({t:0,y:h*(.18+Math.random()*.5),d:Math.random()<.5?-1:1}); };
  (function frame(){
    requestAnimationFrame(frame);
    if(document.hidden) return;                      /* no work in a background tab */
    if(document.body.classList.contains("egging")) return;   /* an Easter egg has the frame budget; the last frame stays up */
    ctx.clearRect(0,0,w,h);
    /* group stars into eight alpha buckets so this is 8 fills a frame, not one per star */
    const buckets=[[],[],[],[],[],[],[],[]];
    for(const st of stars){
      if(!reduce) st.t+=st.s;
      const tw=reduce?.6:.45+Math.sin(st.t)*.35;
      const a=tw*st.z;
      const y=((st.y-(scrollY*st.z*.10))%h+h)%h;
      buckets[Math.min(7,(a*8)|0)].push(st.x,y,st.r);
    }
    for(let i=0;i<8;i++){
      const b=buckets[i]; if(!b.length) continue;
      ctx.fillStyle=`rgba(214,228,255,${((i+.5)/8).toFixed(3)})`;
      ctx.beginPath();
      for(let k=0;k<b.length;k+=3){ ctx.moveTo(b[k]+b[k+2],b[k+1]); ctx.arc(b[k],b[k+1],b[k+2],0,6.2832); }
      ctx.fill();
    }
    if(beams.length){
      ctx.save(); ctx.globalCompositeOperation="lighter";
      for(const b of beams){
        b.t+=.011;
        const p=b.t; if(p>=1) continue;
        const env=Math.sin(Math.PI*p), rise=w*.22*b.d;
        const x0=-w*.15, x1=w*1.15, y0=b.y+rise, y1=b.y-rise;
        const g=ctx.createLinearGradient(x0,y0,x1,y1);
        BIF.forEach((c,i)=>g.addColorStop(i/(BIF.length-1),c));
        ctx.strokeStyle=g; ctx.globalAlpha=env*.42; ctx.lineCap="round";
        ctx.lineWidth=1.5+env*7; ctx.filter="blur(2px)";
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
        ctx.filter="none"; ctx.globalAlpha=env*.85; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
        const hx=x0+(x1-x0)*p, hy=y0+(y1-y0)*p;
        ctx.globalAlpha=env; ctx.beginPath(); ctx.arc(hx,hy,2+env*4,0,6.2832);
        ctx.fillStyle="#f2f7ff"; ctx.fill();
      }
      ctx.restore();
      beams=beams.filter(b=>b.t<1);
    }
  })();})();

/* ============================ POSTER ART ============================ */
/* A value is either an embedded image, a full URL, or a bare TMDB path that
   needs the CDN prefix. Only the last case gets prefixed — data: URLs used to
   fall through to it and come out mangled. In the src/ project, built-in
   posters are files under assets/ and must not be prefixed either. */
const isURL = p => /^(https?:|data:|blob:|assets\/)/.test(p||"");
const IMG     = p => isURL(p) ? p : "https://image.tmdb.org/t/p/w185"+p;
const IMG_BIG = p => isURL(p) ? p : "https://image.tmdb.org/t/p/w500"+p;
function artOf(m){ const e=meta[m.id]; return e&&e.p ? e.p : ""; }
function artCount(){ return DATA.filter(m=>artOf(m)).length; }
function setArt(id,url){
  meta[id]=Object.assign({},meta[id],{p:url});
  saveMeta(); render();
}

/* deterministic fallback key-art, drawn from the title itself — cached,
   since it never changes and render() runs on every filter keystroke */
const sigilCache={};
function sigil(m){
  if(sigilCache[m.id]) return sigilCache[m.id];
  let h=0; for(const ch of m.id+m.ti) h=(h*31+ch.charCodeAt(0))>>>0;
  const R=()=> (h=(h*1664525+1013904223)>>>0, h/4294967296);
  const pal=PHASES[m.p], rings=2+Math.floor(R()*3), tilt=R()*360;
  let g="";
  for(let i=0;i<rings;i++){
    const rr=14+i*11+R()*6, dash=6+R()*16;
    g+=`<circle cx="42" cy="58" r="${rr.toFixed(1)}" fill="none" stroke="${pal.c}"
        stroke-width="${(1.4-i*.25).toFixed(2)}" stroke-dasharray="${dash.toFixed(1)} ${(dash*.7).toFixed(1)}"
        opacity="${(.85-i*.18).toFixed(2)}" transform="rotate(${(tilt+i*47).toFixed(0)} 42 58)"/>`;
  }
  for(let i=0;i<9;i++) g+=`<circle cx="${(R()*84).toFixed(1)}" cy="${(R()*126).toFixed(1)}"
        r="${(R()*1.1+.3).toFixed(2)}" fill="#dce7ff" opacity="${(R()*.6+.2).toFixed(2)}"/>`;
  g+=`<circle cx="42" cy="58" r="${(5+R()*4).toFixed(1)}" fill="${pal.c}" opacity=".9"/>`;
  return sigilCache[m.id]=`<svg viewBox="0 0 84 126" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="bg${m.id}" cx="50%" cy="42%">
      <stop offset="0%" stop-color="${pal.c2}" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#05060a"/></radialGradient></defs>
    <rect width="84" height="126" fill="url(#bg${m.id})"/>${g}</svg>`;
}

/* ---------- local artwork import ----------
   Images you drop in are downscaled and stored in this browser only.
   Nothing is uploaded and nothing leaves the machine. */
const norm = s => s.toLowerCase().replace(/\.[a-z0-9]+$/,"").replace(/[^a-z0-9]/g,"");
const tokens = s => s.toLowerCase().replace(/\.[a-z0-9]+$/,"").split(/[^a-z0-9]+/).filter(Boolean);

function matchTitle(filename){
  const nf=norm(filename), tf=new Set(tokens(filename));
  let best=null, bestScore=0;
  for(const m of DATA){
    const nt=norm(m.ti), ni=norm(m.id);
    let score=0;
    if(nf===nt||nf===ni) score=100;
    else if(nt.includes(nf)||nf.includes(nt))
      score=80*Math.min(nf.length,nt.length)/Math.max(nf.length,nt.length);
    else{
      const tt=new Set(tokens(m.ti));
      let hit=0; tf.forEach(t=>{ if(tt.has(t)) hit++; });
      score = tt.size ? 62*hit/Math.max(tf.size,tt.size) : 0;
    }
    if(score>bestScore){ bestScore=score; best=m.id; }
  }
  return bestScore>=36 ? best : null;
}

function shrink(file,maxW){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error("read"));
    fr.onload=()=>{
      const img=new Image();
      img.onerror=()=>rej(new Error("decode"));
      img.onload=()=>{
        const w=Math.min(maxW,img.width), h=Math.round(img.height*(w/img.width));
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",.72));
      };
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function importImages(files,forceId){
  const list=[...files].filter(f=>/^image\//.test(f.type));
  if(!list.length){ toast("No image files in that drop."); return; }
  let ok=0; const missed=[];
  for(const f of list){
    const id = forceId || matchTitle(f.name);
    if(!id){ missed.push(f.name); continue; }
    try{
      meta[id]=Object.assign({},meta[id],{p:await shrink(f,300)});
      ok++;
    }catch(e){ missed.push(f.name); }
    if(ok%4===0) updateArtPanel();
  }
  saveMeta(); render(); renderStats();
  const size=Math.round(JSON.stringify(meta).length/1024);
  let msg=`${ok} image${ok===1?"":"s"} matched and stored (${size} KB).`;
  if(missed.length) msg+=` ${missed.length} not matched — rename to the title and drop again.`;
  toast(msg,{ms:6500});
  if(size>3800) say("Stored artwork is getting close to the browser’s limit. Consider fewer or smaller images.");
}

/* whole-page drop target, so you can drop a folder's worth at once */
addEventListener("dragover",e=>{ if(e.dataTransfer?.types.includes("Files")){ e.preventDefault(); document.body.classList.add("dropping"); }});
addEventListener("dragleave",e=>{ if(e.relatedTarget===null) document.body.classList.remove("dropping"); });
addEventListener("drop",e=>{
  if(!e.dataTransfer?.files?.length) return;
  e.preventDefault(); document.body.classList.remove("dropping");
  const row=e.target.closest?.("li.entry");
  importImages(e.dataTransfer.files, row?row.dataset.id:null);
});

/* paste a block of "title | url" lines, or bare urls in release order */
function importUrlList(text){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return;
  const byRelease=DATA.slice().sort((a,b)=>a.r.localeCompare(b.r));
  let ok=0; const missed=[];
  lines.forEach((line,i)=>{
    const parts=line.split(/\s*[|,\t]\s*/);
    const url=parts.length>1 ? parts[parts.length-1] : parts[0];
    if(!/^https?:\/\//.test(url)){ missed.push(line.slice(0,40)); return; }
    let id = parts.length>1 ? matchTitle(parts.slice(0,-1).join(" ")) : null;
    if(!id && parts.length===1) id = byRelease[i] ? byRelease[i].id : null;
    if(!id){ missed.push(line.slice(0,40)); return; }
    meta[id]=Object.assign({},meta[id],{p:url}); ok++;
  });
  saveMeta(); render(); renderStats(); updateArtPanel();
  toast(`${ok} linked.${missed.length?` ${missed.length} lines didn’t match.`:""}`,{ms:5500});
}

/* Convert remote artwork into downscaled images held in this browser, so
   startup stops making ~60 network requests. */
/* assets/ posters ship with the src/ project, so they count as local too */
function isLocal(p){ return /^(data:|assets\/)/.test(p||""); }
function localCount(){ return DATA.filter(m=>isLocal(artOf(m))).length; }

/* Copying an image via fetch() and via <img> use different browser permissions.
   Sandboxed viewers commonly allow images to display but block fetches to the
   same host, so try the image route first and only fall back to fetch. */
function imgToDataURL(url,maxW){
  return new Promise((res,rej)=>{
    let settled=false;
    const finish=(fn,v)=>{ if(!settled){ settled=true; fn(v); } };
    const im=new Image();
    im.crossOrigin="anonymous";
    im.onload=()=>{
      try{
        const w=Math.min(maxW,im.naturalWidth||maxW);
        const h=Math.round((im.naturalHeight||maxW*1.5)*(w/(im.naturalWidth||maxW)));
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(im,0,0,w,h);
        finish(res,c.toDataURL("image/jpeg",.72));
      }catch(e){ finish(rej,new Error("canvas blocked")); }
    };
    im.onerror=()=>finish(rej,new Error("image blocked"));
    /* a copy of this image already sitting in the cache was fetched without
       cross-origin headers, and reusing it fails — force a fresh request */
    im.src=url+(url.includes("?")?"&":"?")+"cors="+Date.now();
    setTimeout(()=>finish(rej,new Error("timed out")),25000);
  });
}

async function localiseArt(){
  if(fetching) return;
  const remote=DATA.filter(m=>{ const p=artOf(m); return p && !isLocal(p); });
  if(!remote.length){ toast("Everything with artwork is already stored locally."); return; }
  fetching=true; updateArtPanel();
  let ok=0, fail=0, why="";
  for(const m of remote){
    const url=IMG_BIG(artOf(m));
    let data=null;
    try{ data=await imgToDataURL(url,380); }
    catch(e){
      why=e.message;
      try{
        const res=await fetch(url,{mode:"cors"});
        if(res.ok) data=await shrink(await res.blob(),380);
      }catch(e2){ why=e2.message||why; }
    }
    if(data){ meta[m.id]=Object.assign({},meta[m.id],{p:data}); ok++; }
    else fail++;
    if((ok+fail)%5===0) updateArtPanel(ok+fail,remote.length);
  }
  /* one more go at the stragglers — these usually fail on timing, not policy */
  const left=DATA.filter(m=>{ const p=artOf(m); return p && !isLocal(p); });
  for(const m of left){
    try{
      meta[m.id]=Object.assign({},meta[m.id],{p:await imgToDataURL(IMG_BIG(artOf(m)),380)});
      ok++; fail--;
    }catch(e){}
  }
  saveMeta(); fetching=false; render(); renderStats();
  const size=Math.round(JSON.stringify(meta).length/1024);
  if(ok>0) toast(`${ok} image${ok===1?"":"s"} embedded (${size} KB).`,{ms:6000});
  const stuck=DATA.filter(m=>{ const p=artOf(m); return p && !isLocal(p); });
  if(stuck.length) toast(`${stuck.length} still wouldn’t copy${why?` — ${why}`:""}: ${stuck.map(m=>m.ti).join(", ")}. Drop an image onto those rows to set them by hand.`,{ms:12000});
  if(size>3800) say("Stored artwork is near the browser’s limit.");
}

/* Is the image host actually reachable here? Paths are useless if it isn’t. */
let imgHost=null;   /* null = untested, true = loads, false = blocked */
function probeImageHost(){
  if(imgHost!==null) return Promise.resolve(imgHost);
  return new Promise(res=>{
    const done=v=>{ if(imgHost===null){ imgHost=v; res(v); updateArtPanel(); } };
    const i=new Image();
    i.onload=()=>done(true);
    i.onerror=()=>done(false);
    i.src="https://image.tmdb.org/t/p/w92/78lPtwv72eTNqFW9COBYI0dWDJa.jpg?p="+Date.now();
    setTimeout(()=>done(false),7000);
  });
}

let fetching=false, keyBad=false, netBlocked=false, lastErr="";
async function fetchMeta(force){
  if(!state.tmdb || fetching) return;
  /* retries anything still without art, so a failed lookup isn’t permanent */
  const want = DATA.filter(m => force || !artOf(m));
  if(!want.length){
    toast(imgHost===false
      ? "Every title already has a path, but this device can’t load images from the web — restore a backup with stored images instead."
      : "Everything already has artwork.");
    return;
  }
  fetching=true; updateArtPanel();
  let n=0, fails=0;
  const K=encodeURIComponent(state.tmdb);

  for(const m of want){
    /* TMDB files the one-off specials as movies, not TV — only true series use /tv */
    const tv = m.t==="series";
    const kind = tv ? "tv" : "movie";
    const q = encodeURIComponent(m.q || m.ti);
    const yearParam = tv ? `&first_air_date_year=${m.y}` : `&primary_release_year=${m.y}`;
    try{
      const url = y => `https://api.themoviedb.org/3/search/${kind}?api_key=${K}&query=${q}${y}`;
      let res = await fetch(url(yearParam));
      if(res.status===401){
        keyBad=true;
        toast("TMDB rejected that key. Check it in the Artwork panel — v3 keys are 32 characters.",{ms:7000});
        break;
      }
      let j = await res.json();
      /* a wrong year in our data shouldn’t lose the title — try again unfiltered */
      if(!(j.results && j.results.length)){
        j = await (await fetch(url(""))).json();
      }
      const hit = j.results && j.results[0];
      const rec = meta[m.id] = Object.assign({}, meta[m.id], {p:(hit&&hit.poster_path)||""});

      if(hit){
        const d = await (await fetch(`https://api.themoviedb.org/3/${kind}/${hit.id}?api_key=${K}`)).json();
        if(tv){
          /* season entries keep their own counts — TMDB reports the whole series */
          if(!m.sea && d.number_of_episodes) rec.ep=d.number_of_episodes;
          const per = Array.isArray(d.episode_run_time) && d.episode_run_time.length
            ? Math.round(d.episode_run_time.reduce((a,b)=>a+b,0)/d.episode_run_time.length) : 0;
          if(per) rec.epmin=per;
        } else if(d.runtime) rec.min=d.runtime;
      }
    }catch(e){
      fails++; lastErr=e && e.message ? e.message : String(e);
      meta[m.id]=Object.assign({},meta[m.id],{p:""});
      if(fails>3){
        netBlocked=true;
        toast("This device is blocking requests to TMDB, so no artwork can be fetched here. Restore a backup from a device where it worked.",{ms:9000});
        break;
      }
    }
    n++;
    if(n%5===0){ saveMeta(); render(); updateArtPanel(n,want.length); }
    await new Promise(r=>setTimeout(r,110));
  }
  saveMeta(); fetching=false; render(); renderStats();
  if(n) toast(`Artwork and lengths loaded for ${artCount()} titles.`);
}
function updateArtPanel(n,total){
  const el=document.getElementById("artstatus");
  if(!el) return;
  if(fetching){ el.textContent = total ? `Loading… ${n}/${total}` : "Loading…"; return; }
  if(keyBad){ el.textContent = "The saved TMDB key was rejected — paste a valid one below, or import your own images."; return; }
  if(netBlocked){
    el.textContent = `This device won’t let the page reach TMDB${lastErr?` (${lastErr})`:""}. Fetching can’t work here — drop images in below, or restore a backup exported from a device where it did work.`;
    return;
  }
  const have=artCount(), loc=localCount();
  let line=`${have} of ${DATA.length} titles have artwork — ${loc} stored in this browser, ${have-loc} pointing at the web.`;
  if(imgHost===false && have-loc>0)
    line+=" This device won’t load images from the web, so those show generated art instead. Stored images do work: on a device where posters appear, press Store images locally, Export backup, then restore that file here.";
  else if(imgHost===true && have-loc>0) line+=" Image host reachable.";
  else if(imgHost===null) line+=" Checking the image host…";
  el.textContent=line;
}

/* ============================ FILTER / SORT / GROUP ============================ */
/* Everything about a title that someone might reasonably type: its name,
   years, phase and saga, era, kind, setting, length and status. */
function haystack(m){
  const r=rec(m);
  const bits=[
    m.ti, m.q||"", m.y, m.r.slice(0,4),
    "phase "+m.p, "p"+m.p, PHASES[m.p].name, PHASES[m.p].tag,
    m.p<=3?"infinity saga":"multiverse saga",
    ERAS[m.e], m.w,
    m.t, m.t==="film"?"movie":"", m.t==="series"?"show tv":"",
    hhmm(totalMinutes(m)), totalMinutes(m)?Math.round(totalMinutes(m)/60)+"h":"",
    m.t==="series"?episodesOf(m)+" episodes":"",
    m.r>today()?"upcoming unreleased":"released",
    isDone(m)?"watched seen done":(isPart(m)?"part watching progress":"unwatched unseen"),
    r&&r.n>1?"rewatch":"",
    r?r.d:""
  ];
  return bits.join(" ").toLowerCase();
}
const hayCache={};
function matches(m,tokens){
  const key=m.id+"|"+(rec(m)?JSON.stringify(rec(m)):"");
  if(hayCache[m.id+"#k"]!==key){ hayCache[m.id]=haystack(m); hayCache[m.id+"#k"]=key; }   /* rebuilt only when that title changes */
  const h=hayCache[m.id]||haystack(m);
  return tokens.every(t=>h.includes(t));
}
function visible(){
  const tokens=state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lim=Number(state.maxlen||0);
  return DATA.filter(m=>{
    if(!state.series && m.t!=="film") return false;
    if(state.hidden[m.id]) return false;
    if(snapped.has(m.id)) return false;          /* gone in the snap, until blip (view only) */
    /* hidden only when nothing else is asking to see them */
    if(state.hideFuture && m.r>today() && state.show!=="unseen" && !state.q.trim()) return false;
    if(state.phase && m.p!==state.phase) return false;
    const seen=isDone(m);
    if(state.show==="seen" && !seen) return false;
    if(state.show==="unseen" && seen) return false;
    if(state.show==="part" && !isPart(m)) return false;
    if(lim){
      const t=totalMinutes(m);
      if(!t) return false;
      if(lim===999 ? t<=150 : t>lim) return false;
    }
    if(tokens.length && !matches(m,tokens)) return false;
    return true;
  });
}
function sorted(list){
  const byRel=(a,b)=>a.r.localeCompare(b.r), s=state.sort, out=list.slice();
  if(s==="release") out.sort(byRel);
  else if(s==="chrono") out.sort((a,b)=>a.c-b.c);
  else if(s==="sacred") out.sort((a,b)=>sacredKey(a)-sacredKey(b));
  else if(s==="phase"||s==="saga") out.sort((a,b)=>a.p-b.p||byRel(a,b));
  else if(s==="az") out.sort((a,b)=>a.ti.replace(/^The /,"").localeCompare(b.ti.replace(/^The /,"")));
  else if(s==="next") out.sort((a,b)=>{
    const sa=isDone(a), sb=isDone(b);
    return sa!==sb ? (sa?1:-1) : byRel(a,b);
  });
  else if(s==="short"||s==="long"){
    /* anything with no known length sorts to the end either way */
    const dir=s==="short"?1:-1;
    out.sort((a,b)=>{
      const ta=totalMinutes(a), tb=totalMinutes(b);
      if(!ta&&!tb) return byRel(a,b);
      if(!ta) return 1;
      if(!tb) return -1;
      return (ta-tb)*dir || byRel(a,b);
    });
  }
  return out;
}
const SEQUENTIAL = s => s==="release"||s==="chrono"||s==="sacred"||s==="phase"||s==="saga";
/* Chronological, but branched realities wait until after Loki rather than
   being interleaved with the main timeline. Eyes of Wakanda is Wakandan
   history, not a branch, so it sits at the very start. */
function sacredKey(m){
  if(m.id==="eow") return 10;
  return m.branch ? 1000+m.c : m.c;
}
function groupOf(m){
  const s=state.sort;
  if(s==="chrono") return {k:"e"+m.e, label:ERAS[m.e], phase:m.p};
  if(s==="sacred"){
    if(m.branch) return {k:"branch", label:"Branched realities", phase:m.p};
    if(m.id==="eow") return {k:"e0", label:ERAS[0], phase:m.p};
    return {k:"e"+m.e, label:m.e===6?"At the TVA":ERAS[m.e], phase:m.p};
  }
  if(s==="saga"){ const k=m.p<=3?"infinity":"multiverse"; return {k, label:SAGAS[k], phase:m.p}; }
  if(s==="az"||s==="next"||s==="short"||s==="long") return {k:"flat", label:null, phase:m.p};
  return {k:"p"+m.p, label:PHASES[m.p].name+" · "+PHASES[m.p].tag, phase:m.p};
}

/* ============================ FLIP REORDER ============================ */
function snapshot(){
  const map=new Map();
  document.querySelectorAll("li.entry").forEach(el=>map.set(el.dataset.id, el.getBoundingClientRect()));
  return map;
}
function flip(before){
  if(!before || !before.size) return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  /* only rows that are (or were) near the screen animate; long moves are
     clamped so rows don't streak across it, and durations are capped */
  const rows=[...document.querySelectorAll("li.entry")], H=innerHeight, near=r=>r.bottom>-H*.5 && r.top<H*1.5;
  let k=0;
  rows.forEach(el=>{
    const b=before.get(el.dataset.id);
    const a=el.getBoundingClientRect();
    if(!b){
      if(!near(a)) return;
      el.animate([{opacity:0,transform:"translateY(12px)"},{opacity:1,transform:"none"}],
        {duration:450,delay:Math.min(160,(k++)*12),easing:"cubic-bezier(.2,.8,.3,1)",fill:"backwards"});
      return;
    }
    if(!near(a) && !near(b)) return;
    let dy=b.top-a.top; const dx=b.left-a.left;
    if(Math.abs(dy)<2 && Math.abs(dx)<2) return;
    dy=Math.max(-H*.6,Math.min(H*.6,dy));
    el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"none"}],
      {duration:Math.min(600, 380+Math.abs(dy)*.5), delay:Math.min(160,(k++)*12),
       easing:"cubic-bezier(.25,.8,.3,1)", fill:"backwards"});
  });
}

/* ============================ RENDER ============================ */
const listEl=$("#list");
let io;

function render(animate){
  let anchor=null;
  if(animate){
    const rows=[...listEl.querySelectorAll("li.entry")];
    const a=rows.find(el=>el.getBoundingClientRect().bottom>80) || rows[0];
    if(a) anchor={id:a.dataset.id, top:a.getBoundingClientRect().top};
  }
  const before = animate ? snapshot() : null;
  const items = sorted(visible());
  listEl.innerHTML="";

  if(!items.length){
    const filtered=state.phase||state.show!=="all"||state.q.trim()||state.maxlen;
    listEl.innerHTML = `<div class="empty"><b>Nothing matches</b>Clear a filter, or switch on series and specials to widen the field.${filtered?`<button class="btn" id="emptyClear" style="margin-top:12px">Clear filters</button>`:""}</div>`;
    const ec=document.getElementById("emptyClear"); if(ec) ec.addEventListener("click",clearFilters);
    renderTally(); renderNext(); renderCountdown(); renderFilterBar(); return;
  }

  let cur=null, ol=null, count=0, headEl=null;
  const flush=()=>{ if(headEl&&cur) headEl.querySelector(".meta").textContent = count+(count===1?" title":" titles"); };

  items.forEach((m,i)=>{
    const g=groupOf(m);
    if(!cur||g.k!==cur.k){
      flush(); cur=g; count=0;
      const sec=document.createElement("section");
      sec.className="group"; sec.dataset.phase=g.phase;
      if(g.label){
        sec.innerHTML=`<div class="group-head" style="--gc:${PHASES[g.phase].c}"><span class="dot"></span><h2>${g.label}</h2>
          <button class="groupmark" data-k="${g.k}" title="Mark everything in this section watched">Mark all</button>
          <span class="meta"></span></div>`;
        headEl=sec.firstChild;
        headEl.querySelector(".groupmark").addEventListener("click",e=>{
          e.stopPropagation(); markGroup(e.currentTarget.dataset.k,true);
        });
      } else headEl=null;
      ol=document.createElement("ol"); ol.className="spine";
      sec.appendChild(ol); listEl.appendChild(sec);
    }
    count++; ol.appendChild(entry(m,i+1));
  });
  flush(); observe(); renderTally(); renderNext(); renderCountdown(); renderFilterBar();

  if(justMarked){
    const el=listEl.querySelector(`li[data-id="${justMarked}"]`);
    if(el){ el.classList.add("just"); setTimeout(()=>el.classList.remove("just"),820); }
    justMarked=null;
  }
  if(cursorId){ const el=listEl.querySelector(`li[data-id="${cursorId}"]`); if(el) el.classList.add("cursor"); }

  if(anchor){
    const el=listEl.querySelector(`li[data-id="${anchor.id}"]`);
    if(el){
      const delta=el.getBoundingClientRect().top-anchor.top;
      if(Math.abs(delta)>1) window.scrollBy(0,delta);
    } else scrollTo({top:0});
  }
  flip(before);
}

/* Update one row in place instead of rebuilding all of them, when the list's
   order and contents would come out exactly the same (otherwise returns false
   and the caller does the full render). Keeps the same poster element, so its
   grey-to-colour fade plays; keeps keyboard focus; no poster flicker. */
function patchRow(id){
  const old=listEl.querySelector(`li.entry[data-id="${id}"]`); if(!old) return false;
  const want=sorted(visible()).map(m=>m.id), have=[...listEl.querySelectorAll("li.entry")].map(e=>e.dataset.id);
  if(want.length!==have.length || want.some((x,i)=>x!==have[i])) return false;
  const fresh=entry(BY_ID[id],have.indexOf(id)+1), to=fresh.className;
  const a=old.querySelector(".tile"), b=fresh.querySelector(".tile"); if(a&&b) b.replaceWith(a);
  const all=[...old.querySelectorAll("*")], fi=old.contains(document.activeElement)?all.indexOf(document.activeElement):-1;
  fresh.className=old.className.replace(/\b(just|cursor)\b/g," ").trim();   /* start from the old look... */
  old.replaceWith(fresh); void fresh.offsetWidth; fresh.className=to;        /* ...so the change animates */
  if(cursorId===id) fresh.classList.add("cursor");
  if(fi>=0){ const f=fresh.querySelectorAll("*")[fi]; if(f&&f.focus) f.focus({preventScroll:true}); }
  if(justMarked===id){ fresh.classList.add("just"); setTimeout(()=>fresh.classList.remove("just"),820); justMarked=null; }
  renderTally(); renderNext(); renderCountdown(); renderFilterBar();
  return true;
}

/* Netflix-style: the poster flashes up behind the page, then drifts away */
/* the big blurred poster behind an opened title. It is decoded first and
   started on a later frame, so the decode and blur don't land in the same
   frames as the row opening (that was a visible hitch on tap) */
let bdToken=0;
function flashBackdrop(m){
  if(!fxOn()) return;
  const path=artOf(m);
  if(!path) return;                       /* generated key art doesn’t scale up well */
  const el=$("#backdrop"), url=IMG_BIG(path), token=++bdToken;
  const im=new Image(); im.decoding="async"; im.src=url;
  const go=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(token!==bdToken || !openIds.has(m.id)) return;   /* a newer tap, or closed again */
    el.classList.remove("flash");
    void el.offsetWidth;                  /* restart the animation cleanly */
    el.style.setProperty("--bd",`url("${url}")`);
    el.classList.add("flash");
  }));
  (im.decode?im.decode():Promise.resolve()).then(go,go);
}
/* release the heavy blurred layers once the flash has played */
document.getElementById("backdrop").addEventListener("animationend",e=>{ if(e.target.id==="backdrop") e.target.classList.remove("flash"); });

function entry(m,n){
  const wr=state.watched[m.id], pal=PHASES[m.p], pos=POS[m.id];
  const future=m.r>today(), open=openIds.has(m.id);
  const done=isDone(m), part=isPart(m), ex=extraOf(m.id);
  const li=document.createElement("li");
  li.className="entry"+(done?" seen":"")+(part?" part":"")+(open?" open":"");
  li.dataset.id=m.id; li.style.setProperty("--ec",pal.c);
  if(part) li.style.setProperty("--pct", Math.round(epsSeenOf(m)/episodesOf(m)*100)+"%");

  const kind=m.t==="film"?"":(m.t==="special"?"Special":"Series");
  const relTxt=new Date(m.r+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  const len=lengthLabel(m);
  const base=state.sort==="chrono" ? `Set ${m.w} · out ${relTxt}` : `${relTxt} · ${m.w}`;
  const epTot=episodesOf(m), epSeen=epsSeenOf(m);
  const lenTxt = (m.t==="series" && part)
    ? `${epSeen} of ${epTot} episodes watched`
    : len;
  const line=lenTxt ? `${base} · ${lenTxt}` : base;
  const path=artOf(m);
  const artwork = path
    ? `<img loading="lazy" decoding="async" width="300" height="450" alt="" src="${IMG(path)}">`
    : sigil(m);
  const lenCell = m.t==="series"
    ? `<div><span>Episodes</span><b>${episodesOf(m)||"—"}</b></div>
       <div><span>Total length</span><b style="font-size:12.5px">${totalMinutes(m)?hhmm(totalMinutes(m)):"—"}</b></div>`
    : `<div><span>Runtime</span><b style="font-size:12.5px">${totalMinutes(m)?hhmm(totalMinutes(m)):"—"}</b></div>`;

  li.innerHTML=`
    <button class="mark" ${future?"disabled":""} aria-label="${future?m.ti+" is not out yet":(done?"Watched: "+m.ti:(part?m.ti+", "+epSeen+" of "+epTot+" episodes":"Mark "+m.ti+" watched"))}" aria-pressed="${done}"></button>
    <div class="row" role="button" tabindex="0" aria-expanded="${open}" aria-label="${m.ti}, details">
      ${SEQUENTIAL(state.sort)?`<span class="idx">${String(n).padStart(2,"0")}</span>`:""}
      <figure class="tile">${artwork}</figure>
      <span class="name"><h3>${m.ti}</h3><p>${line}</p></span>
      ${future?'<span class="badge soon">Not out yet</span>':(kind?`<span class="badge">${kind}</span>`:"")}
      <button class="caret" tabindex="-1" aria-hidden="true">▶</button>
    </div>
    <div class="panel"><div class="inner"><div class="sheet">
      ${path?`<div class="art" style="background-image:url(${IMG_BIG(path)})"></div>`:""}
      <div class="facts">
        <div><span>Release order</span><b>${pos.rel}</b></div>
        <div><span>Chronology</span><b>${pos.chr}</b></div>
        ${lenCell}
        <div><span>Phase</span><b>${m.p}</b></div>
        <div><span>Saga</span><b style="font-size:12px">${m.p<=3?"Infinity":"Multiverse"}</b></div>
        <div style="grid-column:1/-1"><span>Set in</span><b style="font-size:12.5px;font-weight:500">${m.w}</b></div>
      </div>
      <div class="artset">
        <input type="url" placeholder="Image URL for this title" aria-label="Image URL for this title" value="${/^https?:\/\//.test(path)?path:""}">
        <button class="btn" data-art="set">Use</button>
        ${path?'<button class="btn" data-art="clear">Clear</button>':""}
      </div>
      ${(!future && m.t==="series" && epTot) ? `
      <div class="eps">
        <span class="epslabel">Episodes watched</span>
        <div class="epsbar"><i style="width:${epTot?epSeen/epTot*100:0}%"></i></div>
        <div class="epsctl">
          <button data-ep="-1" aria-label="One episode fewer">−</button>
          <b>${epSeen} / ${epTot}</b>
          <button data-ep="1" aria-label="One episode more">+</button>
          <button class="btn" data-ep="all">${epSeen>=epTot?"Start again":"Finished it"}</button>
        </div>
      </div>` : ""}
      ${started(m) && done ? `
      <div class="watches">
        <span class="epslabel">Watched on</span>
        <div class="wlist">
          ${views(m).map((dt,i)=>`<span class="wdate">
            <input type="date" data-wi="${i}" value="${dt}" max="${today()}">
            ${views(m).length>1?`<button data-wdel="${i}" aria-label="Remove this viewing">✕</button>`:""}
          </span>`).join("")}
          <button class="btn" data-wadd="1">Add a viewing</button>
        </div>
      </div>` : ""}

      ${!future ? `
      <div class="rateline">
        <span class="epslabel">Rating</span>
        <div class="stars" role="group" aria-label="Rate ${m.ti}">
          ${[1,2,3,4,5].map(v=>`<button data-rate="${v}" aria-pressed="${ex.rate===v}" aria-label="${v} out of 5">${ex.rate>=v?"●":"○"}</button>`).join("")}
          ${ex.rate?`<button class="clearrate" data-rate="0" aria-label="Clear rating">clear</button>`:""}
        </div>
      </div>
      <textarea class="note" rows="2" placeholder="Notes about this one…" aria-label="Notes about ${m.ti.replace(/"/g,"&quot;")}">${(ex.note||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")}</textarea>` : ""}

      <div class="log">
        ${future ? `<span>Out ${relTxt}. Nothing to log yet.</span>`
          : started(m) ? `<span>${done?`Watched ${viewCount(m)} time${viewCount(m)===1?"":"s"}`:`${epSeen} of ${epTot} episodes in`}</span>
                   <button class="btn" data-act="unmark">Not watched</button>
                   <button class="btn" data-act="link">Copy link</button>
                   <button class="btn" data-act="hide">Hide</button>
                   <button class="btn" data-act="upto" style="margin-left:auto">Mark all up to here</button>`
               : `<span>Not watched yet.</span>
                  <button class="btn" data-act="link">Copy link</button>
                  <button class="btn" data-act="hide">Hide</button>
                  <button class="btn" data-act="upto">Mark all up to here</button>
                  <button class="btn primary" data-act="mark">Mark watched</button>`}
      </div>
    </div></div></div>`;

  const toggleOpen=()=>{
    motionUntil=performance.now()+520;          /* hold background theme changes until it has opened */
    const now=!openIds.has(m.id);
    now?openIds.add(m.id):openIds.delete(m.id);
    li.classList.toggle("open",now);
    li.querySelector(".row").setAttribute("aria-expanded",now);
    if(now) flashBackdrop(m);
  };
  const flipWatched=on=>setWatched(m.id,on);

  const rowEl=li.querySelector(".row");
  rowEl.addEventListener("click", toggleOpen);
  rowEl.addEventListener("keydown", e=>{
    if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggleOpen(); }
  });
  li.querySelector(".caret").addEventListener("click", e=>{e.stopPropagation(); toggleOpen();});
  li.querySelector(".mark").addEventListener("click", e=>{e.stopPropagation(); flipWatched(!wr);});
  li.querySelector(".panel").addEventListener("click", e=>e.stopPropagation());
  li.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
    if(b.dataset.act==="link"){
      const url=location.href.split("#")[0]+"#title-"+m.id;
      (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject())
        .then(()=>toast("Link copied."))
        .catch(()=>toast(url,{ms:9000}));
      return;
    }
    if(b.dataset.act==="hide"){
      state.hidden[m.id]=true; save(); render(true); renderStats();
      toast(`${m.ti} hidden — it no longer counts towards your totals.`,{
        action:"Undo", ms:12000,
        onAction:()=>{ delete state.hidden[m.id]; save(); render(true); renderStats(); }});
      return;
    }
    if(b.dataset.act==="upto") markUpTo(m.id);
    else flipWatched(b.dataset.act==="mark");
  }));
  li.querySelectorAll("[data-ep]").forEach(b=>b.addEventListener("click",()=>{
    const v=b.dataset.ep;
    if(v==="all") setEpisodes(m.id, epSeen>=epTot ? 0 : epTot);
    else setEpisodes(m.id, epSeen+Number(v));
  }));
  const img=li.querySelector(".tile img");
  if(img) img.addEventListener("error",()=>{
    /* unreachable image host: show the generated art rather than a blank tile */
    const fig=img.closest(".tile"); if(fig) fig.innerHTML=sigil(m);
  });
  li.querySelectorAll("[data-art]").forEach(b=>b.addEventListener("click",()=>{
    const inp=li.querySelector(".artset input");
    if(b.dataset.art==="clear"){ setArt(m.id,""); return; }
    const v=inp.value.trim();
    if(!/^https?:\/\//.test(v)){ toast("That needs to be a full image URL starting with http."); return; }
    setArt(m.id,v);
  }));
  /* watch history */
  li.querySelectorAll("[data-wi]").forEach(inp=>inp.addEventListener("change",()=>{
    editView(m.id, Number(inp.dataset.wi), inp.value); save(); render(); renderStats();
  }));
  li.querySelectorAll("[data-wdel]").forEach(b=>b.addEventListener("click",()=>{
    dropView(m.id, Number(b.dataset.wdel)); save(); render(); renderStats();
  }));
  const wadd=li.querySelector("[data-wadd]");
  if(wadd) wadd.addEventListener("click",()=>{ addView(m.id,today()); save(); render(); renderStats(); });

  /* rating */
  li.querySelectorAll("[data-rate]").forEach(b=>b.addEventListener("click",()=>{
    const v=Number(b.dataset.rate);
    setExtra(m.id,{rate: v===0||ex.rate===v ? 0 : v});
    if(!patchRow(m.id)) render(); renderStats();
  }));

  /* notes, saved as you stop typing */
  const note=li.querySelector(".note");
  if(note){
    let nt;
    note.addEventListener("input",()=>{
      clearTimeout(nt);
      nt=setTimeout(()=>setExtra(m.id,{note:note.value.trim()}),500);
    });
    /* also save the moment focus leaves (tapping a rating does that first),
       so a quick tap can't redraw the row with the old note */
    note.addEventListener("blur",()=>{
      clearTimeout(nt);
      if(note.value.trim()!==(extraOf(m.id).note||"")) setExtra(m.id,{note:note.value.trim()});
    });
  }
  return li;
}

/* while a row is opening, a theme change (which restyles the whole page) is
   deferred until the opening has finished, so the two don't share frames */
let motionUntil=0, themeT=0;
function observe(){
  if(io) io.disconnect();
  io=new IntersectionObserver(es=>{
    const top=es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(!top) return;
    const ph=Number(top.target.dataset.phase), wait=motionUntil-performance.now();
    clearTimeout(themeT);
    if(wait>0) themeT=setTimeout(()=>applyTheme(ph),wait+30); else applyTheme(ph);
  },{rootMargin:"-15% 0px -70% 0px",threshold:0});
  document.querySelectorAll(".group").forEach(g=>io.observe(g));
}

/* ---------- header widgets ---------- */
function pool(){ return DATA.filter(m=>(state.series||m.t==="film") && !state.hidden[m.id]); }

const prevRoll={};
function roll(el,to,key){
  const from = prevRoll[key]!==undefined ? prevRoll[key] : to;
  prevRoll[key]=to;
  if(from===to || matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent=to; return; }
  const t0=performance.now(), dur=Math.min(900,320+Math.abs(to-from)*55);
  (function step(now){
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*e);
    if(p<1) requestAnimationFrame(step);
  })(t0);
}

const prevPhase={};
let segsBuilt=false;
function buildSegs(){
  const cEl=$("#constellation");
  cEl.innerHTML='<div class="sweep"><i></i></div>';
  for(let p=1;p<=6;p++){
    const b=document.createElement("button");
    b.className="seg"; b.dataset.p=p;
    b.style.setProperty("--pc",PHASES[p].c);
    b.innerHTML=`<i class="fill zero"></i><span class="c">Phase ${p}</span><span class="n">0/0</span>`;
    b.addEventListener("click",()=>setPhase(state.phase===p?0:p));
    b.addEventListener("pointerenter",()=>applyTheme(p,true));
    b.addEventListener("focus",()=>applyTheme(p,true));
    b.addEventListener("pointerleave",()=>applyTheme(settledPhase,true));
    b.addEventListener("blur",()=>applyTheme(settledPhase,true));
    cEl.appendChild(b);
  }
  segsBuilt=true;
}
function renderTally(){
  const P=pool();
  if(!segsBuilt) buildSegs();

  for(let p=1;p<=6;p++){
    const b=$(`.seg[data-p="${p}"]`);
    const all=P.filter(m=>m.p===p), done=all.filter(isDone).length;
    const pct=all.length?done/all.length*100:0, full=all.length&&done===all.length;
    const {c,c2}=PHASES[p];
    const fill=b.querySelector(".fill");

    fill.style.width=pct+"%";
    /* the slim strip in the sticky bar mirrors the phase bar */
    const strip=document.querySelector(`#phasestrip i[data-p="${p}"]`);
    if(strip){ strip.style.setProperty("--pc",c); strip.style.setProperty("--pct",pct+"%"); }
    fill.classList.toggle("zero",!done);
    fill.style.background = full
      ? `linear-gradient(120deg,${c2},${c})`
      : `linear-gradient(90deg,${c}2e,${c}7a 65%,${c}b0)`;
    b.classList.toggle("done",!!full);
    b.querySelector(".n").textContent=`${done}/${all.length}`;
    b.setAttribute("aria-pressed", state.phase===p);
    b.setAttribute("aria-label",`${PHASES[p].name}, ${done} of ${all.length} watched`);
    b.title=`${PHASES[p].name} — ${PHASES[p].tag} — ${done}/${all.length}`;

    if(prevPhase[p]!==undefined && done>prevPhase[p] && fxOn()){
      b.classList.remove("gained"); void b.offsetWidth; b.classList.add("gained");
      setTimeout(()=>b.classList.remove("gained"),1150);
    }
    prevPhase[p]=done;
  }
  const done=P.filter(isDone).length;
  const out=P.filter(m=>m.r<=today());
  const doneOut=out.filter(isDone).length;
  const t=$("#tally");
  t.innerHTML=`<b class="roll" id="rollA">0</b> of ${P.length} watched · <b class="roll" id="rollB">0</b>/${out.length} of what's out`;
  roll($("#rollA"),done,"a"); roll($("#rollB"),doneOut,"b");
}

function renderCountdown(){
  const el=$("#countdown");
  const t=today();
  const soon=DATA.filter(m=>m.r>t).sort((a,b)=>a.r.localeCompare(b.r))[0];
  if(!soon){ el.hidden=true; return; }
  const days=Math.ceil((new Date(soon.r+"T00:00:00")-new Date(t+"T00:00:00"))/864e5);
  const when=new Date(soon.r+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  el.hidden=false;
  el.innerHTML=`<span class="cdot"></span><b>${soon.ti}</b> in ${days} day${days===1?"":"s"} · ${when}`;
}

function renderNext(){
  const box=$("#nextup");
  box.classList.add("hudframe");
  const queue=sorted(pool().filter(m=>!isDone(m)&&m.r<=today()));
  const next=queue[0];
  const ticks='<span class="ticks"></span>';
  if(!next){
    box.hidden=false;
    box.innerHTML=`<span class="lbl">Everything released<strong>You’re fully caught up</strong></span>
      <span class="acts"><button class="btn" id="rand">Pick a rewatch</button></span>${ticks}`;
  }else{
    box.hidden=false;
    const orderName=$("#sort").selectedOptions[0].text.toLowerCase();
    box.innerHTML=`<span class="lbl">Next in ${orderName} · ${queue.length} to go
      <button class="go" id="nextgo">${next.ti}</button></span>
      <span class="acts"><button class="btn primary" id="nextdone">Mark watched</button><button class="btn" id="tonight">Tonight</button><button class="btn" id="rand">Surprise me</button></span>${ticks}`;
    $("#nextdone").addEventListener("click",()=>setWatched(next.id,true));
    $("#nextgo").addEventListener("click",()=>reveal(next.id));
  }
  const tb=$("#tonight"); if(tb) tb.addEventListener("click",tonight);
  $("#rand").addEventListener("click",surprise);
}

/* one way to clear every filter: chips' "Clear all", the empty list's button
   and Esc all use it, and the address updates so a reload doesn't bring a
   cleared phase back */
function clearFilters(){
  state.phase=0; state.show="all"; state.q=""; state.maxlen=0;
  $("#show").value="all"; $("#q").value=""; $("#maxlen").value="0";
  applyTheme(settledPhase); render(true); pushRoute(); markDirty();
}
function renderFilterBar(){
  const bar=$("#filterbar"), bits=[];
  const SHOW={seen:"Watched only",unseen:"Not watched only",part:"Part watched only"};
  if(state.phase) bits.push([PHASES[state.phase].name,()=>{state.phase=0}]);
  if(state.show!=="all") bits.push([SHOW[state.show]||"Filtered",()=>{state.show="all";$("#show").value="all"}]);
  if(state.q.trim()) bits.push([`“${state.q.trim()}”`,()=>{state.q="";$("#q").value=""}]);
  if(state.hideFuture) bits.push(["Unreleased hidden",()=>{state.hideFuture=false;save()}]);
  if(state.maxlen) bits.push([state.maxlen===999?"Over 2½ hours":`Under ${hhmm(state.maxlen)}`,()=>{state.maxlen=0;$("#maxlen").value="0"}]);
  bar.classList.toggle("on",!!bits.length);
  bar.innerHTML="";
  if(bits.length){
    const c=document.createElement("span"); c.className="count";
    c.textContent=`${visible().length} of ${pool().length} showing`;
    bar.appendChild(c);
  }
  bits.forEach(([label,undo])=>{
    /* the label is plain text: search words must never be read as HTML */
    const c=document.createElement("span"); c.className="chip";
    const x=document.createElement("button"); x.textContent="✕"; x.setAttribute("aria-label",`Remove filter: ${label}`);
    c.append(label+" ",x);
    x.addEventListener("click",()=>{undo();applyTheme(state.phase||settledPhase);render(true);pushRoute();markDirty()});
    bar.appendChild(c);
  });
  if(bits.length>1){
    const b=document.createElement("button"); b.className="btn"; b.textContent="Clear all";
    b.addEventListener("click",clearFilters);
    bar.appendChild(b);
  }
}

/* ============================ STATS ============================ */
function renderStats(){
  const host=$("#statsview");
  if(state.view!=="stats"){ host.hidden=true; return; }
  host.hidden=false;

  const P=pool(), out=P.filter(m=>m.r<=today());
  const seen=P.filter(isDone);
  const pct=P.length?Math.round(seen.length/P.length*100):0;
  const rewatches=seen.reduce((s,m)=>s+(viewCount(m)-1),0);
  /* every viewing, not one per title, so rewatches show up in the chart */
  const dates=[].concat(...P.filter(started).map(views)).sort();
  const fmt=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—";

  /* last 12 months */
  const months=[], now=new Date();
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({k:ymd(d).slice(0,7), lbl:d.toLocaleDateString("en-GB",{month:"narrow"}), n:0});
  }
  dates.forEach(d=>{ const mth=months.find(x=>x.k===d.slice(0,7)); if(mth) mth.n++; });
  const peak=Math.max(1,...months.map(m=>m.n));

  /* pace over the last 90 days → projection */
  const cut=ymd(new Date(Date.now()-90*864e5));
  const recent=dates.filter(d=>d>=cut).length;
  const perMonth=recent/3;
  const left=out.length-out.filter(isDone).length;
  let projection="—";
  if(left===0) projection="All caught up";
  else if(perMonth>=0.5){
    const dd=new Date(Date.now()+ (left/perMonth)*30*864e5);
    projection=dd.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  } else projection="Need a steadier pace";

  const most=seen.slice().sort((a,b)=>viewCount(b)-viewCount(a))[0];

  /* streaks, from the distinct days anything was watched */
  const days=[...new Set(dates)].sort();
  let best=0,run=0,prev=null,current=0;
  days.forEach(d=>{
    const t=new Date(d+"T00:00:00").getTime();
    run = (prev!==null && t-prev===864e5) ? run+1 : 1;
    best=Math.max(best,run); prev=t;
  });
  if(days.length){
    const last=new Date(days[days.length-1]+"T00:00:00").getTime();
    const gap=Math.round((new Date(today()+"T00:00:00").getTime()-last)/864e5);
    current = gap<=1 ? run : 0;
  }

  /* ratings */
  const rated=DATA.filter(m=>extraOf(m.id).rate);
  const avgRate=rated.length ? (rated.reduce((s,m)=>s+extraOf(m.id).rate,0)/rated.length) : 0;
  const topRated=rated.slice().sort((a,b)=>extraOf(b.id).rate-extraOf(a.id).rate)[0];
  const noted=DATA.filter(m=>extraOf(m.id).note).length;

  /* time watched — only counts titles whose length is actually known */
  let minsSeen=0, minsAll=0, epsSeen=0, unknownLen=0;
  seen.forEach(m=>{
    const t=totalMinutes(m);
    if(t){ minsSeen+=minutesSeen(m); minsAll+=minutesSeen(m)*viewCount(m); }
    if(m.t==="series") epsSeen+=episodesOf(m);
  });
  const minsLeft=out.filter(m=>!isDone(m)).reduce((s,m)=>s+totalMinutes(m)-minutesSeen(m),0);
  unknownLen=P.filter(m=>!totalMinutes(m)).length;

  const nextRel=DATA.filter(m=>m.r>today()).sort((a,b)=>a.r.localeCompare(b.r))[0];
  const planDefault=nextRel?nextRel.r:ymd(new Date(Date.now()+90*864e5));
  const planLabel=nextRel?`default: ${nextRel.ti}`:"";

  const R=54, C=2*Math.PI*R;
  const caseId = "TVA-"+String(seen.length).padStart(3,"0")+"-"+String(P.length).padStart(3,"0");

  host.innerHTML=`
  <div class="tva">
  <div class="tvabar"><i></i> Temporal audit · ${state.series?"films, series and specials":"films only"} · all phases <span class="id">File ${caseId}</span></div>
  <div class="stats">
    <div class="card hudframe" style="animation-delay:.04s">
      <h3>Completion</h3>
      <div class="ringwrap">
        <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
          <g stroke="var(--hud)" opacity=".28">
            ${[0,45,90,135,180,225,270,315].map(a=>{
              const rad=a*Math.PI/180, x1=64+Math.cos(rad)*62, y1=64+Math.sin(rad)*62,
                    x2=64+Math.cos(rad)*67, y2=64+Math.sin(rad)*67;
              return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="1"/>`;
            }).join("")}
          </g>
          <circle cx="64" cy="64" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="9"/>
          <circle cx="64" cy="64" r="${R}" fill="none" stroke="var(--hud)" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"
            transform="rotate(-90 64 64)" style="filter:drop-shadow(0 0 8px rgba(255,179,71,.5))">
            <animate attributeName="stroke-dashoffset" from="${C}" to="${(C*(1-pct/100)).toFixed(1)}" dur="1.2s" fill="freeze" calcMode="spline" keySplines=".22 .8 .3 1" keyTimes="0;1"/>
          </circle>
        </svg>
        <div><div class="big"><span class="roll" id="rollPct">0</span>%</div>
          <p>${seen.length} of ${P.length} titles<br>${rewatches} rewatch${rewatches===1?"":"es"} logged</p></div>
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card hudframe" style="animation-delay:.1s">
      <h3>By phase</h3>
      <div class="pbars">${[1,2,3,4,5,6].map(p=>{
        const all=P.filter(m=>m.p===p), d=all.filter(isDone).length;
        const w=all.length?d/all.length*100:0;
        return `<div class="pbar"><span style="color:${PHASES[p].c}">Phase ${p}</span>
          <span class="track"><i class="fill" style="width:${w}%;background:linear-gradient(90deg,${PHASES[p].c2},${PHASES[p].c});display:block"></i></span>
          <span class="num">${d}/${all.length}</span></div>`;
      }).join("")}</div>
      <span class="ticks"></span>
    </div>

    <div class="card wide hudframe" style="animation-delay:.16s">
      <h3>Watched over the last twelve months</h3>
      <div class="months">${months.map(m=>
        `<div title="${m.n} in ${m.k}"><i style="height:${m.n/peak*100}%"></i><small>${m.lbl}</small></div>`).join("")}</div>
      <span class="ticks"></span>
    </div>

    <div class="card hudframe" style="animation-delay:.22s">
      <h3>Pace</h3>
      <div class="figs">
        <div><span>Last 90 days</span><b>${recent} watched</b></div>
        <div><span>Average a month</span><b>${perMonth.toFixed(1)}</b></div>
        <div><span>Still to watch</span><b>${left} released</b></div>
        <div><span>On track to finish</span><b>${projection}</b></div>
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card hudframe" style="animation-delay:.28s">
      <h3>Time</h3>
      <div class="figs">
        <div><span>Watched</span><b>${hhmm(minsSeen)||"—"}</b></div>
        <div><span>Including rewatches</span><b>${hhmm(minsAll)||"—"}</b></div>
        <div><span>Left to watch</span><b>${hhmm(minsLeft)||"—"}</b></div>
        <div><span>Episodes watched</span><b>${epsSeen}</b></div>
        ${unknownLen?`<div><span>Length unknown</span><b>${unknownLen} titles</b></div>`:""}
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card wide hudframe" style="animation-delay:.26s">
      <h3>Finish by</h3>
      <div class="prefrow">
        <span class="plabel">Be caught up by</span>
        <input type="date" id="planDate" value="${planDefault}" min="${today()}">
        <span class="plabel" id="planWhy">${planLabel}</span>
      </div>
      <div class="figs" id="planOut"></div>
      <span class="ticks"></span>
    </div>

    <div class="card hudframe" style="animation-delay:.3s">
      <h3>Ratings</h3>
      <div class="figs">
        <div><span>Rated</span><b>${rated.length} of ${P.length}</b></div>
        <div><span>Average</span><b>${avgRate?avgRate.toFixed(1)+" / 5":"—"}</b></div>
        <div><span>Your highest</span><b style="font-size:12px">${topRated?topRated.ti+" ("+extraOf(topRated.id).rate+")":"—"}</b></div>
        <div><span>With notes</span><b>${noted}</b></div>
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card hudframe" style="animation-delay:.31s">
      <h3>Log</h3>
      <div class="figs">
        <div><span>First logged</span><b>${fmt(dates[0])}</b></div>
        <div><span>Most recent</span><b>${fmt(dates[dates.length-1])}</b></div>
        <div><span>Most rewatched</span><b>${most&&viewCount(most)>1?most.ti+" ×"+viewCount(most):"—"}</b></div>
        <div><span>Longest streak</span><b>${best?best+" day"+(best===1?"":"s"):"—"}</b></div>
        <div><span>Current streak</span><b>${current?current+" day"+(current===1?"":"s"):"—"}</b></div>
        <div><span>Unreleased ahead</span><b>${P.length-out.length} titles</b></div>
      </div>
      <span class="ticks"></span>
    </div>
  </div></div>`;
  const pd=$("#planDate");
  const drawPlan=()=>{
    const pl=planFor(pd.value||planDefault);
    $("#planOut").innerHTML = pl.titles===0
      ? `<div><span>Status</span><b>Already caught up</b></div>`
      : `<div><span>Days left</span><b>${pl.days}</b></div>
         <div><span>Titles to watch</span><b>${pl.titles}</b></div>
         <div><span>Per week</span><b>${hhmm(Math.round(pl.perWeek))||"—"}</b></div>
         <div><span>Per day</span><b>${hhmm(Math.round(pl.perDay))||"—"}</b></div>
         <div><span>Rate needed</span><b>${pl.titlesPerWeek.toFixed(1)} a week</b></div>`;
  };
  pd.addEventListener("change",drawPlan); drawPlan();

  delete prevRoll.pct;
  roll($("#rollPct"),pct,"pct");
}



/* ============================ SETTINGS ============================ */
function renderSettings(){
  const host=$("#settingsview");
  if(state.view!=="settings"){ host.hidden=true; return; }
  host.hidden=false;

  const seenN=DATA.filter(isDone).length;
  const rewN=DATA.filter(started).reduce((s,m)=>s+(state.watched[m.id].n-1),0);
  const dates=DATA.filter(started).map(m=>state.watched[m.id].d).sort();
  const fmt=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—";
  const hiddenList=DATA.filter(m=>state.hidden[m.id]);

  host.innerHTML=`
  <div class="settings">
    <div class="card wide hudframe" style="animation-delay:.4s">
      <h3>Watch log</h3>
      <div class="prefs">
        <p>${seenN?`${seenN} title${seenN===1?"":"s"} logged${rewN?`, ${rewN} rewatch${rewN===1?"":"es"}`:""}${dates[0]?`, first on ${fmt(dates[0])}`:""}.`:"Nothing logged yet."}</p>
        <div class="artrow">
          <button class="btn danger" id="resetlog" ${seenN?"":"disabled"}>Reset watch log</button>
          <span style="color:var(--ink-faint);font-size:11.5px;flex:1 1 200px;line-height:1.5">Clears every watched mark and episode count, and nothing else — artwork, settings and the titles themselves stay put.</span>
        </div>
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card wide hudframe" style="animation-delay:.37s">
      <h3>Artwork</h3>
      <div class="prefs">
        <p id="artstatus">—</p>
        <div class="dropzone" id="dropzone">
          <strong>Drop poster images here</strong>
          <span>Or <button class="linkish" id="pickfiles">choose files</button>. Named after the title — <em>iron-man-2.jpg</em>, <em>Loki.png</em> — they match automatically. Drop a single image straight onto a row to set just that one.</span>
          <input type="file" id="filepick" accept="image/*" multiple hidden>
        </div>
        <div class="artrow">
          <input type="password" id="tmdb2" placeholder="TMDB API key" autocomplete="off" value="${state.tmdb||""}">
          <button class="btn primary" id="fetchart">Load artwork</button>
          <button class="btn" id="storelocal">Store images locally</button>
          <button class="btn primary" id="bundle">Bundle images and export</button>
          <button class="btn" id="resetart">Reset to built-in</button>
          <button class="btn" id="forgetkey">Clear key</button>
          <button class="btn danger" id="refetchart" title="Re-downloads everything and undoes embedded images">Refresh all</button>
        </div>
        <details class="pasteart">
          <summary>Paste a list of image links</summary>
          <textarea id="urlpaste" rows="4" placeholder="Iron Man | https://…/ironman.jpg&#10;Thor | https://…/thor.jpg"></textarea>
          <div class="artrow"><button class="btn" id="applyurls">Link them</button>
            <span>One per line. With a title before the separator it matches by name; without one, lines are taken in release order.</span></div>
        </details>
        <p>Artwork is stored per device, so a phone starts empty even if your laptop is full. Quickest fix: on the laptop press <em>Store images locally</em>, then <em>Export backup</em>, and restore that file on the phone — the images travel inside it and need no network. Otherwise, images you drop in are downscaled to 300px and kept in this browser; a free TMDB key (themoviedb.org → Settings → API) fetches posters and fills in exact runtimes and episode counts; and any single title can be overridden with an image URL from inside its row. Titles with no image fall back to generated key art.</p>
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card wide hudframe" style="animation-delay:.34s">
      <h3>Preferences</h3>
      <div class="prefs">
        <div class="prefrow">
          <span class="plabel">Theme</span>
          <div class="segs" id="themepick">
            ${Object.entries(THEMES).map(([k,label])=>
              `<button data-theme="${k}" aria-pressed="${state.theme===k}">${label}</button>`).join("")}
          </div>
        </div>
        <label class="toggle"><input type="checkbox" id="live" ${state.liveSearch?"checked":""}> Search as you type</label>
        <label class="toggle"><input type="checkbox" id="hidefuture" ${state.hideFuture?"checked":""}> Hide titles that aren’t out yet</label>
        <label class="toggle"><input type="checkbox" id="compact" ${state.compact?"checked":""}> Compact rows</label>
        <label class="toggle"><input type="checkbox" id="fx" ${state.fx?"checked":""}> Background and command effects</label>
        <p>Search runs on Enter unless you turn on live search — commands only fire on Enter too, so a word beginning with one won’t set it off. Compact rows shrink the artwork and spacing. Turning effects off stops the Bifröst, the sweep and the command animations; the palette and layout stay. All of these save.</p>
      </div>
      <span class="ticks"></span>
    </div>

    <div class="card wide hudframe" style="animation-delay:.4s">
      <h3>Sync between devices</h3>
      <div class="prefs">${SYNC.card()}</div>
      <span class="ticks"></span>
    </div>

    <div class="card wide hudframe" style="animation-delay:.43s">
      <h3>Your data</h3>
      <div class="prefs">
        <div class="artrow">
          <button class="btn" id="export">Export backup</button>
          <button class="btn" id="import">Restore backup</button>
          <span style="color:var(--ink-faint);font-size:11.5px;flex:1 1 220px;line-height:1.5">A backup holds your watch log and any artwork this browser added beyond what ships in the file. Restoring merges rather than replaces.</span>
        </div>
        <details class="pasteart">
          <summary>Progress code — move your log without a file</summary>
          <textarea id="progCode" rows="3" readonly placeholder="Press Copy code"></textarea>
          <div class="artrow">
            <button class="btn" id="codeCopy">Copy code</button>
            <button class="btn" id="codeApply">Apply a pasted code</button>
            <span style="color:var(--ink-faint);font-size:11.5px;flex:1 1 200px;line-height:1.5">A short string holding what you have watched, part-watched, rated and hidden. Paste it on another device and apply.</span>
          </div>
        </details>
        ${hiddenList.length?`<div class="hiddenbox">
          <span class="epslabel">Hidden titles</span>
          <div class="cmds">${hiddenList.map(m=>`<code><button data-unhide="${m.id}">${m.ti} ✕</button></code>`).join("")}</div>
        </div>`:""}
      </div>
      <span class="ticks"></span>
    </div>
  </div>`;
  SYNC.wire();
  $("#live").addEventListener("change",e=>{
    state.liveSearch=e.target.checked; save(); searchMode();
    toast(state.liveSearch?"Search now runs as you type.":"Search now runs on Enter.");
  });
  $("#hidefuture").addEventListener("change",e=>{
    state.hideFuture=e.target.checked; save(); render(true);
    toast(state.hideFuture?"Unreleased titles hidden. They still appear in search and in the countdown.":"Unreleased titles shown again.");
  });
  $("#compact").addEventListener("change",e=>{ state.compact=e.target.checked; applyPrefs(); save(); });
  $("#fx").addEventListener("change",e=>{
    state.fx=e.target.checked; applyPrefs(); save();
    toast(state.fx?"Effects on.":"Effects off.");
  });
  $("#themepick").addEventListener("click",e=>{
    const b=e.target.closest("[data-theme]"); if(!b) return;
    state.theme=b.dataset.theme; applyPrefs(); save(); renderSettings();
  });
  $("#applyurls").addEventListener("click",()=>importUrlList($("#urlpaste").value));
  $("#pickfiles").addEventListener("click",()=>$("#filepick").click());
  $("#filepick").addEventListener("change",e=>{ importImages(e.target.files); e.target.value=""; });
  $("#fetchart").addEventListener("click",()=>{
    const v=$("#tmdb2").value.trim();
    if(!v){ toast("Paste a TMDB key first — themoviedb.org, Settings, API."); return; }
    state.tmdb=v; keyBad=false; netBlocked=false; save(); fetchMeta(false);
  });
  $("#refetchart").addEventListener("click",()=>{
    const v=$("#tmdb2").value.trim();
    if(!v){ toast("Paste a TMDB key first."); return; }
    const emb=localCount();
    const warn = emb
      ? `Refresh all re-downloads every title from TMDB and replaces the ${emb} images built into this file with web links. They stop working offline until you run "Bundle images and export" again.\n\nYou almost certainly want "Load artwork", which only fetches titles that have none.\n\nRefresh all anyway?`
      : `Refresh all re-downloads artwork and lengths for all ${DATA.length} titles, overwriting what's stored. Continue?`;
    if(!confirm(warn)) return;
    state.tmdb=v; keyBad=false; netBlocked=false; save(); fetchMeta(true);
  });
  const rl=$("#resetlog");
  if(rl) rl.addEventListener("click",()=>{
    const n=Object.keys(state.watched).length;
    if(!n) return;
    if(!confirm(`Reset the watch log: this clears all ${n} watched marks and any part-watched episode counts, taking you back to nothing watched. Artwork, settings and your TMDB key are untouched.\n\nYou can undo it straight afterwards, but not once you reload.\n\nContinue?`)) return;
    const before=JSON.parse(JSON.stringify(state.watched));
    state.watched={}; save(); render(true); renderSettings(); renderStats();
    toast(`Watch log cleared — ${n} entries removed.`,{
      action:"Undo", ms:30000,
      onAction:()=>{ state.watched=before; save(); render(true); renderSettings(); renderStats(); }
    });
  });
  $("#resetart").addEventListener("click",()=>{
    if(!confirm("Discard any artwork stored in this browser and go back to the images built into the file. Your own imported images and URLs are lost; the built-in set is unaffected.\n\nContinue?")) return;
    meta={};
    for(const id in BUILTIN_ART) meta[id]=Object.assign({},BUILTIN_ART[id]);
    saveMeta(); render(); renderSettings(); renderStats();
    toast(`Reset to the ${localCount()} images built into this file.`);
  });
  $("#storelocal").addEventListener("click",localiseArt);
  $("#bundle").addEventListener("click",async()=>{
    await localiseArt();                 /* embed first — order used to be a trap */
    const loc=localCount(), have=artCount();
    if(have && loc<have)
      toast(`Only ${loc} of ${have} could be embedded on this device. Exporting anyway.`,{ms:7000});
    exportBackup();
  });
  $("#forgetkey").addEventListener("click",()=>{
    state.tmdb=""; $("#tmdb2").value=""; save();
    toast("Key cleared from this browser.",{ms:5000});
  });
  updateArtPanel();
  probeImageHost();
  $("#export").addEventListener("click",exportBackup);
  $("#import").addEventListener("click",importBackup);
  $("#codeCopy").addEventListener("click",()=>{
    const c=encodeProgress();
    const ta=$("#progCode"); ta.value=c; ta.removeAttribute("readonly"); ta.select();
    (navigator.clipboard?navigator.clipboard.writeText(c):Promise.reject())
      .then(()=>toast(`Code copied — ${c.length} characters.`))
      .catch(()=>toast("Select the text above and copy it."));
  });
  $("#codeApply").addEventListener("click",async()=>{
    const v=($("#progCode").value||"").trim();
    if(!v){ $("#progCode").removeAttribute("readonly"); $("#progCode").focus();
            toast("Paste a code into the box above, then press this again."); return; }
    try{
      const got=decodeProgress(v);
      const n=Object.keys(got.watched).length;
      if(!confirm(`Apply this code: it merges ${n} watched entries, plus any ratings and hidden titles it carries, into what is already here. Nothing is deleted.\n\nContinue?`)) return;
      state.watched=Object.assign({},state.watched,got.watched);
      state.extra=Object.assign({},state.extra,got.extra);
      state.hidden=Object.assign({},state.hidden,got.hidden);
      save(); render(true); renderStats(); renderSettings();
      toast(`Applied — ${n} entries.`);
    }catch(e){ toast("That is not a valid progress code."); }
  });
  host.querySelectorAll("[data-unhide]").forEach(b=>b.addEventListener("click",()=>{
    delete state.hidden[b.dataset.unhide]; save(); render(true); renderStats(); renderSettings();
  }));
  updateArtPanel();
  probeImageHost();
}

/* ---------- view switching ---------- */
const scrollMem={list:0,stats:0,settings:0};
function syncStick(){
  const c=$("#controls");
  const tuck=c.classList.contains("tucked") ? parseFloat(c.style.getPropertyValue("--tuck"))||0 : 0;
  /* set on the list (its sticky headings are the only users), so a change
     restyles the list rather than the whole page */
  $("#list").style.setProperty("--stick", ((c.offsetHeight||52)-tuck)+"px");
}
addEventListener("resize",syncStick);

/* phones: tuck the filter row away while scrolling down the list, bring it
   back on any scroll up (see the styles: only the bar's background moves, so
   nothing in the list shifts). Never while a filter is being used. */
(()=>{
  const c=$("#controls"), mq=matchMedia("(max-width:620px)");
  let lastY=scrollY, tucked=false;
  const set=on=>{
    if(on===tucked) return; tucked=on;
    if(on){ const f=c.querySelector(".filters").getBoundingClientRect(), q=$("#qfield").getBoundingClientRect();
            c.style.setProperty("--tuck",Math.max(0,f.bottom-q.bottom)+"px"); }
    c.classList.toggle("tucked",on); syncStick();
  };
  addEventListener("scroll",()=>{
    const y=scrollY, dy=y-lastY, a=document.activeElement;
    const busy=a && c.contains(a) && a!==$("#q");             /* a dropdown or switch is in use */
    if(!mq.matches || !c.classList.contains("stuck") || busy) set(false);
    else if(dy>6 && y>240) set(true);
    else if(dy<-6) set(false);
    lastY=y;
  },{passive:true});
  mq.addEventListener("change",()=>set(false));
})();

function setView(v,{push=true,restore=true}={}){
  if(v===state.view && push) return;
  scrollMem[state.view]=window.scrollY;
  const go=()=>{
    try{ applyView(v); if(restore) scrollTo({top:scrollMem[v]||0}); }
    catch(err){ console.warn("view swap:",err); }
  };
  let vt=null;
  if(document.startViewTransition && fxOn()){
    try{ vt=document.startViewTransition(go); }catch(err){ go(); }
  } else go();
  if(vt){
    /* a skipped or interrupted transition rejects these — swallow them */
    vt.finished?.catch(()=>{});
    vt.ready?.catch(()=>{});
    vt.updateCallbackDone?.catch(()=>{});
  }
  if(push) pushRoute();
}
function applyView(v){
  state.view=v;
  const listy = v==="list";
  $("#tabList").setAttribute("aria-selected", listy);
  $("#tabStats").setAttribute("aria-selected", v==="stats");
  $("#tabSet").setAttribute("aria-selected", v==="settings");
  $("#controls").classList.toggle("statsmode", !listy);
  document.body.classList.toggle("viewstats", !listy);
  listEl.hidden=!listy;
  $("#filterbar").style.display = listy?"":"none";
  renderStats();
  renderSettings();
  if(listy) render();
  syncStick();
}

/* ---------- routing ---------- */
function routeHash(){
  if(state.view==="stats") return "#stats";
  if(state.view==="settings") return "#prefs";
  return state.phase ? `#phase-${state.phase}` : "#timeline";
}
/* History is unavailable in sandboxed frames (null origin), so every call is
   guarded — routing simply goes quiet rather than throwing. */
let routing=true;
function pushRoute(){
  if(!routing) return;
  const h=routeHash();
  try{ if(location.hash!==h) history.pushState({v:state.view,p:state.phase},"",h); }
  catch(e){ routing=false; }
}
function readRoute(){
  let h="";
  try{ h=(location.hash||"").toLowerCase(); }catch(e){ routing=false; }
  const tm=h.match(/^#title-([a-z0-9]+)$/);
  if(tm && BY_ID[tm[1]]) return {view:"list", phase:0, title:tm[1]};
  const m=h.match(/^#phase-([1-6])$/);
  const view = h==="#stats" ? "stats" : (h==="#prefs" ? "settings" : "list");
  return {view, phase: m ? Number(m[1]) : 0};
}
addEventListener("popstate",()=>{
  const r=readRoute();
  state.phase=r.phase;
  applyTheme(state.phase||settledPhase||1);
  if(r.view!==state.view) setView(r.view,{push:false});
  else { render(true); renderStats(); }
});
function setPhase(p){
  state.phase = p;
  applyTheme(p||1);
  if(state.view!=="list") setView("list",{push:false});
  else render(true);
  pushRoute();
}

/* ---------- surprise / cursor ---------- */
function surprise(){
  const lim=Number(state.maxlen||0);
  const fits=m=>!lim||(totalMinutes(m)&&(lim===999?totalMinutes(m)>150:totalMinutes(m)<=lim));
  const un=pool().filter(m=>m.r<=today()&&!isDone(m)&&fits(m));
  const from=un.length?un:pool().filter(m=>m.r<=today()&&fits(m));
  if(!from.length) return;
  const pick=from[Math.floor(Math.random()*from.length)];
  state.phase=0; state.q=""; state.show="all";
  $("#q").value=""; $("#show").value="all";
  reveal(pick.id);
}
/* Jump to a title: show the list (no sliding rows), scroll to it, and only
   once the scroll has settled open it the same way a tap does. One motion at
   a time instead of rows sliding, a scroll and an expand all at once. */
function reveal(id){
  const switching=state.view!=="list";
  if(switching) setView("list"); else render();
  setTimeout(()=>{
    focusOn(id);
    let last=-1, still=0; const t0=performance.now();
    (function wait(){
      if(scrollY===last) still++; else { still=0; last=scrollY; }
      if(still<6 && performance.now()-t0<1200) return requestAnimationFrame(wait);
      const li=listEl.querySelector(`li.entry[data-id="${id}"]`);
      if(li && !li.classList.contains("open")) li.querySelector(".row").click();
    })();
  }, switching?380:30);
}
function focusOn(id){
  const el=listEl.querySelector(`li[data-id="${id}"]`);
  if(!el) return;
  listEl.querySelectorAll(".cursor").forEach(n=>n.classList.remove("cursor"));
  cursorId=id; el.classList.add("cursor");
  if(el.scrollIntoView) el.scrollIntoView({behavior:"smooth",block:"center"});
}

/* ---------- keyboard ---------- */
addEventListener("keydown",e=>{
  /* a dialog, an easter egg or the intro owns the keyboard while it is open */
  if(document.querySelector(".modal, .egg, #intro")) return;
  const typing=/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if(e.key==="/"&&!typing){ e.preventDefault(); setView("list"); $("#q").focus(); return; }
  if(e.key==="Escape"){
    if(typing){
      if(document.activeElement===$("#q") && $("#q").value){ $("#q").value=""; state.q=""; markDirty(); render(true); }
      else document.activeElement.blur();
      return;
    }
    if(openIds.size){                            /* close open rows with the same animation as a tap */
      motionUntil=performance.now()+520;
      openIds.forEach(id=>{ const li=listEl.querySelector(`li.entry[data-id="${id}"]`);
        if(li){ li.classList.remove("open"); const r=li.querySelector(".row"); if(r) r.setAttribute("aria-expanded","false"); } });
      openIds.clear(); return; }
    if(state.phase||state.show!=="all"||state.q||state.maxlen) clearFilters();
    return;
  }
  if(typing||e.metaKey||e.ctrlKey||e.altKey) return;
  if(state.view!=="list"&&!"0123456r".includes(e.key.toLowerCase())) return;

  const rows=[...listEl.querySelectorAll("li.entry")];
  const k=e.key.toLowerCase();
  let i=rows.findIndex(r=>r.dataset.id===cursorId);

  if((k==="j"||k==="k")&&rows.length){
    e.preventDefault();
    i = i<0 ? 0 : Math.min(rows.length-1, Math.max(0, i+(k==="j"?1:-1)));
    focusOn(rows[i].dataset.id);
  } else if(k==="x"&&i>=0){ e.preventDefault(); rows[i].querySelector(".mark").click(); }
  else if(e.key==="Enter"&&i>=0){ e.preventDefault(); rows[i].querySelector(".caret").click(); }
  else if(k==="r"){ e.preventDefault(); surprise(); }
  else if("0123456".includes(e.key)){
    e.preventDefault();
    const p=Number(e.key);
    setPhase((p===0||state.phase===p)?0:p);
  }
});

/* ---------- masthead decode ---------- */
function decodeTitle(){
  if(!fxOn()) return;
  const el=document.querySelector(".title"), real=el.textContent;
  const glyphs="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>*#"; let f=0;
  const t=setInterval(()=>{
    f++;
    el.textContent=real.split("").map((ch,i)=> ch===" "?" ": (i<f*.9?ch:glyphs[Math.floor(Math.random()*glyphs.length)])).join("");
    if(f>real.length*1.2){ clearInterval(t); el.textContent=real; }
  },38);
}

/* ---------- small modal, used by bulk marking and export ---------- */
function modal(html,setup){
  return new Promise(res=>{
    const opener=document.activeElement;            /* focus goes back here on close */
    const back=document.createElement("div");
    back.className="modal";
    back.innerHTML=`<div class="modalbox" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);
    const h=back.querySelector("h3");               /* the heading names the dialog */
    if(h){ h.id="modalTitle"; back.firstElementChild.setAttribute("aria-labelledby","modalTitle"); }
    const close=v=>{ document.removeEventListener("keydown",esc);
      /* fade out rather than vanish; the answer is given straight away */
      back.style.pointerEvents="none";
      (back.animate?back.animate([{opacity:1},{opacity:0}],{duration:140,easing:"ease-out",fill:"forwards"}).finished:Promise.resolve()).then(()=>back.remove(),()=>back.remove());
      if(opener && opener.isConnected && opener.focus) opener.focus({preventScroll:true}); res(v); };
    const esc=e=>{ if(e.key==="Escape"){ e.preventDefault(); close(null); } };
    document.addEventListener("keydown",esc);
    back.addEventListener("click",e=>{ if(e.target===back) close(null); });
    setup(back,close);
    requestAnimationFrame(()=>{ const f=back.querySelector("input,button"); if(f) f.focus(); });
  });
}

/* When did you watch these? Returns {from,to} or null. */
function askPeriod(n){
  const t=today();
  return modal(`
    <h3>When did you watch these?</h3>
    <p>${n} title${n===1?"":"s"}. Dates are spread evenly across the period, oldest first, so your stats stay honest rather than showing them all landing today.</p>
    <div class="segs presets" id="presets">
      <button type="button" data-days="0">Today</button>
      <button type="button" data-days="7">Past week</button>
      <button type="button" data-days="30">Past month</button>
      <button type="button" data-days="365">Past year</button>
    </div>
    <div class="prefrow daterow">
      <label>From <input type="date" id="pFrom" max="${t}" value="${t}"></label>
      <label>to <input type="date" id="pTo" max="${t}" value="${t}"></label>
    </div>
    <div class="artrow modalacts">
      <button class="btn" type="button" data-x="cancel">Cancel</button>
      <button class="btn primary" type="button" data-x="ok">Mark them</button>
    </div>`,
  (root,close)=>{
    const from=root.querySelector("#pFrom"), to=root.querySelector("#pTo");
    root.querySelector("#presets").addEventListener("click",e=>{
      const b=e.target.closest("[data-days]"); if(!b) return;
      const days=Number(b.dataset.days);
      from.value=ymd(new Date(Date.now()-days*864e5));
      to.value=today();
      root.querySelectorAll("#presets button").forEach(x=>x.setAttribute("aria-pressed",x===b));
    });
    root.querySelector('[data-x="cancel"]').addEventListener("click",()=>close(null));
    root.querySelector('[data-x="ok"]').addEventListener("click",()=>{
      let a=from.value||today(), b=to.value||today();
      if(a>b){ const t2=a; a=b; b=t2; }
      close({from:a,to:b});
    });
  });
}

/* A short label to recognise a backup by. Returns a string or null. */
function askLabel(){
  return modal(`
    <h3>Name this backup</h3>
    <p>Optional. A short note so you can tell backups apart later — it is stored inside the file and shown when you restore it.</p>
    <input type="text" id="bkLabel" maxlength="60" placeholder="e.g. laptop, before rewatch, phase 4 done">
    <div class="artrow modalacts">
      <button class="btn" type="button" data-x="skip">Skip</button>
      <button class="btn primary" type="button" data-x="ok">Export</button>
    </div>`,
  (root,close)=>{
    const inp=root.querySelector("#bkLabel");
    inp.addEventListener("keydown",e=>{ if(e.key==="Enter") close(inp.value.trim()); });
    root.querySelector('[data-x="skip"]').addEventListener("click",()=>close(""));
    root.querySelector('[data-x="ok"]').addEventListener("click",()=>close(inp.value.trim()));
  });
}


/* ---------- progress code ----------
   A short string instead of a 2MB file, for moving a watch log between
   devices. Dates are stored as day offsets from a base so it stays small. */
function encodeProgress(){
  const base=new Date("2008-01-01T00:00:00").getTime();
  const day=d=>Math.round((new Date(d+"T00:00:00").getTime()-base)/864e5);
  const parts=[];
  for(const id in state.watched){
    const m=BY_ID[id]; if(!m) continue;
    const r=state.watched[id];
    const ds=views(m).map(day).join(".");
    const ex=extraOf(id);
    parts.push([id, ds, r.ep||"", ex.rate||""].join(",").replace(/,+$/,""));
  }
  const hid=Object.keys(state.hidden).filter(k=>state.hidden[k]).join(".");
  const raw="v1|"+parts.join(";")+(hid?"|"+hid:"");
  return btoa(unescape(encodeURIComponent(raw)));
}
function decodeProgress(code){
  const raw=decodeURIComponent(escape(atob(code.trim())));
  if(!raw.startsWith("v1|")) throw new Error("not a progress code");
  const [,body,hid]=raw.split("|");
  const base=new Date("2008-01-01T00:00:00").getTime();
  const date=n=>new Date(base+Number(n)*864e5).toISOString().slice(0,10);
  const watched={}, extra={};
  (body||"").split(";").filter(Boolean).forEach(p=>{
    const [id,ds,ep,rate]=p.split(",");
    if(!BY_ID[id]) return;
    const w=(ds||"").split(".").filter(Boolean).map(date);
    if(!w.length) return;
    watched[id]={w, d:w[w.length-1], n:w.length};
    if(ep) watched[id].ep=Number(ep);
    if(rate) extra[id]={rate:Number(rate)};
  });
  const hidden={};
  (hid||"").split(".").filter(Boolean).forEach(id=>{ if(BY_ID[id]) hidden[id]=true; });
  return {watched,extra,hidden};
}

/* ---------- finish-by planner ---------- */
function planFor(dateStr){
  const P=pool(), out=P.filter(m=>m.r<=today());
  const left=out.filter(m=>!isDone(m));
  const mins=left.reduce((s,m)=>s+Math.max(0,totalMinutes(m)-minutesSeen(m)),0);
  const days=Math.max(1,Math.round((new Date(dateStr+"T00:00:00")-new Date(today()+"T00:00:00"))/864e5));
  return {
    days, titles:left.length, mins,
    perWeek: mins/(days/7),
    perDay: mins/days,
    titlesPerWeek: left.length/(days/7)
  };
}

/* ---------- bulk changes, always undoable ---------- */
async function bulkApply(ids,on,label){
  if(!ids.length){ toast("Nothing to change there."); return; }
  let dates=null;
  if(on){
    const period=await askPeriod(ids.length);
    if(!period) return;                       /* cancelled */
    dates=spreadDates(period.from,period.to,ids.length);
  }
  const before=JSON.parse(JSON.stringify(state.watched));
  ids.forEach((id,i)=>{
    const m=BY_ID[id]; if(!m || m.r>today()) return;
    if(on) state.watched[id]={d:dates[i], n:1, w:[dates[i]]};
    else delete state.watched[id];
  });
  save(); render(true); renderStats();
  const span = dates && dates[0]!==dates[dates.length-1] ? ` across ${dates[0]} to ${dates[dates.length-1]}` : "";
  toast(`${label} — ${ids.length} title${ids.length===1?"":"s"}${span}.`,{
    action:"Undo", ms:15000,
    onAction:()=>{ state.watched=before; save(); render(true); renderStats(); }
  });
}
/* oldest first, evenly spaced, so a binge reads as a binge and not one day */
function spreadDates(from,to,n){
  /* read and write both in UTC: reading local midnight then printing UTC put
     every date a day early during British Summer Time */
  const a=new Date(from+"T00:00:00Z").getTime(), b=new Date(to+"T00:00:00Z").getTime();
  if(n===1) return [to];
  return Array.from({length:n},(_,i)=>
    new Date(a+(b-a)*(i/(n-1))).toISOString().slice(0,10));
}
/* everything at or above this row in the order currently on screen */
function markUpTo(id){
  const order=sorted(visible());
  const i=order.findIndex(m=>m.id===id);
  if(i<0) return;
  const ids=order.slice(0,i+1).filter(m=>m.r<=today() && !isDone(m)).map(m=>m.id);
  bulkApply(ids,true,"Marked everything up to here");
}
function markGroup(key,on){
  const ids=sorted(visible())
    .filter(m=>groupOf(m).k===key && m.r<=today() && (on? !isDone(m) : started(m)))
    .map(m=>m.id);
  bulkApply(ids,on,on?"Marked the whole section watched":"Cleared the whole section");
}

/* ---------- episode progress on a series ---------- */
function setEpisodes(id,n){
  const m=BY_ID[id]; if(!m||m.t!=="series") return;
  const tot=episodesOf(m);
  n=Math.max(0,Math.min(tot,n));
  const prev=state.watched[id];
  if(n<=0) delete state.watched[id];
  else if(n>=tot) state.watched[id]={d:today(), n:(prev&&prev.n)||1, w:(prev&&prev.w)||[today()]};
  else state.watched[id]={d:(prev&&prev.d)||today(), n:1, w:(prev&&prev.w)||[today()], ep:n};
  save(); if(!patchRow(id)) render(); renderStats();
}

/* one place for every watched change, so undo always works */
function setWatched(id,on,quiet){
  const m=BY_ID[id];
  if(!m || m.r>today()) return;
  const prev = state.watched[id] ? {...state.watched[id]} : null;
  if(on){ state.watched[id]=prev&&prev.w ? Object.assign({},prev) : {d:today(),n:1,w:[today()]}; justMarked=id; }
  else delete state.watched[id];
  save(); if(!patchRow(id)) render(true); renderStats();
  if(!quiet) toast(on?`Marked ${m.ti} watched`:`${m.ti} set back to unwatched`,{
    action:"Undo",
    onAction:()=>{ prev ? state.watched[id]=prev : delete state.watched[id]; save(); if(!patchRow(id)) render(true); renderStats(); }
  });
}

/* ============================ EASTER EGGS ============================ */
function toast(msg,opts){
  const o = typeof opts==="number" ? {ms:opts} : (opts||{});
  const t=$("#toast");
  const wasOn=t.classList.contains("on");
  t.innerHTML="";
  const s=document.createElement("span"); s.textContent=msg; t.appendChild(s);
  if(o.action){
    const b=document.createElement("button"); b.textContent=o.action;
    b.addEventListener("click",()=>{ t.classList.remove("on"); o.onAction&&o.onAction(); });
    t.appendChild(b);
  }
  t.classList.add("on");
  /* a new message replacing one already showing re-pops gently instead of snapping */
  if(wasOn && t.animate) t.animate([{opacity:.4,scale:".97"},{opacity:1,scale:"1"}],{duration:180,easing:"ease-out"});
  /* a message with an Undo stays at least 6s, so a mis-tap can be undone */
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("on"), Math.max(o.ms||3400, o.action?6000:0));
}
function flash(){
  const f=$("#flash"); f.classList.add("on");
  setTimeout(()=>f.classList.remove("on"),110);
}
function dustScale(from,to,dur,done){
  const map=$("#dustMap"), t0=performance.now();
  (function step(now){
    const p=Math.min(1,(now-t0)/dur);
    map.setAttribute("scale",(from+(to-from)*p).toFixed(1));
    p<1 ? requestAnimationFrame(step) : done&&done();
  })(t0);
}
let ashing=false;
/* ---------- snap and blip ----------
   "snap" dusts away exactly half of the titles in the list, and they stay gone
   until "blip" (or the banner's button) brings them back. It is a view only:
   watch history, ratings and stats are untouched, nothing is saved or synced,
   and a reload brings everyone back. */
let snapped=new Set();
function snapNote(on){
  let n=document.getElementById("snapnote");
  if(!on){ if(n){ n.classList.add("out"); setTimeout(()=>n.remove(),300); } return; }
  if(n) return;
  n=document.createElement("div"); n.id="snapnote"; n.className="snapnote"; n.setAttribute("role","status");
  n.innerHTML='<span>Half the universe is gone.</span><button type="button">Bring them back</button>';
  n.querySelector("button").addEventListener("click",blip);
  document.body.appendChild(n);
}
function snapHalf(){
  if(ashing) return;
  if(snapped.size){ toast("Half the universe is already gone. Type blip to bring them back."); return; }
  const ids=visible().map(m=>m.id);
  for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
  const gone=ids.slice(0,Math.floor(ids.length/2));
  if(!gone.length){ toast("Nothing here to snap."); return; }
  const settle=()=>{ snapped=new Set(gone); render(true); snapNote(true); };
  if(reduced()){ settle(); return; }
  ashing=true; flash();
  const rows=gone.map(id=>listEl.querySelector(`li.entry[data-id="${id}"]`)).filter(Boolean);
  rows.forEach((el,i)=>{ el.classList.add("ashing"); setTimeout(()=>el.classList.add("gone"),60+i*38); });
  dustScale(0,95,2600);
  setTimeout(()=>{ rows.forEach(el=>el.classList.remove("ashing","gone")); $("#dustMap").setAttribute("scale","0"); settle(); ashing=false; },
             60+rows.length*38+2400);
}
function blip(){
  if(ashing) return;
  if(!snapped.size){ snap(false); return; }      /* nobody missing: the old there-and-back */
  const back=[...snapped]; snapped=new Set(); snapNote(false); render(true);
  if(reduced()) return;
  ashing=true; flash();
  /* the returning rows start as dust and re-form */
  const rows=back.map(id=>listEl.querySelector(`li.entry[data-id="${id}"]`)).filter(Boolean);
  rows.forEach(el=>el.classList.add("ashing","gone"));
  $("#dustMap").setAttribute("scale","95");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    rows.forEach((el,i)=>setTimeout(()=>el.classList.remove("gone"),i*38));
    dustScale(95,0,1700+rows.length*38);
    setTimeout(()=>{ rows.forEach(el=>el.classList.remove("ashing")); ashing=false; },2400+rows.length*38);
  }));
}
/* the original quick version: things dust away and come straight back */
function snap(half){
  if(ashing) return; ashing=true;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const all=[...document.querySelectorAll("li.entry, .card, .nextup, .group-head")];
  const hit=half ? all.filter(()=>Math.random()<.5) : all;
  if(reduce||!hit.length){ ashing=false; return; }
  flash();
  /* about 50% longer than it was: slower dusting, a wider ripple, a longer
     hold while they are gone, a gentler return (.ashing transition is 2.3s) */
  hit.forEach((el,i)=>{
    el.classList.add("ashing");
    setTimeout(()=>el.classList.add("gone"), 60+i*38);
  });
  dustScale(0,95,2600);
  setTimeout(()=>{
    dustScale(95,0,1700);
    hit.forEach(el=>el.classList.remove("gone"));
    setTimeout(()=>{ hit.forEach(el=>el.classList.remove("ashing")); ashing=false; },2400);
  }, 4300);
}
function assemble(){
  state.phase=0; state.show="all"; $("#show").value="all";
  const ids=["av1","av2","av3","av4","avd","avsw"];
  ids.forEach(id=>openIds.add(id));
  if(state.view!=="list") setView("list"); else render(true);
  setTimeout(()=>focusOn("av1"),60);
}
/* ---------- egg effects ---------- */
const reduced=()=>!fxOn();
let starkTimer;
function setTheme(t){
  state.theme=t; applyPrefs(); save();
  toast(`${THEMES[t]} theme on. Change it in Stats, under Preferences.`);
}
function starkMode(){
  if(reduced()) return;
  clearTimeout(starkTimer);
  flash();
  document.body.classList.add("stark");
  $("#reactor").classList.add("on");
  starkTimer=setTimeout(()=>{
    $("#reactor").classList.remove("on");
    setTimeout(()=>{
      document.body.classList.remove("stark");
      if(state.theme!=="stark")
        toast("Keep Stark mode on?",{action:"Keep it",ms:7000,onAction:()=>setTheme("stark")});
    },1400);
  },11000);
}
function onYourLeft(){
  if(reduced()) return;
  const back=window.scrollY;
  scrollTo({top:document.body.scrollHeight,behavior:"smooth"});
  setTimeout(()=>scrollTo({top:back,behavior:"smooth"}),1500);
}
function shakeTitle(){
  const t=document.querySelector(".title");
  t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");
  setTimeout(()=>t.classList.remove("shake"),2100);
}
function swapSubs(text,ms){
  const els=[...listEl.querySelectorAll(".name p")];
  const old=els.map(e=>e.textContent);
  els.forEach((e,i)=>setTimeout(()=>e.textContent=text,i*22));
  setTimeout(()=>els.forEach((e,i)=>e.textContent=old[i]),ms);
}
function worthy(){
  const els=[...listEl.querySelectorAll("li.entry.seen")];
  if(!els.length){ toast("Nothing you've watched yet is worthy."); return; }
  els.forEach((e,i)=>setTimeout(()=>e.classList.add("worthy"),i*30));
  setTimeout(()=>els.forEach(e=>e.classList.remove("worthy")),4200);
}
function pym(){
  if(reduced()) return;
  document.body.classList.add("pym");
  setTimeout(()=>document.body.classList.remove("pym"),1600);
}
function glitchTitles(){
  if(reduced()) return;
  const els=[...listEl.querySelectorAll(".name h3")];
  const glyphs="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>*#";
  const old=els.map(e=>e.textContent);
  let f=0;
  const t=setInterval(()=>{
    f++;
    els.forEach((e,i)=>{
      e.textContent=old[i].split("").map(ch=>
        ch===" "?" ":(Math.random()<f/14?ch:glyphs[Math.floor(Math.random()*glyphs.length)])).join("");
    });
    if(f>15){ clearInterval(t); els.forEach((e,i)=>e.textContent=old[i]); }
  },55);
}
/* ---------- big-screen eggs: shared overlay plumbing ----------
   One at a time. Each builds a fixed overlay, animates only transform and
   opacity, and removes itself; a tap or key ends it early. */
let eggBusy=false;
function eggOverlay(cls,cleanup){
  if(eggBusy) return null;
  eggBusy=true;
  const ov=document.createElement("div"); ov.className="egg "+cls; ov.setAttribute("aria-hidden","true");
  document.body.appendChild(ov); document.body.classList.add("egging");
  let done=false;
  const finish=()=>{
    if(done) return; done=true; eggBusy=false;
    removeEventListener("pointerdown",skip,true); removeEventListener("keydown",skip,true);
    ov.getAnimations({subtree:true}).forEach(a=>a.cancel());
    ov.remove(); document.body.classList.remove("egging"); if(cleanup) cleanup();
  };
  /* the key that skips does only that: it doesn't also fire a shortcut */
  const skip=e=>{ if(e.type==="keydown"){ e.preventDefault(); e.stopPropagation(); } finish(); };
  setTimeout(()=>{ if(!done){ addEventListener("pointerdown",skip,true); addEventListener("keydown",skip,true); } },300);
  return {ov,finish,isDone:()=>done};
}

/* The Gauntlet, about 8.3s, in three beats that never share space or time:
     gather      each phase box lights up, then its light pinches down to a
                 point, leaving a faint outline like a spent socket
     crystallise the point drops into a clear row just below the bar and
                 grows into a gem there (never on top of the box)
     flight      through an empty band to a gauntlet placed lower down: each
                 stone leaves straight down and arrives along its socket's
                 normal, so it never slides along the gold; launches go
                 outside-in, alternating sides, crown, then the Soul stone's
                 slow hero swoop round the outside and up into the plate.
                 Colour shifts from phase to true stone colour in flight.
   Then: a halo wave, an energy pulse along the band, beams converging on the
   plate, one soft flash and a double shockwave from the plate; the dark
   lifts and the drained boxes refill left to right.
   Glow is layered light (wide halo, white-hot core, glints, a light trail,
   sparkles, colour spilling onto the metal), all static gradients with only
   opacity and transform animated. Source: the phase bar, or the slim phase
   strip in the sticky bar when scrolled; otherwise it scrolls up first. */
function gauntlet(){
  if(reduced()){ toast("The stones are ready. Turn effects on in Settings to see them."); return; }
  const bar=document.getElementById("constellation"), bb=bar&&bar.getBoundingClientRect();
  const strip=document.getElementById("phasestrip"), stuck=document.getElementById("controls").classList.contains("stuck");
  let src=null, fromBar=false;
  if(bb && bb.top>=0 && bb.bottom<=innerHeight){ src=[...bar.querySelectorAll(".seg")].map(e=>e.getBoundingClientRect()); fromBar=true; }
  else if(stuck && strip) src=[...strip.querySelectorAll("i")].map(e=>e.getBoundingClientRect());
  if(!src || src.length<6){
    if(gauntlet.scrolling) return;
    gauntlet.scrolling=true; scrollTo({top:0,behavior:"smooth"});
    setTimeout(()=>{ gauntlet.scrolling=false; gauntlet(); },750);
    return;
  }
  const segAnims=[];
  const E=eggOverlay("egg-gauntlet",()=>segAnims.forEach(a=>a.cancel())); if(!E) return;
  const {ov,finish,isDone}=E;

  /* layout: the gauntlet sits below the source with a clear band between */
  const W=innerWidth, H=innerHeight, srcBottom=Math.max(...src.map(b=>b.bottom));
  let R=Math.min(W*.34,190,(H-srcBottom-180)/1.76), clear=Math.max(90,.9*R);
  R=Math.min(R,(H-srcBottom-90-clear)/1.76);
  const tight=R<60; if(tight){ clear=60; R=Math.max(44,Math.min(W*.3,(H-srcBottom-150)/1.76)); }
  const cx=W/2, cy=srcBottom+clear+R, S=R*.21, plateY=cy+R*.42, stageY=srcBottom+.9*S;
  ov.style.setProperty("--cx",cx+"px"); ov.style.setProperty("--cy",cy+"px"); ov.style.setProperty("--py",plateY+"px");
  const rad=d=>d*Math.PI/180, xy=(a,r)=>[cx+r*Math.cos(rad(a)), cy+r*Math.sin(rad(a))];
  const STONES=["#2d7bff","#ffd23d","#ff2d3a","#a24bff","#2ee87a","#ff8a1f"];   /* space mind reality power time soul */
  const seats=[[-160,R],[-125,R],[-90,R],[-55,R],[-20,R],[90,R*.42]];
  const PHASE_TO_SEAT={1:0,3:1,6:2,2:3,4:4,5:5};
  const [ax,ay]=xy(-172,R), [bx,by]=xy(-8,R), arcD=`M ${ax} ${ay} A ${R} ${R} 0 0 1 ${bx} ${by}`;
  ov.innerHTML=`<i class="eg-dim"></i><i class="eg-bloom"></i><i class="eg-rays"></i>
    <svg class="eg-arc" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="egGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff0b8"/><stop offset=".35" stop-color="#f0c04e"/>
          <stop offset=".7" stop-color="#b9821f"/><stop offset="1" stop-color="#6e4710"/></linearGradient>
        <radialGradient id="egSock" cx=".45" cy=".4" r=".7">
          <stop offset="0" stop-color="#2a1d08"/><stop offset=".7" stop-color="#120c04"/><stop offset="1" stop-color="#5a3c0e"/></radialGradient>
      </defs>
      <g class="eg-metal">
        <path d="${arcD}" fill="none" stroke="#6e4710" stroke-width="${S*1.25}" stroke-linecap="round" opacity=".35" class="eg-under" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <path d="${arcD}" fill="none" stroke="#2b1a05" stroke-width="${S*1.05}" stroke-linecap="round" transform="translate(0 ${S*.12})" opacity=".8" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <path d="${arcD}" fill="none" stroke="url(#egGold)" stroke-width="${S*.92}" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <path d="${arcD}" fill="none" stroke="#fff7d6" stroke-width="${S*.12}" stroke-linecap="round" transform="translate(0 ${-S*.28})" opacity=".55" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <circle cx="${cx}" cy="${plateY}" r="${S*1.2}" fill="url(#egSock)" stroke="url(#egGold)" stroke-width="${S*.42}" opacity="0"/>
        ${seats.slice(0,5).map(([a])=>{ const [x,y]=xy(a,R); return `<circle cx="${x}" cy="${y}" r="${S*.64}" fill="url(#egSock)" stroke="url(#egGold)" stroke-width="${S*.2}" opacity="0"/>`; }).join("")}
      </g>
      <path class="eg-energy" d="${arcD}" fill="none" stroke="#fff7d6" stroke-width="${S*.1}" stroke-linecap="round" pathLength="1" stroke-dasharray=".08 .92" stroke-dashoffset="1" opacity="0"/>
    </svg><i class="eg-ring"></i><i class="eg-ring thin"></i><i class="eg-flash"></i>`;
  const $o=s=>ov.querySelector(s), dim=$o(".eg-dim"), bloom=$o(".eg-bloom"), rays=$o(".eg-rays"), metal=$o(".eg-metal"),
        strokes=[...ov.querySelectorAll(".eg-metal path")], plates=[...ov.querySelectorAll(".eg-metal circle")],
        energy=$o(".eg-energy"), rings=[...ov.querySelectorAll(".eg-ring")], flash=$o(".eg-flash");
  const SMOOTH="cubic-bezier(.65,0,.35,1)", el=(cls,css)=>{ const e=document.createElement("i"); e.className=cls; if(css) e.style.cssText=css; ov.appendChild(e); return e; };

  /* the setting: dark, then the gauntlet draws on while breathing in */
  dim.animate([{opacity:0},{opacity:.9}],{duration:700,fill:"forwards",easing:"ease-out"});
  metal.style.transformOrigin=`${cx}px ${cy}px`;
  metal.animate([{transform:"scale(.9)",opacity:.6},{transform:"scale(1)",opacity:1}],{duration:1500,delay:300,easing:"cubic-bezier(.2,.8,.3,1)",fill:"forwards"});
  strokes.forEach(s=>s.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:1200,delay:300,fill:"forwards",easing:SMOOTH}));
  plates.forEach((c,i)=>c.animate([{opacity:0,transform:"scale(.6)"},{opacity:1,transform:"scale(1)"}],
    {duration:450,delay:1050+i*70,fill:"forwards",easing:"cubic-bezier(.2,.9,.3,1.3)"}));
  rays.animate([{transform:"translate(-50%,-50%) rotate(0deg)"},{transform:"translate(-50%,-50%) rotate(80deg)"}],{duration:9000,easing:"linear",fill:"forwards"});

  /* gather and crystallise, left to right */
  const GLOW="cubic-bezier(.3,0,.2,1)", ORDER=[1,4,3,2,6,5];      /* launch order: outside-in, alternating, crown, Soul */
  const stones=[], boxes=[];
  const box=(b,pc)=>{
    const w=el("eg-pbox",`--c:${pc};left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`);
    w.innerHTML='<i class="eg-pfill"></i><i class="eg-pline"></i>'; return w;
  };
  const gem=(pc,c)=>{
    const w=el("eg-stone",`width:${S}px;height:${S}px`);
    w.innerHTML=`<i class="eg-halo a" style="--c:${pc}"></i><i class="eg-halo b" style="--c:${c}"></i>`+
      `<i class="eg-gem" style="--c:${pc}"></i><i class="eg-tone" style="--c:${c}"></i>`+
      `<i class="eg-glint" style="--c:${c}"><i></i><i></i><i></i></i>`;
    return w;
  };
  const glint=(st,at)=>st.querySelector(".eg-glint").animate(
    [{opacity:0,transform:"translate(-50%,-50%) scale(0,.6)"},{opacity:1,transform:"translate(-50%,-50%) scale(1,1)",offset:.35},{opacity:0,transform:"translate(-50%,-50%) scale(.4,.6)"}],
    {duration:520,delay:at,easing:"ease-out"});
  for(let p=1;p<=6;p++){
    const k=p-1, i=PHASE_TO_SEAT[p], pc=(PHASES[p]||PHASES[1]).c, c=STONES[i], b=src[k];
    const g0=600+k*150, sx=b.left+b.width/2, sy=b.top+b.height/2;
    const bx=box(b,pc); boxes[p]=bx;
    const fill=bx.firstChild, line=bx.lastChild;
    fill.animate([{opacity:0,transform:"scale(1)"},{opacity:1,transform:"scale(1)",offset:.46},{opacity:.9,transform:"scale(.1,.18)",offset:.96},{opacity:0,transform:"scale(.1,.18)"}],
                 {duration:650,delay:g0,fill:"forwards",easing:"ease-in"});
    line.animate([{opacity:0},{opacity:.6,offset:.4},{opacity:.22}],{duration:650,delay:g0,fill:"forwards"});
    /* the mote: just the core of light, which drops out and grows into a gem */
    const st=gem(pc,c); stones[i]=st;
    const at=(x,y,k2)=>({translate:`${x-S/2}px ${y-S/2}px`,scale:`${k2}`});
    st.animate([{...at(sx,sy,.3),opacity:0},{...at(sx,sy,.3),opacity:1,offset:.1},{...at(sx,stageY,1),opacity:1}],
               {duration:500,delay:g0+600,easing:GLOW,fill:"forwards"});
    st.querySelector(".eg-halo.a").animate([{opacity:0},{opacity:.55}],{duration:350,delay:g0+600,fill:"forwards"});
    st.querySelector(".eg-gem").animate([{opacity:0},{opacity:1}],{duration:250,delay:g0+850,fill:"forwards"});
    glint(st,g0+1000);
    st.dataset.sx=sx; st.dataset.p=p;
  }
  /* hover in the staging row, then fly */
  const bobs=stones.map((st,i)=>st.animate([{transform:"translateY(0)"},{transform:"translateY(-2px)"},{transform:"translateY(0)"}],
                                          {duration:900+i*60,delay:1600+i*150,iterations:Infinity,easing:"ease-in-out"}));
  const LAUNCH0=2500, STAG=330, F=1050, FS=1300, SETTLE=300;
  let lastLand=0;
  const bez=(a,b,c,d,t)=>{ const u=1-t; return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d; };
  const dbez=(a,b,c,d,t)=>{ const u=1-t; return 3*u*u*(b-a)+6*u*t*(c-b)+3*t*t*(d-c); };
  ORDER.forEach((p,n)=>{
    const i=PHASE_TO_SEAT[p], st=stones[i], c=STONES[i], soul=i===5;
    const x0=+st.dataset.sx, y0=stageY, [tx,ty]=xy(...seats[i]), d=Math.hypot(tx-x0,ty-y0);
    let P1,P2;
    if(soul){ P1=[cx+R+1.6*S, cy-.3*R]; P2=[cx+.9*R, cy+.9*R]; }
    else { const nx=(tx-cx)/R, ny=(ty-cy)/R; P1=[x0, y0+.35*d]; P2=[tx+nx*.4*d, ty+ny*.4*d]; }
    const dur=soul?FS:F, L=LAUNCH0+n*STAG+(soul?120:0), total=dur+SETTLE, fo=dur/total;
    const frames=[], trail=[];
    for(let s=0;s<=14;s++){
      const t=s/14, e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      const x=bez(x0,P1[0],P2[0],tx,e), y=bez(y0,P1[1],P2[1],ty,e);
      const dx=dbez(x0,P1[0],P2[0],tx,e), dy=dbez(y0,P1[1],P2[1],ty,e), len=Math.hypot(dx,dy)||1, ang=Math.atan2(dy,dx)*180/Math.PI;
      frames.push({translate:`${x-S/2}px ${y-S/2}px`,scale:`${1+.3*Math.sin(Math.PI*e)}`,offset:t*fo});
      trail.push({translate:`${x-1.5*S-dx/len*1.1*S}px ${y-.225*S-dy/len*1.1*S}px`,rotate:`${ang}deg`,opacity:.7*Math.sin(Math.PI*t),offset:t});
    }
    frames.push({translate:`${tx-S/2}px ${ty-S/2}px`,scale:"1.14",offset:fo+(1-fo)*.4});
    frames.push({translate:`${tx-S/2}px ${ty-S/2}px`,scale:"1",offset:1});
    setTimeout(()=>{ if(!isDone()) bobs[i].cancel(); },L);
    st.animate(frames,{duration:total,delay:L,easing:"linear",fill:"forwards"});
    /* colour shift in flight: phase halo out, stone halo and tone in */
    const X={duration:dur*.55,delay:L+dur*.25,fill:"forwards",easing:"ease-in-out"};
    st.querySelector(".eg-halo.a").animate([{opacity:.55},{opacity:0}],X);
    st.querySelector(".eg-halo.b").animate([{opacity:0},{opacity:.55}],X);
    st.querySelector(".eg-tone").animate([{opacity:0},{opacity:1}],X);
    /* a light trail and two lagging sparkles */
    el("eg-streak",`--c:${c};width:${3*S}px;height:${.45*S}px`).animate(trail,{duration:dur,delay:L,easing:"linear",fill:"forwards"});
    [90,180].forEach(lag=>{
      el("eg-spark",`--c:${c}`).animate(frames.slice(0,15).map((f,j)=>({translate:f.translate.replace(/(-?[\d.]+)px (-?[\d.]+)px/,(m,a,b2)=>`${+a+S/2-2}px ${+b2+S/2-2}px`),
        opacity:(j/14)*(1-j/14)*3.2,offset:j/14})),{duration:dur,delay:L+lag,easing:"linear",fill:"forwards"});
    });
    /* landing: a glint and colour spilling onto the gold */
    const land=L+dur;
    glint(st,land-40);
    const spill=el("eg-spill",`--c:${c};left:${tx-1.5*S}px;top:${ty-1.5*S}px;width:${3*S}px;height:${3*S}px`);
    spill.animate([{opacity:0},{opacity:.3}],{duration:400,delay:land,fill:"forwards"});
    st.spill=spill;
    lastLand=Math.max(lastLand,L+total);
  });

  /* power-up: a halo wave round the arc, energy along the band, beams to the plate */
  const PU=lastLand+150, REL=PU+1150;
  bloom.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.6)"},{opacity:.9,transform:"translate(-50%,-50%) scale(1.15)"}],
                {duration:1100,delay:PU,easing:"ease-in",fill:"forwards"});
  rays.animate([{opacity:0},{opacity:.95}],{duration:1000,delay:PU,fill:"forwards",easing:"ease-in"});
  [0,1,2,3,4,5].forEach(i=>{
    const st=stones[i], w=i*70;
    st.querySelector(".eg-halo.b").animate([{opacity:.55,transform:"translate(-50%,-50%) scale(1)"},{opacity:1,transform:"translate(-50%,-50%) scale(1.6)"}],
                                           {duration:900,delay:PU+w,easing:"ease-in",fill:"forwards"});
    st.spill.animate([{opacity:.3},{opacity:.7}],{duration:700,delay:PU+w,fill:"forwards"});
    glint(st,PU+700+w);
  });
  energy.animate([{opacity:0,strokeDashoffset:1},{opacity:1,strokeDashoffset:.5,offset:.3},{opacity:1,strokeDashoffset:0}],{duration:700,delay:PU,iterations:2});
  if(!tight) seats.slice(0,5).forEach(([a],i)=>{
    const [x,y]=xy(a,R), len=Math.hypot(cx-x,plateY-y), ang=Math.atan2(plateY-y,cx-x)*180/Math.PI;
    el("eg-beam",`--c:${STONES[i]};left:${x}px;top:${y-1}px;width:${len}px;transform:rotate(${ang}deg) scaleX(0)`)
      .animate([{transform:`rotate(${ang}deg) scaleX(0)`,opacity:1},{transform:`rotate(${ang}deg) scaleX(1)`,opacity:1,offset:.6},{transform:`rotate(${ang}deg) scaleX(1)`,opacity:0}],
               {duration:300+760,delay:REL-150-300-(4-i)*60,easing:"ease-out",fill:"forwards"});
  });
  ov.animate([{translate:"0 0"},{translate:"1.5px -1px"},{translate:"-1.5px 1px"},{translate:"1px 1.5px"},{translate:"0 0"}],{duration:260,delay:PU+850});

  /* release from the plate; the dark lifts; the light goes home */
  flash.animate([{opacity:0},{opacity:.3},{opacity:0}],{duration:500,delay:REL,easing:"ease-out"});
  rings.forEach((r,i)=>r.animate([{opacity:.95,transform:"translate(-50%,-50%) scale(.15)"},{opacity:0,transform:"translate(-50%,-50%) scale(10)"}],
    {duration:1500+i*300,delay:REL+i*140,easing:"cubic-bezier(.12,.7,.3,1)",fill:"forwards"}));
  dim.animate([{opacity:.9},{opacity:0}],{duration:1200,delay:REL+150,fill:"forwards",easing:"ease-in-out"});
  bloom.animate([{opacity:.9},{opacity:0}],{duration:900,delay:REL,fill:"forwards"});
  rays.animate([{opacity:.95},{opacity:0}],{duration:800,delay:REL+100,fill:"forwards"});
  for(let p=1;p<=6;p++){
    const bx=boxes[p], t=REL+300+(p-1)*150;
    bx.firstChild.animate([{opacity:0,transform:"scale(.1,.18)"},{opacity:.9,transform:"scale(1)",offset:.5},{opacity:0,transform:"scale(1)"}],{duration:900,delay:t,fill:"forwards",easing:"ease-out"});
    bx.lastChild.animate([{opacity:.22},{opacity:0}],{duration:600,delay:t+300,fill:"forwards"});
    if(fromBar){ const seg=document.querySelector(`#constellation .seg[data-p="${p}"]`), c=PHASES[p].c;
      if(seg) segAnims.push(seg.animate([{boxShadow:`0 0 0 0 ${c}00`},{boxShadow:`0 0 24px 4px ${c}`,offset:.35},{boxShadow:`0 0 0 0 ${c}00`}],{duration:1200,delay:t+300,easing:"ease-out"})); }
  }
  const out=[$o(".eg-arc"),...stones,...ov.querySelectorAll(".eg-spill")].map(e=>e.animate([{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(-14px)"}],
    {duration:1000,delay:REL+650,easing:"ease-in",fill:"forwards"}));
  Promise.all(out.map(a=>a.finished)).then(()=>{ if(!isDone()) finish(); },()=>{});
}

/* Mirror Dimension, about 4.6s: the page itself splits along mirrored seams.
     crack       the page holds still; white seams draw outward from the centre
     split       tiles hinge open on their shared seams, left and right as
                 mirror images of each other, rippling out from the centre
     kaleidoscope the whole view turns and shrinks a touch; the centre tiles
                 flip over to show their mirrored backs, over a faint prism
     fold back   outside-in, back to flat
     seal        the seams flash once to hide the hand-back to the real page
   The tiles are copies of only what is on screen (off-screen rows become empty
   spacers, closed panels are emptied, sticky bars are pinned where they show),
   so phones aren't copying the whole list. Each tile has a crisp white edge, a
   faint glass tint and a glint that crosses the whole screen; only transform
   and opacity animate. The real page is hidden underneath and reappears
   exactly where it was. */
function mirrorDimension(){
  if(reduced()){ toast("The mirror dimension needs effects on. Turn them on in Settings."); return; }
  const wrap=document.querySelector(".wrap");
  const E=eggOverlay("egg-mirror",()=>{ wrap.style.visibility=""; }); if(!E) return;
  const {ov,finish,isDone}=E;
  const W=innerWidth, H=innerHeight, R=wrap.getBoundingClientRect();
  /* one trimmed copy of what is on screen; sticky bars tagged first so each
     can be matched to its copy after rows are swapped for spacers */
  const realSticky=[...wrap.querySelectorAll("#controls, .group-head")];
  realSticky.forEach((e,i)=>e.setAttribute("data-egg-sticky",i));
  const base=wrap.cloneNode(true);
  realSticky.forEach(e=>e.removeAttribute("data-egg-sticky"));
  const realRows=[...wrap.querySelectorAll("li.entry")], copyRows=[...base.querySelectorAll("li.entry")];
  realRows.forEach((r,i)=>{ const b=r.getBoundingClientRect();
    if(b.bottom<-80||b.top>H+80){ const sp=document.createElement("li"); sp.style.cssText=`display:block;height:${b.height}px;border:0;padding:0;margin:0;list-style:none`; copyRows[i].replaceWith(sp); }
    else if(!r.classList.contains("open")){ const inner=copyRows[i].querySelector(".panel > .inner"); if(inner) inner.innerHTML=""; } });   /* closed panels have no height: their contents only cost nodes */
  base.querySelectorAll("img").forEach(i=>{ i.loading="eager"; });
  base.style.cssText=`position:absolute;margin:0;left:${R.left}px;top:${R.top}px;width:${R.width}px;max-width:none;visibility:visible`;
  /* lay it out once to pin the sticky bars: un-stick the copies first (inside
     a tile they would stick to the tile), then shift each to where the real
     one is showing */
  const probe=document.createElement("div"); probe.className="eg-tile"; probe.style.cssText=`left:0;top:0;width:${W}px;height:${H}px`;
  probe.appendChild(base); ov.appendChild(probe);
  const pairs=realSticky.map((e,i)=>[e,base.querySelector(`[data-egg-sticky="${i}"]`)]).filter(([,c])=>c);
  pairs.forEach(([,c])=>{ c.removeAttribute("data-egg-sticky"); c.style.position="relative"; c.style.top="0"; c.style.zIndex="5"; });
  pairs.forEach(([e,c])=>{ c.style.transform=`translateY(${e.getBoundingClientRect().top-c.getBoundingClientRect().top}px)`; });
  probe.remove();

  /* the stage: a faint prism behind, the turning group of tiles, seams on top */
  const prism=document.createElement("i"); prism.className="eg-prism"; ov.appendChild(prism);
  const spin=document.createElement("div"); spin.className="eg-spin"; ov.appendChild(spin);
  const cols=W<=620?2:4, rows=3, tw=W/cols, th=H/rows, tiles=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const t=document.createElement("div"); t.className="eg-tile";
    t.style.cssText=`left:${c*tw}px;top:${r*th}px;width:${tw+1}px;height:${th+1}px`;
    const copy=base.cloneNode(true); copy.style.left=`${R.left-c*tw}px`; copy.style.top=`${R.top-r*th}px`;
    t.appendChild(copy);
    t.insertAdjacentHTML("beforeend",'<i class="eg-glass"></i><i class="eg-glint"></i><i class="eg-edge"></i>');
    spin.appendChild(t); tiles.push({t,r,c});
  }
  const seams=[];
  for(let c=1;c<cols;c++){ const s=document.createElement("i"); s.className="eg-seam v"; s.style.cssText=`left:${c*tw-1}px`; ov.appendChild(s); seams.push(s); }
  for(let r=1;r<rows;r++){ const s=document.createElement("i"); s.className="eg-seam h"; s.style.cssText=`top:${r*th-1}px`; ov.appendChild(s); seams.push(s); }
  wrap.style.visibility="hidden";

  /* start a frame after building, so the build and the first frame of motion don't share a frame */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(isDone()) return;
    const CRACK=350, SPLIT=950, KALEIDO=1700, FOLD=1150, SEAL=450, D=CRACK+SPLIT+KALEIDO+FOLD+SEAL;   /* 4600ms */
    const o=x=>x/D;                                                  /* ms to keyframe offset */
    /* crack: the page holds, seams draw outward from the centre */
    seams.forEach((s,i)=>s.animate([{opacity:0,transform:s.classList.contains("v")?"scaleY(0)":"scaleX(0)"},
      {opacity:.9,transform:"scale(1)",offset:o(CRACK)/o(CRACK+250)},{opacity:.35,transform:"scale(1)"}],{duration:CRACK+250,delay:i*40,easing:"ease-out",fill:"forwards"}));
    prism.animate([{opacity:0,rotate:"0deg"},{opacity:.12,rotate:"40deg",offset:.35},{opacity:.12,rotate:"110deg",offset:.75},{opacity:0,rotate:"150deg"}],{duration:D,easing:"linear",fill:"forwards"});
    /* the tiles: hinge on the seam nearest the centre; left and right mirror each other */
    const midC=(cols-1)/2, midR=(rows-1)/2;
    tiles.forEach(({t,r,c})=>{
      const left=c<midC, side=left?1:-1;                           /* +1 left half, -1 right half */
      t.style.transformOrigin=`${left?"100%":"0%"} ${r<midR?"100%":r>midR?"0%":"50%"}`;
      const dist=Math.abs(c-midC)+Math.abs(r-midR), stag=dist*70;
      const a=35+((r*cols+Math.round(Math.abs(c-midC)))%3)*10;     /* 35, 45 or 55deg, same for a mirrored pair */
      const rx=20*(r<midR?1:r>midR?-1:.4);
      const centre=Math.abs(c-midC)<1 && r===Math.round(midR);
      const split=`rotateY(${side*a}deg) rotateX(${rx}deg) translateZ(${-30-dist*12}px)`;
      const kal=centre?`rotateY(${side*(a+180)}deg) rotateX(${rx*.5}deg) translateZ(-20px)`:`rotateY(${side*a*.7}deg) rotateX(${rx*.6}deg) translateZ(${-20-dist*10}px)`;
      const foldStart=CRACK+SPLIT+KALEIDO, foldStag=(2-Math.min(2,dist))*90;   /* outside-in */
      t.animate([
        {transform:"none",offset:0},
        {transform:"none",offset:o(CRACK+stag)},
        {transform:split,offset:o(CRACK+SPLIT)},
        {transform:kal,offset:o(CRACK+SPLIT+KALEIDO)},
        {transform:kal,offset:o(foldStart+foldStag)},
        {transform:"none",offset:o(foldStart+FOLD)},
        {transform:"none",offset:1}],
        {duration:D,easing:"cubic-bezier(.45,0,.25,1)",fill:"forwards"});
      t.querySelector(".eg-edge").animate([{opacity:0},{opacity:1,offset:o(CRACK+SPLIT*.5)},{opacity:1,offset:o(foldStart+FOLD*.6)},{opacity:0,offset:o(foldStart+FOLD)},{opacity:0}],{duration:D,fill:"forwards"});
      /* the glint crosses the whole screen: later tiles catch it later */
      t.querySelector(".eg-glint").animate([{transform:"translateX(-150%) rotate(25deg)",opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{transform:"translateX(300%) rotate(25deg)",opacity:0}],
        {duration:1400,delay:CRACK+SPLIT*.4+(c+r)*90,easing:"cubic-bezier(.45,0,.25,1)"});
    });
    /* the whole view: a breath before the split, a slow turn, back to flat */
    const spinA=spin.animate([{transform:"rotate(0deg) scale(1)"},{transform:"rotate(0deg) scale(.985)",offset:o(CRACK)},
      {transform:"rotate(12deg) scale(.88)",offset:o(CRACK+SPLIT+KALEIDO*.45)},{transform:"rotate(-6deg) scale(.88)",offset:o(CRACK+SPLIT+KALEIDO)},
      {transform:"rotate(0deg) scale(1.006)",offset:o(CRACK+SPLIT+KALEIDO+FOLD)},{transform:"rotate(0deg) scale(1)"}],
      {duration:D,easing:"cubic-bezier(.45,0,.25,1)",fill:"forwards"});
    /* seal: the seams flash once to cover the swap back */
    seams.forEach(s=>s.animate([{opacity:.35},{opacity:.85,offset:.3},{opacity:0}],{duration:SEAL,delay:D-SEAL,easing:"ease-out",fill:"forwards"}));
    spinA.finished.then(()=>{ if(!isDone()) finish(); },()=>{});
  }));
}

/* Scarlet Witch, about 7.8s.
     seep      a crimson vignette closes in from the edges
     tendrils  smoky threads (three strands each: wide haze, glow, bright core)
               curl in from the edges and loop round posters on screen
     caught    each poster twitches as its loop closes, then lifts to its own
               seat on a ring round the centre (evenly spaced: no overlaps)
     gather    comets of light run from each poster into the centre
     orb       halo, two counter-turning smoky wisps, a breathing white-hot
               core; a hex draws round it, runes appear one by one
     inhale    the core and runes contract, posters are drawn in slightly
     release   one soft flash, two mist rings, runes fling outwards
     return    posters drift home nearest first, settle, leave an afterglow;
               the vignette widens back out the way it came
   Glow is layered gradients and stacked strokes: no animated blur or filters,
   only transform and opacity. Floating posters are copies laid exactly over
   the real ones and swapped back invisibly. */
function scarlet(){
  if(reduced()){ toast("Chaos magic needs effects on. Turn them on in Settings."); return; }
  const W=innerWidth, H=innerHeight, cx=W/2, cy=H*.45, U=Math.min(W,H), phone=W<=620;
  const tiles=[...document.querySelectorAll("#list li.entry .tile")]
    .map(t=>({t,b:t.getBoundingClientRect()})).filter(({b})=>b.width&&b.top>40&&b.bottom<H-40&&b.left>=0&&b.right<=W)
    .slice(0,phone?6:8);
  const E=eggOverlay("egg-scarlet",()=>tiles.forEach(({t})=>t.style.visibility="")); if(!E) return;
  const {ov,finish,isDone}=E;
  let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const SC=phone?1.3:1.5, RR=U*.16, liftH=(tiles[0]?tiles[0].b.height:63)*SC, RING=RR+.6*liftH+12;
  /* targets: posters on screen, or points round the centre if none show */
  const targets=tiles.length?tiles.map(({b})=>({x:b.left+b.width/2,y:b.top+b.height/2,b}))
                            :[0,1,2,3,4].map(i=>{ const a=rad(i*72-90); return {x:cx+U*.22*Math.cos(a),y:cy+U*.22*Math.sin(a),b:null}; });
  function rad(d){ return d*Math.PI/180; }
  /* seats: evenly spaced on the ring, matched to posters by angle with the
     rotation that moves them least, so paths don't cross */
  const n=targets.length, angOf=t=>Math.atan2(t.y-cy,t.x-cx);
  const order=targets.map((t,i)=>i).sort((a,b)=>angOf(targets[a])-angOf(targets[b]));
  let best=0, bestCost=Infinity;
  for(let r=0;r<n;r++){ let cost=0; order.forEach((ti,j)=>{ const sa=-Math.PI/2+(j+r)*2*Math.PI/n; let d=Math.abs(angOf(targets[ti])-sa)%(2*Math.PI); cost+=Math.min(d,2*Math.PI-d); }); if(cost<bestCost){ bestCost=cost; best=r; } }
  order.forEach((ti,j)=>{ const sa=-Math.PI/2+(j+best)*2*Math.PI/n; targets[ti].seat=[cx+RING*Math.cos(sa), cy+RING*Math.sin(sa)]; });

  const edgePt=i=>{ const s=i%4, f=.15+rnd()*.7; return s===0?[f*W,-20]:s===1?[W+20,f*H]:s===2?[f*W,H+20]:[-20,f*H]; };
  const curve=([x0,y0],[x1,y1],k)=>{ const mx=(x0+x1)/2, my=(y0+y1)/2, nx=-(y1-y0), ny=x1-x0;
    return `M ${x0} ${y0} C ${x0+(mx-x0)*.6+nx*k} ${y0+(my-y0)*.6+ny*k}, ${mx-nx*k*.6} ${my-ny*k*.6}, ${x1} ${y1}`; };
  const STRANDS=[["haze",.7],["glow",1],["core",1.3]];
  const tendrils=targets.map((t,i)=>{ const e=edgePt(i), sw=(i%2?1:-1)*.35;
    return STRANDS.map(([c,m])=>`<path class="${c}" d="${curve(e,[t.x,t.y],sw*m)}" pathLength="1"/>`).join(""); });
  const loops=targets.map(t=>{ const rx=t.b?t.b.width*.8:U*.04, ry=t.b?t.b.height*.62:U*.04;
    return STRANDS.map(([c])=>`<path class="${c}" d="M ${t.x+rx} ${t.y} A ${rx} ${ry} 0 1 1 ${t.x+rx-.1} ${t.y+.5}" pathLength="1"/>`).join(""); });
  const comets=targets.map((t,i)=>`<path class="comet" d="${curve(t.seat,[cx,cy],(i%2?-1:1)*.2)}" pathLength="1"/>`);
  /* runes: little stroke glyphs round a ring; a hexagon inside it */
  const RN=18, runes=[];
  for(let i=0;i<RN;i++){
    const a=i/RN*Math.PI*2, gx=cx+RR*Math.cos(a), gy=cy+RR*Math.sin(a), s=U*.018, d=[`M ${gx} ${gy-s} L ${gx} ${gy+s}`];
    for(let j=0;j<2;j++){ const y=gy-s+rnd()*2*s, dir=rnd()<.5?-1:1; d.push(`M ${gx} ${y} L ${gx+dir*s*.8} ${y+(rnd()<.5?-s*.6:s*.6)}`); }
    runes.push(`<g class="rune" style="transform-origin:${gx}px ${gy}px"><path class="w" d="${d.join(" ")}" transform="rotate(${a*180/Math.PI+90} ${gx} ${gy})"/><path class="b" d="${d.join(" ")}" transform="rotate(${a*180/Math.PI+90} ${gx} ${gy})"/></g>`);
  }
  const HX=RR*.72, hex=[0,1,2,3,4,5].map(k=>{ const a=rad(k*60-90); return `${cx+HX*Math.cos(a)},${cy+HX*Math.sin(a)}`; }).join(" ");
  ov.innerHTML=`<i class="sw-veil"></i><i class="sw-dim"></i>
    <svg class="sw-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${tendrils.map(t=>`<g class="sw-in">${t}</g>`).join("")}
      ${loops.map(l=>`<g class="sw-loop">${l}</g>`).join("")}
      <g class="sw-comets">${comets.join("")}</g>
      <polygon class="sw-hex" points="${hex}" pathLength="1"/>
      <g class="sw-runes" style="transform-origin:${cx}px ${cy}px">${runes.join("")}</g>
    </svg>
    <i class="sw-halo" style="left:${cx}px;top:${cy}px;width:${U*.7}px;height:${U*.7}px"></i>
    <i class="sw-wisp a" style="left:${cx}px;top:${cy}px;width:${U*.34}px;height:${U*.34}px"></i>
    <i class="sw-wisp b" style="left:${cx}px;top:${cy}px;width:${U*.28}px;height:${U*.28}px"></i>
    <i class="sw-core" style="left:${cx}px;top:${cy}px;width:${U*.2}px;height:${U*.2}px"></i>
    <i class="sw-mist" style="left:${cx}px;top:${cy}px;width:${U*.3}px;height:${U*.3}px"></i>
    <i class="sw-mist" style="left:${cx}px;top:${cy}px;width:${U*.3}px;height:${U*.3}px"></i>
    <i class="sw-flash" style="--x:${cx}px;--y:${cy}px"></i>`;
  const $o=s=>ov.querySelector(s), $$=s=>[...ov.querySelectorAll(s)];
  const veil=$o(".sw-veil"), dim=$o(".sw-dim"), halo=$o(".sw-halo"), wisps=$$(".sw-wisp"), core=$o(".sw-core"),
        mists=$$(".sw-mist"), flash=$o(".sw-flash"), hexEl=$o(".sw-hex"), runeG=$o(".sw-runes"), runeEls=$$(".rune");
  const DRAW=[{strokeDashoffset:1},{strokeDashoffset:0}], SOFT="cubic-bezier(.45,0,.2,1)", F={fill:"forwards"};
  const CENTRE="translate(-50%,-50%)";

  /* seep */
  veil.animate([{opacity:0,transform:"scale(1.12)"},{opacity:1,transform:"scale(1)"}],{duration:1100,easing:"ease-out",...F});
  /* tendrils, then loops; the moment each loop closes, its poster is caught */
  const caughtAt=[];
  $$(".sw-in").forEach((g,i)=>{
    const t0=150+i*100;
    [...g.children].forEach((p,s)=>p.animate(DRAW,{duration:850,delay:t0+s*60,easing:SOFT,...F}));
    [...$$(".sw-loop")[i].children].forEach((p,s)=>p.animate(DRAW,{duration:420,delay:t0+850+s*60,easing:"ease-out",...F}));
    caughtAt[i]=t0+850+420+60;
  });
  dim.animate([{opacity:0},{opacity:.6}],{duration:900,delay:1300,easing:"ease-in-out",...F});
  const lifts=tiles.map(({t,b},i)=>{
    const c=t.cloneNode(true); c.className="tile sw-tile";
    c.style.cssText=`left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`;
    const aura=document.createElement("i"); aura.className="sw-aura"; c.appendChild(aura);
    ov.appendChild(c); t.style.visibility="hidden";
    const [sx,sy]=targets[i].seat, ox=b.left+b.width/2, oy=b.top+b.height/2;
    const tilt=(i%2?1:-1)*(3+rnd()*4);
    const held=`translate(${sx-ox}px,${sy-oy}px) rotate(${tilt}deg) scale(${SC})`;
    const at=caughtAt[i];
    c.animate([{transform:"none"},{transform:"rotate(1.5deg) scale(1.04)",offset:.5},{transform:"none"}],{duration:160,delay:at});
    c.animate([{transform:"none"},{transform:held}],{duration:800,delay:at+160,easing:"cubic-bezier(.2,.8,.3,1)",...F});
    aura.animate([{opacity:0},{opacity:1}],{duration:500,delay:at,...F});
    const bob=c.animate([{translate:"0 0"},{translate:`0 ${-U*.01}px`},{translate:"0 0"}],
                        {duration:1500+i*90,delay:at+960,iterations:Infinity,easing:"ease-in-out",composite:"add"});
    return {c,b,held,bob,aura,ox,oy,sx,sy};
  });
  /* threads fade as the posters rise */
  [...$$(".sw-in"),...$$(".sw-loop")].forEach(g=>g.animate([{opacity:1},{opacity:0}],{duration:600,delay:2400,...F}));
  /* gather: comets from each seat into the centre */
  $$(".comet").forEach((p,i)=>p.animate([{strokeDashoffset:.3,opacity:1},{strokeDashoffset:-1,opacity:1}],{duration:650,delay:2700+i*50,easing:"ease-in"}));
  /* the orb forms: halo, then smoke, then the core with a glint */
  halo.animate([{opacity:0,transform:`${CENTRE} scale(.5)`},{opacity:1,transform:`${CENTRE} scale(1)`}],{duration:900,delay:3000,easing:"ease-out",...F});
  wisps.forEach((w,i)=>{
    w.animate([{opacity:0},{opacity:.9}],{duration:700,delay:3200+i*120,...F});
    w.animate([{transform:`${CENTRE} rotate(0deg)`},{transform:`${CENTRE} rotate(${i?-360:360}deg)`}],{duration:i?7000:5000,delay:3200,iterations:Infinity});
  });
  core.animate([{opacity:0,transform:`${CENTRE} scale(.2)`},{opacity:1,transform:`${CENTRE} scale(1)`}],{duration:700,delay:3400,easing:"cubic-bezier(.2,.8,.3,1.2)",...F});
  core.animate([{scale:"1"},{scale:"1.07",offset:.3},{scale:".97",offset:.55},{scale:"1.05",offset:.8},{scale:"1"}],{duration:1400,delay:4100,iterations:2,composite:"add"});
  /* the hex draws, the runes appear one by one, the two turn opposite ways */
  hexEl.animate(DRAW,{duration:700,delay:3300,easing:SOFT,...F});
  hexEl.style.transformOrigin=`${cx}px ${cy}px`;
  hexEl.animate([{rotate:"0deg"},{rotate:"-25deg"}],{duration:2600,delay:3300,easing:"linear",...F});
  runeEls.forEach((r,i)=>r.animate([{opacity:0,transform:"scale(.5)"},{opacity:1,transform:"scale(1)"}],{duration:300,delay:3500+i*40,easing:"ease-out",...F}));
  runeG.animate([{rotate:"0deg"},{rotate:"40deg"}],{duration:2600,delay:3300,easing:"linear",...F});
  /* inhale */
  const INH=5600, REL=5950;
  core.animate([{transform:`${CENTRE} scale(1)`},{transform:`${CENTRE} scale(.8)`}],{duration:350,delay:INH,easing:"ease-in",...F});
  runeG.animate([{scale:"1"},{scale:".9"}],{duration:350,delay:INH,easing:"ease-in",composite:"add",...F});
  lifts.forEach(L=>{ const dx=cx-L.sx, dy=cy-L.sy, d=Math.hypot(dx,dy)||1;
    L.inh=L.c.animate([{translate:"0 0"},{translate:`${dx/d*6}px ${dy/d*6}px`}],{duration:350,delay:INH,easing:"ease-in",composite:"add",...F}); });
  /* release */
  flash.animate([{opacity:0},{opacity:.35},{opacity:0}],{duration:500,delay:REL,easing:"ease-out"});
  mists.forEach((m,i)=>m.animate([{opacity:.9,transform:`${CENTRE} scale(.3)`},{opacity:0,transform:`${CENTRE} scale(${Math.hypot(W,H)*.75/(U*.15)})`}],
    {duration:1500+i*300,delay:REL+i*140,easing:"cubic-bezier(.15,.6,.35,1)",...F}));
  runeG.animate([{opacity:1,scale:"1"},{opacity:0,scale:"1.6"}],{duration:600,delay:REL,easing:"ease-out",composite:"add",...F});
  [halo,...wisps,core].forEach(e=>e.animate([{opacity:getComputedStyle(e).opacity||1},{opacity:0}],{duration:500,delay:REL,easing:"ease-out",...F}));
  hexEl.animate([{opacity:1},{opacity:0}],{duration:400,delay:REL,...F});
  dim.animate([{opacity:.6},{opacity:0}],{duration:1200,delay:REL+250,easing:"ease-in-out",...F});
  /* return: nearest first, a small settle, a crimson afterglow where each lands */
  const reach=Math.hypot(W,H)*.75;
  const lands=lifts.map(L=>{
    const when=6000+Math.min(1,Math.hypot(L.ox-cx,L.oy-cy)/reach)*500;
    setTimeout(()=>{ if(isDone()) return; const cur=getComputedStyle(L.c).translate; L.bob.cancel(); if(L.inh) L.inh.cancel();   /* both offsets ease out together */
      L.c.animate([{translate:cur==="none"?"0 0":cur},{translate:"0 0"}],{duration:1000,easing:SOFT,...F}); },when);
    L.aura.animate([{opacity:1},{opacity:0}],{duration:900,delay:when,...F});
    const glow=document.createElement("i"); glow.className="sw-after";
    glow.style.cssText=`left:${L.ox}px;top:${L.oy}px;width:${L.b.width*2.4}px;height:${L.b.width*2.4}px`;
    ov.appendChild(glow);
    glow.animate([{opacity:0},{opacity:.8,offset:.3},{opacity:0}],{duration:800,delay:when+850});
    return L.c.animate([{transform:L.held},{transform:"scale(.98)",offset:.82},{transform:"none"}],
                       {duration:1000,delay:when,easing:SOFT,...F}).finished.catch(()=>{});
  });
  /* the vignette leaves as it came */
  const leave=veil.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(1.12)"}],{duration:1600,delay:6200,easing:"ease-in-out",...F});
  Promise.all([...lands,leave.finished.catch(()=>{})])
    .then(()=>{ if(!isDone()){ tiles.forEach(({t})=>t.style.visibility=""); finish(); } },()=>{});
}

function oneInFourteenMillion(){
  const un=pool().filter(m=>m.r<=today()&&!isDone(m));
  if(!un.length){ toast("I looked forward. All of them are watched."); return; }
  const pick=un[Math.floor(Math.random()*un.length)];
  state.phase=0; state.show="all"; state.q="";
  $("#show").value="all"; $("#q").value="";
  openIds.add(pick.id);
  if(state.view!=="list") setView("list"); else render(true);
  setTimeout(()=>focusOn(pick.id),60);
}
function nexus(){
  state.sort="chrono"; $("#sort").value="chrono"; save();
  if(state.view!=="list") setView("list"); else render(true);
  window.__bifrost();
}


/* ---------- tonight ----------
   One screen: the next thing, how long it is, and a button. */
function tonight(){
  const queue=sorted(pool().filter(m=>!isDone(m)&&m.r<=today()));
  const m=queue[0];
  if(!m){ toast("Nothing left to watch tonight. You are caught up."); return; }
  const art=artOf(m), len=lengthLabel(m);
  return modal(`
    <div class="tonight">
      ${art?`<div class="tart" style="background-image:url('${IMG_BIG(art)}')"></div>`:""}
      <span class="epslabel">Tonight</span>
      <h3>${m.ti}</h3>
      <p>${len?len+" · ":""}${new Date(m.r+"T00:00:00").getFullYear()} · Phase ${m.p}${queue.length>1?` · ${queue.length-1} more after this`:""}</p>
      <div class="artrow modalacts">
        <button class="btn" type="button" data-x="skip">Something else</button>
        <button class="btn primary" type="button" data-x="done">Watched it</button>
      </div>
    </div>`,
  (root,close)=>{
    root.querySelector('[data-x="done"]').addEventListener("click",()=>{ close(true); setWatched(m.id,true); });
    root.querySelector('[data-x="skip"]').addEventListener("click",()=>{ close(false); surprise(); });
  });
}

/* a panel for commands that have something to report */
function readout(title,body){
  return modal(`<h3>${title}</h3>${body}
    <div class="artrow modalacts"><button class="btn primary" type="button" data-x="ok">Close</button></div>`,
    (root,close)=>root.querySelector('[data-x="ok"]').addEventListener("click",()=>close(true)));
}

function streaks(){
  const days=[...new Set([].concat(...DATA.filter(started).map(views)))].sort();
  let best=0,run=0,prev=null;
  days.forEach(d=>{
    const t=new Date(d+"T00:00:00").getTime();
    run=(prev!==null && t-prev===864e5)?run+1:1;
    best=Math.max(best,run); prev=t;
  });
  let current=0;
  if(days.length){
    const gap=Math.round((new Date(today()+"T00:00:00")-new Date(days[days.length-1]+"T00:00:00"))/864e5);
    current=gap<=1?run:0;
  }
  return {days:new Set(days),best,current,total:days.length};
}

function eggAllDay(){
  const s=streaks();
  if(!s.total){ toast("Nothing logged yet. I could do this all day, but there’s nothing to show."); return; }
  const cells=[];
  for(let i=41;i>=0;i--){
    const d=ymd(new Date(Date.now()-i*864e5));
    cells.push(`<i class="${s.days.has(d)?"on":""}" title="${d}"></i>`);
  }
  readout("I can do this all day",`
    <div class="bigpair">
      <div><b>${s.current}</b><span>current streak</span></div>
      <div><b>${s.best}</b><span>longest streak</span></div>
      <div><b>${s.total}</b><span>days watched</span></div>
    </div>
    <div class="heat">${cells.join("")}</div>
    <p style="margin-top:12px">The last six weeks. Each square is a day; filled means you logged something.</p>`);
}

function eggBinge(){
  const P=pool(), out=P.filter(m=>m.r<=today());
  const left=out.filter(m=>!isDone(m));
  const mins=left.reduce((s,m)=>s+Math.max(0,totalMinutes(m)-minutesSeen(m)),0);
  const cut=ymd(new Date(Date.now()-90*864e5));
  const recent=[].concat(...P.filter(started).map(views)).filter(d=>d>=cut).length;
  const perWeek=recent/13;
  const weeks=perWeek>0.2 ? Math.ceil(left.length/perWeek) : 0;
  const finish=weeks ? new Date(Date.now()+weeks*7*864e5).toLocaleDateString("en-GB",{month:"long",year:"numeric"}) : "—";
  const pct=out.length?Math.round((out.length-left.length)/out.length*100):0;
  readout("Binge assessment",`
    <div class="bigpair">
      <div><b>${hhmm(mins)||"0m"}</b><span>still to watch</span></div>
      <div><b>${left.length}</b><span>titles left</span></div>
      <div><b>${pct}%</b><span>of what’s out</span></div>
    </div>
    <div class="epsbar" style="margin:4px 0 12px"><i style="width:${pct}%"></i></div>
    <p>Back to back that is <b>${Math.round(mins/60)} hours</b>, or <b>${Math.ceil(mins/60/3)} evenings</b> at three hours a night.
    ${weeks?`At your pace over the last 90 days you would finish around <b>${finish}</b>.`:`You have not logged enough recently to guess a finish date.`}</p>`);
}

function eggTimeHeist(){
  state.sort="chrono"; $("#sort").value="chrono"; state.phase=0; state.q=""; $("#q").value="";
  state.show="all"; $("#show").value="all"; save();
  if(state.view!=="list") setView("list"); else render(true);
  const first=sorted(pool().filter(m=>m.r<=today() && !isDone(m)))[0];
  window.__bifrost&&window.__bifrost();
  if(!first){ toast("Nothing left to retrieve. The timeline is complete."); return; }
  openIds.add(first.id); render();
  setTimeout(()=>focusOn(first.id),80);
  toast(`Time heist. Earliest gap in the timeline: ${first.ti}.`,{ms:5000});
}

function eggHulk(){
  if(!fxOn()){ toast("That’s my secret — effects are switched off."); return; }
  flash();
  document.body.classList.add("hulk");
  setTimeout(()=>document.body.classList.remove("hulk"),9000);
}

function eggCanon(){
  const loved=DATA.filter(m=>extraOf(m.id).rate>=4);
  if(!loved.length){ toast("No canon events yet — rate a few titles four or five first."); return; }
  const pick=loved[Math.floor(Math.random()*loved.length)];
  state.phase=0; state.q=""; state.show="all"; state.maxlen=0;
  $("#q").value=""; $("#show").value="all"; $("#maxlen").value="0";
  openIds.add(pick.id);
  if(state.view!=="list") setView("list"); else render(true);
  setTimeout(()=>{ focusOn(pick.id); flashBackdrop(pick); },80);
  toast(`A canon event. You rated ${pick.ti} ${extraOf(pick.id).rate} out of 5 — watch it again.`,{ms:6000});
}

const EGGS={
  "all day":       {say:"",  run:eggAllDay},
  "binge":         {say:"",  run:eggBinge},
  "tonight":       {say:"",  run:tonight},
  "time heist":    {say:"",  run:eggTimeHeist},
  "we have a hulk":{say:"That’s my secret. I’m always angry.", run:eggHulk},
  "canon":         {say:"",  run:eggCanon},
  "snap":          {say:"Perfectly balanced, as all things should be.", run:snapHalf},
  "thanos":        {say:"Perfectly balanced, as all things should be.", run:snapHalf},
  "blip":          {say:"Five years later. Everybody back.",            run:blip},
  "bifrost":       {say:"Heimdall, open the Bifröst.",                  run:()=>{window.__bifrost();setTimeout(window.__bifrost,420)}},
  "heimdall":      {say:"Heimdall, open the Bifröst.",                  run:()=>window.__bifrost()},
  "tva":           {say:"For all time. Always.",                        run:()=>{
    setView("stats");
    if(state.theme!=="tva") setTimeout(()=>toast("Run the whole site on TVA styling?",
      {action:"Keep it",ms:7000,onAction:()=>setTheme("tva")}),2600);
  }},
  "assemble":      {say:"Avengers, assemble.",                          run:assemble},
  "wakanda":       {say:"Wakanda forever.",                             run:()=>{state.phase=0;$("#q").value="";state.q="";render(true);focusOn("bp1")}},
  "dormammu":      {say:"I've come to bargain.",                        run:()=>{window.__bifrost();setTimeout(()=>snap(true),300)}},
  "i am iron man": {say:"I am Iron Man.",                               run:starkMode, ms:9000},
  "on your left":  {say:"On your left.",                                run:onYourLeft},
  "puny god":      {say:"Puny god.",                                    run:shakeTitle},
  "i am groot":    {say:"I am Groot.",                                  run:()=>swapSubs("I am Groot.",6000), ms:6000},
  "worthy":        {say:"Whosoever holds this hammer, if they be worthy…", run:worthy, ms:4600},
  "14000605":      {say:"One. We win in one.",                          run:oneInFourteenMillion},
  "pym":           {say:"Shrink.",                                      run:pym},
  "gauntlet":      {say:"I am inevitable.",                             run:gauntlet, ms:4200},
  "infinity stones":{say:"I am inevitable.",                            run:gauntlet, ms:4200},
  "mirror dimension":{say:"You think you know how the world works?",    run:mirrorDimension},
  "strange":       {say:"You think you know how the world works?",      run:mirrorDimension},
  "scarlet":       {say:"Chaos magic.",                                 run:scarlet},
  "wanda":         {say:"Chaos magic.",                                 run:scarlet},
  "scarlet witch": {say:"Chaos magic.",                                 run:scarlet},
  "ultron":        {say:"There are no strings on me.",                  run:glitchTitles},
  "nexus":         {say:"Found the branch. Switching to chronology.",   run:nexus},
  "3000":          {say:"",                                             run:()=>{
    const n=pool().filter(started).reduce((s,m)=>s+viewCount(m),0);
    toast(`${n} viewings logged. I love you 3000.`,{ms:5000});
  }},
  "jarvis":        {say:"", run:()=>{
    const groups=[
      ["Does something useful", ["all day","binge","tonight","time heist","canon","nexus","assemble","14000605","3000","wakanda","tva"]],
      ["Just for the look of it", ["snap","blip","gauntlet","mirror dimension","scarlet","we have a hulk","i am iron man","bifrost","pym","ultron","puny god","on your left","i am groot","dormammu","worthy"]]
    ];
    readout("At your service",
      groups.map(([h,list])=>`<p class="cmdhead">${h}</p><div class="cmds">${
        list.map(c=>`<code>${c}</code>`).join("")}</div>`).join("")
      + `<p style="margin-top:12px">Type any of these into the search box and press Enter.</p>`);
  }}
};
function checkEgg(raw){
  const k=raw.trim().toLowerCase();
  if(!EGGS[k]) return false;
  $("#q").value=""; state.q="";
  render(true);
  if(EGGS[k].say) toast(EGGS[k].say,{ms:EGGS[k].ms||3600});
  EGGS[k].run();
  return true;
}

/* ============================ CONTROLS ============================ */
function markDirty(){
  const f=$("#qfield");
  f.classList.toggle("dirty", !state.liveSearch && $("#q").value.trim()!==state.q.trim());
}
function searchMode(){
  $("#q").placeholder = state.liveSearch ? "Search titles" : "Search titles, then Enter";
  markDirty();
}
function commitSearch(){
  const v=$("#q").value;
  /* on a touch screen, Enter means "done": close the keyboard so the results show */
  if(matchMedia("(hover:none)").matches) $("#q").blur();
  if(checkEgg(v)){ markDirty(); return; }
  state.q=v; render(true); markDirty();
}
$("#q").addEventListener("input",e=>{
  if(state.liveSearch){
    if(checkEgg(e.target.value)) return;
    state.q=e.target.value; render(true);
  }
  markDirty();
});
$("#q").addEventListener("keydown",e=>{
  if(e.key==="Enter"){ e.preventDefault(); commitSearch(); }
});
$("#sort").addEventListener("change",e=>{state.sort=e.target.value;save();render(true)});
$("#show").addEventListener("change",e=>{state.show=e.target.value;save();render(true)});
$("#maxlen").addEventListener("change",e=>{state.maxlen=Number(e.target.value);save();render(true)});
$("#series").addEventListener("change",e=>{state.series=e.target.checked;save();render(true);renderStats()});
$("#tabList").addEventListener("click",()=>setView("list"));
$("#tabStats").addEventListener("click",()=>setView("stats"));
$("#tabSet").addEventListener("click",()=>setView("settings"));
const PREF_KEYS=["sort","show","series","liveSearch","theme","fx","compact","maxlen","hideFuture"];
async function exportBackup(){
  const label=await askLabel();
  if(label===null) return;                   /* cancelled */
  /* artwork that already ships inside this file doesn’t need to travel with
     the backup — only what differs is exported, keeping it small */
  const slim={};
  for(const id in meta){
    const b=BUILTIN_ART[id];
    if(!b || JSON.stringify(b)!==JSON.stringify(meta[id])) slim[id]=meta[id];
  }
  const prefs={}; PREF_KEYS.forEach(k=>prefs[k]=state[k]);
  const payload={watched:state.watched, extra:state.extra, hidden:state.hidden, meta:slim, prefs, label, exported:today(), v:3};
  const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const slug=(label||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30);
  a.download=`mcu-tracker-${today()}${slug?"-"+slug:""}.json`; a.click(); URL.revokeObjectURL(a.href);
  const loc=localCount(), have=artCount(), short=have-loc;
  if(short>0 && short<=6){
    const names=DATA.filter(m=>{const p=artOf(m); return p&&!isLocal(p);}).map(m=>m.ti).join(", ");
    toast(`Exported. ${short} couldn’t be embedded and stay as web links: ${names}. Drop an image onto those rows to fix them.`,{ms:11000});
  } else if(short>0){
    toast(`Exported — but ${short} of ${have} are web links rather than images, so they won’t show on a device that blocks the image host.`,{ms:9000});
  } else {
    toast(`Exported with ${loc} embedded images. This file works anywhere, with no network.`,{ms:6000});
  }
}
function importBackup(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="application/json";
  inp.onchange=async()=>{
    const f=inp.files[0]; if(!f) return;
    try{
      const j=JSON.parse(await f.text());
      if(!j.watched) throw 0;
      state.watched=j.watched;
      if(j.extra && typeof j.extra==="object") state.extra=Object.assign({},state.extra,j.extra);
      if(j.hidden && typeof j.hidden==="object") state.hidden=Object.assign({},state.hidden,j.hidden);   /* merged, like the rest */
      if(j.meta && typeof j.meta==="object"){ meta=Object.assign({},meta,j.meta); saveMeta(); }
      let prefsApplied=false;
      if(j.prefs && typeof j.prefs==="object"){
        PREF_KEYS.forEach(k=>{ if(j.prefs[k]!==undefined) state[k]=j.prefs[k]; });
        $("#sort").value=state.sort; $("#show").value=state.show;
        $("#series").checked=state.series; $("#maxlen").value=String(state.maxlen||0);
        applyPrefs(); searchMode(); prefsApplied=true;
      }
      save(); render(); renderStats(); renderSettings();
      const what=[j.label?`“${j.label}”`:"Backup", "restored"].join(" ");
      toast(`${what} — ${Object.keys(j.watched).length} watched entries${j.meta&&Object.keys(j.meta).length?", artwork":""}${prefsApplied?", settings":""}.`,{ms:6000});
    }catch(e){ toast("That wasn’t a tracker backup. Pick the .json you exported."); }
  };
  inp.click();
}



/* ---------- installable ----------
   The hosted site links a real manifest.webmanifest (with icon files), which
   is what Android needs for a proper home-screen app. The single portable file
   has no such files, so there the manifest is built at run time and handed to
   the browser as a blob instead (build.ps1 removes the static link). */
(function(){
  if(document.querySelector('link[rel="manifest"]')) return;
  try{
    const manifest={
      name:"Sacred Timeline", short_name:"MCU",
      description:"Marvel watch tracker",
      start_url:".", scope:".", display:"standalone",
      background_color:"#05060a", theme_color:"#05060a",
      orientation:"any",
      icons:[
        {src:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAAF5klEQVR42u3dMVIUURDG8cfWSiCJmeUVTE1MyAwk4Ax6BfUc6hXwDAQamJGYmHoFioyEhMhgKYqiYJh581731/3+X2QVW7C187O73+zMm71n+88LIbXZ8BEQABEAEQARABECIAIgAiACIEIARABEAEQARAiACIAIgAiACAEQARABEAEQARAhACIAcsr18eH18eGcVx6dXB2dXPGJ7bI34I2FE1D2T8+e1DPx058fD0b7MLegaZi7vAbBtMVNb0y5JW1xgyQAidJ5UFIyRkmG6IZupufohuuvHJK20KEgDQooLp1MjLbQgdFYM1AnPU+eQuw3DIUejCIBMpuUVy7Xh2IUBlATPT3cdJIUxVAAQCvp2KDphEmfkTqgNXp86bRiJG5IGlCdHh03rSQpGxIFlI9OVkaKgCr0RKGzkpGgoQ16vFKhQfBKSK0KtFRPUDorWUjVISFAi/TkoFPNSMfQBj0RO5pOL9ugB0OxW9h8PYnpVONw72Ub9IQuRe51aIMeDIUEhJ4chtRvbR5Wj9pyXQvQzPIzuJ5FhryK0AY9GIoECD3JDCnOQOipNmQ/M/mcSFyzwcrgmagxLhO325noBw2hp86Q42LNrYXtn57BJcFSX+i7MDwtLUIKZ4lG3OKOJF+FEQARABECIAIgIp2OG0xdf/p1sz7//p4P2iU/Pt+ccvzw7SAeoHuSojA6v7ic+Omrly8CuYldgQIxmkbz2CsFMVnS2aXXicTb/vVgRBjNdzMdBUlP0unUxQYdos8vLlvpaf7b6tJvynEANF1+0hQem18r3t1GeVqPzTHe/f4Qg3bgFuY1AJlVCK9S5NLF2gPS7F/GB1WznfXoYtYVyKX8uBxOlz9qX4Tyr8Ici4H4WK0ISK1/uR9CNUPNu1jmCiRy8HLXIVNAlgOQ1GGzfDPGYxCXcxAZQDoDkGDX0HlLbccguwpk1r9kZw6zN2bZxWhhBEBxljz5VmRUIAIgAqBxGkSyLtYMUIhrWMfJ9EKs4UqeFkYARAA01GyRaQyiAhEAEQARABEAEQIgAiACIAIgQgYCFGhLg0y7L1CBCIBIAkDTV/yIbzmVL9NX/DS8bSNVBQoxWyTbfooWRgBEADRIg8i3fSIViAQBZLYQk/1fbvbGLPerbwlI594dQUM6b6nt1gu0MBIHkOXpRKkiZPlmjJ+3krkCiRjKvXF9Y0BqtzC7Hzw1Pc33nso/AzkewhEemmENyOVbVZcD6fJH7R841x6Q5kYcxodTs/b02DvRoYV5XdphdlC99NiXnzLa88J2h7bf3gZDPSmsYwUS306q02EW19Np799tGTJtS1GIh+52Sq+nNj8260R/7Ld4yXmMUb+tx+0qkHJfu0thGlOIPmVZjbaD00k5CN/WGwNJHVsYYRVGCIAIgAiACIAIcVnGT+ftv6+7f/x5/YXjMTPXv9+UUvbf/XV/J87L+Fs9GFqq5za+jLYidMgaT46GfCrQhB6K0KLy416KrAHNKTwYqtDjZUhxFUZ3q9Mz8zWxAc2sLhiqkzFEBcJQGj1uLQxDOfQU/TPRgxuyn2nCAJq/1BrW0Hw9jueBPCsQhqLr8W9hGAqtp4hc0roIR+7TjIuGHoUvUyWG6EUmEpeicHqEVmEYiqinqN2VsVRGjna2dK2uo6cI3tZTUV3iMqo4zSOlpwieSKzQELSjJdBTZG8srDMRpRTVnV8W1FPE70zNxygTnQCAVrYnHUlrvtJS1lNC3Bu/csTxZbTy21BxPSXQ5gpNJmUbTE2+QtenEwxQ29VWD0kNL72IoqdE3N6l06J9KalOV+oEohMVUOl84mdaUtcrvMLpKUE32dwd40zfiEWkExhQJkZx6YQHFJ1RdDqBZ6B+49GTo/T6GSiHmzwVKFBBSkYnJ6B7hURBUko3yQEpSMrtZhRADw43/TANgibzEL1y+p5zPlpnezkAkfBhl1YCIAIgAiACIEIARABEAEQARAiACIAIgAiACAEQARABEAEQIQAiACIAIgAiACIEQMQ8/wFBBWwWdaog+gAAAABJRU5ErkJggg==", sizes:"192x192", type:"image/png", purpose:"any"},
        {src:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAOrklEQVR42u3dMZIT197GYTE1KICEjGILTklInDnAgdeAtwBeB7AFswYHJiAjceKULVBkJCQTORiKGg+SkNR9us/5v88TfXVvffdeWq7316dbM9y5u723ASDPhUsAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAMCJLl0CRnT12887//XtX++b/vf++ueXnf/637/f96EgALDQ1ndlZxhUAQGAgot/RhX0gN7cubu95ypQZvGbPgLa9/znPHqAEwBGP9TNnIgBAoDRFwMxQAAw+mIgBggAdl8MlAABwO4rgRIwG98Cotrut/si0LzfAppICXACwO47EygBAoDdVwIQAEx/bAlkAAHA7jsQKAECgOl3IIBdfAuIatPf6FtAXX0F6FQygBMAbvmjTwNKgABg+tNLIAMIAKZfBhAATD8yQB4vgU1/QS3eAw/9EviHZMAJANOP0wBBLlwC6w8JpxycAEw/OAogAKYfZEAAMP0gA4G8A7D+HDuF/uw4AWD6cRSgAj8HYPoH1u5vf3SDvI8MCADWP3TuJUEDBADTb+7TkyADAoD1N/q5MdAAAcD0G/3oGMiAAGD97X5uCTRAALD+Rj83BhogAJh+ux9dAhkQAKy/3c8tgQYIANHrb/rDM6ABAkDc9Nt9JZABASBu/U2/DGiAAJC1/nZfCTRAADD9yIAMCADV19/0y4AGCABx62/6ZUADBIC49Tf9MqABAkDc+pt+GdAAASBu/U2/DGiAAGD6kQEZEACqr7/plwENiHLhElh/6x+lq80t//cnOwHQ+/qbfkcBTRIA4tbf9NNJBjRgFR4BWX+idbK8ngU5AVh/00/0BDsHOAFYf+tP6Pg6BzgBWH/TT/QKOwc4AVh/60/o/joHOAFYf9NP9FHAOcAJwPpbf0In2DlAAKy/9UcDaMUjoJrrb/ops8WeBTkBWH/rT+hRwDlAAKy/9UcDmNmlS1CG6WeZBphjJwD6uv23/tQ+CqiOAFh/648GIADW3/qjAQiA9QcNQACsP2gAx/KDYEOuv+mnN8uPsh8QcwJIZP1xFEAAEm//rT8asNaZQwCw/qABAmD9rT9ogABg/WGtBiAAlW//rT8a4BAgANYfNEADBMD6gwZogABUZf3RAAQg8fbf+qMBDgECkLj+AAvwu4B6zIDbf+pZ4Pbc4yYBGL4B1h8NMP0CkJgB648GWH8BSGyA9UcDTP+SvATuZbKtPyHmWm3r7wRQ5Chg/XEOsP7Lu3QJ5rp/9yVRGOgAgRNAF0cBt/84BFh/AUhsgPVHA0y/ACRmwPrDMQ2w/o14B9CKtwIwnelvytdA2zbA7T+cPfHWvzWPgJbw/VHA+sNN3z8Isv4CULMB1h8ONMD0L8YjoIVs/3pv9+GHrL8TAABOAAAIAAACAIAAACAAAAgAAAIAgAAAIAAAAgCAAAAgAAAUl/s3gl09f3v9f2xfP/XPAQR68+LrL6B+9ir0V5D6KyG/lkAGIHD6nQCQAbD7iUL/PoBvz392koFiPn76fMb/16OHD1y6nOnPfArkBOA0YO6P/c+RBHf9TgDFb/+dBpJH3/kgefoDDwFOAMfWQgmM/r7/djFw1+8EUPD234HA7jsWRE1/2iHACeCcfsiA6T/wv1AG3PULgAyQsvv7/gcrgd3vXNYjoInPf3aSAdN/mAyMNf1RT4GcAJwGTP8SfxYZcOPfoaBfBtfi9p8Wc1lp/cv/uaRFANK5/TeR/owLi/31bQJAzWX0h4WFpbwEbvf8x+2/NTybFwMTtXtcE3LCcALA+vvjE8q3gLB9618HRwGcAFrx/Mf6uyAltXtQE/JdII+AMHYuC04AuP1vv3FmzvUZ5RAgABX4+S93uC4UZ0h4CuQEgFFzuXAC4BSe/5gzF60TngIJwG6e/xgyl46zlX8K5ATg9t+EuYAOAU4AYLxcRgSgBs9/zJaLyUS1nwI5AZzM8x+D5ZJ2yFMgAcBUubAgABgplxcyA9DoBYDnP+bJRe5Wo6dAhV8DOAEAOAGAO1OXGgEAk+SCIwBD8gLAGLnsmbwGEAAABAD3oS4+CMBEnv8YIB/BEPxIcHQA/AogYHYlXwM4AeDe0weBEwAYHR8HAsAtXgDAQLwGEADcb/pQICkA3gADjdR7D+wEgDtNHw1OAOzhBQAMx2sAAcA9pg8IBACAwgHwBtjdJT6mpoq9B3YCAHACAEAA+MZXgK55sODDGo4vAgkAAAKAO0ofGQgAAHUC4DugwAIqfRPUCYAf8DDBB4cTQCJfAYKh+SKQAAAgAAAIAMfwHNnHhwAAIAAACAAAAkBBniD7EBGAAfgxYGAxZX4Y2AlgLz8FBgX4WTABAEAAABAAAAGA23x7xEeJAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAATPHo4QMXwUeJAAAgAAAIAAACUNPV87cuAozuzYsvLkLxAGxfP/VZAst49uq+AFCcb4/4EHECAEAAABAAAASAsjxB9vEhAAAIAAACUJ6fBYOh+SkwAWASz5F9cAhA7/wwMLCAMj8G7AQA4AQA+3mY4CNDAAAQgBi+COSO0oc1KF8BEgAABACAqgHwTdCmPFjwMVHpO6BOAABOAODu0geEAHCLLwLBcHwFSABwj+mjgZgAeA8MNFLsDbATAO40fSg4AXCQ1wAwEC8ABAD3mz4OEACMjg8CEgLgPTAwu3pvgJ0ATuA1gHtPH8EQvAAQAAyQiw8CAEBOABq9BvAUyH2oy965Rs9/Sr4AcALAGLngOAGASXKpEQAABGBgXgO4M3WR03gBIACYJ5cXBAAj5cKCAMzIUyBT5ZJ2yA8AC8D/+KVABsvFZKLCLwCcADBbLiNOAJzCUyDj5QJ2xfMfAdjBUyAT5tJxttrPf5wAHAIMmYvm9t8JAMyZy4UAFOMpkFFzoThD+ec/TgCTeAp0xrRZN9dnXp7/CADucF0WEIBd2j0Fcggwdi5Iydv/hOc/m83m0j9DrDh5Hz99dh38w4ATAObPHx8Wdefu9l7IH7Xd4xpfNJou7Shg+qfz/McJAIPoDwsCUPFskdaA8svoi5793/4LQE0e1JhIfy5+KOf5z8a3gHSl27ncVHkxYPcbzbRDwHRBL4Gvzfi4xvQvY9wMmP4FzJuBqNt/JwDTP9KMjlICu7/wUaBFCQQA09/jsPacAdO/eglk4CRxj4A25z4FMv296acEdr8352Ug7fmPE4DdH/5AsFYMjL7TgBNA5UOA6XcyMPo5p4HA238nANNf/GQwJQnm3mnACSDrEGD6IfA0kHn77wRg+iHuNOBAIACmH9JLIAO5j4AAwvltoAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIQJAnH14++fDSdYDvXb17fPXuseuwJL8OernpdxHgmAxsf/nXdViGXwe9zvr/89MfLgvc3P1b/4oMCEDlG38NgH3rrwHL8A5gnfXfeCgEB9f/8L+FAAy8/sCReZCBdjwCWnn6PQjC7f8xPA4SgJo3/hqA9ZcBAYibfg3A+mvAirwDWH/9gZPK4a2AE0C16XcIwO2/o4ATQOiNvzME1n+V/xwnAHqZbOcArL+jgADETb8GYP01QACi118DsP4yIACh068BWH8NWIyXwEYZEAB6aoAvBeH23+2/AOTSAKw/AhB6CNAArL/bfwHQALD+1l8ANACsv/UXgCgagPVHAEIPARqA9Xf7LwAaANbf+guABoD1RwCiaADWn1n4XUADj7JfTUHs9Lv9dwLoyCpb7CiA9UcANACsPwKgAWD9EQANAOuPAGgAWH9uu3QJyrhugK8GUWz6cQJwCHAUIHf93f4LgAZoANafOflBsMpb7HEQQ0+/9XcCcA5wFMD6IwAaoAFYf+bjEVDKEHscxCjTb/2dAJwDHAWw/jgBOAc4CpAx/dbfCcA5wFEA648TgHOAowAZ02/9nQCcAxwFsP44ATgHOAqQMf3WXwA0QAZInH7rvy6PgGxujzXC+uME4BzgKEDN6bf+AoAMYPoRALp8CCMDpt/6CwC5DZAB02/9BYDoBsiA6bf+AkB0A2TA9Ft/ASC6ATJg+q2/ACADMmD6Tb8AkNoAJbD71l8ASG+ADJh+6y8ApGdACcJ33/QLAOkNkIHM6bf+AoAGKEHc7lt/AUAGlCBx902/AKABYpA1+tZfANAAJQjdfesvAMiAGMSNvukXADRADOJG3/oLADIgCVlzb/oFAA2QhLi5t/4CgAxEhyFt5U1/iEuXoOr8yQCmn8MuXAJ3wVhAf3YnABwFwPQLADKA6UcAkAFMPyV5B5CYAbD+OAE4CoDpz+XnAKL5HRLHq/qjAKbfCQCnAdz1IwDIAKYfAUAGMP0IAFkZUAK7TwIvgTnE30F/k7+lHScA4g4ETgPu+hEAojOgBHYfAcCBQAZMPwKAAwF2HwFACbD7jMW3gJjT6iVo+tvuevgWkN3HCQBnAvf7IAAogd0HAaDnEoiB0UcAEAMxMPoIAGIQHAOjz+p8C4juTOlB67/zcsoXgSw+TgBw2oiPez6w+AgAzNmDPqtg6xmRR0AAoS5cAgABAEAAABAAAAQAAAEAQAAAEAAABAAAAQBAAAAQAAAEAAABAEAAABAAAAQAAAEAQAAAEAAABAAAAQBAAAAQAAABAEAAABAAAAQAAAEAQAAAEAAABAAAAQBAAAAQAAAEAAABAEAAABAAAAQAAAEAQAAAEAAABAAAAQBAAAAQAAABAEAAABAAAAQAAAEAQAAAEAAABAAAAQBAAAAQAAAEAAABAEAAABAAAAQAAAEAQAAAEAAATvQfa9tpR8bMd+kAAAAASUVORK5CYII=", sizes:"512x512", type:"image/png", purpose:"any"}
      ]
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:"application/manifest+json"}));
    const link=document.createElement("link");
    link.rel="manifest"; link.href=url;
    document.head.appendChild(link);
  }catch(e){ console.warn("manifest:",e); }
})();

/* ============================ BOOT ============================ */
/* If the page ever fails to start, say so on screen. A silent blank shell
   cost a round of guesswork; this makes the next failure self-reporting. */
function bootFailed(err){
  const el=document.getElementById("list");
  if(!el) return;
  el.innerHTML='<div class="empty"><b>This copy didn\'t load properly</b>'+
    'Something stopped the page starting up, so the list is empty and the tabs won\'t respond. '+
    'The message below says what went wrong.</div>'+
    '<pre class="booterr">'+String(err && err.message || err).replace(/[<&]/g,"")+'</pre>';
}
addEventListener("error",e=>{ if(!document.querySelector("li.entry")) bootFailed(e.message||e.error); });

(async()=>{
 try{
  await load();
  if(!state.fx) INTRO.skip();                  /* Effects off in Settings: no intro */
  $("#sort").value=state.sort; $("#show").value=state.show; $("#series").checked=state.series;
  $("#maxlen").value=String(state.maxlen||0);
  const r=readRoute();
  state.phase=r.phase;
  applyTheme(state.phase||1);
  render(); syncStick(); searchMode(); applyPrefs();
  INTRO.ready();                               /* list is built: the intro may start its flip */
  SYNC.init();                                 /* pull from the Gist if this device syncs */
  /* ask the browser not to clear this site's storage when space runs low.
     Silent on Chrome, Edge and Safari; Firefox asks with a pop-up, so it's skipped there */
  try{ if(navigator.storage && navigator.storage.persist && !/Firefox\//.test(navigator.userAgent))
    navigator.storage.persisted().then(p=>p||navigator.storage.persist()).catch(()=>{}); }catch(e){}
  /* left open overnight: on coming back, dates ("out now", countdowns) move on */
  let shownDay=today();
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden && today()!==shownDay){ shownDay=today(); render(); } });
  INTRO.done.then(decodeTitle);                /* decode once the title is actually visible */
  if(r.title){
    openIds.add(r.title); render();
    setTimeout(()=>focusOn(r.title),120);
  }
  if(r.view!=="list") setView(r.view,{push:false,restore:false});
  try{ history.replaceState({v:state.view,p:state.phase},"",routeHash()); }catch(e){ routing=false; }
  /* only fetch unprompted on a genuinely empty store — otherwise startup
     would retry every permanent miss on every load */
  if(state.tmdb && artCount()===0) fetchMeta(false);
 }catch(err){
  console.warn("boot:",err);
  try{ render(); }catch(e){ bootFailed(err); }
 }
})();
