/* The Teacher's Phrasebook — the reading app (units, topics, search, saved phrases, guide).
   Content comes from js/content.js. The user's data (saved phrases, opened topics, read intros, preferences) lives on the
   server; js/account.js signs the user in, then calls PBApp.start(user, state) and saves changes through PBSync. */
/* ---------- index ---------- */
const NODES = {}, LEAVES = [];
(function idx(n, parent){
  NODES[n.id] = n; n.parent = parent || null;
  if (n.children) n.children = n.children.map(c => {
    if (typeof c === "string") { const l = idx({id:c, title:R[c].title, leaf:true}, n); LEAVES.push(l); return l; }
    return idx(c, n);
  });
  return n;
})(TREE);
const UNITS = TREE.children;
UNITS.forEach((u, i) => u.color = `var(--u${i+1})`);
const unitOf = n => { while (n && n.parent && n.parent.id !== "root") n = n.parent; return n; };

const NT_ID = {
  L:["Komentar bahasa","Frasa tambahan dan komentar tentang bahasa kelas."],
  I:["Frasa idiomatis","Idiom, terutama untuk pembelajar tingkat lanjut."],
  P:["Tips mengajar","Arahan pedagogis: pengelolaan kelas dan ide menjalankan kelas dalam bahasa Inggris."],
  M:["Kesalahan umum","Kesalahan bahasa kelas yang sering terjadi, beserta versi yang benar."],
  S:["Respons siswa","Frasa yang bisa Anda ajarkan untuk dipakai siswa."],
  X:["Lihat juga","Rujukan ke unit dan bagian lain."]
};
const ntName = t => isID() ? NT_ID[t][0] : NT[t].name;
const ntDesc = t => isID() ? NT_ID[t][1] : NT[t].desc;
const NT = {
  L:{name:"Language comment", ic:"L", desc:"Additional phrases and comments on classroom language."},
  I:{name:"Idiomatic phrase", ic:"!", desc:"Idioms for use mainly with advanced learners."},
  P:{name:"Teaching tip", ic:"→", desc:"Pedagogical pointers: classroom management and ideas for running your class in English."},
  M:{name:"Mistake", ic:"✗", desc:"A typical classroom English error, shown with the correct version."},
  S:{name:"Student response", ic:"S", desc:"Phrases you can encourage your students to use."},
  X:{name:"See also", ic:"»", desc:"Cross-references to other units and sections."}
};

/* ---------- user data (account.js loads it from the server and saves every change) ---------- */
let level = "sk", lang = null, prefs = {}, stars = [], visited = {}, secRead = {};
let viewer = {name: ""}, started = false;
function starOf(k){
  const p = String(k).split("|"), rid = p[0];
  if (!R[rid] || p.length !== 3) return null;
  const g = book(rid).groups[+p[1]], t = g && g[+p[2]];
  return t ? {k: String(k), rid, t} : null;
}
function stateOut(){
  const pr = Object.assign({}, prefs, {level});
  if (lang) pr.lang = lang; else delete pr.lang;
  return {saved: stars.map(s => s.k), visited: Object.assign({}, visited), secRead: Object.assign({}, secRead), prefs: pr};
}
function changed(){ if (window.PBSync) window.PBSync.changed(); }
function markVisit(id){ visited[id] = Date.now(); changed(); }
function applyState(user, st){
  st = st || {};
  viewer = {name: String((user && (user.display_name || user.username)) || "")};
  prefs = Object.assign({}, st.prefs || {});
  level = LEVELS.some(l => l.id === prefs.level) ? prefs.level : "sk";
  lang = prefs.lang === "en" || prefs.lang === "id" ? prefs.lang : null;
  stars = (Array.isArray(st.saved) ? st.saved : []).map(starOf).filter(Boolean);
  visited = Object.assign({}, st.visited || {});
  secRead = Object.assign({}, st.secRead || {});
}
const isID = () => lang === "id";
const tr = (en, id) => isID() ? id : en;
const tt = n => (isID() && TID[n.id]) || n.title;
const eyeb = e => isID() ? (EYEB_ID[e] || e.replace("Section", "Bagian")) : e;
const bi = n => esc(n.title) + (isID() && TID[n.id] && TID[n.id] !== n.title ? `<span class="tid">${esc(TID[n.id])}</span>` : "");
const lvName = l => isID() ? LEVEL_ID[l.id][0] : l.name;
const lvAge = l => isID() ? LEVEL_ID[l.id][1] : l.age;
const plural = (n, en1, enN, id) => isID() ? `${n} ${id}` : `${n} ${n === 1 ? en1 : enN}`;
function bookL(id){
  const b = book(id), t = isID() && IDC.book[id];
  if (!t) return b;
  return {groups: b.groups, notes: b.notes.map((n, i) => t[i] ? [n[0], n[1], t[i], n[3]] : n)};
}

