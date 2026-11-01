// ---------- Motor: niveles y física ----------
const T = 20, COLS = 32, VIEW_ROWS = 18, W = COLS * T, H = VIEW_ROWS * T; // H = alto de pantalla; el nivel puede ser más alto
const PW = 14, PH = 18;
const PHYS = { run: 112, runIce: 140, runWater: 80, accG: 1100, accIce: 160, accA: 720, grav: 1400, maxFall: 430, jump: 392,
  gravW: 240, maxFallW: 62, stroke: 165, exitJump: 395, coyote: 0.09, buffer: 0.12, wind: 2100, windMax: 250,
  cling: 1.8, wallJumpX: 150, wallJumpY: 360, wallJumpCost: 0.35, reel: 85, ropeMin: 10, ropeBack: 140, swingMax: 420, swingAcc: 1200,
  airMax: 12, dive: 150, currentX: 110, currentUp: 150, currentDown: 130, seenMax: 0.45,
  throwV: 580, throwX: 130, seesawK: 1.55, seesawMax: 760, seesawMin: 180, lightR: 100, swapCd: 2.5 };
const TOG_COLOR = { 0: "#ff7eb6", 1: "#8be37a" };
const BTN_COLOR = { 1: "#b892ff", 2: "#6fe0c0", 3: "#ffd166" };
const P_COLOR = { F: "#46a8f0", B: "#ff8b4a" };
const P_NAME = { F: "Malu", B: "Nuka" };
const DOOR_OF = { a: 1, b: 2, c: 3 }, LIFT_OF = { x: 1, y: 2, z: 3 };

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const overlap = (ax, ay, aw, ah, b) => ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function parseLevel(def, index) {
  const R = def.rows.length, C = def.rows[0].length;
  const L = { def, index, R, C, H: R * T, W: C * T, cell: [], wet: [], wind: [], crumble: {}, buttons: [], doors: [], lifts: [], fish: [],
    spikes: [], icicles: [], checkpoints: [], key: null, starts: {}, exit: null, cp: -1,
    door: { 1: 0, 2: 0, 3: 0 }, pressed: { 1: false, 2: false, 3: false }, timer: { 1: 0, 2: 0, 3: 0 },
    timers: def.timers || {}, rope: def.rope || 0, ropeLen: def.rope || 0, time: 0,
    seesaws: [], crystals: [], levers: [], toggle: 0, occ: new Set(), light: null, hasGhost: false, swapCd: 0,
    vents: [], sentries: [], jellies: [], cage: null, ball: null, cur: [], flood: null, dt: 1 / 60 };
  for (let y = 0; y < R; y++) { L.cell.push(new Array(C).fill("")); L.wet.push(new Array(C).fill(false)); L.wind.push(new Array(C).fill(false)); L.cur.push(new Array(C).fill(0)); }
  for (const [x0, y0, x1, y1] of def.water || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.wet[y][x] = true;
  def.rows.forEach((row, y) => {
    let run = null;
    for (let x = 0; x <= C; x++) {
      const ch = row[x] || "";
      if (run && ch !== run.ch) { L.lifts.push(makeLift(def, run)); run = null; }
      if (LIFT_OF[ch]) { if (!run) run = { ch, x, y, n: 0 }; run.n++; continue; }
      if (x === C) break;
      switch (ch) {
        case "#": case "=": case "f": case "g": case "-": case "S": case "u": case "U": L.cell[y][x] = ch; break;
        case "h": L.cell[y][x] = ch; L.hasGhost = true; break;
        case ">": case "<": case "[": case "]": L.cur[y][x] = ch; break;
        case "q": L.vents.push({ cx: x, cy: y }); break;
        case "Q": L.sentries.push({ x: x * T + T / 2, y: y * T + T / 2, i: L.sentries.length, ang: 0, alert: false }); break;
        case "M": L.jellies.push({ x: x * T + T / 2, y0: y * T + T / 2, y: y * T + T / 2, ph: x * 0.7 + y }); break;
        case "C": L.cage = { x: x * T, y: y * T, w: 2 * T, h: T, kind: def.cage || "focas", open: false, t: 0 }; break; // jaula para dos: esta celda y la de la derecha
        case "o": L.crystals.push({ x: x * T + 3, y: y * T + 2, w: T - 6, h: T - 4, cx: x, cy: y }); break;
        case "L": L.levers.push({ x: x * T + 4, y: y * T + 4, w: T - 8, h: T - 4, cx: x, cy: y }); break;
        case "4": case "5": case "6": L.buttons.push({ id: +ch - 3, heavy: true, x: x * T + 2, y: y * T + T - 5, w: T - 4, h: 5, down: false }); break;
        case "%": L.cell[y][x] = ch; L.crumble[y * C + x] = { s: 0, t: 0 }; break;
        case "~": L.wet[y][x] = true; break;
        case "w": L.wind[y][x] = true; break;
        case "a": case "b": case "c": L.cell[y][x] = "d" + DOOR_OF[ch]; L.doors.push({ id: DOOR_OF[ch], x: x * T, y: y * T, w: T, h: T }); break;
        case "1": case "2": case "3": L.buttons.push({ id: +ch, x: x * T + 2, y: y * T + T - 5, w: T - 4, h: 5, down: false }); break;
        case "*": L.fish.push({ x: x * T + T / 2, y: y * T + T / 2, got: false }); break;
        case "^": L.spikes.push({ x: x * T + 3, y: y * T + 9, w: T - 6, h: T - 9, cx: x, cy: y }); break;
        case "v": L.icicles.push({ cx: x, x: x * T, y0: y * T, y: y * T, s: "hang", t: 0, vy: 0 }); break;
        case "k": L.key = { x: x * T + T / 2, y: y * T + T / 2, holder: null }; break;
        case "!": L.checkpoints.push({ x: x * T + T / 2, y: y * T + T, cx: x, cy: y }); break;
        case "F": case "B": L.starts[ch] = { x: x * T + (T - PW) / 2, y: y * T + T - PH }; break;
        case "E": L.exit = { x: x * T, y: (y - 1) * T, w: 2 * T, h: 2 * T }; break;
      }
    }
  });
  L.checkpoints.sort((a, b) => b.y - a.y).forEach((c, i) => (c.i = i)); // de abajo hacia arriba
  // bajo el agua: lo que no es roca y está bajo la línea de agua, es agua
  if (def.waterline != null) for (let y = def.waterline; y < R; y++) for (let x = 0; x < C; x++) if (L.cell[y][x] !== "#") L.wet[y][x] = true;
  for (const s of L.sentries) Object.assign(s, { base: Math.PI / 2, amp: 0.9, speed: 0.7, len: 150, half: 0.24 }, (def.sentries || [])[s.i] || {});
  if (def.flood) L.flood = Object.assign({}, def.flood, { surf: def.flood.low * T });
  if (def.ball) {
    const floor = L.starts.F ? L.starts.F.y + PH : L.H - 2 * T;
    L.ball = { x: -60, y: floor - 46, r: 46, vy: 0, rot: 0, t: 0, speed: def.ball.speed || 90,
      delay: def.ball.delay == null ? 3 : def.ball.delay, active: false };
  }
  // balancines: tramos horizontales de "S"; el pivote está en el centro
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    if (L.cell[y][x] !== "S" || (x > 0 && L.cell[y][x - 1] === "S")) continue;
    let x1 = x; while (x1 + 1 < C && L.cell[y][x1 + 1] === "S") x1++;
    L.seesaws.push({ y, x0: x, x1, mid: (x + x1 + 1) * T / 2, tilt: 0 });
  }
  return L;
}
function makeLift(def, r) {
  const cfg = (def.lifts || {})[r.ch] || [0, 0];
  return { id: LIFT_OF[r.ch], x0: r.x * T, y0: r.y * T, x: r.x * T, y: r.y * T, w: r.n * T, h: T,
    dx: cfg[0] * T, dy: cfg[1] * T, t: 0, mx: 0, my: 0 };
}

