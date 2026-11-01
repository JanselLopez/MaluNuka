// Servidor local para previsualizar la web estática de Malu y Nuka.
// Uso: node servidor.js [puerto]   (por defecto 5320)
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const port = +process.argv[2] || 5320;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json; charset=utf-8", ".ico": "image/x-icon",
};
http.createServer((req, res) => {
  try {
    // /app/ sirve la carpeta www tal como va dentro de la app (tipografías y PeerJS incluidos)
    if (req.url.startsWith("/app")) {
      const rel = decodeURIComponent(req.url.split("?")[0].replace(/^\/app\/?/, "")) || "index.html";
      const p = path.join(__dirname, "www", rel);
      if (!p.startsWith(path.join(__dirname, "www")) || !fs.existsSync(p)) { res.writeHead(404); return res.end("no existe"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
      return res.end(fs.readFileSync(p));
    }
    // /publico/ permite probar localmente el mismo sitio estático que se publica en Pages.
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/publico") {
      res.writeHead(301, { location: "/publico/" });
      return res.end();
    }
    if (pathname.startsWith("/publico/")) {
      const publishRoot = path.resolve(__dirname, "publicar");
      const relativePath = decodeURIComponent(pathname.slice("/publico/".length)) || "index.html";
      const target = path.resolve(publishRoot, relativePath);
      const relativeTarget = path.relative(publishRoot, target);
      if (relativeTarget === ".." || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
        res.writeHead(403);
        return res.end("prohibido");
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404);
        return res.end("no existe");
      }
      const contents = fs.readFileSync(target);
      res.writeHead(200, {
        "content-type": TYPES[path.extname(target)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      return res.end(contents);
    }
    if (pathname === "/") {
      res.writeHead(302, { location: "/publico/", "cache-control": "no-store" });
      return res.end();
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("no existe");
  } catch (e) {
    console.error(`Error sirviendo ${req.url}:`, e);
    if (res.headersSent) return res.destroy(e);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("No se pudo servir la web: " + e.message);
  }
}).listen(port, () => {
  console.log(`Malu y Nuka listo en http://localhost:${port}`);
  for (const nets of Object.values(os.networkInterfaces())) for (const n of nets || [])
    if (n.family === "IPv4" && !n.internal) console.log(`En otro dispositivo de la misma red: http://${n.address}:${port}`);
});
