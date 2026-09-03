import { DataConnection, Peer, type PeerOptions } from "peerjs";

import { createGame, forfeitTurn, getActivePlayer, isGameFinished, moveToken, rollDice } from "../game/engine";
import type { GameSetup, LudoGameState, LudoPlayer, PlayerColor } from "../game/types";

export type PeerRole = "host" | "guest";

export type HostLobbyPlayer = {
  name: string;
  color: PlayerColor;
  isBot: boolean;
  connection: LudoPlayer["connection"];
  seatKey: string;
};

export type PeerClientMessage =
  | { t: "join"; name: string; seatKey?: string }
  | { t: "roll" }
  | { t: "move"; tokenIndex: number }
  | { t: "forfeit" }
  | { t: "ping"; at: number };

export type PeerHostMessage =
  | { t: "lobby"; players: HostLobbyPlayer[]; hostName: string; roomCode: string }
  | { t: "snapshot"; state: LudoGameState }
  | { t: "notice"; text: string }
  | { t: "pong"; at: number };

const PEER_NAMESPACE = "ludo-arena-x7";
export const peerIdForRoom = (roomCode: string): string => `${PEER_NAMESPACE}-${roomCode}`;

const defaultPeerOptions = (): PeerOptions => ({ debug: 0 });

const seatColors: PlayerColor[] = ["red", "blue", "yellow", "green"];

type Wire = {
  send: (message: PeerHostMessage) => void;
  close: () => void;
  seatKey: string;
};

/**
 * Host-authoritative Ludo room over a WebRTC data channel.
 * The host owns the engine and dice; guests only send intents.
 */
export class PeerLudoHost {
  readonly role = "host" as const;
  private peer: Peer | null = null;
  private clients = new Map<string, { wire: Wire; name: string }>();
  private seats: HostLobbyPlayer[] = [];
  private game: LudoGameState | null = null;
  private timer: number | null = null;
  private hostSeatKey = "host-seat";

  onLobby: (players: HostLobbyPlayer[]) => void = () => {};
  onState: (state: LudoGameState) => void = () => {};
  onNotice: (text: string) => void = () => {};
  onError: (text: string) => void = () => {};
  onClosed: () => void = () => {};

  constructor(readonly roomCode: string, private hostName: string) {
    this.seats = [{
      name: hostName,
      color: seatColors[0],
      isBot: false,
      connection: "ready",
      seatKey: this.hostSeatKey,
    }];
  }

  get players(): HostLobbyPlayer[] {
    return [...this.seats];
  }

  get state(): LudoGameState | null {
    return this.game;
  }

  open(): void {
    const peer = new Peer(peerIdForRoom(this.roomCode), defaultPeerOptions());
    this.peer = peer;
    peer.on("open", () => this.onLobby(this.players));
    peer.on("error", (error) => {
      if (error.type === "unavailable-id") {
        this.onError("That room number is already live. Create a new one.");
      } else if (error.type === "network" || error.type === "server-error" || error.type === "socket-error") {
        this.onError("Signalling network hiccup — retry in a moment.");
      } else if (error.type !== "peer-unavailable") {
        this.onError(`Room error: ${error.type}`);
      }
    });
    peer.on("connection", (connection) => this.attach(connection));
    peer.on("disconnected", () => {
      try { peer.reconnect(); } catch { this.onError("Lost signalling; live rooms may not accept new guests."); }
    });
  }

  private attach(connection: DataConnection): void {
    connection.on("data", (raw) => this.handle(connection, raw as PeerClientMessage));
    connection.on("close", () => this.drop(connection));
    connection.on("error", () => this.drop(connection));
  }