function cellSolid(L, cx, cy, pid) {
  if (cx < 0 || cx >= L.C || cy < 0) return true;
  if (cy >= L.R) return false;
  const c = L.cell[cy][cx];
  if (!c || c === "=") return false;
  if (c === "#" || c === "-" || c === "S") return true;
  if (c === "h") return !!L.light && !L.occ.has(cy * L.C + cx) && Math.hypot(cx * T + T / 2 - L.light.x, cy * T + T / 2 - L.light.y) <= PHYS.lightR;
  if (c === "u" || c === "U") return L.toggle === (c === "u" ? 0 : 1) && !L.occ.has(cy * L.C + cx);
  if (c === "%") return L.crumble[cy * L.C + cx].s !== 2;
  if (c === "f") return pid === "B";
  if (c === "g") return pid === "F";
  if (c[0] === "d") return L.door[c[1]] < 0.85;
  return false;
}
function cellAt(L, grid, x, y) {
  const cx = Math.floor(x / T), cy = Math.floor(y / T);
  return cy >= 0 && cy < L.R && cx >= 0 && cx < L.C && grid[cy][cx];
}
const isWet = (L, x, y) => cellAt(L, L.wet, x, y);
const windOn = (L) => !L.def.windBtn || L.pressed[L.def.windBtn];
const inWind = (L, x, y) => cellAt(L, L.wind, x, y) && windOn(L);

