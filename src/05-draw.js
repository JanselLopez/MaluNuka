// ---------- Dibujo ----------
function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fill(); }
function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }

function buildCaches(L, scale) {
  scale = Math.min(scale, 3);
  const mk = (w, h) => { const cv = document.createElement("canvas"); cv.width = Math.ceil(w * scale); cv.height = Math.ceil(h * scale); const g = cv.getContext("2d"); g.scale(scale, scale); return [cv, g]; };
  const [sky, gs] = mk(W, H); drawSky(gs, L.index, L.def.world);
  const [tiles, gt] = mk(L.W, L.H); drawStatic(gt, L);
  L.sky = sky; L.tiles = tiles; L.cacheScale = scale;
}

function drawSky(g, seed, world) {
  if (world === 6) return drawSkySea(g, seed);
  if (world === 7) return drawSkyDawn(g, seed);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#061022"); gr.addColorStop(0.55, "#0f2440"); gr.addColorStop(1, "#1a3a58");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(7 + seed * 31);
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.25 + r() * 0.6; g.fillStyle = "#e8f4ff";
    const s = r() < 0.15 ? 1.4 : 0.8; g.fillRect(r() * W, r() * H * 0.6, s, s);
  }
  g.globalAlpha = 1;
  const ridge = (base, amp, col, step) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + step; x += step) g.lineTo(x, base - r() * amp);
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  ridge(250, 70, "#132b47", 40); ridge(290, 50, "#17334f", 28);
}

// bajo el hielo: azul verdoso profundo con haces de luz y algas a lo lejos
function drawSkySea(g, seed) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#0a2e47"); gr.addColorStop(0.5, "#07263b"); gr.addColorStop(1, "#041624");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(11 + seed * 29);
  g.save(); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const x = r() * W, w = 30 + r() * 50, lean = 60 + r() * 80;
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, "rgba(140,220,240,.10)"); lg.addColorStop(1, "rgba(140,220,240,0)");
    g.fillStyle = lg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + lean, H); g.lineTo(x + lean, H); g.closePath(); g.fill();
  }
  g.restore();
  for (let i = 0; i < 14; i++) {
    const x = r() * W, h = 40 + r() * 90; g.strokeStyle = "rgba(40,110,100,.35)"; g.lineWidth = 3 + r() * 3; g.beginPath(); g.moveTo(x, H);
    for (let k = 1; k <= 6; k++) g.lineTo(x + Math.sin(k * 1.3 + i) * 6, H - (h * k) / 6);
    g.stroke();
  }
  g.fillStyle = "#06202f"; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W + 30; x += 30) g.lineTo(x, H - 26 - r() * 30);
  g.lineTo(W, H); g.closePath(); g.fill();
  for (let i = 0; i < 26; i++) { g.strokeStyle = "rgba(210,245,255," + (0.12 + r() * 0.25) + ")"; g.lineWidth = 0.8; g.beginPath(); g.arc(r() * W, r() * H, 1 + r() * 2.2, 0, Math.PI * 2); g.stroke(); }
}
// la avalancha: amanecer rosado detrás de las montañas nevadas
function drawSkyDawn(g, seed) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#16223f"); gr.addColorStop(0.45, "#4b3f6e"); gr.addColorStop(0.8, "#c46f7d"); gr.addColorStop(1, "#f1ab80");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(5 + seed * 37);
  for (let i = 0; i < 40; i++) { g.globalAlpha = 0.2 + r() * 0.5; g.fillStyle = "#f3f0ff"; g.fillRect(r() * W, r() * H * 0.3, 0.9, 0.9); }
  g.globalAlpha = 1;
  const sx = W * (0.25 + r() * 0.5), sy = H * 0.86;
  const sg = g.createRadialGradient(sx, sy, 4, sx, sy, 150);
  sg.addColorStop(0, "rgba(255,226,170,.9)"); sg.addColorStop(0.2, "rgba(255,196,140,.45)"); sg.addColorStop(1, "rgba(255,170,130,0)");
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  const peaks = (base, amp, col, cap, step) => {
    const pts = []; for (let x = -step; x <= W + step; x += step) pts.push([x, base - r() * amp]);
    g.fillStyle = col; g.beginPath(); g.moveTo(-step, H); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(W + step, H); g.closePath(); g.fill();
    g.fillStyle = cap;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i]; if (y > pts[i - 1][1] || y > pts[i + 1][1]) continue;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - step * 0.28, y + 16); g.lineTo(x - step * 0.08, y + 12); g.lineTo(x + step * 0.1, y + 17); g.lineTo(x + step * 0.3, y + 15); g.closePath(); g.fill();
    }
  };
  peaks(250, 110, "#3b3560", "rgba(255,236,236,.75)", 70); peaks(295, 60, "#2a2a4c", "rgba(240,230,245,.55)", 46);
}

