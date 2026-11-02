// El juego dentro de la app: estado, niveles, simulación, en línea, cámara y dibujo.
// Es una copia fiel de la web (src/04-app.js y src/06-loop.js) sin las páginas HTML:
// los menús los pone React Native y todo se dibuja con el mismo código de la web sobre Skia.
const makeWebGame = require("./web-game");
const { makeCanvas2D } = require("./canvas2d");

const WORLDS = { 1: "El pueblo", 2: "El glaciar", 3: "La montaña", 4: "La cueva de cristal", 5: "La tormenta", 6: "Bajo el hielo", 7: "La avalancha" };
const WORLD_LOOK = {
  1: ["#1d3a5c", "#2d5a80", "#7fe3c7"], 2: ["#123f5a", "#2b6f8f", "#8fd3ef"], 3: ["#1b2f4a", "#3d5576", "#f3f8fb"],
  4: ["#22183f", "#3d2d6a", "#b892ff"], 5: ["#171f30", "#2c3a54", "#ffd166"], 6: ["#082f4b", "#0f5a7c", "#6fe0c0"], 7: ["#2a3d55", "#6f8ea8", "#ff8b4a"],
};
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// opts: { Skia, enums, fonts(fam, weight, size), saved (objeto guardado), save(json), makeRoom(code, host), sfx, vibrate(ms), pixelRatio }
function createGame(opts) {
  const { Ctx, OffCanvas } = makeCanvas2D(opts.Skia, opts.enums);
  const G = makeWebGame({ createElement: () => new OffCanvas(opts.fonts) });
  const { LEVELS, T, W, H, PW, PH, PHYS, P_COLOR, P_NAME, rng, parseLevel, newPenguin, updateWorld, applyCarry, stepPenguin, ropeStep, coopEvents,
    launch, blocked, teleport, seesawAt, ell, rrect, buildCaches, drawKey, drawDynamic, drawWater, drawAurora, drawRope, drawBall,
    PAIRS, pairById, drawPair, drawCharacter, drawPenguin } = G;
  const sfx = new Proxy(opts.sfx || {}, { get: (o, k) => o[k] || (() => {}) });
  const vibrate = opts.vibrate || (() => {});
  const buzz = () => vibrate(6);
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());

  // ---------- progreso guardado ----------
  const store = { unlocked: 1, best: {}, bestTime: {}, mute: false, skins: { F: "pinguino", B: "pinguino" } };
  Object.assign(store, opts.saved || {});
  store.bestTime = store.bestTime || {};
  store.skins = Object.assign({ F: "pinguino", B: "pinguino" }, store.skins || {});
  store.freed = Object.assign({ pinguinos: true }, store.freed || {});
  const PAIR_CAGE = {};
  LEVELS.forEach((lv, i) => { if (lv.cage) PAIR_CAGE[lv.cage] = i; });
  const isUnlocked = (id) => id === "pinguinos" || !!store.freed[id] || !(id in PAIR_CAGE);
  const curPair = () => (isUnlocked(store.pair) ? pairById(store.pair) : PAIRS[0]);
  const applyPair = () => { const p = curPair(); store.skins = { F: p.F, B: p.B }; };
  applyPair();
  const save = () => { try { opts.save && opts.save(JSON.stringify(store)); } catch (e) {} };
  const fishTotal = (i) => LEVELS[i].rows.join("").split("*").length - 1;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const other = (r) => (r === "F" ? "B" : "F");

  const S = { mode: null, screen: "menu", L: null, lvl: 0, pengs: [], me: null, remote: null, partner: null,
    pk: 0, rs: 0, winT: 0, won: false, restartT: 0, particles: [], flakes: [], room: null, roomState: "none", sent: "",
    camY: 0, camX: 0, runTime: 0, falls: 0, toast: null, toastT: 0, hud: { fish: "", time: "", low: false }, result: null };
  let view = { s: 1, ox: 0, oy: 0, w: W, h: H, ctrlH: 0 };

  function showScreen(name) {
    if (name === "menu" && S.screen !== "menu") demo(); // en el menú, el primer nivel de fondo
    S.screen = name; emit();
  }
  const skinFor = (p) => (p.remote ? (partnerP() && partnerP().sk) || "pinguino" : curPair()[p.id]);
  function toast(text) { S.toast = text; S.toastT = 3.2; emit(); }

  // ---------- niveles ----------
  function cacheScale() { return Math.min(3, view.s * (opts.pixelRatio || 1)); }
  function loadLevel(i) {
    S.lvl = i;
    S.L = parseLevel(LEVELS[i], i);
    buildCaches(S.L, cacheScale());
    const roles = S.mode === "online" ? [S.me] : ["F", "B"];
    S.pengs = roles.map((r) => newPenguin(r, S.L.starts[r]));
    S.remote = null;
    if (S.mode === "online") { const o = other(S.me); S.remote = Object.assign(newPenguin(o, S.L.starts[o]), { remote: true, visible: false, seen: false }); }
    S.winT = 0; S.won = false; S.restartT = 0; S.particles = [];
    S.tgLocal = 0; S.tgRemote = 0;
    const pr0 = partnerP();
    S.seenTh = (pr0 && pr0.th) || 0; S.seenLd = (pr0 && pr0.ld) || 0; S.seenSw = (pr0 && pr0.sw) || 0;
    if (S.L.cage && store.freed[S.L.cage.kind]) { S.L.cage.open = true; S.L.cage.t = 99; }
    clearInput();
    updateHud();
    updateCamera(0, true);
  }
  function pickLevel(i) {
    if (S.mode === "online") S.pk = Math.max(S.pk, (partnerP() && partnerP().pk) || 0) + 1;
    S.runTime = 0; S.falls = 0; S.result = null;
    loadLevel(i); showScreen("play");
    S.sent = ""; sendPresence(true);
  }
  // reinicia el nivel; si alguien ya tocó una bandera, vuelven ahí con los peces y la llave que tenían
  function restartLevel() {
    const old = S.L, keep = S.screen;
    const cp = old ? old.cp : -1, fish = old ? old.fish.map((f) => f.got) : [], key = old && old.key ? old.key.holder : null;
    loadLevel(S.lvl);
    if (cp >= 0) {
      const c = S.L.checkpoints.find((k) => k.i === cp);
      S.L.cp = cp;
      S.L.fish.forEach((f, i) => (f.got = !!fish[i]));
      if (S.L.key && key) S.L.key.holder = key;
      const placed = [];
      for (const p of [...S.pengs, ...(S.remote ? [S.remote] : [])]) {
        const offs = p.id === "F" ? [-9, 9, 0, -18, 18, -27, 27, -36, 36] : [9, -9, 0, 18, -18, 27, -27, 36, -36];
        const free = offs.filter((k) => !blocked(S.L, p, c.x - PW / 2 + k, c.y - PH, null));
        const o = free.find((k) => placed.every((x) => Math.abs(c.x - PW / 2 + k - x) >= 14)) ?? free[0] ?? 0;
        p.x = c.x - PW / 2 + o; p.y = c.y - PH; p.prevX = p.x; p.prevY = p.y; placed.push(p.x);
      }
      if (S.L.ball) { S.L.ball.x = c.x - 300; S.L.ball.y = c.y - S.L.ball.r; S.L.ball.t = S.L.ball.delay - 1.5; }
      updateHud(); updateCamera(0, true);
    }
    if (keep !== "pause") showScreen("play");
  }
  function requestRestart() {
    if (S.mode === "online") S.rs = Math.max(S.rs, (partnerP() && partnerP().rs) || 0) + 1;
    restartLevel();
  }
  function updateHud() {
    if (!S.L) return;
    const fish = `${S.L.fish.filter((f) => f.got).length}/${S.L.fish.length}`;
    let time = "", low = false;
    if (S.L.def.timeLimit) { const left = Math.max(0, S.L.def.timeLimit - S.L.time); time = fmtTime(Math.ceil(left)); low = left < 10; }
    if (fish !== S.hud.fish || time !== S.hud.time || low !== S.hud.low) { S.hud = { fish, time, low }; emit(); }
  }
  function win() {
    S.won = true;
    if (S.L.ball) S.L.ball.stop = true;
    const got = S.L.fish.filter((f) => f.got).length;
    store.best[S.lvl] = Math.max(store.best[S.lvl] || 0, got);
    if (!store.bestTime[S.lvl] || S.runTime < store.bestTime[S.lvl]) store.bestTime[S.lvl] = Math.max(1, Math.round(S.runTime));
    store.unlocked = Math.max(store.unlocked, Math.min(LEVELS.length, S.lvl + 2));
    save(); sfx.win();
    const last = S.lvl === LEVELS.length - 1, nextWorld = !last && LEVELS[S.lvl + 1].world !== LEVELS[S.lvl].world;
    let text = `Peces ${got} de ${S.L.fish.length} · Tiempo ${fmtTime(S.runTime)} · Caídas ${S.falls}` +
      (nextWorld ? `. Sigue: ${WORLDS[LEVELS[S.lvl + 1].world]}.` : last ? ". Malu y Nuka están orgullosos." : "");
    if (S.L.cage && !S.L.cage.open) text += " Alguien sigue en una jaula en este nivel.";
    S.result = { title: last ? "¡Llegaron a la cima!" : nextWorld ? `¡Mundo ${LEVELS[S.lvl].world} completo!` : "¡Llegaron al iglú!", text, next: !last };
    setTimeout(() => { if (S.won && S.screen === "play") showScreen("win"); }, 450);
  }

  // ---------- entrada (la app escribe en touch y pend*) ----------
  const touch = { F: { l: 0, r: 0, j: 0, g: 0 }, B: { l: 0, r: 0, j: 0, g: 0 } };
  const pendJ = { F: false, B: false }, prevJ = { F: false, B: false };
  const pendG = { F: false, B: false }, prevG = { F: false, B: false };
  function clearInput() { for (const p of ["F", "B"]) { touch[p] = { l: 0, r: 0, j: 0, g: 0 }; pendJ[p] = pendG[p] = prevJ[p] = prevG[p] = false; } }
  function inputFor(id) {
    const t = touch[id], j = !!t.j, jp = pendJ[id] || (j && !prevJ[id]);
    const g = !!t.g, gp = pendG[id] || (g && !prevG[id]);
    prevJ[id] = j; pendJ[id] = false; prevG[id] = g; pendG[id] = false;
    return { l: t.l ? 1 : 0, r: t.r ? 1 : 0, j, jp, g, gp };
  }
  const NO_INPUT = { l: 0, r: 0, j: 0, jp: false, g: 0 };
  const needsGrab = () => !!(S.L && (S.L.rope || S.L.def.grab || S.L.def.throw || S.L.def.air));

  // ---------- efectos ----------
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
    if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) { S.toast = null; emit(); } }
  }
  function handleEvents(ev) {
    for (const [k, a] of ev) {
      if (k === "jump" && !a.remote) sfx.jump();
      else if (k === "swim") { sfx.swim(); burst(a.x + PW / 2, a.y + PH / 2, 5, "#cfeaf7", 50); }
      else if (k === "fish") { sfx.fish(); burst(a.x, a.y, 10, "#ffe08a", 70); updateHud(); }
      else if (k === "press") sfx.press();
      else if (k === "release") sfx.release();
      else if (k === "grab") { sfx.grab(); burst(a.x + PW / 2 + a.cling * 7, a.y + PH / 2, 4, "#eef6fb", 40); }
      else if (k === "crack") sfx.crack();
      else if (k === "shake") { sfx.crack(); setTimeout(() => sfx.crack(), 120); }
      else if (k === "boing") { sfx.boing(); burst(a.x + PW / 2, a.y + PH, 10, "#ffe08a", 90); }
      else if (k === "swap") { sfx.swap(); burst(a.x + PW / 2, a.y + PH / 2, 14, "#e07bff", 90); }
      else if (k === "lever") sfx.lever();
      else if (k === "shareAir") { sfx.swim(); burst(a.x + PW / 2, a.y, 10, "#dff8ff", 60); }
      else if (k === "rescue") rescue(a.kind, a.x + T / 2, a.y);
      else if (k === "caught") { sfx.caught(); burst(a.x + PW / 2, a.y + PH / 2, 12, "#bfe8ff", 60); vibrate(60); }
      else if (k === "chomp") sfx.chomp();
      else if (k === "break") { sfx.smash(); burst((a % S.L.C) * T + T / 2, Math.floor(a / S.L.C) * T + 4, 10, "#bfe3f2", 80); }
      else if (k === "shatter") { sfx.smash(); burst(a.x + T / 2, a.y + T, 10, "#dff4ff", 90); }
      else if (k === "key") { sfx.key(); burst(a.x + PW / 2, a.y, 12, "#ffd166", 80); }
      else if (k === "checkpoint") { sfx.flag(); burst(a.x + 6, a.y - 18, 12, "#7fe3c7", 70); }
      else if (k === "die") {
        sfx.die(); burst(a.x + PW / 2, a.y + PH / 2, 18, a.eaten ? "#dff8ff" : P_COLOR[a.id], 110);
        vibrate(120);
        S.falls++;
        if (S.mode === "online") S.rs = Math.max(S.rs, (partnerP() && partnerP().rs) || 0) + 1;
        if (!S.restartT) S.restartT = a.eaten ? 1.4 : 0.8; // si se lo comió el rape, que se vea el mordisco
      }
    }
  }
  function rescue(kind, x, y) {
    const ch = pairById(kind), isNew = !store.freed[kind];
    store.freed[kind] = true; save();
    burst(x, y, 18, "#ff7eb6", 90); sfx.key();
    if (isNew) toast(`¡Rescataron ${ch.who}! Ya pueden elegirlos en Personajes.`);
  }

  // ---------- simulación ----------
  function allPengs() { return S.remote && S.remote.visible ? [...S.pengs, S.remote] : S.pengs; }
  function step(dt) {
    const L = S.L, ev = [];
    for (const p of [...S.pengs, ...(S.remote ? [S.remote] : [])]) { p.prevX = p.x; p.prevY = p.y; }
    if (S.remote) updateRemote(dt);
    const all = allPengs();
    updateWorld(L, all, dt, ev);
    const order = [...S.pengs].sort((a, b) => (a.support && a.support.k === "p" ? 1 : 0) - (b.support && b.support.k === "p" ? 1 : 0));
    const frozen = S.screen !== "play";
    for (const p of order) {
      if (p.dead) continue;
      applyCarry(L, p);
      stepPenguin(L, p, frozen ? NO_INPUT : inputFor(p.id), all, dt, ev);
    }
    if (L.rope) { const pair = S.mode === "online" ? [S.pengs[0], S.remote] : S.pengs; ropeStep(L, pair[0], pair[1], dt); }
    coopEvents(L, S.pengs, ev, S, S.mode === "online" ? S.remote : null);
    handleEvents(ev);
    if (!S.won) S.runTime += dt;
    if (L.def.timeLimit && !S.won && !S.restartT && L.time > L.def.timeLimit) {
      for (const p of S.pengs) if (!p.dead) { p.dead = true; ev.length = 0; handleEvents([["die", p]]); }
    }
    if (S.restartT > 0) { S.restartT -= dt; if (S.restartT <= 0) { S.restartT = 0; restartLevel(); return; } }
    const both = S.mode === "online"
      ? S.pengs[0].inExit && S.remote && S.remote.visible && S.remote.inExit
      : S.pengs.every((p) => p.inExit && !p.dead);
    S.winT = both && !S.restartT ? S.winT + dt : 0;
    if (S.winT > 0.35 && !S.won) win();
  }

  // ---------- en línea ----------
  // la sala (src/online.ts) conecta los dos teléfonos directo por WebRTC; aquí va el mismo protocolo que la web
  const partnerP = () => S.partner || null;
  const SALA_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const newCode = () => Array.from({ length: 4 }, () => SALA_ABC[Math.floor(Math.random() * SALA_ABC.length)]).join("");
  function openCodeRoom(code, host) {
    leaveRoom();
    S.roomState = "pending"; S.salaCode = code; S.salaHost = host; S.connected = false; S.partner = null; S.sent = "";
    const room = opts.makeRoom(code, host);
    S.room = room;
    room.start(
      () => { if (S.room !== room) return; S.connected = true; S.roomState = "ready"; S.sent = ""; if (!S.me) pickRole(host ? "F" : "B"); emit(); },
      () => { if (S.room !== room) return; scanPeers(); lobbyChanged(); }, // llega ~30 veces por segundo: solo avisa si algo visible cambió
      (err) => {
        if (S.room !== room) return;
        if (err === "unavailable-id" && host) { openCodeRoom(newCode(), true); return; } // código ocupado: otro
        leaveRoom(); S.roomState = "error"; S.roomErr = err; emit();
      });
    emit();
  }
  function leaveRoom() {
    if (S.room && S.room.close) S.room.close();
    S.room = null; S.partner = null; S.connected = false; S.roomState = "none"; S.salaCode = null; S.salaHost = false;
  }
  function pickRole(r) { S.me = r; S.sent = ""; sendPresence(); scanPeers(); emit(); }
  function scanPeers() {
    if (!S.room) return;
    const list = S.room.peers().filter((p) => p && p.v === 1 && p.sc !== "menu");
    S.partner = list.find((p) => p.r && p.r !== S.me) || list[0] || null;
    const pr = partnerP();
    if (!pr || S.mode !== "online" || !S.me) return;
    const tie = pr.pk === S.pk && pr.lv !== S.lvl && S.me === "B";
    if (pr.r !== S.me && typeof pr.lv === "number" && pr.lv >= 0 && pr.lv < LEVELS.length && (pr.pk > S.pk || tie)) {
      S.pk = pr.pk; S.rs = Math.max(S.rs, pr.rs || 0); S.runTime = 0; S.falls = 0; S.result = null;
      loadLevel(pr.lv); showScreen("play");
      return;
    }
    if (pr.pk === S.pk && (pr.rs || 0) > S.rs && S.L) {
      S.rs = pr.rs; S.falls++;
      if (S.remote && S.remote.visible) burst(S.remote.x + PW / 2, S.remote.y + PH / 2, 18, P_COLOR[S.remote.id], 110);
      if (!S.restartT) { sfx.die(); S.restartT = 0.6; }
    }
  }
  function updateRemote(dt) {
    const r = S.remote, pr = partnerP(), L = S.L;
    const ok = pr && pr.r !== S.me && pr.sc === "play" && pr.pk === S.pk && typeof pr.x === "number";
    r.visible = !!ok && !pr.d;
    if (!ok) { r.seen = false; return; }
    if (!r.seen || Math.hypot(pr.x - r.x, pr.y - r.y) > 48) { r.x = pr.x; r.y = pr.y; r.seen = true; r.prevX = r.x; r.prevY = r.y; }
    else { const k = Math.min(1, dt * 18); r.x += (pr.x - r.x) * k; r.y += (pr.y - r.y) * k; }
    r.face = pr.f || 1; r.onGround = !!pr.og; r.vx = pr.vx || 0; r.vy = pr.vy || 0; r.wet = !!pr.w; r.inExit = !!pr.ex; r.anim += dt;
    r.anchor = !!pr.an; r.reel = !!pr.rl; r.cling = pr.cl || 0; r.stamina = pr.st == null ? PHYS.cling : pr.st; r.squash = 0;
    if (pr.rs === S.rs) {
      if (typeof pr.fm === "number") L.fish.forEach((f, i) => { if (!f.got && pr.fm & (1 << i)) { f.got = true; burst(f.x, f.y, 8, "#ffe08a", 60); updateHud(); } });
      if (pr.ky && L.key && !L.key.holder) { L.key.holder = r.id; sfx.key(); }
    }
    if (typeof pr.cp === "number" && pr.cp > L.cp) L.cp = pr.cp;
    if (pr.rc && L.cage && !L.cage.open) { L.cage.open = true; L.cage.t = 0; rescue(L.cage.kind, L.cage.x + T / 2, L.cage.y); }
    const me = S.pengs[0];
    S.tgRemote = pr.rs === S.rs ? pr.tg || 0 : 0;
    if ((pr.th || 0) > (S.seenTh || 0)) {
      S.seenTh = pr.th;
      if (me && !me.dead && me.support && me.support.o === r) { launch(me, PHYS.throwV, r.face * PHYS.throwX); sfx.boing(); }
    }
    if ((pr.ld || 0) > (S.seenLd || 0)) {
      S.seenLd = pr.ld;
      const ma = me && seesawAt(L, me);
      if (ma) {
        const rcx = r.x + PW / 2, s = ma.s;
        if (Math.abs(r.y + PH - s.y * T) < 6 && rcx >= s.x0 * T - 2 && rcx <= (s.x1 + 1) * T + 2 && (rcx < s.mid ? -1 : 1) === -ma.side) {
          s.tilt = -ma.side; launch(me, Math.min(PHYS.seesawMax, (pr.imp || 0) * PHYS.seesawK), me.vx); sfx.boing();
        }
      }
    }
    if ((pr.sw || 0) > (S.seenSw || 0)) {
      S.seenSw = pr.sw;
      if (me && !me.dead && typeof pr.swx === "number") { teleport(me, pr.swx, pr.swy); me.onCrystal = true; L.swapCd = PHYS.swapCd; sfx.swap(); }
    }
  }
  function sendPresence(force) {
    if (!S.room || S.mode !== "online" || !S.me) return;
    const t = now();
    if (!force && t - (S.lastSend || 0) < 33) return;
    const p = S.pengs[0], play = S.screen === "play" || S.screen === "pause" || S.screen === "win";
    const sc = play ? "play" : S.screen === "menu" ? "menu" : "lobby";
    const o = { v: 1, r: S.me, sk: store.skins[S.me] || "pinguino", sc, pk: S.pk, lv: S.L && play ? S.lvl : -1, rs: S.rs };
    if (play && p && S.L) {
      Object.assign(o, { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.face,
        og: p.onGround ? 1 : 0, w: p.wet ? 1 : 0, d: p.dead ? 1 : 0, ex: p.inExit ? 1 : 0,
        an: p.anchor ? 1 : 0, rl: p.reel ? 1 : 0, cl: p.cling, st: p.cling ? Math.round(p.stamina * 10) / 10 : null,
        ky: S.L.key && S.L.key.holder === S.me ? 1 : 0, cp: S.L.cp,
        rc: S.L.cage && S.L.cage.open && S.L.cage.t < 90 ? 1 : 0,
        th: S.th || 0, ld: S.ld || 0, imp: S.imp || 0, sw: S.sw || 0, swx: S.swx, swy: S.swy, tg: S.tgLocal || 0,
        fm: S.L.fish.reduce((m, f, i) => (f.got ? m | (1 << i) : m), 0) });
    } else Object.assign(o, { x: null, y: null });
    const key = JSON.stringify(o);
    // si nada cambió, igual se manda una vez por segundo: así la pareja sabe que seguimos conectados
    if (key === S.sent && !force && t - (S.lastSend || 0) < 1000) return;
    S.sent = key; S.lastSend = t;
    S.room.presence(o);
  }
  function sendPresenceMenu() { if (S.room && S.me) { S.room.presence({ v: 1, r: S.me, sc: "menu", x: null, y: null }); S.sent = ""; } }
  function lobbyInfo() {
    const pr = partnerP(), inRoom = !!S.room;
    let tone = "", text, ready = false;
    if (!inRoom) {
      if (S.roomState === "error") { tone = "warn"; text = roomErrText(S.roomErr); }
      else text = "Creen una sala o únanse con un código.";
    } else if (S.roomState === "pending" || !S.connected) text = "Conectando…";
    else if (!S.me) { tone = pr ? "on" : ""; text = pr ? `Tu pareja ya está aquí${pr.r ? ` como ${P_NAME[pr.r]}` : ""}. Elige quién eres.` : "Elige quién eres"; }
    else if (!pr) text = S.room.lost ? "Se cortó la conexión con tu pareja. Esperando que vuelva…" : S.salaHost ? `Sala lista. Pásale el código ${S.salaCode} a tu pareja.` : "Esperando a tu pareja…";
    else if (pr.r === S.me) { tone = "warn"; text = `Los dos eligieron a ${P_NAME[S.me]}. Uno tiene que cambiar.`; }
    else if (!pr.r) { tone = "on"; text = "Tu pareja está aquí, falta que elija."; }
    else { tone = "on"; text = `Tu pareja está lista como ${P_NAME[pr.r]}.`; ready = true; }
    const live = pr && pr.r && pr.r !== S.me && pr.sc === "play" && pr.pk === S.pk;
    const follow = S.mode === "online" && inRoom && pr && pr.r && pr.r !== S.me && pr.sc === "play" && typeof pr.lv === "number" &&
      pr.lv >= 0 && pr.lv < LEVELS.length && !["play", "pause", "win"].includes(S.screen);
    return { inRoom, code: S.salaCode, host: S.salaHost, me: S.me, tone, text, ready, net: live ? "on" : pr ? "warn" : "warn",
      netText: live ? "Pareja conectada" : pr ? "Pareja en el menú" : "Esperando pareja",
      follow: follow ? `Tu pareja está en el nivel ${pr.lv + 1} · ${LEVELS[pr.lv].name}` : null };
  }
  function lobbyChanged() { const k = JSON.stringify(lobbyInfo()); if (k !== S.lobbyKey) { S.lobbyKey = k; emit(); } }
  function roomErrText(e) {
    if (e === "peer-unavailable") return "No encontramos esa sala. Revisen el código o creen una nueva.";
    if (e === "webrtc") return "Este teléfono no permite salas directas.";
    return "No hay conexión con el servidor de salas. Revisen el internet e intenten de nuevo.";
  }
  function followPartner() {
    const pr = partnerP(); if (!pr || typeof pr.lv !== "number") return;
    S.pk = Math.max(S.pk, pr.pk || 0); S.rs = Math.max(S.rs, pr.rs || 0); S.runTime = 0; S.falls = 0; S.result = null;
    loadLevel(pr.lv); showScreen("play"); S.sent = ""; sendPresence(true);
  }
  // latido: el estado sale aunque el dibujo vaya lento, y quien se unió reintenta si se cortó
  setInterval(() => {
    sendPresence();
    const t = now();
    if (S.room && S.room.retry && !S.salaHost && t - (S.lastRetry || 0) > 4000 && S.room.lost) { S.lastRetry = t; S.room.retry(); }
    if (S.room) lobbyChanged();
  }, 250);

  // ---------- cámara y dibujo ----------
  function updateCamera(dt, snap) {
    const L = S.L;
    if (!L) return;
    const ps = allPengs().filter((p) => p.visible !== false && !p.dead);
    if (!ps.length) return;
    const k = snap ? 1 : Math.min(1, dt * 5);
    if (L.H <= H) S.camY = 0;
    else {
      const my = ps.reduce((s, p) => s + p.y + PH / 2, 0) / ps.length;
      S.camY += (Math.max(0, Math.min(L.H - H, my - H * 0.55)) - S.camY) * k;
    }
    if (L.W <= W) S.camX = 0;
    else {
      const mx = ps.reduce((s, p) => s + p.x + PW / 2, 0) / ps.length;
      S.camX = (S.camX || 0) + (Math.max(0, Math.min(L.W - W, mx - W * 0.45)) - (S.camX || 0)) * k;
    }
  }
  // w, h: tamaño de la pantalla; ins: bordes seguros {l, r}; ctrlH: alto de la franja de controles (0 sin controles)
  function resize(w, h, ins, ctrlH) {
    const il = (ins && ins.l) || 0, ir = (ins && ins.r) || 0, aw = w - il - ir;
    let s = Math.min(aw / W, h / H);
    if (ctrlH) s = Math.min(s, (h - ctrlH) / (16 * T)); // los controles solo tapan las dos filas de abajo
    view = { s, ox: il + (aw - W * s) / 2, oy: ctrlH ? Math.max(0, (h - ctrlH - H * s) / 2) : (h - H * s) / 2, w, h, ctrlH };
    if (S.L && Math.abs((S.L.cacheScale || 0) - cacheScale()) > 0.05) buildCaches(S.L, cacheScale());
  }
  function label(c, text, x, y, col, size) {
    const fs = size || 10, maxW = W - 120;
    c.font = `600 ${fs}px Fredoka, ui-rounded, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    let lines = [text];
    if (c.measureText(text).width > maxW) {
      const words = text.split(" "); let best = 1, bestD = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "), d = Math.abs(c.measureText(a).width - c.measureText(b).width);
        if (d < bestD) { bestD = d; best = i; }
      }
      lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
    }
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 14, lh = fs + 3, hh = lines.length * lh + 6;
    c.fillStyle = "rgba(8,17,28,.75)"; rrect(c, x - w / 2, y - hh / 2, w, hh, Math.min(hh / 2, 10)); c.fill();
    c.fillStyle = col || "#f3f8fb";
    lines.forEach((l, i) => c.fillText(l, x, y + 0.5 + (i - (lines.length - 1) / 2) * lh));
  }
  function render(ctx, t) {
    const cw = view.w, ch = view.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0b1626"; ctx.fillRect(0, 0, cw, ch);
    const L = S.L; if (!L) return;
    // el nivel no llena los lados en teléfonos anchos: el cielo se extiende por toda la pantalla, un poco más oscuro
    if (L.sky) {
      const cover = Math.max(cw / W, ch / H), sw2 = W * cover, sh2 = H * cover;
      ctx.drawImage(L.sky, (cw - sw2) / 2, (ch - sh2) / 2, sw2, sh2);
      ctx.fillStyle = "rgba(5,12,22,.45)"; ctx.fillRect(0, 0, cw, ch);
    }
    const k = view.s, cam = S.camY, camX = S.camX || 0, cs = L.cacheScale;
    ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.drawImage(L.sky, 0, 0, W, H);
    if (!(L.def.world >= 6)) drawAurora(ctx, t);
    const sh = Math.min(H * cs, L.tiles.height - cam * cs), sw = Math.min(W * cs, L.tiles.width - camX * cs);
    ctx.drawImage(L.tiles, camX * cs, cam * cs, sw, sh, 0, 0, sw / cs, sh / cs);
    ctx.save(); ctx.translate(-camX, -cam);
    drawDynamic(ctx, L, t);
    const ps = allPengs().filter((p) => p.visible !== false && !p.dead);
    if (L.exit && ps.some((p) => p.inExit)) {
      const g = ctx.createRadialGradient(L.exit.x + 20, L.exit.y + 34, 2, L.exit.x + 20, L.exit.y + 34, 34);
      g.addColorStop(0, "rgba(255,224,138,.35)"); g.addColorStop(1, "rgba(255,224,138,0)");
      ctx.fillStyle = g; ctx.fillRect(L.exit.x - 20, L.exit.y - 10, 80, 60);
    }
    if (L.rope && ps.length === 2) drawRope(ctx, L, ps[0], ps[1]);
    if (L.light) {
      const g = ctx.createRadialGradient(L.light.x, L.light.y, 4, L.light.x, L.light.y, PHYS.lightR);
      g.addColorStop(0, "rgba(255,230,150,.22)"); g.addColorStop(1, "rgba(255,230,150,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.light.x, L.light.y, PHYS.lightR, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of ps) {
      drawPenguin(ctx, p.id, p.x, p.y, p.face, { kind: skinFor(p), t: p.anim, walk: p.onGround && !p.anchor && Math.abs(p.vx) > 15, air: !p.onGround && !p.wet && !p.cling,
        wet: p.wet, squash: p.squash, anchor: p.anchor, cling: p.cling, stamina: p.stamina, frozen: !!p.caught });
      if (p.caught) { ctx.fillStyle = "#ff6b6b"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("!", p.x + PW / 2, p.y - 12 + Math.sin(t * 12) * 1.2); }
      if (L.key && L.key.holder === p.id) drawKey(ctx, p.x + PW / 2 + 2, p.y - 12 + Math.sin(t * 4) * 1);
      if (L.hasGhost && p.id === (L.def.lantern || "F")) {
        const lx = p.x + PW / 2 + p.face * 9, ly = p.y + 8;
        ctx.strokeStyle = "#c9d6e0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, ly - 5); ctx.lineTo(lx, ly - 2); ctx.stroke();
        ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(lx, ly + 1, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawWater(ctx, L, t, Math.floor(cam / T), Math.ceil((cam + H) / T) + 1);
    drawBall(ctx, L, t);
    if (L.def.air) for (const p of ps) {
      if (p.air == null || p.air >= PHYS.airMax - 0.05) continue;
      const k2 = p.air / PHYS.airMax, bx = p.x + PW / 2 - 10, by = p.y - 30;
      ctx.fillStyle = "rgba(8,17,28,.6)"; rrect(ctx, bx - 1, by - 1, 22, 5, 2.5); ctx.fill();
      ctx.fillStyle = k2 > 0.35 ? "#7fd8ff" : "#ff6b6b"; rrect(ctx, bx, by, 20 * k2, 3, 1.5); ctx.fill();
    }
    for (const p of S.particles) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
    ctx.globalAlpha = 1;
    if (S.screen === "play" || S.screen === "pause") {
      if (S.mode === "online" && S.pengs[0] && !S.pengs[0].dead) { const p = S.pengs[0]; label(ctx, "Tú", p.x + PW / 2, p.y - (L.key && L.key.holder === p.id ? 24 : 14), P_COLOR[p.id]); }
      const inside = ps.filter((p) => p.inExit);
      if (L.exit && inside.length === 1 && !S.won) { const m = other(inside[0].id); label(ctx, `Falta ${P_NAME[m]}`, L.exit.x + 20, L.exit.y - 10, P_COLOR[m]); }
      if (L.exit && L.key && !L.key.holder && ps.some((p) => Math.abs(p.x - L.exit.x) < 40 && Math.abs(p.y - L.exit.y) < 40)) label(ctx, "Falta la llave", L.exit.x + 20, L.exit.y - 10, "#ffd166");
    }
    ctx.restore();
    ctx.globalAlpha = 0.8; ctx.fillStyle = "#eef6fb";
    for (const f of S.flakes) ctx.fillRect(f.x, f.y, f.s, f.s);
    ctx.globalAlpha = 1;
    if ((S.screen === "play" || S.screen === "pause") && L.time < 7 && L.def.hint) {
      ctx.globalAlpha = Math.min(1, (7 - L.time) * 1.5); label(ctx, L.def.hint, W / 2, 56, "#f3f8fb", 12); ctx.globalAlpha = 1;
    }
    if (L.ball && !L.ball.stop) {
      if (!L.ball.active) label(ctx, `¡Avalancha en ${Math.ceil(L.ball.delay - L.ball.t)}!`, W / 2, 84, "#ff8b4a", 14);
      else {
        // brillo rojo en el borde izquierdo cuando la bola se acerca
        const kk = Math.max(0, Math.min(1, 1 - (Math.min(...ps.map((p) => p.x)) - (L.ball.x + L.ball.r)) / 160));
        if (kk > 0 && ps.length) { const g = ctx.createLinearGradient(0, 0, 70, 0); g.addColorStop(0, `rgba(255,80,80,${0.45 * kk})`); g.addColorStop(1, "rgba(255,80,80,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 70, H); }
      }
    }
    ctx.restore();
  }

  // ---------- menú: el primer nivel de fondo, como en la web ----------
  function demo() {
    S.L = parseLevel(LEVELS[0], 0); buildCaches(S.L, cacheScale());
    S.pengs = ["F", "B"].map((r) => newPenguin(r, S.L.starts[r])); S.remote = null; S.camY = 0; S.camX = 0;
    S.pengs.forEach((p) => (p.onGround = true));
  }

  // ---------- bucle (lo llama la app en cada cuadro) ----------
  let acc = 0;
  function frame(dt, t) {
    dt = Math.min(0.1, dt);
    const sim = S.screen === "play" || S.screen === "win" || ((S.screen === "pause" || S.screen === "help") && S.mode === "online");
    if (sim && S.L) { acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 6) { step(1 / 60); acc -= 1 / 60; } if (n >= 6) acc = 0; }
    else acc = 0;
    if (S.L) updateCamera(dt, false);
    updateFx(dt, t);
    if (S.L && S.L.def.timeLimit && sim) updateHud();
    sendPresence();
  }

  // ---------- mapa de niveles ----------
  const MAP = { step: 86, pad: 70, h: 240, x: 0, sel: 0 };
  const nodeX = (i) => MAP.pad + i * MAP.step;
  const nodeY = (i) => MAP.h / 2 + 10 + Math.sin(i * 0.9) * 52;
  const mapWidth = () => MAP.pad * 2 + (LEVELS.length - 1) * MAP.step;
  function openMap(cw, ch) {
    MAP.sel = Math.min(LEVELS.length - 1, Math.max(0, store.unlocked - 1));
    const vw = (cw / ch) * MAP.h;
    MAP.x = Math.max(0, Math.min(mapWidth() - vw, nodeX(MAP.sel) - vw / 2));
  }
  function mapInfo() {
    const i = MAP.sel, lv = LEVELS[i], open = i + 1 <= store.unlocked, best = store.best[i], bt = store.bestTime[i];
    const bits = [`Mundo ${lv.world} · ${WORLDS[lv.world]}`];
    if (!open) bits.push("Bloqueado");
    else bits.push(best == null ? "Sin jugar" : `Peces ${Math.min(best, fishTotal(i))}/${fishTotal(i)}${bt ? " · " + fmtTime(bt) : ""}`);
    if (lv.cage) bits.push(store.freed[lv.cage] ? `Rescataron ${pairById(lv.cage).who}` : "Hay una pareja en una jaula");
    if (lv.ball) bits.push("Avalancha");
    if (lv.timeLimit) bits.push(`${lv.timeLimit} s`);
    return { index: i, name: `${i + 1}. ${lv.name}`, stats: bits.join(" · "), open };
  }
  function mapPan(dxScreen, cw, ch) { MAP.x -= dxScreen * (MAP.h / ch); }
  function mapTap(x, y, ch) {
    const k = MAP.h / ch, mx = x * k + MAP.x, my = y * k;
    for (let i = 0; i < LEVELS.length; i++) if (Math.hypot(mx - nodeX(i), my - nodeY(i)) < 36) { MAP.sel = i; sfx.lever(); emit(); return true; }
    return false;
  }
  function drawMap(c, cw, ch, t) {
    const k = ch / MAP.h, vw = cw / k;
    MAP.x = Math.max(0, Math.min(Math.max(0, mapWidth() - vw), MAP.x));
    c.setTransform(k, 0, 0, k, -MAP.x * k, 0);
    let i0 = 0;
    while (i0 < LEVELS.length) {
      const w = LEVELS[i0].world; let i1 = i0; while (i1 + 1 < LEVELS.length && LEVELS[i1 + 1].world === w) i1++;
      const x0 = i0 === 0 ? 0 : nodeX(i0) - MAP.step / 2, x1 = i1 === LEVELS.length - 1 ? mapWidth() : nodeX(i1) + MAP.step / 2;
      if (x1 >= MAP.x - 10 && x0 <= MAP.x + vw + 10) {
        drawRegion(c, w, x0, x1, t);
        c.fillStyle = "rgba(8,17,28,.55)"; rrect(c, x0 + 8, 8, Math.min(x1 - x0 - 16, 190), 22, 11); c.fill();
        c.fillStyle = WORLD_LOOK[w][2]; c.font = "600 12px Fredoka, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle";
        c.fillText(`Mundo ${w} · ${WORLDS[w]}`, x0 + 18, 19.5);
      }
      i0 = i1 + 1;
    }
    c.lineCap = "round";
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const done = store.best[i] != null;
      c.strokeStyle = done ? "rgba(127,227,199,.85)" : "rgba(243,248,251,.35)"; c.lineWidth = 4; c.setLineDash(done ? [] : [2, 8]);
      c.beginPath(); c.moveTo(nodeX(i), nodeY(i));
      c.quadraticCurveTo((nodeX(i) + nodeX(i + 1)) / 2, (nodeY(i) + nodeY(i + 1)) / 2 - 18, nodeX(i + 1), nodeY(i + 1)); c.stroke();
    }
    c.setLineDash([]);
    for (let i = 0; i < LEVELS.length; i++) {
      const x = nodeX(i), y = nodeY(i), open = i + 1 <= store.unlocked, done = store.best[i] != null, cur = open && !done, look = WORLD_LOOK[LEVELS[i].world];
      if (x < MAP.x - 40 || x > MAP.x + vw + 40) continue;
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
    const sx = nodeX(MAP.sel), sy = nodeY(MAP.sel) - 16;
    for (const [team, dx] of [["F", -9], ["B", 9]]) {
      drawCharacter(c, curPair()[team], team, sx + dx - PW / 2, sy - PH, team === "F" ? 1 : -1, { t: t + (team === "B" ? 0.5 : 0) });
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

  // ---------- personajes ----------
  function selectPair(id) {
    if (!isUnlocked(id)) return false;
    store.pair = id; applyPair(); save(); emit(); return true;
  }
  // dibujito de una pareja (para la lista de Personajes y el lobby), en un lienzo de 60×30 unidades
  function drawPairCard(c, id, t, on) {
    const locked = !isUnlocked(id);
    drawPair(c, pairById(id), 30, 27, locked ? 0.5 : t, { walk: on, caged: locked, scale: locked ? 0.95 : 1 });
  }
  function drawRole(c, role, t) { drawPenguin(c, role, 15 - PW / 2, 28 - PH, 1, { kind: store.skins[role], t }); }

  demo();
  return {
    S, store, LEVELS, WORLDS, PAIRS, PAIR_CAGE, P_NAME, P_COLOR, MAP, T, W, H, Ctx, touch, pendJ, pendG, needsGrab,
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    resize, frame, render, drawMap, openMap, mapInfo, mapPan, mapTap, drawRegion,
    showScreen, pickLevel, requestRestart, restartLevel, demo, fmtTime,
    setMode(m) { S.mode = m; if (m !== "online") S.me = null; emit(); },
    openCodeRoom, createRoom: () => openCodeRoom(newCode(), true), leaveRoom: () => { leaveRoom(); S.me = null; emit(); }, pickRole, lobbyInfo, followPartner, sendPresenceMenu,
    buzz, isUnlocked, curPair, selectPair, drawPairCard, drawRole, pairById, toast,
    setMute(m) { store.mute = m; save(); emit(); },
  };
}
module.exports = { createGame };
