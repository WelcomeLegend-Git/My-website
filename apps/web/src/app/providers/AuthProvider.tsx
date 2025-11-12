import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../../lib/auth-storage";
import { authStorage } from "../../lib/auth-storage";
import { trpc, refreshTokens } from "../../lib/trpc";

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

type Props = {
  children: React.ReactNode;
};

export const AuthProvider = ({ children }: Props) => {
  const initialState = authStorage.getState();
  const [user, setUser] = useState<AuthUser | null>(initialState.user);
  const [status, setStatus] = useState<AuthStatus>(determineInitialStatus(initialState));
  const queryClient = useQueryClient();

  const hasTokens = Boolean(authStorage.getAccessToken());
  const isGuest = user?.isGuest === true;

  const meQuery = trpc.authApi.me.useQuery(undefined, {
    enabled: hasTokens && !isGuest,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const refreshAttempted = useRef(false);

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
      const code = (meQuery.error as any)?.data?.code as string | undefined;
      const message = ((meQuery.error as any)?.message ?? "").toString();
      const isUnauthorized = code === "UNAUTHORIZED" || /unauthorized|401/i.test(message);

      if (isUnauthorized) {
        // Try refresh once before logging out
        if (!refreshAttempted.current && authStorage.getRefreshToken()) {
          refreshAttempted.current = true;
          (async () => {
            await refreshTokens();
            const token = authStorage.getAccessToken();
            if (token) {
              await meQuery.refetch();
              setStatus("authenticated");
            } else {
              authStorage.clear();
              setUser(null);
              setStatus("unauthenticated");
            }
          })();
        } else {
          authStorage.clear();
          setUser(null);
          setStatus("unauthenticated");
        }
      } else {
        // Transient/network error (e.g., backend waking up). Keep session.
        setStatus(authStorage.getAccessToken() && authStorage.getUser() ? "authenticated" : "loading");
      }
    }
  }, [meQuery.isSuccess, meQuery.isError, meQuery.data, isGuest]);

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