// Malu y Nuka para Android/iOS. El juego, sus dibujos y sus niveles son los mismos de la web (src/ del proyecto):
// se copian con scripts/sync-web.js y se dibujan con Skia en la GPU. Los menús son vistas nativas con el estilo de la web.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BackHandler, PanResponder, PixelRatio, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, Vibration, View, useWindowDimensions } from "react-native";
import { BlendMode, Canvas, ClipOp, FillType, PaintStyle, Picture, Skia, StrokeCap, StrokeJoin, TileMode, useTypeface } from "@shopify/react-native-skia";
import type { SkPicture, SkTypeface } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { OnlineRoom } from "./src/online";
const { createGame } = require("./src/game");
const { createControls } = require("./src/controls");

const C = { night: "#0b1626", deep: "#12263d", ice: "#bfe3f2", snow: "#f3f8fb", muted: "#8fa9bd", fred: "#46a8f0", bread: "#ff8b4a", mint: "#7fe3c7", ink: "#08111c" };
const ENUMS = { BlendMode, PaintStyle, StrokeCap, StrokeJoin, TileMode, FillType, ClipOp };
const SAVE_KEY = "fyb:v1";
type Game = any;

const EMPTY = () => { const r = Skia.PictureRecorder(); r.beginRecording(Skia.XYWHRect(0, 0, 1, 1)); return r.finishRecordingAsPicture(); };

// ---------- lienzo Skia que se redibuja solo, sin pasar por React ----------
// draw(ctx, ancho, alto, segundos, dt) dibuja con la API de canvas de la web; cada cuadro se graba y se pasa a la GPU.
function Painter({ game, draw, style, fps = 60, onSize, children }: { game: Game; draw: (c: any, w: number, h: number, t: number, dt: number) => void; style?: any; fps?: number; onSize?: (w: number, h: number) => void; children?: React.ReactNode }) {
  const pic = useSharedValue<SkPicture>(EMPTY());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drawRef = useRef(draw); drawRef.current = draw;
  useEffect(() => {
    if (!size.w || !size.h) return;
    let canvas: any = null, raf = 0, last = 0, prev = 0;
    const ctx = new game.Ctx(null, () => canvas, game.fonts);
    const bounds = Skia.XYWHRect(0, 0, size.w, size.h);
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (fps < 60 && ts - last < 1000 / fps - 3) return;
      last = ts;
      const dt = prev ? Math.min(0.1, (ts - prev) / 1000) : 1 / 60; prev = ts;
      const rec = Skia.PictureRecorder();
      canvas = rec.beginRecording(bounds);
      ctx.stack = []; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.setLineDash([]);
      try { drawRef.current(ctx, size.w, size.h, ts / 1000, dt); } catch (e) { console.warn(e); }
      pic.value = rec.finishRecordingAsPicture();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, fps, game]);
  return (
    <View style={style} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setSize({ w: Math.round(width), h: Math.round(height) }); onSize && onSize(width, height); }}>
      <Canvas style={StyleSheet.absoluteFill}><Picture picture={pic} /></Canvas>
      {children}
    </View>
  );
}

