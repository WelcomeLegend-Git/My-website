import { z } from "zod";
import { guestIdentitySchema, type LudoGuestIdentity } from "./protocol";
import { parsePacket } from "./validation";

const GUEST_STORAGE_KEY = "ludo-arena-guest-session";
const storedGuestSchema = guestIdentitySchema.extend({ expiresAt: z.string().max(64).refine((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now()) }).strict();
export interface CreateLudoGuestOptions { apiBaseUrl: string; displayName: string }
const getStoredGuest = (): z.infer<typeof storedGuestSchema> | null => {
  try {
    const raw = window.sessionStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw || raw.length > 8192) return null;
    return parsePacket(storedGuestSchema, JSON.parse(raw), 8192);
  } catch { return null; }
};

/** Separate server-issued Ludo session; never modifies the website login. */
export const ensureLudoGuestIdentity = async ({ apiBaseUrl, displayName }: CreateLudoGuestOptions): Promise<LudoGuestIdentity> => {
  const trimmedName = displayName.trim().slice(0, 16);
  if (!trimmedName) throw new Error("A display name is required to join a Ludo room.");
  const saved = getStoredGuest();
  if (saved?.displayName === trimmedName) return guestIdentitySchema.parse({ guestId: saved.guestId, sessionToken: saved.sessionToken, displayName: saved.displayName });
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/ludo/guests`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: trimmedName }), signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("Unable to create a temporary Ludo guest identity.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) { controller.abort(); throw new Error("The Ludo guest response is too large."); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error("The Ludo guest response is invalid."); }
    const guest = parsePacket(storedGuestSchema, raw, 8192);
    if (!guest || guest.displayName !== trimmedName) throw new Error("The Ludo guest response is invalid or expired.");
    try { window.sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest)); } catch { /* Storage is optional; the current session remains usable. */ }
    return { guestId: guest.guestId, sessionToken: guest.sessionToken, displayName: guest.displayName };
  } finally { window.clearTimeout(timer); }
};
export const clearLudoGuestIdentity = (): void => {
  try { window.sessionStorage.removeItem(GUEST_STORAGE_KEY); } catch { /* Storage may be disabled. */ }
};
