import { useEffect, useState, useRef, useCallback } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AiSidebar } from "../../features/ai/components/AiSidebar";
import { InstallPrompt } from "../../features/pwa/InstallPrompt";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../providers/AuthProvider";

type AiSection = "formulas" | "mistakes" | "study";

export type ShellOutletContext = {
  setAiContext: (context: Record<string, unknown> | undefined) => void;
  setAiSection: (section: AiSection) => void;
  openAi: () => void;
  setShowMentor: (show: boolean) => void;
  clearAiChat: () => void;
};

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    description: "Progress overview",
  },
  {
    to: "/formulas",
    label: "Formula Library",
    description: "Archive your derivations",
  },
  {
    to: "/mistakes",
    label: "Mistake Log",
    description: "Reflect and resolve",
  },
  {
    to: "/quiz-history",
    label: "Quiz History",
    description: "Track and analyze",
  },
];

const resolveSection = (pathname: string): AiSection => {
  if (pathname.startsWith("/formulas")) {
    return "formulas";
  }
  if (pathname.startsWith("/mistakes")) {
    return "mistakes";
  }
  if (pathname.startsWith("/quiz")) {
    return "study"; // Quiz pages use study section for AI
  }
  return "study";
};

/* ── Theme helper ─────────────────────────────────── */
function getInitialTheme(): "light" | "dark" | "system" {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch { }
  return "dark";
}

function applyTheme(choice: "light" | "dark" | "system") {
  const html = document.documentElement;
  if (choice === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", choice);
  }
}

