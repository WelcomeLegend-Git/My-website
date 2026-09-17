const randomUint32 = (): number => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  }
  console.warn("[Ludo] crypto.getRandomValues unavailable; falling back to Math.random for room codes.");
  return Math.floor(Math.random() * 0xffffffff);
};

/** A convenient five-digit display code. The server must still collision-check it. */
export const generateRoomCode = (): string => String((randomUint32() % 90_000) + 10_000);

/** A private invite secret paired with the short display code. */
export const generateInviteSecret = (): string => {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else throw new Error("Secure randomness is required for private invites and seat resume tokens.");

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

export const createRoomLink = (origin: string, roomCode: string, inviteSecret: string): string => {
  const url = new URL(`/ludo/room/${roomCode}`, origin);
  url.searchParams.set("invite", inviteSecret);
  return url.toString();
};

export const normaliseRoomCode = (value: string): string => value.slice(0, 2048).replace(/\D/g, "").slice(0, 5);

/** Code-only rooms are public to anyone with the code unless the host sets a secret. */
export const parseRoomAdmission = (input: string, inviteSecret?: string): { roomCode: string; inviteSecret?: string } => {
  if (typeof input !== "string" || input.length > 2048) throw new Error("Enter a five-digit code or a Ludo share link.");
  let roomCode = input.trim();
  if (!/^\d{5}$/.test(roomCode)) {
    let url: URL;
    try { url = new URL(roomCode); } catch { throw new Error("Enter a five-digit code or a Ludo share link."); }
    const match = /^\/ludo\/room\/(\d{5})\/?$/.exec(url.pathname);
    if (!match || !["https:", "http:"].includes(url.protocol) || url.searchParams.getAll("invite").length > 1) {
      throw new Error("Invalid Ludo share link.");
    }
    roomCode = match[1];
    const linkedSecret = url.searchParams.get("invite") ?? undefined;
    if (inviteSecret && linkedSecret && inviteSecret !== linkedSecret) throw new Error("Conflicting invite secrets.");
    inviteSecret ??= linkedSecret;
  }
  if (inviteSecret !== undefined && !/^[a-f0-9]{48}$/.test(inviteSecret)) throw new Error("Invalid invite secret.");
  return { roomCode, inviteSecret };
};