const solidAt = (L, x, y) => y < 0 || x < 0 || x >= L.C || y >= L.R || L.cell[y][x] === "#" || L.cell[y][x] === "-";

function drawStatic(g, L) {
  const r = rng(99 + L.index * 17);
  for (let y = 0; y < L.R; y++) for (let x = 0; x < L.C; x++) {
    const ch = L.cell[y][x];
    if (ch !== "#" && ch !== "-") continue;
    const px = x * T, py = y * T, open = !solidAt(L, x, y - 1);
    if (ch === "-") {
      g.fillStyle = "#8fd3ef"; g.fillRect(px, py, T, T);
      g.fillStyle = "#c9eefb"; g.fillRect(px, py, T, 3);
      g.fillStyle = "rgba(255,255,255,.45)";
      g.beginPath(); g.moveTo(px + 3, py + 16); g.lineTo(px + 9, py + 6); g.lineTo(px + 11, py + 6); g.lineTo(px + 5, py + 16); g.fill();
      g.fillStyle = "rgba(20,70,110,.25)"; g.fillRect(px, py + T - 2, T, 2);
      continue;
    }
    const deep = solidAt(L, x - 1, y) && solidAt(L, x + 1, y) && solidAt(L, x, y + 1) && !open;
    g.fillStyle = deep ? "#183553" : "#22476b"; g.fillRect(px, py, T, T);
    g.fillStyle = "rgba(160,210,240,.10)";
    if (!solidAt(L, x - 1, y)) g.fillRect(px, py, 3, T);
    if (!solidAt(L, x + 1, y)) { g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(px + T - 3, py, 3, T); }
    if (!solidAt(L, x, y + 1)) { g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(px, py + T - 3, T, 3); }
    g.fillStyle = "rgba(190,230,250,.12)";
    for (let k = 0; k < 2; k++) g.fillRect(px + 3 + r() * 13, py + 5 + r() * 11, 3 + r() * 4, 1);
    if (open) {
      g.fillStyle = "#eef6fb"; rrect(g, px - 0.5, py - 2, T + 1, 6, 3); g.fill();
      g.fillStyle = "#cfe6f3"; g.fillRect(px, py + 2, T, 2);
      if (r() < 0.5) { g.fillStyle = "#eef6fb"; ell(g, px + 4 + r() * 12, py + 4.5, 2, 2.6); }
    }
  }
  for (let y = 0; y < L.R; y++) for (let x = 0; x < L.C; x++) {
    if (L.cell[y][x] !== "=") continue;
    const px = x * T, py = y * T;
    g.fillStyle = "#8cc4e2"; rrect(g, px, py, T, 6, 2); g.fill();
    g.fillStyle = "#e4f3fb"; g.fillRect(px + 1, py, T - 2, 2);
    g.fillStyle = "rgba(140,196,226,.35)"; g.fillRect(px + 8, py + 6, 4, 5);
  }
  for (const s of L.spikes) {
    const px = s.cx * T, by = s.cy * T + T;
    for (let k = 0; k < 3; k++) {
      const x0 = px + 1 + k * 6;
      g.fillStyle = k === 1 ? "#f2fbff" : "#bfe3f2";
      g.beginPath(); g.moveTo(x0, by); g.lineTo(x0 + 3, by - (k === 1 ? 12 : 9)); g.lineTo(x0 + 6, by); g.closePath(); g.fill();
    }
  }
  if (L.exit) drawIgloo(g, L.exit);
}

