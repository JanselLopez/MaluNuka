// ---------- App: estado, pantallas, controles y sonido ----------
const $ = (id) => document.getElementById(id);
const cv = $("game"), ctx = cv.getContext("2d");
// Analítica anónima: GoatCounter cuenta visitas automáticamente y estos eventos
// distinguen el modo de juego y el progreso. La carga del contador es asíncrona.
function trackGameEvent(path, everyTime) {
  let tries = 0;
  const send = () => {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path, event: true, no_session: !!everyTime });
    } else if (++tries < 40) setTimeout(send, 250);
  };
  send();
}
const other = (r) => (r === "F" ? "B" : "F");
const WORLDS = { 1: "El pueblo", 2: "El glaciar", 3: "La montaña", 4: "La cueva de cristal", 5: "La tormenta", 6: "Bajo el hielo", 7: "La avalancha" };
const store = { unlocked: 1, best: {}, bestTime: {}, mute: false, skins: { F: "pinguino", B: "pinguino" } };
try { Object.assign(store, JSON.parse(localStorage.getItem("fyb:v1") || "{}")); } catch (e) {}
store.bestTime = store.bestTime || {};
store.skins = Object.assign({ F: "pinguino", B: "pinguino" }, store.skins || {});
store.freed = Object.assign({ pinguinos: true }, store.freed || {});
// se agregó "Columpio" como nivel 12: el progreso guardado de ahí en adelante se corre un lugar (una sola vez)
if ((store.layout || 1) < 2 && LEVELS[11] && LEVELS[11].name === "Columpio") {
  const shift = (o) => { const n = {}; for (const k in o || {}) n[+k >= 11 ? +k + 1 : k] = o[k]; return n; };
  store.best = shift(store.best); store.bestTime = shift(store.bestTime);
  if (store.unlocked > 11) store.unlocked += 1;
  store.layout = 2;
  try { localStorage.setItem("fyb:v1", JSON.stringify(store)); } catch (e) {}
}
// en qué nivel está enjaulada cada pareja (las que no tienen jaula están libres desde el inicio)
const PAIR_CAGE = {};
LEVELS.forEach((lv, i) => { if (lv.cage) PAIR_CAGE[lv.cage] = i; });
const isUnlocked = (id) => id === "pinguinos" || !!store.freed[id] || !(id in PAIR_CAGE);
const curPair = () => (isUnlocked(store.pair) ? pairById(store.pair) : PAIRS[0]);
function applyPair() { const p = curPair(); store.skins = { F: p.F, B: p.B }; }
applyPair();
function save() { try { localStorage.setItem("fyb:v1", JSON.stringify(store)); } catch (e) {} }
const fishTotal = (i) => LEVELS[i].rows.join("").split("*").length - 1;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const S = { mode: null, screen: "menu", L: null, lvl: 0, pengs: [], me: null, remote: null, partner: null,
  pk: 0, rs: 0, winT: 0, won: false, restartT: 0, particles: [], flakes: [], room: null, roomState: "pending", sent: "",
  camY: 0, runTime: 0, falls: 0 };
let view = { s: 1, ox: 0, oy: 0, dpr: 1 };

// ---------- Pantallas ----------
const SCREENS = ["menu", "lobby", "levelsScreen", "pause", "win", "charsScreen", "helpScreen"];
function showScreen(name) {
  S.screen = name;
  for (const s of SCREENS) $(s).hidden = s !== (name === "levels" ? "levelsScreen" : name === "chars" ? "charsScreen" : name === "help" ? "helpScreen" : name);
  const inGame = name === "play" || name === "pause" || name === "win";
  $("hud").hidden = !inGame;
  $("controls").hidden = name !== "play";
  document.body.classList.toggle("playing", inGame);
  $("net").hidden = S.mode !== "online";
  if (name === "levels") openMap();
  if (name === "chars") buildCharsScreen();
  if (name === "help") buildHelp();
  resize();
}

function buildLevelGrid() {
  const g = $("levelGrid"); g.innerHTML = "";
  $("levelsTitle").textContent = S.mode === "online" ? "Niveles · en línea" : "Niveles";
  let world = 0;
  LEVELS.forEach((lv, i) => {
    if (lv.world !== world) {
      world = lv.world;
      const h = document.createElement("div"); h.className = "world-h";
      h.textContent = `Mundo ${world} · ${WORLDS[world]}`; g.appendChild(h);
    }
    const b = document.createElement("button");
    b.className = "lvl"; b.id = "lvl" + i;
    b.disabled = i + 1 > store.unlocked;
    const best = store.best[i], bt = store.bestTime[i];
    b.innerHTML = `<span class="n">Nivel ${i + 1}</span><span class="t"></span><span class="s"></span>`;
    b.querySelector(".t").textContent = lv.name;
    b.querySelector(".s").textContent = b.disabled ? "Bloqueado" : best == null ? "Sin jugar" : `Peces ${best}/${fishTotal(i)}${bt ? ` · ${fmtTime(bt)}` : ""}`;
    b.onclick = () => pickLevel(i);
    g.appendChild(b);
  });
}

// ---------- Elegir personaje ----------
function buildCharsScreen() {
  const grid = $("pairGrid"); grid.innerHTML = "";
  for (const pr of PAIRS) {
    const b = document.createElement("button"), free = isUnlocked(pr.id);
    b.className = "pair"; b.dataset.pair = pr.id; b.dataset.locked = free ? "" : "1"; b.disabled = !free;
    b.setAttribute("aria-pressed", String(free && curPair().id === pr.id));
    b.innerHTML = '<canvas width="240" height="120"></canvas><span></span><span class="sub"></span>';
    b.querySelector("span").textContent = pr.name;
    b.querySelector(".sub").textContent = !free ? `En una jaula del nivel ${PAIR_CAGE[pr.id] + 1}` : Monet.pairNeedsAd(pr.id) ? "Rescatada · tócala para usarla" : pr.F === pr.B ? "Los dos iguales" : "Ella y él";
    b.onclick = () => {
      // la primera vez que eligen una pareja rescatada: ver un anuncio o quitar los anuncios
      if (Monet.pairNeedsAd(pr.id)) return openGate({ kind: "pair", pair: pr.id, done: () => { buildCharsScreen(); [...$("pairGrid").children].find((x) => x.dataset.pair === pr.id).click(); } });
      store.pair = pr.id; applyPair(); save();
      grid.querySelectorAll(".pair").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      S.sent = ""; paintPickCanvases(); unlockAudio(); SFX.lever();
    };
    grid.appendChild(b);
  }
}
function paintCharPreviews(t) {
  document.querySelectorAll("#charsScreen .pair").forEach((b, i) => {
    const c = b.querySelector("canvas").getContext("2d"), on = b.getAttribute("aria-pressed") === "true";
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 240, 120);
    c.setTransform(4, 0, 0, 4, 0, 0);
    const locked = !!b.dataset.locked;
    drawPair(c, pairById(b.dataset.pair), 30, 27, locked ? 0.5 + i * 0.3 : t + i * 0.7, { walk: on, caged: locked, scale: locked ? 0.95 : 1 });
  });
}
const skinFor = (p) => (p.remote ? (partnerP() && partnerP().sk) || "pinguino" : curPair()[p.id]);

