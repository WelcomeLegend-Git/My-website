import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient, createAsyncStoragePersister } from "@tanstack/react-query-persist-client";
import localforage from "localforage";
import { useEffect, useState } from "react";
import { trpc, createTrpcClient } from "../../lib/trpc";
import { AuthProvider } from "./AuthProvider";

type Props = {
  children: React.ReactNode;
};

const asyncPersister = createAsyncStoragePersister({
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
    persistQueryClient({
      queryClient,
      persister: asyncPersister,
      maxAge: 1000 * 60 * 60 * 24,
    }).catch((error) => {
      console.warn("Failed to hydrate persisted queries", error);
    });

    return () => {
      asyncPersister.removeClient?.();
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