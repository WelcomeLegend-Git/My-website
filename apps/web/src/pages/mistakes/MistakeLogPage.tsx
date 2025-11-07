import { useEffect } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";

export const MistakeLogPage = () => {
  const { setAiSection, setAiContext, openAi } = useShellContext();

  useEffect(() => {
    setAiSection("mistakes");
    setAiContext(undefined);
  }, [setAiContext, setAiSection]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-100">Mistake Log</h2>
          <p className="text-sm text-slate-400">Capture slips quickly, attach working photos, and let AI distill lessons.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={openAi}
        >
          Log mistake
        </button>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Intelligent review board will appear here with AI analysis timelines.
      </div>
    </section>
  );
};