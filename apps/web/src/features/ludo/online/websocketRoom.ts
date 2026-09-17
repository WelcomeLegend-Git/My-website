import type { LudoGameState, LudoPlayer } from "../game/types";
import { decodeLudoMessage, encodeLudoMessage, type LudoClientMessage, type LudoGuestIdentity, type LudoNetworkIntent, type LudoServerMessage } from "./protocol";
import { PacketBudget } from "./validation";

export interface LudoSocketRoomOptions {
  endpoint: string;
  roomCode: string;
  inviteSecret?: string;
  identity: LudoGuestIdentity;
  onSnapshot: (state: LudoGameState) => void;
  onPresence: (players: LudoPlayer[]) => void;
  onPing: (pingMs: number) => void;
  onError: (message: string) => void;
  onAuthenticated?: (player: LudoPlayer) => void;
}

/** Future server adapter only; no `/ws/ludo` backend is deployed by this module. */
export class LudoSocketRoom {
  private socket: WebSocket | null = null;
  private heartbeat: number | null = null;
  private deadline: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private generation = 0;
  private lastRevision = 0;
  private hasSnapshot = false;
  private matchId: string | null = null;
  private authenticated = false;
  private playerId: string | null = null;
  private pendingPing: number | null = null;
  private lastSeen = 0;
  private closedByOwner = true;
  private static readonly MAX_RECONNECT_ATTEMPTS = 8;
  constructor(private readonly options: LudoSocketRoomOptions) {}

  connect(): void {
    this.closedByOwner = false;
    this.reconnectAttempt = 0;
    this.openSocket();
  }
  private openSocket(): void {
    if (this.closedByOwner) return;
    this.disposeSocket();
    const epoch = this.generation;
    let socket: WebSocket;
    try { socket = new WebSocket(this.options.endpoint); }
    catch { this.retry("Unable to open the game connection."); return; }
    this.socket = socket;
    const current = (): boolean => this.generation === epoch && this.socket === socket && !this.closedByOwner;
    const budget = new PacketBudget();
    this.deadline = window.setTimeout(() => { if (current()) this.retry("Game connection or authentication timed out."); }, 15_000);
    socket.addEventListener("open", () => {
      if (!current()) return;
      this.send({ type: "AUTH", roomCode: this.options.roomCode, inviteSecret: this.options.inviteSecret, identity: this.options.identity, lastRevision: this.lastRevision }, false);
    });
    socket.addEventListener("message", (event) => {
      if (!current()) return;
      if (!budget.take()) { this.retry("Too many game messages."); return; }
      const message = typeof event.data === "string" ? decodeLudoMessage(event.data) : null;
      if (!message) { this.retry("Invalid game message received."); return; }
      this.handleMessage(message);
    });
    socket.addEventListener("close", () => { if (current()) this.retry("The game connection closed."); });
    socket.addEventListener("error", () => { if (current()) this.retry("The game connection had a network error."); });
  }
  sendIntent(intent: LudoNetworkIntent, expectedRevision: number): void {
    this.send({ type: "INTENT", intent, expectedRevision });
  }
  ready(expectedRevision: number): void { this.send({ type: "READY", expectedRevision }); }
  close(): void {
    this.closedByOwner = true;
    this.disposeSocket();
  }
  private disposeSocket(): void {
    ++this.generation;
    this.authenticated = false;
    this.playerId = null;
    this.pendingPing = null;
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    if (this.deadline !== null) window.clearTimeout(this.deadline);
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.heartbeat = this.deadline = this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    try { socket?.close(); } catch { /* invalid/closed socket */ }
  }
  private send(message: LudoClientMessage, requireAuth = true): void {
    if (requireAuth && !this.authenticated) return;
    let encoded: string;
    try { encoded = encodeLudoMessage(message); }
    catch { this.options.onError("Invalid outgoing game message."); return; }
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 65_536) { this.retry("The game connection is congested."); return; }
    try { socket.send(encoded); } catch { this.retry("Sending to the game failed."); }
  }
  private handleMessage(message: LudoServerMessage): void {
    if (message.type === "ERROR") {
      if (["ROOM_NOT_FOUND", "ROOM_FULL", "INVITE_INVALID"].includes(message.code)) this.close();
      this.options.onError(message.message);
      return;
    }
    if (message.type === "AUTHENTICATED") {
      if (this.authenticated || message.roomCode !== this.options.roomCode) { this.retry("Unexpected room authentication."); return; }
      this.authenticated = true;
      this.playerId = message.player.id;
      this.lastSeen = Date.now();
      if (this.deadline !== null) window.clearTimeout(this.deadline);
      // An authenticated socket that never delivers state is not a successful resume.
      this.deadline = window.setTimeout(() => this.retry("The room did not send its state."), 15_000);
      this.heartbeat = window.setInterval(() => {
        if (this.pendingPing !== null && Date.now() - this.pendingPing >= 40_000) { this.retry("The game heartbeat timed out."); return; }
        if (Date.now() - this.lastSeen > 60_000) { this.retry("The game connection stopped responding."); return; }
        if (this.pendingPing === null) {
          this.pendingPing = Date.now();
          this.send({ type: "PING", sentAt: this.pendingPing });
        }
      }, 20_000);
      const epoch = this.generation;
      this.send({ type: "REJOIN", lastRevision: this.lastRevision });
      if (this.generation === epoch && this.authenticated) this.options.onAuthenticated?.(message.player);
      return;
    }
    if (!this.authenticated) { this.retry("Room state arrived before authentication."); return; }
    this.lastSeen = Date.now();
    switch (message.type) {
      case "SNAPSHOT": {
        if (message.state.mode !== "online" || !message.state.players.some((player) => player.id === this.playerId)) { this.retry("The snapshot does not contain your room seat."); return; }
        if (this.matchId === message.state.id && this.hasSnapshot && message.state.revision < this.lastRevision) return;
        if (this.deadline !== null) window.clearTimeout(this.deadline);
        this.deadline = null;
        this.reconnectAttempt = 0;
        const duplicate = this.matchId === message.state.id && this.hasSnapshot && message.state.revision === this.lastRevision;
        this.matchId = message.state.id;
        this.lastRevision = message.state.revision;
        this.hasSnapshot = true;
        if (!duplicate) this.options.onSnapshot(message.state);
        break;
      }
      case "PRESENCE": this.options.onPresence(message.players); break;
      case "PONG":
        if (message.sentAt === this.pendingPing) {
          this.options.onPing(Math.max(0, Date.now() - message.sentAt));
          this.pendingPing = null;
        }
        break;
    }
  }
  private retry(message: string): void {
    if (this.closedByOwner) return;
    this.disposeSocket();
    const epoch = this.generation;
    if (this.reconnectAttempt >= LudoSocketRoom.MAX_RECONNECT_ATTEMPTS) {
      this.closedByOwner = true;
      this.options.onError("Connection lost after 8 retries. Reconnect manually to try again.");
      return;
    }
    const delay = Math.min(12_000, 750 * 2 ** this.reconnectAttempt++);
    this.reconnectTimer = window.setTimeout(() => {
      if (this.generation !== epoch || this.closedByOwner) return;
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
    this.options.onError(message);
  }
}
