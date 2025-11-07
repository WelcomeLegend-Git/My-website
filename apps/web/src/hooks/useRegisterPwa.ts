import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";

export const useRegisterPwa = () => {
  useEffect(() => {
    const supportsPwa = "serviceWorker" in navigator;
    const isProduction = import.meta.env.MODE === "production";

    if (!supportsPwa || !isProduction) {
      return;
    }

    let mounted = true;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
        if (mounted) {
          registration.update().catch(() => {
            // Ignore update errors silently – SW will retry automatically.
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Service worker registration failed", error);
        }
      }
    };

    register();

    return () => {
      mounted = false;
    };
  }, []);
};