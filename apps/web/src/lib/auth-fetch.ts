import { authStorage } from "./auth-storage";
import { getApiBaseUrl } from "./env";

const headersToObject = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
};

const decodeRefreshResponse = (payload: unknown) => {
  const envelope = Array.isArray(payload) ? payload[0] : payload;
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Unexpected token refresh response");
  }

  const result = (envelope as { result?: { data?: { json?: unknown } } }).result;
  if (!result?.data?.json || typeof result.data.json !== "object") {
    throw new Error("Missing token refresh data");
  }

  return result.data.json as { accessToken: string; refreshToken: string };
};

let refreshPromise: Promise<boolean> | null = null;

const refreshAuthTokens = async (): Promise<boolean> => {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken || refreshToken.startsWith("guest_token_")) return false;

  try {
    const response = await fetch(`${getApiBaseUrl()}/trpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        {
          id: 1,
          json: { input: { refreshToken } },
          method: "mutation",
          path: "authApi.refresh",
        },
      ]),
    });

    if (!response.ok) return false;

    const payload = await response.json();
    authStorage.setTokens(decodeRefreshResponse(payload));
    return true;
  } catch {
    return false;
  }
};

const ensureFreshAuthTokens = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshAuthTokens().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export const authenticatedFetch: typeof fetch = async (input, init = {}) => {
  const headers = headersToObject(init.headers);
  const token = authStorage.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;

  const refreshed = await ensureFreshAuthTokens();
  if (!refreshed) return response;

  const retryHeaders = headersToObject(init.headers);
  const nextToken = authStorage.getAccessToken();
  if (nextToken) retryHeaders.Authorization = `Bearer ${nextToken}`;

  return fetch(input, { ...init, headers: retryHeaders });
};
