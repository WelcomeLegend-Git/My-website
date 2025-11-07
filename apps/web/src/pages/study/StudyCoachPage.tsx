import { useEffect } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";

export const StudyCoachPage = () => {
  const { setAiSection, setAiContext, openAi } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
  }, [setAiContext, setAiSection]);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-slate-100">Study Coach</h2>
        <p className="mt-1 text-sm text-slate-400">Generate targeted quizzes, explain formulas, and plan the next block.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Interactive AI tools will sit here soon.
        <button
          type="button"
          className="mt-4 rounded-xl border border-primary/40 px-4 py-2 text-sm font-semibold text-primary"
          onClick={openAi}
        >
          Ask Mentor
        </button>
      </div>
    </section>
  );
};