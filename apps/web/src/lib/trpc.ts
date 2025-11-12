import type { AppRouter } from "@jee/server/trpc/root";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { authStorage } from "./auth-storage";
import { getApiBaseUrl } from "./env";

const apiUrl = `${getApiBaseUrl()}/trpc`;

const headersToObject = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
};

const decodeTrpcResponse = (payload: unknown) => {
  const envelope = Array.isArray(payload) ? payload[0] : payload;
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Unexpected tRPC response");
  }
  if ("error" in envelope && envelope.error) {
    const message = (envelope as { error: { message?: string } }).error?.message ?? "Unknown error";
    throw new Error(message);
  }
  const result = (envelope as { result?: { data?: { json?: unknown } } }).result;
  if (!result?.data) {
    throw new Error("Missing data in tRPC response");
  }
  return result.data.json as { accessToken: string; refreshToken: string };
};

let refreshPromise: Promise<void> | null = null;

const performTokenRefresh = async () => {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) {
    authStorage.clear();
    return;
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: 1,
      method: "mutation",
      params: {
        path: "authApi.refresh",
        input: { refreshToken },
      },
    }),
  });

  if (!response.ok) {
    authStorage.clear();
    throw new Error("Failed to refresh token");
  }

  const payload = await response.json();
  const result = decodeTrpcResponse(payload);
  authStorage.setTokens(result);
};

const ensureFreshTokens = async () => {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().catch((error) => {
      authStorage.clear();
      throw error;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const customFetch: typeof fetch = async (input, init) => {
  const originalResponse = await fetch(input, init);
  if (originalResponse.status !== 401 || !authStorage.getRefreshToken()) {
    return originalResponse;
  }

  try {
    await ensureFreshTokens();
  } catch {
    return originalResponse;
  }

  const headersObject = headersToObject(init?.headers);
  const nextToken = authStorage.getAccessToken();
  if (!nextToken) {
    return originalResponse;
  }
  headersObject.Authorization = `Bearer ${nextToken}`;

  const retryInit: RequestInit = {
    ...init,
    headers: headersObject,
  };

  return fetch(input, retryInit);
};

export const trpc = createTRPCReact<AppRouter>();

export const createTrpcClient = () =>
  trpc.createClient({
    links: [
      loggerLink({ enabled: () => import.meta.env.DEV }),
      httpBatchLink({
        url: apiUrl,
        fetch: customFetch,
        headers() {
          const token = authStorage.getAccessToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });