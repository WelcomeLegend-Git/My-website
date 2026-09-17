import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void): (() => void) => {
  const media = window.matchMedia?.(query);
  media?.addEventListener("change", notify);
  return () => media?.removeEventListener("change", notify);
};
const getSnapshot = (): boolean => window.matchMedia?.(query).matches ?? false;

/** Also stops JS/canvas animation when the preference changes during a match. */
export const useLudoReducedMotion = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => true);
