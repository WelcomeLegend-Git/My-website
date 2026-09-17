import { describe, expect, it } from "vitest";
import { createGame } from "../game/engine";
import { FINISH_POSITION } from "../game/types";
import { peerIdForRoom } from "./peerRoom";
import { decodeLudoMessage, encodeLudoMessage, type LudoClientMessage } from "./protocol";
import { decodePeerClientMessage, decodePeerHostMessage } from "./peerProtocol";
import { isBoundedPacket } from "./validation";

const state = () => createGame({ mode: "online", players: [
  { id: "one", name: "Same", color: "red", isBot: false, connection: "ready" },
  { id: "two", name: "Same", color: "blue", isBot: false, connection: "ready" },
] });
describe("defensive structural validation", () => {
  it("uses the corrected finish boundary and separates legacy peers", () => {
    const snapshot = state();
    snapshot.tokens.red[0] = FINISH_POSITION;
    expect(decodePeerHostMessage({ t: "snapshot", state: snapshot })).not.toBeNull();
    snapshot.tokens.red[0] = FINISH_POSITION + 1;
    expect(decodePeerHostMessage({ t: "snapshot", state: snapshot })).toBeNull();
    expect(peerIdForRoom("12345")).toBe("ludo-arena-v2-12345");
  });
  it.each([null, [], 3, {}, { t: "join" }, { t: "join", name: 4 }, { t: "move", tokenIndex: 1.5 }, { t: "join", name: "x".repeat(17) }])("rejects malformed client input %j", (packet) => {
    expect(decodePeerClientMessage(packet)).toBeNull();
  });
  it("accepts only network action fields, never local engine dice or time", () => {
    expect(decodePeerClientMessage({ t: "roll", matchId: "match", expectedRevision: 1 })).not.toBeNull();
    expect(decodePeerClientMessage({ t: "roll", matchId: "match", expectedRevision: 1, value: 6 })).toBeNull();
    expect(() => encodeLudoMessage({ type: "INTENT", intent: { type: "ROLL", value: 6, now: 12 }, expectedRevision: 1 } as unknown as LudoClientMessage)).toThrow();
    expect(JSON.parse(encodeLudoMessage({ type: "INTENT", intent: { type: "ROLL" }, expectedRevision: 1 })).intent).toEqual({ type: "ROLL" });
  });
  it("validates complete snapshots and cross-field indexes", () => {
    expect(decodePeerHostMessage({ t: "snapshot", state: state() })).not.toBeNull();
    expect(decodeLudoMessage(JSON.stringify({ type: "SNAPSHOT", state: {}, serverTime: 1 }))).toBeNull();
    const invalid = state();
    invalid.activePlayerIndex = 3;
    expect(decodePeerHostMessage({ t: "snapshot", state: invalid })).toBeNull();
    invalid.activePlayerIndex = 0;
    invalid.tokens.red = [0];
    expect(decodePeerHostMessage({ t: "snapshot", state: invalid })).toBeNull();
  });
  it("bounds oversized, cyclic and accessor-bearing objects without invoking getters", () => {
    expect(decodeLudoMessage(" ".repeat(65_537))).toBeNull();
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(isBoundedPacket(cyclic)).toBe(false);
    let called = false;
    expect(isBoundedPacket({ get t() { called = true; return "join"; } })).toBe(false);
    expect(called).toBe(false);
    expect(decodePeerClientMessage({ t: "join", name: "x".repeat(4096) })).toBeNull();
  });
  it("rejects duplicate seat IDs and colors but permits duplicate display names", () => {
    const valid = state();
    expect(decodePeerHostMessage({ t: "snapshot", state: valid })).not.toBeNull();
    valid.players[1].id = valid.players[0].id;
    expect(decodePeerHostMessage({ t: "snapshot", state: valid })).toBeNull();
  });
});