// ---------- botones con el estilo de la web ----------
function Btn({ title, sub, onPress, ghost, disabled, style, small }: { title: string; sub?: string; onPress: () => void; ghost?: boolean; disabled?: boolean; style?: any; small?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [ghost ? s.ghost : s.btn, small && s.btnSmall, pressed && !disabled && (ghost ? s.ghostDown : s.btnDown), disabled && { opacity: 0.45 }, style]}>
      <Text style={[s.btnText, ghost && { color: C.ice }, small && { fontSize: 15 }]} numberOfLines={1}>{title}</Text>
      {sub ? <Text style={s.btnSub} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}
function Card({ children, wide, style }: { children: React.ReactNode; wide?: boolean; style?: any }) {
  return <View style={[s.card, wide && { maxWidth: 720 }, style]}>{children}</View>;
}
function Screen({ children }: { children: React.ReactNode }) {
  return <ScrollView style={s.screen} contentContainerStyle={s.screenIn} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
const Dot = ({ tone }: { tone: string }) => <View style={[s.dot, tone === "on" && s.dotOn, tone === "warn" && { backgroundColor: C.bread }]} />;

// ---------- pantallas ----------
function Menu({ game }: { game: Game }) {
  return (
    <Screen>
      <Card>
        <Text style={s.logo}><Text style={{ color: C.fred }}>Malu</Text><Text style={s.logoY}> y </Text><Text style={{ color: C.bread }}>Nuka</Text></Text>
        <Text style={s.tag}>Dos pingüinos, un iglú. Ninguno llega solo.</Text>
        <View style={s.row}>
          <Btn style={s.flex} title="En un celular" sub="Los dos con la misma pantalla" onPress={() => { game.setMode("local"); game.showScreen("levels"); }} />
          <Btn style={s.flex} title="En línea" sub="Cada quien en su teléfono" onPress={() => { game.setMode("online"); game.showScreen("lobby"); }} />
        </View>
        <View style={s.row}>
          <Btn style={s.flex} ghost title="Personajes" onPress={() => { game.charsBack = "menu"; game.showScreen("chars"); }} />
          <Btn style={s.flex} ghost title="Cómo jugar" onPress={() => { game.helpBack = "menu"; game.showScreen("help"); }} />
        </View>
      </Card>
    </Screen>
  );
}

function Levels({ game }: { game: Game }) {
  const info = game.mapInfo(), size = useRef({ w: 0, h: 0 });
  const pan = useMemo(() => {
    let lastDx = 0, moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { lastDx = 0; moved = false; },
      onPanResponderMove: (_, g) => { if (Math.abs(g.dx) > 6) moved = true; if (moved) { game.mapPan(g.dx - lastDx, size.current.w, size.current.h); lastDx = g.dx; } },
      onPanResponderRelease: (e) => { if (!moved) game.mapTap(e.nativeEvent.locationX, e.nativeEvent.locationY, size.current.h); },
    });
  }, [game]);
  return (
    <Screen>
      <Card wide>
        <Text style={s.h2}>{game.S.mode === "online" ? "Mapa · en línea" : "Mapa"}</Text>
        <View style={s.mapWrap} {...pan.panHandlers}>
          <Painter game={game} style={StyleSheet.absoluteFill} fps={30}
            onSize={(w, h) => { if (!size.current.w) game.openMap(w, h); size.current = { w, h }; }}
            draw={(c, w, h, t) => game.drawMap(c, w, h, t)} />
          <Pressable style={[s.mapArrow, { left: 6 }]} onPress={() => game.mapPan(300 * size.current.h / game.MAP.h, size.current.w, size.current.h)}><Text style={s.mapArrowText}>‹</Text></Pressable>
          <Pressable style={[s.mapArrow, { right: 6 }]} onPress={() => game.mapPan(-300 * size.current.h / game.MAP.h, size.current.w, size.current.h)}><Text style={s.mapArrowText}>›</Text></Pressable>
        </View>
        <View style={s.mapInfo}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.mapName} numberOfLines={1}>{info.name}</Text>
            <Text style={s.mapStats} numberOfLines={2}>{info.stats}</Text>
          </View>
          <Btn ghost title="Volver" onPress={() => { if (game.S.mode === "online") game.showScreen("lobby"); else game.showScreen("menu"); }} />
          <Btn title="Jugar" disabled={!info.open} style={{ minWidth: 120 }} onPress={() => game.pickLevel(info.index)} />
        </View>
      </Card>
    </Screen>
  );
}