// ---------- Niveles ----------
function loadLevel(i) {
  S.lvl = i;
  S.L = parseLevel(LEVELS[i], i);
  buildCaches(S.L, view.cache);
  const roles = S.mode === "online" ? [S.me] : ["F", "B"];
  S.pengs = roles.map((r) => newPenguin(r, S.L.starts[r]));
  S.remote = null;
  if (S.mode === "online") { const o = other(S.me); S.remote = Object.assign(newPenguin(o, S.L.starts[o]), { remote: true, visible: false, seen: false }); }
  S.winT = 0; S.won = false; S.restartT = 0; S.particles = [];
  S.tgLocal = 0; S.tgRemote = 0;
  const pr0 = typeof partnerP === "function" ? partnerP() : null;
  S.seenTh = pr0 && pr0.th || 0; S.seenLd = pr0 && pr0.ld || 0; S.seenSw = pr0 && pr0.sw || 0;
  $("hudTitle").textContent = `${i + 1}. ${LEVELS[i].name}`;
  if (S.L.cage && store.freed[S.L.cage.kind]) { S.L.cage.open = true; S.L.cage.t = 99; }
  $("hudTime").hidden = !S.L.def.timeLimit;
  if (S.mode) buildControls();
  updateFishHud();
  updateCamera(0, true);
}
function pickLevel(i, paid) {
  // primer nivel de los mundos 2 a 7: aviso de anuncio o "sin anuncios" (en línea, solo para quien elige)
  if (!paid && Monet.worldNeedsAd(i)) return openGate({ kind: "world", level: i, done: () => pickLevel(i, true) });
  if (S.mode === "online") S.pk = Math.max(S.pk, partnerP()?.pk || 0) + 1;
  S.runTime = 0; S.falls = 0;
  const mode = S.mode === "online" ? "en-linea" : "solo";
  trackGameEvent(`jugador-${mode}`);
  trackGameEvent(`partida-iniciada-${mode}`, true);
  loadLevel(i); showScreen("play"); keepAwake();
  S.sent = ""; sendPresence(true); // que la pareja se entere al instante
}
// Reinicia el nivel; si alguien ya tocó una bandera, vuelven ahí con los peces y la llave que tenían.
function restartLevel() {
  const old = S.L, keep = S.screen;
  const cp = old ? old.cp : -1, fish = old ? old.fish.map((f) => f.got) : [], key = old && old.key ? old.key.holder : null;
  loadLevel(S.lvl);
  if (cp >= 0) {
    const c = S.L.checkpoints.find((k) => k.i === cp);
    S.L.cp = cp;
    S.L.fish.forEach((f, i) => (f.got = !!fish[i]));
    if (S.L.key && key) S.L.key.holder = key;
    // cada uno en un lugar libre, sin pared y sin quedar encima del otro
    const placed = [];
    for (const p of [...S.pengs, ...(S.remote ? [S.remote] : [])]) {
      const offs = p.id === "F" ? [-9, 9, 0, -18, 18, -27, 27, -36, 36] : [9, -9, 0, 18, -18, 27, -27, 36, -36];
      const free = offs.filter((k) => !blocked(S.L, p, c.x - PW / 2 + k, c.y - PH, null));
      const o = free.find((k) => placed.every((x) => Math.abs(c.x - PW / 2 + k - x) >= 14)) ?? free[0] ?? 0;
      p.x = c.x - PW / 2 + o; p.y = c.y - PH; p.prevX = p.x; p.prevY = p.y; placed.push(p.x);
    }
    if (S.L.ball) { S.L.ball.x = c.x - 300; S.L.ball.y = c.y - S.L.ball.r; S.L.ball.t = S.L.ball.delay - 1.5; }
    updateFishHud(); updateCamera(0, true);
  }
  if (keep !== "pause") showScreen("play");
}
function requestRestart() {
  if (S.mode === "online") S.rs = Math.max(S.rs, partnerP()?.rs || 0) + 1;
  restartLevel();
}
function updateFishHud() {
  if (!S.L) return;
  $("hudFish").textContent = `${S.L.fish.filter((f) => f.got).length}/${S.L.fish.length}`;
}
function win() {
  S.won = true;
  trackGameEvent(`nivel-completado-${S.mode === "online" ? "en-linea" : "solo"}-nivel-${S.lvl + 1}`, true);
  if (S.L.ball) S.L.ball.stop = true;
  const got = S.L.fish.filter((f) => f.got).length;
  store.best[S.lvl] = Math.max(store.best[S.lvl] || 0, got);
  if (!store.bestTime[S.lvl] || S.runTime < store.bestTime[S.lvl]) store.bestTime[S.lvl] = Math.max(1, Math.round(S.runTime));
  store.unlocked = Math.max(store.unlocked, Math.min(LEVELS.length, S.lvl + 2));
  save(); SFX.win();
  const last = S.lvl === LEVELS.length - 1, nextWorld = !last && LEVELS[S.lvl + 1].world !== LEVELS[S.lvl].world;
  $("winTitle").textContent = last ? "¡Llegaron a la cima!" : nextWorld ? `¡Mundo ${LEVELS[S.lvl].world} completo!` : "¡Llegaron al iglú!";
  $("winText").textContent = `Peces ${got} de ${S.L.fish.length} · Tiempo ${fmtTime(S.runTime)} · Caídas ${S.falls}` +
    (nextWorld ? `. Sigue: ${WORLDS[LEVELS[S.lvl + 1].world]}.` : last ? ". Malu y Nuka están orgullosos." : "");
  $("wNext").hidden = last;
  if (S.L.cage && !S.L.cage.open) $("winText").textContent += " Alguien sigue en una jaula en este nivel.";
  setTimeout(() => { if (S.won && S.screen === "play") showScreen("win"); }, 450);
}