function blocked(L, p, x, y, oldBottom) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + PW - 0.01) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + PH - 0.01) / T);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (cellSolid(L, cx, cy, p.id)) return true;
    if (oldBottom != null && cy >= 0 && cy < L.R && cx >= 0 && cx < L.C && L.cell[cy][cx] === "=" &&
        oldBottom <= cy * T + 0.01 && y + PH > cy * T) return true;
  }
  // misma tolerancia que con los bloques, para poder pasar caminando del suelo a la plataforma
  for (const l of L.lifts) if (x < l.x + l.w && x + PW - 0.01 > l.x && y < l.y + l.h && y + PH - 0.01 > l.y) return true;
  return false;
}
function headBelow(p, x, ny, ob, others) {
  for (const o of others) {
    if (o === p || !o.visible || o.dead || !o.onGround) continue;
    if (x < o.x + PW - 3 && x + PW > o.x + 3 && ob <= o.y + 0.5 && ny + PH > o.y) return o;
  }
  return null;
}
function moveX(L, p, dx) {
  if (!dx) return;
  const n = Math.max(1, Math.ceil(Math.abs(dx))), s = dx / n;
  for (let i = 0; i < n; i++) {
    const nx = p.x + s;
    if (blocked(L, p, nx, p.y, null)) {
      // columpiándose, si llega justo al borde de una repisa, se sube
      if (p.swing && !p.onGround) {
        let k = 1;
        while (k <= 10 && blocked(L, p, nx, p.y - k, null)) k++;
        if (k <= 10 && !blocked(L, p, p.x, p.y - k, null)) { p.y -= k; p.x = nx; p.vy = Math.min(p.vy, 0); continue; }
      }
      let lo = 0, hi = s;
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (blocked(L, p, p.x + m, p.y, null)) hi = m; else lo = m; }
      p.x += lo; p.vx = 0; return;
    }
    p.x = nx;
  }
}
function moveY(L, p, dy, others) {
  if (!dy) return;
  const n = Math.max(1, Math.ceil(Math.abs(dy))), s = dy / n;
  for (let i = 0; i < n; i++) {
    const ny = p.y + s, ob = p.y + PH;
    const hit = s > 0 ? (blocked(L, p, p.x, ny, ob) || headBelow(p, p.x, ny, ob, others)) : blocked(L, p, p.x, ny, null);
    if (hit) {
      let lo = 0, hi = s;
      for (let k = 0; k < 6; k++) {
        const m = (lo + hi) / 2, y = p.y + m;
        const h = s > 0 ? (blocked(L, p, p.x, y, ob) || headBelow(p, p.x, y, ob, others)) : blocked(L, p, p.x, y, null);
        if (h) hi = m; else lo = m;
      }
      p.y += lo; p.vy = 0; return;
    }
    p.y = ny;
  }
}
function findSupport(L, p, others) {
  const b = p.y + PH, cy = Math.round(b / T);
  for (const l of L.lifts) if (p.x < l.x + l.w && p.x + PW > l.x && Math.abs(b - l.y) < 0.8) return { k: "l", o: l };
  if (Math.abs(b - cy * T) < 0.6) {
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 0.01) / T);
    let found = false, grip = false;
    for (let cx = x0; cx <= x1; cx++) {
      const inside = cy >= 0 && cy < L.R && cx >= 0 && cx < L.C;
      if (cellSolid(L, cx, cy, p.id) || (inside && L.cell[cy][cx] === "=" && p.vy >= 0)) { found = true; if (!(inside && L.cell[cy][cx] === "-")) grip = true; }
    }
    if (found) return { k: "t", ice: !grip };
  }
  for (const o of others) {
    if (o !== p && o.visible && !o.dead && o.onGround && p.x < o.x + PW - 3 && p.x + PW > o.x + 3 && Math.abs(b - o.y) < 1.2) return { k: "p", o };
  }
  return null;
}

function newPenguin(id, s) {
  return { id, x: s.x, y: s.y, vx: 0, vy: 0, face: id === "F" ? 1 : -1, onGround: false, support: null, coyote: 0, buf: 0,
    stroke: 0, wet: false, anim: 0, dead: false, inExit: false, prevX: s.x, prevY: s.y, squash: 0, remote: false, visible: true,
    anchor: false, reel: false, cling: 0, stamina: PHYS.cling, wallLock: 0 };
}

