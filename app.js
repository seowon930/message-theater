import { firebaseConfig } from "./config.js?v=20261126162229";
import { Stage, THEMES, THEME_DOT, el, groupDuration } from "./stage.js?v=20261126162229";

const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
const PER_PERSON = 5;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 O/0, I/1 제외
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");

let F = null;        // firebase 함수 모음
let auth = null, db = null, authReady = null;
let cleanups = [];   // 화면을 바꿀 때 정리할 구독·애니메이션
const onCleanup = (fn) => cleanups.push(fn);

/* ---------- 공통 ---------- */
function mount(tplId) {
  cleanups.forEach((fn) => { try { fn(); } catch {} });
  cleanups = [];
  const node = $("#" + tplId).content.cloneNode(true);
  app.textContent = ""; app.appendChild(node);
  window.scrollTo(0, 0);
  return app;
}
const fill = (root, key, text) => root.querySelectorAll(`[data-f="${key}"]`).forEach((n) => (n.textContent = text));
const setStatus = (n, msg, kind) => { n.textContent = msg; n.className = "status" + (kind ? " " + kind : ""); };
const normCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
const validCode = (c) => /^[A-Z0-9]{6}$/.test(c);
const joinUrl = (code) => location.origin + location.pathname + "?c=" + code;
const shortUrl = () => (location.host + location.pathname).replace(/\/$/, "");
const ms = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now());
function qrData(text) {
  try { const q = window.qrcode(0, "M"); q.addData(text); q.make(); return q.createDataURL(8, 2); } catch { return ""; }
}
function showMessage(title, body) {
  const r = mount("tpl-msg"); fill(r, "title", title); fill(r, "body", body);
}
const storage = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
function confirmButton(btn, label, armedLabel, action) {
  let armed = null;
  btn.addEventListener("click", async () => {
    if (!armed) {
      btn.textContent = armedLabel; btn.classList.add("armed");
      armed = setTimeout(() => { armed = null; btn.textContent = label; btn.classList.remove("armed"); }, 3500);
      return;
    }
    clearTimeout(armed); armed = null; btn.disabled = true;
    try { await action(); } catch { btn.disabled = false; btn.textContent = "실패 · 다시"; btn.classList.remove("armed"); }
  });
}

async function ensureUser() {
  await authReady;
  if (auth.currentUser) return auth.currentUser;
  const cred = await F.signInAnonymously(auth);
  return cred.user;
}
const isTeacherUser = (u) => !!u && !u.isAnonymous;

/* ---------- 첫 화면: 반 코드 입력 ---------- */
function viewHome() {
  const r = mount("tpl-home");
  const input = $("#codeIn", r), st = $("#homeStatus", r), btn = $("#homeGo", r);
  input.addEventListener("input", () => { const p = input.selectionStart; input.value = normCode(input.value); input.setSelectionRange(p, p); });
  input.focus();
  $("#homeForm", r).addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = normCode(input.value);
    if (!validCode(code)) { setStatus(st, "반 코드는 영어와 숫자 6자리예요.", "err"); return; }
    btn.disabled = true; setStatus(st, "확인하는 중…");
    try {
      await ensureUser();
      const snap = await F.getDoc(F.doc(db, "rooms", code));
      if (!snap.exists()) { setStatus(st, "이 코드의 반을 찾을 수 없어요. 코드를 다시 확인해 주세요.", "err"); btn.disabled = false; return; }
      location.hash = "#join/" + code;
    } catch (err) {
      console.error(err);
      setStatus(st, "연결하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", "err"); btn.disabled = false;
    }
  });
}

