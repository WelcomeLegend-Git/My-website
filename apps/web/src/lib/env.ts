const defaultBackendUrl = "https://jee-study-backend.onrender.com";

export const getApiBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  if (url) {
    try {
      const parsed = new URL(url);
      return parsed.toString().replace(/\/$/, "");
    } catch {}
  }

  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return "http://localhost:4000";
  }

  return defaultBackendUrl;
};