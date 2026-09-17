import { describe, expect, it } from "vitest";
import { parseRoomAdmission } from "./roomCode";

const secret = "a".repeat(48);
describe("room admission", () => {
  it("keeps legacy code-only admission explicit", () => {
    expect(parseRoomAdmission("12345")).toEqual({ roomCode: "12345", inviteSecret: undefined });
  });
  it("extracts the room and secret from a share URL", () => {
    expect(parseRoomAdmission(`https://example.com/ludo/room/12345?invite=${secret}`))
      .toEqual({ roomCode: "12345", inviteSecret: secret });
  });
  it("rejects malformed secrets and ambiguous links", () => {
    expect(() => parseRoomAdmission("12345", "short")).toThrow();
    expect(() => parseRoomAdmission(`https://example.com/ludo/room/12345?invite=${secret}&invite=${secret}`)).toThrow();
  });
});
