import { DataConnection, Peer, type PeerOptions } from "peerjs";
import { autoPlayTurn, createGame, forfeitTurn, getActivePlayer, isGameFinished, moveToken, rollDice } from "../game/engine";
import type { LudoGameState, LudoPlayer, PlayerColor } from "../game/types";
import { decodePeerClientMessage, decodePeerHostMessage, type HostLobbyPlayer, type PeerClientMessage, type PeerHostMessage, type PeerResume } from "./peerProtocol";
import { generateInviteSecret, parseRoomAdmission } from "./roomCode";
import { nameSchema, PacketBudget, tokenIndexSchema } from "./validation";

export type { HostLobbyPlayer, PeerClientMessage, PeerHostMessage, PeerResume } from "./peerProtocol";
export type PeerRole = "host" | "guest";
// Separate corrected rules/admission from legacy peers; in-flight rooms must restart.
export const peerIdForRoom = (roomCode: string): string => `ludo-arena-v2-${roomCode}`;
const defaultPeerOptions = (): PeerOptions => ({ debug: 0 });
const seatColors: PlayerColor[] = ["red", "blue", "yellow", "green"];
const CONNECT_MS = 15_000;
const RESUME_MS = 90_000;
const HEARTBEAT_MS = 10_000;
const SILENCE_MS = 35_000;
const safeClose = (connection: DataConnection): void => { try { connection.close(); } catch { /* already closed */ } };
const safeDestroy = (peer: Peer | null): void => { try { peer?.destroy(); } catch { /* already destroyed */ } };
const displayName = (name: string): string => nameSchema.parse(name.trim().slice(0, 16));

type Client = { connection: DataConnection; seatKey: string | null; deadline: number | null; budget: PacketBudget; lastSeen: number };
type ResumeRecord = { token: string; expiresAt: number | null; timer: number | null };

/** Client-hosted authority, not a trusted server: a modified host can still cheat. */
export class PeerLudoHost {
  readonly role = "host" as const;
  readonly roomCode: string;
  private readonly hostName: string;
  private readonly inviteSecret?: string;
  private peer: Peer | null = null;
  private generation = 0;
  private closed = false;
  private clients = new Map<DataConnection, Client>();
  private seated = new Map<string, Client>();
  private resumes = new Map<string, ResumeRecord>();
  private seats: HostLobbyPlayer[];
  private game: LudoGameState | null = null;
  private timer: number | null = null;
  private botTimer: number | null = null;
  private openingTimer: number | null = null;
  private heartbeat: number | null = null;
  private readonly hostSeatKey = "host-seat";

  onLobby: (players: HostLobbyPlayer[]) => void = () => {};
  onState: (state: LudoGameState) => void = () => {};
  onNotice: (text: string) => void = () => {};
  onError: (text: string) => void = () => {};
  onClosed: () => void = () => {};

  constructor(roomCode: string, hostName: string, inviteSecret?: string) {
    const admission = parseRoomAdmission(roomCode, inviteSecret);
    this.roomCode = admission.roomCode;
    this.inviteSecret = admission.inviteSecret;
    this.hostName = displayName(hostName);
    this.seats = [{ name: this.hostName, color: "red", isBot: false, connection: "ready", seatKey: this.hostSeatKey }];
  }
  get players(): HostLobbyPlayer[] { return this.seats.map((seat) => ({ ...seat })); }
  get state(): LudoGameState | null { return this.game; }

