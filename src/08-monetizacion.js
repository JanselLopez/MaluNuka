// ---------- Anuncios y "Sin anuncios" ----------
// Un solo aviso con dos caminos: ver un anuncio corto (con recompensa) o pagar una vez y no ver anuncios nunca más.
// Aparece al entrar por primera vez en la sesión al primer nivel de los mundos 2 a 7, y la primera vez que eligen
// una pareja (que no sea la de pingüinos). En línea solo lo ve quien elige el nivel.
// Déjalo en false para jugar sin anuncios ni compras. Cambiar a true para activar la monetización.
const MONETIZATION_ENABLED = false;
store.adPairs = store.adPairs || {};
const Monet = {
  worldSeen: {}, price: "US$1.99", busy: false,
  get noAds() { return !!store.noAds; },
  // ¿hace falta el aviso para entrar a este nivel?
  worldNeedsAd(i) {
    if (!MONETIZATION_ENABLED) return false;
    const lv = LEVELS[i];
    if (!lv || this.noAds || lv.world < 2 || this.worldSeen[lv.world]) return false;
    return i === 0 || LEVELS[i - 1].world !== lv.world; // primer nivel del mundo
  },
  pairNeedsAd(id) { return MONETIZATION_ENABLED && !this.noAds && id !== "pinguinos" && isUnlocked(id) && !store.adPairs[id]; },
};

// ---------- el aviso ----------
let gateCtx = null;
function openGate(ctx) {
  gateCtx = ctx;
  const g = $("gate"), shop = ctx.kind === "shop";
  if (ctx.kind === "world") {
    const w = LEVELS[ctx.level].world;
    $("gateTitle").textContent = `Mundo ${w} · ${WORLDS[w]}`;
    $("gateText").textContent = "Mira un anuncio corto para entrar, o quita los anuncios para siempre con un solo pago.";
  } else if (ctx.kind === "pair") {
    $("gateTitle").textContent = pairById(ctx.pair).name;
    $("gateText").textContent = "Mira un anuncio corto y esta pareja queda lista para siempre. O quita todos los anuncios con un solo pago.";
  } else {
    $("gateTitle").textContent = "Sin anuncios, para siempre";
    $("gateText").textContent = "Un solo pago: nunca más verán anuncios y todas las parejas que rescaten quedan listas para usar.";
  }
  $("gateWatch").hidden = shop; $("gateRestore").hidden = !shop;
  $("gatePrice").textContent = `Para siempre · ${Monet.price}`;
  $("gateMsg").hidden = true;
  g.hidden = false;
  Store.refreshPrice();
}
function closeGate(ok) {
  $("gate").hidden = true;
  const ctx = gateCtx; gateCtx = null;
  if (ok && ctx && ctx.done) ctx.done();
}
function gateMessage(text) { const m = $("gateMsg"); m.textContent = text; m.hidden = !text; }
// lo que se gana con el anuncio
function grantGate(ctx) {
  if (ctx.kind === "world") Monet.worldSeen[LEVELS[ctx.level].world] = true;
  if (ctx.kind === "pair") { store.adPairs[ctx.pair] = true; save(); }
}
function paintGate(t) {
  if (!gateCtx) return;
  const cv = $("gateArt"), c = cv.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  if (gateCtx.kind === "world") { c.setTransform(0.5, 0, 0, 0.5, 0, 0); drawRegion(c, LEVELS[gateCtx.level].world, 0, 480, t); }
  else { const g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, "#1f4f7a"); g.addColorStop(1, "#12304b"); c.fillStyle = g; c.fillRect(0, 0, 240, 120); }
  c.setTransform(4, 0, 0, 4, 0, 0);
  drawPair(c, gateCtx.kind === "pair" ? pairById(gateCtx.pair) : curPair(), 30, 28, t, { walk: true });
}

// ---------- anuncios ----------
const Ads = {
  start() { return Promise.resolve(); },
  showRewarded() { return fakeAd(); },
};
// en el navegador: un anuncio simulado de 5 segundos para probar el flujo
function fakeAd() {
  return new Promise((resolve) => {
    const el = $("fakeAd"), bar = $("fakeAdBar"), sec = $("fakeAdSec");
    el.hidden = false; const t0 = performance.now(), len = 5000;
    const tick = () => {
      if (el.hidden) return;
      const k = Math.min(1, (performance.now() - t0) / len);
      bar.style.width = (k * 100).toFixed(1) + "%"; sec.textContent = Math.ceil((len - (performance.now() - t0)) / 1000);
      if (k >= 1) { el.hidden = true; resolve("ok"); } else requestAnimationFrame(tick);
    };
    $("fakeAdClose").onclick = () => { el.hidden = true; resolve("closed"); };
    tick();
  });
}

// ---------- la compra única ----------
const Store = {
  refreshPrice() {},
  async buy() { return confirm("Compra de prueba (solo en el navegador): ¿simular que pagaste?"); },
  async restore() { return false; },
};
function setNoAds() {
  store.noAds = true; save();
  $("btnNoAds").hidden = true;
  toast("¡Gracias! Ya no verán anuncios.");
  if (S.screen === "chars") buildCharsScreen();
}

// ---------- botones del aviso ----------
$("gateWatch").onclick = async () => {
  if (Monet.busy || !gateCtx) return; Monet.busy = true; unlockAudio();
  const ctx = gateCtx; gateMessage("");
  const r = await Ads.showRewarded();
  Monet.busy = false;
  if (r === "ok") { grantGate(ctx); closeGate(true); }
  else if (r === "none") { grantGate(ctx); closeGate(true); toast("No había anuncios disponibles. ¡Pasen gratis!"); } // nunca trabar el juego por falta de anuncios
  else gateMessage("El anuncio se cerró antes de terminar. Pueden volver a intentarlo.");
};
$("gateBuy").onclick = async () => {
  if (Monet.busy) return; Monet.busy = true; gateMessage("");
  try { if (await Store.buy()) { setNoAds(); closeGate(true); } }
  catch (e) { gateMessage("No se completó la compra. No se cobró nada."); }
  Monet.busy = false;
};
$("gateRestore").onclick = async () => {
  if (Monet.busy) return; Monet.busy = true;
  const ok = await Store.restore(); Monet.busy = false;
  if (ok) { setNoAds(); closeGate(true); } else gateMessage("No encontramos una compra anterior con esta cuenta.");
};
$("gateCancel").onclick = () => closeGate(false);
$("btnNoAds").hidden = !MONETIZATION_ENABLED || Monet.noAds;
if (MONETIZATION_ENABLED) {
  $("btnNoAds").onclick = () => { unlockAudio(); openGate({ kind: "shop" }); };
  Ads.start();
}
// si ya habían comprado en otro teléfono con la misma cuenta, se recupera solo al abrir
