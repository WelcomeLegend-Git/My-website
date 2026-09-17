import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../game/engine";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePeerLudo } from "../hooks/usePeerLudo";

const mocks = vi.hoisted(() => {
  class Emitter {
    listeners = new Map<string, Array<(...args: any[]) => void>>();
    on(event: string, callback: (...args: any[]) => void) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]); return this;
    }
    emit(event: string, ...args: any[]) { for (const callback of this.listeners.get(event) ?? []) callback(...args); }
  }
  class Connection extends Emitter {
    open = true;
    dataChannel = { bufferedAmount: 0 };
    sent: any[] = [];
    constructor(readonly peer = "transport-id") { super(); }
    send(message: unknown) { this.sent.push(message); }
    close = vi.fn(() => { this.open = false; this.emit("close"); });
  }
  class Peer extends Emitter {
    static instances: Peer[] = [];
    disconnected = false;
    outgoing = new Connection("host");
    constructor(..._args: unknown[]) { super(); Peer.instances.push(this); }
    connect = vi.fn(() => this.outgoing);
    reconnect = vi.fn();
    destroy = vi.fn(() => this.emit("close"));
  }
  return { Peer, Connection };
});
vi.mock("peerjs", () => ({ Peer: mocks.Peer, DataConnection: mocks.Connection }));
import { PeerLudoGuest, PeerLudoHost } from "./peerRoom";

const lastPeer = () => mocks.Peer.instances[mocks.Peer.instances.length - 1];
const accepted = (connection: InstanceType<typeof mocks.Connection>) => connection.sent.find((message) => message.t === "accepted");
const resumeOf = (connection: InstanceType<typeof mocks.Connection>) => {
  const packet = accepted(connection); return { seatKey: packet.seatKey, resumeToken: packet.resumeToken };
};
const attach = (peer: InstanceType<typeof mocks.Peer>, name = "Same", extra = {}) => {
  const connection = new mocks.Connection();
  peer.emit("connection", connection);
  connection.emit("data", { t: "join", name, ...extra });
  return connection;
};
const openHost = (secret?: string) => {
  const host = new PeerLudoHost("12345", "Same", secret); host.open();
  const peer = lastPeer(); peer.emit("open"); return { host, peer };
};
const action = (host: PeerLudoHost, t: "roll" | "forfeit" | "move", extra = {}) => ({ t, matchId: host.state!.id, expectedRevision: host.state!.revision, ...extra });