  open(): void {
    if (this.peer || this.closed) return;
    const generation = ++this.generation;
    let peer: Peer;
    try { peer = new Peer(peerIdForRoom(this.roomCode), defaultPeerOptions()); }
    catch { this.fail("Unable to open the room."); return; }
    this.peer = peer;
    const current = (): boolean => this.peer === peer && this.generation === generation && !this.closed;
    this.openingTimer = window.setTimeout(() => { if (current()) this.fail("Opening the room timed out. Try again."); }, CONNECT_MS);
    peer.on("open", () => {
      if (!current()) return;
      this.clearOpeningTimer();
      this.onLobby(this.players);
      if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
      this.heartbeat = window.setInterval(() => {
        if (!current()) return;
        for (const client of this.clients.values()) if (Date.now() - client.lastSeen > SILENCE_MS) this.drop(client);
      }, HEARTBEAT_MS);
    });
    peer.on("connection", (connection) => { if (current()) this.attach(connection); else safeClose(connection); });
    peer.on("error", (error) => {
      if (!current()) return;
      this.fail(error.type === "unavailable-id" ? "That room number is already live. Create a new one." : "Room signalling failed. Reopen the room to retry.");
    });
    peer.on("close", () => { if (current()) this.fail("The room connection closed."); });
    peer.on("disconnected", () => {
      if (!current()) return;
      this.clearOpeningTimer();
      this.openingTimer = window.setTimeout(() => { if (current()) this.fail("Room signalling could not reconnect."); }, CONNECT_MS);
      try { peer.reconnect(); } catch { this.fail("Room signalling could not reconnect."); }
    });
  }

  private attach(connection: DataConnection): void {
    // Cap pending handshakes as well as admitted seats.
    if (this.clients.size >= 12) { safeClose(connection); return; }
    const client: Client = { connection, seatKey: null, deadline: null, budget: new PacketBudget(), lastSeen: Date.now() };
    this.clients.set(connection, client);
    client.deadline = window.setTimeout(() => this.drop(client), CONNECT_MS);
    connection.on("data", (raw) => {
      if (this.closed || this.clients.get(connection) !== client) return;
      if (!client.budget.take()) { this.drop(client); return; }
      const message = decodePeerClientMessage(raw);
      if (!message) { this.reject(client, "Invalid room message."); return; }
      client.lastSeen = Date.now();
      this.handle(client, message);
    });
    connection.on("close", () => this.drop(client));
    connection.on("error", () => this.drop(client));
  }

  private handle(client: Client, message: PeerClientMessage): void {
    if (message.t === "join") {
      if (client.seatKey) return;
      if (this.inviteSecret !== undefined && message.inviteSecret !== this.inviteSecret) { this.reject(client, "The invite is invalid."); return; }
      let seat: HostLobbyPlayer | undefined;
      let record: ResumeRecord | undefined;
      if (message.resume) {
        record = this.resumes.get(message.resume.seatKey);
        seat = this.seats.find((candidate) => candidate.seatKey === message.resume?.seatKey);
        if (!seat || !record || record.token !== message.resume.resumeToken ||
            (record.expiresAt !== null && record.expiresAt <= Date.now())) {
          this.reject(client, "Seat resume expired or invalid. Ask the host for a new seat."); return;
        }
        // Install the replacement before closing the old channel; its late close is inert.
        const old = this.seated.get(seat.seatKey);
        if (old) this.detach(old);
        if (record.timer !== null) window.clearTimeout(record.timer);
        record.timer = null;
        record.expiresAt = null;
      } else {
        if (this.game) { this.reject(client, "Match already in progress."); return; }
        if (this.seats.length >= 4) { this.reject(client, "This room is full (4 players)."); return; }
        try {
          const seatKey = `seat-${generateInviteSecret()}`;
          record = { token: generateInviteSecret(), expiresAt: null, timer: null };
          seat = { name: message.name, color: seatColors.find((color) => !this.seats.some((s) => s.color === color))!, isBot: false, connection: "ready", seatKey };
          this.seats.push(seat);
          this.resumes.set(seatKey, record);
        } catch { this.reject(client, "Secure seat allocation is unavailable."); return; }
      }
      client.seatKey = seat.seatKey;
      seat.connection = "ready";
      this.seated.set(seat.seatKey, client);
      if (client.deadline !== null) window.clearTimeout(client.deadline);
      client.deadline = null;
      if (!this.send(client, { t: "accepted", roomCode: this.roomCode, seatKey: seat.seatKey, resumeToken: record.token })) return;
      this.updatePresence();
      this.broadcastLobby();
      if (this.game) this.send(client, { t: "snapshot", state: this.game });
      this.onNotice(`${seat.name} joined the room.`);
      return;
    }
    const seatKey = client.seatKey;
    if (!seatKey || this.seated.get(seatKey) !== client) { this.reject(client, "Join the room first."); return; }
    if (message.t === "ping") { this.send(client, { t: "pong", at: message.at }); return; }
    if (message.t === "leave") { this.drop(client, true); return; }
    if (!this.game || message.matchId !== this.game.id || message.expectedRevision !== this.game.revision) return;
    this.act(seatKey, message.t, message.t === "move" ? message.tokenIndex : undefined);
  }

