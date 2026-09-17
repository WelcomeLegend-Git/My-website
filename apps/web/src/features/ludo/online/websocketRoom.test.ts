import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../game/engine";
import { LudoSocketRoom } from "./websocketRoom";
import type { LudoNetworkIntent } from "./protocol";

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  sent: string[] = [];
  listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();
  constructor(readonly url: string) { Socket.instances.push(this); }
  addEventListener(name: string, fn: (event: { data?: unknown }) => void) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
  emit(name: string, data?: unknown) { for (const fn of this.listeners.get(name) ?? []) fn({ data }); }
  send = vi.fn((value: string) => { this.sent.push(value); });
  close = vi.fn(() => { this.readyState = 3; this.emit("close"); });
  open() { this.readyState = 1; this.emit("open"); }
  message(value: unknown) { this.emit("message", JSON.stringify(value)); }
}
const player = { id: "one", name: "One", color: "red" as const, isBot: false, connection: "ready" as const };
const snapshot = () => createGame({ id: "match", mode: "online", players: [player, { ...player, id: "two", name: "Two", color: "blue" }] });
const authenticated = { type: "AUTHENTICATED", roomCode: "12345", player, serverTime: 1 };
const setup = () => {
  const options = { endpoint: "wss://example.com/ws/ludo", roomCode: "12345", identity: { guestId: "guest", sessionToken: "token", displayName: "One" }, onSnapshot: vi.fn(), onPresence: vi.fn(), onPing: vi.fn(), onError: vi.fn(), onAuthenticated: vi.fn() };
  const room = new LudoSocketRoom(options); room.connect();
  const socket = Socket.instances[Socket.instances.length - 1];
  return { room, socket, options };
};
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("future WebSocket adapter defensive lifecycle", () => {
  it("gates intents on authentication and rejects dice/time at the actual send boundary", () => {
    const { room, socket, options } = setup(); socket.open();
    room.sendIntent({ type: "ROLL" }, 0);
    expect(socket.sent.map((s) => JSON.parse(s).type)).toEqual(["AUTH"]);
    socket.message(authenticated);
    expect(options.onAuthenticated).toHaveBeenCalledWith(player);
    room.sendIntent({ type: "ROLL", value: 6, now: 1 } as unknown as LudoNetworkIntent, 0);
    expect(options.onError).toHaveBeenCalledWith("Invalid outgoing game message.");
    expect(socket.sent.some((s) => JSON.parse(s).type === "INTENT")).toBe(false);
    room.sendIntent({ type: "ROLL" }, 0);
    expect(JSON.parse(socket.sent[socket.sent.length - 1])).toEqual({ type: "INTENT", intent: { type: "ROLL" }, expectedRevision: 0 });
    room.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores callbacks from replaced sockets and never reconnects after owner close", () => {
    const { room, socket, options } = setup(); room.connect();
    const next = Socket.instances[1]; next.open(); next.message(authenticated);
    socket.open(); socket.message({ type: "SNAPSHOT", state: snapshot(), serverTime: 1 }); socket.emit("error"); socket.emit("close");
    expect(options.onSnapshot).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
    expect(next.sent.map((s) => JSON.parse(s).type)).toEqual(["AUTH", "REJOIN"]);
    room.close(); next.emit("close"); next.emit("error");
    vi.advanceTimersByTime(120_000);
    expect(Socket.instances).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a queued reconnect when connect is called explicitly", () => {
    const { room, socket } = setup(); socket.emit("error");
    room.connect(); const replacement = Socket.instances[1]; replacement.open();
    vi.advanceTimersByTime(750);
    expect(Socket.instances).toHaveLength(2);
    expect(replacement.close).not.toHaveBeenCalled();
    room.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("does not report authentication after REJOIN fails", () => {
    const { room, socket, options } = setup(); socket.open();
    socket.send.mockImplementation(() => { throw new Error("network"); });
    socket.message(authenticated);
    expect(options.onAuthenticated).not.toHaveBeenCalled();
    expect(options.onError).toHaveBeenCalledWith("Sending to the game failed.");
    room.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds missing authentication and retries even if error emits no close", () => {
    const { room, socket } = setup(); socket.open(); vi.advanceTimersByTime(15_000);
    expect(socket.close).toHaveBeenCalledOnce(); vi.advanceTimersByTime(750);
    expect(Socket.instances).toHaveLength(2);
    const second = Socket.instances[1]; second.emit("error"); second.emit("close");
    vi.advanceTimersByTime(1500);
    expect(Socket.instances).toHaveLength(3);
    room.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("does not reset retry count on open/auth without a usable snapshot", () => {
    const { room, options } = setup();
    for (let attempt = 0; attempt <= 8; attempt++) {
      const socket = Socket.instances[Socket.instances.length - 1]; socket.open(); socket.message(authenticated);
      vi.advanceTimersByTime(15_000);
      if (attempt < 8) vi.advanceTimersByTime(Math.min(12_000, 750 * 2 ** attempt));
    }
    expect(Socket.instances).toHaveLength(9);
    expect(options.onError).toHaveBeenLastCalledWith("Connection lost after 8 retries. Reconnect manually to try again.");
    expect(vi.getTimerCount()).toBe(0); room.close();
  });
  it("rejects stale snapshots, correlates pong, and detects heartbeat silence", () => {
    const { room, socket, options } = setup(); socket.open(); socket.message(authenticated);
    socket.message({ type: "SNAPSHOT", state: { ...snapshot(), revision: 2 }, serverTime: 1 });
    socket.message({ type: "SNAPSHOT", state: { ...snapshot(), revision: 1 }, serverTime: 1 });
    expect(options.onSnapshot).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(20_000);
    const ping = JSON.parse(socket.sent[socket.sent.length - 1]);
    socket.message({ type: "PONG", sentAt: ping.sentAt - 1, serverTime: 1 });
    expect(options.onPing).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40_000);
    expect(socket.close).toHaveBeenCalled();
    room.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it("treats admission errors as terminal and handles send exceptions", () => {
    const { room, socket } = setup(); socket.open(); socket.message({ type: "ERROR", code: "INVITE_INVALID", message: "Invalid invite" });
    vi.advanceTimersByTime(120_000); expect(Socket.instances).toHaveLength(1);
    room.connect(); const next = Socket.instances[1]; next.open(); next.message(authenticated);
    next.send.mockImplementation(() => { throw new Error("network"); });
    expect(() => room.ready(0)).not.toThrow();
    vi.advanceTimersByTime(750); expect(Socket.instances).toHaveLength(3);
    room.close();
  });
});