// Botones, puertas, plataformas, hielo frágil y carámbanos. pengs incluye al pingüino remoto.
function updateWorld(L, pengs, dt, ev) {
  L.time += dt;
  const alive = pengs.filter((p) => p.visible && !p.dead);
  const was = { ...L.pressed };
  const raw = { 1: false, 2: false, 3: false };
  // la linterna de Fred
  const lamp = L.hasGhost && alive.find((p) => p.id === (L.def.lantern || "F"));
  L.light = lamp ? { x: lamp.x + PW / 2, y: lamp.y + PH / 2 } : null;
  // un bloque fantasma o de color no aparece encima de un pingüino
  L.occ.clear();
  for (const p of alive) for (let cy = Math.floor(p.y / T); cy <= Math.floor((p.y + PH - 0.02) / T); cy++)
    for (let cx = Math.floor(p.x / T); cx <= Math.floor((p.x + PW - 0.02) / T); cx++) {
      const c = cy >= 0 && cy < L.R && cx >= 0 && cx < L.C && L.cell[cy][cx];
      if (c === "h" || c === "u" || c === "U") L.occ.add(cy * L.C + cx);
    }
  for (const b of L.buttons) {
    // el botón pesado necesita a los dos (uno encima del otro también vale)
    b.down = b.heavy ? alive.filter((p) => overlap(p.x, p.y, PW, PH, { x: b.x, y: b.y - PH - 3, w: b.w, h: b.h + PH + 3 })).length >= 2
      : alive.some((p) => overlap(p.x, p.y, PW, PH + 1, b));
    if (b.down) raw[b.id] = true;
  }
  for (const s of L.seesaws) s.tilt = approach(s.tilt, 0, dt * 2.5);
  L.dt = dt;
  // compuerta de inundación: el agua sube mientras su botón está apretado y baja al soltarlo
  if (L.flood) {
    const f = L.flood, target = (L.pressed[f.btn] ? f.high : f.low) * T;
    f.surf = approach(f.surf, target, dt * 26);
    for (let y = Math.min(f.high, f.low); y <= f.bottom; y++) for (let x = f.x0; x <= f.x1; x++) L.wet[y][x] = y * T + T / 2 > f.surf;
  }
  // la bola de nieve gigante: rueda hacia la derecha siguiendo el terreno y aplasta todo
  const ball = L.ball;
  if (ball && !ball.stop) {
    ball.t += dt;
    if (ball.t >= ball.delay) {
      ball.active = true; ball.x += ball.speed * dt; ball.rot += (ball.speed * dt) / ball.r;
      const bx = Math.floor(ball.x / T);
      if (bx >= 1 && bx < L.C - 1) {
        let ground = L.H + 200;
        for (let cy = Math.max(0, Math.floor((ball.y + ball.r * 0.2) / T)); cy < L.R; cy++) if (cellSolid(L, bx, cy, "")) { ground = cy * T; break; }
        // sin suelo en esta columna (un foso sin fondo): sigue rodando a la misma altura
        const ty = ground > L.H ? Math.min(ball.y, L.H - ball.r) : ground - ball.r;
        if (ty < ball.y) { ball.y = approach(ball.y, ty, dt * 260); ball.vy = 0; }
        else { ball.vy = Math.min(ball.vy + PHYS.grav * dt, 600); ball.y = Math.min(ty, ball.y + ball.vy * dt); if (ball.y >= ty) ball.vy = 0; }
      }
    }
  }
  // rapes abisales: su luz barre el agua de un lado a otro
  for (const s of L.sentries) {
    if (s.hunt) {
      // atrapó a alguien: nada hasta él, cada vez más rápido, y se lo come
      const p = s.hunt, tx = p.x + PW / 2, ty = p.y + PH / 2, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
      s.ang = Math.atan2(dy, dx); s.alert = true; s.v = Math.min(240, (s.v || 30) + 420 * dt);
      if (d <= s.v * dt + 5) {
        s.x = tx; s.y = ty; s.hunt = null; s.full = 0.01;
        if (!p.dead) { p.dead = true; p.eaten = true; ev.push(["die", p]); ev.push(["chomp", s]); }
      } else { s.x += (dx / d) * s.v * dt; s.y += (dy / d) * s.v * dt; }
    } else if (s.full) { s.full += dt; s.alert = false; }
    else { s.ang = s.base + s.amp * Math.sin(L.time * s.speed + s.i * 1.7); s.alert = false; }
  }
  // medusas: suben y bajan
  for (const j of L.jellies) j.y = j.y0 + Math.sin(L.time * 1.4 + j.ph) * 24;
  if (L.cage && L.cage.open) L.cage.t += dt;
  // una bandera solo se activa con los dos cerca a la vez
  for (const c of L.checkpoints) {
    if (c.i <= L.cp || alive.length < 2) continue;
    if (alive.every((p) => Math.abs(p.x + PW / 2 - c.x) < 90 && Math.abs(p.y + PH - c.y) < 40)) { L.cp = c.i; ev.push(["checkpoint", c]); }
  }
  L.swapCd = Math.max(0, L.swapCd - dt);
  for (const id of [1, 2, 3]) {
    const secs = L.timers[id];
    if (secs) L.timer[id] = raw[id] ? secs : Math.max(0, L.timer[id] - dt);
    L.pressed[id] = raw[id] || L.timer[id] > 0;
    if (L.pressed[id] !== was[id]) ev.push([L.pressed[id] ? "press" : "release", id]);
    let want = L.pressed[id] ? 1 : 0;
    if (!want && L.door[id] > 0 && L.doors.some((d) => d.id === id && alive.some((p) => overlap(p.x + 1, p.y + 1, PW - 2, PH - 2, d)))) want = 1;
    L.door[id] = approach(L.door[id], want, dt * 5);
  }
  for (const l of L.lifts) {
    l.mx = 0; l.my = 0;
    const want = L.pressed[l.id] ? 1 : 0;
    if (l.t === want) continue;
    const dist = Math.hypot(l.dx, l.dy) || 1;
    const nt = approach(l.t, want, dt * 64 / dist);
    const rect = { x: l.x0 + l.dx * nt, y: l.y0 + l.dy * nt, w: l.w, h: l.h };
    let ok = true;
    const riders = [];
    for (const p of alive) {
      if (p.remote) continue;
      const rider = Math.abs(p.y + PH - l.y) < 1.6 && p.x < l.x + l.w && p.x + PW > l.x;
      if (rider) riders.push(p);
      else if (overlap(p.x, p.y, PW, PH, rect)) { ok = false; break; }
    }
    if (ok) {
      l.mx = rect.x - l.x; l.my = rect.y - l.y; l.x = rect.x; l.y = rect.y; l.t = nt;
      for (const p of riders) { p.y = l.y - PH; moveX(L, p, l.mx); p.support = { k: "l", o: l }; }
    }
  }
  // hielo frágil: tiembla al pisarlo, se cae y vuelve
  for (const p of alive) {
    if (!p.onGround) continue;
    const cy = Math.round((p.y + PH) / T);
    if (cy < 0 || cy >= L.R || Math.abs(p.y + PH - cy * T) > 1) continue;
    for (let cx = Math.floor(p.x / T); cx <= Math.floor((p.x + PW - 0.01) / T); cx++) {
      const c = L.crumble[cy * L.C + cx];
      if (c && c.s === 0) { c.s = 1; c.t = 0; ev.push(["crack"]); }
    }
  }
  for (const k in L.crumble) {
    const c = L.crumble[k];
    if (c.s === 0) continue;
    c.t += dt;
    if (c.s === 1 && c.t > 0.6) { c.s = 2; c.t = 0; ev.push(["break", +k]); }
    else if (c.s === 2 && c.t > 2.6) {
      const cell = { x: (k % L.C) * T, y: Math.floor(k / L.C) * T, w: T, h: T };
      if (!alive.some((p) => overlap(p.x, p.y, PW, PH, cell))) { c.s = 0; c.t = 0; }
    }
  }
  // carámbanos: caen cuando alguien pasa debajo
  for (const ic of L.icicles) {
    if (ic.s === "hang") {
      if (alive.some((p) => Math.abs(p.x + PW / 2 - (ic.x + T / 2)) < 16 && p.y > ic.y0 && p.y < ic.y0 + 10 * T)) { ic.s = "shake"; ic.t = 0; ev.push(["shake", ic]); }
    } else if (ic.s === "shake") {
      ic.t += dt; if (ic.t > 0.65) { ic.s = "fall"; ic.vy = 0; }
    } else if (ic.s === "fall") {
      ic.vy = Math.min(ic.vy + PHYS.grav * dt, 520); ic.y += ic.vy * dt;
      const tip = ic.y + T - 2;
      if (tip > L.H || cellSolid(L, ic.cx, Math.floor(tip / T), "")) { ic.s = "gone"; ic.t = 0; ev.push(["shatter", ic]); }
    } else if ((ic.t += dt) > 3) { ic.s = "hang"; ic.y = ic.y0; }
  }
}