beforeEach(() => { vi.useFakeTimers(); mocks.Peer.instances = []; });
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("host room defensive lifecycle", () => {
  it("drops a congested channel using RTCDataChannel backpressure", () => {
    const { host, peer } = openHost();
    const guest = attach(peer);
    guest.dataChannel.bufferedAmount = 10_000;
    guest.emit("data", { t: "ping", at: Date.now() });
    expect(guest.close).not.toHaveBeenCalled();
    expect(guest.sent[guest.sent.length - 1].t).toBe("pong");
    guest.dataChannel.bufferedAmount = 70_000;
    guest.emit("data", { t: "ping", at: Date.now() });
    expect(guest.close).toHaveBeenCalledOnce();
    expect(host.players[1].connection).toBe("reconnecting");
    host.close();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("assigns distinct identities for duplicate names and resumes a full room by private token", () => {
    const { host, peer } = openHost();
    const first = attach(peer); attach(peer); attach(peer);
    expect(host.players).toHaveLength(4);
    expect(new Set(host.players.map((p) => p.seatKey)).size).toBe(4);
    const resume = resumeOf(first);
    expect(resume.resumeToken).toMatch(/^[a-f0-9]{48}$/);
    expect(first.sent.filter((m) => m.t === "lobby").every((m) => !JSON.stringify(m).includes(resume.resumeToken))).toBe(true);
    const replacement = attach(peer, "Different", { resume });
    expect(accepted(replacement).seatKey).toBe(resume.seatKey);
    first.emit("close");
    expect(host.players.find((p) => p.seatKey === resume.seatKey)?.connection).toBe("ready");
    host.close();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("enforces an optional secret and never uses a name or transport ID as resume authority", () => {
    const secret = "a".repeat(48);
    const { host, peer } = openHost(secret);
    const rejected = attach(peer);
    expect(accepted(rejected)).toBeUndefined();
    expect(rejected.close).toHaveBeenCalled();
    const first = attach(peer, "Same", { inviteSecret: secret });
    expect(accepted(first).seatKey).not.toBe(first.peer);
    const wrongResume = attach(peer, "Same", { inviteSecret: secret, resume: { seatKey: accepted(first).seatKey, resumeToken: "b".repeat(48) } });
    expect(accepted(wrongResume)).toBeUndefined();
    expect(host.players).toHaveLength(2);
    host.close();
  });
  it("accepts actions only from the active seat and current match revision", () => {
    const { host, peer } = openHost();
    const guest = attach(peer);
    host.startMatch();
    const initial = host.state;
    guest.emit("data", action(host, "forfeit"));
    expect(host.state).toBe(initial);
    host.hostForfeit();
    const guestTurn = host.state;
    host.hostRoll(); host.hostMove(0); host.hostForfeit();
    expect(host.state).toBe(guestTurn);
    guest.emit("data", action(host, "move", { tokenIndex: 1.5 }));
    expect(host.state?.activePlayerIndex).toBe(1);
    // A malformed packet disconnects the channel, but a valid resume keeps the seat.
    const replacement = attach(peer, "Same", { resume: resumeOf(guest) });
    const stale = { t: "forfeit", matchId: host.state!.id, expectedRevision: host.state!.revision - 1 };
    const before = host.state;
    replacement.emit("data", stale);
    expect(host.state).toBe(before);
    replacement.emit("data", action(host, "forfeit"));
    expect(host.state?.activePlayerIndex).toBe(0);
    host.close();
  });
  it("reserves a dropped lobby seat briefly, blocks starting, then frees the slot", () => {
    const { host, peer } = openHost();
    const guest = attach(peer); guest.close();
    expect(host.players[1].connection).toBe("reconnecting");
    expect(host.startMatch()).toBe(false);
    vi.advanceTimersByTime(90_000);
    expect(host.players).toHaveLength(1);
    host.close();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects an expired reservation clearly and permits a fresh lobby seat", () => {
    const { host, peer } = openHost();
    const first = attach(peer); const resume = resumeOf(first); first.close();
    vi.advanceTimersByTime(90_000);
    const expired = attach(peer, "Same", { resume });
    expect(expired.sent).toContainEqual({ t: "rejected", text: "Seat resume expired or invalid. Ask the host for a new seat." });
    expect(accepted(attach(peer)).seatKey).not.toBe(resume.seatKey);
    host.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("updates match presence and resumes before grace expiry", () => {
    const { host, peer } = openHost();
    const guest = attach(peer); host.startMatch(); guest.close();
    expect(host.state?.players[1].connection).toBe("reconnecting");
    const replacement = attach(peer, "Same", { resume: resumeOf(guest) });
    expect(host.state?.players[1].connection).toBe("ready");
    expect(replacement.sent.some((m) => m.t === "snapshot")).toBe(true);
    replacement.emit("data", { t: "leave" });
    expect(host.state?.players[1].connection).toBe("offline");
    host.close();
  });
  it("removes channels and credentials on kick and ignores their later callbacks", () => {
    const { host, peer } = openHost(); const guest = attach(peer);
    const resume = resumeOf(guest); host.removeSeat(resume.seatKey);
    expect(guest.close).toHaveBeenCalled();
    guest.emit("data", { t: "join", name: "Late" });
    expect(host.players).toHaveLength(1);
    expect(accepted(attach(peer, "Same", { resume }))).toBeUndefined();
    host.close();
  });
  it("cleans and restarts bot timers without old-match actions", () => {
    const { host } = openHost(); host.addBot(); host.startMatch(); host.hostForfeit();
    expect(host.state?.players[host.state.activePlayerIndex].isBot).toBe(true);
    host.restartMatch();
    const restarted = host.state;
    vi.advanceTimersByTime(800);
    expect(host.state).toBe(restarted);
    host.hostForfeit();
    const botTurn = host.state;
    vi.advanceTimersByTime(750);
    expect(host.state).not.toBe(botTurn);
    const onState = vi.fn(); host.onState = onState; host.close();
    vi.advanceTimersByTime(120_000);
    expect(onState).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds handshakes and opening failures and ignores callbacks after close", () => {
    const host = new PeerLudoHost("12345", "Host"); const error = vi.fn(); host.onError = error; host.open();
    const old = lastPeer(); vi.advanceTimersByTime(15_000);
    expect(error).toHaveBeenCalledOnce(); expect(old.destroy).toHaveBeenCalled();
    const onLobby = vi.fn(); host.onLobby = onLobby; old.emit("open");
    expect(onLobby).not.toHaveBeenCalled();
    const current = openHost();
    const connections = Array.from({ length: 13 }, () => { const c = new mocks.Connection(); current.peer.emit("connection", c); return c; });
    expect(connections[12].close).toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(connections.every((c) => c.close.mock.calls.length > 0)).toBe(true);
    current.host.close();
  });
});

describe("hook room lifecycle", () => {
  it("ignores callbacks from replaced hosts and after unmount", () => {
    const hosts: PeerLudoHost[] = [];
    vi.spyOn(PeerLudoHost.prototype, "open").mockImplementation(function (this: PeerLudoHost) { hosts.push(this); });
    const { result, unmount } = renderHook(() => usePeerLudo());
    act(() => result.current.hostRoom("12345", "Same"));
    act(() => result.current.hostRoom("23456", "Same"));
    act(() => {
      hosts[0].onLobby([]); hosts[0].onNotice("old"); hosts[0].onError("old"); hosts[0].onClosed();
    });
    expect(result.current.status).toBe("connecting");
    expect(result.current.error).toBeNull();
    expect(result.current.notice).not.toBe("old");
    expect(result.current.lobbyPlayers).toHaveLength(1);
    unmount();
    hosts[1].onError("late"); hosts[1].onLobby([]);
    expect(result.current.error).toBeNull();
  });
  it("uses assigned seats for duplicate names and forgets rejected resume credentials", () => {
    const { result } = renderHook(() => usePeerLudo());
    act(() => result.current.joinRoom("12345", "Same", "b".repeat(48)));
    const first = lastPeer();
    act(() => {
      first.emit("open"); first.outgoing.emit("open");
      first.outgoing.emit("data", { t: "accepted", roomCode: "12345", seatKey: "mine", resumeToken: "a".repeat(48) });
      first.outgoing.emit("data", { t: "lobby", roomCode: "12345", hostName: "Same", players: [
        { seatKey: "host-seat", name: "Same", color: "red", isBot: false, connection: "ready" },
        { seatKey: "mine", name: "Same", color: "blue", isBot: false, connection: "ready" },
      ] });
      first.outgoing.close();
    });
    expect(result.current.mySeatKey).toBe("mine");
    act(() => result.current.reconnect());
    const second = lastPeer();
    act(() => { second.emit("open"); second.outgoing.emit("open"); });
    expect(second.outgoing.sent[0]).toMatchObject({ inviteSecret: "b".repeat(48), resume: { seatKey: "mine" } });
    act(() => second.outgoing.emit("data", { t: "rejected", text: "Seat resume expired or invalid. Ask the host for a new seat." }));
    expect(result.current.status).toBe("closed");
    expect(result.current.error).toContain("expired");
    expect(result.current.mySeatKey).toBeNull();
    act(() => result.current.reconnect());
    const third = lastPeer();
    act(() => { third.emit("open"); third.outgoing.emit("open"); });
    expect(third.outgoing.sent[0].resume).toBeUndefined();
    act(() => { first.outgoing.emit("data", { t: "rejected", text: "old" }); });
    expect(result.current.error).toBeNull();
  });
});

describe("guest room lifecycle", () => {
  it("does not notify connected when assignment closes the guest", () => {
    const guest = new PeerLudoGuest("12345", "Same");
    guest.onAssigned = () => guest.close();
    guest.onConnected = vi.fn();
    guest.connect(); const peer = lastPeer(); peer.emit("open"); peer.outgoing.emit("open");
    peer.outgoing.emit("data", { t: "accepted", roomCode: "12345", seatKey: "one", resumeToken: "a".repeat(48) });
    expect(guest.onConnected).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reports connected only after explicit seat assignment and ignores stale peers", () => {
    const guest = new PeerLudoGuest("12345", "Same");
    const assigned = vi.fn(); const connected = vi.fn(); const closed = vi.fn();
    guest.onAssigned = assigned; guest.onConnected = connected; guest.onClosed = closed;
    guest.connect(); const old = lastPeer(); old.emit("open"); old.outgoing.emit("open");
    expect(connected).not.toHaveBeenCalled();
    old.outgoing.emit("data", { t: "accepted", roomCode: "12345", seatKey: "seat-one", resumeToken: "a".repeat(48) });
    expect(assigned).toHaveBeenCalledWith({ seatKey: "seat-one", resumeToken: "a".repeat(48) });
    expect(connected).toHaveBeenCalledOnce();
    guest.connect(); old.emit("error", {}); old.outgoing.emit("close");
    expect(closed).not.toHaveBeenCalled();
    const current = lastPeer(); current.emit("open"); current.outgoing.emit("open");
    expect(current.outgoing.sent[0].resume.seatKey).toBe("seat-one");
    guest.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("times out missing admission and stops after silence", () => {
    const guest = new PeerLudoGuest("12345", "Same"); const closed = vi.fn(); guest.onClosed = closed;
    guest.connect(); vi.advanceTimersByTime(15_000);
    expect(closed).toHaveBeenCalledOnce();
    guest.connect(); const peer = lastPeer(); peer.emit("open"); peer.outgoing.emit("open");
    peer.outgoing.emit("data", { t: "accepted", roomCode: "12345", seatKey: "one", resumeToken: "a".repeat(48) });
    vi.advanceTimersByTime(40_000);
    expect(closed).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores older snapshots and sends revision-bound intents without dice/time", () => {
    const guest = new PeerLudoGuest("12345", "Same"); const onState = vi.fn(); guest.onState = onState;
    guest.connect(); const peer = lastPeer(); peer.emit("open"); peer.outgoing.emit("open");
    peer.outgoing.emit("data", { t: "accepted", roomCode: "12345", seatKey: "one", resumeToken: "a".repeat(48) });
    const state = createGame({ id: "match", mode: "online", players: [
      { id: "one", name: "Same", color: "red", isBot: false, connection: "ready" },
      { id: "two", name: "Same", color: "blue", isBot: false, connection: "ready" },
    ] });
    peer.outgoing.emit("data", { t: "snapshot", state: { ...state, revision: 3 } });
    peer.outgoing.emit("data", { t: "snapshot", state: { ...state, revision: 2 } });
    expect(onState).toHaveBeenCalledOnce();
    guest.roll();
    expect(peer.outgoing.sent.at(-1)).toEqual({ t: "roll", matchId: "match", expectedRevision: 3 });
    guest.close();
  });
});
