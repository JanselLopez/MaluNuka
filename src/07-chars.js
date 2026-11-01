// ---------- Personajes del Ártico (todo dibujado con código) ----------
// Todos ocupan la misma caja de juego; solo cambia el dibujo. La bufanda lleva el color del jugador.
const CHARS = [
  { id: "pinguino", name: "Pingüino" },
  { id: "foca", name: "Foca" },
  { id: "zorro", name: "Zorro ártico" },
  { id: "oso", name: "Oso polar" },
  { id: "reno", name: "Reno" },
  { id: "lobo", name: "Lobo ártico" },
  { id: "liebre", name: "Liebre ártica" },
  { id: "nina", name: "Niña inuit" },
  { id: "nino", name: "Niño inuit" },
];
// se eligen por parejas: Malu lleva al primero y Nuka al segundo. La primera pareja está libre desde el inicio.
const PAIRS = [
  { id: "pinguinos", name: "Pingüinos", F: "pinguino", B: "pinguino", who: "a los pingüinos" },
  { id: "focas", name: "Focas", F: "foca", B: "foca", who: "a las focas" },
  { id: "zorros", name: "Zorros árticos", F: "zorro", B: "zorro", who: "a los zorros árticos" },
  { id: "osos", name: "Osos polares", F: "oso", B: "oso", who: "a los osos polares" },
  { id: "renos", name: "Renos", F: "reno", B: "reno", who: "a los renos" },
  { id: "lobos", name: "Lobos árticos", F: "lobo", B: "lobo", who: "a los lobos árticos" },
  { id: "liebres", name: "Liebres árticas", F: "liebre", B: "liebre", who: "a las liebres árticas" },
  { id: "inuit", name: "Niños inuit", F: "nina", B: "nino", who: "a los niños inuit" },
];
const pairById = (id) => PAIRS.find((p) => p.id === id) || PAIRS[0];
// la pareja dibujada lado a lado; enjaulada si todavía no la rescatan
function drawPair(c, pr, x, by, t, o = {}) {
  // separados lo justo para que uno no le tape la bufanda al otro
  const k = o.scale || 1, gap = o.gap || 13;
  for (const [team, dx, face] of [["F", -gap, 1], ["B", gap, -1]]) {
    const cx = x + dx * k;
    c.save(); c.translate(cx, by); c.scale(k, k); c.translate(-cx, -by);
    drawCharacter(c, pr[team], team, cx - PW / 2, by - PH, face, { t: t + (team === "B" ? 0.6 : 0), walk: !!o.walk, noScarf: !!o.caged });
    c.restore();
  }
  if (o.caged) drawCageBars(c, x - (gap + 12) * k, by - 24 * k, (gap + 12) * 2 * k, 24 * k);
}
function drawCageBars(c, x, y, w, h) {
  c.strokeStyle = "#8a9bab"; c.lineWidth = Math.max(1.2, w / 28);
  c.beginPath(); for (let k = 0; k <= 8; k++) { const bx = x + 1 + (k * (w - 2)) / 8; c.moveTo(bx, y + 2); c.lineTo(bx, y + h); } c.stroke();
  c.fillStyle = "#6c7d8e"; rrect(c, x - 1, y - 1, w + 2, h * 0.12 + 1, 1.5); c.fill(); rrect(c, x - 1, y + h - h * 0.1, w + 2, h * 0.12, 1.5); c.fill();
  const px = x + w / 2, s = h / 24, py = y + h - 4.5 * s; // candado abajo, entre los dos
  c.fillStyle = "#ffd166"; rrect(c, px - 3 * s, py - 1.5 * s, 6 * s, 5 * s, 1.2 * s); c.fill();
  c.strokeStyle = "#ffd166"; c.lineWidth = 1.2 * s; c.beginPath(); c.arc(px, py - 1.5 * s, 2 * s, Math.PI, 0); c.stroke();
}

// los que caminan meciéndose de lado a lado (los de cuatro patas trotan)
const WADDLE = { pinguino: true, foca: false, oso: true, zorro: false, reno: false, lobo: false, liebre: false, nina: true, nino: true };

