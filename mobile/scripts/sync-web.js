// Copia el juego de la web (niveles, motor y todos los dibujos) a la app, sin tocar la web.
// Uso: node scripts/sync-web.js   (lo corre "npm run sync" y antes de cada compilación)
// Genera src/web-game.js: una función que recibe un "document" falso (para los lienzos fuera de pantalla)
// y devuelve todo lo que la app necesita.
const fs = require("fs"), path = require("path");
const web = path.join(__dirname, "..", "..", "src");
const read = (f) => fs.readFileSync(path.join(web, f), "utf8");
const extra = fs.readdirSync(path.join(web, "levels")).filter((f) => /^\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a) - parseInt(b)).map((f) => "levels/" + f);
const files = ["02-levels.js", ...extra, "pistas.js", "03-engine.js", "05-draw.js", "07-chars.js"];
const names = ["LEVELS", "PISTAS", "T", "W", "H", "PW", "PH", "PHYS", "P_COLOR", "P_NAME", "rng",
  "parseLevel", "newPenguin", "updateWorld", "applyCarry", "stepPenguin", "ropeStep", "coopEvents", "launch", "blocked", "teleport", "seesawAt",
  "ell", "rrect", "buildCaches", "drawSky", "drawStatic", "drawKey", "drawDynamic", "drawWater", "drawAurora", "drawRope", "drawBall",
  "CHARS", "PAIRS", "pairById", "drawPair", "drawCageBars", "drawCharacter", "drawPenguin", "INK"];
const body = files.map((f) => `// ---- ${f} ----\n` + read(f)).join("\n");
const out = "// GENERADO por scripts/sync-web.js a partir de ../src (la web). No editar a mano.\n" +
  "/* eslint-disable */\nmodule.exports = function makeWebGame(document) {\n" + body +
  `\nreturn { ${names.join(", ")} };\n};\n`;
new Function("module", out); // falla aquí si hay un error de sintaxis
fs.writeFileSync(path.join(__dirname, "..", "src", "web-game.js"), out);
console.log("src/web-game.js listo:", files.length, "archivos de la web,", out.length, "bytes");