function drawIgloo(g, e) {
  const cx = e.x + e.w / 2, by = e.y + e.h;
  g.fillStyle = "#e9f4fa"; g.beginPath(); g.arc(cx, by, 19, Math.PI, 0); g.closePath(); g.fill();
  g.strokeStyle = "#a8cfe3"; g.lineWidth = 1;
  for (const yy of [by - 7, by - 13]) { const hw = Math.sqrt(19 * 19 - (by - yy) ** 2); g.beginPath(); g.moveTo(cx - hw, yy); g.lineTo(cx + hw, yy); g.stroke(); }
  for (const [xx, y0, y1] of [[-10, 0, -7], [6, 0, -7], [-3, -7, -13], [12, -7, -13], [-12, -7, -13], [4, -13, -18]]) { g.beginPath(); g.moveTo(cx + xx, by + y0); g.lineTo(cx + xx, by + y1); g.stroke(); }
  g.fillStyle = "#0e2236"; g.beginPath(); g.arc(cx, by, 7.5, Math.PI, 0); g.lineTo(cx + 7.5, by); g.closePath(); g.fill();
  g.fillStyle = "#e9f4fa"; g.fillRect(cx - 9, by - 1, 18, 1);
}

function drawKey(c, x, y) {
  c.fillStyle = "#ffd166"; c.strokeStyle = "#9a6b12"; c.lineWidth = 1;
  c.beginPath(); c.arc(x - 3, y, 3.6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillRect(x, y - 1.2, 8, 2.4); c.fillRect(x + 5, y + 1, 1.6, 2.6); c.fillRect(x + 7, y + 1, 1.4, 1.8);
  c.fillStyle = "#08111c"; ell(c, x - 3, y, 1.2, 1.2);
}

function drawDynamic(c, L, t) {
  for (let y = 0; y < L.R; y++) for (let x = 0; x < L.C; x++) {
    const ch = L.cell[y][x], px = x * T, py = y * T;
    if (ch === "h") {
      // hielo fantasma: sólido solo cerca de la linterna
      const lit = cellSolid(L, x, y, "");
      if (lit) {
        c.fillStyle = "rgba(190,240,255,.85)"; rrect(c, px + 1, py + 1, T - 2, T - 2, 3); c.fill();
        c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(px + 3, py + 3, T - 6, 2);
      } else {
        c.strokeStyle = "rgba(190,240,255,.28)"; c.lineWidth = 1; c.setLineDash([2, 3]);
        c.strokeRect(px + 2.5, py + 2.5, T - 5, T - 5); c.setLineDash([]);
      }
      continue;
    }
    if (ch === "u" || ch === "U") {
      const st = ch === "u" ? 0 : 1, on = L.toggle === st, col = TOG_COLOR[st];
      if (on) {
        c.fillStyle = col; rrect(c, px + 1, py + 1, T - 2, T - 2, 3); c.fill();
        c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(px + 3, py + 3, T - 6, 2);
        c.fillStyle = "rgba(0,0,0,.15)"; c.fillRect(px + 1, py + T - 4, T - 2, 3);
      } else {
        c.strokeStyle = col; c.globalAlpha = 0.45; c.lineWidth = 1.2; c.setLineDash([3, 3]);
        c.strokeRect(px + 2.5, py + 2.5, T - 5, T - 5); c.setLineDash([]); c.globalAlpha = 1;
      }
      continue;
    }
    if (ch === "f" || ch === "g") {
      const col = ch === "f" ? P_COLOR.F : P_COLOR.B;
      c.globalAlpha = 0.28; c.fillStyle = col; c.fillRect(px + 4, py, 12, T);
      c.globalAlpha = 0.75; c.fillRect(px + 4, py, 1.5, T); c.fillRect(px + 14.5, py, 1.5, T);
      c.globalAlpha = 0.5;
      for (let k = 0; k < 2; k++) { const yy = py + ((t * 22 + k * 10 + x * 7) % T); c.fillRect(px + 6, yy, 8, 1.5); }
      c.globalAlpha = 1;
    } else if (ch === "%") {
      const st = L.crumble[y * L.C + x];
      if (st.s === 2) { c.strokeStyle = "rgba(191,227,242,.22)"; c.setLineDash([3, 3]); c.strokeRect(px + 1.5, py + 1.5, T - 3, 7); c.setLineDash([]); continue; }
      const sh = st.s === 1 ? Math.sin(t * 70) * 1.2 : 0;
      c.fillStyle = "#a9dcf0"; rrect(c, px + sh, py, T, 9, 2); c.fill();
      c.fillStyle = "#e4f6fd"; c.fillRect(px + 1 + sh, py, T - 2, 2);
      c.strokeStyle = "rgba(40,90,130,.6)"; c.lineWidth = 1; c.beginPath();
      c.moveTo(px + 6 + sh, py + 2); c.lineTo(px + 9 + sh, py + 6); c.lineTo(px + 7 + sh, py + 9);
      c.moveTo(px + 14 + sh, py + 1); c.lineTo(px + 12 + sh, py + 5); c.stroke();
    } else if (L.wind[y][x]) {
      const on = windOn(L);
      c.fillStyle = on ? "rgba(200,240,255,.10)" : "rgba(200,240,255,.04)"; c.fillRect(px, py, T, T);
      c.fillStyle = on ? "rgba(220,245,255,.45)" : "rgba(220,245,255,.12)";
      for (let k = 0; k < 2; k++) { const yy = py + T - (((on ? t * 70 : 0) + k * 10 + x * 5 + y * 3) % T); c.fillRect(px + 5 + k * 8, yy, 1.2, 5); }
      if (y === L.R - 1 || !L.wind[y + 1][x]) { c.fillStyle = BTN_COLOR[L.def.windBtn] || "#9fb8c9"; c.fillRect(px + 2, py + T - 4, T - 4, 4); }
    }
  }
  for (const d of L.doors) {
    const o = L.door[d.id], h = T * (1 - o);
    if (h < 0.5) continue;
    c.fillStyle = "#2a4a69"; c.fillRect(d.x + 2, d.y, T - 4, h);
    c.fillStyle = BTN_COLOR[d.id];
    for (let k = 0; k < 3; k++) c.fillRect(d.x + 4 + k * 5, d.y, 2.2, h);
    c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(d.x + 2, d.y, 2, h);
  }
  // balancines
  for (const s of L.seesaws) {
    const x0 = s.x0 * T, x1 = (s.x1 + 1) * T, py = s.y * T, ang = s.tilt * 0.14;
    c.fillStyle = "#5d7f9c"; c.beginPath(); c.moveTo(s.mid - 9, py + T); c.lineTo(s.mid, py + 6); c.lineTo(s.mid + 9, py + T); c.closePath(); c.fill();
    c.save(); c.translate(s.mid, py + 3); c.rotate(ang);
    c.fillStyle = "#c98f4f"; rrect(c, x0 - s.mid, -3, x1 - x0, 7, 3); c.fill();
    c.fillStyle = "#e7b47a"; c.fillRect(x0 - s.mid + 2, -3, x1 - x0 - 4, 2);
    c.fillStyle = "#ffd166"; c.beginPath(); c.arc(x0 - s.mid + 8, 0.5, 2, 0, Math.PI * 2); c.arc(x1 - s.mid - 8, 0.5, 2, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // cristales de intercambio
  for (const cr of L.crystals) {
    const cx = cr.cx * T + T / 2, cy = cr.cy * T + T / 2 + Math.sin(t * 3 + cr.cx) * 1.5, k = L.swapCd > 0 ? 0.35 : 1, r = 7 + Math.sin(t * 5) * 0.6 * k;
    c.globalAlpha = k;
    c.fillStyle = "rgba(224,123,255,.25)"; c.beginPath(); c.arc(cx, cy, r + 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e07bff"; c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r * 0.7, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r * 0.7, cy); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.75)"; c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r * 0.3, cy - r * 0.2); c.lineTo(cx, cy); c.closePath(); c.fill();
    c.globalAlpha = 1;
  }
  // palancas
  for (const lv of L.levers) {
    const bx = lv.cx * T + T / 2, by = lv.cy * T + T, col = TOG_COLOR[L.toggle];
    c.fillStyle = "#4b6780"; rrect(c, bx - 6, by - 4, 12, 4, 1.5); c.fill();
    c.strokeStyle = "#c9d6e0"; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by - 3); c.lineTo(bx + (L.toggle ? 6 : -6), by - 14); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(bx + (L.toggle ? 6 : -6), by - 14, 3.2, 0, Math.PI * 2); c.fill();
  }
  for (const b of L.buttons) {
    c.fillStyle = "#4b6780"; rrect(c, b.x - 1, b.y + 3, b.w + 2, 2, 1); c.fill();
    c.fillStyle = BTN_COLOR[b.id];
    const hh = b.down ? 1.5 : 3.5; rrect(c, b.x + 2, b.y + 3 - hh, b.w - 4, hh + 0.5, 1.5); c.fill();
    if (b.heavy) { c.fillStyle = "#f3f8fb"; c.beginPath(); c.arc(b.x + b.w / 2 - 3, b.y - 3, 1.6, 0, Math.PI * 2); c.arc(b.x + b.w / 2 + 3, b.y - 3, 1.6, 0, Math.PI * 2); c.fill(); }
    const secs = L.timers[b.id];
    if (secs) {
      const k = L.timer[b.id] / secs;
      c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 1.6;
      c.beginPath(); c.arc(b.x + b.w / 2, b.y - 7, 4.5, 0, Math.PI * 2); c.stroke();
      if (k > 0) { c.strokeStyle = BTN_COLOR[b.id]; c.beginPath(); c.arc(b.x + b.w / 2, b.y - 7, 4.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.stroke(); }
    }
  }
  for (const l of L.lifts) {
    c.fillStyle = "#3b6487"; rrect(c, l.x, l.y, l.w, l.h, 3); c.fill();
    c.fillStyle = BTN_COLOR[l.id]; c.fillRect(l.x + 1, l.y, l.w - 2, 4);
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(l.x, l.y + l.h - 3, l.w, 3);
    c.fillStyle = "rgba(255,255,255,.55)";
    for (let k = 0; k < l.w / T; k++) { ell(c, l.x + k * T + 5, l.y + 11, 1.3, 1.3); ell(c, l.x + k * T + 15, l.y + 11, 1.3, 1.3); }
  }
  for (const ic of L.icicles) {
    if (ic.s === "gone") continue;
    const sh = ic.s === "shake" ? Math.sin(t * 80) * 1.3 : 0, x = ic.x + sh, y = ic.y;
    c.fillStyle = "#dff4ff"; c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 16, y); c.lineTo(x + 10, y + T - 1); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.8)"; c.fillRect(x + 8, y + 1, 1.5, 8);
  }
  for (const cp of L.checkpoints) {
    const on = cp.i <= L.cp;
    c.fillStyle = "#c9d6e0"; c.fillRect(cp.x - 1, cp.y - 22, 2, 22);
    c.fillStyle = on ? "#7fe3c7" : "#5a7189";
    const wave = Math.sin(t * 5 + cp.x) * 1.5;
    c.beginPath(); c.moveTo(cp.x + 1, cp.y - 22); c.lineTo(cp.x + 12, cp.y - 18 + wave); c.lineTo(cp.x + 1, cp.y - 13); c.closePath(); c.fill();
  }
  drawSea(c, L, t);
  if (L.key && !L.key.holder) drawKey(c, L.key.x, L.key.y + Math.sin(t * 3) * 1.5);
  if (L.key && !L.key.holder && L.exit) {
    const cx = L.exit.x + L.exit.w / 2, by = L.exit.y + L.exit.h;
    c.fillStyle = "#ffd166"; rrect(c, cx - 4, by - 7, 8, 6, 1.5); c.fill();
    c.strokeStyle = "#ffd166"; c.lineWidth = 1.4; c.beginPath(); c.arc(cx, by - 7, 2.6, Math.PI, 0); c.stroke();
  }
  for (const f of L.fish) {
    if (f.got) continue;
    const yy = f.y + Math.sin(t * 3 + f.x) * 1.8;
    c.fillStyle = "#cfe6f3"; ell(c, f.x, yy, 5.5, 3.4);
    c.beginPath(); c.moveTo(f.x + 4, yy); c.lineTo(f.x + 9, yy - 3.5); c.lineTo(f.x + 9, yy + 3.5); c.closePath(); c.fill();
    c.fillStyle = "#08111c"; ell(c, f.x - 2.5, yy - 0.6, 0.9, 0.9);
    c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(f.x - 1, yy - 2.6, 4, 1);
  }
}

function drawWater(c, L, t, y0, y1) {
  for (let y = Math.max(0, y0); y < Math.min(L.R, y1); y++) for (let x = 0; x < L.C; x++) {
    if (!L.wet[y][x]) continue;
    const px = x * T, py = y * T, top = y === 0 || !L.wet[y - 1][x];
    c.fillStyle = "rgba(64,150,210,.42)";
    if (top) {
      const w1 = Math.sin(t * 2.4 + x * 0.9) * 1.2;
      c.fillRect(px, py + 2 + w1, T, T - 2 - w1);
      c.fillStyle = "rgba(200,235,250,.7)"; c.fillRect(px, py + 2 + w1, T, 1.5);
    } else c.fillRect(px, py, T, T);
  }
}

function drawAurora(c, t) {
  c.save(); c.globalCompositeOperation = "lighter";
  for (let k = 0; k < 2; k++) {
    c.strokeStyle = k ? "rgba(127,227,199,.07)" : "rgba(150,140,255,.05)";
    c.lineWidth = 26 - k * 8; c.beginPath();
    for (let x = -20; x <= W + 20; x += 20) {
      const y = 70 + k * 26 + Math.sin(x * 0.012 + t * 0.25 + k) * 22 + Math.sin(x * 0.03 - t * 0.4) * 6;
      x === -20 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}

function drawRope(c, L, a, b) {
  const ax = a.x + PW / 2, ay = a.y + PH * 0.6, bx = b.x + PW / 2, by = b.y + PH * 0.6;
  const d = Math.hypot(bx - ax, by - ay), len = Math.max(d, L.ropeLen);
  const sag = Math.sqrt(Math.max(0, len * len - d * d)) * 0.5;
  const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
  c.lineCap = "round";
  for (const [w, col] of [[3.4, "rgba(60,35,10,.55)"], [2, "#e2b56c"]]) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
  }
}

// ---------- Bajo el agua, jaula y bola ----------
function drawSea(c, L, t) {
  // corrientes: rayitas que avanzan en su dirección
  for (let y = 0; y < L.R; y++) for (let x = 0; x < L.C; x++) {
    const k = L.cur[y][x]; if (!k) continue;
    const px = x * T, py = y * T, ph = (t * 1.6 + x * 0.37 + y * 0.53) % 1;
    c.strokeStyle = "rgba(210,245,255,.38)"; c.lineWidth = 1.2; c.beginPath();
    if (k === ">" || k === "<") { const s = k === ">" ? 1 : -1, x0 = px + (s > 0 ? ph : 1 - ph) * T; c.moveTo(x0, py + 7); c.lineTo(x0 + s * 6, py + 7); c.moveTo(x0 - s * 4, py + 14); c.lineTo(x0 + s * 2, py + 14); }
    else { const s = k === "[" ? -1 : 1, y0 = py + (s > 0 ? ph : 1 - ph) * T; c.moveTo(px + 6, y0); c.lineTo(px + 6, y0 + s * 6); c.moveTo(px + 14, y0 - s * 4); c.lineTo(px + 14, y0 + s * 2); }
    c.stroke();
  }
  // respiraderos con burbujas que suben
  for (const v of L.vents) {
    const bx = v.cx * T + T / 2, by = v.cy * T + T;
    c.fillStyle = "#3b5a75"; c.beginPath(); c.ellipse(bx, by - 2, 8, 4, 0, Math.PI, 0); c.fill();
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.55 + i / 6) % 1, yy = by - 4 - k * 5 * T, xx = bx + Math.sin(t * 3 + i * 2) * 3;
      c.strokeStyle = "rgba(220,248,255," + (0.85 - k * 0.6) + ")"; c.lineWidth = 1;
      c.beginPath(); c.arc(xx, yy, 1.6 + (i % 3) * 0.8, 0, Math.PI * 2); c.stroke();
    }
  }
  for (const s of L.sentries) drawAngler(c, L, s, t);
  // medusas
  for (const j of L.jellies) {
    c.fillStyle = "rgba(255,140,200,.75)"; c.beginPath(); c.ellipse(j.x, j.y, 7, 5.5, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.55)"; ell(c, j.x - 2.5, j.y - 3, 1.6, 1);
    c.strokeStyle = "rgba(255,160,210,.75)"; c.lineWidth = 1.1;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(j.x + k * 2.4, j.y); c.quadraticCurveTo(j.x + k * 2.4 + Math.sin(t * 5 + k) * 2, j.y + 5, j.x + k * 2.4, j.y + 9); c.stroke(); }
    eye(c, j.x - 2.2, j.y - 1.6, 0.8, t); eye(c, j.x + 2.2, j.y - 1.6, 0.8, t);
  }
  // jaula con una pareja adentro (ocupa dos casillas)
  const cg = L.cage;
  if (cg) {
    const pr = pairById(cg.kind), cx = cg.x + cg.w / 2, by = cg.y + T;
    if (!cg.open) {
      drawPair(c, pr, cx, by, t, { caged: true, scale: 0.82, gap: 9 });
      if (Math.sin(t * 4) > 0.6) { c.fillStyle = "#f3f8fb"; c.font = "600 9px Fredoka, sans-serif"; c.textAlign = "center"; c.fillText("¡ayuda!", cx, cg.y - 10); }
    } else if (cg.t < 2.6) {
      const k = Math.min(1, cg.t / 2.6);
      c.globalAlpha = Math.min(1, (1 - k) * 2.2);
      for (const [team, dx] of [["F", -9], ["B", 9]]) {
        const hop = Math.abs(Math.sin(cg.t * 8 + (team === "B" ? 1.2 : 0))) * 7;
        drawCharacter(c, pr[team], team, cx + dx - PW / 2, by - PH - hop, team === "F" ? 1 : -1, { t, air: hop > 1, noScarf: true, alpha: c.globalAlpha });
      }
      c.fillStyle = "#ff7eb6";
      for (let i = 0; i < 4; i++) { const hx = cx + i * 8 - 12, hy = cg.y - 4 - cg.t * 20 - (i % 2) * 6; c.beginPath(); c.arc(hx - 1.5, hy, 1.8, 0, Math.PI * 2); c.arc(hx + 1.5, hy, 1.8, 0, Math.PI * 2); c.moveTo(hx - 3.3, hy + 0.6); c.lineTo(hx, hy + 4); c.lineTo(hx + 3.3, hy + 0.6); c.fill(); }
      c.globalAlpha = 1;
    }
  }
}

