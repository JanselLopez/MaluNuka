// Arma el juego a partir de src/. Uso: node build.js
//  - malu-y-nuka.html   para el servidor local de pruebas (node servidor.js) y para claude.ai
//  - publicar/            web completa, estática y lista para GitHub Pages
const fs = require("fs"), path = require("path");
const vm = require("vm");
const src = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
// los niveles nuevos viven en src/levels/NN.js, un archivo por nivel
const extra = fs.readdirSync(path.join(__dirname, "src", "levels")).filter((f) => /^\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a) - parseInt(b)).map((f) => "levels/" + f);
const order = ["02-levels.js", ...extra, "pistas.js", "03-engine.js", "05-draw.js", "07-chars.js", "04-app.js", "06-loop.js", "08-monetizacion.js"];
const js = order.map(src).join("\n");
new Function(js); // falla aquí si hay un error de sintaxis
const head = src("01-head.html");
const bodyStart = head.indexOf('<div id="stage">');
if (bodyStart < 0) throw new Error("no se encontró el inicio del contenido del juego en src/01-head.html");
const headMarkup = head.slice(0, bodyStart);
const bodyMarkup = head.slice(bodyStart);
fs.writeFileSync(path.join(__dirname, "malu-y-nuka.html"), head + "\n<script>\n" + js + "\n</script>\n");

const icon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Cellipse cx=%2216%22 cy=%2218%22 rx=%2210%22 ry=%2212%22 fill=%22%231b2735%22/%3E%3Cellipse cx=%2218%22 cy=%2220%22 rx=%226%22 ry=%228%22 fill=%22%23f3f8fb%22/%3E%3Cpath d=%22M24 14l6 2-6 2z%22 fill=%22%23ff9c33%22/%3E%3C/svg%3E';
const page = (viewport, extraHead) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  `<meta name="viewport" content="${viewport}">` +
  '<meta name="description" content="Juego cooperativo para dos: tienen que llegar juntos al iglú. En un celular o en línea, cada quien en su teléfono.">' +
  `<meta name="theme-color" content="#0b1626"><link rel="icon" href="${icon}">` + (extraHead || "") +
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#0b1626}[hidden]{display:none!important}</style></head><body>';

// Web estática y autocontenida para pruebas o GitHub Pages.
const mod = (p) => path.join(__dirname, "node_modules", p);
const publicar = path.join(__dirname, "publicar");
fs.mkdirSync(path.join(publicar, "lib"), { recursive: true });
fs.mkdirSync(path.join(publicar, "fonts"), { recursive: true });
if (fs.existsSync(mod("peerjs/dist/peerjs.min.js")))
  fs.copyFileSync(mod("peerjs/dist/peerjs.min.js"), path.join(publicar, "lib", "peerjs.min.js"));
if (fs.existsSync(mod("peerjs/LICENSE")))
  fs.copyFileSync(mod("peerjs/LICENSE"), path.join(publicar, "lib", "PEERJS-LICENSE.txt"));
const faces = [["Fredoka", "fredoka", [500, 600, 700]], ["Nunito", "nunito", [600, 800]]];
let css = "";
for (const [family, id, weights] of faces) for (const w of weights) {
  const file = `${id}-latin-${w}-normal.woff2`;
  if (fs.existsSync(mod(`@fontsource/${id}/files/${file}`))) {
    fs.copyFileSync(mod(`@fontsource/${id}/files/${file}`), path.join(publicar, "fonts", file));
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format("woff2")}\n`;
  }
}
for (const id of ["fredoka", "nunito"]) {
  const license = mod(`@fontsource/${id}/LICENSE`);
  if (fs.existsSync(license)) fs.copyFileSync(license, path.join(publicar, "fonts", `${id.toUpperCase()}-OFL.txt`));
}
fs.writeFileSync(path.join(publicar, "fonts", "fonts.css"), css);
const webHead = headMarkup.replace(/<link rel="preconnect"[^>]*>\s*/g, "").replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
if (webHead.includes("fonts.googleapis.com")) throw new Error("la web todavía intenta descargar tipografías de Google");
fs.writeFileSync(path.join(publicar, "index.html"),
  page("width=device-width,initial-scale=1,viewport-fit=cover", webHead +
    '<script data-goatcounter="https://janselalb.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>') +
  bodyMarkup +
  '\n<script src="lib/peerjs.min.js"></script>\n<script>\n' + js + "\n</script>\n</body></html>\n");
fs.writeFileSync(path.join(publicar, "LEEME.txt"), `MALU Y NUKA · versión web\n\n` +
  "Esta carpeta contiene el juego y sus recursos. Puedes publicarla como sitio estático.\n\n" +
  "GitHub Pages\n" +
  "1. Sube el proyecto completo a un repositorio de GitHub con una rama main.\n" +
  "2. En Settings > Pages, elige GitHub Actions como fuente de publicación.\n" +
  "3. Al hacer push a main, la acción publica esta carpeta automáticamente.\n\n" +
  "También puedes alojar index.html, fonts/ y lib/ juntos en cualquier hosting estático.\n" +
  "Los avisos de licencia de PeerJS y las fuentes están incluidos junto a esos recursos.\n" +
  "El modo en línea conecta los teléfonos por WebRTC y necesita internet.\n");

// Exporta la lógica común del juego para que React Native la ejecute con su propio renderizador.
const mobile = path.join(__dirname, "mobile", "src");
if (fs.existsSync(path.join(__dirname, "mobile"))) {
  const mobileAssets = path.join(__dirname, "mobile", "assets");
  fs.mkdirSync(mobileAssets, { recursive: true });
  if (fs.existsSync(path.join(__dirname, "assets", "icon-only.png")))
    fs.copyFileSync(path.join(__dirname, "assets", "icon-only.png"), path.join(mobileAssets, "icon.png"));
  const levelContext = {};
  vm.runInNewContext(src("02-levels.js") + "\n" + extra.map((f) => src(f)).join("\n") +
    "\nglobalThis.__mobileLevels=LEVELS;", levelContext);
  fs.writeFileSync(path.join(mobile, "levels.json"), JSON.stringify(levelContext.__mobileLevels, null, 2) + "\n");
  const engineExports = "\nmodule.exports={T,W,H,PW,PH,PHYS,parseLevel,newPenguin,updateWorld,applyCarry,stepPenguin,ropeStep,coopEvents,launch};\n";
  fs.writeFileSync(path.join(mobile, "game-engine.js"), src("03-engine.js") + engineExports);
}
console.log("malu-y-nuka.html listo:", fs.statSync(path.join(__dirname, "malu-y-nuka.html")).size, "bytes",
  "· publicar/ (web para GitHub Pages) listo");