/* ---------- 학생: 메시지 쓰기 ---------- */
async function viewJoin(code) {
  if (!validCode(code)) return viewHome();
  let user;
  try { user = await ensureUser(); } catch { return showMessage("연결하지 못했어요", "인터넷 연결을 확인하고 새로고침해 주세요."); }
  const roomRef = F.doc(db, "rooms", code);
  let first;
  try { first = await F.getDoc(roomRef); } catch { return showMessage("연결하지 못했어요", "인터넷 연결을 확인하고 새로고침해 주세요."); }
  if (!first.exists()) return showMessage("반을 찾을 수 없어요", `반 코드 ${code}에 해당하는 반이 없어요. 코드를 다시 확인해 주세요.`);

  const r = mount("tpl-join");
  fill(r, "code", code);
  let room = first.data();
  const form = $("#msgForm", r), toI = $("#to", r), fromI = $("#from", r), textI = $("#text", r);
  const countEl = $("#count", r), st = $("#status", r), submit = $("#submit", r), closed = $("#closedNote", r);
  fromI.value = storage.get("mt-from");

  const renderRoom = () => {
    fill(r, "title", room.title || "우리 반 메시지 상영관");
    fill(r, "sub", (room.sub ? room.sub + " · " : "") + (room.moderation ? "선생님이 확인한 메시지부터 상영 화면에 나와요." : "올린 메시지는 상영 화면에 바로 이어서 나와요."));
    closed.hidden = room.open !== false;
    submit.disabled = room.open === false;
  };
  renderRoom();
  onCleanup(F.onSnapshot(roomRef, (s) => { if (s.exists()) { room = s.data(); renderRoom(); } }, () => {}));

  const preview = new Stage($("#previewStage", r));
  onCleanup(() => preview.destroy());
  const theme = () => form.querySelector('input[name="theme"]:checked')?.value || "blossom";
  const draft = () => ({ kind: "msg", to: toI.value.trim() || "친구들", from: fromI.value.trim() || "익명", text: textI.value.trim() || textI.placeholder, theme: theme() });
  let pv;
  const renderPreview = (animated) => { clearTimeout(pv); if (animated) preview.show(draft()); else pv = setTimeout(() => preview.show(draft(), { instant: true }), 120); };
  const updateCount = () => { const n = Array.from(textI.value).length; countEl.textContent = n + " / 200"; countEl.classList.toggle("over", n >= 190); };
  [toI, fromI, textI].forEach((i) => i.addEventListener("input", () => { updateCount(); renderPreview(false); }));
  form.querySelectorAll('input[name="theme"]').forEach((x) => x.addEventListener("change", () => renderPreview(true)));
  $("#replay", r).addEventListener("click", () => renderPreview(true));
  renderPreview(true);

  let mine = [];
  const msgsCol = F.collection(db, "rooms", code, "messages");
  const isOwner = () => room.ownerUid === user.uid;
  onCleanup(F.onSnapshot(F.query(msgsCol, F.where("uid", "==", user.uid)), (snap) => {
    mine = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.at) - ms(a.at));
    const box = $("#mine", r); box.textContent = "";
    $("#mineCount", r).textContent = mine.length ? `${mine.length}개` + (isOwner() ? "" : ` · 한 사람당 ${PER_PERSON}개까지`) : "";
    if (!mine.length) { box.appendChild(el("div", "empty", "아직 보낸 메시지가 없어요.")); return; }
    for (const m of mine) {
      const card = el("article", "msg-card" + (m.approved ? "" : " pending"));
      const tt = el("div", "tt"); const dot = el("span", "dot"); dot.style.background = THEME_DOT[m.theme] || "#999";
      tt.append(dot, el("span", null, "To. " + (m.to || "")), el("span", "pill " + (m.approved ? "ok" : "wait"), m.approved ? "상영 중" : "선생님 확인 중"));
      const ft = el("div", "ft"); ft.appendChild(el("span", null, "From. " + (m.from || "")));
      const del = el("button", "link-btn", "지우기"); del.type = "button";
      confirmButton(del, "지우기", "한 번 더 누르면 지워져요", () => F.deleteDoc(F.doc(msgsCol, m.id)));
      ft.appendChild(del);
      card.append(tt, el("p", null, m.text || ""), ft);
      box.appendChild(card);
    }
  }, () => { $("#mineCount", r).textContent = "목록을 불러오지 못했어요"; }));

  updateCount();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textI.value.trim();
    if (!text) { setStatus(st, "하고 싶은 말을 적어 주세요.", "err"); textI.focus(); return; }
    if (Array.from(text).length > 200) { setStatus(st, "200자 안으로 줄여 주세요.", "err"); return; }
    if (!isOwner() && mine.length >= PER_PERSON) { setStatus(st, `한 사람당 ${PER_PERSON}개까지 올릴 수 있어요. 아래에서 하나를 지우면 새로 쓸 수 있어요.`, "err"); return; }
    const from = fromI.value.trim().slice(0, 20) || "익명";
    storage.set("mt-from", fromI.value.trim().slice(0, 20));
    submit.disabled = true; setStatus(st, "올리는 중…");
    try {
      await F.addDoc(msgsCol, {
        to: toI.value.trim().slice(0, 20) || "친구들", from, text, theme: theme(),
        uid: user.uid, at: F.serverTimestamp(), approved: isOwner() ? true : !room.moderation,
      });
      setStatus(st, room.moderation && !isOwner() ? "올렸어요! 선생님이 확인하면 상영 화면에 나와요." : "올렸어요! 상영 화면에 곧 나와요.", "ok");
      toI.value = ""; textI.value = ""; updateCount(); renderPreview(false);
    } catch (err) {
      console.error(err);
      setStatus(st, room.open === false ? "지금은 메시지를 받지 않고 있어요." : "올리지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", "err");
    } finally { submit.disabled = room.open === false; }
  });
}

