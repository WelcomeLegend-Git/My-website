import { useEffect, useState, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AiSidebar } from "../../features/ai/components/AiSidebar";
import { InstallPrompt } from "../../features/pwa/InstallPrompt";
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

export const ShellLayout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isStudyCoach = location.pathname.startsWith("/study-coach");
  const [aiOpen, setAiOpen] = useState(false);
  const [showMentor, setShowMentor] = useState(true);
  const [aiContext, setAiContext] = useState<Record<string, unknown> | undefined>(undefined);
  const [aiSection, setAiSection] = useState<AiSection>(resolveSection(location.pathname));
  const clearChatSignal = useRef(0);

  useEffect(() => {
    // Immediately clear context and update section on navigation
    setAiContext(undefined);
    setAiSection(resolveSection(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    try {
      if (aiContext) {
        sessionStorage.setItem(
          `ai_context_v1_${aiSection}`,
          JSON.stringify({ p: location.pathname, c: aiContext })
        );
      }
    } catch {}
  }, [aiContext, aiSection, location.pathname]);

  // Restore last known context when opening mentor on mobile/tablet
  useEffect(() => {
    if (!aiOpen) return;
    try {
      // Only apply on < lg screens
      const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
      if (isDesktop) return;
    } catch {}

    if (!aiContext) {
      try {
        const raw = sessionStorage.getItem(`ai_context_v1_${aiSection}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.p === location.pathname && parsed.c) {
            setAiContext(parsed.c as Record<string, unknown>);
          }
        }
      } catch {}
    }
  }, [aiOpen, aiContext, aiSection, setAiContext, location.pathname]);


  const clearAiChat = () => {
    try {
      localStorage.removeItem('ai_conversation_v2');
      clearChatSignal.current += 1;
    } catch {}
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
        "relative flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 " +
        (isStudyCoach ? "h-screen overflow-hidden" : "min-h-screen")
      }
    >
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Mobile/Tablet AI Sidebar Overlay */}
      {aiOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm fade-in" onClick={() => setAiOpen(false)}>
          <div className="w-full sm:max-w-lg sm:mx-4 mt-14 mb-14 h-[calc(100dvh-7rem)] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-full overflow-hidden p-4 pb-[env(safe-area-inset-bottom)]">
              <AiSidebar open={aiOpen} section={aiSection} context={aiContext} routePath={location.pathname} variant="mobile" onRequestClose={() => setAiOpen(false)} clearSignal={clearChatSignal.current} />
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />
      
      <div className="relative flex flex-1 flex-col min-h-0 z-10">
        {/* Modern Header with Glassmorphism */}
        <header className="sticky top-0 z-40 border-b border-slate-800/50 glass backdrop-blur-xl fade-in-down">
          <div className="max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-16 lg:h-20">
              {/* Logo & Brand */}
              <div className="flex items-center gap-3 sm:gap-6 lg:gap-8">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                  <div className="relative px-4 sm:px-4 py-2 sm:py-2 bg-slate-900 rounded-lg min-w-0">
                    <p className="text-[14px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-primary font-bold">JEE Companion</p>
                    <h1 className="text-[14px] sm:text-xs font-medium text-slate-300">Daily Mastery</h1>
                  </div>
                </div>
                
                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-2">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `group relative px-4 py-2.5 rounded-xl transition-all duration-300 hover-lift ${
                          isActive
                            ? "bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30"
                            : "border border-transparent hover:border-slate-700/50"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <div className="relative">
                          <div className="flex flex-col">
                            <span className={`text-sm font-semibold transition-colors ${
                              isActive ? "text-primary" : "text-slate-300 group-hover:text-slate-100"
                            }`}>
                              {item.label}
                            </span>
                            <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                              {item.description}
                            </span>
                          </div>
                          {isActive && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-primary to-purple-500 rounded-full"></div>
                          )}
                        </div>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>

              {/* Right Section: User & Actions */}
              <div className="flex items-center gap-1.5 sm:gap-3">
                {/* AI Toggle - Desktop */}
                <button
                  type="button"
                  onClick={() => setAiOpen((prev) => !prev)}
                  disabled={!showMentor}
                  className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 hover-lift ${
                    !showMentor
                      ? "opacity-50 cursor-not-allowed border border-slate-700/50 text-slate-500"
                      : aiOpen
                      ? "bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 text-primary glow-sm"
                      : "border border-slate-700/50 text-slate-300 hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {aiOpen ? "Hide" : "Show"} Mentor
                </button>

                {/* User Info - Desktop (click to log out) */}
                <button
                  type="button"
                  onClick={logout}
                  className="hidden md:flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 text-left transition-colors hover:border-red-500/40 hover:bg-red-500/5"
                  title="Click to log out"
                >
                  <div className="flex flex-col items-end text-right">
                    <span className="text-sm font-medium text-slate-100">{user?.name}</span>
                    <span className="text-xs text-slate-400">{user?.email}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center font-bold text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                </button>

                {/* Settings Button */}
                <Link
                  to="/settings"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-slate-300 hover:border-primary/60 hover:text-primary hover:bg-primary/10 transition-all duration-300 hover-lift"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-1.14 1.952-1.14 2.252 0a1.724 1.724 0 002.573 1.066c.986-.57 2.192.436 1.822 1.494a1.724 1.724 0 001.002 2.18c1.077.4 1.077 1.872 0 2.272a1.724 1.724 0 00-1.002 2.18c.37 1.058-.836 2.064-1.822 1.494a1.724 1.724 0 00-2.573 1.066c-.3 1.14-1.952 1.14-2.252 0a1.724 1.724 0 00-2.573-1.066c-.986.57-2.192-.436-1.822-1.494a1.724 1.724 0 00-1.002-2.18c-1.077-.4-1.077-1.872 0-2.272a1.724 1.724 0 001.002-2.18c-.37-1.058.836-2.064 1.822-1.494a1.724 1.724 0 002.573-1.066z"
                    />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </Link>

                {/* Logout Button - Mobile/Tablet */}
                <button
                  type="button"
                  className="md:hidden px-3 sm:px-4 py-2 sm:py-2 rounded-xl border border-slate-700/50 text-sm sm:text-sm font-medium text-slate-300 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
                  onClick={logout}
                >
                  <span className="hidden sm:inline">Log out</span>
                  <svg className="w-5 h-5 sm:w-5 sm:h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>

                {/* Mobile AI Toggle - same style as desktop */}
                <button
                  type="button"
                  onClick={() => setAiOpen((prev) => !prev)}
                  disabled={!showMentor}
                  className={`lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-base transition-all duration-300 hover-lift ${
                    !showMentor
                      ? "opacity-50 cursor-not-allowed border border-slate-700/50 text-slate-500"
                      : aiOpen
                      ? "bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 text-primary glow-sm"
                      : "border border-slate-700/50 text-slate-300 hover:border-primary/50 hover:text-primary"
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
            <nav className="lg:hidden border-t border-slate-800/50 py-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 sm:gap-2 min-w-max px-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all ${
                        isActive
                          ? "bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30"
                          : "border border-transparent hover:border-slate-700/50"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <div>
                        <span className={`text-xs sm:text-sm font-semibold ${
                          isActive ? "text-primary" : "text-slate-300"
                        }`}>
                          {item.label}
                        </span>
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0 max-w-[1920px] mx-auto w-full">
          <main
            className={
              "flex-1 w-full min-w-0 fade-in-up " +
              (isStudyCoach
                ? "px-0 py-0 flex flex-col min-h-0"
                : "px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8")
            }
          >
            <div
              className={
                isStudyCoach
                  ? "flex-1 min-h-0 overflow-hidden"
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