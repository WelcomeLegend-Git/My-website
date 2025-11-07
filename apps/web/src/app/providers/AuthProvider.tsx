import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../../lib/auth-storage";
import { authStorage } from "../../lib/auth-storage";
import { trpc } from "../../lib/trpc";

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

  trpc.auth.me.useQuery(undefined, {
    enabled: hasTokens,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      setUser(data);
      authStorage.setUser(data);
      setStatus("authenticated");
    },
    onError: () => {
      authStorage.clear();
      setUser(null);
      setStatus("unauthenticated");
    },
  });

  useEffect(() => {
    const unsubscribe = authStorage.subscribe((next) => {
      setUser(next.user);
      if (next.accessToken && next.user) {
        setStatus("authenticated");
      } else if (!next.accessToken) {
        setStatus("unauthenticated");
      }
    });
    return unsubscribe;
  }, []);

  const handleAuth = (payload: AuthPayload) => {
    authStorage.setAuth(payload);
    setUser(payload.user);
    setStatus("authenticated");
    queryClient.invalidateQueries();
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear();
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, handleAuth, logout }),
    [user, status]
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