  private send(client: Client, message: PeerHostMessage): boolean {
    try {
      if (!client.connection.open || (client.connection.dataChannel?.bufferedAmount ?? 0) > 65_536) { this.drop(client); return false; }
      const pending = client.connection.send(message);
      if (pending) void pending.catch(() => this.drop(client));
      return true;
    } catch { this.drop(client); return false; }
  }
  private reject(client: Client, text: string): void {
    this.send(client, { t: "rejected", text });
    this.drop(client);
  }
  private detach(client: Client): void {
    this.clients.delete(client.connection);
    if (client.seatKey && this.seated.get(client.seatKey) === client) this.seated.delete(client.seatKey);
    if (client.deadline !== null) window.clearTimeout(client.deadline);
    client.deadline = null;
    safeClose(client.connection);
  }
  private drop(client: Client, permanent = false): void {
    if (this.clients.get(client.connection) !== client) return;
    const key = client.seatKey;
    const ownsSeat = key !== null && this.seated.get(key) === client;
    this.detach(client);
    if (!ownsSeat || !key || this.closed) return;
    const seat = this.seats.find((s) => s.seatKey === key);
    if (!seat) return;
    seat.connection = permanent ? "offline" : "reconnecting";
    const record = this.resumes.get(key);
    if (record) {
      record.expiresAt = Date.now() + RESUME_MS;
      if (record.timer !== null) window.clearTimeout(record.timer);
      record.timer = window.setTimeout(() => this.expireSeat(key, record), RESUME_MS);
      if (permanent) this.expireSeat(key, record);
    }
    this.updatePresence();
    this.broadcastLobby();
    this.onNotice(`${seat.name} disconnected.`);
  }
  private expireSeat(key: string, record: ResumeRecord): void {
    if (this.closed || this.resumes.get(key) !== record || this.seated.has(key)) return;
    if (record.timer !== null) window.clearTimeout(record.timer);
    this.resumes.delete(key);
    if (!this.game) this.seats = this.seats.filter((seat) => seat.seatKey !== key);
    else {
      const seat = this.seats.find((s) => s.seatKey === key);
      if (seat) seat.connection = "offline";
    }
    this.updatePresence();
    this.broadcastLobby();
  }
  private updatePresence(): void {
    if (!this.game || this.closed) return;
    const players = this.game.players.map((player) => ({ ...player, connection: this.seats.find((s) => s.seatKey === player.id)?.connection ?? "offline" as const }));
    if (players.every((player, index) => player.connection === this.game?.players[index].connection)) return;
    this.commit({ ...this.game, players, revision: this.game.revision + 1 });
  }