/* ---------- 선생님: 로그인 + 반 목록 ---------- */
async function requireTeacher(r) {
  await authReady;
  const u = auth.currentUser;
  if (!isTeacherUser(u)) return null;
  // 처음 로그인한 구글 계정이 사이트 관리자가 된다
  const adminRef = F.doc(db, "config", "admin");
  let snap = await F.getDoc(adminRef);
  if (!snap.exists()) {
    await F.setDoc(adminRef, { uid: u.uid, at: F.serverTimestamp() });
    snap = await F.getDoc(adminRef);
  }
  if (snap.data().uid !== u.uid) return false;
  return u;
}

async function signInGoogle(st) {
  const provider = new F.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await F.signInWithPopup(auth, provider); route(); }
  catch (err) {
    if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) { await F.signInWithRedirect(auth, provider); return; }
    if (err && err.code === "auth/unauthorized-domain") setStatus(st, "Firebase의 승인된 도메인에 이 사이트 주소가 아직 없어요.", "err");
    else if (err && err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") setStatus(st, "로그인하지 못했어요. 다시 눌러 주세요.", "err");
  }
}

async function viewTeacher() {
  const r = mount("tpl-teacher");
  const st = $("#loginStatus", r);
  $("#signIn", r).addEventListener("click", () => signInGoogle(st));
  $("#signOut", r).addEventListener("click", async () => { await F.signOut(auth); route(); });
  let u;
  try { u = await requireTeacher(r); } catch (err) { console.error(err); u = null; setStatus(st, "관리자 정보를 확인하지 못했어요. 새로고침해 주세요.", "err"); }
  if (u === false) {
    $("#signOut", r).hidden = false;
    fill(r, "who", `${auth.currentUser.email || "이 계정"}은(는) 이 사이트의 관리자 계정이 아니에요. 처음에 로그인했던 구글 계정으로 다시 로그인하세요.`);
    return;
  }
  if (!u) { $("#loginBox", r).hidden = false; fill(r, "who", "반을 만들면 학생용 반 코드와 QR이 생겨요."); return; }

  $("#signOut", r).hidden = false; $("#teacherBody", r).hidden = false;
  fill(r, "who", `${u.email || u.displayName || "선생님"} 계정으로 로그인했어요.`);

  const roomsBox = $("#rooms", r);
  onCleanup(F.onSnapshot(F.query(F.collection(db, "rooms"), F.where("ownerUid", "==", u.uid)), (snap) => {
    const list = snap.docs.map((d) => ({ code: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    roomsBox.textContent = "";
    $("#roomCount", r).textContent = list.length ? `${list.length}개` : "";
    if (!list.length) { roomsBox.appendChild(el("div", "empty", "아직 만든 반이 없어요. 아래에서 첫 반을 만들어 보세요.")); return; }
    for (const rm of list) {
      const card = el("article", "room");
      const h = el("h3", null, rm.title || "제목 없음");
      const meta = el("div", "row");
      meta.append(el("span", "code-chip", rm.code), el("span", "pill " + (rm.open === false ? "wait" : "ok"), rm.open === false ? "받기 닫힘" : "받는 중"));
      if (rm.moderation) meta.appendChild(el("span", "pill wait", "검토 후 상영"));
      const acts = el("div", "row");
      const a1 = el("a", "ghost", "관리"); a1.href = "#manage/" + rm.code;
      const a2 = el("a", "ghost", "▶ 상영"); a2.href = "#show/" + rm.code;
      acts.append(a1, a2);
      card.append(h, meta, acts); roomsBox.appendChild(card);
    }
  }, (err) => { console.error(err); roomsBox.textContent = ""; roomsBox.appendChild(el("div", "empty", "반 목록을 불러오지 못했어요. 새로고침해 주세요.")); }));

  $("#newRoom", r).addEventListener("submit", async (e) => {
    e.preventDefault();
    const ns = $("#nrStatus", r), title = $("#nrTitle", r).value.trim().slice(0, 40), sub = $("#nrSub", r).value.trim().slice(0, 80);
    if (!title) { setStatus(ns, "상영 제목을 적어 주세요.", "err"); return; }
    setStatus(ns, "만드는 중…");
    try {
      for (let tries = 0; tries < 6; tries++) {
        let code = ""; const rnd = crypto.getRandomValues(new Uint32Array(6));
        for (const n of rnd) code += CODE_CHARS[n % CODE_CHARS.length];
        const ref = F.doc(db, "rooms", code);
        if ((await F.getDoc(ref)).exists()) continue;
        await F.setDoc(ref, { ownerUid: u.uid, title, sub, open: true, moderation: $("#nrMod", r).checked, createdAt: F.serverTimestamp() });
        location.hash = "#manage/" + code;
        return;
      }
      setStatus(ns, "코드를 만들지 못했어요. 다시 눌러 주세요.", "err");
    } catch (err) { console.error(err); setStatus(ns, "반을 만들지 못했어요. 다시 눌러 주세요.", "err"); }
  });
}

/* ---------- 선생님: 반 관리 ---------- */
async function viewManage(code) {
  let u;
  try { u = await requireTeacher(); } catch { u = null; }
  if (!u) { location.hash = "#teacher"; return; }
  const roomRef = F.doc(db, "rooms", code);
  const first = await F.getDoc(roomRef).catch(() => null);
  if (!first || !first.exists() || first.data().ownerUid !== u.uid) return showMessage("반을 찾을 수 없어요", "이 계정에서 만든 반이 아니거나 지워진 반이에요.");

  const r = mount("tpl-manage");
  let room = first.data();
  const url = joinUrl(code);
  fill(r, "code", code); fill(r, "url", url);
  $('[data-f="qr"]', r).src = qrData(url);
  $('[data-f="showLink"]', r).href = "#show/" + code;
  $('[data-f="joinLink"]', r).href = "#join/" + code;
  $("#copyLink", r).addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(url); e.target.textContent = "복사했어요"; }
    catch { e.target.textContent = "주소를 길게 눌러 복사하세요"; }
    setTimeout(() => (e.target.textContent = "참여 주소 복사"), 2000);
  });
  const tOpen = $("#tOpen", r), tMod = $("#tMod", r), setT = $("#setTitle", r), setS = $("#setSub", r), sst = $("#setStatus", r);
  const renderRoom = () => {
    fill(r, "title", room.title || "제목 없음"); fill(r, "sub", room.sub || "");
    tOpen.textContent = room.open === false ? "메시지 받기: 닫힘" : "메시지 받기: 켜짐"; tOpen.classList.toggle("on", room.open !== false);
    tMod.textContent = room.moderation ? "검토 후 상영: 켜짐" : "검토 후 상영: 꺼짐"; tMod.classList.toggle("on", !!room.moderation);
    if (document.activeElement !== setT) setT.value = room.title || "";
    if (document.activeElement !== setS) setS.value = room.sub || "";
  };
  renderRoom();
  onCleanup(F.onSnapshot(roomRef, (s) => { if (s.exists()) { room = s.data(); renderRoom(); } }, () => {}));
  const upd = async (patch, okMsg) => {
    setStatus(sst, "저장하는 중…");
    try { await F.updateDoc(roomRef, patch); setStatus(sst, okMsg, "ok"); } catch (err) { console.error(err); setStatus(sst, "저장하지 못했어요. 다시 눌러 주세요.", "err"); }
  };
  tOpen.addEventListener("click", () => upd({ open: room.open === false }, room.open === false ? "다시 메시지를 받아요." : "메시지 받기를 닫았어요."));
  tMod.addEventListener("click", () => upd({ moderation: !room.moderation }, room.moderation ? "이제 학생 글이 바로 상영돼요." : "이제 승인한 글만 상영돼요."));
  $("#saveSettings", r).addEventListener("click", () => {
    const title = setT.value.trim().slice(0, 40);
    if (!title) { setStatus(sst, "상영 제목을 적어 주세요.", "err"); return; }
    upd({ title, sub: setS.value.trim().slice(0, 80) }, "제목을 저장했어요.");
  });

  let tab = "all", all = [];
  const msgsCol = F.collection(db, "rooms", code, "messages");
  const tabs = $("#tabs", r), box = $("#msgs", r), approveAll = $("#approveAll", r);
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    tab = b.dataset.tab; tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderList();
  });
  approveAll.addEventListener("click", async () => {
    approveAll.disabled = true;
    const waits = all.filter((m) => !m.approved);
    try {
      for (let i = 0; i < waits.length; i += 400) {
        const b = F.writeBatch(db);
        waits.slice(i, i + 400).forEach((m) => b.update(F.doc(msgsCol, m.id), { approved: true }));
        await b.commit();
      }
    } catch (err) { console.error(err); }
    approveAll.disabled = false;
  });
  function renderList() {
    const nWait = all.filter((m) => !m.approved).length, nOk = all.length - nWait;
    const labels = { all: `전체 ${all.length}`, wait: `검토 대기 ${nWait}`, ok: `상영 중 ${nOk}` };
    tabs.querySelectorAll("button").forEach((b) => (b.textContent = labels[b.dataset.tab]));
    approveAll.hidden = nWait === 0;
    const list = all.filter((m) => tab === "all" || (tab === "wait" ? !m.approved : m.approved));
    box.textContent = "";
    if (!list.length) { box.appendChild(el("div", "empty", tab === "wait" ? "검토할 메시지가 없어요." : "아직 메시지가 없어요. 학생들에게 반 코드를 알려 주세요.")); return; }
    for (const m of list) {
      const card = el("article", "msg-card" + (m.approved ? "" : " pending"));
      const tt = el("div", "tt"); const dot = el("span", "dot"); dot.style.background = THEME_DOT[m.theme] || "#999";
      tt.append(dot, el("span", null, "To. " + (m.to || "")), el("span", "pill " + (m.approved ? "ok" : "wait"), m.approved ? "상영 중" : "검토 대기"));
      const ft = el("div", "ft"); ft.appendChild(el("span", null, "From. " + (m.from || "")));
      const acts = el("div", "acts");
      const tog = el("button", "link-btn" + (m.approved ? "" : " good"), m.approved ? "상영에서 빼기" : "승인"); tog.type = "button";
      tog.addEventListener("click", async () => { tog.disabled = true; try { await F.updateDoc(F.doc(msgsCol, m.id), { approved: !m.approved }); } catch (err) { console.error(err); tog.disabled = false; } });
      const del = el("button", "link-btn", "삭제"); del.type = "button";
      confirmButton(del, "삭제", "한 번 더 누르면 삭제", () => F.deleteDoc(F.doc(msgsCol, m.id)));
      acts.append(tog, del); ft.appendChild(acts);
      card.append(tt, el("p", null, m.text || ""), ft);
      box.appendChild(card);
    }
  }
  onCleanup(F.onSnapshot(msgsCol, (snap) => {
    all = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.at) - ms(a.at));
    renderList();
  }, (err) => { console.error(err); box.textContent = ""; box.appendChild(el("div", "empty", "메시지를 불러오지 못했어요. 새로고침해 주세요.")); }));
}

