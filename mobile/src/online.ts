import { Peer } from "react-native-peer";

export type Presence = Record<string, any>;
type Listener = () => void;

export class OnlineRoom {
  private peer: any;
  private connection: any = null;
  private latest: Presence | null = null;
  private lastReceived = 0;
  private pending: Presence | null = null;
  private onReady: Listener = () => {};
  private onChange: Listener = () => {};
  private onError: (error: string) => void = () => {};
  private closed = false;
  lost = false;
  readonly code: string;
  readonly host: boolean;

  constructor(code: string, host: boolean) {
    this.code = code;
    this.host = host;
  }

  start(onReady: Listener, onChange: Listener, onError: (error: string) => void) {
    this.onReady = onReady;
    this.onChange = onChange;
    this.onError = onError;
    try {
      const PeerConstructor: any = Peer;
      this.peer = this.host
        ? new PeerConstructor(`malu-y-nuka-sala-${this.code.toLowerCase()}`, { debug: 0 })
        : new PeerConstructor(undefined, { debug: 0 });
      this.peer.on("open", () => {
        if (this.closed) return;
        this.onReady();
        if (!this.host) this.attach(this.peer.connect(`malu-y-nuka-sala-${this.code.toLowerCase()}`, { serialization: "json", reliable: true }));
      });
      this.peer.on("connection", (connection: any) => { if (this.host) this.attach(connection); });
      this.peer.on("disconnected", () => { if (!this.closed && this.peer && !this.peer.destroyed) this.peer.reconnect(); });
      this.peer.on("error", (error: any) => { if (!this.closed) this.onError(error?.type || "network"); });
    } catch {
      this.onError("webrtc");
    }
  }

  private attach(connection: any) {
    if (this.closed) { connection.close(); return; }
    if (this.connection?.open && connection !== this.connection) { connection.on("open", () => connection.close()); return; }
    this.connection = connection;
    connection.on("open", () => {
      this.lost = false;
      if (this.pending) connection.send(this.pending);
      this.onChange();
    });
    connection.on("data", (data: any) => {
      if (!data || typeof data !== "object") return;
      this.latest = data;
      this.lastReceived = Date.now();
      this.onChange();
    });
    connection.on("close", () => {
      if (this.connection !== connection) return;
      this.connection = null;
      this.latest = null;
      this.lost = true;
      this.onChange();
      if (!this.host && !this.closed) setTimeout(() => this.retry(), 700);
    });
    connection.on("error", () => {});
  }

  presence(value: Presence) {
    this.pending = value;
    if (this.connection?.open) {
      try { this.connection.send(value); } catch { /* connection may be closing */ }
    }
  }

  peers() {
    return this.latest && Date.now() - this.lastReceived < 8000 ? [this.latest] : [];
  }

  retry() {
    if (this.host || this.closed || !this.peer?.open || this.connection?.open) return;
    try { this.connection?.close(); } catch { /* ignored */ }
    this.connection = null;
    this.attach(this.peer.connect(`malu-y-nuka-sala-${this.code.toLowerCase()}`, { serialization: "json", reliable: true }));
  }

  close() {
    this.closed = true;
    try { this.peer?.destroy(); } catch { /* already closed */ }
    this.peer = null;
    this.connection = null;
    this.latest = null;
  }
}

export const newRoomCode = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};
