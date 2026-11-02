// Capa de compatibilidad: un "CanvasRenderingContext2D" sobre Skia.
// Así el mismo código de dibujo de la web (personajes, fondos, agua, rapes…) corre en la app nativa, en la GPU.
// Funciona con @shopify/react-native-skia en el teléfono y con su modo "headless" en Node (para probar en la PC).

export function makeCanvas2D(Skia, enums) {
  const { BlendMode, PaintStyle, StrokeCap, StrokeJoin, TileMode, FillType } = enums;
  const colorCache = new Map();
  const color = (css) => {
    let c = colorCache.get(css);
    if (!c) { c = Skia.Color(css); colorCache.set(css, c); }
    return c;
  };
  const BLEND = { "source-over": BlendMode.SrcOver, lighter: BlendMode.Plus, "source-atop": BlendMode.SrcATop, "destination-out": BlendMode.DstOut, copy: BlendMode.Src };

  class Gradient {
    constructor(kind, args) { this.kind = kind; this.args = args; this.stops = []; this.shader = null; }
    addColorStop(o, c) { this.stops.push([o, c]); this.shader = null; }
    make() {
      if (this.shader) return this.shader;
      const stops = [...this.stops].sort((a, b) => a[0] - b[0]);
      const cols = stops.map((s) => color(s[1])), pos = stops.map((s) => s[0]);
      const a = this.args;
      this.shader = this.kind === "linear"
        ? Skia.Shader.MakeLinearGradient(Skia.Point(a[0], a[1]), Skia.Point(a[2], a[3]), cols, pos, TileMode.Clamp)
        : Skia.Shader.MakeTwoPointConicalGradient(Skia.Point(a[0], a[1]), a[2], Skia.Point(a[3], a[4]), a[5], cols, pos, TileMode.Clamp);
      return this.shader;
    }
  }

  // matriz 2D [a, b, c, d, e, f] como en canvas
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const skMatrix = (m) => Skia.Matrix([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]);

  class Ctx {
    // getCanvas: función que da el SkCanvas actual (cambia en cada cuadro para la pantalla principal)
    constructor(owner, getCanvas, fonts) {
      this.canvas = owner; this.getCanvas = getCanvas; this.fonts = fonts;
      this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
      this.fillStyle = "#000"; this.strokeStyle = "#000"; this.lineWidth = 1; this.lineCap = "butt"; this.lineJoin = "miter";
      this.globalAlpha = 1; this.globalCompositeOperation = "source-over"; this.font = "10px sans-serif"; this.textAlign = "start"; this.textBaseline = "alphabetic";
      this.dash = []; this.path = Skia.PathBuilder.Make();
    }
    get sk() { return this.getCanvas(); }
    // ---- estado y transformaciones ----
    save() {
      this.stack.push({ m: this.m, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, lineJoin: this.lineJoin,
        globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, dash: this.dash });
      this.sk.save();
    }
    restore() { const s = this.stack.pop(); if (!s) return; Object.assign(this, s); this.sk.restore(); }
    setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
    resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
    transform(a, b, c, d, e, f) { this.m = mul(this.m, [a, b, c, d, e, f]); }
    translate(x, y) { this.m = mul(this.m, [1, 0, 0, 1, x, y]); }
    scale(x, y) { this.m = mul(this.m, [x, 0, 0, y, 0, 0]); }
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.m = mul(this.m, [c, s, -s, c, 0, 0]); }
    setLineDash(d) { this.dash = d || []; }
    // ---- caminos (en coordenadas del usuario; se transforman al pintar) ----
    beginPath() { this.path = Skia.PathBuilder.Make(); }
    moveTo(x, y) { this.path.moveTo(x, y); }
    lineTo(x, y) { this.path.lineTo(x, y); }
    closePath() { this.path.close(); }
    quadraticCurveTo(cx, cy, x, y) { this.path.quadTo(cx, cy, x, y); }
    bezierCurveTo(a, b, c, d, x, y) { this.path.cubicTo(a, b, c, d, x, y); }
    rect(x, y, w, h) { this.path.addRect(Skia.XYWHRect(x, y, w, h)); }
    roundRect(x, y, w, h, r) {
      const rr = Math.max(0, Math.min(typeof r === "number" ? r : (r && r[0]) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.path.addRRect(Skia.RRectXY(Skia.XYWHRect(Math.min(x, x + w), Math.min(y, y + h), Math.abs(w), Math.abs(h)), rr, rr));
    }
    arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
      if (rx <= 0 || ry <= 0) return;
      let sweep = a1 - a0;
      if (ccw) { if (sweep > 0) sweep -= Math.PI * 2 * Math.ceil(sweep / (Math.PI * 2)); }
      else if (sweep < 0) sweep += Math.PI * 2 * Math.ceil(-sweep / (Math.PI * 2));
      const full = Math.abs(sweep) >= Math.PI * 2 - 1e-6;
      const oval = Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2);
      const d0 = (a0 * 180) / Math.PI, ds = (sweep * 180) / Math.PI;
      // un círculo entero en dos mitades (Skia no dibuja un arco de 360° de una vez)
      const arcs = (path, move) => {
        if (full) { const h = sweep > 0 ? 180 : -180; path.arcToOval(oval, d0, h, move); path.arcToOval(oval, d0 + h, h, false); }
        else path.arcToOval(oval, d0, ds, move);
      };
      if (!rot) { arcs(this.path, false); return; }
      const sub = Skia.PathBuilder.Make();
      arcs(sub, true);
      const c = Math.cos(rot), s = Math.sin(rot);
      sub.transform(Skia.Matrix([c, -s, x - c * x + s * y, s, c, y - s * x - c * y, 0, 0, 1]));
      this.path.addPath(sub.detach());
    }
    // ---- pintar ----
    paint(style, stroke) {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      if (typeof style === "string") { p.setColor(color(style)); p.setAlphaf(p.getAlphaf() * this.globalAlpha); }
      else if (style && style.make) { p.setShader(style.make()); p.setAlphaf(this.globalAlpha); }
      const bm = BLEND[this.globalCompositeOperation]; if (bm != null && bm !== BlendMode.SrcOver) p.setBlendMode(bm);
      if (stroke) {
        p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(this.lineWidth);
        p.setStrokeCap(this.lineCap === "round" ? StrokeCap.Round : this.lineCap === "square" ? StrokeCap.Square : StrokeCap.Butt);
        p.setStrokeJoin(this.lineJoin === "round" ? StrokeJoin.Round : this.lineJoin === "bevel" ? StrokeJoin.Bevel : StrokeJoin.Miter);
        if (this.dash.length) { const d = this.dash.length % 2 ? [...this.dash, ...this.dash] : this.dash; p.setPathEffect(Skia.PathEffect.MakeDash(d, 0)); }
      }
      return p;
    }
    withMatrix(fn) {
      const sk = this.sk; sk.save(); sk.concat(skMatrix(this.m)); fn(sk); sk.restore();
    }
    fill() { const p = this.paint(this.fillStyle, false), path = this.path.build(); this.withMatrix((sk) => sk.drawPath(path, p)); }
    stroke() { const p = this.paint(this.strokeStyle, true), path = this.path.build(); this.withMatrix((sk) => sk.drawPath(path, p)); }
    clip() {
      const clipPath = Skia.PathBuilder.Make().addPath(this.path.build(), skMatrix(this.m)).detach();
      this.sk.clipPath(clipPath, enums.ClipOp.Intersect, true);
    }
    fillRect(x, y, w, h) { const p = this.paint(this.fillStyle, false); this.withMatrix((sk) => sk.drawRect(Skia.XYWHRect(x, y, w, h), p)); }
    strokeRect(x, y, w, h) { const p = this.paint(this.strokeStyle, true); this.withMatrix((sk) => sk.drawRect(Skia.XYWHRect(x, y, w, h), p)); }
    clearRect(x, y, w, h) {
      const p = Skia.Paint(); p.setBlendMode(BlendMode.Clear);
      this.withMatrix((sk) => sk.drawRect(Skia.XYWHRect(x, y, w, h), p));
    }
    createLinearGradient(x0, y0, x1, y1) { return new Gradient("linear", [x0, y0, x1, y1]); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient("radial", [x0, y0, r0, x1, y1, r1]); }
    // ---- imágenes (lienzos fuera de pantalla) ----
    drawImage(img, ...a) {
      const iw = img.width, ih = img.height;
      let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
      if (a.length === 2) { [dx, dy] = a; dw = iw; dh = ih; }
      else if (a.length === 4) { [dx, dy, dw, dh] = a; }
      else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
      const chunks = img.chunks ? img.chunks() : [{ x: 0, y: 0, w: iw, h: ih, image: img }];
      const p = Skia.Paint(); p.setAlphaf(this.globalAlpha);
      const kx = dw / sw, ky = dh / sh;
      this.withMatrix((sk) => {
        for (const ch of chunks) {
          // la parte del pedazo que cae dentro del rectángulo pedido
          const x0 = Math.max(sx, ch.x), y0 = Math.max(sy, ch.y), x1 = Math.min(sx + sw, ch.x + ch.w), y1 = Math.min(sy + sh, ch.y + ch.h);
          if (x1 <= x0 || y1 <= y0) continue;
          sk.drawImageRect(ch.image, Skia.XYWHRect(x0 - ch.x, y0 - ch.y, x1 - x0, y1 - y0),
            Skia.XYWHRect(dx + (x0 - sx) * kx, dy + (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky), p, true);
        }
      });
    }
    // ---- texto ----
    fontFor() {
      const m = /(?:(\d{3}|bold)\s+)?([\d.]+)px\s+([^,]+)/.exec(this.font) || [];
      const weight = m[1] === "bold" ? 700 : +(m[1] || 400), size = +(m[2] || 10), fam = (m[3] || "").replace(/["']/g, "").trim();
      return this.fonts(fam, weight, size);
    }
    measureText(text) { const f = this.fontFor(); return { width: f ? f.getTextWidth(String(text)) : String(text).length * 6 }; }
    fillText(text, x, y) {
      const f = this.fontFor(); if (!f) return;
      text = String(text);
      const w = f.getTextWidth(text), mt = f.getMetrics();
      const dx = this.textAlign === "center" ? -w / 2 : this.textAlign === "right" || this.textAlign === "end" ? -w : 0;
      const dy = this.textBaseline === "middle" ? -(mt.ascent + mt.descent) / 2 : this.textBaseline === "top" ? -mt.ascent : this.textBaseline === "bottom" ? -mt.descent : 0;
      const p = this.paint(this.fillStyle, false);
      this.withMatrix((sk) => sk.drawText(text, x + dx, y + dy, p, f));
    }
  }

  // lienzo fuera de pantalla (lo que la web crea con document.createElement("canvas")).
  // Se graba como dibujo vectorial y, al usarlo, se pasa a imágenes en pedazos de hasta CHUNK px:
  // así un nivel largo no pasa el tamaño máximo de textura de la GPU y no se ve borroso.
  const CHUNK = 2048;
  class OffCanvas {
    constructor(fonts) { this._w = 1; this._h = 1; this.fonts = fonts; this.rec = null; this.pic = null; this._chunks = null; this.ctx = null; }
    get width() { return this._w; } set width(v) { this._w = Math.max(1, Math.round(v)); this.reset(); }
    get height() { return this._h; } set height(v) { this._h = Math.max(1, Math.round(v)); this.reset(); }
    reset() { this.rec = null; this.pic = null; this._chunks = null; }
    getContext() {
      if (!this.ctx) this.ctx = new Ctx(this, () => this.canvasNow(), this.fonts);
      return this.ctx;
    }
    canvasNow() {
      if (!this.rec) {
        this.rec = Skia.PictureRecorder();
        this._recCanvas = this.rec.beginRecording(Skia.XYWHRect(0, 0, this._w, this._h));
        if (this.pic) this._recCanvas.drawPicture(this.pic);
        this._chunks = null;
      }
      return this._recCanvas;
    }
    picture() {
      if (this.rec) { this.pic = this.rec.finishRecordingAsPicture(); this.rec = null; this._recCanvas = null; }
      return this.pic;
    }
    chunks() {
      if (this._chunks && !this.rec) return this._chunks;
      const pic = this.picture(), out = [];
      if (pic) for (let y = 0; y < this._h; y += CHUNK) for (let x = 0; x < this._w; x += CHUNK) {
        const w = Math.min(CHUNK, this._w - x), h = Math.min(CHUNK, this._h - y);
        const surf = Skia.Surface.Make(w, h); // en memoria (CPU): la imagen se puede usar desde cualquier hilo
        const c = surf.getCanvas(); c.translate(-x, -y); c.drawPicture(pic); surf.flush();
        out.push({ x, y, w, h, image: surf.makeImageSnapshot() });
      }
      this._chunks = out;
      return out;
    }
  }
  return { Ctx, OffCanvas };
}
