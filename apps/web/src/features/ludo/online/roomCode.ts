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
  else {
    console.warn("[Ludo] crypto.getRandomValues unavailable; falling back to Math.random for invite secrets.");
    bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

export const createRoomLink = (origin: string, roomCode: string, inviteSecret: string): string => {
  const url = new URL(`/ludo/room/${roomCode}`, origin);
  url.searchParams.set("invite", inviteSecret);
  return url.toString();
};

export const normaliseRoomCode = (value: string): string => value.replace(/\D/g, "").slice(0, 5);
