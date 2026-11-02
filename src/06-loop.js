// ---------- Simulación, red, cámara, dibujo y bucle ----------
const NO_INPUT = { l: 0, r: 0, j: 0, jp: false, g: 0 };
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

// ---------- En línea ----------
const partnerP = () => (S.partner && S.partner.presence) || null;
// Dos tipos de sala con la misma forma (presence, peers, onConnection, onPeers):
// la de claude.ai (solo si el juego corre allí) y una sala con código, donde los dos teléfonos se conectan
// directo (WebRTC). El servidor público y gratuito de PeerJS solo sirve para que se encuentren.
const claudeRoomAvail = () => !!(window.claude && window.claude.use);
function wireRoom(room, kind) {
  S.room = room; S.roomKind = kind; S.partner = null; S.connected = false; S.roomState = "pending"; S.sent = "";
  room.onConnection((c) => { if (S.room !== room) return; S.connected = c; S.roomState = "ready"; S.sent = ""; paintLobby(); },
    (err) => { if (S.room === room) roomFailed(kind, err); });
  room.onPeers(() => { if (S.room !== room) return; scanPeers(); paintLobby(); }, () => {});
  paintLobby();
}
function roomFailed(kind, err) {
  if (kind === "code" && err === "unavailable-id" && S.salaHost) { openCodeRoom(newCode(), true); return; } // código ocupado: otro
  const code = S.salaCode; leaveRoom(); S.roomState = kind === "claude" ? "off" : "error"; S.roomErr = err;
  if (code && !S.salaHost) $("salaCode").value = code;
  paintLobby();
}
function useClaudeRoom() {
  leaveRoom(); S.roomState = "pending"; paintLobby();
  window.claude.use("room").then((room) => {
    if (!room) { S.roomState = "off"; paintLobby(); return; }
    wireRoom(room, "claude"); S.roomState = "ready"; paintLobby();
  }).catch(() => { S.roomState = "off"; paintLobby(); });
}
const SALA_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 4 }, () => SALA_ABC[Math.floor(Math.random() * SALA_ABC.length)]).join("");
const salaId = (code) => "malu-y-nuka-sala-" + code.toLowerCase();
// STUN alcanza en casi todas las casas. Con VPN, redes de trabajo o escuela, o datos móviles con NAT estricto
// la conexión directa no pasa y hace falta un TURN que reenvíe el tráfico; por TCP/TLS en el puerto 443 cruza casi cualquier firewall.
// El TURN de PeerJS solo escucha en el 3478. Para uno propio (p. ej. Metered, plan gratis) pon en TURN_API la URL
// que devuelve la lista de servidores: https://TU-APP.metered.live/api/v1/turn/credentials?apiKey=TU-CLAVE
const TURN_API = "https://malunuka.metered.live/api/v1/turn/credentials?apiKey=788c94c4fed1bfeb0b8e0b89fe620a8c692e";
let iceServers = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
  { urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478", "turn:eu-0.turn.peerjs.com:3478?transport=tcp", "turn:us-0.turn.peerjs.com:3478?transport=tcp"],
    username: "peerjs", credential: "peerjsp" },
];
let turnLoad = null;
function loadTurn() {
  if (!TURN_API) return Promise.resolve();
  // sin TURN propio (o si tarda más de 4 s) igual se intenta con los demás
  const wait = new Promise((ok) => setTimeout(ok, 4000));
  return turnLoad || (turnLoad = Promise.race([wait, fetch(TURN_API).then((r) => r.json()).then((list) => {
    if (Array.isArray(list) && list.length) iceServers = iceServers.concat(list);
  })]).catch(() => { turnLoad = null; }));
}
let peerLib = null;
function loadPeerJS() {
  const turn = loadTurn();
  if (window.Peer) return turn;
  return Promise.all([turn, peerLib || (peerLib = new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    s.onload = () => (window.Peer ? ok() : bad(new Error("peerjs"))); s.onerror = () => { peerLib = null; bad(new Error("peerjs")); };
    document.head.appendChild(s);
  }))]);
}
function codeRoom(code, host) {
  let peer = null, conn = null, mine = null, theirs = null, lastRecv = 0;
  let onConn = () => {}, onFail = () => {}, onPeersCb = () => {};
  const room = {
    presence(o) { mine = o; if (conn && conn.open) { try { conn.send(o); } catch (e) {} } return Promise.resolve(); },
    peers() { return theirs && performance.now() - lastRecv < 8000 ? [{ sameTab: false, presence: theirs }] : []; },
    age() { return theirs ? performance.now() - lastRecv : Infinity; },
    onConnection(cb, err) { onConn = cb; if (err) onFail = err; },
    onPeers(cb) { onPeersCb = cb; },
    close() { try { peer && peer.destroy(); } catch (e) {} },
  };
  const attach = (c) => {
    if (conn && conn.open && c !== conn) { c.on("open", () => c.close()); return; } // una sola pareja por sala
    conn = c;
    // si en 15 s no abre, la red no deja pasar la conexión directa: avisamos y quien se unió vuelve a intentar
    setTimeout(() => {
      if (conn !== c || c.open || peer.destroyed) return;
      room.blocked = true; onPeersCb();
      if (!host) room.retry(true);
    }, 15000);
    c.on("open", () => { room.lost = false; room.blocked = false; if (mine) c.send(mine); onPeersCb(); });
    c.on("data", (d) => { if (d && typeof d === "object") { theirs = d; lastRecv = performance.now(); onPeersCb(); } });
    c.on("close", () => { if (conn !== c) return; conn = null; theirs = null; room.lost = true; onPeersCb(); });
    c.on("error", () => {});
  };
  peer = new Peer(host ? salaId(code) : undefined, { debug: 0, config: { iceServers } });
  peer.on("open", () => { onConn(true); if (!host) attach(peer.connect(salaId(code), { serialization: "json", reliable: true })); });
  peer.on("connection", (c) => { if (host) attach(c); });
  peer.on("disconnected", () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} });
  peer.on("error", (e) => onFail(e && e.type));
  // quien se unió vuelve a intentar si se corta
  room.retry = (force) => {
    if (host || !peer.open || (conn && conn.open && !force)) return;
    try { if (conn) conn.close(); } catch (e) {}
    conn = null; attach(peer.connect(salaId(code), { serialization: "json", reliable: true }));
  };
  return room;
}
function openCodeRoom(code, host) {
  leaveRoom();
  S.roomState = "pending"; S.salaCode = code; S.salaHost = host; paintLobby();
  loadPeerJS().then(() => {
    if (S.salaCode !== code) return;
    wireRoom(codeRoom(code, host), "code");
    if (!S.me) pickRole(host ? "F" : "B");
  }).catch(() => { S.roomState = "error"; S.roomErr = "lib"; S.salaCode = null; paintLobby(); });
}
function leaveRoom() {
  if (S.room && S.room.close) S.room.close();
  S.room = null; S.roomKind = null; S.partner = null; S.connected = false; S.roomState = "none"; S.salaCode = null; S.salaHost = false;
  // al salir de la sala vuelve la pareja propia
  if (sharedPair) { sharedPair = null; applyPair(); paintPickCanvases(); }
}
function pickRole(r) {
  S.me = r;
  document.querySelectorAll(".pick").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.role === r)));
  S.sent = ""; sendPresence(); scanPeers(); paintLobby();
}
function roomErrText(e) {
  if (e === "peer-unavailable") return `No encontramos esa sala. Revisen el código o creen una nueva.`;
  if (e === "lib" || e === "network" || e === "server-error" || e === "socket-error" || e === "socket-closed") return "No hay conexión con el servidor de salas. Revisen el internet; si usan VPN, desactívenla e intenten de nuevo.";
  if (e === "browser-incompatible" || e === "webrtc") return "Este navegador no permite salas directas. Prueben con Chrome o Safari actualizados.";
  return "Algo falló con la sala. Intenten de nuevo.";
}
function shareSala() {
  const code = S.salaCode; if (!code) return;
  const web = /^https?:$/.test(location.protocol) && !/claude/.test(location.host);
  const url = web ? location.origin + location.pathname + "?sala=" + code : "";
  const text = `Únete a mi sala de Malu y Nuka. Código: ${code}`;
  if (navigator.share) navigator.share({ title: "Malu y Nuka", text, url: url || undefined }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url ? text + "\n" + url : text).then(() => toast("Copiado. Pégalo en un mensaje a tu pareja."), () => toast(`Código: ${code}`));
  else toast(`Código: ${code}`);
}
function scanPeers() {
  if (!S.room) return;
  const list = S.room.peers().filter((p) => !p.sameTab && p.presence && p.presence.v === 1 && p.presence.sc !== "menu");
  S.partner = list.find((p) => p.presence.r && p.presence.r !== S.me) || list[0] || null;
  const pr = partnerP();
  if (!pr || S.mode !== "online" || !S.me) return;
  syncPair(pr);
  const tie = pr.pk === S.pk && pr.lv !== S.lvl && S.me === "B";
  if (pr.r !== S.me && typeof pr.lv === "number" && pr.lv >= 0 && pr.lv < LEVELS.length && (pr.pk > S.pk || tie)) {
    S.pk = pr.pk; S.rs = Math.max(S.rs, pr.rs || 0); S.runTime = 0; S.falls = 0;
    loadLevel(pr.lv); showScreen("play"); keepAwake();
    return;
  }
  if (pr.pk === S.pk && (pr.rs || 0) > S.rs && S.L) {
    S.rs = pr.rs; S.falls++;
    if (S.remote && S.remote.visible) burst(S.remote.x + PW / 2, S.remote.y + PH / 2, 18, P_COLOR[S.remote.id], 110);
    if (!S.restartT) { SFX.die(); S.restartT = 0.6; }
  }
}
// los dos juegan con la pareja que eligió el último; si nadie eligió en la sala, con la de quien es Malu.
// Las versiones que no mandan pq (la app vieja) siguen viendo a cada quien con lo suyo.
function syncPair(pr) {
  if (typeof pr.pq !== "number" || !PAIRS.some((p) => p.id === pr.pp) || pr.pp === curPair().id) return;
  if (pr.pq < S.pq || (pr.pq === S.pq && !(pr.r && pr.r !== S.me && S.me === "B"))) return;
  S.pq = pr.pq; sharedPair = pr.pp; applyPair(); paintPickCanvases(); S.sent = "";
  if (S.screen === "chars") buildCharsScreen();
  toast(`Los dos juegan con ${pairById(pr.pp).name}, como eligió tu pareja.`);
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
    if (typeof pr.fm === "number") S.L.fish.forEach((f, i) => { if (!f.got && pr.fm & (1 << i)) { f.got = true; burst(f.x, f.y, 8, "#ffe08a", 60); updateFishHud(); } });
    if (pr.ky && L.key && !L.key.holder) { L.key.holder = r.id; SFX.key(); }
  }
  if (typeof pr.cp === "number" && pr.cp > L.cp) L.cp = pr.cp;
  if (pr.rc && L.cage && !L.cage.open) { L.cage.open = true; L.cage.t = 0; rescue(L.cage.kind, L.cage.x + T / 2, L.cage.y); }
  const me = S.pengs[0];
  S.tgRemote = pr.rs === S.rs ? pr.tg || 0 : 0;
  if ((pr.th || 0) > (S.seenTh || 0)) {
    S.seenTh = pr.th;
    if (me && !me.dead && me.support && me.support.o === r) { launch(me, PHYS.throwV, r.face * PHYS.throwX); SFX.boing(); }
  }
  if ((pr.ld || 0) > (S.seenLd || 0)) {
    S.seenLd = pr.ld;
    const ma = me && seesawAt(L, me);
    if (ma) {
      const rcx = r.x + PW / 2, s = ma.s;
      if (Math.abs(r.y + PH - s.y * T) < 6 && rcx >= s.x0 * T - 2 && rcx <= (s.x1 + 1) * T + 2 && (rcx < s.mid ? -1 : 1) === -ma.side) {
        s.tilt = -ma.side; launch(me, Math.min(PHYS.seesawMax, (pr.imp || 0) * PHYS.seesawK), me.vx); SFX.boing();
      }
    }
  }
  if ((pr.sw || 0) > (S.seenSw || 0)) {
    S.seenSw = pr.sw;
    if (me && !me.dead && typeof pr.swx === "number") { teleport(me, pr.swx, pr.swy); me.onCrystal = true; L.swapCd = PHYS.swapCd; SFX.swap(); }
  }
}
function sendPresence(force) {
  if (!S.room || S.mode !== "online" || !S.me) return;
  const now = performance.now();
  if (!force && now - (S.lastSend || 0) < 33) return;
  const p = S.pengs[0], play = S.screen === "play" || S.screen === "pause" || S.screen === "win";
  const sc = play ? "play" : S.screen === "menu" ? "menu" : "lobby";
  const o = { v: 1, r: S.me, sk: store.skins[S.me] || "pinguino", pp: curPair().id, pq: S.pq, sc, pk: S.pk, lv: S.L ? S.lvl : -1, rs: S.rs };
  if (play && p) {
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
  if (key === S.sent && !force && now - (S.lastSend || 0) < 1000) return;
  S.sent = key; S.lastSend = now;
  S.room.presence(o).catch(() => {});
}
function paintLobby() {
  const dot = $("lobbyDot"), txt = $("lobbyText"), go = $("lobbyGo"), pr = partnerP();
  const set = (cls, t) => { dot.className = "dot " + cls; txt.textContent = t; };
  const inRoom = !!S.room || S.roomState === "pending";
  $("salaStart").hidden = inRoom; $("salaOn").hidden = !inRoom; $("lobbyRoles").hidden = !S.room;
  $("salaClaude").hidden = !claudeRoomAvail();
  $("salaShow").textContent = S.roomKind === "claude" ? "claude.ai" : S.salaCode || "····";
  $("salaShare").hidden = S.roomKind === "claude";
  let ready = false;
  if (!inRoom) {
    if (S.roomState === "error") set("warn", roomErrText(S.roomErr));
    else if (S.roomState === "off") set("warn", "La sala de claude.ai no está disponible aquí. Usen una sala con código.");
    else set("", "Creen una sala o únanse con un código.");
  } else if (S.roomState === "pending" || !S.connected) set("", "Conectando…");
  else if (!S.me) set(pr ? "on" : "", pr ? `Tu pareja ya está aquí${pr.r ? ` como ${P_NAME[pr.r]}` : ""}. Elige quién eres.` : "Elige quién eres");
  else if (!pr && S.room && S.room.blocked) set("warn", "No logramos conectarlos. Si alguno usa VPN o la red del trabajo o la escuela, desactívenla o cambien a datos móviles. Seguimos intentando…");
  else if (!pr) set("", S.room && S.room.lost ? "Se cortó la conexión con tu pareja. Esperando que vuelva…" : S.salaHost ? `Sala lista. Pásale el código ${S.salaCode} a tu pareja.` : "Esperando a tu pareja…");
  else if (pr.r === S.me) set("warn", `Los dos eligieron a ${P_NAME[S.me]}. Uno tiene que cambiar.`);
  else if (!pr.r) set("on", "Tu pareja está aquí, falta que elija.");
  else { set("on", `Tu pareja está lista como ${P_NAME[pr.r]}.`); ready = true; }
  go.disabled = !ready;
  $("lobbyHelp").innerHTML = S.roomKind === "claude"
    ? "Funciona cuando los dos abren este juego en <b>claude.ai</b>. Cuando uno escoge nivel, el otro entra solo."
    : inRoom ? "Cuando uno escoge nivel, el otro entra solo. Si se corta, vuelvan a unirse con el mismo código."
    : "Uno toca <b>Crear sala</b> y le pasa el código de 4 letras a su pareja; el otro lo escribe y toca <b>Unirse</b>. Cada uno juega desde su teléfono, con internet.";
  const live = pr && pr.r && pr.r !== S.me && pr.sc === "play" && pr.pk === S.pk;
  $("netDot").className = "dot " + (live ? "on" : "warn");
  $("netText").textContent = live ? "Pareja conectada" : pr ? "Pareja en el menú" : "Esperando pareja";
}

// ---------- Cámara y dibujo ----------
// En pantallas chicas la cámara se acerca a los pingüinos y se aleja solo lo necesario para que se vean los dos.
function updateCamera(dt, snap) {
  const L = S.L;
  if (!L) return;
  const ps = allPengs().filter((p) => p.visible && !p.dead);
  const near = S.screen === "play" || S.screen === "pause" || S.screen === "win" ? view.max : view.fit;
  if (ps.length) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of ps) {
      // altura de referencia: el último piso que pisó, así la cámara no sube y baja con cada salto
      p.camRef = snap || p.camRef == null || p.onGround || p.wet || p.cling ? p.y : Math.min(Math.max(p.camRef, p.y), p.y + 3 * T);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + PW);
      y0 = Math.min(y0, p.camRef - 3.5 * T, p.y - T); y1 = Math.max(y1, p.camRef + PH + 1.5 * T);
    }
    const want = Math.max(view.fit, Math.min(near, view.aw / (x1 - x0 + 8 * T), view.fh / (y1 - y0)));
    // alejarse es rápido para no perder a nadie; acercarse, suave
    view.s = snap ? want : view.s + (want - view.s) * Math.min(1, dt * (want < view.s ? 3 : 1.2));
    S.camTx = (x0 + x1) / 2; S.camTy = (y0 + y1) / 2;
  } else view.s = Math.max(view.fit, Math.min(near, view.s));
  const s = view.s, k = snap ? 1 : Math.min(1, dt * 5);
  // ventana del nivel: todo el ancho libre y, con controles, hasta dos filas tapadas por los botones
  view.vw = view.aw / s; view.fv = view.fh / s + (view.pad ? 2 * T : 0);
  if (L.W <= view.vw) { S.camX = 0; view.ox = view.il + (view.aw - L.W * s) / 2; }
  else {
    const maxX = L.W - view.vw, tx = Math.max(0, Math.min(maxX, (S.camTx ?? L.W / 2) - view.vw * 0.45));
    S.camX = Math.max(0, Math.min(maxX, (S.camX || 0) + (tx - (S.camX || 0)) * k)); view.ox = view.il;
  }
  if (L.H <= view.fv) { S.camY = 0; view.oy = view.pad ? Math.max(0, (view.fh - L.H * s) / 2) : (view.h - L.H * s) / 2; }
  else {
    const maxY = L.H - view.fv, ty = Math.max(0, Math.min(maxY, (S.camTy ?? L.H / 2) - view.fh / s / 2));
    S.camY = Math.max(0, Math.min(maxY, S.camY + (ty - S.camY) * k)); view.oy = 0;
  }
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3), w = innerWidth, h = innerHeight;
  document.documentElement.style.setProperty("--ctrl-h", Math.round(Math.max(56, Math.min(86, h * 0.2))) + "px");
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const pad = !$("controls").hidden, ch = pad ? $("controls").offsetHeight : 0;
  // con controles, el nivel puede bajar hasta que los botones solo tapen las dos filas de abajo
  const css = getComputedStyle(document.documentElement), ins = (k) => parseFloat(css.getPropertyValue(k)) || 0;
  const il = ins("--sal"), ir = ins("--sar"), aw = w - il - ir, fh = h - ch;
  let fit = Math.min(aw / W, h / H);
  if (pad) fit = Math.min(fit, fh / (16 * T));
  // al jugar, la cámara puede acercarse hasta bloques de 26 px, sin bajar de 10 filas visibles sobre los botones
  const near = Math.min(26 / T, fh / (10 * T), aw / (20 * T));
  Object.assign(view, { dpr, h, il, aw, fh, pad, fit, max: Math.max(fit, near),
    cache: Math.min(3, dpr * Math.max(Math.min(aw / W, h / H), 26 / T)) });
  if (S.L && Math.abs((S.L.cacheScale || 0) - view.cache) > 0.01) buildCaches(S.L, view.cache);
  updateCamera(0, true);
}
function label(c, text, x, y, col, size) {
  const fs = size || 10, maxW = Math.min(W, view.vw || W) - 120;
  c.font = `600 ${fs}px Fredoka, ui-rounded, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  // si no cabe en una línea, se parte en dos por la palabra más cercana a la mitad
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
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b1626"; ctx.fillRect(0, 0, cv.width, cv.height);
  const L = S.L; if (!L) return;
  // en teléfonos anchos el nivel no llena los lados: el cielo se extiende por toda la pantalla, un poco más oscuro
  if (L.sky) {
    const cover = Math.max(cv.width / W, cv.height / H), sw2 = W * cover, sh2 = H * cover;
    ctx.drawImage(L.sky, (cv.width - sw2) / 2, (cv.height - sh2) / 2, sw2, sh2);
    ctx.fillStyle = "rgba(5,12,22,.45)"; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  const k = view.s * view.dpr, cam = S.camY, camX = S.camX || 0, cs = L.cacheScale;
  // lo visible del nivel: hasta el borde de la pantalla o hasta donde termina el nivel
  const vw = Math.min(view.vw, L.W - camX), vh = Math.min((view.h - view.oy) / view.s, L.H - cam);
  ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, vw, vh); ctx.clip();
  // el cielo cubre la ventana y se desliza un poco al mover la cámara
  const sk = Math.max(vw / W, vh / H), maxX = L.W - view.vw, maxY = L.H - view.fv;
  ctx.drawImage(L.sky, -(W * sk - vw) * (maxX > 0 ? camX / maxX : 0.5), -(H * sk - vh) * (maxY > 0 ? cam / maxY : 1), W * sk, H * sk);
  if (!(L.def.world >= 6)) drawAurora(ctx, t, vw);
  const sh = Math.min(vh * cs, L.tiles.height - cam * cs), sw = Math.min(vw * cs, L.tiles.width - camX * cs);
  ctx.drawImage(L.tiles, camX * cs, cam * cs, sw, sh, 0, 0, sw / cs, sh / cs);
  ctx.save(); ctx.translate(-camX, -cam);
  drawDynamic(ctx, L, t);
  const ps = allPengs().filter((p) => p.visible && !p.dead);
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
    if (p.caught) { ctx.fillStyle = "#ff6b6b"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", p.x + PW / 2, p.y - 12 + Math.sin(t * 12) * 1.2); }
    if (L.key && L.key.holder === p.id) drawKey(ctx, p.x + PW / 2 + 2, p.y - 12 + Math.sin(t * 4) * 1);
    if (L.hasGhost && p.id === (L.def.lantern || "F")) {
      const lx = p.x + PW / 2 + p.face * 9, ly = p.y + 8;
      ctx.strokeStyle = "#c9d6e0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, ly - 5); ctx.lineTo(lx, ly - 2); ctx.stroke();
      ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(lx, ly + 1, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawWater(ctx, L, t, Math.floor(cam / T), Math.ceil((cam + vh) / T) + 1);
  drawBall(ctx, L, t);
  if (L.def.air) for (const p of ps) {
    if (p.air == null || p.air >= PHYS.airMax - 0.05) continue;
    const k = p.air / PHYS.airMax, bx = p.x + PW / 2 - 10, by = p.y - 30;
    ctx.fillStyle = "rgba(8,17,28,.6)"; rrect(ctx, bx - 1, by - 1, 22, 5, 2.5); ctx.fill();
    ctx.fillStyle = k > 0.35 ? "#7fd8ff" : "#ff6b6b"; rrect(ctx, bx, by, 20 * k, 3, 1.5); ctx.fill();
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
  for (let fx = 0; fx < vw; fx += W) for (let fy = 0; fy < vh; fy += H) for (const f of S.flakes) ctx.fillRect(f.x + fx, f.y + fy, f.s, f.s);
  ctx.globalAlpha = 1;
  if ((S.screen === "play" || S.screen === "pause") && L.time < 7 && L.def.hint) {
    ctx.globalAlpha = Math.min(1, (7 - L.time) * 1.5); label(ctx, L.def.hint, vw / 2, 56, "#f3f8fb", 12); ctx.globalAlpha = 1;
  }
  if (L.ball && !L.ball.stop) {
    if (!L.ball.active) label(ctx, `¡Avalancha en ${Math.ceil(L.ball.delay - L.ball.t)}!`, vw / 2, 84, "#ff8b4a", 14);
    else {
      // brillo rojo en el borde izquierdo cuando la bola se acerca
      const gap = Math.max(0, ...ps.map((p) => p.x)) - (L.ball.x + L.ball.r);
      const k = Math.max(0, Math.min(1, 1 - (Math.min(...ps.map((p) => p.x)) - (L.ball.x + L.ball.r)) / 160));
      if (k > 0 && gap > -999) { const g = ctx.createLinearGradient(0, 0, 70, 0); g.addColorStop(0, `rgba(255,80,80,${0.45 * k})`); g.addColorStop(1, "rgba(255,80,80,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 70, vh); }
    }
  }
  if (L.def.timeLimit) {
    const left = Math.max(0, L.def.timeLimit - L.time), el = $("hudTime");
    const txt = fmtTime(Math.ceil(left)); if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle("low", left < 10);
  }
  ctx.restore();
}

function paintPickCanvases() {
  document.querySelectorAll(".pick").forEach((b) => {
    const c = b.querySelector("canvas").getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 96, 96);
    c.setTransform(3.2, 0, 0, 3.2, 0, 0);
    drawPenguin(c, b.dataset.role, 15 - PW / 2, 28 - PH, 1, { kind: store.skins[b.dataset.role], t: 0.5 });
  });
}
function keepAwake() { try { navigator.wakeLock && navigator.wakeLock.request("screen").catch(() => {}); } catch (e) {} }

// ---------- Botones de la interfaz ----------
$("btnLocal").onclick = () => { unlockAudio(); S.mode = "local"; S.me = null; showScreen("levels"); };
$("btnOnline").onclick = () => { unlockAudio(); S.mode = "online"; showScreen("lobby"); paintLobby(); };
$("btnMute").onclick = () => { store.mute = !store.mute; save(); paintMute(); unlockAudio(); };
document.querySelectorAll(".pick").forEach((b) => b.onclick = () => pickRole(b.dataset.role));
$("salaCreate").onclick = () => { unlockAudio(); openCodeRoom(newCode(), true); };
$("salaJoin").onclick = () => {
  unlockAudio();
  const code = $("salaCode").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) { S.roomState = "error"; S.roomErr = "peer-unavailable"; paintLobby(); $("salaCode").focus(); return; }
  openCodeRoom(code, false);
};
$("salaCode").addEventListener("keydown", (e) => { if (e.key === "Enter") $("salaJoin").click(); });
$("salaCode").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); });
$("salaClaude").onclick = () => useClaudeRoom();
$("salaShare").onclick = () => shareSala();
$("salaLeave").onclick = () => { leaveRoom(); S.me = null; document.querySelectorAll(".pick").forEach((x) => x.setAttribute("aria-pressed", "false")); paintLobby(); };
$("btnHelp").onclick = () => { unlockAudio(); S.helpBack = "menu"; showScreen("help"); };
$("pHelp").onclick = () => { S.helpBack = "pause"; showScreen("help"); };
$("helpDone").onclick = () => { const back = S.helpBack || "menu"; showScreen(back); if (back === "menu") demo(); };
$("lobbyBack").onclick = () => { S.mode = null; showScreen("menu"); sendPresenceMenu(); demo(); };
$("lobbyGo").onclick = () => showScreen("levels");
$("btnChars").onclick = () => { unlockAudio(); S.mode = null; S.charsBack = "menu"; showScreen("chars"); };
$("lobbyChars").onclick = () => { S.charsBack = "lobby"; showScreen("chars"); };
$("charsDone").onclick = () => { const back = S.charsBack || "menu"; showScreen(back); if (back === "menu") demo(); else paintLobby(); };
$("levelsBack").onclick = () => { if (S.mode === "online") showScreen("lobby"); else { showScreen("menu"); demo(); } };
$("btnPause").onclick = () => showScreen("pause");
$("pResume").onclick = () => showScreen("play");
$("pRestart").onclick = () => { requestRestart(); showScreen("play"); };
$("pLevels").onclick = () => showScreen("levels");
$("pMenu").onclick = () => { sendPresenceMenu(); S.mode = null; showScreen("menu"); demo(); };
$("wNext").onclick = () => pickLevel(Math.min(LEVELS.length - 1, S.lvl + 1));
$("wLevels").onclick = () => showScreen("levels");
// donde se puede (Android), el botón acuesta el juego solo: pantalla completa y orientación horizontal fija
if (document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock) $("btnRotate").hidden = false;
$("btnRotate").onclick = () => {
  unlockAudio();
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => screen.orientation.lock("landscape"))
    .catch(() => { $("btnRotate").hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
};
function sendPresenceMenu() { if (S.room && S.me) { S.room.presence({ v: 1, r: S.me, sc: "menu", x: null, y: null }).catch(() => {}); S.sent = ""; } }
document.addEventListener("visibilitychange", () => { if (document.hidden && S.mode === "local" && S.screen === "play") showScreen("pause"); });
addEventListener("resize", resize);

function demo() {
  S.L = parseLevel(LEVELS[0], 0); buildCaches(S.L, view.cache);
  S.pengs = ["F", "B"].map((r) => newPenguin(r, S.L.starts[r])); S.remote = null; S.camY = 0;
  S.pengs.forEach((p) => (p.onGround = true));
}

// ---------- Bucle ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const sim = S.screen === "play" || S.screen === "win" || ((S.screen === "pause" || (S.screen === "help" && S.helpBack === "pause")) && S.mode === "online");
  if (sim && S.L) { acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 6) { step(1 / 60); acc -= 1 / 60; } if (n >= 6) acc = 0; }
  else acc = 0;
  if (S.L) updateCamera(dt, false);
  updateFx(dt, now / 1000);
  if (S.screen === "chars") paintCharPreviews(now / 1000);
  if (S.screen === "levels") drawMap(now / 1000);
  if (S.screen === "help") paintHelp(now / 1000);
  if (!$("gate").hidden) paintGate(now / 1000);

  render(now / 1000);
  sendPresence();
  requestAnimationFrame(frame);
}
paintMute(); paintPickCanvases(); resize(); demo(); showScreen("menu"); S.roomState = "none";
// un enlace con ?sala=CÓDIGO entra directo a esa sala
{ const q = new URLSearchParams(location.search).get("sala");
  if (q && /^[A-Za-z0-9]{4}$/.test(q)) { S.mode = "online"; showScreen("lobby"); openCodeRoom(q.toUpperCase(), false); } }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paintPickCanvases(); if (S.L) buildCaches(S.L, view.cache); });
requestAnimationFrame(frame);

// ---------- latido de la sala ----------
// No depende del dibujo: aunque el juego vaya lento o la pestaña quede atrás, el estado sigue saliendo.
function roomBeat() {
  sendPresence();
  const now = performance.now();
  if (S.roomKind === "code" && S.room && S.room.retry && !S.salaHost && now - (S.lastRetry || 0) > 4000) {
    // quien se unió vuelve a conectarse si se cortó o si hace rato no llega nada
    if (S.room.lost || (S.room.age && S.connected && S.room.age() > 6000 && S.room.age() !== Infinity)) { S.lastRetry = now; S.room.retry(true); }
  }
  // respaldo: si la pareja está jugando y yo no entré, un botón para entrar a su nivel
  const pr = partnerP(), box = $("follow");
  const show = S.mode === "online" && !!S.room && pr && pr.r && pr.r !== S.me && pr.sc === "play" && typeof pr.lv === "number" &&
    pr.lv >= 0 && pr.lv < LEVELS.length && !["play", "pause", "win"].includes(S.screen) && $("gate").hidden;
  if (show) $("followText").textContent = `Tu pareja está en el nivel ${pr.lv + 1} · ${LEVELS[pr.lv].name}`;
  box.hidden = !show;
}
function followPartner() {
  const pr = partnerP(); if (!pr || typeof pr.lv !== "number") return;
  S.pk = Math.max(S.pk, pr.pk || 0); S.rs = Math.max(S.rs, pr.rs || 0); S.runTime = 0; S.falls = 0;
  loadLevel(pr.lv); showScreen("play"); keepAwake(); S.sent = ""; sendPresence(true);
}
$("followGo").onclick = () => { unlockAudio(); followPartner(); };
setInterval(roomBeat, 250);
