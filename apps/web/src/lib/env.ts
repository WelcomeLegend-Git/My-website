const fallbackApiUrl = "http://localhost:3001";

export const getApiBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  if (!url) {
    return fallbackApiUrl;
  }
  try {
    const parsed = new URL(url);
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    console.warn("Invalid VITE_API_URL, falling back to default", error);
    return fallbackApiUrl;
  }
};