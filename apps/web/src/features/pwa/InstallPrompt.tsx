import { useEffect, useState } from "react";
import { showInstallPrompt, setupInstallPrompt, isInstalled, isMobile } from "../../lib/pwa";

export const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already installed or not on mobile
    if (isInstalled() || !isMobile()) {
      return;
    }

    // Check if user dismissed before
    const dismissed = localStorage.getItem("install-prompt-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSince = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show again after 7 days
      if (daysSince < 7) {
        return;
      }
    }

    setupInstallPrompt(() => {
      setShowPrompt(true);
    });
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    const accepted = await showInstallPrompt();
    
    if (accepted) {
      setShowPrompt(false);
      localStorage.removeItem("install-prompt-dismissed");
    } else {
      localStorage.setItem("install-prompt-dismissed", Date.now().toString());
      setShowPrompt(false);
    }
    setIsInstalling(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("install-prompt-dismissed", Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up md:left-auto md:w-96">
      <div className="rounded-2xl border border-brass/30 bg-surface p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brass-soft">
            <svg
              className="h-6 w-6 text-brass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-ink">
              Install JEE Companion
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              Get quick access and work offline! Install the app on your device.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl bg-brass-soft px-4 py-2 text-sm font-semibold text-brass-foreground hover:bg-brass-soft disabled:opacity-50"
            onClick={handleInstall}
            disabled={isInstalling}
          >
            {isInstalling ? "Installing..." : "Install App"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-line px-4 py-2 text-sm text-ink-muted hover:border-line"
            onClick={handleDismiss}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};