// la luz del rape: un abanico de rayos que se cortan donde hay roca o compuerta cerrada
function drawBeam(c, L, s, lx, ly) {
  if (s.full) return;
  const n = 28, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = s.ang - s.half + (2 * s.half * i) / n, ca = Math.cos(a), sa = Math.sin(a);
    let d = 3;
    while (d < s.len && !cellSolid(L, Math.floor((lx + ca * d) / T), Math.floor((ly + sa * d) / T), "")) d += 2.5;
    d = Math.min(d, s.len); pts.push([lx + ca * d, ly + sa * d]);
  }
  c.save(); c.globalCompositeOperation = "lighter";
  const g = c.createRadialGradient(lx, ly, 2, lx, ly, s.len);
  g.addColorStop(0, s.alert ? "rgba(255,90,90,.46)" : "rgba(255,236,140,.36)"); g.addColorStop(1, s.alert ? "rgba(255,90,90,0)" : "rgba(255,236,140,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(lx, ly); for (const [x, y] of pts) c.lineTo(x, y); c.closePath(); c.fill();
  c.restore();
}
// rape abisal: panzón, boca enorme con dientes, aleta, manchitas que brillan y la caña con su luz
function drawAngler(c, L, s, t) {
  const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
  if (s.face == null) s.face = 1;
  if (ca > 0.2) s.face = 1; else if (ca < -0.2) s.face = -1;
  const f = s.face, hunting = !!s.hunt, bob = hunting ? 0 : Math.sin(t * 2 + s.i) * 1.2;
  const lx = s.x + ca * 14, ly = s.y + sa * 14 + bob;
  drawBeam(c, L, s, lx, ly);
  const chew = s.full ? Math.abs(Math.sin(s.full * 9)) * Math.max(0, 1 - s.full / 2) : 0;
  const open = hunting ? 1 : s.full ? 0.1 + chew * 0.6 : 0.3 + Math.sin(t * 1.6 + s.i) * 0.1;
  c.save(); c.translate(s.x, s.y + bob); c.scale(f, 1);
  const wig = Math.sin(t * (hunting ? 16 : 5)) * 1.6;
  c.fillStyle = "#2f2754";
  c.beginPath(); c.moveTo(-9, -1); c.lineTo(-16.5, -6.5 + wig); c.quadraticCurveTo(-14, 0, -16.5, 6.5 + wig); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-7, -7); c.lineTo(-5, -12); c.lineTo(-3, -8.4); c.lineTo(-0.5, -11.6); c.lineTo(1.4, -8.2); c.closePath(); c.fill();
  c.fillStyle = "#241d45"; ell(c, 0, 0.5, 11.5, 9.2);
  c.fillStyle = "#3a3170"; ell(c, -1.2, -2.2, 9.4, 6.4);
  c.fillStyle = "#4a3f86"; ell(c, -3, -4, 4.5, 2.6);
  c.fillStyle = "rgba(120,240,255,.6)";
  for (const [x, y, r] of [[-6, -2, 0.8], [-3, -5.8, 0.6], [-7.2, 2.2, 0.6], [-3.6, 1.4, 0.7], [-0.6, -3.4, 0.5]]) ell(c, x, y, r, r);
  c.save(); c.translate(-2.5, 4.5); c.rotate(0.5 + Math.sin(t * (hunting ? 14 : 4)) * 0.35); c.fillStyle = "#2f2754"; ell(c, 0, 2.8, 1.9, 3.4); c.restore();
  // la boca: mandíbula de abajo salida, dientes arriba y abajo
  const top = -1.2 - open * 2.6, bot = 3.6 + open * 3.4;
  c.fillStyle = "#16091d"; c.beginPath(); c.moveTo(1.5, 1.2); c.quadraticCurveTo(7, top - 0.6, 12.2, top); c.lineTo(13, bot); c.quadraticCurveTo(7, bot + 0.8, 1.5, 2.6); c.closePath(); c.fill();
  c.fillStyle = "#4a3f86"; c.beginPath(); c.moveTo(1.5, 2.6); c.quadraticCurveTo(7, bot + 0.8, 13.4, bot - 0.4); c.lineTo(13.2, bot + 1.6); c.quadraticCurveTo(7, bot + 3.2, 1, 3.6); c.closePath(); c.fill();
  c.fillStyle = "#f3f8fb";
  for (let k = 0; k < 4; k++) {
    const x = 4.4 + k * 2.2, yt = top + (1 - k / 4) * 1.4 - 0.2, yb = bot + 0.2;
    c.beginPath(); c.moveTo(x - 0.8, yt + 0.4); c.lineTo(x, yt + 2 + open * 0.8); c.lineTo(x + 0.8, yt + 0.4); c.fill();
    c.beginPath(); c.moveTo(x + 0.3, yb); c.lineTo(x + 1.1, yb - 1.8 - open * 0.7); c.lineTo(x + 1.9, yb); c.fill();
  }
  // el ojo: chiquito, mira hacia su luz; enojado cuando te vio
  c.fillStyle = "#f6f1c8"; ell(c, 4.6, -4.4, 2.3, 2.3);
  c.fillStyle = "#0b1119"; ell(c, 4.6 + ca * f * 0.8, -4.4 + sa * 0.8, 1.1, 1.1);
  if (s.alert || hunting) { c.strokeStyle = "#16091d"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2.2, -7.6); c.lineTo(6.8, -6); c.stroke(); }
  // la caña que sale de la cabeza hasta la luz
  const ex = (lx - s.x) * f, ey = ly - s.y - bob;
  c.strokeStyle = "#2f2754"; c.lineWidth = 1.2; c.lineCap = "round";
  c.beginPath(); c.moveTo(2, -8.4); c.quadraticCurveTo(12, -17, ex, ey); c.stroke();
  c.restore();
  const glow = c.createRadialGradient(lx, ly, 0, lx, ly, 8);
  glow.addColorStop(0, s.alert ? "rgba(255,120,120,.9)" : "rgba(255,240,170,.9)"); glow.addColorStop(1, "rgba(255,240,170,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(lx, ly, 8, 0, Math.PI * 2); c.fill();
  c.fillStyle = s.alert ? "#ff6b6b" : "#ffe08a"; ell(c, lx, ly, 2.6, 2.6);
  c.fillStyle = "rgba(255,255,255,.85)"; ell(c, lx - 0.8, ly - 0.8, 0.9, 0.9);
}

// la bola de nieve gigante
function drawBall(c, L, t) {
  const b = L.ball; if (!b || !b.active) return;
  c.fillStyle = "rgba(8,17,28,.25)"; ell(c, b.x, b.y + b.r - 2, b.r * 0.95, 5);
  const g = c.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 6, b.x, b.y, b.r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#c9dceb");
  c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(140,170,195,.55)"; c.lineWidth = 2;
  for (let k = 0; k < 5; k++) { const a = b.rot + k * 1.26; c.beginPath(); c.arc(b.x + Math.cos(a) * b.r * 0.55, b.y + Math.sin(a) * b.r * 0.55, b.r * 0.22, a, a + 2.2); c.stroke(); }
  c.fillStyle = "rgba(240,248,255,.9)";
  for (let k = 0; k < 6; k++) { const ph = (t * 3 + k * 0.37) % 1; ell(c, b.x + b.r * 0.6 + ph * 18, b.y + b.r - 4 - ph * 14 + (k % 2) * 4, 2.6 - ph * 2, 2.6 - ph * 2); }
}
