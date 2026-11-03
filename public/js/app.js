// CWG2 Leaderboard front end.
// Loads the map lookups (field names, classes, achievements) and object data (item/unit names, tooltips, icons),
// then runs the save viewer and leaderboard. Loaded as an ES module from index.html.
const [L, O] = await Promise.all([
  fetch("data/lookups.json").then(r => r.json()),
  fetch("data/objects.json").then(r => r.json()),
]);
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const RAD=1048576;
const plain=s=>String(s||"").replace(/\|c[0-9a-fA-F]{8}/g,"").replace(/\|r/g,"").replace(/\|n|\r?\n/g," ").trim();
function wc3(s){let open=0;let h=esc(s||"").replace(/\|c[0-9a-fA-F]{2}([0-9a-fA-F]{6})/g,(m,c)=>{open++;return`<span style="color:#${c}">`}).replace(/\|r/g,()=>{if(open>0){open--;return"</span>"}return""}).replace(/\|n|\r?\n/g,"<br>");return h+"</span>".repeat(Math.max(0,open))}
const item=id=>O.items[id]||null, unit=id=>O.units[id]||null;
const iconSrc=k=>k?O.icons[k]:null;
function img(id,cls="ic",obj){const o=obj||item(id)||unit(id);const src=o&&iconSrc(o.ic);return src?`<img class="${cls}" src="${src}" alt="">`:`<span class="${cls} ph">${esc(id||"")}</span>`}
const itemName=id=>{const o=item(id);return o?plain(o.n):id};
const unitName=id=>{const o=unit(id);return o?plain(o.n):id};
function slotType2(id){const o=item(id);if(!o)return"";const m=o.u.match(/Slot:(?:\|r)?\s*(?:\|c[0-9a-fA-F]{8})?([^|\n\r]+)/);return m?m[1].trim():""}
function firstStat(id){const o=item(id);if(!o)return"";const m=plain(o.u.split(/\|n|\r?\n/).find(l=>/\+[\d,]/.test(l))||"");return m}
function raw(v){if(!v||v<0x30000000)return"";let s="";for(let i=3;i>=0;i--)s+=String.fromCharCode((v>>>(i*8))&255);return /^[A-Za-z][A-Za-z0-9]{3}$/.test(s)?s:""}
const fmt=n=>Number(n).toLocaleString("en-US");
function short(n){const a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(2)+"B";if(a>=1e6)return(n/1e6).toFixed(2)+"M";if(a>=1e4)return(n/1e3).toFixed(1)+"K";return fmt(n)}
const TIER={1:"I",2:"II",3:"III",4:"IV"};
const STATC={Strength:"var(--str)",Agility:"var(--agi)",Intelligence:"var(--int)"};
const REG=/Player\(27\),(\d+),(-?\d+)\)/g;
function kv(text){const m={};for(const x of text.matchAll(REG))m[+x[1]]=+x[2];return m}

function achName(i){
  const R=L.realms;
  if(i>=1&&i<=21)return`${unitName(L.tracked[(i-1)%7])} · Tier ${Math.floor((i-1)/7)+1}`;
  if(i>=22&&i<=39)return`${R[Math.floor((i-22)/3)+1]} · Realm Hunter ${(i-22)%3+1}`;
  if(i===40)return"Getting Started · Defeat an Infected";
  if(i>=41&&i<=170)return`First Victory · ${unitName(L.bossfirst[i])||"?"}`;
  if(L.books[i])return L.books[i];
  return`Achievement ${i}`;
}
function achCat(i){
  if(i<=21)return"Boss tiers";if(i<=39)return"Realm hunter";if(i<=170)return"First victories";
  if(i>=193&&i<=325)return"Book";return"Other";
}
const EXTRA={286:"Deathless streak (An Unbroken March)",287:"Travel destinations visited (bitmask)",314:"Party dungeon tiers cleared (bitmask)",318:"Character earned flags (bitmask)"};
for(let g=316;g<=317;g++)EXTRA[g]=`Hidden gear found #${(g-316)*20+1}–${(g-316)*20+20} (bitmask)`;
function counterLabel(c){
  if(EXTRA[c])return EXTRA[c];
  const b=L.cnt2books[c];
  if(b)return"Progress: "+[...new Set(b)].filter(i=>L.books[i]).map(i=>L.books[i]).join(", ");
  return`Book counter ${c}`;
}
const COUNTERS=[...L.tracked.map(t=>`Boss kills · ${unitName(t)}`),...[1,2,3,4,5,6].map(r=>`Field kills · ${L.realms[r]}`)];

