import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient, createAsyncStoragePersister } from "@tanstack/react-query-persist-client";
import localforage from "localforage";
import { useEffect, useMemo, useState } from "react";
import { trpc, createTrpcClient } from "../../lib/trpc";
import { AuthProvider } from "./AuthProvider";

type Props = {
  children: React.ReactNode;
};

// Create persister lazily to avoid test/runtime import mismatches
const createPersister = () =>
  createAsyncStoragePersister({
    storage: {
      getItem: (key) => localforage.getItem<string>(key),
      setItem: (key, value) => localforage.setItem(key, value),
      removeItem: (key) => localforage.removeItem(key),
    },
    throttleTime: 1000,
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
    const canPersist = typeof window !== "undefined" && typeof createAsyncStoragePersister === "function";
    if (!canPersist) return;

    const persister = createPersister();
    persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 }).catch((error) => {
      console.warn("Failed to hydrate persisted queries", error);
    });

    return () => {
      try {
        const p = createPersister();
        // @ts-expect-error removeClient may not exist depending on version typings
        p.removeClient?.();
      } catch {
        // ignore
      }
    };
  }, [queryClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};