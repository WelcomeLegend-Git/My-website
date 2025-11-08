import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AiSidebar } from "../../features/ai/components/AiSidebar";
import { InstallPrompt } from "../../features/pwa/InstallPrompt";
import { useAuth } from "../providers/AuthProvider";

type AiSection = "formulas" | "mistakes" | "study";

export type ShellOutletContext = {
  setAiContext: (context: Record<string, unknown> | undefined) => void;
  setAiSection: (section: AiSection) => void;
  openAi: () => void;
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
    to: "/study",
    label: "Study Coach",
    description: "Targeted AI sessions",
  },
];

const resolveSection = (pathname: string): AiSection => {
  if (pathname.startsWith("/formulas")) {
    return "formulas";
  }
  if (pathname.startsWith("/mistakes")) {
    return "mistakes";
  }
  return "study";
};

export const ShellLayout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [aiOpen, setAiOpen] = useState(true);
  const [aiContext, setAiContext] = useState<Record<string, unknown> | undefined>(undefined);
  const [aiSection, setAiSection] = useState<AiSection>(resolveSection(location.pathname));

  useEffect(() => {
    setAiSection(resolveSection(location.pathname));
    setAiContext(undefined);
  }, [location.pathname]);

  const outletContext: ShellOutletContext = {
    setAiContext,
    setAiSection,
    openAi: () => setAiOpen(true),
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <InstallPrompt />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xs uppercase tracking-[0.2em] text-slate-500">JEE Companion</p>
                <h1 className="text-1.5xs font-semibold">Your daily mastery system</h1>
              </div>
              <nav className="hidden items-center gap-5 md:flex">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-xl border px-5 py-2 text-base transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`
                    }
                  >
                    <span className="block text-base font-semibold">{item.label}</span>
                    <span className="text-sm text-slate-500">{item.description}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAiOpen((prev) => !prev)}
                className={`hidden rounded-full border px-4 py-2 text-sm font-medium transition-colors lg:block ${
                  aiOpen
                    ? "border-primary text-primary"
                    : "border-slate-700 text-slate-300 hover:border-primary hover:text-primary"
                }`}
              >
                {aiOpen ? "Hide" : "Show"} Mentor
              </button>
              <div className="hidden flex-col items-end text-right md:flex">
                <span className="text-sm font-medium text-slate-100">{user?.name}</span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-red-500 hover:text-red-400 transition-colors"
                onClick={logout}
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <main className="flex w-full flex-1 flex-col gap-6 px-6 py-6">
            <Outlet context={outletContext} />
          </main>
          <AiSidebar open={aiOpen} section={aiSection} context={aiContext} />
        </div>
      </div>
    </div>
  );
};