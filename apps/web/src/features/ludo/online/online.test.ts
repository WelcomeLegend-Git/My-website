import { describe, expect, it } from "vitest";

import type { LudoGameState, LudoPlayer } from "../game/types";
import { encodeLudoMessage, decodeLudoMessage } from "./protocol";
import type { LudoClientMessage, LudoServerMessage } from "./protocol";
import { generateRoomCode, generateInviteSecret, normaliseRoomCode, createRoomLink } from "./roomCode";

/* ================================================================
 *  PROTOCOL CODEC TESTS
 * ================================================================ */

describe("Ludo protocol codec", () => {
  it("encodeLudoMessage produces valid JSON", () => {
    const msg: LudoClientMessage = { type: "PING", sentAt: 1234 };
    const encoded = encodeLudoMessage(msg);
    expect(() => JSON.parse(encoded)).not.toThrow();
    const parsed = JSON.parse(encoded);
    expect(parsed.type).toBe("PING");
    expect(parsed.sentAt).toBe(1234);
  });

  it("decodeLudoMessage roundtrips a SNAPSHOT message", () => {
    const serverMsg: LudoServerMessage = {
      type: "SNAPSHOT",
      state: {} as unknown as LudoGameState,
      serverTime: Date.now(),
    };
    const json = JSON.stringify(serverMsg);
    const decoded = decodeLudoMessage(json);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("SNAPSHOT");
  });

  it("decodeLudoMessage roundtrips a PONG message", () => {
    const serverMsg: LudoServerMessage = { type: "PONG", sentAt: 100, serverTime: 200 };
    const decoded = decodeLudoMessage(JSON.stringify(serverMsg));
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("PONG");
  });

  it("decodeLudoMessage roundtrips an ERROR message", () => {
    const serverMsg: LudoServerMessage = { type: "ERROR", code: "ROOM_NOT_FOUND", message: "Not found" };
    const decoded = decodeLudoMessage(JSON.stringify(serverMsg));
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("ERROR");
  });

  it("decodeLudoMessage accepts AUTHENTICATED messages", () => {
    const serverMsg: LudoServerMessage = {
      type: "AUTHENTICATED",
      player: {} as unknown as LudoPlayer,
      roomCode: "12345",
      serverTime: 100,
    };
    const decoded = decodeLudoMessage(JSON.stringify(serverMsg));
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("AUTHENTICATED");
  });

  it("decodeLudoMessage accepts PRESENCE messages", () => {
    const serverMsg: LudoServerMessage = { type: "PRESENCE", players: [], serverTime: 100 };
    const decoded = decodeLudoMessage(JSON.stringify(serverMsg));
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe("PRESENCE");
  });

  it("decodeLudoMessage returns null for invalid JSON", () => {
    expect(decodeLudoMessage("not json")).toBeNull();
  });

  it("decodeLudoMessage returns null for missing type", () => {
    expect(decodeLudoMessage(JSON.stringify({ data: 123 }))).toBeNull();
  });

  it("decodeLudoMessage returns null for non-string type", () => {
    expect(decodeLudoMessage(JSON.stringify({ type: 42 }))).toBeNull();
  });

  it("decodeLudoMessage rejects unknown server message types", () => {
    expect(decodeLudoMessage(JSON.stringify({ type: "HACK_STATE" }))).toBeNull();
    expect(decodeLudoMessage(JSON.stringify({ type: "ROLL" }))).toBeNull();
    expect(decodeLudoMessage(JSON.stringify({ type: "MOVE" }))).toBeNull();
  });
});

/* ================================================================
 *  ROOM CODE TESTS
 * ================================================================ */

describe("Ludo room codes", () => {
  it("generateRoomCode returns a 5-digit string", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^\d{5}$/);
  });

  it("generateRoomCode produces different codes (probabilistic)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it("generateRoomCode always returns codes >= 10000", () => {
    for (let i = 0; i < 50; i++) {
      const num = parseInt(generateRoomCode(), 10);
      expect(num).toBeGreaterThanOrEqual(10000);
      expect(num).toBeLessThanOrEqual(99999);
    }
  });

  it("generateInviteSecret returns a 48-character hex string", () => {
    const secret = generateInviteSecret();
    expect(secret).toMatch(/^[0-9a-f]{48}$/);
  });

  it("generateInviteSecret produces unique values", () => {
    const secrets = new Set(Array.from({ length: 10 }, () => generateInviteSecret()));
    expect(secrets.size).toBe(10);
  });

  it("normaliseRoomCode strips non-digit characters", () => {
    expect(normaliseRoomCode("ab1c2d3e4f5")).toBe("12345");
  });

  it("normaliseRoomCode limits to 5 digits", () => {
    expect(normaliseRoomCode("123456789")).toBe("12345");
  });

  it("normaliseRoomCode handles empty input", () => {
    expect(normaliseRoomCode("")).toBe("");
  });

  it("normaliseRoomCode handles all non-digit input", () => {
    expect(normaliseRoomCode("abcdef")).toBe("");
  });

  it("createRoomLink generates a valid URL", () => {
    const link = createRoomLink("https://example.com", "12345", "abc123");
    expect(link).toBe("https://example.com/ludo/room/12345?invite=abc123");
  });

  it("createRoomLink with trailing slash origin", () => {
    const link = createRoomLink("https://example.com/", "99999", "secret");
    expect(link).toContain("/ludo/room/99999");
    expect(link).toContain("invite=secret");
  });
});
