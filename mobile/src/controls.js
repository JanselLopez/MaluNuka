// Controles táctiles del juego, como en la web: joystick donde se apoya el dedo y botones grandes de saltar y agarrar.
// Se dibujan en el mismo lienzo del juego (sin vistas de React) y leen los toques de toda la franja de abajo.
const COLOR = { F: "#46a8f0", B: "#ff8b4a" };
const NAME = { F: "Malu", B: "Nuka" };

function createControls(game) {
  let items = [], stripH = 0, sizeKey = "";
  const fingers = new Map(); // identificador del dedo → { p, k, stick, x0, y0, dir, cx, cy }

  // arma las zonas según el modo (en un celular: Malu a la izquierda y Nuka a la derecha; en línea: joystick y botones)
  function layout(w, h, ins) {
    const S = game.S, grab = game.needsGrab(), solo = S.mode !== "local";
    const key = [w, h, ins.l, ins.r, ins.b, S.mode, S.me, grab].join();
    if (key === sizeKey) return stripH;
    sizeKey = key; fingers.clear(); release();
    const ch = Math.round(Math.max(56, Math.min(86, h * 0.2))), padH = ch * 1.25, gap = 6;
    const bottom = h - Math.max(6, ins.b || 0), left = Math.max(8, ins.l || 0), right = w - Math.max(8, ins.r || 0);
    stripH = padH + Math.max(6, ins.b || 0) + 4;
    const box = (p, k, x, ww, hh) => ({ p, k, x, y: bottom - hh, w: ww, h: hh, r: k === "j" ? 22 : 16 });
    items = [];
    const row = (p, list, fromRight) => {
      let x = fromRight ? right : left;
      for (const [k, ww, hh] of list) {
        if (fromRight) { x -= ww; items.push(box(p, k, x, ww, hh)); x -= gap; }
        else { items.push(box(p, k, x, ww, hh)); x += ww + gap; }
      }
    };
    if (!solo) {
      const g = (p) => (grab ? [[`g`, ch * 1.2, ch]] : []);
      row("F", [["stick", ch * 2.1, padH], ["j", ch * 1.45, padH], ...g("F")], false);
      row("B", [["stick", ch * 2.1, padH], ["j", ch * 1.45, padH], ...g("B")], true);
    } else {
      const p = S.me || "F";
      row(p, [["stick", ch * 3, padH]], false);
      row(p, [["j", ch * 1.9, padH], ...(grab ? [["g", ch * 1.5, ch * 1.1]] : [])], true);
    }
    return stripH;
  }
  function release() {
    for (const p of ["F", "B"]) Object.assign(game.touch[p], { l: 0, r: 0, j: 0, g: 0 });
  }
  // el botón bajo el dedo; si cae en un hueco o justo al lado, el más cercano (hasta ~1/2 botón de distancia)
  function itemAt(x, y) {
    let best = null, bd = Infinity;
    for (const it of items) {
      const dx = Math.max(it.x - x, 0, x - it.x - it.w), dy = Math.max(it.y - y, 0, y - it.y - it.h), d = Math.hypot(dx, dy);
      if (d === 0) return it;
      if (it.k !== "stick" && d < bd) { bd = d; best = it; }
    }
    return best && bd <= best.h * 0.6 ? best : null;
  }
  function refresh() {
    release();
    for (const f of fingers.values()) {
      if (!f) continue;
      if (f.stick) { if (f.dir) game.touch[f.p][f.dir < 0 ? "l" : "r"] = 1; continue; }
      game.touch[f.p][f.k] = 1;
    }
  }
  function press(f) {
    if (f && f.k === "j") game.pendJ[f.p] = true;
    if (f && f.k === "g") game.pendG[f.p] = true;
  }
  function down(id, x, y) {
    const it = itemAt(x, y);
    const f = it ? { p: it.p, k: it.k, stick: it.k === "stick", it, x0: x, y0: y, cx: x, dir: 0 } : null;
    fingers.set(id, f);
    press(f);
    if (f) game.buzz && game.buzz();
    refresh();
  }
  function move(id, x, y) {
    if (!fingers.has(id)) return;
    const old = fingers.get(id);
    // el dedo del joystick sigue siendo joystick aunque se salga de su zona
    if (old && old.stick) {
      const dx = x - old.x0, dir = dx < -12 ? -1 : dx > 12 ? 1 : 0;
      old.cx = old.x0 + Math.max(-34, Math.min(34, dx));
      if (dir !== old.dir) { old.dir = dir; if (dir) game.buzz && game.buzz(); refresh(); }
      return;
    }
    const it = itemAt(x, y);
    if (it && it.k === "stick") return;
    if ((it && it.k) === (old && old.k) && (it && it.p) === (old && old.p)) return;
    const f = it ? { p: it.p, k: it.k, it } : null;
    fingers.set(id, f);
    if (f && !(old && old.k === f.k)) press(f);
    refresh();
  }
  function up(id) { if (fingers.delete(id)) refresh(); }
  function reset() { fingers.clear(); release(); }

  // ---- dibujo ----
  function iconJump(c, x, y, s) {
    c.beginPath();
    const P = [[10, 2.5], [17.5, 11], [12.5, 11], [12.5, 17.5], [7.5, 17.5], [7.5, 11], [2.5, 11]];
    P.forEach(([a, b], i) => (i ? c.lineTo : c.moveTo).call(c, x + (a - 10) * s, y + (b - 10) * s));
    c.closePath(); c.fill();
  }
  function iconGrab(c, x, y, s) {
    const X = (a) => x + (a - 10) * s, Y = (b) => y + (b - 10) * s;
    c.lineWidth = 2 * s; c.lineCap = "round";
    c.beginPath(); c.arc(X(10), Y(4.6), 1.9 * s, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(X(10), Y(6.6)); c.lineTo(X(10), Y(16.6)); c.moveTo(X(6.4), Y(9.6)); c.lineTo(X(13.6), Y(9.6));
    c.moveTo(X(3.8), Y(12.6)); c.bezierCurveTo(X(4.7), Y(15.3), X(7.1), Y(16.6), X(10), Y(16.6)); c.bezierCurveTo(X(12.9), Y(16.6), X(15.3), Y(15.3), X(16.2), Y(12.6));
    c.stroke();
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function draw(c) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    const on = new Set(), sticks = new Map();
    for (const f of fingers.values()) if (f) { if (f.stick) sticks.set(f.it, f); else on.add(f.it); }
    for (const it of items) {
      const col = COLOR[it.p];
      if (it.k === "stick") {
        c.fillStyle = "rgba(243,248,251,.05)"; rr(c, it.x, it.y, it.w, it.h, 22); c.fill();
        c.strokeStyle = it.p === "F" ? "rgba(70,168,240,.68)" : "rgba(255,139,74,.68)"; c.lineWidth = 2; rr(c, it.x + 1, it.y + 1, it.w - 2, it.h - 2, 21); c.stroke();
        const f = sticks.get(it), bx = f ? f.x0 : it.x + it.w / 2, by = f ? f.y0 : it.y + it.h / 2, br = (it.h / 1.25) * 1.15 / 2;
        c.fillStyle = "rgba(243,248,251,.08)"; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
        c.strokeStyle = it.p === "F" ? "rgba(70,168,240,.98)" : "rgba(255,139,74,.98)"; c.beginPath(); c.arc(bx, by, br - 1, 0, Math.PI * 2); c.stroke();
        const kx = f ? f.cx : bx, kr = br * 0.46;
        c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(kx, by + 2, kr + 1, 0, Math.PI * 2); c.fill();
        c.globalAlpha = f ? 1 : 0.92; c.fillStyle = col; c.beginPath(); c.arc(kx, by, kr, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "rgba(243,248,251,.9)"; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1;
        if (game.S.mode === "local") {
          c.fillStyle = col; c.globalAlpha = 0.8; c.font = "600 13px Fredoka, sans-serif"; c.textAlign = "center"; c.textBaseline = "top";
          c.fillText(NAME[it.p], it.x + it.w / 2, it.y + 4); c.globalAlpha = 1;
        }
        continue;
      }
      const pressed = on.has(it);
      c.fillStyle = pressed ? col : "rgba(243,248,251,.1)"; rr(c, it.x, it.y, it.w, it.h, it.r); c.fill();
      c.strokeStyle = col; c.lineWidth = 2; rr(c, it.x + 1, it.y + 1, it.w - 2, it.h - 2, it.r - 1); c.stroke();
      const s = Math.min(it.w, it.h) * 0.44 / 20, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      c.fillStyle = c.strokeStyle = pressed ? "#08111c" : col;
      if (it.k === "j") iconJump(c, cx, cy, s); else iconGrab(c, cx, cy, s);
    }
  }
  return { layout, down, move, up, reset, draw, get height() { return stripH; } };
}
module.exports = { createControls };
