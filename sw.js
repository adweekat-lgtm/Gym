/* Ghool — offline cache */
const V="ghool-v20";
const WC="ghoolw-1"; // women's photos and videos: survives updates, refreshed file by file (img/exf/list.json)
const CORE=["sounds/cheer1.m4a","sounds/cheer2.m4a","sounds/cheer3.m4a","./", "index.html", "privacy.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];
const IMGS=["img/ex/arm_circles-0.jpg", "img/ex/arm_circles-1.jpg", "img/ex/bench-0.jpg", "img/ex/bench-1.jpg", "img/ex/bike-0.jpg", "img/ex/bike-1.jpg", "img/ex/box-0.jpg", "img/ex/box-1.jpg", "img/ex/burpee-0.jpg", "img/ex/burpee-1.jpg", "img/ex/bw_squat-0.jpg", "img/ex/bw_squat-1.jpg", "img/ex/cable_fly-0.jpg", "img/ex/cable_fly-1.jpg", "img/ex/cable_lateral-0.jpg", "img/ex/cable_lateral-1.jpg", "img/ex/calf-0.jpg", "img/ex/calf-1.jpg", "img/ex/crunch-0.jpg", "img/ex/crunch-1.jpg", "img/ex/cs_row-0.jpg", "img/ex/cs_row-1.jpg", "img/ex/db_curl-0.jpg", "img/ex/db_curl-1.jpg", "img/ex/db_lateral-0.jpg", "img/ex/db_lateral-1.jpg", "img/ex/db_shoulder-0.jpg", "img/ex/db_shoulder-1.jpg", "img/ex/face_pull-0.jpg", "img/ex/face_pull-1.jpg", "img/ex/goblet-0.jpg", "img/ex/goblet-1.jpg", "img/ex/hammer_curl-0.jpg", "img/ex/hammer_curl-1.jpg", "img/ex/hip_hinge-0.jpg", "img/ex/hip_hinge-1.jpg", "img/ex/hip_thrust-0.jpg", "img/ex/hip_thrust-1.jpg", "img/ex/incline_db-0.jpg", "img/ex/incline_db-1.jpg", "img/ex/incline_machine-0.jpg", "img/ex/incline_machine-1.jpg", "img/ex/jrope-0.jpg", "img/ex/jrope-1.jpg", "img/ex/jsquat-0.jpg", "img/ex/jsquat-1.jpg", "img/ex/kb-0.jpg", "img/ex/kb-1.jpg", "img/ex/lat_pulldown-0.jpg", "img/ex/lat_pulldown-1.jpg", "img/ex/leg_curl-0.jpg", "img/ex/leg_curl-1.jpg", "img/ex/leg_ext-0.jpg", "img/ex/leg_ext-1.jpg", "img/ex/leg_press-0.jpg", "img/ex/leg_press-1.jpg", "img/ex/lunges-0.jpg", "img/ex/lunges-1.jpg", "img/ex/machine_chest-0.jpg", "img/ex/machine_chest-1.jpg", "img/ex/mc_rower-0.jpg", "img/ex/mc_rower-1.jpg", "img/ex/mclimb-0.jpg", "img/ex/mclimb-1.jpg", "img/ex/one_arm_row-0.jpg", "img/ex/one_arm_row-1.jpg", "img/ex/overhead_ext-0.jpg", "img/ex/overhead_ext-1.jpg", "img/ex/pec_deck-0.jpg", "img/ex/pec_deck-1.jpg", "img/ex/plank-0.jpg", "img/ex/plank-1.jpg", "img/ex/pushdown-0.jpg", "img/ex/pushdown-1.jpg", "img/ex/pushup-0.jpg", "img/ex/pushup-1.jpg", "img/ex/rdl-0.jpg", "img/ex/rdl-1.jpg", "img/ex/rlunge-0.jpg", "img/ex/rlunge-1.jpg", "img/ex/ropes-0.jpg", "img/ex/ropes-1.jpg", "img/ex/rower-0.jpg", "img/ex/rower-1.jpg", "img/ex/seated_row-0.jpg", "img/ex/seated_row-1.jpg", "img/ex/slam-0.jpg", "img/ex/slam-1.jpg", "img/ex/thruster-0.jpg", "img/ex/thruster-1.jpg", "img/ex/treadmill-0.jpg", "img/ex/treadmill-1.jpg", "img/ex/w_abduct-0.jpg", "img/ex/w_abduct-1.jpg", "img/ex/w_adduct-0.jpg", "img/ex/w_adduct-1.jpg", "img/ex/w_airbike-0.jpg", "img/ex/w_airbike-1.jpg", "img/ex/w_benchdip-0.jpg", "img/ex/w_benchdip-1.jpg", "img/ex/w_breath-0.jpg", "img/ex/w_breath-1.jpg", "img/ex/w_bridge-0.jpg", "img/ex/w_bridge-1.jpg", "img/ex/w_cablekick-0.jpg", "img/ex/w_cablekick-1.jpg", "img/ex/w_catcow-0.jpg", "img/ex/w_catcow-1.jpg", "img/ex/w_deadbug-0.jpg", "img/ex/w_deadbug-1.jpg", "img/ex/w_flutter-0.jpg", "img/ex/w_flutter-1.jpg", "img/ex/w_flyes-0.jpg", "img/ex/w_flyes-1.jpg", "img/ex/w_inpush-0.jpg", "img/ex/w_inpush-1.jpg", "img/ex/w_kickback-0.jpg", "img/ex/w_kickback-1.jpg", "img/ex/w_legraise-0.jpg", "img/ex/w_legraise-1.jpg", "img/ex/w_plie-0.jpg", "img/ex/w_plie-1.jpg", "img/ex/w_ptilt-0.jpg", "img/ex/w_ptilt-1.jpg", "img/ex/w_pullover-0.jpg", "img/ex/w_pullover-1.jpg", "img/ex/w_russian-0.jpg", "img/ex/w_russian-1.jpg", "img/ex/w_sidebridge-0.jpg", "img/ex/w_sidebridge-1.jpg", "img/ex/w_sidelift-0.jpg", "img/ex/w_sidelift-1.jpg", "img/ex/w_slbridge-0.jpg", "img/ex/w_slbridge-1.jpg", "img/ex/w_stepup-0.jpg", "img/ex/w_stepup-1.jpg", "img/ex/w_tkick-0.jpg", "img/ex/w_tkick-1.jpg", "img/ex/wallball-0.jpg", "img/ex/wallball-1.jpg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE).then(()=>c.addAll(IMGS).catch(()=>{}))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>(/^(ghool|dweekat)-/.test(k)&&k!==V)||(/^ghoolm-/.test(k)&&k!==MC)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.pathname.includes("/kora-smart/"))return; // a separate app with its own worker
  if(u.origin===location.origin&&u.pathname.startsWith(WBASE.pathname)){e.respondWith(womenMedia(r,u));return}
  if(/\.(mp4|webm)$/i.test(u.pathname))return; // let the browser stream video itself (range requests; iOS needs them)
  if(r.mode==="navigate"){ // network first for the page, so updates arrive; fall back offline
    const key=u.pathname.endsWith("/privacy.html")?"privacy.html":"index.html"; // keep each page under its own name, and never keep an error page
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(key,cp))}return res}).catch(()=>caches.match(key)));return}
  if(u.origin===location.origin||u.hostname.endsWith("gstatic.com")||u.hostname.endsWith("googleapis.com")){
    e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok||res.type==="opaque"){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res})))}
});