  private handle(connection: DataConnection, message: PeerClientMessage): void {
    const seatKey = connection.peer;
    if (message.t === "join") {
      const name = message.name.trim().slice(0, 16) || "Guest";
      const existing = this.seats.find((seat) => seatKey === seat.seatKey);
      if (existing) {
        existing.name = name;
        existing.connection = "ready";
        this.clients.set(seatKey, { wire: this.wireFor(connection), name });
        this.broadcastLobby();
        this.syncClient(seatKey);
        return;
      }
      if (this.seats.length >= 4) {
        connection.send({ t: "notice", text: "This room is full (4 players)." } satisfies PeerHostMessage);
        return;
      }
      if (this.game) {
        const seated = this.seats.find((seat) => seat.name.toLowerCase() === name.toLowerCase());
        if (!seated || seatKey !== seated.seatKey) {
          connection.send({ t: "notice", text: "Match already in progress." } satisfies PeerHostMessage);
          return;
        }
      }
      const taken = new Set(this.seats.map((seat) => seat.color));
      const color = seatColors.find((candidate) => !taken.has(candidate)) ?? seatColors[this.seats.length % 4];
      this.seats = [...this.seats, { name, color, isBot: false, connection: "ready", seatKey }];
      this.clients.set(seatKey, { wire: this.wireFor(connection), name });
      this.broadcastLobby();
      this.syncClient(seatKey);
      this.onNotice(`${name} joined the room.`);
      return;
    }

    if (message.t === "ping") {
      connection.send({ t: "pong", at: message.at } satisfies PeerHostMessage);
      return;
    }

    if (!this.game) {
      connection.send({ t: "notice", text: "The host has not started the match yet." } satisfies PeerHostMessage);
      return;
    }

    const seat = this.seats.find((candidate) => candidate.seatKey === seatKey);
    if (!seat) return;
    const active = getActivePlayer(this.game);
    if (active.color !== seat.color) return;

    if (message.t === "roll") {
      if (this.game.phase !== "rolling") return;
      const value = Math.floor(Math.random() * 6) + 1;
      this.commit(rollDice(this.game, value));
      return;
    }
    if (message.t === "move" && typeof message.tokenIndex === "number") {
      if (this.game.phase !== "moving") return;
      try {
        this.commit(moveToken(this.game, message.tokenIndex).state);
      } catch {
        /* illegal intent is ignored; authoritative state is unchanged */
      }
      return;
    }
    if (message.t === "forfeit") {
      this.commit(forfeitTurn(this.game, Date.now(), "manual"));
    }
  }

  private wireFor(connection: DataConnection): Wire {
    return {
      seatKey: connection.peer,
      send: (message) => { try { connection.send(message); } catch { /* dropped */ } },
      close: () => { try { connection.close(); } catch { /* already closed */ } },
    };
  }

  private drop(connection: DataConnection): void {
    const seatKey = connection.peer;
    if (!this.clients.has(seatKey)) return;
    const seat = this.seats.find((candidate) => candidate.seatKey === seatKey);
    if (seat) {
      seat.connection = "offline";
      this.onNotice(`${seat.name} disconnected.`);
    }
    this.clients.delete(seatKey);
    this.broadcastLobby();
  }

  addBot(): void {
    if (this.game || this.seats.length >= 4) return;
    const names = ["Nova", "Atlas", "Mira"];
    const taken = new Set(this.seats.map((seat) => seat.name));
    const name = names.find((candidate) => !taken.has(candidate)) ?? `Bot ${this.seats.length}`;
    const free = seatColors.filter((color) => !this.seats.some((seat) => seat.color === color));
    this.seats = [...this.seats, { name, color: free[0], isBot: true, connection: "bot", seatKey: `bot-${name}` }];
    this.broadcastLobby();
  }

  removeSeat(seatKey: string): void {
    if (seatKey === this.hostSeatKey || this.game) return;
    this.seats = this.seats.filter((seat) => seat.seatKey !== seatKey);
    this.broadcastLobby();
  }

  startMatch(): boolean {
    if (this.game || this.seats.length < 2) return false;
    const players: LudoPlayer[] = this.seats.map((seat) => ({
      id: seat.seatKey,
      name: seat.name,
      color: seat.color,
      isBot: seat.isBot,
      connection: seat.connection,
    }));
    const setup: GameSetup = {
      id: `room-${this.roomCode}`,
      mode: "online",
      players,
      rules: { turnDurationSeconds: 30, rankedFinish: true, blockadesEnabled: true },
    };
    this.game = createGame({ ...setup, now: Date.now() });
    this.broadcast({ t: "snapshot", state: this.game });
    this.onState(this.game);
    this.scheduleTurnClock();
    return true;
  }

  restartMatch(): void {
    if (!this.game) return;
    this.clearClock();
    this.game = null;
    if (!this.startMatch()) this.broadcastLobby();
  }

  /** Host-side intents (host is also a player). */
  hostRoll(): void {
    if (!this.game || this.game.phase !== "rolling") return;
    const value = Math.floor(Math.random() * 6) + 1;
    this.commit(rollDice(this.game, value));
  }

  hostMove(tokenIndex: number): void {
    if (!this.game || this.game.phase !== "moving") return;
    try {
      this.commit(moveToken(this.game, tokenIndex).state);
    } catch { /* ignore */ }
  }

  hostForfeit(): void {
    if (!this.game) return;
    this.commit(forfeitTurn(this.game, Date.now(), "manual"));
  }

  private commit(next: LudoGameState): void {
    this.game = next;
    this.broadcast({ t: "snapshot", state: next });
    this.onState(next);
    if (isGameFinished(next)) {
      this.clearClock();
      return;
    }
    this.scheduleTurnClock();
    this.maybeBotMove();
  }

