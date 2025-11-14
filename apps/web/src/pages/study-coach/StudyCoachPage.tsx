import { useEffect } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";

export const StudyCoachPage = () => {
  const { setAiSection, setAiContext, setShowMentor } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
    setShowMentor(false);

    return () => {
      setShowMentor(true);
    };
  }, [setAiContext, setAiSection, setShowMentor]);

  return (
    <section className="min-h-[60vh] flex flex-col items-start justify-center gap-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-slate-100">Study Coach</h1>
          <p className="text-slate-400 mt-1">Your AI-powered mentor for study planning, strategies, and mental wellness</p>
        </div>
      </div>

      <div className="px-6 py-5 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
        <p className="text-lg font-semibold text-slate-200">Coming Soon</p>
        <p className="text-sm text-slate-400 mt-2">
          We’re crafting a tuned Study Coach experience with planning support, motivation systems, and wellness guidance.
        </p>
      </div>
    </section>
  );
};
