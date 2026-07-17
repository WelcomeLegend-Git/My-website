import type { GameIntent, LudoGameState, LudoPlayer } from "../game/types";
import {
  decodeLudoMessage,
  encodeLudoMessage,
  type LudoGuestIdentity,
  type LudoServerMessage,
} from "./protocol";

export interface LudoSocketRoomOptions {
  endpoint: string;
  roomCode: string;
  inviteSecret?: string;
  identity: LudoGuestIdentity;
  onSnapshot: (state: LudoGameState) => void;
  onPresence: (players: LudoPlayer[]) => void;
  onPing: (pingMs: number) => void;
  onError: (message: string) => void;
}

/**
 * Client-only adapter for the future server-authoritative `/ws/ludo` endpoint.
 * It deliberately sends intents rather than mutable board state.
 */
export class LudoSocketRoom {
  private socket: WebSocket | null = null;
  private heartbeat: number | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private lastRevision = 0;
  private closedByOwner = false;

  private static readonly MAX_RECONNECT_ATTEMPTS = 8;

  constructor(private readonly options: LudoSocketRoomOptions) {}

  connect(): void {
    this.closedByOwner = false;
    this.socket?.close();
    const socket = new WebSocket(this.options.endpoint);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.send({
        type: "AUTH",
        roomCode: this.options.roomCode,
        inviteSecret: this.options.inviteSecret,
        identity: this.options.identity,
        lastRevision: this.lastRevision,
      });
      this.startHeartbeat();
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = decodeLudoMessage(event.data);
      if (message) this.handleMessage(message);
    });

    socket.addEventListener("close", () => {
      this.stopHeartbeat();
      if (!this.closedByOwner) this.scheduleReconnect();
    });

    socket.addEventListener("error", () => this.options.onError("The game connection had a network error."));
  }

  sendIntent(intent: GameIntent, expectedRevision: number): void {
    this.send({ type: "INTENT", intent, expectedRevision });
  }

  ready(expectedRevision: number): void {
    this.send({ type: "READY", expectedRevision });
  }

  close(): void {
    this.closedByOwner = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  private send(message: Parameters<typeof encodeLudoMessage>[0]): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encodeLudoMessage(message));
  }

  private handleMessage(message: LudoServerMessage): void {
    switch (message.type) {
      case "SNAPSHOT":
        this.lastRevision = message.state.revision;
        this.options.onSnapshot(message.state);
        break;
      case "PRESENCE":
        this.options.onPresence(message.players);
        break;
      case "PONG":
        this.options.onPing(Math.max(0, Date.now() - message.sentAt));
        break;
      case "ERROR":
        this.options.onError(message.message);
        break;
      case "AUTHENTICATED":
        this.send({ type: "REJOIN", lastRevision: this.lastRevision });
        break;
      default:
        break;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = window.setInterval(() => this.send({ type: "PING", sentAt: Date.now() }), 20_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= LudoSocketRoom.MAX_RECONNECT_ATTEMPTS) {
      this.options.onError(`Connection lost after ${this.reconnectAttempt} attempts. Please refresh to reconnect.`);
      return;
    }
    const delay = Math.min(12_000, 750 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }
}
