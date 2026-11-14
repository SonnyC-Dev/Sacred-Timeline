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
/* Built-in TMDB key. It sits in this file’s source, so anyone you share the
   file with can read it — clear it in the Artwork panel before sharing, or
   regenerate it on themoviedb.org if it ever leaks somewhere it shouldn’t. */
/* No key ships in this file, so it is safe to commit and to host publicly.
   Artwork, runtimes and episode counts are all embedded already — a key is
   only needed to fetch newly added titles. Paste one in Settings → Artwork
   when you need it; it is stored in your browser, never in this file.
   After the project split, keep it in src/config.local.js and gitignore that. */
const DEFAULT_TMDB="";

const KEY="mcu-tracker:v1", MKEY="mcu-meta:v2";
const today = ()=> new Date().toISOString().slice(0,10);
let state = {watched:{}, extra:{}, hidden:{}, sort:"release", show:"all", series:true, q:"", phase:0, tmdb:DEFAULT_TMDB, view:"list",
             liveSearch:false, theme:"phase", fx:true, compact:false, maxlen:0, hideFuture:false};
/* Poster paths baked into this file. Images load straight from the public
   image CDN via <img>, which isn’t subject to the cross-origin rules that
   block the API — so this works on devices where fetching doesn’t.
   Fill from an exported backup's "meta" section. */
/* Artwork, runtimes and episode counts. Kept inline rather than in a separate
   data block: some hosts strip non-JS script tags, which silently killed the
   whole page. split.py reads it out via the markers below. */
/*ARTWORK*/

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
     a link is useless anywhere the image host is blocked. */
  for(const id in BUILTIN_ART){
    const b=BUILTIN_ART[id], cur=meta[id]||{};
    const curEmbedded=isLocal(cur.p), builtEmbedded=isLocal(b.p);
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
  clearTimeout(t1); t1=setTimeout(async()=>{
    try{ await store.set(KEY, JSON.stringify({watched:state.watched,extra:state.extra,hidden:state.hidden,sort:state.sort,show:state.show,
      series:state.series,tmdb:state.tmdb,liveSearch:state.liveSearch,
      theme:state.theme,fx:state.fx,compact:state.compact,maxlen:state.maxlen,hideFuture:state.hideFuture})); }
    catch(e){ say("Can't save to this browser. Export a backup to keep your progress."); }
  },300);
}
function saveMeta(){
  clearTimeout(t2); t2=setTimeout(async()=>{ try{ await store.set(MKEY, JSON.stringify(meta)); }catch(e){} },900);
}

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
   fall through to it and come out mangled. */
const isURL = p => /^(https?:|data:|blob:)/.test(p||"");
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
function isLocal(p){ return /^data:/.test(p||""); }
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
  if(hayCache.k!==key) { hayCache[m.id]=haystack(m); }
  const h=hayCache[m.id]||haystack(m);
  return tokens.every(t=>h.includes(t));
}
function visible(){
  const tokens=state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lim=Number(state.maxlen||0);
  return DATA.filter(m=>{
    if(!state.series && m.t!=="film") return false;
    if(state.hidden[m.id]) return false;
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
  const rows=[...document.querySelectorAll("li.entry")];
  rows.forEach((el,i)=>{
    const b=before.get(el.dataset.id);
    const a=el.getBoundingClientRect();
    const delay=Math.min(200, i*10);
    if(!b){
      el.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],
        {duration:700,delay,easing:"cubic-bezier(.22,.8,.3,1)",fill:"backwards"});
      return;
    }
    const dy=b.top-a.top, dx=b.left-a.left;
    if(Math.abs(dy)<2 && Math.abs(dx)<2) return;
    el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"none"}],
      {duration:Math.min(1500, 650+Math.abs(dy)*.75), delay,
       easing:"cubic-bezier(.22,.78,.26,1)", fill:"backwards"});
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
    listEl.innerHTML = `<div class="empty"><b>Nothing matches</b>Clear a filter, or switch on series and specials to widen the field.</div>`;
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