  addBot(): void {
    if (this.closed || this.game || this.seats.length >= 4) return;
    const color = seatColors.find((candidate) => !this.seats.some((s) => s.color === candidate))!;
    this.seats.push({ name: `Bot ${this.seats.length}`, color, isBot: true, connection: "bot", seatKey: `bot-${color}` });
    this.broadcastLobby();
  }
  removeSeat(seatKey: string): void {
    if (this.closed || seatKey === this.hostSeatKey || this.game) return;
    const client = this.seated.get(seatKey);
    if (client) { this.send(client, { t: "rejected", text: "The host removed your seat." }); this.detach(client); }
    const record = this.resumes.get(seatKey);
    if (record?.timer !== null && record?.timer !== undefined) window.clearTimeout(record.timer);
    this.resumes.delete(seatKey);
    this.seats = this.seats.filter((seat) => seat.seatKey !== seatKey);
    this.broadcastLobby();
  }
  startMatch(): boolean {
    if (this.closed || this.game || this.seats.length < 2 || this.seats.some((s) => !s.isBot && s.connection !== "ready")) return false;
    const players: LudoPlayer[] = this.seats.map((seat) => ({ id: seat.seatKey, name: seat.name, color: seat.color, isBot: seat.isBot, connection: seat.connection }));
    this.commit(createGame({ id: `room-${this.roomCode}-${generateInviteSecret()}`, mode: "online", players, now: Date.now(), rules: { turnDurationSeconds: 30, rankedFinish: true, blockadesEnabled: false } }));
    return true;
  }
  restartMatch(): void {
    if (this.closed || !this.game) return;
    if (this.seats.some((seat) => seat.connection === "reconnecting")) {
      this.onNotice("Wait for disconnected players to resume or their 90-second reservation to expire.");
      return;
    }
    this.clearTurnTimers();
    this.game = null;
    // Expired match seats no longer reserve a lobby slot.
    this.seats = this.seats.filter((seat) => seat.connection !== "offline");
    if (!this.startMatch()) { this.broadcast({ t: "notice", text: "Waiting for disconnected players before restarting." }); this.broadcastLobby(); }
  }
  hostRoll(): void { this.act(this.hostSeatKey, "roll"); }
  hostMove(tokenIndex: number): void { this.act(this.hostSeatKey, "move", tokenIndex); }
  hostForfeit(): void { this.act(this.hostSeatKey, "forfeit"); }
  private act(seatKey: string, action: "roll" | "move" | "forfeit", tokenIndex?: number): void {
    const state = this.game;
    if (this.closed || !state || (state.phase !== "rolling" && state.phase !== "moving")) return;
    const active = getActivePlayer(state);
    if (active.id !== seatKey || active.isBot || active.connection !== "ready") return;
    if (Date.now() >= state.turnEndsAt) { this.commit(autoPlayTurn(state, Date.now())); return; }
    try {
      if (action === "roll" && state.phase === "rolling") this.commit(rollDice(state, this.die()));
      else if (action === "move" && state.phase === "moving" && tokenIndexSchema.safeParse(tokenIndex).success && state.legalTokenIndexes.includes(tokenIndex!)) this.commit(moveToken(state, tokenIndex!).state);
      else if (action === "forfeit") this.commit(forfeitTurn(state, Date.now(), "manual"));
    } catch { /* Engine rule rejections leave the authoritative state unchanged. */ }
  }
  private die(): number {
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= 4_294_967_292);
    return values[0] % 6 + 1;
  }
  private commit(next: LudoGameState): void {
    if (this.closed) return;
    this.clearTurnTimers();
    this.game = next;
    this.broadcast({ t: "snapshot", state: next });
    if (this.game !== next || this.closed) return;
    this.onState(next);
    if (this.game !== next || this.closed || isGameFinished(next)) return;
    this.timer = window.setTimeout(() => {
      if (!this.closed && this.game === next) this.commit(autoPlayTurn(next, Date.now()));
    }, Math.max(0, next.turnEndsAt - Date.now() + 10));
    if (getActivePlayer(next).isBot) {
      this.botTimer = window.setTimeout(() => {
        if (this.closed || this.game !== next) return;
        if (Date.now() >= next.turnEndsAt) { this.commit(autoPlayTurn(next, Date.now())); return; }
        if (next.phase === "rolling") this.commit(rollDice(next, this.die()));
        else if (next.phase === "moving" && next.legalTokenIndexes.length) this.commit(moveToken(next, next.legalTokenIndexes[0]).state);
      }, next.phase === "rolling" ? 750 : 600);
    }
  }
  private clearTurnTimers(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.botTimer !== null) window.clearTimeout(this.botTimer);
    this.timer = this.botTimer = null;
  }
  private clearOpeningTimer(): void {
    if (this.openingTimer !== null) window.clearTimeout(this.openingTimer);
    this.openingTimer = null;
  }
  private broadcast(message: PeerHostMessage): void {
    for (const client of [...this.seated.values()]) this.send(client, message);
  }
  private broadcastLobby(): void {
    if (this.closed) return;
    this.broadcast({ t: "lobby", players: this.players, hostName: this.hostName, roomCode: this.roomCode });
    this.onLobby(this.players);
  }
  private fail(text: string): void { this.close(); this.onError(text); }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    ++this.generation;
    this.clearTurnTimers();
    this.clearOpeningTimer();
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const record of this.resumes.values()) if (record.timer !== null) window.clearTimeout(record.timer);
    this.resumes.clear();
    for (const client of [...this.clients.values()]) this.detach(client);
    const peer = this.peer;
    this.peer = null;
    safeDestroy(peer);
    this.onClosed();
  }
}

