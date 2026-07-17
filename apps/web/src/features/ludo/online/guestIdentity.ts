import type { LudoGuestIdentity } from "./protocol";

const GUEST_STORAGE_KEY = "ludo-arena-guest-session";

interface StoredLudoGuest extends LudoGuestIdentity {
  expiresAt: string;
}

export interface CreateLudoGuestOptions {
  apiBaseUrl: string;
  displayName: string;
}

const getStoredGuest = (): StoredLudoGuest | null => {
  try {
    const raw = window.sessionStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const guest = JSON.parse(raw) as StoredLudoGuest;
    return guest.expiresAt && Date.parse(guest.expiresAt) > Date.now() ? guest : null;
  } catch {
    return null;
  }
};

/**
 * Creates a Ludo-specific, server-issued guest identity. It intentionally does
 * not touch the website's normal auth storage, so an invitee cannot log out a
 * signed-in website user by joining a game.
 */
export const ensureLudoGuestIdentity = async ({ apiBaseUrl, displayName }: CreateLudoGuestOptions): Promise<LudoGuestIdentity> => {
  const trimmedName = displayName.trim().slice(0, 16);
  if (!trimmedName) throw new Error("A display name is required to join a Ludo room.");

  const saved = getStoredGuest();
  if (saved && saved.displayName === trimmedName) {
    return { guestId: saved.guestId, sessionToken: saved.sessionToken, displayName: saved.displayName };
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/ludo/guests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: trimmedName }),
  });
  if (!response.ok) throw new Error("Unable to create a temporary Ludo guest identity.");

  const guest = await response.json() as StoredLudoGuest;
  if (!guest.guestId || !guest.sessionToken || !guest.expiresAt) {
    throw new Error("The Ludo guest response is incomplete.");
  }

  window.sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
  return { guestId: guest.guestId, sessionToken: guest.sessionToken, displayName: guest.displayName };
};

export const clearLudoGuestIdentity = (): void => window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
