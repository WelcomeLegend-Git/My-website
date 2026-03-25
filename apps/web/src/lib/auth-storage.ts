type AuthUser = {
  id: string;
  email: string;
  name: string;
  isGuest?: boolean;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  updatedAt: number;
};

const storageKey = "jee-companion-auth";
const guestStorageKey = "jee-companion-guest";

const listeners = new Set<(state: AuthState) => void>();

const emptyState: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  updatedAt: Date.now(),
};

const readStorage = (): AuthState => {
  if (typeof window === "undefined") {
    return emptyState;
  }
  try {
    // Check local storage for regular auth FIRST (takes priority over guest)
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthState;
      // If we have a real user (not guest), use it and clear any stale guest session
      if (parsed.user && !parsed.user.isGuest) {
        window.sessionStorage.removeItem(guestStorageKey);
        return {
          accessToken: parsed.accessToken ?? null,
          refreshToken: parsed.refreshToken ?? null,
          user: parsed.user ?? null,
          updatedAt: parsed.updatedAt ?? Date.now(),
        };
      }
    }

    // Fallback to session storage for guest
    const guestRaw = window.sessionStorage.getItem(guestStorageKey);
    if (guestRaw) {
      const parsed = JSON.parse(guestRaw) as AuthState;
      return {
        accessToken: parsed.accessToken ?? null,
        refreshToken: parsed.refreshToken ?? null,
        user: parsed.user ?? null,
        updatedAt: parsed.updatedAt ?? Date.now(),
      };
    }
    
    return emptyState;
  } catch {
    return emptyState;
  }
};

let inMemoryState = readStorage();

const persist = (state: AuthState) => {
  inMemoryState = state;
  if (typeof window !== "undefined") {
    // Use sessionStorage for guest users, localStorage for regular users
    if (state.user?.isGuest) {
      window.sessionStorage.setItem(guestStorageKey, JSON.stringify(state));
      window.localStorage.removeItem(storageKey); // Clear any existing regular auth
    } else if (state.user) {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      window.sessionStorage.removeItem(guestStorageKey); // Clear any existing guest auth
    } else {
      // Clear both if logging out
      window.localStorage.removeItem(storageKey);
      window.sessionStorage.removeItem(guestStorageKey);
    }
  }
  listeners.forEach((listener) => listener(state));
};

export const authStorage = {
  getState: () => inMemoryState,
  getAccessToken: () => inMemoryState.accessToken,
  getRefreshToken: () => inMemoryState.refreshToken,
  getUser: () => inMemoryState.user,
  setAuth: ({ accessToken, refreshToken, user }: { accessToken: string; refreshToken: string; user: AuthUser }) => {
    persist({ accessToken, refreshToken, user, updatedAt: Date.now() });
  },
  setTokens: ({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => {
    persist({ ...inMemoryState, accessToken, refreshToken, updatedAt: Date.now() });
  },
  setUser: (user: AuthUser | null) => {
    persist({ ...inMemoryState, user, updatedAt: Date.now() });
  },
  clear: () => persist({ ...emptyState, updatedAt: Date.now() }),
  setGuestMode: () => {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const guestUser: AuthUser = {
      id: guestId,
      email: `${guestId}@guest.local`,
      name: "Guest User",
      isGuest: true,
    };
    const guestToken = `guest_token_${Date.now()}`;
    persist({
      accessToken: guestToken,
      refreshToken: guestToken,
      user: guestUser,
      updatedAt: Date.now(),
    });
  },
  subscribe: (listener: (state: AuthState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export type { AuthUser, AuthState };