// Dos pasadas: primero la silueta un poco más gorda en el color del contorno (como una calcomanía),
// después los colores encima. Así los personajes blancos no se pierden en la nieve.
const INK = { on: null };
const detail = () => !INK.on;
function fillPath(c, col) {
  if (INK.on) { c.fillStyle = INK.on; c.fill(); c.strokeStyle = INK.on; c.lineWidth = 1.7; c.lineJoin = "round"; c.stroke(); }
  else { c.fillStyle = col; c.fill(); }
}
function ov(c, x, y, rx, ry, col, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); fillPath(c, col); }
function poly(c, pts, col) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); fillPath(c, col); }
// un óvalo con sombra abajo y a la izquierda: da volumen
function shaded(c, x, y, rx, ry, fur, shade, rot) {
  ov(c, x, y, rx, ry, fur, rot);
  if (INK.on) return;
  c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = shade; c.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 + 4);
  c.fillStyle = fur; c.beginPath(); c.ellipse(x + rx * 0.08, y - ry * 0.2, rx * 0.97, ry * 0.92, rot || 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

const blinking = (t) => t % 3.7 < 0.13;
function eye(c, x, y, r, t, iris) {
  if (INK.on) return;
  if (blinking(t)) { c.strokeStyle = "#0b1119"; c.lineWidth = 0.8; c.lineCap = "round"; c.beginPath(); c.arc(x, y - r * 0.2, r * 0.9, 0.25, Math.PI - 0.25); c.stroke(); return; }
  c.fillStyle = "#0b1119"; ell(c, x, y, r, r * 1.22);
  if (iris) { c.fillStyle = iris; ell(c, x, y + r * 0.2, r * 0.68, r * 0.8); c.fillStyle = "#0b1119"; ell(c, x, y + r * 0.2, r * 0.36, r * 0.44); }
  c.fillStyle = "#ffffff"; ell(c, x + r * 0.33, y - r * 0.45, r * 0.42, r * 0.42); ell(c, x - r * 0.38, y + r * 0.48, r * 0.17, r * 0.17);
}
function blush(c, x, y) { if (detail()) { c.fillStyle = "rgba(255,130,150,.5)"; ell(c, x, y, 1.7, 1); } }
function smile(c, x, y, w) { if (detail()) { c.strokeStyle = "#3a2a2a"; c.lineWidth = 0.55; c.lineCap = "round"; c.beginPath(); c.arc(x - w / 2, y, w / 2, 0.15, Math.PI - 0.15); c.arc(x + w / 2, y, w / 2, 0.15, Math.PI - 0.15); c.stroke(); } }
// la bufanda se dibuja antes que la cabeza, así queda metida bajo la barbilla; rot la inclina como el cuello
function scarf(c, team, x, y, w, t, moving, rot) {
  if (scarf.off || INK.on) return;
  const col = P_COLOR[team], light = team === "F" ? "#a9dcff" : "#ffd2b0", dark = team === "F" ? "#2f7fc0" : "#d46a2c";
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  // la punta que cuelga por detrás
  c.save(); c.translate(-w / 2 + 2, 0.6); c.rotate(0.45 - (rot || 0) * 0.6 + (moving ? Math.sin(t * 12) * 0.3 : Math.sin(t * 2) * 0.05));
  c.fillStyle = dark; rrect(c, -1.6, 0, 3.2, 6.2, 1); c.fill(); c.fillStyle = light; c.fillRect(-1.6, 4.1, 3.2, 1.1); c.restore();
  c.fillStyle = col; rrect(c, -w / 2, -1.7, w, 3.4, 1.7); c.fill();
  c.fillStyle = dark; c.fillRect(-w / 2 + 1, 0.9, w - 2, 0.8);
  c.fillStyle = light; c.fillRect(-2, -1.7, 1.1, 3.4); c.fillRect(2, -1.7, 1.1, 3.4);
  c.restore();
}
function whiskers(c, x, y) {
  if (!detail()) return;
  c.strokeStyle = "rgba(70,80,95,.6)"; c.lineWidth = 0.45; c.beginPath();
  c.moveTo(x, y); c.lineTo(x + 3.6, y - 1); c.moveTo(x, y + 0.6); c.lineTo(x + 3.7, y + 0.9); c.stroke();
}
// cuatro patas que trotan (las de atrás y las de adelante en contrafase)
function legs4(c, fur, paw, t, walking, air, thick) {
  const w = thick || 2.3;
  for (const [x, ph] of [[-4.8, 0], [-2.4, Math.PI], [2.4, Math.PI], [4.8, 0]]) {
    const s = walking ? Math.sin(t * 16 + ph) : 0;
    const dx = air ? (x < 0 ? -1.2 : 1.2) : s * 1.3, lift = walking ? Math.max(0, Math.cos(t * 16 + ph)) * 1.4 : air ? 1.2 : 0;
    rrect(c, x - w / 2 + dx, -5.4 - lift, w, 5.4, w / 2); fillPath(c, x === -2.4 || x === 2.4 ? fur : fur);
    if (detail()) { c.fillStyle = paw; ell(c, x + dx + 0.3, -0.8 - lift, w * 0.62, 0.85); }
  }
}

const CHAR_DRAW = {
  pinguino(c, team, o, t) {
    c.fillStyle = "#ff9c33";
    if (o.anchor) { ell(c, -6, -1, 4, 1.8); ell(c, 6.5, -1, 4, 1.8); } else { ell(c, -3.5, -1.2, 3.6, 1.8); ell(c, 3.8, -1.2, 3.6, 1.8); }
    c.fillStyle = "#1b2735"; ell(c, 0, -10.5, 8.2, 10.5);
    c.save(); c.translate(-5.6, -11);
    c.rotate(o.cling ? -2.4 : 0.35 + (o.walk ? Math.sin(t * 16) * 0.3 : o.air ? -0.6 : 0));
    c.fillStyle = "#121c28"; ell(c, 0, 3, 2.4, 5.4); c.restore();
    c.fillStyle = "#f3f8fb"; ell(c, 2, -8.8, 5.4, 7.6); ell(c, 3.4, -15, 3.8, 3.3);
    if (blinking(t) || o.anchor) { c.strokeStyle = "#0b1119"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(3, -15.3); c.lineTo(5.4, -15.3); c.stroke(); }
    else { c.fillStyle = "#0b1119"; ell(c, 4.2, -15.3, 1.3, 1.7); c.fillStyle = "#ffffff"; ell(c, 4.6, -16, 0.5, 0.5); }
    c.fillStyle = "#ff9c33"; c.beginPath(); c.moveTo(6.4, -13.8); c.lineTo(10.8, -12.5); c.lineTo(6.4, -11.2); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,140,150,.5)"; ell(c, 2.4, -12, 1.6, 1);
    if (team === "F") {
      c.fillStyle = P_COLOR.F; rrect(c, -7.8, -12.2, 15.6, 3.4, 1.7); c.fill();
      c.save(); c.translate(-5.2, -10.6); c.rotate(0.45 + ((o.walk || o.air) ? Math.sin(t * 12) * 0.3 : 0));
      c.fillRect(-1.7, 0, 3.4, 6.5); c.fillStyle = "#a9dcff"; c.fillRect(-1.7, 4.2, 3.4, 1.2); c.restore();
      c.fillStyle = "#a9dcff"; c.fillRect(-2, -12.2, 1.2, 3.4); c.fillRect(2.5, -12.2, 1.2, 3.4);
    } else {
      c.fillStyle = P_COLOR.B; c.beginPath(); c.ellipse(0, -18.4, 7.6, 5, 0, Math.PI, 0); c.closePath(); c.fill();
      c.fillStyle = "#ffc49c"; rrect(c, -8, -19.4, 16, 2.6, 1.3); c.fill();
      c.fillStyle = "#fff0e3"; ell(c, -0.5, -24.2, 2.4, 2.4);
    }
  },

  // cría de foca: bolita blanca de ojos enormes que avanza arrastrando la panza
  foca(c, team, o, t) {
    const s = o.walk ? Math.sin(t * 14) : 0, fur = "#f6f9fc", sh = "#d3dfe9";
    ov(c, -9, -2.8, 3.4, 1.5, "#dbe5ee", -0.55 + s * 0.2); ov(c, -8.6, -1.2, 3.1, 1.4, "#dbe5ee", 0.4 - s * 0.2);
    shaded(c, -1.2, -6.8, 8.6 + s * 0.5, 6.6 - s * 0.4, fur, sh);
    shaded(c, 3.6, -12.6, 6.6, 6, fur, sh);
    ov(c, 8.3, -10.4, 2, 1.6, "#ffffff"); ov(c, 10, -10.5, 1.9, 1.5, "#ffffff");
    c.save(); c.translate(2.6, -4.4); c.rotate(0.75 + (o.walk ? Math.sin(t * 14) * 0.5 : o.air ? -1 : Math.sin(t * 2) * 0.1));
    ov(c, 0, 2.4, 1.8, 3.1, "#dbe5ee"); c.restore();
    if (detail()) {
      c.fillStyle = "#ffffff"; ell(c, 0.4, -6, 5, 3.6);
      c.fillStyle = "#cbd6e0"; ell(c, 1.4, -10.4, 0.9, 0.5); ell(c, -2.2, -9.6, 0.7, 0.4);
      c.fillStyle = "#2c2428"; c.beginPath(); c.moveTo(8.2, -12.1); c.lineTo(10.6, -12.1); c.lineTo(9.4, -10.9); c.closePath(); c.fill();
      c.fillStyle = "rgba(90,100,115,.6)"; for (const [x, y] of [[8.4, -10.2], [9.4, -9.8], [10.4, -10.2]]) ell(c, x, y, 0.25, 0.25);
    }
    eye(c, 3.4, -13.4, 1.9, t); eye(c, 7.3, -13.3, 1.7, t);
    whiskers(c, 10.6, -10.6);
    blush(c, 2.4, -10.6);
    scarf(c, team, 1.6, -7.2, 9, t, o.walk || o.air, 0.55);
  },

  // zorro ártico: orejas puntiagudas, hocico fino y una cola enorme y esponjosa
  zorro(c, team, o, t) {
    const fur = "#f8fafc", sh = "#d6dee6";
    c.save(); c.translate(-5.4, -7.6); c.rotate(-0.85 + Math.sin(t * (o.walk ? 10 : 2.5)) * 0.18);
    shaded(c, -4.4, 0, 6.2, 3.7, fur, sh); ov(c, -9.4, 0, 2.1, 2.3, "#ffffff"); c.restore();
    legs4(c, "#eef2f6", "#c8d2db", t, o.walk, o.air);
    shaded(c, -0.4, -7.8, 6.8, 4.9, fur, sh);
    poly(c, [1.4, -16.4, 0, -23.8, 4.8, -18.2], fur); poly(c, [5.4, -18.2, 8.8, -23.4, 9, -16], fur);
    poly(c, [0.6, -14.2, -2.6, -11, 1.8, -10.6], fur);
    shaded(c, 4.4, -13.2, 5.4, 4.8, fur, sh);
    poly(c, [7.8, -14.6, 12.4, -12.4, 7.8, -10.2], fur);
    if (detail()) {
      c.fillStyle = "#c9b4c4"; c.beginPath(); c.moveTo(1.8, -17); c.lineTo(0.9, -22.2); c.lineTo(4, -18.4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(5.9, -18.2); c.lineTo(8.3, -22); c.lineTo(8.4, -16.6); c.closePath(); c.fill();
      c.fillStyle = "#ffffff"; ell(c, 3.6, -8.4, 3, 3.3); ell(c, 9.4, -11.2, 2.6, 1.1);
      c.fillStyle = "#1a1f26"; ell(c, 12, -12.4, 1.15, 0.95); c.fillStyle = "rgba(255,255,255,.7)"; ell(c, 11.7, -12.8, 0.4, 0.3);
    }
    eye(c, 4.4, -14.2, 1.3, t); eye(c, 7.4, -14, 1.2, t);
    blush(c, 5.8, -11.4);
    scarf(c, team, 2.8, -8.9, 8.4, t, o.walk || o.air, 0.45);
  },

  // oso polar: redondito y panzón, orejas chiquitas, hocico grande y nariz negra
  oso(c, team, o, t) {
    const w = o.walk ? Math.sin(t * 14) : 0, fur = "#fbf8f1", sh = "#e2d9c6";
    ov(c, -4, -1.7 - Math.max(0, w) * 1.3, 3, 2.2, "#efe7d5"); ov(c, 3.8, -1.7 - Math.max(0, -w) * 1.3, 3, 2.2, "#efe7d5");
    shaded(c, -0.3, -7.6, 8, 7, fur, sh);
    ov(c, -1.8, -20, 2.5, 2.4, fur); ov(c, 5.8, -20.8, 2.5, 2.4, fur);
    shaded(c, 2.8, -15.4, 6.9, 6, fur, sh);
    ov(c, 7.4, -13.4, 3.7, 2.9, "#ffffff");
    c.save(); c.translate(4.8, -9.2); c.rotate(o.cling ? -2.2 : 0.4 + (o.walk ? Math.sin(t * 14) * 0.5 : 0) + (o.air ? -1 : 0));
    shaded(c, 0, 2.8, 2.2, 3.4, fur, sh); c.restore();
    if (detail()) {
      c.fillStyle = "#ffffff"; ell(c, 1.4, -6.4, 4.6, 4.2);
      c.fillStyle = "#cdbfa6"; ell(c, -1.8, -20, 1.25, 1.2); ell(c, 5.8, -20.8, 1.25, 1.2);
      c.fillStyle = "#e9e0cc"; ell(c, -4, -1.2 - Math.max(0, w) * 1.3, 1.6, 0.8); ell(c, 3.8, -1.2 - Math.max(0, -w) * 1.3, 1.6, 0.8);
      c.fillStyle = "#1d2129"; ell(c, 9.9, -14.5, 1.7, 1.2); c.fillStyle = "rgba(255,255,255,.75)"; ell(c, 9.4, -14.9, 0.55, 0.35);
      c.strokeStyle = "#1d2129"; c.lineWidth = 0.55; c.beginPath(); c.moveTo(9.7, -13.3); c.lineTo(9.7, -12.5); c.stroke();
    }
    smile(c, 9.7, -12.5, 1.4);
    eye(c, 3.4, -16.4, 1.4, t); eye(c, 6.7, -16.8, 1.3, t);
    blush(c, 4.4, -13.2);
    scarf(c, team, 2.4, -10, 12.6, t, o.walk || o.air, 0.06);
  },

  // reno: astas grandes, panza clarita y nariz roja que brilla
  reno(c, team, o, t) {
    const fur = "#a06d45", sh = "#7c5233", cream = "#efdcbf";
    legs4(c, "#7a5236", "#2e2019", t, o.walk, o.air, 2.4);
    ov(c, -7.8, -9.8, 2, 1.6, "#fbf5ec");
    shaded(c, -1, -8.4, 7.2, 5, fur, sh);
    // astas, detrás de la cabeza
    const antler = (w, col) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
      c.moveTo(3.8, -17.4); c.lineTo(2.4, -21.6); c.lineTo(0.8, -24.4); c.moveTo(2.4, -21.6); c.lineTo(-0.6, -22.4); c.moveTo(3, -19.6); c.lineTo(4.6, -22.2);
      c.moveTo(7, -17.8); c.lineTo(8, -22); c.lineTo(9.8, -24.6); c.moveTo(8, -22); c.lineTo(10.8, -22.6); c.moveTo(7.4, -20); c.lineTo(6, -22.2);
      c.stroke();
    };
    antler(INK.on ? 3 : 1.4, INK.on || "#ecd6a8");
    ov(c, 3.9, -11.4, 3, 3.9, fur);
    ov(c, 2.4, -16.4, 2.5, 1.1, fur, -0.7); ov(c, 8.6, -16.8, 2.5, 1.1, fur, 0.7);
    shaded(c, 5.6, -14.6, 4.6, 4, fur, sh);
    ov(c, 9.2, -13.2, 2.9, 2.3, "#d8b088");
    if (detail()) {
      c.fillStyle = cream; ell(c, 1, -6.4, 4.8, 2.4); ell(c, 3.8, -10.4, 2.4, 2.8);
      c.fillStyle = "#f6c9a8"; ell(c, 2.4, -16.4, 1.3, 0.5, -0.7); ell(c, 8.6, -16.8, 1.3, 0.5, 0.7);
      const g = c.createRadialGradient(11.4, -13.6, 0, 11.4, -13.6, 4);
      g.addColorStop(0, "rgba(255,90,90,.45)"); g.addColorStop(1, "rgba(255,90,90,0)"); c.fillStyle = g; c.fillRect(7, -18, 9, 9);
      c.fillStyle = "#e5484d"; ell(c, 11.4, -13.6, 1.7, 1.55); c.fillStyle = "rgba(255,255,255,.75)"; ell(c, 11, -14.2, 0.55, 0.42);
    }
    smile(c, 9.6, -12.2, 1.1);
    eye(c, 5.1, -15.4, 1.3, t); eye(c, 7.7, -15.3, 1.2, t);
    blush(c, 6.4, -12.8);
    scarf(c, team, 3.9, -10.6, 7.4, t, o.walk || o.air, 0.4);
  },

  // lobo ártico: más grande, lomo gris, hocico ancho y ojos ámbar
  lobo(c, team, o, t) {
    const fur = "#eef2f5", sh = "#c5d0d9", gray = "#b9c6d0";
    c.save(); c.translate(-6.6, -8.4); c.rotate(-0.3 + Math.sin(t * (o.walk ? 10 : 2)) * 0.12);
    shaded(c, -4, 1.2, 5.4, 2.8, fur, sh); ov(c, -8.2, 1.6, 2.1, 2, gray); c.restore();
    legs4(c, "#e3e9ee", "#9eacb8", t, o.walk, o.air, 2.5);
    shaded(c, -0.8, -8.2, 7.4, 5.4, fur, sh);
    poly(c, [1.8, -16.8, 1.2, -22.8, 5, -18], fur); poly(c, [5.8, -17.8, 8.4, -22.6, 9.2, -16.2], fur);
    poly(c, [0.8, -15, -2.8, -11.6, 1.6, -10.4], fur);
    shaded(c, 4.6, -13.8, 5.6, 5, fur, sh);
    ov(c, 9.6, -12.2, 4.1, 2.5, fur);
    if (detail()) {
      c.fillStyle = gray; ell(c, -2.4, -11.6, 5, 2.1); ell(c, 3.6, -17, 3.4, 1.5);
      c.fillStyle = "#97a6b3"; c.beginPath(); c.moveTo(2.2, -17.2); c.lineTo(1.6, -21.6); c.lineTo(4.4, -18.2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(6.2, -17.8); c.lineTo(8.1, -21.4); c.lineTo(8.6, -16.6); c.closePath(); c.fill();
      c.fillStyle = "#ffffff"; ell(c, 9.4, -11.2, 3.4, 1.2); ell(c, 3.6, -8.6, 3, 3);
      c.fillStyle = "#1a1f26"; ell(c, 13.2, -12.8, 1.35, 1.1); c.fillStyle = "rgba(255,255,255,.7)"; ell(c, 12.8, -13.2, 0.45, 0.32);
      c.strokeStyle = "#5c6a76"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(3.4, -16.2); c.lineTo(5.6, -15.8); c.moveTo(6.6, -15.9); c.lineTo(8.6, -16.1); c.stroke();
    }
    eye(c, 4.6, -14.4, 1.3, t, "#e3a43a"); eye(c, 7.6, -14.2, 1.2, t, "#e3a43a");
    blush(c, 6.2, -11.6);
    scarf(c, team, 2.8, -9.2, 9.6, t, o.walk || o.air, 0.42);
  },

  // liebre ártica: orejas larguísimas con puntas negras, patas grandes; avanza a saltitos
  liebre(c, team, o, t) {
    const fur = "#f8fafc", sh = "#d8e0e8";
    ov(c, -2.6, -1.5, 5.2, 1.8, "#e6edf3");
    ov(c, -6.9, -8.6, 2.5, 2.3, "#ffffff");
    shaded(c, -0.6, -7.4, 6.6, 6.3, fur, sh);
    ov(c, 3.8, -1.6, 1.9, 1.4, "#e6edf3");
    const ears = [];
    for (const [x, base] of [[2.2, -0.35], [4.8, 0.12]]) {
      c.save(); c.translate(x, -17); c.rotate(base + Math.sin(t * 2.2 + x) * 0.06 + (o.air ? -0.25 : 0) + (o.walk ? Math.sin(t * 9) * 0.12 : 0));
      shaded(c, 0, -4.8, 2, 5.4, fur, sh);
      if (detail()) { c.fillStyle = "#ffc3d0"; ell(c, 0.2, -4.4, 0.95, 3.8); c.fillStyle = "#2a2f36"; c.beginPath(); c.ellipse(0, -8.6, 1.9, 1.7, 0, Math.PI * 1.08, Math.PI * 1.92); c.lineTo(0, -10.2); c.fill(); ell(c, 0, -9.4, 1.55, 0.95); }
      c.restore();
    }
    shaded(c, 3.8, -13.6, 5, 4.6, fur, sh);
    if (detail()) {
      c.fillStyle = "#ffffff"; ell(c, 1, -6, 4, 3.8); ell(c, 7.4, -12, 2.2, 1.7);
      c.fillStyle = "#ff8fa8"; ell(c, 8.6, -12.8, 0.95, 0.75);
    }
    smile(c, 8.3, -11.6, 0.9);
    eye(c, 3.8, -14.2, 1.35, t); eye(c, 6.8, -14, 1.25, t);
    whiskers(c, 8.8, -12.2);
    blush(c, 5, -11.8);
    scarf(c, team, 3, -8.9, 9, t, o.walk || o.air, 0.14);
  },
};

// niña y niño inuit con parka de capucha con piel; la parka es del color del equipo
const PARKA = { F: ["#3f8fd8", "#2a69a8", "#7cc0f2"], B: ["#f08a3c", "#c2622a", "#ffb47a"] };
function inuitKid(c, team, o, t, girl) {
  const w = o.walk ? Math.sin(t * 16) : 0, [parka, dark, light] = PARKA[team] || PARKA.F, fur = "#f4ecdd", furD = "#e0d2bb";
  // botas (kamik) con borde de piel
  rrect(c, -5.8, -3.6 - Math.max(0, w) * 1.2, 4.8, 3.6, 1.5); fillPath(c, "#7d5136");
  rrect(c, 1.1, -3.6 - Math.max(0, -w) * 1.2, 4.8, 3.6, 1.5); fillPath(c, "#7d5136");
  // parka
  c.beginPath(); c.moveTo(-7.8, -3.2); c.quadraticCurveTo(-8.6, -11, -5, -14.4); c.lineTo(5.6, -14.4); c.quadraticCurveTo(8.8, -11, 8, -3.2); c.closePath(); fillPath(c, parka);
  // capucha con su anillo de piel
  ov(c, 2, -17.2, 7.4, 6.9, parka);
  if (!girl) ov(c, 0.6, -24, 2.1, 2.1, fur);
  ov(c, 2.8, -16.8, 6, 5.6, fur);
  c.save(); c.translate(4.4, -11.4); c.rotate(o.cling ? -2.3 : 0.3 + (o.walk ? Math.sin(t * 16) * 0.5 : 0) + (o.air ? -1 : 0));
  ov(c, 0, 2.8, 2.1, 3.4, parka); ov(c, 0, 6.4, 2.1, 1.9, dark); c.restore();
  if (detail()) {
    c.fillStyle = "#e9dcc8"; c.fillRect(-5.8, -3.8 - Math.max(0, w) * 1.2, 4.8, 1.1); c.fillRect(1.1, -3.8 - Math.max(0, -w) * 1.2, 4.8, 1.1);
    // volumen: costado oscuro, brillo en el hombro, ribete de piel abajo y una costura central
    c.fillStyle = dark; c.beginPath(); c.moveTo(-7.9, -3.2); c.quadraticCurveTo(-8.5, -9, -6.6, -12.6); c.lineTo(-5, -12.6); c.quadraticCurveTo(-6.4, -8, -5.6, -3.2); c.closePath(); c.fill();
    c.fillStyle = light; ell(c, 4.6, -12.4, 2.4, 1, 0.3);
    c.fillStyle = fur; rrect(c, -8, -5.2, 16.2, 2.4, 1.2); c.fill();
    c.fillStyle = furD; for (let k = -7; k < 8; k += 2) ell(c, k, -4, 0.7, 0.5);
    c.strokeStyle = dark; c.lineWidth = 0.6; c.beginPath(); c.moveTo(1.4, -14); c.lineTo(1.4, -5.4); c.stroke();
    c.fillStyle = dark; ell(c, 2, -21.4, 4.4, 1.2);
    c.fillStyle = furD; for (let k = 0; k < 12; k++) { const a = k * 0.524 + 0.2; ell(c, 2.8 + Math.cos(a) * 5.6, -16.8 + Math.sin(a) * 5.2, 1.25, 1.25); }
    c.fillStyle = "#c98b5e"; ell(c, 3.1, -16.3, 4.4, 4.1);
    c.fillStyle = "#2a1d17"; c.beginPath(); c.ellipse(3, -18.4, 4.5, 2.5, 0, Math.PI, 0); c.fill();
    if (girl) { c.fillStyle = "#2a1d17"; ell(c, -1.6, -12.6, 1.4, 2.6); ell(c, 7.8, -12.6, 1.4, 2.6); c.fillStyle = fur; ell(c, -1.6, -10.4, 1.1, 0.85); ell(c, 7.8, -10.4, 1.1, 0.85); }
  }
  eye(c, 2.1, -16.2, 1.2, t); eye(c, 5.2, -16.1, 1.12, t);
  if (detail()) { c.fillStyle = "rgba(235,100,100,.55)"; ell(c, 1, -14.4, 1.4, 0.85); ell(c, 6.2, -14.4, 1.4, 0.85); }
  smile(c, 3.7, -14.3, 1.1);
}
CHAR_DRAW.nina = (c, team, o, t) => inuitKid(c, team, o, t, true);
CHAR_DRAW.nino = (c, team, o, t) => inuitKid(c, team, o, t, false);
// color del contorno de cada uno (el pingüino no lleva: ya contrasta solo)
const INKED = { foca: "#7186a0", zorro: "#7a8898", oso: "#7a705e", reno: "#3b261a", lobo: "#5d6b78", liebre: "#7c8a99", nina: "#1f3f63", nino: "#6a3416" };

// Dibuja un personaje con su caja de juego en (x, y). o: t, walk, air, wet, squash, anchor, cling, stamina, alpha.
function drawCharacter(c, kind, team, x, y, face, o) {
  const draw = CHAR_DRAW[kind] || CHAR_DRAW.pinguino;
  const cx = x + PW / 2, by = y + PH, t = o.t || 0;
  c.save(); c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.translate(cx, by);
  let rot = 0, sx = 1, sy = 1 + Math.sin(t * 3) * 0.015, hop = 0;
  if (o.walk && WADDLE[kind]) rot = Math.sin(t * 16) * 0.13;
  if (o.walk && !WADDLE[kind]) hop = kind === "liebre" ? -Math.abs(Math.sin(t * 9)) * 3.5 : -Math.abs(Math.sin(t * 16)) * 0.8;
  if (o.air) { sy = 1.06; sx = 0.95; }
  if (o.wet) rot = face * (0.3 + Math.sin(t * 6) * 0.08);
  if (o.squash > 0) { sy -= 0.18 * o.squash; sx += 0.16 * o.squash; }
  if (o.anchor) { sy = 0.84; sx = 1.14; }
  if (o.cling) rot = face * 0.12;
  if (o.frozen) c.translate(Math.sin(t * 55) * 0.5, 0); // tiritando dentro del hielo
  c.translate(0, hop); c.rotate(rot); c.scale(sx * face, sy);
  c.lineCap = "butt";
  scarf.off = !!o.noScarf;
  if (INKED[kind]) { INK.on = INKED[kind]; draw(c, team, o, t); INK.on = null; }
  draw(c, team, o, t);
  scarf.off = false;
  if (o.frozen) {
    c.fillStyle = "rgba(190,236,255,.45)"; rrect(c, -9.5, -24, 19, 25, 4); c.fill();
    c.strokeStyle = "rgba(235,250,255,.9)"; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = "rgba(255,255,255,.65)"; c.fillRect(-7.2, -21, 1.3, 9); c.fillRect(-5, -21, 0.8, 4);
  }
  c.restore();
  if (o.cling && o.stamina != null) {
    const k = o.stamina / PHYS.cling;
    c.lineWidth = 2; c.strokeStyle = "rgba(8,17,28,.6)";
    c.beginPath(); c.arc(cx, y - 14, 4.5, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = k > 0.35 ? "#f3f8fb" : "#ff8b4a";
    c.beginPath(); c.arc(cx, y - 14, 4.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.stroke();
  }
}
// compatibilidad: drawPenguin(c, equipo, ...) usa el personaje elegido si viene en o.kind
function drawPenguin(c, id, x, y, face, o) { drawCharacter(c, o.kind || "pinguino", id, x, y, face, o); }