// ---------- Entrada ----------
const keys = new Set();
const touch = { F: { l: 0, r: 0, j: 0, g: 0 }, B: { l: 0, r: 0, j: 0, g: 0 } };
const pendJ = { F: false, B: false }, prevJ = { F: false, B: false };
const pendG = { F: false, B: false }, prevG = { F: false, B: false };
const pointers = new Map();
const KEYMAP = { KeyA: ["F", "l"], KeyD: ["F", "r"], KeyW: ["F", "j"], KeyS: ["F", "g"],
  ArrowLeft: ["B", "l"], ArrowRight: ["B", "r"], ArrowUp: ["B", "j"], ArrowDown: ["B", "g"], Space: ["B", "j"] };
function inputFor(id) {
  const src = (r, k) => (touch[r][k] ? 1 : 0) || Object.entries(KEYMAP).some(([code, [rr, kk]]) => kk === k && keys.has(code) && (S.mode === "online" || rr === r));
  const j = src(id, "j"), jp = pendJ[id] || (j && !prevJ[id]);
  const g = src(id, "g"), gp = pendG[id] || (g && !prevG[id]);
  prevJ[id] = j; pendJ[id] = false; prevG[id] = g; pendG[id] = false;
  return { l: src(id, "l"), r: src(id, "r"), j, jp, g, gp };
}
addEventListener("keydown", (e) => {
  if (e.code === "Escape" && S.screen === "play") { showScreen("pause"); return; }
  const m = KEYMAP[e.code];
  if (!m || S.screen !== "play") return;
  e.preventDefault();
  if (m[1] === "j" && !keys.has(e.code)) pendJ[S.mode === "online" ? S.me : m[0]] = true;
  if (m[1] === "g" && !keys.has(e.code)) pendG[S.mode === "online" ? S.me : m[0]] = true;
  keys.add(e.code); unlockAudio();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

const ICON = {
  l: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.5 3 5 10l8.5 7z"/></svg>',
  r: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.5 3 15 10l-8.5 7z"/></svg>',
  j: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5 17.5 11H12.5v6.5h-5V11H2.5z"/></svg>',
  g: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="4.6" r="1.9"/><path d="M10 6.6v10M6.4 9.6h7.2M3.8 12.6c.9 2.7 3.3 4 6.2 4s5.3-1.3 6.2-4"/></svg>',
};
function buildControls() {
  const grab = !!(S.L && (S.L.rope || S.L.def.grab || S.L.def.throw || S.L.def.air));
  const label = { l: "Izquierda", r: "Derecha", j: "Saltar", g: "Agarrar" };
  const key = (p, k) => `<button class="key${k === "j" ? " jump" : ""}${k === "g" ? " grab" : ""}" data-p="${p}" data-k="${k}" aria-label="${label[k]} ${P_NAME[p]}">${ICON[k]}</button>`;
  const g = (p) => (grab ? key(p, "g") : "");
  // joystick: aparece donde se apoya el dedo dentro de su zona; solo importa izquierda/derecha
  const stick = (p) => `<div class="stick" data-p="${p}" aria-label="Moverse ${P_NAME[p]}"><div class="stick-base"><div class="stick-knob"></div></div></div>`;
  $("controls").innerHTML = S.mode === "local"
    ? `<div class="pad F">${stick("F")}${key("F", "j")}${g("F")}<span class="pad-label">Malu</span></div><div class="pad B"><span class="pad-label">Nuka</span>${g("B")}${key("B", "j")}${stick("B")}</div>`
    : `<div class="pad ${S.me}">${stick(S.me)}</div><div class="pad ${S.me}">${g(S.me)}${key(S.me, "j")}</div>`;
  $("controls").classList.toggle("solo", S.mode !== "local");
  pointers.clear(); refreshTouch();
}
// el botón bajo el dedo; si cae en un hueco o justo al lado, el más cercano (hasta ~1/2 botón de distancia)
function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const st = el && el.closest && el.closest(".stick");
  if (st) return { p: st.dataset.p, stick: true, el: st, x0: x, y0: y, dir: 0 };
  let k = el && el.closest && el.closest(".key");
  if (!k) {
    let best = null, bd = Infinity;
    for (const c of document.querySelectorAll("#controls .key")) {
      const r = c.getBoundingClientRect(), dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = c; }
    }
    if (best && bd <= best.getBoundingClientRect().height * 0.6) k = best;
  }
  return k ? { p: k.dataset.p, k: k.dataset.k, el: k } : null;
}
const buzz = () => { try { navigator.vibrate && navigator.vibrate(6); } catch (e) {} };
function refreshTouch() {
  for (const p of ["F", "B"]) touch[p] = { l: 0, r: 0, j: 0, g: 0 };
  document.querySelectorAll(".key.on").forEach((k) => k.classList.remove("on"));
  for (const h of pointers.values()) {
    if (!h) continue;
    if (h.stick) { if (h.dir) touch[h.p][h.dir < 0 ? "l" : "r"] = 1; continue; }
    touch[h.p][h.k] = 1; h.el.classList.add("on");
  }
}
$("controls").addEventListener("pointerdown", (e) => {
  e.preventDefault(); unlockAudio();
  const h = keyAt(e.clientX, e.clientY);
  pointers.set(e.pointerId, h);
  if (h && h.stick) placeStick(h, e.clientX, e.clientY);
  if (h) buzz();
  if (h && h.k === "j") pendJ[h.p] = true;
  if (h && h.k === "g") pendG[h.p] = true;
  refreshTouch();
});
addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  const old = pointers.get(e.pointerId);
  // el dedo del joystick sigue siendo joystick aunque se salga de su zona
  if (old && old.stick) { const d = old.dir; moveStick(old, e.clientX); if (old.dir !== d) refreshTouch(); return; }
  const h = keyAt(e.clientX, e.clientY);
  if (h && h.stick) return;
  if ((h && h.el) === (old && old.el)) return;
  pointers.set(e.pointerId, h);
  if (h && h.k === "j" && !(old && old.k === "j")) pendJ[h.p] = true;
  if (h && h.k === "g" && !(old && old.k === "g")) pendG[h.p] = true;
  refreshTouch();
}, { passive: true });
const endPointer = (e) => { const h = pointers.get(e.pointerId); if (h && h.stick) resetStick(h.el); if (pointers.delete(e.pointerId)) refreshTouch(); };
function placeStick(h, x, y) {
  const r = h.el.getBoundingClientRect(), base = h.el.querySelector(".stick-base");
  base.style.left = (x - r.left) + "px"; base.style.top = (y - r.top) + "px"; h.el.classList.add("on");
  moveStick(h, x);
}
function moveStick(h, x) {
  const dx = x - h.x0, max = 34, knob = h.el.querySelector(".stick-knob");
  knob.style.transform = `translate(calc(-50% + ${Math.max(-max, Math.min(max, dx))}px), -50%)`;
  const dir = dx < -12 ? -1 : dx > 12 ? 1 : 0;
  if (dir && dir !== h.dir) buzz();
  h.dir = dir;
}
function resetStick(el) {
  el.classList.remove("on"); const base = el.querySelector(".stick-base"), knob = el.querySelector(".stick-knob");
  base.style.left = ""; base.style.top = ""; knob.style.transform = "";
}
addEventListener("pointerup", endPointer);
addEventListener("pointercancel", endPointer);
$("controls").addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- Sonido ----------
let AC = null;
function unlockAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === "suspended") AC.resume().catch(() => {});
}
function tone(f, d, type, v, f2) {
  if (!AC || store.mute) return;
  const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + d + 0.02);
}
const SFX = {
  jump: () => tone(420, 0.12, "square", 0.035, 720),
  swim: () => tone(300, 0.15, "sine", 0.06, 520),
  fish: () => { tone(880, 0.08, "triangle", 0.06); setTimeout(() => tone(1320, 0.12, "triangle", 0.06), 70); },
  press: () => tone(220, 0.08, "square", 0.035, 330),
  release: () => tone(330, 0.08, "square", 0.025, 200),
  die: () => tone(360, 0.4, "sawtooth", 0.05, 70),
  caught: () => { tone(988, 0.09, "square", 0.04); setTimeout(() => tone(988, 0.14, "square", 0.04), 140); },
  chomp: () => { tone(160, 0.12, "sawtooth", 0.07, 60); setTimeout(() => tone(120, 0.12, "sawtooth", 0.06, 50), 130); },
  grab: () => tone(180, 0.06, "triangle", 0.06, 140),
  crack: () => tone(900, 0.05, "square", 0.02, 500),
  smash: () => tone(500, 0.18, "sawtooth", 0.03, 120),
  key: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.1, "triangle", 0.06), i * 60)),
  flag: () => [523, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, "triangle", 0.06), i * 90)),
  boing: () => tone(260, 0.3, "triangle", 0.07, 880),
  swap: () => { tone(520, 0.18, "sine", 0.06, 1240); setTimeout(() => tone(1240, 0.18, "sine", 0.05, 520), 90); },
  lever: () => tone(740, 0.06, "square", 0.04, 520),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.07), i * 110)),
};
function paintMute() {
  $("btnMute").innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z"/>${store.mute
    ? '<path d="m13 7 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    : '<path d="M13 7a4 4 0 0 1 0 6M15 5a7 7 0 0 1 0 10" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>'}</svg>`;
  $("btnMute").setAttribute("aria-label", store.mute ? "Activar sonido" : "Silenciar");
}

