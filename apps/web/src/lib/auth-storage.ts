type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  updatedAt: number;
};

const storageKey = "jee-companion-auth";

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
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return emptyState;
    }
    const parsed = JSON.parse(raw) as AuthState;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null,
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return emptyState;
  }
};

let inMemoryState = readStorage();

const persist = (state: AuthState) => {
  inMemoryState = state;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
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
  subscribe: (listener: (state: AuthState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export type { AuthUser, AuthState };