function applyCarry(L, p) {
  const s = p.support;
  if (!s || s.k !== "p") return;
  const o = s.o, ty = o.y - PH;
  if (o.dead || !o.visible) { p.support = null; return; }
  // si el de abajo salta, el de arriba no sale disparado: se queda sin apoyo y cae
  if (o.y - o.prevY < -2) { p.support = null; return; }
  if (!blocked(L, p, p.x, ty, null)) p.y = ty; else { p.support = null; return; }
  moveX(L, p, o.x - o.prevX);
}

function stepPenguin(L, p, inp, others, dt, ev) {
  if (p.caught) { p.vx = 0; p.vy = 0; p.inExit = false; p.anim += dt; return; } // congelado por la luz del rape
  const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  p.wet = isWet(L, p.x + PW / 2, p.y + PH / 2);
  const ice = p.onGround && p.support && p.support.ice;
  const canGrab = !!L.rope || !!L.def.grab || !!L.def.throw;
  if (L.def.throw && inp.gp && p.onGround && !p.wet) ev.push(["throw", p]);
  p.buf = inp.jp ? PHYS.buffer : Math.max(0, p.buf - dt);
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
  p.stroke = Math.max(0, p.stroke - dt);
  p.wallLock = Math.max(0, p.wallLock - dt);
  p.tug = Math.max(0, (p.tug || 0) - dt);
  p.swing = Math.max(0, (p.swing || 0) - dt);
  p.under = Math.max(0, (p.under || 0) - dt);
  if (p.onGround) p.stamina = PHYS.cling;
  // anclarse al suelo (nunca sobre hielo resbaloso) o agarrarse de una pared
  p.anchor = canGrab && !!inp.g && p.onGround && !ice && !p.wet;
  p.reel = p.anchor && !!inp.j;
  let wall = 0;
  if ((!!L.rope || !!L.def.grab) && inp.g && !p.onGround && !p.wet && p.stamina > 0 && !p.wallLock && p.vy > -220) {
    if (blocked(L, p, p.x + 1, p.y, null)) wall = 1; else if (blocked(L, p, p.x - 1, p.y, null)) wall = -1;
  }
  if (wall && !p.cling) ev.push(["grab", p]);
  p.cling = wall;
  if (dir && !p.anchor && !p.cling) p.face = dir;

  if (p.anchor) {
    p.vx = approach(p.vx, 0, PHYS.accG * 2 * dt);
    p.buf = 0;
  } else if (p.cling) {
    p.vx = 0; p.vy = 0; p.face = p.cling;
    p.stamina = Math.max(0, p.stamina - dt);
    if (p.buf > 0) {
      p.vx = -p.cling * PHYS.wallJumpX; p.vy = -PHYS.wallJumpY; p.buf = 0;
      p.stamina = Math.max(0, p.stamina - PHYS.wallJumpCost); p.wallLock = 0.2; p.face = -p.cling; p.cling = 0;
      ev.push(["jump", p]);
    }
  } else if (p.onGround && p.tug && !dir) {
    // la cuerda tensa lo arrastra: sin frenar
  } else if (p.onGround) {
    p.vx = approach(p.vx, dir * (p.wet ? PHYS.runWater : ice ? PHYS.runIce : PHYS.run), (ice ? PHYS.accIce : PHYS.accG) * dt);
  } else if (dir) {
    // colgando de la cuerda, empujar hacia donde va el vaivén da impulso
    const sp = p.wet ? PHYS.runWater : p.swing ? PHYS.swingMax : PHYS.run;
    if (dir * p.vx < sp) p.vx = approach(p.vx, dir * sp, (p.swing ? PHYS.swingAcc : PHYS.accA) * dt);
  } else p.vx = p.wet ? approach(p.vx, 0, PHYS.accA * dt) : p.vx * (1 - 0.8 * dt);

  if (p.cling) {
    // quieto en la pared mientras le dure la fuerza
  } else if (p.wet) {
    // bajo el agua, mantener Agarrar es bucear hacia abajo; tocarlo junto a tu pareja comparte el aire
    const diving = L.def.air && inp.g;
    p.vy = Math.min(p.vy + (diving ? 900 : PHYS.gravW) * dt, diving ? PHYS.dive : Math.max(PHYS.maxFallW, p.vy - 400 * dt));
    if (L.def.air && inp.gp) ev.push(["share", p]);
    if (p.buf > 0 && p.stroke <= 0) {
      const nearTop = !isWet(L, p.x + PW / 2, p.y + PH / 2 - 12);
      p.vy = nearTop ? -PHYS.exitJump : -PHYS.stroke;
      p.stroke = 0.22; p.buf = 0; p.support = null;
      ev.push(["swim", p]);
    }
  } else {
    p.vy = Math.min(p.vy + PHYS.grav * dt, PHYS.maxFall);
    if (!p.anchor && p.buf > 0 && p.coyote > 0) {
      // al saltar desde una plataforma móvil, conserva su velocidad
      if (p.support && p.support.k === "l") p.vx += p.support.o.mx / dt;
      p.vy = -PHYS.jump; p.buf = 0; p.coyote = 0; p.onGround = false; p.support = null;
      ev.push(["jump", p]);
    }
    // soltar saltar corta el salto, pero no a quien salió lanzado
    if (p.launched && (p.vy >= 0 || p.onGround)) p.launched = false;
    // colgando debajo de la pareja no se corta: el vaivén sube igual sin mantener Saltar
    if (!inp.j && !p.launched && !p.under && p.vy < -120) p.vy += PHYS.grav * 1.1 * dt;
  }
  if (inWind(L, p.x + PW / 2, p.y + PH / 2)) p.vy = Math.max(p.vy - PHYS.wind * dt, -PHYS.windMax);
  // corrientes de agua: arrastran aunque no te muevas; nadar en contra apenas avanza
  const cur = cellAt(L, L.cur, p.x + PW / 2, p.y + PH / 2);
  const driftX = cur === ">" ? PHYS.currentX : cur === "<" ? -PHYS.currentX : 0;
  const driftY = cur === "[" ? -PHYS.currentUp : cur === "]" ? PHYS.currentDown : 0;
  // aire: se gasta con la cabeza bajo el agua y se recupera arriba o en las burbujas
  if (L.def.air) {
    if (p.air == null) p.air = PHYS.airMax;
    const inBubbles = L.vents.some((v) => p.x + PW > v.cx * T - 4 && p.x < v.cx * T + T + 4 && p.y + PH > (v.cy - 5) * T && p.y < v.cy * T + T);
    if (inBubbles) p.air = Math.min(PHYS.airMax, p.air + dt * 8);
    else if (isWet(L, p.x + PW / 2, p.y + 3)) p.air = Math.max(0, p.air - dt);
    else p.air = Math.min(PHYS.airMax, p.air + dt * 5);
  }
  moveX(L, p, (p.vx + driftX) * dt);
  // altura desde la que viene cayendo (para el balancín)
  if (p.onGround || p.vy <= 0 || p.apexY == null) p.apexY = p.y;
  moveY(L, p, (p.vy + driftY) * dt, others);
  const vyFall = Math.sqrt(2 * PHYS.grav * Math.max(0, p.y - p.apexY));
  const wasGround = p.onGround;
  p.support = findSupport(L, p, others);
  p.onGround = !!p.support;
  if (p.onGround && p.vy > 0) p.vy = 0;
  if (p.onGround && !wasGround) { p.squash = 1; ev.push(["land", p, vyFall]); }
  p.squash = Math.max(0, p.squash - dt * 6);
  p.anim += dt;
  checkHazards(L, p, ev);
}

