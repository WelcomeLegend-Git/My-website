import { useState, useCallback } from "react";

/** Tiny hook that centralises AI-access-verified state. */
export function useAiAccess() {
  const [isVerified, setIsVerified] = useState(
    () => localStorage.getItem("ai_access_verified") === "true"
  );
  const [showGate, setShowGate] = useState(false);

  const openGate = useCallback(() => setShowGate(true), []);
  const closeGate = useCallback(() => setShowGate(false), []);

  const markVerified = useCallback(() => {
    localStorage.setItem("ai_access_verified", "true");
    setIsVerified(true);
    setShowGate(false);
  }, []);

  return { isVerified, showGate, openGate, closeGate, markVerified } as const;
}
