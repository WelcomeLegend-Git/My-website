import { useEffect } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";

export const DashboardPage = () => {
  const { setAiSection, setAiContext } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
  }, [setAiContext, setAiSection]);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-slate-100">Daily Snapshot</h2>
        <p className="mt-1 text-sm text-slate-400">Track readiness, review streaks, and surface your next best actions.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Mastery Momentum</p>
          <p className="mt-3 text-4xl font-semibold text-primary">73%</p>
          <p className="mt-1 text-sm text-slate-400">Based on formula reviews, resolved mistakes, and quiz accuracy from the past week.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Review Streak</p>
          <p className="mt-3 text-4xl font-semibold text-emerald-400">5 days</p>
          <p className="mt-1 text-sm text-slate-400">Keep it going to solidify long-term retention.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Mistakes Resolved</p>
          <p className="mt-3 text-4xl font-semibold text-sky-400">12</p>
          <p className="mt-1 text-sm text-slate-400">Across Physics (5), Chemistry (4), Mathematics (3) this month.</p>
        </div>
      </div>
    </section>
  );
};