/* ---------- helpers ---------- */
const app = document.getElementById("app");
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function fmt(s){ return esc(s).replace(/\(([^)]+)\)/g, '<em class="act">($1)</em>'); }
function clean(t){ return t.replace(/\([^)]*\)/g, "").replace(/…/g, ", ").replace(/\s\/\s|\//g, " or ").trim(); }
const I = {
  speak:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 010 5M12.8 3.6a6 6 0 010 8.8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  save:'<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h10v15l-5-3.5-5 3.5z" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity="var(--fo,0)" stroke-linejoin="round"/></svg>',
  chev:'<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 7l4.5 4.5L13.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back:'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow:'<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const lv = id => LEVELS.find(l => l.id === id);
const lvVars = l => `--lc:var(--${l.id})`;
const ntVar = t => `--nc:var(--n${t})`;
/* text-to-speech: pick an English voice, avoid Chrome's cancel-then-speak silence, keep utterances alive */
let ttsVoice = null, ttsQueue = [], ttsTimer = null;
function pickVoice(){
  try {
    const vs = speechSynthesis.getVoices() || [];
    ttsVoice = vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  } catch(e){}
}
try { if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener ? speechSynthesis.addEventListener("voiceschanged", pickVoice) : (speechSynthesis.onvoiceschanged = pickVoice); } } catch(e){}
function speak(text, who){
  try {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { toast(tr("This browser can't read text aloud.", "Browser ini tidak bisa membacakan teks.")); return; }
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    speechSynthesis.cancel();
    clearTimeout(ttsTimer);
    const run = () => {
      try { speechSynthesis.resume(); } catch(e){}
      if (!ttsVoice) pickVoice();
      ttsQueue = [];
      (Array.isArray(text) ? text : [[who || "T", text]]).forEach(([w, t]) => {
        const c = clean(t); if (!c) return;
        const u = new SpeechSynthesisUtterance(c);
        u.lang = ttsVoice ? ttsVoice.lang : "en-GB"; if (ttsVoice) u.voice = ttsVoice;
        u.rate = .92; u.pitch = w === "S" ? 1.25 : 1;
        u.onerror = ev => { if (ev && ev.error && ev.error !== "interrupted" && ev.error !== "canceled") toast(tr("Couldn't play the audio. Check that your device volume is on and an English voice is installed.", "Audio tidak bisa diputar. Pastikan volume perangkat menyala dan suara bahasa Inggris tersedia.")); };
        ttsQueue.push(u);
        speechSynthesis.speak(u);
      });
    };
    if (busy) ttsTimer = setTimeout(run, 80); else run();
  } catch(e){}
}
function toast(msg){
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 4000);
}
function book(id){
  if (BOOK[id]) return BOOK[id];
  const r = R[id], notes = [];
  if (r.tip) notes.push([0, "P", r.tip, []]);
  (r.mistakes || []).forEach(m => notes.push([0, "M", m.why, ["x:" + m.w, "v:" + m.r]]));
  return {groups: r.phrases.map(p => [p]), notes};
}
const phraseCount = id => book(id).groups.reduce((a, g) => a + g.length, 0);
const isStar = k => stars.some(s => s.k === k);