export class PeerLudoGuest {
  readonly role = "guest" as const;
  readonly roomCode: string;
  private readonly name: string;
  private readonly inviteSecret?: string;
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private generation = 0;
  private deadline: number | null = null;
  private heartbeat: number | null = null;
  private accepted = false;
  private lastSeen = 0;
  private lastState: LudoGameState | null = null;
  private resume: PeerResume | undefined;
  private pendingPing: number | null = null;

  onLobby: (players: HostLobbyPlayer[], hostName: string, roomCode: string) => void = () => {};
  onState: (state: LudoGameState) => void = () => {};
  onNotice: (text: string) => void = () => {};
  onConnected: () => void = () => {};
  onAssigned: (identity: PeerResume) => void = () => {};
  onClosed: (text: string) => void = () => {};

  constructor(roomCode: string, name: string, inviteSecret?: string, resume?: PeerResume) {
    const admission = parseRoomAdmission(roomCode, inviteSecret);
    this.roomCode = admission.roomCode;
    this.inviteSecret = admission.inviteSecret;
    this.name = displayName(name);
    this.resume = resume;
  }
  get resumeIdentity(): PeerResume | undefined { return this.resume ? { ...this.resume } : undefined; }

  connect(): void {
    this.close();
    const generation = this.generation;
    const current = (): boolean => this.generation === generation && this.peer !== null;
    let peer: Peer;
    try { peer = new Peer(defaultPeerOptions()); } catch { this.onClosed("Unable to connect to the room."); return; }
    this.peer = peer;
    const budget = new PacketBudget();
    this.deadline = window.setTimeout(() => { if (current()) this.fail("Room connection timed out. Check the invite and retry."); }, CONNECT_MS);
    peer.on("open", () => {
      if (!current()) return;
      if (this.connection) {
        if (this.accepted && this.deadline !== null) window.clearTimeout(this.deadline);
        if (this.accepted) this.deadline = null;
        return;
      }
      let connection: DataConnection;
      try { connection = peer.connect(peerIdForRoom(this.roomCode), { reliable: true }); }
      catch { this.fail("Unable to connect to the host."); return; }
      this.connection = connection;
      connection.on("open", () => {
        if (!current() || this.connection !== connection) return;
        this.send({ t: "join", name: this.name, inviteSecret: this.inviteSecret, resume: this.resume }, false);
      });
      connection.on("data", (raw) => {
        if (!current() || this.connection !== connection) return;
        if (!budget.take()) { this.fail("Room sent too many messages."); return; }
        const message = decodePeerHostMessage(raw);
        if (!message) { this.fail("The host sent an invalid room message."); return; }
        this.lastSeen = Date.now();
        this.handle(message);
      });
      connection.on("close", () => { if (current()) this.fail("Connection lost. Reconnect within 90 seconds to resume your seat."); });
      connection.on("error", () => { if (current()) this.fail("Connection to the host failed. Try reconnecting."); });
    });
    peer.on("error", () => { if (current()) this.fail("Room connection failed. Check the code and invite, then retry."); });
    peer.on("close", () => { if (current()) this.fail("Room connection closed."); });
    peer.on("disconnected", () => {
      if (!current()) return;
      // Live data channels remain usable; bound the attempt to restore signalling.
      if (this.deadline === null) this.deadline = window.setTimeout(() => { if (current() && peer.disconnected) this.fail("Room signalling could not reconnect."); }, CONNECT_MS);
      try { peer.reconnect(); } catch { this.fail("Room signalling could not reconnect."); }
    });
  }
  private handle(message: PeerHostMessage): void {
    if (message.t === "rejected") { this.resume = undefined; this.fail(message.text); return; }
    if (message.t === "accepted") {
      if (this.accepted || message.roomCode !== this.roomCode || (this.resume && this.resume.seatKey !== message.seatKey)) { this.fail("Unexpected seat assignment."); return; }
      this.resume = { seatKey: message.seatKey, resumeToken: message.resumeToken };
      this.accepted = true;
      if (this.deadline !== null) window.clearTimeout(this.deadline);
      this.deadline = null;
      this.lastSeen = Date.now();
      this.heartbeat = window.setInterval(() => {
        if (Date.now() - this.lastSeen > SILENCE_MS) { this.fail("Connection lost. Reconnect within 90 seconds to resume your seat."); return; }
        this.pendingPing = Date.now();
        this.send({ t: "ping", at: this.pendingPing });
      }, HEARTBEAT_MS);
      const generation = this.generation;
      this.onAssigned({ ...this.resume });
      if (this.generation === generation && this.accepted) this.onConnected();
      return;
    }
    if (!this.accepted) { this.fail("The host did not assign a seat."); return; }
    if (message.t === "lobby") {
      if (message.roomCode !== this.roomCode || !message.players.some((p) => p.seatKey === this.resume?.seatKey)) { this.fail("Your room seat is no longer available."); return; }
      this.onLobby(message.players, message.hostName, message.roomCode);
    } else if (message.t === "snapshot") {
      if (message.state.mode !== "online" || !message.state.players.some((p) => p.id === this.resume?.seatKey)) { this.fail("Invalid room snapshot identity."); return; }
      if (this.lastState?.id === message.state.id && message.state.revision <= this.lastState.revision) return;
      this.lastState = message.state;
      this.onState(message.state);
    } else if (message.t === "notice") this.onNotice(message.text);
    else if (message.t === "pong" && message.at === this.pendingPing) this.pendingPing = null;
  }
  private send(message: PeerClientMessage, requireAccepted = true): void {
    if (requireAccepted && !this.accepted) return;
    try {
      if (!this.connection?.open || (this.connection.dataChannel?.bufferedAmount ?? 0) > 65_536) { this.fail("Room connection is not ready. Try reconnecting."); return; }
      const connection = this.connection;
      const generation = this.generation;
      const pending = connection.send(message);
      if (pending) void pending.catch(() => {
        if (this.generation === generation && this.connection === connection) this.fail("Sending to the room failed. Try reconnecting.");
      });
    } catch { this.fail("Sending to the room failed. Try reconnecting."); }
  }
  private action(t: "roll" | "move" | "forfeit", tokenIndex?: number): void {
    if (!this.lastState || !this.accepted) return;
    const context = { matchId: this.lastState.id, expectedRevision: this.lastState.revision };
    if (t === "move") { if (tokenIndexSchema.safeParse(tokenIndex).success) this.send({ t, tokenIndex: tokenIndex!, ...context }); }
    else this.send({ t, ...context });
  }
  roll(): void { this.action("roll"); }
  move(tokenIndex: number): void { this.action("move", tokenIndex); }
  forfeit(): void { this.action("forfeit"); }
  /** Explicit leave revokes the reservation; close() alone preserves resume eligibility. */
  leave(): void { if (this.accepted) this.send({ t: "leave" }); this.resume = undefined; this.close(); }
  private fail(text: string): void { this.close(); this.onClosed(text); }
  close(): void {
    ++this.generation;
    this.accepted = false;
    this.lastState = null;
    this.pendingPing = null;
    if (this.deadline !== null) window.clearTimeout(this.deadline);
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.deadline = this.heartbeat = null;
    const connection = this.connection;
    const peer = this.peer;
    this.connection = null;
    this.peer = null;
    if (connection) safeClose(connection);
    safeDestroy(peer);
  }
}