/* ---------- women's media, offline ----------
   The page asks for it only when the profile is female. Every file is checked against the
   fingerprint in list.json before it is kept, so a cut-off or outdated download is never stored. */
const WBASE=new URL("img/exf/",self.location.href);
const wUrl=f=>new URL(f,WBASE).href;
async function womenMedia(r,u){
  const hit=await caches.open(WC).then(c=>c.match(u.origin+u.pathname,{ignoreVary:true})).catch(()=>null);
  if(!hit)return fetch(r);
  return /\.mp4$/i.test(u.pathname)?ranged(r,hit):hit}
async function ranged(r,hit){ // players (iOS above all) ask for byte ranges
  const b=await hit.arrayBuffer(),n=b.byteLength,h={"Content-Type":"video/mp4","Accept-Ranges":"bytes"},m=/^bytes=(\d*)-(\d*)$/.exec(r.headers.get("range")||"");
  if(!m||(m[1]===""&&m[2]===""))return new Response(b,{status:200,headers:{...h,"Content-Length":String(n)}});
  const s=m[1]===""?Math.max(0,n-Number(m[2])):Number(m[1]),e=m[1]===""||m[2]===""?n-1:Math.min(Number(m[2]),n-1);
  if(s>=n||s>e)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${n}`}});
  return new Response(b.slice(s,e+1),{status:206,headers:{...h,"Content-Range":`bytes ${s}-${e}/${n}`,"Content-Length":String(e-s+1)}})}
async function tellPages(m){for(const c of await self.clients.matchAll({includeUncontrolled:true}))c.postMessage(Object.assign({t:"women"},m))}
async function sha12(b){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",b))].slice(0,6).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function syncWomen(lite){
  const c=await caches.open(WC),rec=wUrl(".have");let have={},list=null;
  try{const h=await c.match(rec);if(h)have=await h.json()}catch(e){}
  try{const r=await fetch(wUrl("list.json"),{cache:"no-store"});if(r.ok)list=await r.json()}catch(e){}
  if(!list){const n=Object.keys(have).length;return n?tellPages({done:n,total:n,busy:false,offline:true}):undefined}
  const save=()=>c.put(rec,new Response(JSON.stringify(have),{headers:{"Content-Type":"application/json"}}));
  const there=new Set((await c.keys()).map(k=>k.url));
  for(const f of Object.keys(have))if(!list[f]||!there.has(wUrl(f))){if(!list[f])await c.delete(wUrl(f));delete have[f]}
  const isV=f=>/\.mp4$/i.test(f),want=Object.keys(list).filter(f=>!lite||!isV(f)).sort((a,b)=>isV(a)-isV(b)); // photos first
  const todo=want.filter(f=>have[f]!==list[f]);let fails=0,since=0;
  const state=busy=>({done:want.filter(f=>have[f]===list[f]).length,total:want.length,busy});
  await tellPages(state(todo.length>0));
  const worker=async()=>{while(todo.length&&fails<6){const f=todo.shift();
    try{const r=await fetch(wUrl(f),{cache:"no-cache"});if(r.status!==200)throw 0;const b=await r.arrayBuffer();if(await sha12(b)!==list[f])throw 0;
      await c.put(wUrl(f),new Response(b,{headers:{"Content-Type":r.headers.get("Content-Type")||(isV(f)?"video/mp4":"image/jpeg"),"Content-Length":String(b.byteLength)}}));
      have[f]=list[f];if(++since>=8){since=0;await save();await tellPages(state(true))}
    }catch(e){fails++}}};
  await Promise.all([worker(),worker(),worker(),worker()]);
  await save();await tellPages(state(false))}
let wRun=null;
self.addEventListener("message",e=>{if(e.data&&e.data.t==="women"){wRun=wRun||syncWomen(!!e.data.lite).catch(()=>{}).then(()=>{wRun=null});e.waitUntil(wRun)}});

/* ---------- men's extra exercise photos, offline ----------
   Fetched once for male profiles and kept across updates. New files: add them to MX. Changed files: raise MC. */
const MC="ghoolm-2",MBASE=new URL("img/ex/",self.location.href);
const MX=["elliptical-0.jpg","elliptical-1.jpg","recumbent-0.jpg","recumbent-1.jpg","run-0.jpg","run-1.jpg","stairs-0.jpg","stairs-1.jpg","ab_machine-0.jpg","ab_machine-1.jpg","ab_roller-0.jpg","ab_roller-1.jpg","arnold-0.jpg","arnold-1.jpg","back_ext-0.jpg","back_ext-1.jpg","bar_pushdown-0.jpg","bar_pushdown-1.jpg","bb_bridge-0.jpg","bb_bridge-1.jpg","bb_row-0.jpg","bb_row-1.jpg","bb_squat-0.jpg","bb_squat-1.jpg","bent_db_row-0.jpg","bent_db_row-1.jpg","cable_cross-0.jpg","cable_cross-1.jpg","cable_curl-0.jpg","cable_curl-1.jpg","cable_press-0.jpg","cable_press-1.jpg","close_pulldown-0.jpg","close_pulldown-1.jpg","concentration-0.jpg","concentration-1.jpg","db_bench-0.jpg","db_bench-1.jpg","db_overhead-0.jpg","db_overhead-1.jpg","deadlift-0.jpg","deadlift-1.jpg","decline_bb-0.jpg","decline_bb-1.jpg","dip_machine-0.jpg","dip_machine-1.jpg","ez_curl-0.jpg","ez_curl-1.jpg","hack-0.jpg","hack-1.jpg","incline_bb-0.jpg","incline_bb-1.jpg","incline_curl-0.jpg","incline_curl-1.jpg","incline_smith-0.jpg","incline_smith-1.jpg","iso_row-0.jpg","iso_row-1.jpg","knee_raise-0.jpg","knee_raise-1.jpg","machine_shoulder-0.jpg","machine_shoulder-1.jpg","narrow_press-0.jpg","narrow_press-1.jpg","one_cable_row-0.jpg","one_cable_row-1.jpg","one_leg_ext-0.jpg","one_leg_ext-1.jpg","preacher_m-0.jpg","preacher_m-1.jpg","press_calf-0.jpg","press_calf-1.jpg","pull_through-0.jpg","pull_through-1.jpg","pullup-0.jpg","pullup-1.jpg","rear_cable-0.jpg","rear_cable-1.jpg","rear_db-0.jpg","rear_db-1.jpg","rev_pec-0.jpg","rev_pec-1.jpg","rope_hammer-0.jpg","rope_hammer-1.jpg","seated_calf-0.jpg","seated_calf-1.jpg","seated_lateral-0.jpg","seated_lateral-1.jpg","seated_leg_curl-0.jpg","seated_leg_curl-1.jpg","skull-0.jpg","skull-1.jpg","smith_bench-0.jpg","smith_bench-1.jpg","smith_calf-0.jpg","smith_calf-1.jpg","smith_shoulder-0.jpg","smith_shoulder-1.jpg","smith_squat-0.jpg","smith_squat-1.jpg","split_squat-0.jpg","split_squat-1.jpg","stand_leg_curl-0.jpg","stand_leg_curl-1.jpg","stiff_bb-0.jpg","stiff_bb-1.jpg","straight_arm-0.jpg","straight_arm-1.jpg","tbar-0.jpg","tbar-1.jpg","under_pulldown-0.jpg","under_pulldown-1.jpg","upright_row-0.jpg","upright_row-1.jpg"];
async function syncMen(){const c=await caches.open(MC),have=new Set((await c.keys()).map(k=>k.url)),todo=MX.map(f=>new URL(f,MBASE).href).filter(u=>!have.has(u));let fails=0;
  const worker=async()=>{while(todo.length&&fails<6){const u=todo.shift();try{const r=await fetch(u);if(r.status!==200)throw 0;await c.put(u,r)}catch(e){fails++}}};
  await Promise.all([worker(),worker(),worker(),worker()])}
let mRun=null;
self.addEventListener("message",e=>{if(e.data&&e.data.t==="men"){mRun=mRun||syncMen().catch(()=>{}).then(()=>{mRun=null});e.waitUntil(mRun)}});