/* ---------- 상영 ---------- */
const theaterEl = $("#theater");
const SPEED_K = { slow: 1.3, normal: 1, fast: 0.75 };
const INTRO_MS = 9000;
const GROUP_AT_MS = [300000, 600000]; // 한 바퀴가 5분 넘으면 2개씩, 10분 넘으면 3개씩
let theater = null, wakeLock = null, idleT = null;
const prefs = Object.assign({ speed: "normal", fit: 0, per: "auto", corner: true }, (() => { try { return JSON.parse(localStorage.getItem("mt-prefs") || "{}"); } catch { return {}; } })());
const savePrefs = () => { try { localStorage.setItem("mt-prefs", JSON.stringify(prefs)); } catch {} };
const player = { code: "", room: null, msgs: [], active: false, loaded: false, paused: false, timer: null, startedAt: 0, remaining: 0,
  plan: null, gi: -1, loopElapsed: 0, priority: [], seen: new Set(), stats: {}, recent: [] };

function joinInfo() { const url = joinUrl(player.code); return { code: player.code, url: shortUrl(), qr: qrData(url) }; }
const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
const loopLen = (groups, k) => groups.reduce((s, g) => s + groupDuration(g, k), 0);
const fmtMin = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? "1분 미만" : `약 ${m}분`; };