// ---------- Efectos ----------
function burst(x, y, n, color, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
    S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: 0.5 + Math.random() * 0.4, t: 0, color, s: 1.2 + Math.random() * 1.6 });
  }
}
for (let i = 0; i < 55; i++) S.flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 8 + Math.random() * 16, d: Math.random() * 6, s: 0.6 + Math.random() * 1.1 });
function updateFx(dt, t) {
  for (const p of S.particles) { p.t += dt; p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  S.particles = S.particles.filter((p) => p.t < p.life);
  for (const f of S.flakes) { f.y += f.v * dt; f.x += Math.sin(t * 0.8 + f.d) * 6 * dt; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } }
}
function handleEvents(ev) {
  for (const [k, a] of ev) {
    if (k === "jump" && !a.remote) SFX.jump();
    else if (k === "swim") { SFX.swim(); burst(a.x + PW / 2, a.y + PH / 2, 5, "#cfeaf7", 50); }
    else if (k === "fish") { SFX.fish(); burst(a.x, a.y, 10, "#ffe08a", 70); updateFishHud(); }
    else if (k === "press") SFX.press();
    else if (k === "release") SFX.release();
    else if (k === "grab") { SFX.grab(); burst(a.x + PW / 2 + a.cling * 7, a.y + PH / 2, 4, "#eef6fb", 40); }
    else if (k === "crack") SFX.crack();
    else if (k === "shake") { SFX.crack(); setTimeout(() => SFX.crack(), 120); }
    else if (k === "boing") { SFX.boing(); burst(a.x + PW / 2, a.y + PH, 10, "#ffe08a", 90); }
    else if (k === "swap") { SFX.swap(); burst(a.x + PW / 2, a.y + PH / 2, 14, "#e07bff", 90); }
    else if (k === "lever") SFX.lever();
    else if (k === "shareAir") { SFX.swim(); burst(a.x + PW / 2, a.y, 10, "#dff8ff", 60); }
    else if (k === "rescue") rescue(a.kind, a.x + T / 2, a.y);
    else if (k === "caught") { SFX.caught(); burst(a.x + PW / 2, a.y + PH / 2, 12, "#bfe8ff", 60); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} }
    else if (k === "chomp") SFX.chomp();
    else if (k === "break") { SFX.smash(); burst((a % S.L.C) * T + T / 2, Math.floor(a / S.L.C) * T + 4, 10, "#bfe3f2", 80); }
    else if (k === "shatter") { SFX.smash(); burst(a.x + T / 2, a.y + T, 10, "#dff4ff", 90); }
    else if (k === "key") { SFX.key(); burst(a.x + PW / 2, a.y, 12, "#ffd166", 80); }
    else if (k === "checkpoint") { SFX.flag(); burst(a.x + 6, a.y - 18, 12, "#7fe3c7", 70); }
    else if (k === "die") {
      SFX.die(); burst(a.x + PW / 2, a.y + PH / 2, 18, a.eaten ? "#dff8ff" : P_COLOR[a.id], 110);
      try { navigator.vibrate && navigator.vibrate(120); } catch (e) {}
      S.falls++;
      if (S.mode === "online") S.rs = Math.max(S.rs, partnerP()?.rs || 0) + 1;
      if (!S.restartT) S.restartT = a.eaten ? 1.4 : 0.8; // si se lo comió el rape, que se vea el mordisco
    }
  }
}

