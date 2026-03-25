import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../../lib/auth-storage";
import { authStorage } from "../../lib/auth-storage";
import { trpc } from "../../lib/trpc";
import { getApiBaseUrl } from "../../lib/env";

type AuthPayload = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  handleAuth: (payload: AuthPayload) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const determineInitialStatus = (tokens: { accessToken: string | null; user: AuthUser | null }): AuthStatus => {
  if (tokens.accessToken && tokens.user) {
    return "authenticated";
  }
  if (tokens.accessToken) {
    return "loading";
  }
  return "unauthenticated";
};

// Proactively refresh tokens on app startup if we have a refresh token
async function proactiveTokenRefresh(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken || refreshToken.startsWith("guest_token_")) return false;

  try {
    const apiUrl = `${getApiBaseUrl()}/trpc`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{
        id: 1,
        json: { input: { refreshToken } },
        method: "mutation",
        path: "authApi.refresh",
      }]),
    });

    if (!response.ok) return false;

    const payload = await response.json();
    const envelope = Array.isArray(payload) ? payload[0] : payload;
    if (!envelope?.result?.data?.json) return false;

    const result = envelope.result.data.json as { accessToken: string; refreshToken: string };
    authStorage.setTokens(result);
    return true;
  } catch {
    return false;
  }
}

type Props = {
  children: React.ReactNode;
};

export const AuthProvider = ({ children }: Props) => {
  const initialState = authStorage.getState();
  const [user, setUser] = useState<AuthUser | null>(initialState.user);
  const [status, setStatus] = useState<AuthStatus>(determineInitialStatus(initialState));
  const [refreshDone, setRefreshDone] = useState(false);
  const queryClient = useQueryClient();

  const hasTokens = Boolean(authStorage.getAccessToken());
  const isGuest = user?.isGuest === true;

  // Proactively refresh tokens on mount (before meQuery runs)
  useEffect(() => {
    if (!hasTokens || isGuest) {
      setRefreshDone(true);
      return;
    }

    proactiveTokenRefresh().finally(() => {
      setRefreshDone(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const meQuery = trpc.authApi.me.useQuery(undefined, {
    enabled: hasTokens && !isGuest && refreshDone,
    retry: 2,
    retryDelay: 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 mins
  });

  useEffect(() => {
    // For guest users, skip backend validation entirely
    if (isGuest) {
      setStatus("authenticated");
      return;
    }

    // For regular users, validate with backend
    if (meQuery.isSuccess && meQuery.data) {
      setUser(meQuery.data);
      authStorage.setUser(meQuery.data);
      setStatus("authenticated");
    } else if (meQuery.isError) {
      // Only clear if we've already tried refreshing
      if (refreshDone) {
        authStorage.clear();
        setUser(null);
        setStatus("unauthenticated");
      }
    }
  }, [meQuery.isSuccess, meQuery.isError, meQuery.data, isGuest, refreshDone]);

  useEffect(() => {
    const unsubscribe = authStorage.subscribe((next) => {
      setUser(next.user);
      if (next.accessToken && next.user) {
        setStatus("authenticated");
      } else if (!next.accessToken) {
        setStatus("unauthenticated");
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleAuth = useCallback((payload: AuthPayload) => {
    authStorage.setAuth(payload);
    setUser(payload.user);
    setStatus("authenticated");
    queryClient.invalidateQueries();
  }, [queryClient]);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, handleAuth, logout }),
    [user, status, handleAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};