/* ---------- routing (bare #tokens only) ---------- */
let current = null, pendingOpen = null;
function go(id){ if (location.hash.slice(1) === id) route(); else location.hash = id; }
addEventListener("hashchange", () => { if (started && location.hash.slice(1) !== current) route(); });
const NAV_L = {home:["Home","Beranda"], units:["Units","Unit"], search:["Search","Cari"], saved:["Saved","Tersimpan"], about:["Guide","Panduan"]};
function chrome(){
  document.documentElement.lang = isID() ? "id" : "en";
  document.querySelectorAll("[data-nav]").forEach(b => { const x = NAV_L[b.dataset.nav]; const s = b.querySelector(".nl"); if (x && s) s.textContent = tr(x[0], x[1]); });
}
function langPage(){
  return `<section class="langpick"><div class="eb">The Teacher’s Phrasebook</div><h2>Pilih bahasa<br><span>Choose your language</span></h2><p>Frasa, contoh, dan dialog tetap dalam bahasa Inggris. Pilihan ini hanya untuk judul, instruksi, dan penjelasan. Bisa diganti kapan saja.</p><p class="en">Phrases, examples and dialogues stay in English. This only changes titles, instructions and explanations. You can switch any time.</p>
  <div class="levels"><button class="lvbtn" data-lang="id" style="--lc:var(--green)"><span class="dot">ID</span><span><b>Bahasa Indonesia</b><small>Penjelasan dalam bahasa Indonesia</small></span></button><button class="lvbtn" data-lang="en" style="--lc:var(--u3)"><span class="dot">EN</span><span><b>English</b><small>Everything in English</small></span></button></div></section>`;
}
function route(){
  if (!started) return;
  chrome();
  document.body.classList.toggle("picking", !lang);
  if (!lang) { current = null; app.innerHTML = langPage(); return; }
  const h = location.hash.slice(1) || "home";
  current = h;
  try { speechSynthesis.cancel(); } catch(e){}
  const n = NODES[h];
  let page = "home", html;
  if (h === "units") { page = "units"; html = unitsPage(); }
  else if (h === "saved") { page = "saved"; html = savedPage(); }
  else if (h === "about") { page = "about"; html = aboutPage(); }
  else if (h === "search") { page = "search"; html = searchPage(); }
  else if (h === "privacy") { page = "about"; html = privacyPage(); }
  else if (n && n.leaf) { page = "units"; markVisit(n.id); html = routinePage(n); }
  else if (n && n.kind === "section") { page = "units"; html = unitPage(n.parent); }
  else if (n && n.parent && n.parent.id === "root") { page = "units"; html = unitPage(n); }
  else html = homePage();
  app.innerHTML = html;
  document.querySelectorAll("[data-nav]").forEach(b => { if (b.dataset.nav === page) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  after(h, n);
}
function after(h, n){
  if (n && n.kind === "section") { const el = document.getElementById("sec-" + h); if (el) { el.scrollIntoView(); return; } }
  if (n && n.leaf && pendingOpen != null) {
    const d = document.getElementById("g" + pendingOpen); pendingOpen = null;
    if (d) { d.open = true; d.scrollIntoView({block:"center"}); return; }
  }
  scrollTo(0, 0);
  if (h === "search") { const i = document.getElementById("q"); i.focus(); i.oninput = () => { document.getElementById("results").innerHTML = results(i.value); }; }
}

/* ---------- unit icons + small helpers ---------- */
const UI_PATHS = {
  u1:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  u2:'<circle cx="8.5" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3.5 19c.6-3.2 2.6-5 5-5s4.4 1.8 5 5M14 15.2c.6-.3 1.3-.4 2-.4 2 0 3.6 1.5 4 4.2"/>',
  u3:'<rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M8 19.5l2-4M16 19.5l-2-4M7 8.5h6M7 11.5h9"/>',
  u4:'<path d="M3.5 5.5c2.8-1.2 5.6-1.2 8.5.8 2.9-2 5.7-2 8.5-.8v13c-2.8-1.2-5.6-1.2-8.5.8-2.9-2-5.7-2-8.5-.8z"/><path d="M12 6.3v13"/>',
  u5:'<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16v4"/><path d="M10.5 8.3l3.5 2-3.5 2z"/>',
  u6:'<path d="M4.5 6.5a2 2 0 012-2h11a2 2 0 012 2v7a2 2 0 01-2 2H11l-4 3.5v-3.5h-.5a2 2 0 01-2-2z"/><path d="M8.5 9h7M8.5 12h4.5"/>'
};
const uIcon = (u, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${UI_PATHS[u.id]}</svg>`;
const USHORT = {u1:["Routines","Rutinitas"], u2:["Learners","Siswa"], u3:["Classroom","Kelas"], u4:["Textbook","Buku"], u5:["Technology","Teknologi"], u6:["Skills","Keterampilan"]};
const unitLeaves = u => LEAVES.filter(l => unitOf(l) === u);
const unitPct = u => { const ls = unitLeaves(u); return Math.round(100 * ls.filter(l => visited[l.id]).length / ls.length); };
function ago(t){
  const m = Math.max(1, Math.round((Date.now() - t) / 6e4));
  if (m < 60) return tr(`${m} min${m > 1 ? "s" : ""} ago`, `${m} menit lalu`);
  const h = Math.round(m / 60); if (h < 24) return tr(`${h} hour${h > 1 ? "s" : ""} ago`, `${h} jam lalu`);
  const d = Math.round(h / 24); return tr(`${d} day${d > 1 ? "s" : ""} ago`, `${d} hari lalu`);
}
const barHTML = (p, thin) => `<div class="bar-t${thin ? " thin" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><div class="bar-f" style="width:${p}%"></div></div>`;
const ICHECK = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const IUSER = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
const ISEARCH = '<svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* ---------- cards ---------- */
function routineCard(l){
  const u = unitOf(l);
  return `<button class="card" style="--u:${u.color}" data-go="${l.id}"><span class="thumb">${uIcon(u, 24)}</span><span class="cx"><h4>${bi(l)}</h4><span class="meta"><span>${esc(eyeb(u.eyebrow))}</span><span>${plural(phraseCount(l.id), "phrase", "phrases", "frasa")}</span></span></span>${visited[l.id] ? `<span class="seen" title="${tr("Opened", "Sudah dibuka")}">${ICHECK}</span>` : ""}</button>`;
}
function unitCard(u){
  const n = u.children.reduce((a, s) => a + s.children.length, 0), p = unitPct(u);
  return `<button class="card unit" style="--u:${u.color}" data-go="${u.id}"><span class="img">${IL("U_" + u.id)}</span><span class="cx"><span class="num">${esc(eyeb(u.eyebrow))} · ${plural(n, "topic", "topics", "topik")}</span><h4>${bi(u)}</h4></span><span><span class="pp"><span>${tr("Opened", "Sudah dibuka")}</span><span>${p}%</span></span>${barHTML(p, true)}</span></button>`;
}
function brand(){
  const ini = (viewer.name || "Guru").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return `<header class="brand"><span class="avatar" aria-hidden="true">${esc(ini)}</span><span class="hi"><small>${viewer.name ? tr("Welcome back,", "Selamat datang kembali,") : tr("Welcome to", "Selamat datang di")}</small><b>${viewer.name ? esc(viewer.name) : "The Teacher’s Phrasebook"}</b></span><button class="roundbtn" id="langBtn" aria-label="${tr("Language: English. Switch to Indonesian", "Bahasa: Indonesia. Ganti ke bahasa Inggris")}">${isID() ? "ID" : "EN"}</button><button class="roundbtn" id="acctBtn" aria-label="${tr("Account", "Akun")}">${IUSER}</button></header>`;
}

/* ---------- home ---------- */
const DAYPHRASES = [];
LEAVES.forEach(l => { if (BOOK[l.id]) BOOK[l.id].groups.forEach((g, gi) => DAYPHRASES.push([l, gi, g[0]])); });
let dayIdx = Math.floor(Date.now() / 864e5) % DAYPHRASES.length;
function heroPhrase(){
  const [l, gi, p] = DAYPHRASES[dayIdx];
  return `<span class="k">${tr("Phrase of the day", "Frasa hari ini")}</span><p class="big">${fmt(p)}</p><p>${tr("From", "Dari")} ${esc(tt(l))} · ${esc(eyeb(unitOf(l).eyebrow))}</p>
  <div class="row-btns"><button class="sbtn" data-say="${esc(p)}">${I.speak} ${tr("Listen", "Dengarkan")}</button><button class="sbtn ghost" id="anotherPhrase">${tr("Another phrase", "Frasa lain")}</button><button class="sbtn ghost" data-open="${l.id}|${gi}">${tr("Open topic", "Buka topik")} ${I.arrow}</button></div>`;
}
function homePage(){
  let h = brand();
  h += `<h2 class="ask">${tr("What do you want to say in class today?", "Mau bilang apa di kelas hari ini?")}</h2>`;
  h += `<div class="chiprow" role="navigation" aria-label="${tr("Units", "Unit")}"><button class="srch" data-go="search" aria-label="${tr("Search phrases", "Cari frasa")}">${ISEARCH}</button>${UNITS.map(u => `<button class="chip" data-go="${u.id}">${esc(tr(USHORT[u.id][0], USHORT[u.id][1]))}</button>`).join("")}</div>`;
  const last = LEAVES.filter(l => visited[l.id]).sort((x, y) => visited[y.id] - visited[x.id])[0];
  let cont;
  if (last) {
    const u = unitOf(last), p = unitPct(u);
    cont = `<section><div class="rowhead"><h3>${tr("Continue where you left off", "Lanjutkan yang terakhir dibuka")}</h3></div><button class="cont" style="--u:${u.color}" data-go="${last.id}"><span class="top"><span class="thumb pic">${IL(last.parent.id)}</span><span class="tx"><h4>${esc(tt(last))}</h4><small>${esc(eyeb(u.eyebrow))} · ${esc(tt(last.parent))} · ${ago(visited[last.id])}</small></span></span><span class="prog"><span class="ph"><span>${tr("Unit progress", "Progres unit")}</span><b>${p}%</b></span>${barHTML(p)}</span></button></section>`;
  } else {
    const u = UNITS[0], f = LEAVES[0];
    cont = `<section><div class="rowhead"><h3>${tr("Start here", "Mulai dari sini")}</h3></div><button class="cont" style="--u:${u.color}" data-go="${f.id}"><span class="top"><span class="thumb pic">${IL(f.parent.id)}</span><span class="tx"><h4>${esc(tt(f))}</h4><small>${esc(eyeb(u.eyebrow))} · ${esc(tt(f.parent))}</small></span></span><span class="prog"><span class="ph"><span>${tr("Unit progress", "Progres unit")}</span><b>0%</b></span>${barHTML(0)}</span></button></section>`;
  }
  const potd = `<section><div class="potd" id="potd">${heroPhrase()}</div></section>`;
  h += `<div class="home2">${cont}${potd}</div>`;
  // for you: unopened topics, starting after the last opened one
  const start = last ? LEAVES.indexOf(last) + 1 : 0;
  const order = LEAVES.slice(start).concat(LEAVES.slice(0, start));
  const fy = order.filter(l => !visited[l.id]).slice(0, 8);
  if (fy.length) h += `<section><div class="rowhead"><h3>${tr("For you", "Untuk Anda")}</h3><button class="see" data-go="units">${tr("View all", "Lihat semua")}</button></div><div class="row">${fy.map(l => { const u = unitOf(l); return `<button class="fy" style="--u:${u.color}" data-go="${l.id}"><span class="img">${IL(l.parent.id) || uIcon(u, 40)}</span><h4>${esc(tt(l))}</h4><small>${esc(eyeb(u.eyebrow))} · ${plural(phraseCount(l.id), "phrase", "phrases", "frasa")}</small></button>`; }).join("")}</div></section>`;
  h += `<section><div class="rowhead"><h3>${tr("Your class", "Kelas Anda")}</h3><button class="see" data-go="about">${tr("What's this?", "Apa ini?")}</button></div><div class="lvrow">${LEVELS.map(l => `<button class="lvchip" data-level="${l.id}" aria-pressed="${l.id === level}" style="${lvVars(l)}"><span class="d"></span>${esc(lvName(l))}</button>`).join("")}</div></section>`;
  h += `<section><div class="rowhead"><h3>${tr("Browse by unit", "Jelajahi per unit")}</h3><button class="see" data-go="units">${tr("View all", "Lihat semua")}</button></div><div class="grid">${UNITS.map(unitCard).join("")}</div></section>`;
  return h;
}
/* ---------- units ---------- */
function unitsPage(){
  return brand() + `<section><div class="rowhead"><h3><b>${tr("All units", "Semua unit")}</b></h3></div><div class="grid">${UNITS.map(unitCard).join("")}</div></section>`;
}
function unitPage(u){
  const n = u.children.reduce((a, s) => a + s.children.length, 0);
  let h = `<button class="back" data-go="units">${I.back} ${tr("All units", "Semua unit")}</button>
  <header class="pagehead" style="--u:${u.color}"><div class="top"><span class="thumb pic">${IL("U_" + u.id)}</span><div><span class="k">${esc(eyeb(u.eyebrow))}</span><h2>${bi(u)}</h2></div></div><p>${tr(`${u.children.length} sections · ${n} classroom situations`, `${u.children.length} bagian · ${n} situasi kelas`)}</p></header>`;
  u.children.forEach(sec => {
    const s = Object.assign({}, SEC[sec.id] || {}, (isID() && IDC.sec[sec.id]) || {});
    const rd = !!secRead[sec.id];
    h += `<section class="section" id="sec-${sec.id}"><div class="secblock ${s.intro ? (rd ? "read" : "unread") : "plain"}"><div class="sechead" style="--u:${u.color}"><span class="thumb pic">${IL(sec.id)}</span><h3><small>${esc(eyeb(sec.eyebrow))}</small>${bi(sec)}</h3></div>`;
    if (s.intro) h += `<details class="about ${rd ? "read" : "unread"}" data-sec="${sec.id}"><summary><span class="stepn">${rd ? ICHECK : "1"}</span><span class="st"><span class="lbl">${rd ? tr("Read", "Sudah dibaca") : tr("Start here", "Mulai di sini")}</span><b>${tr("About this section", "Tentang bagian ini")}</b><span class="pv">${esc(s.intro)}</span></span><span class="chev">${I.chev}</span></summary><div class="in"><p style="margin:0">${esc(s.intro)}</p>
      ${s.think && s.think.length ? `<h5>${tr("Points to think and talk about", "Bahan renungan dan diskusi")}</h5><ol>${s.think.map(q => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}
      ${s.lang && s.lang.length ? `<h5>${tr("Language to think about", "Bahasa yang perlu dicermati")}</h5><ol>${s.lang.map(q => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}
      ${s.vocab ? `<h5>${tr("Vocabulary to collect", "Kosakata yang perlu dikumpulkan")}</h5><p style="margin:0">${esc(s.vocab)}</p>` : ""}</div></details>`;
    h += `</div>`;
    h += `${s.intro ? `<div class="step2"><span class="stepn">2</span>${tr("Choose a topic", "Pilih topik")}</div>` : ""}<div class="grid">${sec.children.map(routineCard).join("")}</div></section>`;
  });
  return h;
}
/* ---------- routine ---------- */
/* cross-references like "Unit 3, B4", "Unit 2, C" or a bare "A5" become links */
let xrefUnit = null;
function xrefTarget(u, sec, n){
  const unit = UNITS[u - 1]; if (!unit) return null;
  if (!sec) return {id: unit.id};
  const s = unit.children["ABCD".indexOf(sec)]; if (!s) return {id: unit.id};
  if (!n) return {id: s.id};
  const t = s.children[n - 1]; return t ? {id: t.id} : {id: s.id};
}
function xref(html){
  let cu = xrefUnit;
  return html.replace(/Unit (\d)(?:, ([A-D])(\d?)(?:: ([A-Z][^.,(]*[a-z]))?)?|\b([A-D])([1-7])\b/g, (m, u, s, n, ttl, bs, bn) => {
    let tg, rest = "";
    if (u) {
      cu = +u; tg = xrefTarget(+u, s, n ? +n : 0);
      if (ttl && tg && NODES[tg.id].kind === "section") {
        const hit = NODES[tg.id].children.find(c => c.title === ttl || TID[c.id] === ttl);
        if (hit) tg = {id: hit.id}; else { rest = m.slice(m.indexOf(":")); m = m.slice(0, m.indexOf(":")); }
      }
    }
    else { if (!cu) return m; tg = xrefTarget(cu, bs, +bn); if (!tg || NODES[tg.id].kind === "section" || !NODES[tg.id].leaf) return m; }
    if (!tg) return m;
    const n2 = NODES[tg.id], label = n2.leaf ? tt(n2) : n2.kind === "section" ? tt(n2) : tt(n2);
    return `<a class="xref" href="#${tg.id}" title="${esc(label)}">${m}</a>${rest}`;
  });
}
function noteHTML(nt){
  const [, t, text, ex] = nt;
  const items = (ex || []).map(x => x.startsWith("x:") ? `<li><span class="wrong">${fmt(x.slice(2))}</span></li>` : x.startsWith("v:") ? `<li><span class="right">${fmt(x.slice(2))}</span></li>` : `<li>${fmt(x)}</li>`).join("");
  return `<div class="note" style="${ntVar(t)}"><div class="ntag"><i aria-hidden="true">${NT[t].ic}</i>${ntName(t)}</div><div>${xref(fmt(text))}</div>${items ? `<ul>${items}</ul>` : ""}</div>`;
}
function phraseRow(id, gi, ai, p, key){
  const k = `${id}|${gi}|${ai}`, on = isStar(k);
  return `${key ? "" : `<li>`}<span>${fmt(p)}</span><button class="ic" data-say="${esc(p)}" aria-label="${tr("Listen", "Dengarkan")}">${I.speak}</button><button class="ic star" data-star="${k}" aria-pressed="${on}" aria-label="${on ? tr("Remove from saved", "Hapus dari simpanan") : tr("Save phrase", "Simpan frasa")}" style="--fo:${on ? 1 : 0}">${I.save}</button>${key ? "" : `</li>`}`;
}
function routinePage(l){
  xrefUnit = UNITS.indexOf(unitOf(l)) + 1;
  const id = l.id, b = bookL(id), u = unitOf(l), sec = l.parent, L = lv(level), dl = R[id].levels[level];
  const low = level === "ls" || level === "sk";
  const last = b.groups.length - 1;
  const notesFor = gi => b.notes.filter(n => (n[0] === gi + 1 || (gi === last && n[0] > b.groups.length)) && n[1] !== "M");
  const mistakes = b.notes.filter(n => n[1] === "M");
  const general = b.notes.filter(n => n[0] === 0 && n[1] !== "M");
  const total = phraseCount(id);
  let h = `<button class="back" data-go="${sec.id}">${I.back} ${esc(eyeb(u.eyebrow))} · ${esc(tt(sec))}</button>
  <header class="pagehead" style="--u:${u.color}"><div class="top"><span class="thumb pic">${IL(sec.id)}</span><div><span class="k">${esc(eyeb(u.eyebrow))} · ${esc(tt(sec))}</span><h2>${bi(l)}</h2></div></div><p>${tr(`${b.groups.length} key phrases · ${total} ways to say them. Tap a phrase to see more ways and notes.`, `${b.groups.length} frasa kunci · ${total} cara mengucapkannya. Ketuk frasa untuk melihat variasi dan catatannya.`)}</p></header>
  <section><h3 class="blocktitle">${tr("Key phrases", "Frasa kunci")}</h3><div class="phrases" style="--u:${u.color}">`;
  b.groups.forEach((g, gi) => {
    let ns = notesFor(gi);
    const hiddenIdioms = low ? ns.filter(n => n[1] === "I").length : 0;
    if (low) ns = ns.filter(n => n[1] !== "I");
    const extra = [g.length > 1 ? tr(`${g.length - 1} more way${g.length > 2 ? "s" : ""} to say it`, `${g.length - 1} variasi lain`) : "", ns.length ? plural(ns.length, "note", "notes", "catatan") : ""].filter(Boolean).join(" · ");
    h += `<details class="pc" id="g${gi}"><summary><span class="n">${gi+1}</span><span class="t">${fmt(g[0])}${extra ? `<span class="more">${extra}</span>` : ""}</span><span class="chev">${I.chev}</span></summary><div class="body">
      <ul class="alts">${g.map((p, ai) => `<li>${phraseRow(id, gi, ai, p, true)}</li>`).join("")}</ul>
      ${ns.length ? `<div class="notes">${ns.map(noteHTML).join("")}</div>` : ""}
      ${hiddenIdioms ? `<div class="hiddennote">${tr(`${hiddenIdioms} idiomatic phrase note${hiddenIdioms > 1 ? "s are" : " is"} hidden for ${esc(L.name)}. Choose Teens or Adults in the example dialogue section to see ${hiddenIdioms > 1 ? "them" : "it"}.`, `${hiddenIdioms} catatan frasa idiomatis disembunyikan untuk level ${esc(lvName(L))}. Pilih Remaja atau Dewasa di bagian contoh dialog untuk melihatnya.`)}</div>` : ""}
    </div></details>`;
  });
  h += `</div></section>`;
  if (mistakes.length) h += `<section class="watch" style="${ntVar("M")}"><h3 class="blocktitle" style="color:var(--nM);margin:0">${tr("Watch out", "Hati-hati")}</h3>${mistakes.map(m => `<div class="w"><span>${fmt(m[2])}</span>${(m[3] || []).map(x => x.startsWith("x:") ? `<span class="wrong">${fmt(x.slice(2))}</span>` : x.startsWith("v:") ? `<span class="right">${fmt(x.slice(2))}</span>` : `<span>${fmt(x)}</span>`).join("")}</div>`).join("")}</section>`;
  h += `<section id="inclass"><h3 class="blocktitle">${tr("In class: example dialogue", "Di kelas: contoh dialog")}</h3><p class="hiddennote" style="margin:0 0 10px;font-style:normal">${tr("The key phrases above work for every class. Choose a level to see how they sound in a lesson with that age group.", "Frasa kunci di atas bisa dipakai di semua kelas. Pilih level untuk melihat penerapannya di kelas dengan kelompok usia itu.")}</p>
  <div class="filters" role="group" aria-label="${tr("Choose an age group", "Pilih kelompok usia")}" style="margin-bottom:12px">${LEVELS.map(x => `<button class="chipbtn" data-level="${x.id}" aria-pressed="${x.id === level}" style="${lvVars(x)}"><span class="d"></span>${esc(lvName(x))}</button>`).join("")}</div><div class="dlg" style="${lvVars(L)}"><div class="dlg-top"><span>${esc(lvName(L))} · ${esc(lvAge(L))} · ${tr("T = teacher, S = student", "T = guru, S = siswa")}</span><button class="ic" id="playDlg" aria-label="${tr("Listen to the dialogue", "Dengarkan dialog")}">${I.speak}</button></div>
    ${dl.lines.map(([w, t]) => w === "A" ? `<div class="ln a">${esc(t)}</div>` : `<div class="ln ${w === "S" ? "s" : ""}"><span class="who" aria-label="${w === "S" ? "Student" : "Teacher"}">${w}</span><div class="bub">${fmt(t)}</div></div>`).join("")}
    <div class="tipline"><b>${tr("For", "Untuk")} ${esc(lvName(L))}:</b> ${esc((isID() && IDC.dlg[id] && IDC.dlg[id][level]) || dl.note)}</div></div></section>`;
  if (general.length) h += `<section><h3 class="blocktitle">${tr("Notes", "Catatan")}</h3><div class="notes">${general.map(noteHTML).join("")}</div></section>`;
  const i = LEAVES.indexOf(l), prev = LEAVES[i-1], nextLeaf = LEAVES[i+1];
  const next = nextLeaf;
  h += `<nav class="pager" aria-label="${tr("More topics", "Topik lain")}">${prev ? `<button data-go="${prev.id}"><small>${tr("Previous", "Sebelumnya")}</small><b>${esc(tt(prev))}</b></button>` : "<span></span>"}${next ? `<button data-go="${next.id}"><small>${tr("Next", "Berikutnya")}</small><b>${esc(tt(next))}</b></button>` : "<span></span>"}</nav>`;
  return h;
}

/* ---------- search ---------- */
const INDEX = [];
LEAVES.forEach(l => {
  INDEX.push({l, gi:null, text:l.title, low:(l.title + " " + (TID[l.id] || "")).toLowerCase()});
  book(l.id).groups.forEach((g, gi) => g.forEach(p => INDEX.push({l, gi, text:p, low:p.toLowerCase()})));
});
function hl(text, terms){
  let s = esc(text);
  terms.forEach(t => { if (t) s = s.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
  return s;
}
function results(q){
  const terms = q.toLowerCase().trim().split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return `<div class="empty">${tr("Type a word or situation, for example <b>late</b>, <b>homework</b>, <b>noise</b> or <b>pair work</b>.", "Ketik kata atau situasi, misalnya <b>late</b>, <b>homework</b>, <b>terlambat</b>, atau <b>PR</b>.")}</div>`;
  const hits = INDEX.filter(x => terms.every(t => x.low.includes(t)));
  hits.sort((a, b) => (a.gi === null ? 0 : 1) - (b.gi === null ? 0 : 1));
  if (!hits.length) return `<div class="empty">${tr(`No phrases found for “${esc(q)}”. Try a shorter or different word.`, `Tidak ada frasa untuk “${esc(q)}”. Coba kata yang lebih pendek atau berbeda.`)}</div>`;
  const shown = hits.slice(0, 60);
  return `<p class="hiddennote" style="margin:0">${tr(`${hits.length} result${hits.length > 1 ? "s" : ""}${hits.length > 60 ? ", showing the first 60" : ""}`, `${hits.length} hasil${hits.length > 60 ? ", menampilkan 60 pertama" : ""}`)}</p><div class="list">${shown.map(x => `<button class="result" data-open="${x.l.id}|${x.gi === null ? "" : x.gi}"><span>${x.gi === null ? `<b>${hl(x.text, terms)}</b>${isID() && TID[x.l.id] ? `<small>${esc(TID[x.l.id])}</small>` : ""}<small>${tr("Topic", "Topik")} · ${esc(eyeb(unitOf(x.l).eyebrow))} · ${esc(tt(x.l.parent))}</small>` : `${hl(x.text, terms)}<small>${esc(tt(x.l))} · ${esc(eyeb(unitOf(x.l).eyebrow))}</small>`}</span>${I.arrow}</button>`).join("")}</div>`;
}
function searchPage(){
  return `<button class="back" data-go="home">${I.back} ${tr("Home", "Beranda")}</button><label class="sr" for="q">${tr("Search phrases", "Cari frasa")}</label><div class="searchbox"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="q" type="search" placeholder="${tr("Search phrases and topics", "Cari frasa dan topik")}" autocomplete="off"></div><div id="results" class="list">${results("")}</div>`;
}

/* ---------- saved ---------- */
function savedPage(){
  let h = brand() + `<section><div class="rowhead"><h3><b>${tr("Saved phrases", "Frasa tersimpan")}</b></h3></div><p class="hiddennote syncnote" style="margin:0 0 12px;font-style:normal">${tr("Saved to your account, so they appear on every device where you sign in.", "Tersimpan di akun Anda, jadi muncul di semua perangkat tempat Anda masuk.")}</p>`;
  if (!stars.length) return h + `<div class="empty">${tr("Nothing saved yet. Open any topic, tap a key phrase, and press the bookmark next to a phrase you want to remember.", "Belum ada yang disimpan. Buka topik apa saja, ketuk frasa kunci, lalu tekan ikon penanda di samping frasa yang ingin Anda ingat.")}</div></section>`;
  const by = {}; stars.forEach(s => (by[s.rid] = by[s.rid] || []).push(s));
  LEAVES.filter(l => by[l.id]).forEach(l => {
    h += `<div class="rowhead" style="margin-top:14px"><h3>${esc(eyeb(unitOf(l).eyebrow))} · <b>${esc(tt(l))}</b></h3><button class="see" data-go="${l.id}">${tr("Open", "Buka")} ${I.arrow}</button></div><div class="list">${by[l.id].map(s => `<div class="result" style="cursor:default"><span>${fmt(s.t)}</span><button class="ic" data-say="${esc(s.t)}" aria-label="${tr("Listen", "Dengarkan")}">${I.speak}</button><button class="ic star" data-star="${s.k}" aria-pressed="true" style="--fo:1" aria-label="${tr("Remove from saved", "Hapus dari simpanan")}">${I.save}</button></div>`).join("")}</div>`;
  });
  return h + `</section>`;
}

/* ---------- about ---------- */
function aboutPage(){
  const levels = `<div class="levels">${LEVELS.map(l => `<button class="lvbtn" data-level="${l.id}" aria-pressed="${l.id === level}" style="${lvVars(l)}"><span class="dot">${l.short}</span><span><b>${esc(lvName(l))}</b><small>${esc(lvAge(l))}</small></span></button>`).join("")}</div>`;
  const langs = `<div class="levels">${[["id","Bahasa Indonesia","Judul, instruksi, dan penjelasan"],["en","English","Everything in English"]].map(([c, n, d]) => `<button class="lvbtn" data-lang="${c}" aria-pressed="${lang === c}" style="--lc:var(--green)"><span class="dot">${c.toUpperCase()}</span><span><b>${n}</b><small>${d}</small></span></button>`).join("")}</div>`;
  const notes = `<div class="notes">${["L","I","P","M","S","X"].map(t => `<div class="note" style="${ntVar(t)}"><div class="ntag"><i aria-hidden="true">${NT[t].ic}</i>${ntName(t)}</div><div>${ntDesc(t)}</div></div>`).join("")}</div>`;
  if (isID()) return brand() + `<section class="prose">
    <h3>Tentang aplikasi ini</h3><p><b>The Teacher’s Phrasebook</b>: bahasa Inggris praktis untuk mengajar sehari-hari.</p><p>Referensi lengkap dan praktis untuk guru bahasa Inggris di sekolah maupun lembaga kursus. Jelajahi beragam ungkapan kelas, frasa yang berguna, dan situasi mengajar yang nyata, mulai dari memberi instruksi dan mengecek pemahaman sampai mengelola kegiatan dan menanggapi siswa. Jelajahi per unit atau cari persis apa yang Anda butuhkan. Tanpa urutan belajar yang wajib, cukup bahasa Inggris kelas yang praktis dan siap dipakai kapan pun Anda membutuhkannya.</p><p class="hiddennote">Materi frasa dan catatannya berdasarkan buku <i>Practical Classroom English</i> (Hughes, Moate &amp; Raatikainen, Oxford University Press).</p>
    <h3>Bahasa</h3><p>Judul, instruksi, dan penjelasan bisa ditampilkan dalam bahasa Indonesia. Frasa, contoh, dan dialog tetap dalam bahasa Inggris. Penjelasan yang belum diterjemahkan tampil dalam bahasa Inggris.</p>${langs}
    <h3>Kelas Anda</h3><p>Pilih level yang Anda ajar. Contoh dialog mengikuti level ini, dan frasa idiomatis (untuk pembelajar tingkat lanjut) disembunyikan untuk Prasekolah dan Anak-anak.</p>${levels}
    <h3>Cara memakai satu topik</h3><ol><li>Ketuk frasa kunci untuk melihat variasi dan catatannya.</li><li>Tekan ikon speaker untuk mendengar frasa. Ucapkan sendiri dengan suara keras.</li><li>Tekan ikon penanda untuk menyimpan frasa yang ingin Anda pakai. Temukan di menu Tersimpan.</li><li>Cek <b>Hati-hati</b> untuk kesalahan umum, dan contoh dialog untuk kelas Anda.</li></ol>
    <h3>Jenis catatan</h3>${notes}
    <h3>Tips belajar mandiri</h3><ol><li>Belajarlah bersama satu atau dua rekan guru. Saling mengamati saat mengajar dan beri masukan yang jujur dan membangun.</li><li>Awali setiap unit dengan membuka <b>Tentang bagian ini</b> dan mendiskusikan pertanyaannya.</li><li>Baca setiap frasa dengan suara keras, lalu bayangkan momen nyata di kelas Anda saat Anda akan mengucapkannya.</li><li>Pilih satu atau dua frasa yang Anda suka lalu simpan. Pilih yang terasa nyaman dan cocok untuk kelas Anda.</li><li>Uji diri sendiri: tutup frasanya lalu ingat kembali, atau minta rekan membacakan beberapa kata pertama dan Anda melanjutkannya.</li></ol>
    <h3>Pasang di HP</h3><p>Phrasebook bisa dipasang di layar utama HP seperti aplikasi: buka menu Akun (ikon orang di kanan atas) lalu pilih <b>Pasang ke layar utama</b>. Di iPhone, buka di Safari, ketuk tombol Bagikan, lalu pilih <b>Tambah ke Layar Utama</b>. Setelah dibuka sekali, isinya tetap bisa dibaca tanpa internet.</p>
    <p class="hiddennote">Frasa tersimpan, topik yang sudah dibuka, level, dan bahasa tersimpan di akun Anda. <button class="linkbtn" data-go="privacy">Privasi</button></p></section>`;
  return brand() + `<section class="prose">
    <h3>What this is</h3><p><b>The Teacher’s Phrasebook</b>: practical English for everyday teaching.</p><p>A comprehensive, practical reference for English teachers in schools and language courses. Explore a wide range of classroom expressions, useful phrases, and real-life teaching situations—from giving instructions and checking understanding to managing activities and responding to students. Browse by unit or search for exactly what you need. No fixed learning path, just practical classroom English at your fingertips, whenever you need it.</p><p class="hiddennote">Phrases and notes are based on <i>Practical Classroom English</i> (Hughes, Moate &amp; Raatikainen, Oxford University Press).</p>
    <h3>Language</h3><p>Titles, instructions and explanations can be shown in Indonesian. Phrases, examples and dialogues always stay in English.</p>${langs}
    <h3>Your class</h3><p>Choose the level you teach. Example dialogues follow this level, and idiomatic phrases (meant for advanced learners) are hidden for Preschool and Kids.</p>${levels}
    <h3>How to use a topic</h3><ol><li>Tap a key phrase to see more ways to say it and the notes.</li><li>Press the speaker to hear a phrase. Say it aloud yourself.</li><li>Press the bookmark to save phrases you want to use. Find them under Saved.</li><li>Check <b>Watch out</b> for typical mistakes, and the example dialogue for your class.</li></ol>
    <h3>The notes</h3>${notes}
    <h3>Tips for self-study</h3><ol><li>Study with one or two colleagues. Observe each other teach and give encouraging, honest feedback.</li><li>Start a unit by opening <b>About this section</b> and discussing the questions.</li><li>Read each phrase aloud, then imagine a real moment in your class when you would say it.</li><li>Pick one or two phrases you like and save them. Choose ones that feel comfortable and suit your classes.</li><li>Test yourself: cover the phrase and recall it, or let a partner read the first few words while you finish the phrase.</li></ol>
    <h3>Install on your phone</h3><p>Phrasebook can sit on your home screen like an app: open Account (the person icon at the top right) and choose <b>Install on home screen</b>. On iPhone, open it in Safari, tap Share, then <b>Add to Home Screen</b>. Once opened, the content can be read without internet.</p>
    <p class="hiddennote">Saved phrases, opened topics, your level and language are stored in your account. <button class="linkbtn" data-go="privacy">Privacy</button></p></section>`;
}

/* ---------- privacy ---------- */
function privacyPage(){
  const tpl = document.getElementById("privacy-tpl");
  return `<button class="back" data-go="about">${I.back} ${tr("Guide", "Panduan")}</button><section class="prose">${tpl ? tpl.innerHTML : ""}</section>`;
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button, [data-go]"); if (!t) return;
  if (!started || t.closest("#gate")) return;
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.nav) return go(t.dataset.nav);
  if (t.dataset.say) return speak(t.dataset.say);
  if (t.dataset.open) { const [id, gi] = t.dataset.open.split("|"); pendingOpen = gi === "" || gi == null ? null : +gi; return go(id); }
  if (!started) return;
  if (t.dataset.level) { level = t.dataset.level; changed(); const y = scrollY; route(); if (current !== "home") scrollTo(0, y); return; }
  if (t.dataset.star) {
    const k = t.dataset.star, i = stars.findIndex(s => s.k === k);
    if (i >= 0) stars.splice(i, 1); else { const [rid, gi, ai] = k.split("|"); stars.push({k, rid, t: book(rid).groups[+gi][+ai]}); }
    changed();
    if (current === "saved") { const y = scrollY; route(); scrollTo(0, y); return; }
    const on = isStar(k); t.setAttribute("aria-pressed", on); t.style.setProperty("--fo", on ? 1 : 0); t.setAttribute("aria-label", on ? tr("Remove from saved", "Hapus dari simpanan") : tr("Save phrase", "Simpan frasa"));
    return;
  }
  if (t.id === "anotherPhrase") { dayIdx = Math.floor(Math.random() * DAYPHRASES.length); document.getElementById("potd").innerHTML = heroPhrase(); return; }
  if (t.dataset.lang) { lang = t.dataset.lang; changed(); const y = scrollY; route(); if (current === "about") scrollTo(0, y); if (window.PBAccount) window.PBAccount.relabel(); return; }
  if (t.id === "langBtn") { lang = isID() ? "en" : "id"; changed(); const y = scrollY; route(); scrollTo(0, y); if (window.PBAccount) window.PBAccount.relabel(); return; }
  if (t.id === "acctBtn") { if (window.PBAccount) window.PBAccount.open(); return; }
  if (t.id === "playDlg") { const l = NODES[current]; return speak(R[l.id].levels[level].lines.filter(x => x[0] !== "A")); }
});

document.addEventListener("toggle", e => {
  const d = e.target; if (!d.matches || !d.matches("details.about[data-sec]") || !d.open) return;
  const id = d.dataset.sec; if (secRead[id]) return;
  secRead[id] = Date.now(); changed();
  d.classList.remove("unread"); d.classList.add("read");
  const blk = d.closest(".secblock"); if (blk) { blk.classList.remove("unread"); blk.classList.add("read"); }
  const n = d.querySelector(".stepn"); if (n) n.innerHTML = ICHECK;
  const l = d.querySelector(".lbl"); if (l) l.textContent = tr("Read", "Sudah dibaca");
}, true);

/* ---------- API for account.js ---------- */
window.PBApp = {
  start(user, st){ applyState(user, st); started = true; document.getElementById("app").hidden = false; route(); },
  /* new data from the server while the app is open: re-render in place */
  refresh(user, st){ applyState(user, st); if (started) { const y = scrollY; route(); scrollTo(0, y); } },
  stop(){ started = false; current = null; app.innerHTML = ""; document.body.classList.remove("picking"); },
  state: stateOut,
  setPref(k, v){ prefs[k] = v; changed(); },
  pref(k){ return prefs[k]; },
  isID: () => isID(),
  isStarted: () => started,
  toast
};