// 이 컴퓨터에서 메시지별로 몇 번, 언제 나왔는지 기억 (다음 바퀴에 덜 나온 것부터)
function loadStats(code) { try { return JSON.parse(localStorage.getItem("mt-stats-" + code) || "{}"); } catch { return {}; } }
function markShown(items) {
  const now = Date.now();
  for (const m of items) { const s = player.stats[m.id] || { n: 0, t: 0 }; s.n++; s.t = now; player.stats[m.id] = s; }
  player.recent = [...player.recent, ...items.map((m) => m.id)].slice(-6);
  try { localStorage.setItem("mt-stats-" + player.code, JSON.stringify(player.stats)); } catch {}
}
// 덜 나온 메시지 먼저, 같은 횟수끼리는 섞되 방금 나온 것은 뒤로
function orderedMessages() {
  const recent = new Set(player.recent);
  return player.msgs
    .map((m) => ({ m, n: player.stats[m.id]?.n || 0, late: recent.has(m.id) ? 1 : 0, r: Math.random() }))
    .sort((a, b) => a.n - b.n || a.late - b.late || a.r - b.r)
    .map((x) => x.m);
}
function makePlan() {
  const msgs = orderedMessages();
  const speedK = SPEED_K[prefs.speed] || 1;
  const fitMs = (+prefs.fit || 0) * 60000;
  const natural = loopLen(chunk(msgs, 1), fitMs ? 1 : speedK);
  const ruleN = natural <= GROUP_AT_MS[0] ? 1 : natural <= GROUP_AT_MS[1] ? 2 : 3;
  let n = prefs.per === "auto" ? ruleN : +prefs.per;
  let k = speedK, budget = 0;
  if (fitMs && msgs.length) {
    budget = Math.max(30000, fitMs - INTRO_MS);
    const cands = prefs.per === "auto" ? [1, 2, 3].filter((c) => c >= n) : [n];
    for (const c of cands) {
      n = c;
      const L = loopLen(chunk(msgs, n), 1);
      k = Math.min(1.6, Math.max(0.6, budget / L));
      if (L * 0.6 <= budget) break;
    }
  }
  const groups = chunk(msgs, n);
  const full = INTRO_MS + loopLen(groups, k);
  const truncated = !!budget && full > fitMs + 2000;
  return { groups, n, k, budget, est: truncated ? fitMs : full, truncated };
}
function updateInfo() {
  const p = player.plan, el2 = $("#cInfo");
  if (!p || !player.msgs.length) { el2.textContent = ""; return; }
  el2.textContent = `한 바퀴 ${fmtMin(p.est)} · ${p.n === 1 ? "1개씩" : p.n + "개씩"}` + (p.truncated ? " · 못 나온 메시지는 다음 바퀴에 먼저" : "");
}
function setPos(text) { $("#cPos").textContent = text; }