function Chars({ game }: { game: Game }) {
  const cur = game.curPair().id;
  return (
    <Screen>
      <Card wide>
        <Text style={s.h2}>Personajes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {game.PAIRS.map((pr: any) => {
            const free = game.isUnlocked(pr.id), on = free && pr.id === cur;
            return (
              <Pressable key={pr.id} disabled={!free} onPress={() => game.selectPair(pr.id)} style={[s.pair, on && s.pairOn]}>
                <Painter game={game} style={s.pairArt} fps={30} draw={(c, w, h, t) => { c.setTransform(w / 60, 0, 0, w / 60, 0, 0); game.drawPairCard(c, pr.id, t, on); }} />
                <Text style={s.pairName} numberOfLines={1}>{pr.name}</Text>
                <Text style={s.pairSub} numberOfLines={2}>{!free ? `En una jaula del nivel ${game.PAIR_CAGE[pr.id] + 1}` : pr.F === pr.B ? "Los dos iguales" : "Ella y él"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={s.note}>Elijan una pareja: Malu va a la izquierda (azul) y Nuka a la derecha (naranja). Todos se juegan igual. Las parejas que faltan esperan en jaulas fuera del camino: búsquenlas y tóquenlas para liberarlas.</Text>
        <Btn title="Listo" onPress={() => game.showScreen(game.charsBack || "menu")} />
      </Card>
    </Screen>
  );
}

const HELP: [string, string][] = [
  ["Controles", "Cada uno usa su lado: Malu a la izquierda y Nuka a la derecha. Apoya el dedo en el joystick y deslízalo para moverte. El botón grande salta; Agarrar aparece en los niveles que lo usan."],
  ["La meta", "Los dos tienen que entrar al iglú. Los peces son un extra. Las banderas guardan el avance, pero solo si llegan los dos juntos."],
  ["Subirse a la cabeza", "Salta encima de tu pareja y desde ahí vuelve a saltar: alcanzas repisas de 3 bloques que ninguno alcanza solo."],
  ["Lanzar a tu pareja", "En los niveles con lanzamiento: con tu pareja parada en tu cabeza, toca Agarrar y sale volando bien alto hacia donde miras."],
  ["Cuerda: anclarse y jalar", "Mantén Agarrar con los pies en el suelo: quedas anclado y tu pareja puede colgar sin arrastrarte. Anclado, mantén también Saltar para recoger la cuerda y subirla."],
  ["Columpiarse", "Colgando de la cuerda, empuja a un lado y al otro para tomar impulso; en lo más alto del vaivén llegas a la repisa."],
  ["Pegarse a la pared", "En el aire junto a una pared, mantén Agarrar: te quedas pegado un momento. Toca Saltar para impulsarte hacia arriba y al otro lado."],
  ["Botones y puertas", "Un botón abre la puerta de su color mientras alguien lo pisa. Si tiene reloj, la deja abierta unos segundos. El botón grande necesita a los dos encima."],
  ["Balancín, cristal y palanca", "Cae desde alto sobre un lado del balancín y tu pareja sale volando del otro. El cristal morado los cambia de lugar. La palanca cambia qué bloques de color existen."],
  ["Viento, linterna y hielo", "El viento sopla hacia arriba mientras alguien pisa su botón. El hielo fantasma solo aparece cerca de la linterna de Malu. El hielo celeste resbala y el agrietado se rompe."],
  ["Bajo el agua", "Saltar es nadar hacia arriba; mantén Agarrar para bucear. La barrita es tu aire: se llena en la superficie y en las burbujas. Toca Agarrar junto a tu pareja para compartir el aire."],
  ["Peligros del mar", "Las corrientes te arrastran. No toques las medusas. Si la luz del rape te alcanza, te congela y viene a comerte: espera detrás de las rocas."],
  ["La avalancha y el reloj", "La bola gigante nunca se detiene: si se quedan atrás, los aplasta. En los niveles con reloj, lleguen al iglú antes de que llegue a cero."],
  ["Parejas en jaulas", "En algunos niveles hay una pareja encerrada fuera del camino. Tóquenla y podrán elegirla en Personajes."],
  ["Jugar en línea", "Uno toca Crear sala y le pasa el código a su pareja; el otro escribe el código y toca Unirse. Cada uno maneja su personaje desde su teléfono."],
];
function Help({ game }: { game: Game }) {
  return (
    <Screen>
      <Card wide>
        <Text style={s.h2}>Cómo jugar</Text>
        <View style={s.helpGrid}>
          {HELP.map(([t, d]) => <View key={t} style={s.helpItem}><Text style={s.h3}>{t}</Text><Text style={s.note}>{d}</Text></View>)}
        </View>
        <Btn title="Entendido" onPress={() => game.showScreen(game.helpBack || "menu")} />
      </Card>
    </Screen>
  );
}

function Lobby({ game }: { game: Game }) {
  const [code, setCode] = useState("");
  const L = game.lobbyInfo();
  return (
    <Screen>
      <Card>
        <Text style={s.h2}>Jugar en línea</Text>
        {!L.inRoom ? (
          <View style={s.row}>
            <Btn style={s.flex} title="Crear sala" sub="Te damos un código para tu pareja" onPress={() => game.createRoom()} />
            <View style={[s.flex, s.row, { flexWrap: "nowrap" }]}>
              <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))} placeholder="CÓDIGO" placeholderTextColor="#5d7487"
                autoCapitalize="characters" autoCorrect={false} maxLength={4} style={s.codeInput} onSubmitEditing={() => code.length === 4 && game.openCodeRoom(code, false)} />
              <Btn ghost title="Unirse" disabled={code.length !== 4} onPress={() => game.openCodeRoom(code, false)} />
            </View>
          </View>
        ) : (
          <View style={[s.row, { alignItems: "center" }]}>
            <Text style={s.salaCode}>Sala <Text style={s.salaCodeB}>{L.code || "····"}</Text></Text>
            <Btn ghost title="Compartir" onPress={() => Share.share({ message: `Únete a mi sala de Malu y Nuka. Código: ${L.code}` }).catch(() => {})} />
            <Btn ghost title="Salir" onPress={() => game.leaveRoom()} />
          </View>
        )}
        {L.inRoom ? (
          <View style={s.row}>
            {(["F", "B"] as const).map((r) => (
              <Pressable key={r} onPress={() => game.pickRole(r)} style={[s.pick, L.me === r && (r === "F" ? s.pickF : s.pickB)]}>
                <Painter game={game} style={{ width: 56, height: 56 }} fps={20} draw={(c, w, h, t) => { c.setTransform(w / 30, 0, 0, w / 30, 0, 0); game.drawRole(c, r, t); }} />
                <Text style={s.pickText}>{game.P_NAME[r]}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={s.status}><Dot tone={L.tone} /><Text style={s.statusText}>{L.text}</Text></View>
        <View style={s.row}>
          <Btn style={s.flex} ghost title="Volver" onPress={() => { game.leaveRoom(); game.setMode(null); game.showScreen("menu"); }} />
          <Btn style={s.flex} ghost title="Personajes" onPress={() => { game.charsBack = "lobby"; game.showScreen("chars"); }} />
          <Btn style={s.flex} title="Elegir nivel" disabled={!L.ready} onPress={() => game.showScreen("levels")} />
        </View>
      </Card>
    </Screen>
  );
}

function Pause({ game }: { game: Game }) {
  return (
    <Screen>
      <Card>
        <Text style={s.h2}>Pausa</Text>
        <View style={s.row}>
          <Btn style={s.flex} title="Seguir" onPress={() => game.showScreen("play")} />
          <Btn style={s.flex} ghost title="Reiniciar nivel" onPress={() => { game.requestRestart(); game.showScreen("play"); }} />
        </View>
        <View style={s.row}>
          <Btn style={s.flex} ghost title="Niveles" onPress={() => game.showScreen("levels")} />
          <Btn style={s.flex} ghost title="Cómo jugar" onPress={() => { game.helpBack = "pause"; game.showScreen("help"); }} />
          <Btn style={s.flex} ghost title="Menú" onPress={() => { game.sendPresenceMenu(); game.leaveRoom(); game.setMode(null); game.showScreen("menu"); }} />
        </View>
      </Card>
    </Screen>
  );
}

function Win({ game }: { game: Game }) {
  const r = game.S.result || { title: "", text: "", next: false };
  return (
    <Screen>
      <Card style={{ alignItems: "stretch" }}>
        <Text style={[s.h2, { textAlign: "center" }]}>{r.title}</Text>
        <Text style={s.tag}>{r.text}</Text>
        <View style={s.row}>
          <Btn style={s.flex} ghost title="Niveles" onPress={() => game.showScreen("levels")} />
          {r.next ? <Btn style={s.flex} title="Siguiente nivel" onPress={() => game.pickLevel(Math.min(game.LEVELS.length - 1, game.S.lvl + 1))} /> : null}
        </View>
      </Card>
    </Screen>
  );
}

function Hud({ game }: { game: Game }) {
  const S = game.S, L = S.mode === "online" ? game.lobbyInfo() : null;
  return (
    <View style={s.hud} pointerEvents="box-none">
      <Pressable style={s.hudBtn} onPress={() => game.showScreen("pause")} hitSlop={8}>
        <View style={s.pauseBar} /><View style={s.pauseBar} />
      </Pressable>
      <Text style={s.hudPill} numberOfLines={1}>{S.lvl + 1}. {game.LEVELS[S.lvl].name}</Text>
      <View style={{ flex: 1 }} />
      {L ? <View style={[s.hudPill, s.rowC]}><Dot tone={L.net} /><Text style={s.netText}>{L.netText}</Text></View> : null}
      {S.hud.time ? <Text style={[s.hudPill, S.hud.low && { backgroundColor: "rgba(229,72,77,.85)" }]}>{S.hud.time}</Text> : null}
      <Text style={s.hudPill}>🐟 {S.hud.fish}</Text>
    </View>
  );
}

// ---------- la app ----------
export default function App() {
  const [fontsReady] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, Nunito_600SemiBold, Nunito_800ExtraBold });
  const tf600 = useTypeface(Fredoka_600SemiBold), tf700 = useTypeface(Fredoka_700Bold);
  const [saved, setSaved] = useState<any>(undefined);
  useEffect(() => { AsyncStorage.getItem(SAVE_KEY).then((v) => { try { setSaved(v ? JSON.parse(v) : {}); } catch { setSaved({}); } }, () => setSaved({})); }, []);
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    NavigationBar.setVisibilityAsync("hidden").catch(() => {});
  }, []);
  const ready = fontsReady && tf600 && tf700 && saved !== undefined;
  const game = useMemo(() => (ready ? makeGame(tf600 as SkTypeface, tf700 as SkTypeface, saved) : null), [ready]);
  if (!game) return <View style={{ flex: 1, backgroundColor: C.night }}><StatusBar hidden /></View>;
  return <Main game={game} />;
}

function makeGame(tf600: SkTypeface, tf700: SkTypeface, saved: any) {
  const cache = new Map<string, any>();
  const fonts = (fam: string, weight: number, size: number) => {
    const k = (weight >= 700 ? 7 : 6) + ":" + size;
    let f = cache.get(k);
    if (!f) { f = Skia.Font(weight >= 700 ? tf700 : tf600, size); f.setSubpixel(true); f.setLinearMetrics(true); cache.set(k, f); }
    return f;
  };
  const game = createGame({
    Skia, enums: ENUMS, fonts, saved, pixelRatio: PixelRatio.get(),
    save: (json: string) => { AsyncStorage.setItem(SAVE_KEY, json).catch(() => {}); },
    makeRoom: (code: string, host: boolean) => new OnlineRoom(code, host),
    vibrate: (ms: number) => Vibration.vibrate(ms),
  });
  game.fonts = fonts;
  return game;
}

function Main({ game }: { game: Game }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => game.subscribe(rerender), [game]);
  const { width, height } = useWindowDimensions();
  const controls = useMemo(() => createControls(game), [game]);
  const S = game.S, screen = S.screen, playing = screen === "play";
  const ins = { l: 0, r: 0, b: 0 };
  const stripH = playing ? controls.layout(width, height, ins) : 0;
  // con los controles a la vista el nivel se acomoda arriba; en los menús se centra
  useEffect(() => { game.resize(width, height, ins, stripH); }, [width, height, stripH, game]);
  useEffect(() => {
    if (playing) activateKeepAwakeAsync("juego").catch(() => {}); else { deactivateKeepAwake("juego"); controls.reset(); }
  }, [playing]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "play") { game.showScreen("pause"); return true; }
      if (screen === "pause") { game.showScreen("play"); return true; }
      if (screen === "help") { game.showScreen(game.helpBack || "menu"); return true; }
      if (screen === "chars") { game.showScreen(game.charsBack || "menu"); return true; }
      if (screen === "levels" || screen === "win") { game.showScreen(S.mode === "online" ? "lobby" : "menu"); return true; }
      if (screen === "lobby") { game.leaveRoom(); game.setMode(null); game.showScreen("menu"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, game]);
  const draw = useCallback((c: any, w: number, h: number, t: number, dt: number) => {
    game.frame(dt, t);
    game.render(c, t);
    if (game.S.screen === "play") controls.draw(c);
  }, [game, controls]);
  const touches = (fn: (id: number, x: number, y: number) => void) => (e: any) => {
    for (const t of e.nativeEvent.changedTouches) fn(t.identifier, t.pageX, t.pageY);
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <StatusBar hidden />
      <Painter game={game} style={StyleSheet.absoluteFill} draw={draw} />
      {playing || screen === "pause" || screen === "win" ? <Hud game={game} /> : null}
      {playing ? (
        <View style={[s.controls, { height: stripH }]}
          onTouchStart={touches(controls.down)} onTouchMove={touches(controls.move)}
          onTouchEnd={touches((id) => controls.up(id))} onTouchCancel={touches((id) => controls.up(id))} />
      ) : null}
      {screen === "menu" ? <Menu game={game} /> : null}
      {screen === "levels" ? <Levels game={game} /> : null}
      {screen === "chars" ? <Chars game={game} /> : null}
      {screen === "help" ? <Help game={game} /> : null}
      {screen === "lobby" ? <Lobby game={game} /> : null}
      {screen === "pause" ? <Pause game={game} /> : null}
      {screen === "win" ? <Win game={game} /> : null}
      {S.toast ? <View style={s.toastWrap} pointerEvents="none"><Text style={s.toast}>{S.toast}</Text></View> : null}
      {game.lobbyInfo().follow ? (
        <View style={s.follow}>
          <Text style={s.followText}>{game.lobbyInfo().follow}</Text>
          <Btn small title="Entrar" onPress={() => game.followPartner()} />
        </View>
      ) : null}
    </View>
  );
}

const display = "Fredoka_600SemiBold", body = "Nunito_600SemiBold";
const s = StyleSheet.create({
  screen: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,17,28,.58)" },
  screenIn: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 24 },
  card: { width: "100%", maxWidth: 560, backgroundColor: "rgba(18,38,61,.92)", borderWidth: 2, borderColor: "rgba(191,227,242,.16)", borderRadius: 20, padding: 16, gap: 12 },
  logo: { fontFamily: "Fredoka_700Bold", fontSize: 50, textAlign: "center", textShadowColor: "rgba(0,0,0,.35)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  logoY: { color: C.ice, fontSize: 28 },
  tag: { fontFamily: body, color: C.muted, fontSize: 15, textAlign: "center", lineHeight: 20 },
  h2: { fontFamily: display, fontSize: 24, color: C.snow },
  h3: { fontFamily: display, fontSize: 15, color: C.ice, marginBottom: 2 },
  note: { fontFamily: body, color: C.muted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  rowC: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flexGrow: 1, flexBasis: 150 },
  btn: { backgroundColor: C.snow, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", justifyContent: "center",
    borderBottomWidth: 4, borderBottomColor: "#86a9bc" },
  btnDown: { transform: [{ translateY: 3 }], borderBottomWidth: 1 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  ghost: { borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(191,227,242,.3)" },
  ghostDown: { backgroundColor: "rgba(191,227,242,.1)" },
  btnText: { fontFamily: display, fontSize: 18, color: C.ink },
  btnSub: { fontFamily: body, fontSize: 12.5, color: "#3d5568", marginTop: 1 },
  mapWrap: { height: 200, borderRadius: 16, overflow: "hidden", backgroundColor: "#0e2034" },
  mapArrow: { position: "absolute", top: "50%", marginTop: -23, width: 34, height: 46, borderRadius: 12, backgroundColor: "rgba(8,17,28,.55)", alignItems: "center", justifyContent: "center" },
  mapArrowText: { fontFamily: display, fontSize: 28, color: C.snow, lineHeight: 32 },
  mapInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  mapName: { fontFamily: display, fontSize: 18, color: C.snow },
  mapStats: { fontFamily: body, fontSize: 13, color: C.muted },
  pair: { width: 132, borderRadius: 14, padding: 6, paddingBottom: 8, backgroundColor: "#1b3654", alignItems: "center", gap: 2, borderWidth: 2, borderColor: "rgba(191,227,242,.12)" },
  pairOn: { borderColor: C.mint, borderWidth: 3, backgroundColor: "#173a5c" },
  pairArt: { width: 120, height: 60 },
  pairName: { fontFamily: display, fontSize: 14, color: C.snow },
  pairSub: { fontFamily: body, fontSize: 11, color: C.muted, textAlign: "center" },
  helpGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  helpItem: { flexGrow: 1, flexBasis: 260, backgroundColor: "rgba(8,17,28,.3)", borderRadius: 14, padding: 10 },
  codeInput: { flex: 1, minWidth: 90, fontFamily: display, fontSize: 22, letterSpacing: 4, color: C.snow, backgroundColor: "rgba(8,17,28,.5)", borderRadius: 14,
    borderWidth: 2, borderColor: "rgba(191,227,242,.3)", paddingHorizontal: 12, paddingVertical: 6, textAlign: "center" },
  salaCode: { flex: 1, fontFamily: display, fontSize: 16, color: C.muted },
  salaCodeB: { fontFamily: "Fredoka_700Bold", fontSize: 30, color: C.snow, letterSpacing: 4 },
  pick: { flexGrow: 1, flexBasis: 120, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, padding: 6, backgroundColor: "#1b3654", borderWidth: 2, borderColor: "rgba(191,227,242,.12)" },
  pickF: { borderColor: C.fred, borderWidth: 3, backgroundColor: "#173a5c" },
  pickB: { borderColor: C.bread, borderWidth: 3, backgroundColor: "#3a2a24" },
  pickText: { fontFamily: display, fontSize: 17, color: C.snow },
  status: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  statusText: { flex: 1, fontFamily: body, fontSize: 14.5, color: C.ice },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.muted },
  dotOn: { backgroundColor: C.mint },
  hud: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, paddingHorizontal: 10 },
  hudBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(8,17,28,.55)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  pauseBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: C.snow },
  hudPill: { fontFamily: display, fontSize: 15, color: C.snow, backgroundColor: "rgba(8,17,28,.55)", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, overflow: "hidden", maxWidth: 260 },
  netText: { fontFamily: body, fontSize: 13, color: C.snow },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0 },
  toastWrap: { position: "absolute", top: 56, left: 16, right: 16, alignItems: "center" },
  toast: { fontFamily: display, fontSize: 16, color: C.ink, backgroundColor: C.snow, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, overflow: "hidden", textAlign: "center" },
  follow: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(18,38,61,.96)", borderRadius: 16, padding: 8, paddingLeft: 14, borderWidth: 2, borderColor: "rgba(127,227,199,.4)" },
  followText: { fontFamily: body, fontSize: 14, color: C.ice },
});