// La cuerda. El anclado, el que cuelga de una pared y el pingüino remoto no se mueven aquí;
// si nadie está anclado, quien cae arrastra al otro.
const invMass = (p) => (p.remote || p.anchor || p.cling ? 0 : 1);
function tug(L, q, ddx, ddy, reeling) {
  const x0 = q.x, y0 = q.y;
  // si ya eligió por dónde salir de debajo de una repisa, sigue hacia allá un momento aunque la cuerda tire al otro lado
  if (q.esc && q.esc.t > 0 && reeling) { q.esc.t -= L.dt || 1 / 60; if (Math.sign(ddx) === -q.esc.dir) ddx = 0; }
  moveX(L, q, ddx);
  // al jalar, si una pared frena al de abajo, trepa por ella hasta pasar el borde
  if (reeling && Math.abs(q.x - x0) < Math.abs(ddx) * 0.5 && ddy < 1) moveY(L, q, -Math.abs(ddx) - Math.max(0, -ddy), []);
  else moveY(L, q, ddy, []);
  // y si el borde de una repisa lo tapa por arriba, se corre poquito hacia el lado libre más cercano,
  // primero hacia quien jala (antes se iba siempre a la derecha y salía disparado lejos con la cuerda estirada)
  if (reeling && ddy < -0.2 && q.y > y0 + ddy * 0.5) {
    const toward = ddx > 0.05 ? 1 : ddx < -0.05 ? -1 : 0;
    const order = q.esc && q.esc.t > 0 ? [q.esc.dir, -q.esc.dir] : toward ? [toward, -toward] : [1, -1];
    for (let k = 4; k <= 60; k += 4) {
      const dir = order.find((s) => !blocked(L, q, q.x + s * k, q.y, null) && !blocked(L, q, q.x + s * k, q.y - 6, null));
      if (dir) { moveX(L, q, dir * Math.min(3, Math.abs(ddy) + Math.abs(ddx) + 1)); q.esc = { dir, t: 0.25 }; break; }
    }
  }
  q.tug = 0.12;
}
function ropeStep(L, a, b, dt) {
  if (!L.rope || !a || !b || a.dead || b.dead || !a.visible || !b.visible) return;
  const ax = a.x + PW / 2, ay = a.y + PH / 2, bx = b.x + PW / 2, by = b.y + PH / 2;
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.001;
  const reeling = (a.anchor && a.reel) || (b.anchor && b.reel);
  if (reeling) L.ropeLen = Math.max(PHYS.ropeMin, Math.min(L.ropeLen, d) - PHYS.reel * dt, d - 12); // nunca más corta que la distancia real menos 12
  else {
    // sin nadie jalando, la cuerda recupera su largo, salvo que sostenga a alguien que cuelga más abajo
    const hanging = L.ropeTaut && ((!a.onGround && !a.anchor && ay > by + 4) || (!b.onGround && !b.anchor && by > ay + 4));
    if (!hanging) L.ropeLen = Math.min(L.rope, L.ropeLen + PHYS.ropeBack * dt);
  }
  L.ropeTaut = d >= L.ropeLen - 1;
  if (L.ropeTaut) for (const q of [a, b]) if (!q.onGround && !q.remote && !q.anchor && !q.cling && !q.wet) { q.swing = 0.12; if (q.y > (q === a ? b : a).y + 10) q.under = 0.12; }
  if (d <= L.ropeLen) return;
  const nx = dx / d, ny = dy / d, over = d - L.ropeLen;
  const wa = invMass(a), wb = invMass(b), sum = wa + wb;
  if (!sum) return;
  if (wa) tug(L, a, nx * over * wa / sum, ny * over * wa / sum, reeling);
  if (wb) tug(L, b, -nx * over * wb / sum, -ny * over * wb / sum, reeling);
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel > 0) {
    a.vx += nx * rel * wa / sum; a.vy += ny * rel * wa / sum;
    b.vx -= nx * rel * wb / sum; b.vy -= ny * rel * wb / sum;
  }
}