function startLoop() {
  player.plan = makePlan(); player.gi = -1; player.loopElapsed = 0;
  updateInfo();
  playSlide(introSlide(), INTRO_MS);
  setPos(`표지 · ${player.msgs.length}개`);
}
function introSlide() {
  const n = player.msgs.length, rm = player.room || {};
  return { kind: "intro", theme: "night", label: "MESSAGES", title: rm.title || "우리 반 메시지 상영관", sub: n ? rm.sub : "아직 도착한 메시지가 없어요. 첫 메시지를 남겨 주세요!", count: n ? `${n}개의 마음이 도착했어요` : "", join: rm.open === false ? null : joinInfo(), dur: n ? INTRO_MS : 12000 };
}
function playSlide(slide, _dur, fresh) {
  clearTimeout(player.timer);
  const dur = theater.show(slide, { fresh, bar: true });
  player.startedAt = performance.now(); player.remaining = dur;
  if (player.paused) theater.setPaused(true); else player.timer = setTimeout(next, dur);
  return dur;
}
function playItems(items, fresh) {
  const k = player.plan?.k || SPEED_K[prefs.speed] || 1;
  const slide = items.length === 1 ? { kind: "msg", ...items[0], k } : { kind: "group", items, k };
  const dur = playSlide(slide, 0, fresh);
  markShown(items);
  return dur;
}
const alive = (g) => g.map((m) => player.msgs.find((x) => x.id === m.id)).filter(Boolean);
function next() {
  if (!player.active) return;
  // 방금 도착한 메시지는 바로 다음에 혼자 크게
  while (player.priority.length) {
    const id = player.priority.shift(), m = player.msgs.find((x) => x.id === id);
    if (m) { player.loopElapsed += playItems([m], true); setPos("방금 도착"); return; }
  }
  const p = player.plan;
  if (!p) return startLoop();
  while (++player.gi < p.groups.length) {
    const g = alive(p.groups[player.gi]);
    if (!g.length) continue;
    const d = groupDuration(g, p.k);
    if (p.budget && player.gi > 0 && player.loopElapsed + d > p.budget + 2000) break; // 정한 시간이 다 됨
    player.loopElapsed += playItems(g);
    setPos(`${player.gi + 1} / ${p.groups.length} 화면`);
    return;
  }
  startLoop();
}
function prev() {
  if (!player.active || !player.plan) return;
  const p = player.plan;
  while (player.gi > 0) {
    const g = alive(p.groups[--player.gi]);
    if (g.length) { playItems(g); setPos(`${player.gi + 1} / ${p.groups.length} 화면`); return; }
  }
  startLoop();
}
function replan() {
  // 설정을 바꾸면 지금 화면이 끝난 뒤부터 새 계획으로 (이미 나온 메시지는 뒤로)
  if (!player.active || !player.loaded) return;
  player.plan = makePlan(); player.gi = -1; player.loopElapsed = 0; updateInfo();
}
function togglePause() {
  player.paused = !player.paused;
  $("#cPlay").textContent = player.paused ? "다시 재생" : "일시정지";
  theater.setPaused(player.paused);
  if (player.paused) { clearTimeout(player.timer); player.remaining = Math.max(0, player.remaining - (performance.now() - player.startedAt)); }
  else { player.startedAt = performance.now(); player.timer = setTimeout(next, player.remaining); }
}
function poke() { theaterEl.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => theaterEl.classList.add("idle"), 2800); }
function lockScreen() { try { navigator.wakeLock?.request("screen").then((l) => (wakeLock = l)).catch(() => {}); } catch {} }
function syncControls() {
  $("#cSpeed").value = prefs.speed; $("#cFit").value = String(prefs.fit); $("#cPer").value = String(prefs.per); $("#cCorner").checked = !!prefs.corner;
  $("#cSpeed").disabled = +prefs.fit > 0;
  $("#cSpeed").title = +prefs.fit > 0 ? "한 바퀴 시간을 정하면 속도는 자동으로 맞춰져요" : "";
}

