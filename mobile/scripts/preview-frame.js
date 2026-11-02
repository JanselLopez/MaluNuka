// Dibuja en la PC (sin teléfono) un cuadro del juego con el mismo código de la app, para revisar que se vea como la web.
// Uso: node scripts/preview-frame.js [nivel] [salida.png]
const fs = require("fs"), path = require("path");
const CanvasKitInit = require("canvaskit-wasm/bin/full/canvaskit.js");
const skiaLib = path.join(__dirname, "..", "node_modules", "@shopify", "react-native-skia", "lib", "commonjs");
(async () => {
  const CanvasKit = await CanvasKitInit({ locateFile: (f) => require.resolve("canvaskit-wasm/bin/full/" + f) });
  global.CanvasKit = CanvasKit;
  const { JsiSkApi } = require(path.join(skiaLib, "skia", "web"));
  const enums = require(path.join(skiaLib, "skia", "types"));
  const Skia = JsiSkApi(CanvasKit);
  const ttf = (p) => Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(require.resolve(p)))));
  const faces = { Fredoka600: ttf("@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf"), Fredoka700: ttf("@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf") };
  const cache = {};
  const fonts = (fam, weight, size) => { const tf = weight >= 700 ? faces.Fredoka700 : faces.Fredoka600; const k = weight + ":" + size; if (!cache[k]) { cache[k] = Skia.Font(tf, size); cache[k].setSubpixel(true); cache[k].setLinearMetrics(true); } return cache[k]; };
  const { createGame } = require("../src/game");
  const level = Math.max(0, (+process.argv[2] || 1) - 1), out = process.argv[3] || "frame.png";
  const w = 800, h = 380, pr = 2;
  const game = createGame({ Skia, enums, fonts, pixelRatio: pr, makeRoom: () => null });
  game.setMode("local");
  game.resize(w, h, { l: 0, r: 0 }, 72);
  let t0 = Date.now();
  game.pickLevel(level);
  console.log("cargar nivel", Date.now() - t0, "ms");
  game.touch.F.r = 1;
  for (let i = 0; i < 40; i++) game.frame(1 / 60, i / 60);
  const surf = Skia.Surface.Make(w * pr, h * pr), canvas = surf.getCanvas();
  canvas.scale(pr, pr);
  const ctx = new game.Ctx(null, () => canvas, fonts);
  const { createControls } = require("../src/controls");
  const controls = createControls(game);
  if (process.argv[2] === "mapa") {
    game.openMap(w, h); game.drawMap(ctx, w, h, 1);
    for (const [i, id] of game.PAIRS.map((p) => p.id).entries()) { ctx.setTransform(2, 0, 0, 2, 10 + i * 96, 250); game.drawPairCard(ctx, id, 1, i === 0); }
  } else {
    controls.layout(w, h, { l: 0, r: 0, b: 0 }); controls.down(1, 60, h - 40); controls.move(1, 100, h - 40); controls.down(2, w - 60, h - 40);
    game.render(ctx, 1); controls.draw(ctx);
  }
  if (process.argv[2] === "mapa") { surf.flush(); fs.writeFileSync(out, Buffer.from(surf.makeImageSnapshot().encodeToBytes())); process.exit(0); }
  game.render(ctx, 1); // el primero también arma las imágenes del nivel
  t0 = Date.now();
  for (let i = 0; i < 30; i++) game.render(ctx, 1 + i / 60);
  console.log("dibujar un cuadro", (Date.now() - t0) / 30, "ms");
  controls.draw(ctx);
  surf.flush();
  fs.writeFileSync(out, Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
  console.log("listo", out);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
