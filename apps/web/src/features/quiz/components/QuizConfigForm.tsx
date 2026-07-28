import { useState } from 'react';

export type QuizConfig = {
  examType: 'mains' | 'advanced';
  questionCount: number;
  answerType: 'single' | 'multiple';
  includeTimer: boolean;
  timeMinutes?: number;
  scope: 'current' | 'all' | 'cross-chapter';
  pictureQuestionRatio?: number;
};

type Props = {
  onSubmit: (config: QuizConfig) => void;
  onCancel: () => void;
  isLoading?: boolean;
  section?: 'formulas' | 'mistakes' | 'study';
};

export const QuizConfigForm = ({
  onSubmit,
  onCancel,
  isLoading,
  section = 'formulas',
  studyChapter,
  studyDescription,
  onChangeStudyChapter,
  onChangeStudyDescription,
}: Props & {
  studyChapter?: string;
  studyDescription?: string;
  onChangeStudyChapter?: (value: string) => void;
  onChangeStudyDescription?: (value: string) => void;
}) => {
  const [config, setConfig] = useState<QuizConfig>({
    examType: 'mains',
    questionCount: 10,
    answerType: 'single',
    includeTimer: false,
    scope: 'current',
  });

  const currentPictureRatio =
    typeof config.pictureQuestionRatio === 'number'
      ? config.pictureQuestionRatio
      : config.examType === 'advanced'
      ? 0.3
      : 0.2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-brass/30 bg-brass-soft backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brass flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-brass font-mono">Practice Quiz Setup</h3>
          <p className="text-xs text-ink-muted">Configure your practice session</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Exam Type */}
        <div>
          <label className="block text-xs font-semibold text-ink-muted font-mono mb-1.5">Exam Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfig({ ...config, examType: 'mains' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.examType === 'mains'
                  ? 'bg-brass text-white'
                  : 'bg-surface-2 text-ink hover:bg-surface'
              }`}
            >
              JEE Mains
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, examType: 'advanced' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.examType === 'advanced'
                  ? 'bg-brass text-white'
                  : 'bg-surface-2 text-ink hover:bg-surface'
              }`}
            >
              JEE Advanced
            </button>
          </div>
        </div>

        {/* Picture Questions % */}
        <div>
          <label className="block text-xs font-semibold text-ink-muted font-mono mb-1.5">
            Picture Questions (%)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={Math.round(currentPictureRatio * 100)}
              onChange={(e) => {
                const value = Number(e.target.value) || 0;
                setConfig({
                  ...config,
                  pictureQuestionRatio: Math.max(0, Math.min(1, value / 100)),
                });
              }}
              className="flex-1 accent-brass"
            />
            <span className="text-xs font-semibold text-ink w-10 text-right">
              {Math.round(currentPictureRatio * 100)}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Higher values create more JEE-style diagram/graph questions. For very visual chapters, try 70–90%.
          </p>
        </div>

        {/* Question Count */}
        <div>
          <label className="block text-xs font-semibold text-ink-muted font-mono mb-1.5">
            Number of Questions (max 50)
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={config.questionCount}
            onChange={(e) => setConfig({ ...config, questionCount: Math.min(50, parseInt(e.target.value) || 1) })}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brass/50"
          />
        </div>

        {/* Answer Type */}
        <div>
          <label className="block text-xs font-semibold text-ink-muted font-mono mb-1.5">Answer Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfig({ ...config, answerType: 'single' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.answerType === 'single'
                  ? 'bg-signal text-white'
                  : 'bg-surface-2 text-ink hover:bg-surface'
              }`}
            >
              Single Correct
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, answerType: 'multiple' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                config.answerType === 'multiple'
                  ? 'bg-signal text-white'
                  : 'bg-surface-2 text-ink hover:bg-surface'
              }`}
            >
              Multiple Correct
            </button>
          </div>
        </div>

        {/* Scope / Study context */}
        <div>
          {section === 'study' && (onChangeStudyChapter || onChangeStudyDescription) ? (
            <>
              <label className="block text-xs font-semibold text-ink-muted font-mono mb-1.5">
                Question Focus
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <input
                    type="text"
                    value={studyChapter ?? ''}
                    onChange={(e) => onChangeStudyChapter?.(e.target.value)}
                    placeholder="Chapter or topic (e.g. Electrostatics)"
                    className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brass/50 placeholder-ink-muted"
                  />
                </div>
                <div className="sm:col-span-2">
                  <textarea
                    value={studyDescription ?? ''}
                    onChange={(e) => onChangeStudyDescription?.(e.target.value)}
                    placeholder="Short description of what to focus on (weak areas, subtopics, error patterns)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-ink text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brass/50 placeholder-ink-muted resize-none"
                  />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                These details, plus your recent chat, help target the quiz to the right topics.
              </p>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-ink-muted font-mono mb-1.5">Question Scope</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, scope: 'current' })}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                    config.scope === 'current'
                      ? 'bg-brass text-white'
                      : 'bg-surface-2 text-ink hover:bg-surface'
                  }`}
                >
                  {section === 'mistakes' ? 'Current Mistake Only' : 'Current Collection Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, scope: 'all' })}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                    config.scope === 'all'
                      ? 'bg-brass text-white'
                      : 'bg-surface-2 text-ink hover:bg-surface'
                  }`}
                >
                  {section === 'mistakes' ? 'All Mistakes in This Chapter' : 'All Formulas in This Chapter'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, scope: 'cross-chapter' })}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                    config.scope === 'cross-chapter'
                      ? 'bg-brass text-white'
                      : 'bg-surface-2 text-ink hover:bg-surface'
                  }`}
                >
                  Cross-Chapter (Subject-wide)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Timer */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeTimer}
              onChange={(e) => setConfig({ ...config, includeTimer: e.target.checked, timeMinutes: e.target.checked ? 30 : undefined })}
              className="w-4 h-4 rounded border-line bg-surface-2 text-brass focus:ring-2 focus:ring-brass/50"
            />
            <span className="text-xs font-semibold text-ink-muted">Enable Timer</span>
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
                className="w-full px-3 py-2 pr-20 rounded-lg bg-surface-2 border border-line text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brass/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs font-medium font-mono">
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
            className="flex-1 px-4 py-2 rounded-lg bg-surface-2 border border-line text-ink text-sm font-medium hover:bg-surface transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-brass text-white text-sm font-semibold hover:bg-brass-strong transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