  private maybeBotMove(): void {
    this.clearClock();
    this.scheduleTurnClock();
    const state = this.game;
    if (!state || state.phase === "finished") return;
    const active = getActivePlayer(state);
    if (!active.isBot) return;
    const delay = state.phase === "rolling" ? 750 : 600;
    window.setTimeout(() => {
      const current = this.game;
      if (!current || current.phase === "finished") return;
      const currentActive = getActivePlayer(current);
      if (currentActive.color !== active.color) return;
      if (current.phase === "rolling") {
        const value = Math.floor(Math.random() * 6) + 1;
        this.commit(rollDice(current, value));
        return;
      }
      if (current.phase === "moving") {
        const legal = current.legalTokenIndexes;
        if (legal.length === 0) return;
        const pick = legal[Math.floor(Math.random() * Math.min(legal.length, 2))];
        this.commit(moveToken(current, pick).state);
      }
    }, delay);
  }

  private scheduleTurnClock(): void {
    this.clearClock();
    if (!this.game || this.game.phase === "finished") return;
    const deadline = this.game.turnEndsAt;
    this.timer = window.setTimeout(() => {
      const current = this.game;
      if (!current || current.phase === "finished" || Date.now() < current.turnEndsAt) return;
      this.commit(forfeitTurn(current, Date.now(), "timeout"));
    }, Math.max(500, deadline - Date.now() + 400));
  }

  private clearClock(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private broadcast(message: PeerHostMessage): void {
    for (const client of this.clients.values()) client.wire.send(message);
  }

  private broadcastLobby(): void {
    this.broadcast({ t: "lobby", players: this.players, hostName: this.hostName, roomCode: this.roomCode });
    this.onLobby(this.players);
  }

  private syncClient(seatKey: string): void {
    const client = this.clients.get(seatKey);
    if (!client) return;
    client.wire.send({ t: "lobby", players: this.players, hostName: this.hostName, roomCode: this.roomCode });
    if (this.game) client.wire.send({ t: "snapshot", state: this.game });
  }

  close(): void {
    this.clearClock();
    for (const client of this.clients.values()) client.wire.close();
    this.clients.clear();
    this.peer?.destroy();
    this.peer = null;
    this.onClosed();
  }
}

export class PeerLudoGuest {
  readonly role = "guest" as const;
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;

  onLobby: (players: HostLobbyPlayer[], hostName: string, roomCode: string) => void = () => {};
  onState: (state: LudoGameState) => void = () => {};
  onNotice: (text: string) => void = () => {};
  onConnected: () => void = () => {};
  onClosed: (text: string) => void = () => {};

  constructor(readonly roomCode: string, private name: string) {}

  connect(): void {
    const peer = new Peer(defaultPeerOptions());
    this.peer = peer;
    peer.on("open", () => {
      const connection = peer.connect(peerIdForRoom(this.roomCode), { reliable: true });
      this.connection = connection;
      connection.on("open", () => {
        connection.send({ t: "join", name: this.name } satisfies PeerClientMessage);
        this.onConnected();
      });
      connection.on("data", (raw) => this.handle(raw as PeerHostMessage));
      connection.on("close", () => this.onClosed("The host closed the room."));
      connection.on("error", () => this.onClosed("Connection to the host failed."));
    });
    peer.on("error", (error) => {
      if (error.type === "peer-unavailable") {
        this.onClosed(`Room ${this.roomCode} is not live. Check the number or ask the host to reopen it.`);
      } else if (error.type === "network" || error.type === "server-error" || error.type === "socket-error") {
        this.onClosed("Signalling network hiccup — try again in a moment.");
      } else {
        this.onClosed(`Connection error: ${error.type}`);
      }
    });
  }

  private handle(message: PeerHostMessage): void {
    if (message.t === "lobby") this.onLobby(message.players, message.hostName, message.roomCode);
    else if (message.t === "snapshot") this.onState(message.state);
    else if (message.t === "notice") this.onNotice(message.text);
  }

  roll(): void {
    this.connection?.send({ t: "roll" } satisfies PeerClientMessage);
  }

  move(tokenIndex: number): void {
    this.connection?.send({ t: "move", tokenIndex } satisfies PeerClientMessage);
  }

  forfeit(): void {
    this.connection?.send({ t: "forfeit" } satisfies PeerClientMessage);
  }

  close(): void {
    try { this.connection?.close(); } catch { /* already closed */ }
    this.peer?.destroy();
    this.peer = null;
    this.connection = null;
  }
}
