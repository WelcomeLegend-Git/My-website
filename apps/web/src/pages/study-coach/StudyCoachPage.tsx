import { useEffect } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";

export const StudyCoachPage = () => {
  const { setAiSection, setShowMentor } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setShowMentor(false);
  }, [setAiSection, setShowMentor]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center">
        {/* Faded Icon */}
        <div className="mb-8 opacity-30">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/10">
            <svg className="w-12 h-12 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>

        {/* Main Message */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent">
            Study Coach
          </span>
        </h1>
        
        <div className="space-y-4 mb-8">
          <p className="text-xl text-slate-400 font-medium">
            Coming Soon
          </p>
          <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
            We're working on building an amazing AI-powered study companion for your JEE preparation journey. 
            Stay tuned for something extraordinary.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="w-full max-w-sm mx-auto mb-8">
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse w-1/3"></div>
          </div>
          <p className="text-xs text-slate-600 mt-2">Development in progress</p>
        </div>

        {/* Back to Dashboard */}
        <button 
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all duration-200 border border-slate-700 hover:border-slate-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Go Back
        </button>
      </div>
    </div>
  );
};