function checkHazards(L, p, ev) {
  if (p.dead || p.caught) return;
  let die = p.y > L.H + 30;
  for (const s of L.spikes) if (overlap(p.x + 2, p.y + 2, PW - 4, PH - 2, s)) die = true;
  for (const ic of L.icicles) if (ic.s !== "gone" && overlap(p.x + 2, p.y + 2, PW - 4, PH - 2, { x: ic.x + 6, y: ic.y + 2, w: 8, h: 15 })) die = true;
  if (L.def.air && p.air != null && p.air <= 0) die = true;
  if (L.ball && L.ball.active && p.x + PW / 2 < L.ball.x + L.ball.r * 0.85) die = true;
  for (const j of L.jellies) if (overlap(p.x + 2, p.y + 2, PW - 4, PH - 4, { x: j.x - 6, y: j.y - 6, w: 12, h: 12 })) die = true;
  let seenBy = null;
  for (const s of L.sentries) if (!s.full && inBeam(L, s, p)) { seenBy = s; s.alert = true; }
  p.seen = seenBy ? (p.seen || 0) + L.dt : Math.max(0, (p.seen || 0) - L.dt * 2);
  // si la luz lo ve un momento, se queda congelado y el rape va por él
  if (p.seen > PHYS.seenMax && seenBy && !seenBy.hunt) { p.caught = true; seenBy.hunt = p; ev.push(["caught", p]); }
  if (die) { p.dead = true; ev.push(["die", p]); return; }
  const cx = p.x + PW / 2, cy = p.y + PH / 2;
  for (const f of L.fish) {
    if (f.got) continue;
    const dx = cx - f.x, dy = cy - f.y;
    if (dx * dx + dy * dy < 13 * 13) { f.got = true; ev.push(["fish", f]); }
  }
  if (L.key && !L.key.holder && Math.hypot(cx - L.key.x, cy - L.key.y) < 14) { L.key.holder = p.id; ev.push(["key", p]); }
  if (L.cage && !L.cage.open && overlap(p.x, p.y, PW, PH, L.cage)) { L.cage.open = true; L.cage.t = 0; ev.push(["rescue", L.cage]); }
  const e = L.exit;
  p.inExit = !!e && (!L.key || !!L.key.holder) && cx > e.x + 2 && cx < e.x + e.w - 2 && cy > e.y && cy < e.y + e.h + 2;
}

