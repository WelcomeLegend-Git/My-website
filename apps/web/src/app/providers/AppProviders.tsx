import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient, type Persister, type PersistedClient } from "@tanstack/react-query-persist-client";
import localforage from "localforage";
import { useEffect, useState } from "react";
import { trpc, createTrpcClient } from "../../lib/trpc";
import { AuthProvider } from "./AuthProvider";

type Props = {
  children: React.ReactNode;
};

// Google OAuth Client ID – read from env or use the production ID
const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  "91784602884-8jgha0g6343tplaf50oc3lemcuiinsdg.apps.googleusercontent.com";

// Create persister lazily to avoid test/runtime import mismatches
const createPersister = (): Persister => ({
  persistClient: async (client: PersistedClient) => {
    await localforage.setItem("REACT_QUERY_CACHE", client);
  },
  restoreClient: async () => {
    const result = await localforage.getItem<PersistedClient>("REACT_QUERY_CACHE");
    return result ?? undefined;
  },
  removeClient: async () => {
    await localforage.removeItem("REACT_QUERY_CACHE");
  },
});

export const AppProviders = ({ children }: Props) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 2,
            refetchOnWindowFocus: false,
            gcTime: 1000 * 60 * 60,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  const [trpcClient] = useState(() => createTrpcClient());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const persister = createPersister();
    const [unsubscribe, promise] = persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 });
    
    promise.catch((error: unknown) => {
      console.warn("Failed to hydrate persisted queries", error);
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GoogleOAuthProvider>
  );
};