function parseHero(name,text,mtime){
  const t=kv(text);if(t[4000]!==2431702)return null;
  const n=t[4006]||0,b=new Array(n).fill(0);
  for(let i=0;i<n;i++)b[i]=t[4100+i]||0;
  const fam=t[4003],hid=raw(t[4004]);
  const ach=[],counters=[],kills=[],books=[];let cos=null;
  for(let w=0;w<8;w++)for(let bit=0;bit<24;bit++)if((b[469+w]>>bit)&1)ach.push(w*24+bit+1);
  for(let c=0;c<13;c++)if(b[477+c])counters.push([c,b[477+c]]);
  for(const p of b.slice(490)){
    const id=Math.floor(p/RAD),cnt=p%RAD;
    if(id===255){const v=cnt-4096;cos={wing:v%16,aura:Math.floor(v/16)%16,wingOn:!!(cnt&256),auraOn:!!(cnt&512)}}
    else if(id>=256&&id<=262){for(let bit=0;bit<20;bit++)if((cnt>>bit)&1)ach.push(193+(id-256)*20+bit)}
    else if(id>262)books.push([id,cnt]);
    else kills.push([id,L.sparse_raw[id]||"?",cnt]);
  }
  ach.sort((a,c)=>a-c);
  return{name,mtime,hdr:t,b,fam,cls:L.famname[fam]||`Slot ${fam}`,stat:L.ps[fam]||"",hid,tier:L.tier[hid],gen:t[4005],
    exp:b[13],gold:b[14],lum:b[15],str:b[16],agi:b[17],int:b[18],ach,counters,kills,books,cos};
}
function parseSettings(text){
  const t=kv(text),v=[0,1,2,3,4,5,6,7].map(i=>t[9500+i]??0);
  const sum=v[0]+v[1]*3+v[2]*5+v[3]*7+v[4]*11+v[5]*13+v[6]*17;
  return{v,valid:v[0]===553311&&sum===v[7]};
}
function parseEnt(parts){
  let body="";for(const p of [1,2,3,4]){const t=parts[p];if(!t)continue;const m=t.match(/BlzSetAbilityTooltip\(\d+, "([^"]*)"/);if(m)body+=m[1].slice(1)}
  if(!body)return null;
  const [payload,sig]=body.split(".");const f=payload.split("|");
  const m=[+f[5]||0,+f[6]||0,+f[7]||0],owned=[];
  for(let i=1;i<=76;i++){const val=i<=30?m[0]:i<=60?m[1]:m[2];if(Math.floor(val/2**((i-1)%30))%2===1)owned.push(i)}
  return{f,sig:sig||"",owned};
}

let STATE={heroes:[],settings:null,ent:null,source:"",sel:null,tab:"overview"};
function ingest(files,source){
  const heroes=[];let settings=null;const ent={};let skipped=0;
  for(const [name,{text,mtime}] of Object.entries(files)){
    if(/^HERO_\d+_/.test(name)){const h=parseHero(name,text,mtime);h?heroes.push(h):skipped++}
    else if(/^SETTINGS_/.test(name))settings=parseSettings(text);
    else{const m=name.match(/^ENTITLEMENTS_.*_(\d)\.pld$/);if(m)ent[+m[1]]=text}
  }
  if(!heroes.length&&!settings){setStatus(`<span class="err">No CWG2 save files found. Choose the folder named CWG2 inside Documents\\Warcraft III\\CustomMapData.</span>`);return}
  heroes.sort((a,c)=>a.fam-c.fam);
  STATE={...STATE,heroes,settings,ent:parseEnt(ent),source,sel:heroes.find(h=>h.exp===Math.max(...heroes.map(x=>x.exp)))?.fam??null};
  $("#welcome").hidden=true;$("#loaded").hidden=false;$("#topLoader").hidden=false;
  setStatus(`<b>${heroes.length}</b> heroes · ${source}${skipped?` · ${skipped} unreadable file(s) skipped`:""}`);
  render();
}
function setStatus(h){$("#status").innerHTML=h;if($("#loaded").hidden)$("#welcomeMsg").innerHTML=h}

function plate(h){
  const max=Math.max(h.str,h.agi,h.int,1);
  const bar=(v,c)=>`<div class="bar" title="${fmt(v)}"><i style="width:${Math.max(2,v/max*100)}%;background:${c}"></i></div>`;
  return`<button class="plate" style="--stat:${STATC[h.stat]||"var(--line)"}" aria-pressed="${STATE.sel===h.fam}" data-fam="${h.fam}">
    <div class="row"><span class="label">Slot ${h.fam} · ${esc(h.stat)}</span><span class="pill tier">Tier ${TIER[h.tier]||"?"}</span></div>
    <div class="who">${img(h.hid,"ic")}<div><div class="cls">${esc(h.cls)}</div><div class="title">${esc(unitName(h.hid))}</div></div></div>
    <div class="row"><span class="num" title="${fmt(h.exp)} XP">${short(h.exp)} XP</span><span class="num muted" title="Times saved">×${h.gen}</span></div>
    <div class="bars">${bar(h.str,"var(--str)")}${bar(h.agi,"var(--agi)")}${bar(h.int,"var(--int)")}</div>
    <div class="row"><span class="muted" style="font-size:12px">${new Date(h.mtime).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span><span class="pill">${h.ach.length} ach.</span></div>
  </button>`;
}
function renderRoster(){
  const by=$("#sortBy").value,hs=[...STATE.heroes];
  if(by==="exp")hs.sort((a,b)=>b.exp-a.exp);else if(by==="saved")hs.sort((a,b)=>b.mtime-a.mtime);else if(by==="gen")hs.sort((a,b)=>b.gen-a.gen);
  $("#roster").innerHTML=hs.map(plate).join("");
}
function slotsHTML(items){
  return`<div class="slots">${items.map(([id,ch])=>{if(!id)return`<div class="slot empty">empty</div>`;const o=item(id),src=o&&iconSrc(o.ic);return`<button type="button" class="slot filled${src?" has-ic":""}" data-item="${esc(id)}" aria-label="${esc(itemName(id))}">${src?`<img src="${src}" alt="">`:esc(id)}${ch?`<small>${ch}</small>`:""}</button>`}).join("")}</div>`;
}
function equipList(items){
  const f=items.filter(x=>x[0]);if(!f.length)return"";
  return`<div class="equip">${f.map(([id,ch])=>`<button type="button" class="eq" data-item="${esc(id)}">${img(id,"ic")}<div><span class="nm">${esc(itemName(id))}</span><span class="sub">${esc([slotType2(id),firstStat(id)].filter(Boolean).join(" · ")||id)}${ch?` · ${ch} charges`:""}</span></div></button>`).join("")}</div>`;
}
function itemsAt(b,base){const out=[];for(let k=0;k<6;k++){const v=b[base+2*k];out.push([raw(v)||(v?String(v):""),b[base+1+2*k]])}return out}
const GROUPS=[["Attributes",/^(NAVP_|AW_)/],["Abilities",/^Abil_/],["Engravings",/^ENGRAVE_/],["Potential",/^POT_(?!Preset)/],["Relics",/^RELIC_/],["Elements",/^EE_/],["Ability preset 1",/^Preset1_/],["Ability preset 2",/^Preset2_/],["Potential preset 1",/^POT_Preset1_/],["Potential preset 2",/^POT_Preset2_/],["Pets",/^PSS_/],["Party dungeon",/^PDX/],["Other",/./]];
function progressionHTML(h,hideZero,q){
  const g={};for(let i=149;i<469;i++){
    const f=L.fields[i]||`field_${i}`,v=h.b[i]||0;if(hideZero&&!v)continue;if(q&&!f.toLowerCase().includes(q))continue;
    const name=GROUPS.find(([,r])=>r.test(f))[0];(g[name]=g[name]||[]).push([i,f,v]);
  }
  const keys=GROUPS.map(x=>x[0]).filter(k=>g[k]);
  if(!keys.length)return`<p class="muted">No fields match.</p>`;
  return`<div class="groups">${keys.map(k=>`<div class="group"><h3>${k}</h3><div class="tablewrap"><table><tbody>${g[k].map(([i,f,v])=>`<tr><td class="mono muted" style="width:3.5em">${i}</td><td>${esc(f.replace(/_/g," "))}</td><td class="num">${raw(v)||fmt(v)}</td></tr>`).join("")}</tbody></table></div></div>`).join("")}</div>`;
}
function renderDetail(){
  const h=STATE.heroes.find(x=>x.fam===STATE.sel);
  const el=$("#detail");
  if(!h){el.innerHTML=`<div class="pane"><p class="muted">Choose a hero above to see its full save.</p></div>`;return}
  const tabs=[["overview","Overview"],["inventory","Inventory"],["progression","Progression"],["achievements",`Achievements (${h.ach.length})`]];
  let body="";
  if(STATE.tab==="overview"){
    const st=(l,v,c)=>`<div class="stat"><span class="label">${l}</span><span class="v" ${c?`style="color:${c}"`:""} title="${fmt(v)}">${fmt(v)}</span></div>`;
    body=`<div class="stats">${st("Experience",h.exp)}${st("Gold",h.gold)}${st("Lum",h.lum)}${st("Strength",h.str,"var(--str)")}${st("Agility",h.agi,"var(--agi)")}${st("Intelligence",h.int,"var(--int)")}</div>
    <div class="group"><h3>Equipment</h3>${equipList(itemsAt(h.b,1))||`<p class="muted">Nothing equipped.</p>`}</div>
    <div class="two">
      <dl class="kv"><dt>Hero form</dt><dd>${esc(unitName(h.hid))}</dd><dt>Hero rawcode</dt><dd>${esc(h.hid)}</dd><dt>Tier</dt><dd>${TIER[h.tier]||"?"}</dd><dt>Primary stat</dt><dd>${esc(h.stat)}</dd><dt>Times saved</dt><dd>${h.gen}</dd><dt>Saved fields</dt><dd>${h.b.length}</dd></dl>
      <dl class="kv"><dt>Wing</dt><dd>${h.cos&&h.cos.wing?`W${h.cos.wing}${h.cos.wingOn?" (shown)":""}`:"none"}</dd><dt>Aura</dt><dd>${h.cos&&h.cos.aura?`A${h.cos.aura}${h.cos.auraOn?" (shown)":""}`:"none"}</dd><dt>File</dt><dd style="word-break:break-all">${esc(h.name)}</dd><dt>Last saved</dt><dd>${new Date(h.mtime).toLocaleString()}</dd></dl>
    </div>`;
  }else if(STATE.tab==="inventory"){
    const bags=[];for(let k=0;k<10;k++){const base=19+13*k,its=itemsAt(h.b,base+1);if(h.b[base]||its.some(x=>x[0]))bags.push(`<div class="bag"><div class="toolbar"><h3>Bag ${k+1}</h3><span class="pill" title="${esc(raw(h.b[base]))}">${esc(raw(h.b[base])?unitName(raw(h.b[base])):h.b[base]||"")}</span></div>${slotsHTML(its)}</div>`)}
    body=`<div class="group"><h3>Equipped</h3>${slotsHTML(itemsAt(h.b,1))}</div><div class="bags">${bags.join("")||`<p class="muted">No bags saved.</p>`}</div>`;
  }else if(STATE.tab==="progression"){
    body=`<div class="toolbar"><label for="pq"><input type="search" id="pq" placeholder="Filter fields, e.g. RELIC" value="${esc(STATE.pq||"")}"></label><label for="hz"><input type="checkbox" id="hz" ${STATE.hz!==false?"checked":""}> Hide zero values</label></div><div id="prog">${progressionHTML(h,STATE.hz!==false,(STATE.pq||"").toLowerCase())}</div>`;
  }else if(STATE.tab==="achievements"){
    const cats={};h.ach.forEach(i=>{const c=achCat(i);(cats[c]=cats[c]||[]).push(i)});
    const order=["Book","First victories","Boss tiers","Realm hunter","Other"];
    body=`${order.filter(c=>cats[c]).map(c=>`<div class="group"><h3>${c} · ${cats[c].length}</h3><div class="achlist">${cats[c].map(i=>`<div class="ach"><span class="id">${i}</span><span>${esc(achName(i))}</span></div>`).join("")}</div></div>`).join("")||`<p class="muted">No achievements yet.</p>`}
    <div class="two">
      <div class="group"><h3>Kill counters</h3><div class="tablewrap"><table><thead><tr><th>Counter</th><th class="num">Count</th></tr></thead><tbody>${h.counters.map(([c,v])=>`<tr><td>${esc(COUNTERS[c])}</td><td class="num">${fmt(v)}</td></tr>`).join("")||`<tr><td colspan="2" class="muted">None</td></tr>`}</tbody></table></div></div>
      <div class="group"><h3>Book progress</h3><div class="tablewrap"><table><thead><tr><th>Counter</th><th class="num">Value</th></tr></thead><tbody>${h.books.map(([c,v])=>`<tr><td>${esc(counterLabel(c))}</td><td class="num">${fmt(v)}</td></tr>`).join("")||`<tr><td colspan="2" class="muted">None</td></tr>`}</tbody></table></div></div>
    </div>
    <div class="group"><h3>Kills by monster · ${h.kills.length} types</h3><div class="tablewrap" style="max-height:360px"><table><thead><tr><th>ID</th><th>Monster</th><th class="num">Kills</th></tr></thead><tbody>${[...h.kills].sort((a,b)=>b[2]-a[2]).map(([id,r,c])=>`<tr><td class="mono muted">${id}</td><td><span class="mon">${img(r,"ic sm")}<span>${esc(unitName(r))}</span></span></td><td class="num">${fmt(c)}${c>=1000?' <span class="pill">max</span>':""}</td></tr>`).join("")||`<tr><td colspan="3" class="muted">None</td></tr>`}</tbody></table></div></div>`;
  }
  el.innerHTML=`<div class="dhead"><div style="display:flex;gap:16px;align-items:center;min-width:0">${img(h.hid,"ic lg")}<div style="display:grid;gap:4px;min-width:0"><span class="label">Slot ${h.fam} · ${esc(h.stat)} · ${esc(h.hid)}</span><h2 style="font-size:28px">${esc(h.cls)} <span class="pill tier" style="vertical-align:middle">Tier ${TIER[h.tier]||"?"}</span></h2><span class="muted">${esc(unitName(h.hid))}</span></div></div><span class="muted num">${fmt(h.exp)} XP</span></div>
  <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button class="tab" role="tab" aria-selected="${STATE.tab===k}" data-tab="${k}">${l}</button>`).join("")}</div>
  <div class="pane">${body}</div>`;
}
function renderAccount(){
  const s=STATE.settings,e=STATE.ent,AUTO=["Off","Every 2 hours","Every 60 min","Every 15 min"],DT=["All off","Allies off (own only)","All on"];
  const onoff=v=>v?`<span class="ok">On</span>`:`<span class="muted">Off</span>`;
  const sHTML=s?`<div class="group"><h3>Settings</h3>
    <dl class="kv"><dt>Autosave</dt><dd>${AUTO[s.v[2]]??s.v[2]}</dd><dt>Block item drops</dt><dd>${onoff(s.v[1])}</dd><dt>Damage text</dt><dd>${s.v[3]?"Hidden":"Visible"}</dd><dt>Potion messages</dt><dd>${onoff(s.v[4])}</dd><dt>Auto potion</dt><dd>${onoff(s.v[5])}</dd><dt>Damage tracker</dt><dd>${DT[s.v[6]]??s.v[6]}</dd></dl></div>`:`<div class="group"><h3>Settings</h3><p class="muted">No SETTINGS file loaded.</p></div>`;
  const eHTML=e?`<div class="group"><h3>Supporter unlocks</h3>
    ${e.owned.length?`<div class="achlist">${e.owned.map(i=>`<div class="ach"><span class="id">${i}</span><span>${esc(L.entname[i]||"Flag "+i)}</span></div>`).join("")}</div>`:`<p class="muted">No unlocks.</p>`}
    <dl class="kv"><dt>Fame tier</dt><dd>${esc(e.f[8])}</dd><dt>Fame aura</dt><dd>${esc(e.f[9])} bp</dd></dl></div>`:`<div class="group"><h3>Supporter unlocks</h3><p class="muted">No ENTITLEMENTS files loaded.</p></div>`;
  $("#account").innerHTML=sHTML+eHTML;
}
function render(){renderRoster();renderDetail();renderAccount()}

$("#roster").addEventListener("click",e=>{const p=e.target.closest(".plate");if(!p)return;STATE.sel=+p.dataset.fam;renderRoster();renderDetail()});
$("#detail").addEventListener("click",e=>{const t=e.target.closest(".tab");if(!t)return;STATE.tab=t.dataset.tab;renderDetail()});
$("#detail").addEventListener("input",e=>{
  const h=STATE.heroes.find(x=>x.fam===STATE.sel);
  if(e.target.id==="pq"){STATE.pq=e.target.value}else if(e.target.id==="hz"){STATE.hz=e.target.checked}else return;
  $("#prog").innerHTML=progressionHTML(h,STATE.hz!==false,(STATE.pq||"").toLowerCase());
});
$("#sortBy").addEventListener("change",renderRoster);
let RAWFILES=null,MYHASH=null;
const STATCOL={primary:"primary_value",str:"strength",agi:"agility",int:"intelligence",exp:"exp",gold:"gold"};
const LB={stat:"primary"};
async function api(path,opts){const r=await fetch(path,opts);let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||`Server answered ${r.status}`);return j}
async function loadBoard(){
  const stat=LB.stat,key=STATCOL[stat];
  $("#lbBody").innerHTML=`<tr><td class="empty">Loading…</td></tr>`;
  let d;try{d=await api(`/api/leaderboard?stat=${stat}`)}catch(e){$("#lbHead").innerHTML="";$("#lbBody").innerHTML=`<tr><td class="empty err">Couldn't reach the leaderboard server: ${esc(e.message)}. Open this page from the server address, for example http://localhost:8080.</td></tr>`;return}
  const label=$("#lbStat").selectedOptions[0].text;
  $("#lbSub").textContent=stat==="primary"?"Each player's character with the highest main stat, highest first.":`Each player's character with the most ${label}, highest first.`;
  const cols=[["strength","Strength"],["agility","Agility"],["intelligence","Intelligence"]];
  const SC={Strength:"strength",Agility:"agility",Intelligence:"intelligence"};
  $("#lbHead").innerHTML=`<tr><th class="rank">#</th><th>Player</th><th>Character</th><th class="num sorted">${stat==="primary"?"Highest stat":esc(label)}</th>${cols.filter(([c])=>c!==key).map(([c,l])=>`<th class="num">${l}</th>`).join("")}<th>Updated</th></tr>`;
  if(!d.rows.length){$("#lbBody").innerHTML=`<tr><td class="empty" colspan="8">No characters yet. Load your CWG2 folder in My saves and choose Submit to leaderboard.</td></tr>`;return}
  $("#lbBody").innerHTML=d.rows.map((r,i)=>{
    const top=stat==="primary"?r.primary_value:r[key];
    const topLabel=stat==="primary"?`<span class="muted" style="font-size:12px;font-family:var(--f-body)">${esc(r.primary_stat)}</span>`:"";
    return`<tr class="r${i+1} ${r.user_hash===MYHASH?"me":""}"><td class="rank">${i+1}</td>
    <td><div style="display:grid"><b>${esc(r.player)}</b><span class="muted" style="font-size:12px">${r.hero_count} character${r.hero_count===1?"":"s"}</span></div></td>
    <td><div class="hero">${img(r.hero_id,"ic sm")}<div><span>${esc(r.class_name)}</span><span class="muted" style="font-size:12px">${esc(unitName(r.hero_id))} · Tier ${TIER[r.tier]||"?"}</span></div></div></td>
    <td class="num sorted" title="${fmt(top)}"><div style="display:grid;justify-items:end">${fmt(top)}${topLabel}</div></td>
    ${cols.filter(([c])=>c!==key).map(([c])=>`<td class="num" title="${fmt(r[c])}">${short(r[c])}</td>`).join("")}
    <td class="muted" style="white-space:nowrap">${new Date(r.uploaded_at).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})}</td></tr>`}).join("");
}
$("#lbStat").addEventListener("change",e=>{LB.stat=e.target.value;loadBoard()});
$("#btnSubmit").addEventListener("click",async()=>{
  if(!RAWFILES)return;const b=$("#btnSubmit"),m=$("#submitMsg");b.disabled=true;m.className="msg muted";m.textContent="Submitting…";
  const files={};for(const [k,v] of Object.entries(RAWFILES))if(/^(HERO_|ACCOUNT_|ENTITLEMENTS_|LEGACY_|SETTINGS_)/i.test(k))files[k]=v;
  try{const r=await api("/api/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({files})});
    MYHASH=r.user_hash;
    m.className="msg ok";m.textContent=`Submitted ${r.heroes} hero${r.heroes===1?"":"es"} as ${r.player}.${r.replaced.length?` Replaced your earlier ${r.replaced.length===1?"entry":"entries"}.`:""}${r.kept_newer.length?` Kept newer saves already on the board for ${r.kept_newer.join(", ")}.`:""}`;
  }catch(e){m.className="msg err";m.textContent=e.message}finally{b.disabled=false}
});
function route(){
  const board=location.hash==="#leaderboard";
  $("#viewSaves").hidden=board;$("#viewBoard").hidden=!board;
  $("#navSaves").setAttribute("aria-current",board?"false":"page");$("#navBoard").setAttribute("aria-current",board?"page":"false");
  if(board)loadBoard();
}
addEventListener("hashchange",route);route();
$("#btnFolder").onclick=()=>$("#pickFolder").click();
$("#btnFiles").onclick=()=>$("#pickFiles").click();
$("#btnFolder2").onclick=()=>$("#pickFolder").click();
$("#btnFiles2").onclick=()=>$("#pickFiles").click();
async function readList(list,source){
  const files={};
  for(const f of list){if(!/\.pld$/i.test(f.name))continue;files[f.name]={text:await f.text(),mtime:f.lastModified}}
  RAWFILES=files;$("#submitMsg").textContent="Uploading again replaces your previous entry.";
  ingest(files,source);
}
$("#pickFolder").onchange=e=>readList([...e.target.files],"loaded from your folder");
$("#pickFiles").onchange=e=>readList([...e.target.files],"loaded from selected files");
document.addEventListener("dragover",e=>e.preventDefault());
document.addEventListener("drop",e=>e.preventDefault());
async function onDrop(e){
  const out=[];const items=[...e.dataTransfer.items].map(i=>i.webkitGetAsEntry&&i.webkitGetAsEntry()).filter(Boolean);
  async function walk(en){if(en.isFile){out.push(await new Promise((r,j)=>en.file(r,j)))}else if(en.isDirectory){const rd=en.createReader();let batch;do{batch=await new Promise((r,j)=>rd.readEntries(r,j));for(const c of batch)await walk(c)}while(batch.length)}}
  if(items.length){for(const en of items)await walk(en)}else out.push(...e.dataTransfer.files);
  readList(out,"loaded from dropped files");
}
for(const zone of [$("#drop"),$("#welcome")]){
  ["dragenter","dragover"].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.add("over")}));
  ["dragleave","drop"].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.remove("over")}));
  zone.addEventListener("drop",onDrop);
}
// item tooltips
const tip=$("#tip");let pinned=null;
function showTip(el){const id=el.dataset.item,o=item(id);
  tip.innerHTML=o?`<div class="tn">${o.ic?`<img src="${iconSrc(o.ic)}" alt="">`:""}<span>${wc3(o.n)}</span></div><div>${wc3(o.u)}</div><div class="code">${esc(id)}</div>`:`<div class="tn">${esc(id)}</div><div class="code">Not found in the map data.</div>`;
  tip.hidden=false;const r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  let x=Math.min(Math.max(16,r.left),innerWidth-tw-16),y=r.bottom+8;if(y+th>innerHeight-8)y=Math.max(8,r.top-th-8);
  tip.style.left=x+"px";tip.style.top=y+"px"}
function hideTip(){if(!pinned)tip.hidden=true}
document.addEventListener("mouseover",e=>{const el=e.target.closest("[data-item]");if(el&&!pinned)showTip(el)});
document.addEventListener("mouseout",e=>{const el=e.target.closest("[data-item]");if(el&&!el.contains(e.relatedTarget))hideTip()});
document.addEventListener("focusin",e=>{const el=e.target.closest("[data-item]");if(el)showTip(el)});
document.addEventListener("focusout",e=>{if(e.target.closest("[data-item]"))hideTip()});
document.addEventListener("click",e=>{const el=e.target.closest("[data-item]");if(el){pinned=pinned===el?null:el;pinned?showTip(el):(tip.hidden=true)}else if(pinned){pinned=null;tip.hidden=true}});
addEventListener("scroll",()=>{if(!tip.hidden&&!pinned)tip.hidden=true},{passive:true});