/* Netflix-style: the poster flashes up behind the page, then drifts away */
function flashBackdrop(m){
  if(!fxOn()) return;
  const path=artOf(m);
  if(!path) return;                       /* generated key art doesn’t scale up well */
  const el=$("#backdrop");
  el.classList.remove("flash");
  void el.offsetWidth;                    /* restart the animation cleanly */
  el.style.setProperty("--bd",`url("${IMG_BIG(path)}")`);
  el.classList.add("flash");
}

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
        <input type="url" placeholder="Image URL for this title" value="${/^https?:\/\//.test(path)?path:""}">
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
      <textarea class="note" rows="2" placeholder="Notes about this one…">${(ex.note||"").replace(/</g,"&lt;")}</textarea>` : ""}

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
    render(); renderStats();
  }));

  /* notes, saved as you stop typing */
  const note=li.querySelector(".note");
  if(note){
    let nt;
    note.addEventListener("input",()=>{
      clearTimeout(nt);
      nt=setTimeout(()=>setExtra(m.id,{note:note.value.trim()}),500);
    });
  }
  return li;
}

function observe(){
  if(io) io.disconnect();
  io=new IntersectionObserver(es=>{
    const top=es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(top) applyTheme(Number(top.target.dataset.phase));
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
    $("#nextgo").addEventListener("click",()=>{
      openIds.add(next.id);
      if(state.view!=="list") setView("list"); else render(true);
      setTimeout(()=>focusOn(next.id),40);
    });
  }
  const tb=$("#tonight"); if(tb) tb.addEventListener("click",tonight);
  $("#rand").addEventListener("click",surprise);
}

function renderFilterBar(){
  const bar=$("#filterbar"), bits=[];
  if(state.phase) bits.push([PHASES[state.phase].name,()=>{state.phase=0}]);
  if(state.show!=="all") bits.push([state.show==="seen"?"Watched only":"Not watched only",()=>{state.show="all";$("#show").value="all"}]);
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
    const c=document.createElement("span"); c.className="chip";
    c.innerHTML=`${label} <button aria-label="Remove filter">✕</button>`;
    c.querySelector("button").addEventListener("click",()=>{undo();applyTheme(state.phase||settledPhase);render(true)});
    bar.appendChild(c);
  });
  if(bits.length>1){
    const b=document.createElement("button"); b.className="btn"; b.textContent="Clear all";
    b.addEventListener("click",()=>{state.phase=0;state.show="all";state.q="";state.maxlen=0;$("#show").value="all";$("#q").value="";$("#maxlen").value="0";render(true)});
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
    months.push({k:d.toISOString().slice(0,7), lbl:d.toLocaleDateString("en-GB",{month:"narrow"}), n:0});
  }
  dates.forEach(d=>{ const mth=months.find(x=>x.k===d.slice(0,7)); if(mth) mth.n++; });
  const peak=Math.max(1,...months.map(m=>m.n));

  /* pace over the last 90 days → projection */
  const cut=new Date(Date.now()-90*864e5).toISOString().slice(0,10);
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
  const planDefault=nextRel?nextRel.r:new Date(Date.now()+90*864e5).toISOString().slice(0,10);
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
    toast("Key cleared from this browser. It’s still written into the file’s source — delete the DEFAULT_TMDB line to remove it there.",{ms:8000});
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
  document.documentElement.style.setProperty("--stick", (c.offsetHeight||52)+"px");
}
addEventListener("resize",syncStick);

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
  openIds.add(pick.id);
  if(state.view!=="list") setView("list"); else render(true);
  focusOn(pick.id);
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
  const typing=/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if(e.key==="/"&&!typing){ e.preventDefault(); setView("list"); $("#q").focus(); return; }
  if(e.key==="Escape"){
    if(typing){
      if(document.activeElement===$("#q") && $("#q").value){ $("#q").value=""; state.q=""; markDirty(); render(true); }
      else document.activeElement.blur();
      return;
    }
    if(openIds.size){ openIds.clear(); render(); return; }
    if(state.phase||state.show!=="all"||state.q){ state.phase=0;state.show="all";state.q="";
      $("#show").value="all";$("#q").value=""; render(true); pushRoute(); }
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
    const back=document.createElement("div");
    back.className="modal";
    back.innerHTML=`<div class="modalbox" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);
    const close=v=>{ document.removeEventListener("keydown",esc); back.remove(); res(v); };
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
      from.value=new Date(Date.now()-days*864e5).toISOString().slice(0,10);
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
  const a=new Date(from+"T00:00:00").getTime(), b=new Date(to+"T00:00:00").getTime();
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
  save(); render(); renderStats();
}

