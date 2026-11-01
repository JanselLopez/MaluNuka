import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Line, Path, Polygon, Rect, Stop } from "react-native-svg";
import levels from "./src/levels.json";
import { newRoomCode, OnlineRoom } from "./src/online";
const Engine = require("./src/game-engine");

type PenguinId = "F" | "B";
type Input = { l: boolean; r: boolean; j: boolean; jp: boolean; g: boolean; gp: boolean };
type Level = Record<string, any>;
type Route = "home" | "levels" | "game" | "online";
const C = { bg: "#0b1626", panel: "#12263d", tile: "#1b3654", ice: "#bfe3f2", snow: "#f3f8fb", muted: "#8fa9bd", blue: "#46a8f0", orange: "#ff8b4a", mint: "#7fe3c7" };
const COLORS: Record<string, string> = { F: C.blue, B: C.orange };
const LEVELS = levels as Level[];

function Penguin({ p, yOffset, scale }: { p: any; yOffset: number; scale: number }) {
  const bob = p.onGround ? Math.sin(p.anim * 12) * 0.6 : 0;
  const x = p.x * scale, y = (p.y - yOffset + bob) * scale;
  return <G transform={`translate(${x} ${y}) scale(${scale})`}>
    <Ellipse cx="7" cy="10" rx="7" ry="9" fill={COLORS[p.id]} />
    <Ellipse cx="7.5" cy="12" rx="4.1" ry="5.5" fill="#f3f8fb" />
    <Circle cx={p.face > 0 ? 10 : 4} cy="7" r="1.15" fill="#08111c" />
    <Polygon points={p.face > 0 ? "12,8 17,9.5 12,11" : "2,8 -3,9.5 2,11"} fill="#ffd166" />
    <Ellipse cx="3" cy="17" rx="3" ry="1.2" fill="#ffcf55" />
    <Ellipse cx="11" cy="17" rx="3" ry="1.2" fill="#ffcf55" />
  </G>;
}