function resolvedIsDark(choice: "light" | "dark" | "system"): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const ShellLayout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isStudyCoach = location.pathname.startsWith("/study-coach");
  const isAnatomy = location.pathname.startsWith("/anatomy");
  const isFullScreenRoute = isStudyCoach || isAnatomy;
  const [aiOpen, setAiOpen] = useState(false);
  const [showMentor, setShowMentor] = useState(true);
  const [aiContext, setAiContext] = useState<Record<string, unknown> | undefined>(undefined);
  const [aiSection, setAiSection] = useState<AiSection>(resolveSection(location.pathname));
  const clearChatSignal = useRef(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* ── Theme state ──────────────────────────── */
  const [themeChoice, setThemeChoice] = useState<"light" | "dark" | "system">(getInitialTheme);
  const [isDark, setIsDark] = useState(() => resolvedIsDark(getInitialTheme()));

  const cycleTheme = useCallback(() => {
    setThemeChoice((prev) => {
      const next = prev === "system" ? "light" : prev === "light" ? "dark" : "system";
      try { localStorage.setItem("theme", next); } catch { }
      applyTheme(next);
      setIsDark(resolvedIsDark(next));
      return next;
    });
  }, []);

  // Apply on mount + listen for OS changes
  useEffect(() => {
    applyTheme(themeChoice);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (themeChoice === "system") setIsDark(mq.matches); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeChoice]);

  useEffect(() => {
    if (!showMentor) {
      setAiOpen(false);
    }
  }, [showMentor]);

  const backupStatusQuery = trpc.backupApi.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const autoBackupMutation = trpc.backupApi.backupToDrive.useMutation();

  useEffect(() => {
    // Immediately clear context and update section on navigation
    setAiContext(undefined);
    setAiSection(resolveSection(location.pathname));
    setProfileOpen(false);
    setShowLogoutConfirm(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      if (aiContext) {
        sessionStorage.setItem(
          `ai_context_v1_${aiSection}`,
          JSON.stringify({ p: location.pathname, c: aiContext })
        );
      }
    } catch { }
  }, [aiContext, aiSection, location.pathname]);

  // Restore last known context when opening mentor on mobile/tablet
  useEffect(() => {
    if (!aiOpen) return;
    try {
      // Only apply on < lg screens
      const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
      if (isDesktop) return;
    } catch { }

    if (!aiContext) {
      try {
        const raw = sessionStorage.getItem(`ai_context_v1_${aiSection}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.p === location.pathname && parsed.c) {
            setAiContext(parsed.c as Record<string, unknown>);
          }
        }
      } catch { }
    }
  }, [aiOpen, aiContext, aiSection, setAiContext, location.pathname]);

  useEffect(() => {
    if (!backupStatusQuery.data?.isConnected || !backupStatusQuery.data.autoBackupEnabled) {
      return;
    }

    let cancelled = false;

    const performBackup = async () => {
      if (cancelled) return;
      if (autoBackupMutation.isPending) return;

      try {
        await autoBackupMutation.mutateAsync();
        await backupStatusQuery.refetch();
      } catch (error) {
        console.error("Auto backup to Google Drive failed", error);
        try {
          await backupStatusQuery.refetch();
        } catch {
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void performBackup();
    }, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [backupStatusQuery.data?.isConnected, backupStatusQuery.data?.autoBackupEnabled, autoBackupMutation, backupStatusQuery]);


  const clearAiChat = () => {
    try {
      localStorage.removeItem('ai_conversation_v2');
      clearChatSignal.current += 1;
    } catch { }
  };



  const outletContext: ShellOutletContext = {
    setAiContext,
    setAiSection,
    openAi: () => setAiOpen(true),
    setShowMentor,
    clearAiChat,
  };

  return (
    <div
      className={
        "relative flex bg-paper text-ink " +
        (isFullScreenRoute ? "h-screen overflow-hidden" : "min-h-screen")
      }
    >
      {/* Mobile/Tablet AI Sidebar Overlay */}
      {aiOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm fade-in" onClick={() => setAiOpen(false)}>
          <div className="w-full sm:max-w-lg sm:mx-4 mt-14 mb-14 h-[calc(100dvh-7rem)] bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-full overflow-hidden p-4 pb-[env(safe-area-inset-bottom)]">
              <AiSidebar open={aiOpen} section={aiSection} context={aiContext} routePath={location.pathname} variant="mobile" onRequestClose={() => setAiOpen(false)} clearSignal={clearChatSignal.current} />
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />

      <div className="relative flex flex-1 flex-col min-h-0 z-10">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl fade-in-down">
          <div className="max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-16 lg:h-20">
              {/* Logo & Brand */}
              <div className="flex items-center gap-3 sm:gap-6 lg:gap-8">
                <Link to="/" className="group">
                  <div className="px-4 sm:px-4 py-2 sm:py-2 bg-surface-2 border border-line rounded-lg min-w-0 transition-colors group-hover:border-brass/40">
                    <p className="text-[14px] sm:text-xs uppercase tracking-[0.2em] text-brass font-mono font-bold">JEE Companion</p>
                    <h1 className="text-[14px] sm:text-xs font-medium text-ink-muted">Daily Mastery</h1>
                  </div>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-2">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `group relative px-4 py-2.5 rounded-xl transition-all duration-300 hover-lift ${isActive
                          ? "bg-surface border border-line shadow-sm"
                          : "border border-transparent hover:border-line"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <div className="relative">
                          <div className="flex flex-col">
                            <span className={`text-sm font-semibold transition-colors ${isActive ? "text-brass" : "text-ink-muted group-hover:text-ink"
                              }`}>
                              {item.label}
                            </span>
                            <span className="text-xs text-ink-muted group-hover:text-ink-muted transition-colors">
                              {item.description}
                            </span>
                          </div>
                          {isActive && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-brass rounded-full"></div>
                          )}
                        </div>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>

              {/* Right Section: Theme toggle, User & Actions */}
              <div className="flex items-center gap-1.5 sm:gap-3 relative">
                {/* Theme Toggle */}
                <button
                  type="button"
                  onClick={cycleTheme}
                  className="flex items-center justify-center w-9 h-9 rounded-lg border border-line text-ink-muted hover:text-brass hover:border-brass/40 transition-all duration-200"
                  title={`Theme: ${themeChoice}`}
                >
                  {themeChoice === "system" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : isDark ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </button>

                {/* AI Toggle - Desktop */}
                <button
                  type="button"
                  onClick={() => setAiOpen((prev) => !prev)}
                  disabled={!showMentor}
                  className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 hover-lift ${!showMentor
                    ? "opacity-50 cursor-not-allowed border border-line text-ink-muted"
                    : aiOpen
                      ? "bg-surface border border-line shadow-sm text-brass"
                      : "border border-line text-ink-muted hover:border-brass/40 hover:text-brass"
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {aiOpen ? "Hide" : "Show"} Mentor
                </button>

                {/* Profile Button (opens dropdown with settings + logout) */}
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setShowLogoutConfirm(false);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 sm:px-3 py-1.5 text-left hover:border-brass/40 transition-all duration-300 hover-lift"
                >
                  <div className="hidden md:flex flex-col items-end text-right mr-1">
                    <span className="text-sm font-medium text-ink leading-tight max-w-[160px] truncate">
                      {user?.name}
                    </span>
                    <span className="text-xs text-ink-muted max-w-[180px] truncate">
                      {user?.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-9 h-9 rounded-full bg-surface-2 border border-line flex items-center justify-center font-bold text-sm text-ink font-mono">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <svg
                      className="w-4 h-4 text-ink-muted hidden md:block"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-72 rounded-2xl border border-line bg-surface shadow-2xl shadow-black/10 backdrop-blur-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-line bg-surface-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-brass font-mono font-semibold mb-1">Profile</p>
                      <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
                      <p className="text-xs text-ink-muted truncate">{user?.email}</p>
                    </div>

                    <div className="p-2 space-y-1 text-sm">
                      <Link
                        to="/settings"
                        onClick={() => {
                          setProfileOpen(false);
                          setShowLogoutConfirm(false);
                        }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-ink hover:bg-surface-2 hover:text-brass transition-colors cursor-pointer"
                      >
                        <span className="material-icons text-base text-ink-muted">settings</span>
                        <div className="flex flex-col">
                          <span className="font-medium">Settings</span>
                          <span className="text-[11px] text-ink-muted">Manage backups and account</span>
                        </div>
                      </Link>

                      <div className="h-px bg-line my-1" />

                      {!showLogoutConfirm && (
                        <button
                          type="button"
                          onClick={() => setShowLogoutConfirm(true)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="font-medium">Log out</span>
                        </button>
                      )}

                      {showLogoutConfirm && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 space-y-2">
                          <p className="text-xs text-red-600">
                            Log out from this device? You&apos;ll need to enter your email and password again to sign
                            back in.
                          </p>
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setShowLogoutConfirm(false)}
                              className="px-3 py-1.5 rounded-lg border border-line text-ink-muted hover:bg-surface-2 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileOpen(false);
                                setShowLogoutConfirm(false);
                                logout();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-400 transition-colors"
                            >
                              Yes, log out
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile AI Toggle - same style as desktop */}
                <button
                  type="button"
                  onClick={() => setAiOpen((prev) => !prev)}
                  disabled={!showMentor}
                  className={`lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-base transition-all duration-300 hover-lift ${!showMentor
                    ? "opacity-50 cursor-not-allowed border border-line text-ink-muted"
                    : aiOpen
                      ? "bg-surface border border-line shadow-sm text-brass"
                      : "border border-line text-ink-muted hover:border-brass/40 hover:text-brass"
                    }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {aiOpen ? "Hide" : "Show"} Mentor
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            {!isFullScreenRoute && (
              <nav className="lg:hidden border-t border-line py-2 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1.5 sm:gap-2 min-w-max px-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all ${isActive
                          ? "bg-brass-soft border border-brass/30"
                          : "border border-transparent hover:border-line"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <div>
                          <span className={`text-xs sm:text-sm font-semibold ${isActive ? "text-brass" : "text-ink-muted"
                            }`}>
                            {item.label}
                          </span>
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0 max-w-[1920px] mx-auto w-full">
          <main
            className={
              "flex-1 w-full min-w-0 fade-in-up " +
              (isFullScreenRoute
                ? "px-0 py-0 flex flex-col min-h-0"
                : "px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8")
            }
          >
            <div
              className={
                isFullScreenRoute
                  ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col"
                  : "max-w-7xl mx-auto"
              }
            >
              <Outlet context={outletContext} />
            </div>
          </main>
          <AiSidebar open={aiOpen} section={aiSection} context={aiContext} routePath={location.pathname} clearSignal={clearChatSignal.current} />
        </div>
      </div>
    </div>
  );
};