/* one place for every watched change, so undo always works */
function setWatched(id,on,quiet){
  const m=BY_ID[id];
  if(!m || m.r>today()) return;
  const prev = state.watched[id] ? {...state.watched[id]} : null;
  if(on){ state.watched[id]=prev&&prev.w ? Object.assign({},prev) : {d:today(),n:1,w:[today()]}; justMarked=id; }
  else delete state.watched[id];
  save(); render(true); renderStats();
  if(!quiet) toast(on?`Marked ${m.ti} watched`:`${m.ti} set back to unwatched`,{
    action:"Undo",
    onAction:()=>{ prev ? state.watched[id]=prev : delete state.watched[id]; save(); render(true); renderStats(); }
  });
}

/* ============================ EASTER EGGS ============================ */
function toast(msg,opts){
  const o = typeof opts==="number" ? {ms:opts} : (opts||{});
  const t=$("#toast");
  t.innerHTML="";
  const s=document.createElement("span"); s.textContent=msg; t.appendChild(s);
  if(o.action){
    const b=document.createElement("button"); b.textContent=o.action;
    b.addEventListener("click",()=>{ t.classList.remove("on"); o.onAction&&o.onAction(); });
    t.appendChild(b);
  }
  t.classList.add("on");
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("on"), o.ms||3400);
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
function snap(half){
  if(ashing) return; ashing=true;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const all=[...document.querySelectorAll("li.entry, .card, .nextup, .group-head")];
  const hit=half ? all.filter(()=>Math.random()<.5) : all;
  if(reduce||!hit.length){ ashing=false; return; }
  flash();
  hit.forEach((el,i)=>{
    el.classList.add("ashing");
    setTimeout(()=>el.classList.add("gone"), 40+i*26);
  });
  dustScale(0,95,1700);
  setTimeout(()=>{
    dustScale(95,0,1100);
    hit.forEach(el=>el.classList.remove("gone"));
    setTimeout(()=>{ hit.forEach(el=>el.classList.remove("ashing")); ashing=false; },1250);
  }, 2700);
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
    const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10);
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
  const cut=new Date(Date.now()-90*864e5).toISOString().slice(0,10);
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
  "snap":          {say:"Perfectly balanced, as all things should be.", run:()=>snap(true)},
  "thanos":        {say:"Perfectly balanced, as all things should be.", run:()=>snap(true)},
  "blip":          {say:"Five years later. Everybody back.",            run:()=>snap(false)},
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
  "ultron":        {say:"There are no strings on me.",                  run:glitchTitles},
  "nexus":         {say:"Found the branch. Switching to chronology.",   run:nexus},
  "3000":          {say:"",                                             run:()=>{
    const n=pool().filter(started).reduce((s,m)=>s+viewCount(m),0);
    toast(`${n} viewings logged. I love you 3000.`,{ms:5000});
  }},
  "jarvis":        {say:"", run:()=>{
    const groups=[
      ["Does something useful", ["all day","binge","tonight","time heist","canon","nexus","assemble","14000605","3000","wakanda","tva"]],
      ["Just for the look of it", ["snap","blip","we have a hulk","i am iron man","bifrost","pym","ultron","puny god","on your left","i am groot","dormammu","worthy"]]
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
  const payload={watched:state.watched, extra:state.extra, meta:slim, prefs, label, exported:today(), v:3};
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
   The manifest is built at run time and handed to the browser as a blob, so
   the whole app stays one file. That covers Add to Home Screen and the
   standalone window; a full offline install prompt on Android also wants a
   service worker, which needs a real hosted URL. */
(function(){
  try{
    const manifest={
      name:"Sacred Timeline", short_name:"MCU",
      description:"Marvel watch tracker",
      start_url:".", scope:".", display:"standalone",
      background_color:"#05060a", theme_color:"#05060a",
      orientation:"any",
      icons:[
        {src:"data:image/png;base64,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", sizes:"192x192", type:"image/png", purpose:"any"},
        {src:"data:image/png;base64,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", sizes:"512x512", type:"image/png", purpose:"any"}
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
  $("#sort").value=state.sort; $("#show").value=state.show; $("#series").checked=state.series;
  $("#maxlen").value=String(state.maxlen||0);
  const r=readRoute();
  state.phase=r.phase;
  applyTheme(state.phase||1);
  render(); syncStick(); searchMode(); applyPrefs(); decodeTitle();
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