function GameScene({ level, players, cameraY, screenWidth, screenHeight, time }: { level: any; players: any[]; cameraY: number; screenWidth: number; screenHeight: number; time: number }) {
  const L = level, W = Engine.W, H = Engine.H, T = Engine.T;
  const scale = Math.min(screenWidth / W, screenHeight / 360);
  const originX = (screenWidth - W * scale) / 2, originY = (screenHeight - 360 * scale) / 2;
  const maxCam = Math.max(0, L.H - H), camY = Math.max(0, Math.min(maxCam, cameraY));
  const nodes: React.ReactNode[] = [
    <Defs key="defs"><LinearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor={L.def.world >= 6 ? "#0c3c50" : "#061022"} /><Stop offset="100%" stopColor={L.def.world >= 6 ? "#0b2637" : "#1a3a58"} /></LinearGradient></Defs>,
    <Rect key="bg" x="0" y="0" width={W} height={360} fill="url(#sky)" />,
  ];
  for (let y = Math.floor(camY / T); y < Math.min(L.R, Math.ceil((camY + 360) / T)); y++) {
    let run = -1;
    for (let x = 0; x <= L.C; x++) {
      if (x < L.C && L.wet[y][x]) { if (run < 0) run = x; continue; }
      if (run >= 0) { nodes.push(<Rect key={`water-${run}-${y}`} x={run * T} y={y * T - camY} width={(x - run) * T} height={T} fill="#31a8d0" opacity="0.24" />); run = -1; }
    }
  }
  for (let y = Math.floor(camY / T); y < Math.min(L.R, Math.ceil((camY + 360) / T)); y++) for (let x = 0; x < L.C; x++) {
    const ch = L.cell[y][x]; if (!ch) continue;
    const px = x * T, py = y * T;
    if (ch === "#" || ch === "-" || ch === "=" || ch === "S" || ch === "%" || ch === "f" || ch === "g" || ch.startsWith("d")) {
      const fill = ch === "-" ? "#8fd3ef" : ch === "f" ? "#2f89cf" : ch === "g" ? "#e8773b" : ch.startsWith("d") ? "#59728a" : ch === "%" ? "#517895" : ch === "S" ? "#a97a58" : ch === "=" ? "#96d3e8" : "#22476b";
      nodes.push(<Rect key={`tile-${x}-${y}`} x={px} y={py - camY} width={T} height={T} rx={ch === "S" ? 3 : 1} fill={fill} />);
      nodes.push(<Rect key={`shine-${x}-${y}`} x={px + 1} y={py - camY + 1} width={T - 2} height={2} fill="rgba(220,245,255,0.32)" />);
    } else if (ch === "h" || ch === "u" || ch === "U") {
      const solid = ch === "h" ? L.light && Math.hypot(px + T / 2 - L.light.x, py + T / 2 - L.light.y) <= Engine.PHYS.lightR : L.toggle === (ch === "u" ? 0 : 1);
      if (solid) nodes.push(<Rect key={`special-${x}-${y}`} x={px} y={py - camY} width={T} height={T} fill={ch === "h" ? "#b8f0ff" : ch === "u" ? "#ff7eb6" : "#8be37a"} opacity="0.76" />);
    }
  }
  for (const f of L.fish) if (!f.got) nodes.push(<G key={`fish-${f.x}-${f.y}`}><Ellipse cx={f.x} cy={f.y - camY} rx="6" ry="4" fill="#ffd166" /><Polygon points={`${f.x - 5},${f.y - camY} ${f.x - 10},${f.y - camY - 4} ${f.x - 10},${f.y - camY + 4}`} fill="#ffad4e" /><Circle cx={f.x + 3} cy={f.y - camY - 1} r="0.8" fill="#402d38" /></G>);
  for (const s of L.spikes) nodes.push(<Polygon key={`spike-${s.cx}-${s.cy}`} points={`${s.x},${s.y - camY + s.h} ${s.x + s.w / 2},${s.y - camY} ${s.x + s.w},${s.y - camY + s.h}`} fill="#f2f3f5" />);
  for (const b of L.buttons) nodes.push(<Rect key={`button-${b.id}-${b.x}`} x={b.x} y={b.y - camY - (b.down ? 2 : 0)} width={b.w} height={5} rx="2" fill={b.down ? C.mint : "#ffd166"} />);
  for (const d of L.doors) if (L.door[d.id] < 0.85) nodes.push(<Rect key={`door-${d.id}-${d.x}-${d.y}`} x={d.x} y={d.y - camY} width={d.w} height={d.h} fill="#667f9a" opacity="0.9" />);
  for (const l of L.lifts) nodes.push(<Rect key={`lift-${l.id}`} x={l.x} y={l.y - camY} width={l.w} height={l.h} rx="4" fill="#7797ad" />);
  for (const lv of L.levers) nodes.push(<G key={`lever-${lv.cx}-${lv.cy}`}><Rect x={lv.x} y={lv.y - camY} width={lv.w} height={lv.h} rx="3" fill="#54c7a8" /><Line x1={lv.x + 3} y1={lv.y - camY + 5} x2={lv.x + lv.w - 3} y2={lv.y - camY + 1} stroke="#e7fff7" strokeWidth="2" /></G>);
  for (const cr of L.crystals) nodes.push(<Polygon key={`crystal-${cr.cx}-${cr.cy}`} points={`${cr.x + cr.w / 2},${cr.y - camY} ${cr.x + cr.w},${cr.y - camY + cr.h / 2} ${cr.x + cr.w / 2},${cr.y - camY + cr.h} ${cr.x},${cr.y - camY + cr.h / 2}`} fill="#b892ff" />);
  for (const v of L.vents) nodes.push(<G key={`vent-${v.cx}-${v.cy}`}><Circle cx={v.cx * T + 10} cy={v.cy * T - camY + 8} r="4" fill="#a8f0ff" opacity="0.8" /><Circle cx={v.cx * T + 10} cy={v.cy * T - camY} r="2" fill="#d8f8ff" opacity="0.72" /></G>);
  for (const ic of L.icicles) if (ic.s !== "gone") nodes.push(<Polygon key={`icicle-${ic.cx}`} points={`${ic.x + 5},${ic.y - camY} ${ic.x + 15},${ic.y - camY} ${ic.x + 10},${ic.y - camY + 18}`} fill="#cceaf5" />);
  for (const s of L.seesaws) nodes.push(<G key={`seesaw-${s.x0}-${s.y}`} transform={`rotate(${s.tilt * 4} ${s.mid} ${s.y * T - camY})`}><Rect x={s.x0 * T} y={s.y * T - camY} width={(s.x1 - s.x0 + 1) * T} height={T} rx="4" fill="#b77c52" /><Circle cx={s.mid} cy={s.y * T - camY + T} r="4" fill="#e8c498" /></G>);
  for (const cp of L.checkpoints) nodes.push(<G key={`cp-${cp.i}`}><Line x1={cp.x} y1={cp.y - camY} x2={cp.x} y2={cp.y - camY - 20} stroke={cp.i <= L.cp ? C.mint : C.ice} strokeWidth="2" /><Polygon points={`${cp.x},${cp.y - camY - 20} ${cp.x + 14},${cp.y - camY - 16} ${cp.x},${cp.y - camY - 11}`} fill={cp.i <= L.cp ? C.mint : C.ice} /></G>);
  if (L.exit) nodes.push(<G key="exit"><Path d={`M${L.exit.x} ${L.exit.y - camY + 40} Q${L.exit.x} ${L.exit.y - camY + 2} ${L.exit.x + 20} ${L.exit.y - camY + 2} Q${L.exit.x + 40} ${L.exit.y - camY + 2} ${L.exit.x + 40} ${L.exit.y - camY + 40} Z`} fill="#e5f2f7" /><Rect x={L.exit.x - 2} y={L.exit.y - camY + 38} width="44" height="4" rx="2" fill="#90c9df" /></G>);
  if (L.cage && !L.cage.open) nodes.push(<G key="cage"><Rect x={L.cage.x} y={L.cage.y - camY} width={L.cage.w} height={L.cage.h} fill="none" stroke="#9ec9dc" strokeWidth="2" /><Line x1={L.cage.x + 7} y1={L.cage.y - camY} x2={L.cage.x + 7} y2={L.cage.y - camY + L.cage.h} stroke="#9ec9dc" /><Line x1={L.cage.x + 27} y1={L.cage.y - camY} x2={L.cage.x + 27} y2={L.cage.y - camY + L.cage.h} stroke="#9ec9dc" /></G>);
  if (L.key && !L.key.holder) nodes.push(<Circle key="key" cx={L.key.x} cy={L.key.y - camY} r="5" fill="#ffd166" />);
  if (L.ball?.active) nodes.push(<Circle key="ball" cx={L.ball.x} cy={L.ball.y - camY} r={L.ball.r} fill="#f4f6fa" stroke="#bfd7e5" strokeWidth="3" />);
  if (L.flood) nodes.push(<Rect key="flood" x={L.flood.x0 * T} y={L.flood.surf - camY} width={(L.flood.x1 - L.flood.x0 + 1) * T} height={Math.max(0, L.H - L.flood.surf)} fill="#61c9e8" opacity="0.43" />);
  for (const s of L.sentries) nodes.push(<G key={`sentry-${s.i}`}><Circle cx={s.x} cy={s.y - camY} r="7" fill="#f7c776" /><Path d={`M${s.x} ${s.y - camY} L${s.x + Math.cos(s.ang) * 60} ${s.y - camY + Math.sin(s.ang) * 60}`} stroke="#ffed9e" strokeWidth="1" opacity="0.42" /></G>);
  for (const j of L.jellies) nodes.push(<Circle key={`jelly-${j.x}`} cx={j.x} cy={j.y - camY} r="7" fill="#d59dff" opacity="0.86" />);
  if (L.rope && players.length === 2 && players.every((p) => !p.remote || p.visible)) nodes.push(<Line key="rope" x1={players[0].x + 7} y1={players[0].y - camY + 9} x2={players[1].x + 7} y2={players[1].y - camY + 9} stroke={C.ice} strokeWidth="1.3" opacity="0.7" />);
  for (const p of players) if (!p.dead && (!p.remote || p.visible)) nodes.push(<Penguin key={`peng-${p.id}`} p={p} yOffset={camY} scale={1} />);
  return <View style={styles.scene}><Svg width={W * scale} height={360 * scale} viewBox={`0 0 ${W} 360`} style={{ position: "absolute", left: originX, top: originY }}>{nodes}</Svg>
    <View pointerEvents="none" style={styles.hud}><Text numberOfLines={1} style={styles.hudTitle}>{L.index + 1}. {L.def.name}</Text><Text style={styles.hudFish}>🐟 {L.fish.filter((f: any) => f.got).length}/{L.fish.length}</Text><Text style={styles.hudTime}>{Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, "0")}</Text></View>
  </View>;
}

