import { useState } from 'react';

export type QuizConfig = {
  examType: 'mains' | 'advanced';
  questionCount: number;
  answerType: 'single' | 'multiple';
  includeTimer: boolean;
  timeMinutes?: number;
  scope: 'current' | 'all' | 'cross-chapter';
};

type Props = {
  onSubmit: (config: QuizConfig) => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export const QuizConfigForm = ({ onSubmit, onCancel, isLoading }: Props) => {
  const [config, setConfig] = useState<QuizConfig>({
    examType: 'mains',
    questionCount: 10,
    answerType: 'single',
    includeTimer: false,
    scope: 'current',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-purple-500/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-primary">Practice Quiz Setup</h3>
          <p className="text-xs text-slate-400">Configure your practice session</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Exam Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfig({ ...config, examType: 'mains' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.examType === 'mains'
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              JEE Mains
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, examType: 'advanced' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.examType === 'advanced'
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              JEE Advanced
            </button>
          </div>
        </div>

        {/* Question Count */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Number of Questions (max 50)
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={config.questionCount}
            onChange={(e) => setConfig({ ...config, questionCount: Math.min(50, parseInt(e.target.value) || 1) })}
            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Answer Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Answer Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfig({ ...config, answerType: 'single' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.answerType === 'single'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Single Correct
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, answerType: 'multiple' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.answerType === 'multiple'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Multiple Correct
            </button>
          </div>
        </div>

        {/* Scope */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Question Scope</label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setConfig({ ...config, scope: 'current' })}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                config.scope === 'current'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Current Collection Only
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, scope: 'all' })}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                config.scope === 'all'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              All Formulas in This Chapter
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, scope: 'cross-chapter' })}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                config.scope === 'cross-chapter'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Cross-Chapter (Subject-wide)
            </button>
          </div>
        </div>

        {/* Timer */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeTimer}
              onChange={(e) => setConfig({ ...config, includeTimer: e.target.checked, timeMinutes: e.target.checked ? 30 : undefined })}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800/50 text-primary focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-xs font-semibold text-slate-300">Enable Timer</span>
          </label>
          {config.includeTimer && (
            <div className="mt-2 relative">
              <input
                type="number"
                min="1"
                max="180"
                value={config.timeMinutes || 30}
                onChange={(e) => setConfig({ ...config, timeMinutes: parseInt(e.target.value) || 30 })}
                placeholder="30"
                className="w-full px-3 py-2 pr-20 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                minutes
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Quiz
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
