// Dibuja el ícono y la pantalla de inicio de la app con el mismo código que dibuja a los personajes.
// Uso: node scripts/iconos.js  → assets/*.png ; después: npm run icons (los adapta a Android)
const fs = require("fs"), path = require("path");
const { createCanvas } = require("@napi-rs/canvas");
const root = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");
// el motor y los dibujos sin el resto de la app (no hace falta el navegador)
const G = new Function(src("03-engine.js") + "\n" + src("05-draw.js") + "\n" + src("07-chars.js") + "\nreturn { drawCharacter, PW, PH };")();

const out = path.join(root, "assets");
fs.mkdirSync(out, { recursive: true });
const save = (cv, name) => fs.writeFileSync(path.join(out, name), cv.toBuffer("image/png"));

function sky(c, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1f4f7a"); g.addColorStop(0.6, "#12304b"); g.addColorStop(1, "#0b1626");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // aurora
  c.save(); c.globalCompositeOperation = "lighter";
  for (const [col, y, a] of [["rgba(127,227,199,.11)", 0.22, 0.07], ["rgba(150,140,255,.09)", 0.30, 0.05]]) {
    c.strokeStyle = col; c.lineWidth = h * a; c.beginPath();
    for (let x = -50; x <= w + 50; x += w / 40) { const yy = h * y + Math.sin(x / w * 7) * h * 0.04; x < 0 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
    c.stroke();
  }
  c.restore();
  // estrellitas fijas
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "rgba(232,244,255,.8)";
  for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h * 0.55, z = (r() < 0.2 ? 2.4 : 1.2) * w / 1024; c.fillRect(x, y, z, z); }
}
// la pareja de pingüinos parada sobre un montículo de nieve, centrada en (cx, by)
function pair(c, cx, by, k) {
  c.fillStyle = "#eef6fb"; c.beginPath(); c.ellipse(cx, by + 4 * k, 34 * k, 9 * k, 0, Math.PI, 0); c.fill();
  c.fillStyle = "rgba(160,200,225,.5)"; c.beginPath(); c.ellipse(cx, by + 4 * k, 34 * k, 2.2 * k, 0, 0, Math.PI); c.fill();
  for (const [team, dx, face] of [["F", -10.5, 1], ["B", 10.5, -1]]) {
    c.save(); c.translate(cx + dx * k, by); c.scale(k, k);
    G.drawCharacter(c, "pinguino", team, -G.PW / 2, -G.PH, face, { t: 0.5 });
    c.restore();
  }
}

// ícono adaptativo de Android: fondo + figura (la figura dentro del círculo central seguro)
const N = 1024;
const bg = createCanvas(N, N); sky(bg.getContext("2d"), N, N); save(bg, "icon-background.png");
const fg = createCanvas(N, N); pair(fg.getContext("2d"), N / 2, N * 0.66, 15.5); save(fg, "icon-foreground.png");
const only = createCanvas(N, N), oc = only.getContext("2d");
sky(oc, N, N); pair(oc, N / 2, N * 0.7, 17); save(only, "icon-only.png");
// pantalla de inicio
const S = 2732;
for (const name of ["splash.png", "splash-dark.png"]) {
  const sp = createCanvas(S, S), sc = sp.getContext("2d");
  sky(sc, S, S); pair(sc, S / 2, S * 0.58, 15); save(sp, name);
}
console.log("listo: assets/icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png");