function ControlButton({ label, color, onDown, onUp, wide = false, name }: { label: string; color: string; onDown: () => void; onUp: () => void; wide?: boolean; name: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={name} onPressIn={onDown} onPressOut={onUp} style={({ pressed }) => [styles.control, { borderColor: `${color}95`, backgroundColor: pressed ? color : "rgba(243,248,251,0.11)", width: wide ? 74 : 56, height: wide ? 66 : 56 }, pressed && styles.pressed]}><Text style={[styles.controlText, { color: "#f3f8fb" }]}>{label}</Text></Pressable>;
}

export default function App() {
  const [route, setRoute] = useState<Route>("home");
  const [levelIndex, setLevelIndex] = useState(0);
  const [level, setLevel] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [, setRenderFrame] = useState(0);
  const [gameRunId, setGameRunId] = useState(0);
  const [clock, setClock] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<"won" | "fell" | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomStatus, setRoomStatus] = useState("Crea una sala o únete con un código.");
  const [roomConnected, setRoomConnected] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [roomHost, setRoomHost] = useState(false);
  const [selectedOnlineLevel, setSelectedOnlineLevel] = useState(0);
  const roomRef = useRef<OnlineRoom | null>(null);
  const pkRef = useRef(Date.now());
  const inputs = useRef<Record<PenguinId, Input>>({ F: { l: false, r: false, j: false, jp: false, g: false, gp: false }, B: { l: false, r: false, j: false, jp: false, g: false, gp: false } });
  const state = useRef({ L: null as any, players: [] as any[], time: 0, exits: 0, stopped: false, paused: false, net: { tgLocal: 0, tgRemote: 0, th: 0, ld: 0, imp: 0, sw: 0, swx: 0, swy: 0 }, online: false, role: "F" as PenguinId, run: 0, round: 0, onlineLevel: -1, remotePresence: null as any, seenTh: 0, seenLd: 0, seenSw: 0 });
  const lastFrame = useRef(0);
  const lastRender = useRef(0);
  const dims = useWindowDimensions();
  const gameWidth = Math.max(dims.width, dims.height);
  const gameHeight = Math.min(dims.width, dims.height);

  const startLevel = useCallback((i: number) => {
    const L = Engine.parseLevel(LEVELS[i], i);
    const ps = [Engine.newPenguin("F", L.starts.F), Engine.newPenguin("B", L.starts.B)];
    state.current = { L, players: ps, time: 0, exits: 0, stopped: false, paused: false, net: { tgLocal: 0, tgRemote: 0, th: 0, ld: 0, imp: 0, sw: 0, swx: 0, swy: 0 }, online: false, role: "F", run: 0, round: 0, onlineLevel: -1, remotePresence: null, seenTh: 0, seenLd: 0, seenSw: 0 };
    inputs.current = { F: { l: false, r: false, j: false, jp: false, g: false, gp: false }, B: { l: false, r: false, j: false, jp: false, g: false, gp: false } };
    setLevelIndex(i); setLevel(L); setPlayers(ps); setClock(0); setPaused(false); setResult(null); setGameRunId((n) => n + 1); setRoute("game");
  }, []);

  const startOnlineLevel = useCallback((i: number, incoming?: any) => {
    const L = Engine.parseLevel(LEVELS[i], i);
    const localRole: PenguinId = incoming ? (incoming.localRole || (incoming.r === "F" ? "B" : "F")) : state.current.role;
    const ps = [Engine.newPenguin("F", L.starts.F), Engine.newPenguin("B", L.starts.B)];
    const remoteRole: PenguinId = localRole === "F" ? "B" : "F";
    const remote = ps.find((p: any) => p.id === remoteRole);
    if (remote) remote.remote = true;
    pkRef.current = incoming?.pk || Date.now();
    if (incoming?.fm != null) L.fish.forEach((f: any, n: number) => { f.got = !!(incoming.fm & (1 << n)); });
    if (typeof incoming?.cp === "number" && incoming.cp >= 0) {
      const checkpoint = L.checkpoints.find((item: any) => item.i === incoming.cp);
      if (checkpoint) {
        L.cp = incoming.cp;
        const placed: number[] = [];
        for (const p of ps) {
          const offsets = p.id === "F" ? [-9, 9, 0, -18, 18] : [9, -9, 0, 18, -18];
          const x = checkpoint.x - Engine.PW / 2 + (offsets.find((offset: number) => placed.every((px) => Math.abs(checkpoint.x - Engine.PW / 2 + offset - px) >= 14)) ?? 0);
          p.x = x; p.y = checkpoint.y - Engine.PH; p.prevX = x; p.prevY = p.y; placed.push(x);
        }
      }
    }
    if (L.key && incoming?.ky) L.key.holder = incoming.r;
    if (incoming?.rc && L.cage) L.cage.open = true;
    state.current = { L, players: ps, time: 0, exits: 0, stopped: false, paused: false, net: { tgLocal: 0, tgRemote: 0, th: 0, ld: 0, imp: 0, sw: 0, swx: 0, swy: 0 }, online: true, role: localRole, run: pkRef.current, round: incoming?.rs || 0, onlineLevel: i, remotePresence: incoming || null, seenTh: 0, seenLd: 0, seenSw: 0 };
    inputs.current = { F: { l: false, r: false, j: false, jp: false, g: false, gp: false }, B: { l: false, r: false, j: false, jp: false, g: false, gp: false } };
    setLevelIndex(i); setLevel(L); setPlayers(ps); setClock(0); setPaused(false); setResult(null); setGameRunId((n) => n + 1); setRoute("game");
    return localRole;
  }, [roomHost]);

  const connectRoom = useCallback((host: boolean, requestedCode?: string) => {
    roomRef.current?.close();
    const code = (requestedCode || newRoomCode()).toUpperCase();
    const room = new OnlineRoom(code, host);
    roomRef.current = room;
    state.current.role = host ? "F" : "B";
    state.current.run = pkRef.current;
    setRoomCode(code); setRoomHost(host); setPartner(null); setRoomConnected(false);
    setRoomStatus(host ? "Creando sala…" : "Buscando sala…"); setRoute("online");
    room.start(
      () => { setRoomConnected(true); setRoomStatus(host ? "Sala lista. Comparte el código con tu pareja." : "Conectado. Esperando a tu pareja…"); room.presence({ v: 1, r: state.current.role, sc: "lobby", pk: state.current.run, lv: -1, rs: 0, x: null, y: null }); },
      () => {
        if (roomRef.current !== room) return;
        const p = room.peers()[0] || null;
        if (!state.current.online) setPartner(p);
        state.current.remotePresence = p;
        if (p?.r && p.r === state.current.role && !state.current.online) { state.current.role = p.r === "F" ? "B" : "F"; room.presence({ v: 1, r: state.current.role, sc: "lobby", pk: state.current.run, lv: -1, rs: 0, x: null, y: null }); }
        if (p?.sc === "play" && Number.isInteger(p.lv) && p.lv >= 0 && p.lv < LEVELS.length) {
          const s = state.current;
          if (!s.online || s.run !== p.pk || !s.L || s.onlineLevel !== p.lv || (typeof p.rs === "number" && p.rs > s.round)) startOnlineLevel(p.lv, { ...p, localRole: p.r === "F" ? "B" : "F" });
        } else if (p) setRoomStatus("Tu pareja está conectada. Espera a que inicie el nivel.");
        else if (roomConnected) setRoomStatus(room.lost ? "Conexión interrumpida. Reconectando…" : host ? "Sala lista. Comparte el código con tu pareja." : "Esperando a tu pareja…");
      },
      (error) => { setRoomConnected(false); setRoomStatus(error === "unavailable-id" ? "Ese código ya está ocupado. Crea otra sala." : error === "peer-unavailable" ? "No encontramos esa sala. Revisa el código." : "No se pudo conectar. Revisa tu internet e inténtalo otra vez."); },
    );
  }, [roomConnected, startOnlineLevel]);

  const sendOnlinePresence = useCallback(() => {
    const room = roomRef.current, s = state.current;
    if (!room) return;
    const p = s.players.find((item) => item.id === s.role);
    const play = s.online && !!s.L;
    const out: any = { v: 1, r: s.role, sc: play ? "play" : "lobby", pk: s.run || pkRef.current, lv: play ? levelIndex : -1, rs: s.round || 0 };
    if (play && p) Object.assign(out, {
      x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.face,
      og: p.onGround ? 1 : 0, w: p.wet ? 1 : 0, d: p.dead ? 1 : 0, ex: p.inExit ? 1 : 0,
      an: p.anchor ? 1 : 0, rl: p.reel ? 1 : 0, cl: p.cling || 0, st: p.stamina ?? null,
      ky: s.L.key?.holder === s.role ? 1 : 0, cp: s.L.cp, rc: s.L.cage?.open ? 1 : 0,
      th: s.net.th || 0, ld: s.net.ld || 0, imp: s.net.imp || 0,
      sw: s.net.sw || 0, swx: s.net.swx, swy: s.net.swy, tg: s.net.tgLocal || 0,
      fm: s.L.fish.reduce((m: number, f: any, i: number) => (f.got ? m | (1 << i) : m), 0),
    });
    else Object.assign(out, { x: null, y: null });
    room.presence(out);
  }, [levelIndex]);

  const restartLevel = useCallback(() => {
    const old = state.current.L, checkpoint = old?.cp ?? -1;
    const fish = old?.fish.map((f: any) => f.got) ?? [];
    const holder = old?.key?.holder ?? null;
    startLevel(levelIndex);
    if (checkpoint < 0) return;
    const L = state.current.L, ps = state.current.players;
    const c = L.checkpoints.find((item: any) => item.i === checkpoint);
    if (!c) return;
    L.cp = checkpoint;
    L.fish.forEach((f: any, i: number) => { f.got = !!fish[i]; });
    if (L.key && holder) L.key.holder = holder;
    const placed: number[] = [];
    for (const p of ps) {
      const offsets = p.id === "F" ? [-9, 9, 0, -18, 18, -27, 27, -36, 36] : [9, -9, 0, 18, -18, 27, -27, 36, -36];
      const x = c.x - Engine.PW / 2 + (offsets.find((offset: number) => placed.every((px) => Math.abs(c.x - Engine.PW / 2 + offset - px) >= 14)) ?? 0);
      p.x = x; p.y = c.y - Engine.PH; p.prevX = x; p.prevY = p.y; placed.push(x);
    }
    if (L.ball) { L.ball.x = c.x - 300; L.ball.y = c.y - L.ball.r; L.ball.t = L.ball.delay - 1.5; }
    setPlayers([...ps]); setLevel({ ...L });
  }, [levelIndex, startLevel]);

  useEffect(() => {
    ScreenOrientation.lockAsync(route === "game" ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
  }, [route]);

  useEffect(() => {
    if (route !== "online" || !roomConnected) return;
    sendOnlinePresence();
    const timer = setInterval(sendOnlinePresence, 500);
    return () => clearInterval(timer);
  }, [route, roomConnected, sendOnlinePresence]);

  useEffect(() => {
    if (route !== "game") return;
    state.current.stopped = false;
    let frame = 0;
    const tick = (now: number) => {
      if (state.current.stopped) return;
      frame = requestAnimationFrame(tick);
      if (state.current.paused) { if (now - lastRender.current >= 33) { lastRender.current = now; setRenderFrame((n) => n + 1); } return; }
      if (!lastFrame.current) lastFrame.current = now;
      const dt = Math.min(0.033, (now - lastFrame.current) / 1000);
      lastFrame.current = now;
      if (dt <= 0) return;
      const { L, players: ps } = state.current;
      if (!L) return;
      const online = state.current.online;
      const local = online ? ps.find((p) => p.id === state.current.role) : null;
      const remote = online ? ps.find((p) => p.id !== state.current.role) : null;
      if (online && remote) {
        const pr = state.current.remotePresence;
        const visible = !!(pr && pr.sc === "play" && pr.pk === state.current.run && typeof pr.x === "number");
        remote.visible = visible && !pr.d;
        if (visible) {
          if (!remote.seen || Math.hypot(pr.x - remote.x, pr.y - remote.y) > 48) { remote.x = pr.x; remote.y = pr.y; remote.prevX = remote.x; remote.prevY = remote.y; remote.seen = true; }
          else { remote.x += (pr.x - remote.x) * Math.min(1, dt * 18); remote.y += (pr.y - remote.y) * Math.min(1, dt * 18); }
          remote.vx = pr.vx || 0; remote.vy = pr.vy || 0; remote.face = pr.f || 1; remote.onGround = !!pr.og; remote.wet = !!pr.w; remote.inExit = !!pr.ex; remote.dead = !!pr.d; remote.anim += dt;
          state.current.net.tgRemote = pr.tg || 0;
          if (pr.fm != null) L.fish.forEach((f: any, i: number) => { if (!f.got && (pr.fm & (1 << i))) f.got = true; });
          if (typeof pr.cp === "number") L.cp = Math.max(L.cp, pr.cp);
          if (pr.rc && L.cage) L.cage.open = true;
          if (pr.ky && L.key && !L.key.holder) L.key.holder = remote.id;
          if ((pr.th || 0) > state.current.seenTh && local && local.support?.o === remote) { state.current.seenTh = pr.th; Engine.launch(local, Engine.PHYS.throwV, remote.face * Engine.PHYS.throwX); }
          if ((pr.sw || 0) > state.current.seenSw && typeof pr.swx === "number" && local) { state.current.seenSw = pr.sw; local.x = pr.swx; local.y = pr.swy; local.prevX = local.x; local.prevY = local.y; }
        } else remote.seen = false;
      }
      const ev: any[] = [];
      for (const p of ps) { p.prevX = p.x; p.prevY = p.y; }
      Engine.updateWorld(L, ps, dt, ev);
      const actors: any[] = online ? [local].filter(Boolean) : ps;
      const order = [...actors].sort((a: any, b: any) => (a.support?.k === "p" ? 1 : 0) - (b.support?.k === "p" ? 1 : 0));
      for (const p of order) {
        if (p.dead) continue;
        Engine.applyCarry(L, p);
        const input = inputs.current[p.id as PenguinId];
        Engine.stepPenguin(L, p, input, ps, dt, ev);
        input.jp = false; input.gp = false;
      }
      if (L.rope) Engine.ropeStep(L, ps[0], ps[1], dt);
      Engine.coopEvents(L, online ? [local] : ps, ev, state.current.net, online ? remote : null);
      if (online) sendOnlinePresence();
      if (L.def.timeLimit && L.time > L.def.timeLimit) { state.current.stopped = true; setResult("fell"); }
      if (ev.some((e) => e[0] === "die") || (online && state.current.remotePresence?.d)) { state.current.stopped = true; setResult("fell"); }
      state.current.time += dt;
      const completed = online ? !!(local?.inExit && remote?.visible && remote?.inExit) : ps.every((p) => p.inExit && !p.dead);
      state.current.exits = completed ? state.current.exits + dt : 0;
      if (state.current.exits > 0.35) { state.current.stopped = true; setResult("won"); }
      if (now - lastRender.current >= 33) {
        lastRender.current = now;
        setRenderFrame((n) => n + 1);
        if (Math.floor(state.current.time) !== Math.floor(state.current.time - dt)) setClock(state.current.time);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => { state.current.stopped = true; cancelAnimationFrame(frame); lastFrame.current = 0; };
  }, [route, levelIndex, gameRunId, sendOnlinePresence]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (route === "game") { state.current.paused = true; setPaused(true); return true; }
      if (route === "levels" || route === "online") { roomRef.current?.close(); roomRef.current = null; setRoomCode(""); setPartner(null); setRoomConnected(false); setRoomStatus("Crea una sala o únete con un código."); setRoute("home"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [route]);

  const setControl = (id: PenguinId, key: keyof Input, active: boolean) => {
    const input = inputs.current[id]; input[key] = active;
    if (active && key === "j") input.jp = true;
    if (active && key === "g") input.gp = true;
  };
  const back = () => { state.current.paused = true; setPaused(true); };
  const exitGame = () => {
    state.current.stopped = true; setPaused(false);
    if (state.current.online) {
      const role = state.current.role;
      state.current.online = false; state.current.L = null;
      roomRef.current?.presence({ v: 1, r: role, sc: "lobby", pk: state.current.run, lv: -1, rs: 0, x: null, y: null });
      setRoute("online");
    } else setRoute("levels");
  };
  const leaveRoom = () => { roomRef.current?.close(); roomRef.current = null; setPartner(null); setRoomConnected(false); setRoomStatus("Crea una sala o únete con un código."); setRoomCode(""); setRoute("home"); };
  const camY = level && players.length ? Math.max(0, players.reduce((n, p) => n + p.y, 0) / players.length - 174) : 0;

  if (route === "game" && level) return <View style={styles.game}><StatusBar hidden /><GameScene level={level} players={players} cameraY={camY} screenWidth={gameWidth} screenHeight={gameHeight} time={clock} />
    <Pressable onPress={back} style={styles.gameBack}><Text style={styles.gameBackText}>Ⅱ</Text></Pressable>
    <View style={styles.controls}>
      {(state.current.online ? [state.current.role] : ["F", "B"] as PenguinId[]).map((id) => <View key={id} style={styles.pad}>
        <Text style={[styles.padName, { color: COLORS[id] }]}>{id === "F" ? "MALU" : "NUKA"}</Text>
        <View style={styles.padButtons}><ControlButton name={`Mover ${id === "F" ? "Malu" : "Nuka"} a la izquierda`} label="‹" color={COLORS[id]} onDown={() => setControl(id, "l", true)} onUp={() => setControl(id, "l", false)} /><ControlButton name={`Mover ${id === "F" ? "Malu" : "Nuka"} a la derecha`} label="›" color={COLORS[id]} onDown={() => setControl(id, "r", true)} onUp={() => setControl(id, "r", false)} /></View>
        {(level.rope || level.def.grab || level.def.throw || level.def.air) && <ControlButton name={`Agarrar con ${id === "F" ? "Malu" : "Nuka"}`} label="AG" color={COLORS[id]} onDown={() => setControl(id, "g", true)} onUp={() => setControl(id, "g", false)} />}
        <ControlButton name={`Saltar con ${id === "F" ? "Malu" : "Nuka"}`} label="↑" color={COLORS[id]} wide onDown={() => setControl(id, "j", true)} onUp={() => setControl(id, "j", false)} />
      </View>)}
    </View>
    {paused && !result && <View style={styles.resultShade}><View style={styles.resultCard}><Text style={styles.resultEmoji}>Ⅱ</Text><Text style={styles.resultTitle}>Pausa</Text><Text style={styles.resultSub}>{LEVELS[levelIndex].name}</Text><Pressable onPress={() => { state.current.paused = false; setPaused(false); }} style={styles.primary}><Text style={styles.primaryTitle}>Seguir jugando</Text></Pressable><Pressable onPress={() => state.current.online ? startOnlineLevel(levelIndex) : startLevel(levelIndex)} style={styles.secondary}><Text style={styles.secondaryTitle}>Reiniciar nivel</Text></Pressable><Pressable onPress={exitGame} style={styles.back}><Text style={styles.backText}>{state.current.online ? "Volver a la sala" : "Elegir otro nivel"}</Text></Pressable></View></View>}
    {result && <View style={styles.resultShade}><View style={styles.resultCard}><Text style={styles.resultEmoji}>{result === "won" ? "🏁" : "❄️"}</Text><Text style={styles.resultTitle}>{result === "won" ? "¡Llegaron juntos!" : "¡Intentémoslo otra vez!"}</Text><Text style={styles.resultSub}>{result === "won" ? `${LEVELS[levelIndex].name} completado` : "Malu y Nuka pueden volver a empezar."}</Text><Pressable onPress={() => result === "won" ? (state.current.online ? startOnlineLevel(Math.min(levelIndex + 1, LEVELS.length - 1)) : startLevel(Math.min(levelIndex + 1, LEVELS.length - 1))) : (state.current.online ? startOnlineLevel(levelIndex) : restartLevel())} style={styles.primary}><Text style={styles.primaryTitle}>{result === "won" ? "Siguiente nivel" : "Volver a intentar"}</Text></Pressable><Pressable onPress={exitGame} style={styles.secondary}><Text style={styles.secondaryTitle}>{state.current.online ? "Volver a la sala" : "Elegir otro nivel"}</Text></Pressable></View></View>}
  </View>;

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} />
    <View style={styles.top}><View style={styles.brandMark}><Text style={styles.markText}>M</Text></View><Text style={styles.brand}>MALU <Text style={{ color: C.ice }}>Y</Text> NUKA</Text><Text style={styles.eyebrow}>UNA AVENTURA EN EQUIPO</Text></View>
    {route === "home" ? <View style={styles.homeContent}>
      <View style={styles.hero}><View style={[styles.penguinCard, { backgroundColor: C.blue, marginRight: -8 }]}><Text style={styles.penguinFace}>•ᴗ•</Text></View><View style={[styles.penguinCard, { backgroundColor: C.orange, marginLeft: -8 }]}><Text style={styles.penguinFace}>•ᴗ•</Text></View></View>
      <Text style={styles.title}>Dos pingüinos.{"\n"}Un solo equipo.</Text><Text style={styles.subtitle}>Ayúdense para llegar juntos al iglú.</Text>
      <Pressable onPress={() => setRoute("levels")} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryTitle}>Jugar en este teléfono</Text><Text style={styles.primarySub}>Malu y Nuka comparten la pantalla</Text></Pressable>
      <Pressable onPress={() => setRoute("online")} style={styles.secondary}><View><Text style={styles.secondaryTitle}>Jugar en línea</Text><Text style={styles.secondarySub}>Cada quien desde su teléfono</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      <View style={styles.feature}><Text style={styles.featureIcon}>❄</Text><Text style={styles.featureText}>{LEVELS.length} niveles · 7 mundos · juego cooperativo</Text></View>
    </View> : route === "levels" ? <View style={styles.levelPage}>
      <Pressable onPress={() => setRoute("home")} style={styles.back}><Text style={styles.backText}>‹  Volver</Text></Pressable><Text style={styles.pageTitle}>Elige un nivel</Text><Text style={styles.pageSubtitle}>Trabajen juntos para llegar al iglú.</Text>
      <ScrollView contentContainerStyle={styles.levelGrid}>{LEVELS.map((item, index) => <Pressable key={index} onPress={() => startLevel(index)} style={({ pressed }) => [styles.levelCard, pressed && styles.pressed]}>
        <Text style={styles.levelNumber}>MUNDO {item.world} · NIVEL {String(index + 1).padStart(2, "0")}</Text><Text style={styles.levelName} numberOfLines={2}>{item.name}</Text><Text style={styles.levelGo}>Jugar <Text style={styles.chevron}>›</Text></Text>
      </Pressable>)}</ScrollView>
    </View> : <View style={styles.onlinePage}>
      <Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>‹  Volver</Text></Pressable>
      <Text style={styles.onlineIcon}>⌁</Text><Text style={styles.pageTitle}>Aventura en línea</Text>
      <Text style={styles.pageSubtitle}>{roomStatus}</Text>
      {roomCode ? <View style={styles.roomCodeCard}><Text style={styles.roomCodeLabel}>CÓDIGO DE SALA</Text><Text style={styles.roomCode}>{roomCode}</Text><Text style={styles.roomCodeLabel}>{partner ? `PAREJA CONECTADA · TÚ ${state.current.role === "F" ? "MALU" : "NUKA"}` : roomHost ? "COMPARTE EL CÓDIGO PARA JUGAR" : "CONECTÁNDOTE A LA SALA"}</Text></View> : null}
      {!roomCode ? <>
        <Pressable onPress={() => connectRoom(true)} style={styles.primary}><Text style={styles.primaryTitle}>Crear sala</Text><Text style={styles.primarySub}>Comparte el código para invitar a tu pareja</Text></Pressable>
        <Text style={styles.joinLabel}>O únete con un código</Text>
        <View style={styles.joinRow}><TextInput value={joinCode} onChangeText={(t) => setJoinCode(t.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase())} placeholder="ABCD" placeholderTextColor={C.muted} autoCapitalize="characters" maxLength={4} style={styles.joinInput} /><Pressable disabled={joinCode.length !== 4} onPress={() => connectRoom(false, joinCode)} style={[styles.joinButton, joinCode.length !== 4 && { opacity: 0.45 }]}><Text style={styles.joinButtonText}>Unirse</Text></Pressable></View>
      </> : null}
      {roomCode && roomConnected && roomHost && partner ? <>
        <Pressable onPress={() => setSelectedOnlineLevel((n) => (n + 1) % LEVELS.length)} style={styles.levelPicker}><Text style={styles.levelPickerLabel}>NIVEL PARA JUGAR</Text><Text style={styles.levelPickerName}>{LEVELS[selectedOnlineLevel].name}  ›</Text><Text style={styles.levelNumber}>MUNDO {LEVELS[selectedOnlineLevel].world} · NIVEL {String(selectedOnlineLevel + 1).padStart(2, "0")}</Text></Pressable>
        <Pressable onPress={() => startOnlineLevel(selectedOnlineLevel)} style={styles.primary}><Text style={styles.primaryTitle}>Empezar partida</Text></Pressable>
      </> : null}
      <Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>{roomCode ? "Salir de la sala" : "‹  Volver al inicio"}</Text></Pressable>
      <Text style={styles.onlineHint}>Puedes jugar con otra persona desde la app o desde la web.</Text>
    </View>}
    <View style={styles.footer}><Text style={styles.footerText}>HECHO PARA JUGAR JUNTOS</Text><View style={styles.footerDots}><View style={[styles.dot, { backgroundColor: C.blue }]} /><View style={[styles.dot, { backgroundColor: C.orange }]} /></View></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 }, top: { alignItems: "center", paddingTop: 12 }, brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.tile, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#34536b" }, markText: { color: C.ice, fontSize: 21, fontWeight: "900" }, brand: { color: C.snow, fontSize: 13, fontWeight: "900", letterSpacing: 2.5, marginTop: 9 }, eyebrow: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 5 },
  homeContent: { flex: 1, justifyContent: "center", paddingBottom: 5 }, hero: { height: 102, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 }, penguinCard: { width: 70, height: 78, borderRadius: 32, borderWidth: 4, borderColor: C.snow, alignItems: "center", justifyContent: "center", elevation: 7 }, penguinFace: { fontSize: 22, color: C.snow, fontWeight: "900" }, title: { color: C.snow, textAlign: "center", fontSize: 31, lineHeight: 37, letterSpacing: -0.8, fontWeight: "900" }, subtitle: { color: C.muted, textAlign: "center", fontSize: 14, marginTop: 10, marginBottom: 23 },
  primary: { backgroundColor: C.snow, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 18, shadowColor: "#6c8fa6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.75, shadowRadius: 0, elevation: 3 }, primaryTitle: { color: C.bg, fontSize: 16, fontWeight: "900", textAlign: "center" }, primarySub: { color: "#566f82", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 4 }, secondary: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 17, padding: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: "#28435c" }, secondaryTitle: { color: C.snow, fontWeight: "800", fontSize: 15 }, secondarySub: { color: C.muted, fontSize: 12, marginTop: 3 }, chevron: { color: C.ice, fontSize: 22, fontWeight: "500" }, feature: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22 }, featureIcon: { color: C.mint, fontSize: 14 }, featureText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  levelPage: { flex: 1, paddingTop: 18 }, back: { alignSelf: "flex-start", paddingVertical: 8, paddingRight: 14 }, backText: { color: C.ice, fontSize: 15, fontWeight: "700" }, pageTitle: { color: C.snow, fontWeight: "900", fontSize: 27, marginTop: 10 }, pageSubtitle: { color: C.muted, fontSize: 13, marginTop: 5, marginBottom: 15 }, levelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingBottom: 18 }, levelCard: { width: "48.2%", minHeight: 116, padding: 13, backgroundColor: C.panel, borderRadius: 15, marginBottom: 9, borderWidth: 1, borderColor: "#28435c" }, levelNumber: { color: C.mint, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, levelName: { color: C.snow, fontSize: 14, fontWeight: "800", marginTop: 7, minHeight: 34 }, levelGo: { color: C.ice, fontSize: 12, fontWeight: "800", marginTop: 6 },
  onlinePage: { flex: 1, alignItems: "stretch", justifyContent: "center", paddingHorizontal: 12 }, onlineIcon: { color: C.mint, fontSize: 42, textAlign: "center" }, joinLabel: { color: C.muted, fontSize: 12, fontWeight: "700", marginTop: 20, marginBottom: 8, textAlign: "center" }, joinRow: { flexDirection: "row", gap: 8 }, joinInput: { flex: 1, backgroundColor: C.panel, borderColor: "#28435c", borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, color: C.snow, fontSize: 18, fontWeight: "900", letterSpacing: 4, textAlign: "center" }, joinButton: { backgroundColor: C.mint, borderRadius: 14, justifyContent: "center", paddingHorizontal: 20 }, joinButtonText: { color: C.bg, fontWeight: "900" }, roomCodeCard: { backgroundColor: C.panel, borderRadius: 18, padding: 18, alignItems: "center", marginVertical: 8, borderWidth: 1, borderColor: "#28435c" }, roomCodeLabel: { color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" }, roomCode: { color: C.snow, fontSize: 38, fontWeight: "900", letterSpacing: 8, marginVertical: 8 }, levelPicker: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: "#28435c", padding: 14, marginBottom: 10 }, levelPickerLabel: { color: C.mint, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, levelPickerName: { color: C.snow, fontSize: 16, fontWeight: "800", marginTop: 7 }, onlineHint: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 14 }, footer: { height: 34, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9 }, footerText: { color: "#61798e", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 }, footerDots: { flexDirection: "row", gap: 4 }, dot: { width: 6, height: 6, borderRadius: 3 },
  game: { flex: 1, backgroundColor: C.bg }, scene: { ...StyleSheet.absoluteFill, backgroundColor: C.bg }, hud: { position: "absolute", top: 8, left: 56, right: 12, height: 38, flexDirection: "row", alignItems: "center", gap: 8 }, hudTitle: { color: C.snow, backgroundColor: "rgba(8,17,28,0.68)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontWeight: "800", overflow: "hidden", flexShrink: 1 }, hudFish: { color: C.ice, backgroundColor: "rgba(8,17,28,0.68)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, fontWeight: "800" }, hudTime: { color: C.snow, backgroundColor: "rgba(8,17,28,0.68)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, fontWeight: "800" }, gameBack: { position: "absolute", top: 8, left: 10, width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(8,17,28,0.76)", alignItems: "center", justifyContent: "center" }, gameBackText: { color: C.snow, fontSize: 28, lineHeight: 32 }, controls: { position: "absolute", left: 9, right: 9, bottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, pad: { flexDirection: "row", alignItems: "flex-end", gap: 7 }, padName: { fontSize: 9, fontWeight: "900", letterSpacing: 1, marginHorizontal: 3, marginBottom: 9, textShadowColor: C.bg, textShadowRadius: 4 }, padButtons: { flexDirection: "row", gap: 5 }, control: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderRadius: 18, marginBottom: 0 }, controlText: { fontSize: 24, fontWeight: "900" }, resultShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(3,10,19,0.72)", alignItems: "center", justifyContent: "center", padding: 24 }, resultCard: { width: "88%", maxWidth: 420, backgroundColor: C.panel, borderRadius: 24, padding: 22, alignItems: "stretch", borderWidth: 1, borderColor: "#38566d" }, resultEmoji: { fontSize: 34, textAlign: "center", marginBottom: 6 }, resultTitle: { color: C.snow, fontSize: 21, fontWeight: "900", textAlign: "center" }, resultSub: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 18 }, pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