// ---------- Mundo 4: balancín, lanzar, cristal ----------
function seesawAt(L, p) {
  if (!p.onGround || !p.support || p.support.k !== "t") return null;
  const cy = Math.round((p.y + PH) / T), cx = p.x + PW / 2;
  for (const s of L.seesaws) if (s.y === cy && cx >= s.x0 * T - 2 && cx <= (s.x1 + 1) * T + 2) return { s, side: cx < s.mid ? -1 : 1 };
  return null;
}
function launch(p, v, vx) {
  p.vy = -v; if (vx != null) p.vx = vx; p.launched = true;
  p.onGround = false; p.support = null; p.coyote = 0; p.buf = 0; p.squash = 0;
}
function teleport(p, x, y) {
  p.x = x; p.y = y; p.prevX = x; p.prevY = y; p.vx = 0; p.vy = 0; p.support = null; p.onGround = false;
}

// Balancín, lanzar a la pareja, cristal de intercambio y palancas.
// Cada dispositivo mueve solo a su pingüino; lo que le pasa al del otro viaja por la presencia.
function coopEvents(L, locals, ev, net, remote) {
  const online = !!remote;
  const partnerOf = (p) => (online ? (remote.visible ? remote : null) : locals.find((q) => q !== p));
  for (const [k, p, imp] of [...ev]) {
    if (k === "land" && imp >= PHYS.seesawMin) {
      const at = seesawAt(L, p); if (!at) continue;
      at.s.tilt = at.side;
      if (!p.remote && online) { net.ld = (net.ld || 0) + 1; net.imp = Math.round(imp); }
      const v = Math.min(PHYS.seesawMax, imp * PHYS.seesawK);
      for (const q of locals) {
        if (q === p || q.dead) continue;
        const qa = seesawAt(L, q);
        if (qa && qa.s === at.s && qa.side === -at.side) { launch(q, v, q.vx); ev.push(["boing", q]); }
      }
    } else if (k === "share") {
      const q = locals.find((o) => o !== p && !o.dead && Math.abs(o.x - p.x) < 16 && Math.abs(o.y - p.y) < 18);
      if (q && q.air != null && p.air != null) { const m = (q.air + p.air) / 2; q.air = m; p.air = m; ev.push(["shareAir", p]); }
    } else if (k === "throw") {
      const top = locals.find((q) => q !== p && q.support && q.support.o === p);
      if (top) { launch(top, PHYS.throwV, p.face * PHYS.throwX); ev.push(["boing", top]); }
      else if (online && remote && remote.visible && Math.abs(remote.y + PH - p.y) < 4 && Math.abs(remote.x - p.x) < PW) {
        net.th = (net.th || 0) + 1; ev.push(["boing", remote]);
      }
    }
  }
  for (const p of locals) {
    if (p.dead) continue;
    // cristal: cambia de lugar con la pareja al tocarlo
    const onC = L.crystals.some((c) => overlap(p.x, p.y, PW, PH, c));
    if (onC && !p.onCrystal && L.swapCd <= 0) {
      const q = partnerOf(p);
      if (q && !q.dead) {
        const px = p.x, py = p.y;
        teleport(p, q.x, q.y);
        if (online) { net.sw = (net.sw || 0) + 1; net.swx = Math.round(px * 10) / 10; net.swy = Math.round(py * 10) / 10; }
        else { teleport(q, px, py); q.onCrystal = true; }
        L.swapCd = PHYS.swapCd; ev.push(["swap", p]); ev.push(["swap", q]);
      }
    }
    p.onCrystal = L.crystals.some((c) => overlap(p.x, p.y, PW, PH, c));
    // palanca: cada toque alterna qué bloques de color existen
    const onL = L.levers.some((lv) => overlap(p.x, p.y, PW, PH, lv));
    if (onL && !p.onLever) { net.tgLocal = (net.tgLocal || 0) + 1; ev.push(["lever", p]); }
    p.onLever = onL;
  }
  L.toggle = ((net.tgLocal || 0) + (net.tgRemote || 0)) % 2;
}


// ¿Está el pingüino en la luz del rape? (dentro del cono, al alcance y sin roca ni compuerta en medio)
function inBeam(L, s, p) {
  const tx = p.x + PW / 2, ty = p.y + PH / 2, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
  if (d > s.len || d < 1) return false;
  let da = Math.atan2(dy, dx) - s.ang;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  if (Math.abs(da) > s.half) return false;
  for (let k = 10; k < d; k += 5) {
    const x = s.x + (dx * k) / d, y = s.y + (dy * k) / d;
    if (cellSolid(L, Math.floor(x / T), Math.floor(y / T), "")) return false;
  }
  return true;
}