async function viewShow(code) {
  let u;
  try { u = await requireTeacher(); } catch { u = null; }
  if (!u) { location.hash = "#teacher"; return; }
  const roomRef = F.doc(db, "rooms", code);
  const first = await F.getDoc(roomRef).catch(() => null);
  if (!first || !first.exists() || first.data().ownerUid !== u.uid) return showMessage("반을 찾을 수 없어요", "이 계정에서 만든 반이 아니거나 지워진 반이에요.");

  mount("tpl-msg"); fill(app, "title", "상영 중이에요"); fill(app, "body", "상영 화면을 닫으면 반 관리 화면으로 돌아가요.");
  Object.assign(player, { code, room: first.data(), msgs: [], priority: [], seen: new Set(), plan: null, gi: -1, loopElapsed: 0, paused: false, active: true, loaded: false, stats: loadStats(code), recent: [] });
  theaterEl.hidden = false;
  theater = new Stage($("#theaterStage"));
  theater.setCorner(prefs.corner && player.room.open !== false ? joinInfo() : null);
  $("#cPlay").textContent = "일시정지";
  syncControls(); updateInfo();
  playSlide(introSlide(), INTRO_MS); setPos("불러오는 중");
  lockScreen(); poke();
  onCleanup(() => {
    player.active = false; clearTimeout(player.timer); theaterEl.hidden = true;
    theater?.destroy(); theater = null;
    try { wakeLock?.release(); } catch {} wakeLock = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  });
  onCleanup(F.onSnapshot(roomRef, (s) => {
    if (!s.exists()) return;
    player.room = s.data();
    theater?.setCorner(prefs.corner && player.room.open !== false ? joinInfo() : null);
  }, () => {}));
  const q = F.query(F.collection(db, "rooms", code, "messages"), F.where("approved", "==", true));
  onCleanup(F.onSnapshot(q, (snap) => {
    const firstLoad = !player.loaded;
    player.msgs = snap.docs.map((d) => {
      const m = d.data();
      return { id: d.id, to: String(m.to || "").slice(0, 20), from: String(m.from || "").slice(0, 20), text: String(m.text || "").slice(0, 400), theme: THEMES.includes(m.theme) ? m.theme : "blossom", at: ms(m.at) };
    }).sort((a, b) => a.at - b.at);
    if (firstLoad) {
      player.loaded = true;
      player.msgs.forEach((m) => player.seen.add(m.id));
      startLoop();
      return;
    }
    for (const m of player.msgs) if (!player.seen.has(m.id)) { player.seen.add(m.id); player.priority.push(m.id); }
    updateInfo();
  }, (err) => { console.error(err); }));
}

