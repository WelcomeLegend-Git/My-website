interface MistakeLogChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onChooseManual: () => void;
  onChooseAI: () => void;
}

export const MistakeLogChoiceModal = ({
  open,
  onClose,
  onChooseManual,
  onChooseAI,
}: MistakeLogChoiceModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-2xl mx-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl shadow-2xl">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-600/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          
          <div className="relative p-8">
            <h2 className="text-3xl font-bold text-slate-100 mb-2">
              Log a Mistake
            </h2>
            <p className="text-slate-400 mb-8">
              Choose how you'd like to log your mistake
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Manual Entry Card */}
              <button
                onClick={() => {
                  onClose();
                  onChooseManual();
                }}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 text-left transition-all duration-300 hover:border-primary/50 hover:shadow-[0_20px_60px_-20px_rgba(99,102,241,0.45)] hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">
                    Add Manually
                  </h3>
                  
                  <p className="text-sm text-slate-400 mb-4">
                    Fill in the details yourself. Perfect for when you know exactly what went wrong.
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Full control</span>
                  </div>
                </div>
              </button>

              {/* AI-Powered Entry Card */}
              <button
                onClick={() => {
                  onClose();
                  onChooseAI();
                }}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 text-left transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_20px_60px_-20px_rgba(168,85,247,0.45)] hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-slate-100 mb-2 flex items-center gap-2">
                    Log with AI
                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full font-medium">
                      Smart
                    </span>
                  </h3>
                  
                  <p className="text-sm text-slate-400 mb-4">
                    Upload photos (up to 10) and let AI analyze your mistake, categorize it, and suggest improvements.
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 7H7v6h6V7z" />
                      <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                    </svg>
                    <span>AI-powered analysis</span>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