// ---------- Rescates ----------
function rescue(kind, x, y) {
  const ch = pairById(kind);
  const isNew = !store.freed[kind];
  store.freed[kind] = true; save();
  burst(x, y, 18, "#ff7eb6", 90); SFX.key();
  if (isNew) toast(`¡Rescataron ${ch.who}! Ya pueden elegirlos en Personajes.`);
  S.rescued = (S.rescued || 0) + 1;
}
let toastTimer = 0;
function toast(text) {
  const el = $("toast"); el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

// ---------- Mapa ----------
const MAP = { step: 86, pad: 70, h: 240, x: 0, sel: 0, drag: null };
const WORLD_LOOK = {
  1: ["#1d3a5c", "#2d5a80", "#7fe3c7"], 2: ["#123f5a", "#2b6f8f", "#8fd3ef"], 3: ["#1b2f4a", "#3d5576", "#f3f8fb"],
  4: ["#22183f", "#3d2d6a", "#b892ff"], 5: ["#171f30", "#2c3a54", "#ffd166"], 6: ["#082f4b", "#0f5a7c", "#6fe0c0"], 7: ["#2a3d55", "#6f8ea8", "#ff8b4a"],
};
const nodeX = (i) => MAP.pad + i * MAP.step;
const nodeY = (i) => MAP.h / 2 + 10 + Math.sin(i * 0.9) * 52;
const mapWidth = () => MAP.pad * 2 + (LEVELS.length - 1) * MAP.step;
function openMap() {
  MAP.sel = Math.min(LEVELS.length - 1, Math.max(0, store.unlocked - 1));
  const cv = $("mapCanvas"), vw = cv.clientWidth || 600, k = MAP.h / (cv.clientHeight || MAP.h);
  MAP.x = Math.max(0, Math.min(mapWidth() - vw * k, nodeX(MAP.sel) - (vw * k) / 2));
  showMapInfo();
}
function showMapInfo() {
  const i = MAP.sel, lv = LEVELS[i], open = i + 1 <= store.unlocked, best = store.best[i], bt = store.bestTime[i];
  $("mapName").textContent = `${i + 1}. ${lv.name}`;
  const bits = [`Mundo ${lv.world} · ${WORLDS[lv.world]}`];
  if (!open) bits.push("Bloqueado");
  else bits.push(best == null ? "Sin jugar" : `Peces ${Math.min(best, fishTotal(i))}/${fishTotal(i)}${bt ? " · " + fmtTime(bt) : ""}`);
  if (lv.cage) bits.push(store.freed[lv.cage] ? `Rescataron ${pairById(lv.cage).who}` : "Hay una pareja en una jaula");
  if (lv.ball) bits.push("Avalancha");
  if (lv.timeLimit) bits.push(`${lv.timeLimit} s`);
  $("mapStats").textContent = bits.join(" · ");
  $("mapPlay").disabled = !open;
}
function drawMap(t) {
  const cv = $("mapCanvas"), dpr = Math.min(devicePixelRatio || 1, 2), cw = cv.clientWidth, ch = cv.clientHeight;
  if (!cw || !ch) return;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const c = cv.getContext("2d"), k = (ch / MAP.h) * dpr, vw = cw / (ch / MAP.h);
  MAP.x = Math.max(0, Math.min(Math.max(0, mapWidth() - vw), MAP.x));
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(k, 0, 0, k, -MAP.x * k, 0);
  // paisajes de cada mundo
  let i0 = 0;
  while (i0 < LEVELS.length) {
    const w = LEVELS[i0].world; let i1 = i0; while (i1 + 1 < LEVELS.length && LEVELS[i1 + 1].world === w) i1++;
    const x0 = i0 === 0 ? 0 : nodeX(i0) - MAP.step / 2, x1 = i1 === LEVELS.length - 1 ? mapWidth() : nodeX(i1) + MAP.step / 2;
    drawRegion(c, w, x0, x1, t);
    c.fillStyle = "rgba(8,17,28,.55)"; rrect(c, x0 + 8, 8, Math.min(x1 - x0 - 16, 190), 22, 11); c.fill();
    c.fillStyle = WORLD_LOOK[w][2]; c.font = "600 12px Fredoka, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText(`Mundo ${w} · ${WORLDS[w]}`, x0 + 18, 19.5);
    i0 = i1 + 1;
  }
  // el camino
  c.lineCap = "round";
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const done = store.best[i] != null;
    c.strokeStyle = done ? "rgba(127,227,199,.85)" : "rgba(243,248,251,.35)"; c.lineWidth = 4; c.setLineDash(done ? [] : [2, 8]);
    c.beginPath(); c.moveTo(nodeX(i), nodeY(i));
    c.quadraticCurveTo((nodeX(i) + nodeX(i + 1)) / 2, (nodeY(i) + nodeY(i + 1)) / 2 - 18, nodeX(i + 1), nodeY(i + 1)); c.stroke();
  }
  c.setLineDash([]);
  // paradas
  for (let i = 0; i < LEVELS.length; i++) {
    const x = nodeX(i), y = nodeY(i), open = i + 1 <= store.unlocked, done = store.best[i] != null, cur = open && !done, look = WORLD_LOOK[LEVELS[i].world];
    if (i === MAP.sel) { c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.arc(x, y, 25 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2); c.fill(); }
    if (cur) { c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 20 + (t * 14) % 8, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(x, y + 16, 15, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = !open ? "#3a4a5c" : done ? look[2] : "#f3f8fb"; c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(8,17,28,.35)"; c.lineWidth = 2; c.stroke();
    c.fillStyle = !open ? "#9fb0c0" : "#08111c"; c.font = "700 14px Fredoka, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    if (open) c.fillText(String(i + 1), x, y + 1);
    else { c.fillStyle = "#9fb0c0"; rrect(c, x - 5, y - 2, 10, 8, 2); c.fill(); c.strokeStyle = "#9fb0c0"; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 2, 3.4, Math.PI, 0); c.stroke(); }
    if (LEVELS[i].cage) {
      const cx = x + 14, cy = y - 15;
      if (store.freed[LEVELS[i].cage]) { c.fillStyle = "#ff7eb6"; c.beginPath(); c.arc(cx - 2, cy, 2.6, 0, Math.PI * 2); c.arc(cx + 2, cy, 2.6, 0, Math.PI * 2); c.moveTo(cx - 4.6, cy + 1); c.lineTo(cx, cy + 6); c.lineTo(cx + 4.6, cy + 1); c.fill(); }
      else { c.fillStyle = "rgba(8,17,28,.7)"; rrect(c, cx - 6, cy - 6, 12, 12, 3); c.fill(); c.strokeStyle = "#c9d6e0"; c.lineWidth = 1.2; c.beginPath(); for (let b = -3; b <= 3; b += 3) { c.moveTo(cx + b, cy - 4); c.lineTo(cx + b, cy + 4); } c.stroke(); }
    }
  }
  // los personajes, parados en la parada elegida
  const sx = nodeX(MAP.sel), sy = nodeY(MAP.sel) - 16;
  for (const [team, dx] of [["F", -9], ["B", 9]]) {
    const kind = curPair()[team];
    drawCharacter(c, kind, team, sx + dx - PW / 2, sy - PH, team === "F" ? 1 : -1, { t: t + (team === "B" ? 0.5 : 0) });
  }
}
function drawRegion(c, w, x0, x1, t) {
  const look = WORLD_LOOK[w], g = c.createLinearGradient(0, 0, 0, MAP.h);
  g.addColorStop(0, look[0]); g.addColorStop(1, look[1]);
  c.fillStyle = g; c.fillRect(x0, 0, x1 - x0, MAP.h);
  const r = rng(w * 97), W2 = x1 - x0;
  if (w === 6) {
    c.fillStyle = "rgba(200,240,255,.18)"; c.fillRect(x0, 34, W2, 3);
    for (let i = 0; i < 14; i++) { const bx = x0 + r() * W2, by = MAP.h - ((t * 18 + r() * MAP.h) % (MAP.h - 40)); c.strokeStyle = "rgba(220,248,255,.45)"; c.lineWidth = 1; c.beginPath(); c.arc(bx, by, 2 + r() * 3, 0, Math.PI * 2); c.stroke(); }
    for (let i = 0; i < 4; i++) { const fx = x0 + ((r() * W2 + t * 12 * (i % 2 ? 1 : -1)) % W2 + W2) % W2, fy = 60 + r() * 140; c.fillStyle = "rgba(127,227,199,.35)"; ell(c, fx, fy, 6, 3); c.beginPath(); c.moveTo(fx + 5, fy); c.lineTo(fx + 10, fy - 3); c.lineTo(fx + 10, fy + 3); c.fill(); }
    return;
  }
  // montañas o colinas al fondo
  c.fillStyle = "rgba(255,255,255," + (w === 5 ? 0.06 : 0.12) + ")"; c.beginPath(); c.moveTo(x0, MAP.h);
  for (let x = x0; x <= x1 + 40; x += 40) c.lineTo(x, MAP.h - 40 - r() * (w === 3 ? 120 : 60));
  c.lineTo(x1, MAP.h); c.closePath(); c.fill();
  c.fillStyle = "rgba(243,248,251,.85)"; c.fillRect(x0, MAP.h - 14, W2, 14);
  if (w === 1) for (let i = 0; i < 4; i++) { const ix = x0 + 30 + r() * (W2 - 60), iy = MAP.h - 14; c.fillStyle = "#e9f4fa"; c.beginPath(); c.arc(ix, iy, 13, Math.PI, 0); c.fill(); c.fillStyle = "#0e2236"; c.beginPath(); c.arc(ix, iy, 5, Math.PI, 0); c.fill(); }
  if (w === 2) for (let i = 0; i < 9; i++) { const ix = x0 + r() * W2, hh = 18 + r() * 30; c.fillStyle = "rgba(190,235,250,.55)"; c.beginPath(); c.moveTo(ix - 8, MAP.h - 14); c.lineTo(ix, MAP.h - 14 - hh); c.lineTo(ix + 8, MAP.h - 14); c.fill(); }
  if (w === 4) for (let i = 0; i < 10; i++) { const ix = x0 + r() * W2, hh = 14 + r() * 26; c.fillStyle = i % 2 ? "rgba(184,146,255,.6)" : "rgba(224,123,255,.5)"; c.beginPath(); c.moveTo(ix - 6, MAP.h - 14); c.lineTo(ix, MAP.h - 14 - hh); c.lineTo(ix + 6, MAP.h - 14); c.fill(); }
  if (w === 5) { for (let i = 0; i < 5; i++) { const cx = x0 + r() * W2, cy = 50 + r() * 30; c.fillStyle = "rgba(160,175,200,.25)"; ell(c, cx, cy, 34, 12); ell(c, cx + 20, cy - 6, 22, 10); } if ((t * 0.7) % 3 < 0.08) { c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(x0, 0, W2, MAP.h); } }
  if (w === 7) { const bx = x0 + ((t * 30) % W2), by = MAP.h - 14 - 18; c.fillStyle = "#f3f8fb"; c.beginPath(); c.arc(bx, by, 18, 0, Math.PI * 2); c.fill(); c.strokeStyle = "rgba(140,170,195,.6)"; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 9, t * 3, t * 3 + 2); c.stroke(); }
  for (let i = 0; i < 18; i++) { c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(x0 + r() * W2, (r() * MAP.h + t * 10 * (0.5 + r())) % MAP.h, 1.4, 1.4); }
}
(function mapInput() {
  const cv = $("mapCanvas");
  const toMap = (e) => { const r = cv.getBoundingClientRect(), k = MAP.h / r.height; return { x: (e.clientX - r.left) * k + MAP.x, y: (e.clientY - r.top) * k }; };
  cv.addEventListener("pointerdown", (e) => { MAP.drag = { id: e.pointerId, x0: e.clientX, mx: MAP.x, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    const d = MAP.drag; if (!d || d.id !== e.pointerId) return;
    const k = MAP.h / cv.getBoundingClientRect().height, dx = e.clientX - d.x0;
    if (Math.abs(dx) > 6) d.moved = true;
    if (d.moved) MAP.x = d.mx - dx * k;
  });
  cv.addEventListener("pointerup", (e) => {
    const d = MAP.drag; MAP.drag = null; if (!d || d.moved) return;
    const p = toMap(e);
    for (let i = 0; i < LEVELS.length; i++) if (Math.hypot(p.x - nodeX(i), p.y - nodeY(i)) < 36) { MAP.sel = i; showMapInfo(); SFX.lever(); unlockAudio(); break; }
  });
  cv.addEventListener("pointercancel", () => (MAP.drag = null));
  $("mapLeft").onclick = () => (MAP.x -= 300);
  $("mapRight").onclick = () => (MAP.x += 300);
  $("mapPlay").onclick = () => { if (MAP.sel + 1 <= store.unlocked) pickLevel(MAP.sel); };
})();

// ---------- Cómo jugar ----------
const KB = (k, txt) => `<span class="kb">${ICON[k]}${txt ? " " + txt : ""}</span>`;
const HELP = [
  ["Controles", null, () => `En el celular cada uno usa su lado: Malu a la izquierda y Nuka a la derecha. ${KB("l")}${KB("r")} para moverse, ${KB("j", "Saltar")} y ${KB("g", "Agarrar")} (aparece en los niveles que lo usan). En compu: Malu con <b>A D</b>, <b>W</b> salta y <b>S</b> agarra; Nuka con las flechas (<b>↓</b> agarra).`],
  ["La meta", null, () => "Los dos tienen que entrar al iglú. Los peces son un extra. Las banderas guardan el avance, pero solo si llegan los dos juntos."],
  ["Subirse a la cabeza", "stack", () => `Salta encima de tu pareja y desde ahí vuelve a saltar con ${KB("j")}: alcanzas repisas de 3 bloques que ninguno alcanza solo.`],
  ["Lanzar a tu pareja", "throw", () => `En los niveles con lanzamiento: con tu pareja parada en tu cabeza, toca ${KB("g", "Agarrar")} y sale volando bien alto hacia donde miras.`],
  ["Cuerda: anclarse", "anchor", () => `Mantén ${KB("g", "Agarrar")} con los pies en el suelo: quedas anclado y tu pareja puede colgar de la cuerda sin arrastrarte. En hielo resbaloso no se puede anclar.`],
  ["Cuerda: jalar", "reel", () => `Anclado, mantén también ${KB("j", "Saltar")}: recoges la cuerda y tu pareja sube, aunque tenga una pared delante. Al soltar, la cuerda vuelve a su largo.`],
  ["Columpiarse", "swing", () => `Colgando de la cuerda, empuja ${KB("l")} y luego ${KB("r")} para tomar impulso; en lo más alto del vaivén llegas a la repisa.`],
  ["Pegarse a la pared", "cling", () => `En el aire junto a una pared, mantén ${KB("g", "Agarrar")}: te quedas pegado un momento (el circulito es tu fuerza). Toca ${KB("j", "Saltar")} para impulsarte hacia arriba y al otro lado.`],
  ["Botones y puertas", null, () => "Un botón abre la puerta de su color mientras alguien lo pisa. Si tiene reloj, la deja abierta unos segundos. El botón grande necesita a los dos encima."],
  ["Balancín, cristal y palanca", null, () => "Cae desde alto sobre un lado del balancín y tu pareja sale volando del otro: más alto, más fuerte. El cristal morado los cambia de lugar. La palanca cambia qué bloques de color existen."],
  ["Viento, linterna y hielo", null, () => "El viento sopla hacia arriba solo mientras alguien pisa su botón. El hielo fantasma solo aparece cerca de la linterna de Malu. El hielo celeste resbala y el agrietado se rompe al pisarlo."],
  ["Bajo el agua", "swim", () => `${KB("j", "Saltar")} es nadar hacia arriba; mantén ${KB("g", "Agarrar")} para bucear. La barrita es tu aire: se llena en la superficie y en las burbujas. Toca ${KB("g")} junto a tu pareja para compartir el aire.`],
  ["Peligros del mar", null, () => "Las corrientes te arrastran. No toques las medusas. Si la luz del rape te alcanza un momento, te congela y viene a comerte: espera detrás de las rocas a que pase."],
  ["La avalancha y el reloj", null, () => "La bola gigante nunca se detiene: si se quedan atrás, los aplasta. En los niveles con reloj, lleguen al iglú antes de que llegue a cero."],
  ["Parejas en jaulas", null, () => "En algunos niveles hay una pareja encerrada fuera del camino. Llegar cuesta trabajo extra en equipo; tóquenla y podrán elegirla en Personajes."],
  ["Jugar en línea", null, () => "Uno toca Crear sala y le pasa el código (o el enlace) a su pareja; el otro escribe el código y toca Unirse. Cada uno maneja su personaje desde su teléfono."],
];
function buildHelp() {
  const g = $("helpGrid"); if (g.childElementCount) return;
  for (const [title, ill, text] of HELP) {
    const d = document.createElement("div"); d.className = "help-item";
    d.innerHTML = `<h3>${title}</h3>${ill ? `<canvas width="264" height="132" data-ill="${ill}"></canvas>` : ""}<p>${text()}</p>`;
    g.appendChild(d);
  }
}
// dibujitos animados de cada movimiento, con la pareja elegida (personajes a escala chica)
function paintHelp(t) {
  const pr = curPair(), SC = 0.62, HEAD = PH * SC;
  document.querySelectorAll("#helpGrid canvas").forEach((cvs) => {
    const c = cvs.getContext("2d"), k = cvs.width / 66, ill = cvs.dataset.ill;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cvs.width, cvs.height); c.setTransform(k, 0, 0, k, 0, 0);
    // personaje parado con los pies en (x, y)
    const ch = (team, x, y, face, o) => {
      c.save(); c.translate(x, y); c.scale(SC, SC);
      drawCharacter(c, pr[team], team, -PW / 2, -PH, face, Object.assign({ t: t + (team === "B" ? 0.7 : 0) }, o || {}));
      c.restore();
    };
    const block = (x0, x1, y) => { c.fillStyle = "#22476b"; c.fillRect(x0, y, x1 - x0, 40 - y); c.fillStyle = "#eef6fb"; c.fillRect(x0, y - 0.8, x1 - x0, 1.6); };
    const rope = (ax, ay, bx, by, sag) => { c.strokeStyle = "#e0c08e"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); c.stroke(); };
    const arrow = (x, y, txt) => { c.fillStyle = "rgba(255,255,255,.75)"; c.font = "700 6px Fredoka, sans-serif"; c.textAlign = "center"; c.fillText(txt, x, y); };
    const ease = (v) => v * v * (3 - 2 * v);
    if (ill === "stack") {
      // Nuka abajo, Malu salta a su cabeza y de ahí a la repisa alta
      block(0, 66, 31); block(44, 66, 12);
      const ph = (t * 0.45) % 1;
      ch("B", 26, 31, 1);
      if (ph < 0.25) { const q = ease(ph / 0.25); ch("F", 12 + q * 14, 31 - q * HEAD - Math.sin(q * Math.PI) * 8, 1, { air: q < 1 }); }
      else if (ph < 0.5) ch("F", 26, 31 - HEAD, 1);
      else if (ph < 0.75) { const q = ease((ph - 0.5) / 0.25); ch("F", 26 + q * 26, 31 - HEAD - q * (19 - HEAD + 0) - Math.sin(q * Math.PI) * 9, 1, { air: q < 1 }); }
      else ch("F", 52, 12, 1);
    } else if (ill === "throw") {
      block(0, 66, 31); block(46, 66, 6);
      const ph = (t * 0.45) % 1;
      ch("B", 18, 31, 1, { anchor: ph > 0.3 && ph < 0.36 });
      if (ph < 0.3) ch("F", 18, 31 - HEAD, 1);
      else if (ph < 0.7) { const q = (ph - 0.3) / 0.4; ch("F", 18 + q * 36, 31 - HEAD - q * (25 - HEAD) - Math.sin(q * Math.PI) * 14, 1, { air: true }); }
      else ch("F", 54, 6, 1);
      if (ph > 0.28 && ph < 0.45) arrow(24, 10, "¡hop!");
    } else if (ill === "anchor" || ill === "reel") {
      block(0, 30, 14); c.fillStyle = "#1a3a58"; c.fillRect(30, 14, 6, 26);
      const reel = ill === "reel", ph = (t * 0.4) % 1;
      const by = reel ? 34 - ease(Math.min(1, ph / 0.8)) * 20 : 34 + Math.sin(t * 2) * 1;
      const bx = reel && by < 16 ? 33 - (16 - by) * 0.6 : 41;
      ch("F", 20, 14, 1, { anchor: true });
      rope(22, 10, bx, by - HEAD + 3, reel ? 1 : 5);
      ch("B", bx, by, -1, { air: true });
      if (reel) arrow(50, 18, "↑");
    } else if (ill === "swing") {
      block(0, 18, 12); block(52, 66, 12);
      const a = Math.sin(t * 2.2) * 1.0, px = 15 + Math.sin(a) * 19, py = 7 + Math.cos(a) * 19;
      ch("F", 10, 12, 1, { anchor: true });
      rope(12, 8, px, py - HEAD + 3, 0);
      ch("B", px, py, a > 0 ? 1 : -1, { air: true });
    } else if (ill === "cling") {
      block(0, 66, 31); c.fillStyle = "#22476b"; c.fillRect(46, 0, 20, 31); c.fillStyle = "rgba(160,210,240,.25)"; c.fillRect(46, 0, 1.2, 31);
      const ph = (t * 0.5) % 1;
      if (ph < 0.65) ch("F", 41.5, 22, 1, { cling: 1, stamina: (1 - ph / 0.65 * 0.8) * PHYS.cling });
      else { const q = (ph - 0.65) / 0.35; ch("F", 41.5 - q * 16, 22 - Math.sin(q * Math.PI) * 10 + q * 9, -1, { air: true }); }
    } else if (ill === "swim") {
      c.fillStyle = "rgba(64,150,210,.45)"; c.fillRect(0, 7, 66, 33); c.fillStyle = "rgba(200,235,250,.7)"; c.fillRect(0, 7, 66, 1);
      const y = 26 + Math.sin(t * 2) * 3;
      ch("F", 20, y, 1, { wet: true }); ch("B", 40, y + 2, -1, { wet: true });
      for (let i = 0; i < 5; i++) { const by2 = 32 - ((t * 9 + i * 5) % 24); c.strokeStyle = "rgba(220,248,255,.8)"; c.lineWidth = 0.5; c.beginPath(); c.arc(56 + Math.sin(t * 3 + i) * 1.5, by2, 0.9 + (i % 2) * 0.5, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = "#3b5a75"; c.beginPath(); c.ellipse(56, 33, 4, 2, 0, Math.PI, 0); c.fill();
      const air = 0.3 + 0.6 * (0.5 + Math.sin(t * 0.8) * 0.5);
      c.fillStyle = "rgba(8,17,28,.6)"; rrect(c, 11, y - 18, 18, 3, 1.5); c.fill(); c.fillStyle = air > 0.45 ? "#7fd8ff" : "#ff6b6b"; rrect(c, 11.5, y - 17.5, 17 * air, 2, 1); c.fill();
    }
  });
}