$("#cExit").addEventListener("click", () => { location.hash = "#manage/" + player.code; });
$("#cNext").addEventListener("click", () => next());
$("#cPrev").addEventListener("click", prev);
$("#cPlay").addEventListener("click", togglePause);
$("#cSpeed").addEventListener("change", (e) => { prefs.speed = e.target.value; savePrefs(); replan(); });
$("#cFit").addEventListener("change", (e) => { prefs.fit = +e.target.value; savePrefs(); syncControls(); replan(); });
$("#cPer").addEventListener("change", (e) => { prefs.per = e.target.value; savePrefs(); replan(); });
$("#cCorner").addEventListener("change", (e) => { prefs.corner = e.target.checked; savePrefs(); theater?.setCorner(prefs.corner && player.room?.open !== false ? joinInfo() : null); });
$("#cFull").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else { try { theaterEl.requestFullscreen?.().catch(() => {}); } catch {} }
});
theaterEl.addEventListener("pointermove", poke);
theaterEl.addEventListener("pointerdown", poke);
document.addEventListener("keydown", (e) => {
  if (theaterEl.hidden) return;
  poke();
  if (e.target.closest && e.target.closest("select")) return;
  if (e.key === " ") { e.preventDefault(); togglePause(); }
  else if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
  else if (e.key === "Escape" && !document.fullscreenElement) $("#cExit").click();
  else if (e.key === "f" || e.key === "F") $("#cFull").click();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && player.active) lockScreen(); });

/* ---------- 라우터 ---------- */
function route() {
  const [name, arg] = location.hash.replace(/^#/, "").split("/");
  const code = normCode(arg);
  if (name === "join") return viewJoin(code);
  if (name === "teacher") return viewTeacher();
  if (name === "manage") return viewManage(code);
  if (name === "show") return viewShow(code);
  return viewHome();
}

async function boot() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return showMessage("사이트 준비 중이에요", "선생님이 저장소(Firebase) 연결을 마치면 반 코드를 입력할 수 있어요.");
  }
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js"),
    ]);
    F = { ...authMod, ...fsMod };
    const fbApp = appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(fbApp);
    db = fsMod.getFirestore(fbApp);
    authReady = new Promise((res) => { const off = authMod.onAuthStateChanged(auth, () => { off(); res(); }); });
    authMod.getRedirectResult(auth).catch(() => {});
  } catch (err) {
    console.error(err);
    return showMessage("연결하지 못했어요", "인터넷 연결을 확인하고 새로고침해 주세요.");
  }
  const c = normCode(new URLSearchParams(location.search).get("c"));
  if (validCode(c)) { history.replaceState(null, "", location.pathname + "#join/" + c); }
  window.addEventListener("hashchange", route);
  route();
}
boot();
