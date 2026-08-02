import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useShellContext } from "../../app/layouts/useShellContext";
import { trpc } from "../../lib/trpc";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { setAiSection, setAiContext } = useShellContext();

  // Fetch real data
  const { data: mistakes } = trpc.mistakes.list.useQuery(undefined);
  const { data: history } = trpc.studyApi.getHistory.useQuery({ limit: 50 });

  // Calculate real stats
  const stats = useMemo(() => {
    const resolvedMistakes = (mistakes as any[])?.filter(m => m.status === 'resolved') || [];
    const totalMistakes = (mistakes as any[])?.length || 0;
    
    // Calculate resolved by subject
    const bySubject: Record<string, number> = {};
    resolvedMistakes.forEach(m => {
      const subjectName = m.subject.name;
      bySubject[subjectName] = (bySubject[subjectName] || 0) + 1;
    });

    // Calculate mastery momentum (based on resolved vs total mistakes)
    const masteryPercentage = totalMistakes > 0 
      ? Math.round((resolvedMistakes.length / totalMistakes) * 100)
      : 0;

    // Calculate review streak
    let streak = 0;
    if (history && history.length > 0) {
      const dates = (history as any[]).map(session => new Date(session.createdAt).toDateString());
      const uniqueDates = [...new Set(dates)].map(d => new Date(d));
      uniqueDates.sort((a, b) => b.getTime() - a.getTime()); // descending

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (uniqueDates[0].getTime() === today.getTime() || uniqueDates[0].getTime() === yesterday.getTime()) {
        streak = 1;
        let lastDate = uniqueDates[0];
        for (let i = 1; i < uniqueDates.length; i++) {
          const expectedPrevDate = new Date(lastDate);
          expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);
          if (uniqueDates[i].getTime() === expectedPrevDate.getTime()) {
            streak++;
            lastDate = uniqueDates[i];
          } else {
            break;
          }
        }
      }
    }

    return {
      resolvedCount: resolvedMistakes.length,
      bySubject,
      masteryPercentage,
      streak,
    };
  }, [mistakes, history]);

  useEffect(() => {
    setAiSection("study");
    // Set Dashboard context
    setAiContext({
      type: 'dashboard',
      entity: 'dashboard',
      stats: {
        masteryPercentage: stats.masteryPercentage,
        resolvedCount: stats.resolvedCount,
      },
    });
  }, [setAiContext, setAiSection, stats.masteryPercentage, stats.resolvedCount]);

  return (
    <section className="space-y-8">
      {/* Header */}
      <header className="fade-in-up">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brass-soft flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink font-display">Daily Snapshot</h2>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-ink-muted line-clamp-1 sm:line-clamp-none">Track readiness, review streaks, and next actions.</p>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Mastery Momentum Card */}
        <div className="group relative stagger-item">
          <div className="relative h-full glass-card rounded-2xl p-6 hover:border-brass/40 transition-colors hover-lift">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-brass font-mono font-bold flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Mastery Momentum
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center">
                <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-end gap-1.5 sm:gap-2">
                <p className="text-4xl sm:text-5xl font-bold text-ink font-mono">{stats.masteryPercentage}</p>
                <span className="text-xl sm:text-2xl font-semibold text-brass mb-0.5 sm:mb-1 font-mono">%</span>
              </div>
              <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-brass rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.masteryPercentage}%` }}></div>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">Based on formula reviews, resolved mistakes, and quiz accuracy from the past week.</p>
            </div>
          </div>
        </div>

        {/* Review Streak Card */}
        <div className="group relative stagger-item">
          <div className="relative h-full glass-card rounded-2xl p-6 hover:border-brass/40 transition-colors hover-lift">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-brass font-mono font-bold flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  Review Streak
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center">
                <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-end gap-2 sm:gap-3">
                <p className="text-4xl sm:text-5xl font-bold text-ink font-mono">{stats.streak}</p>
                <span className="text-base sm:text-lg font-medium text-brass mb-1.5 sm:mb-2 font-mono">days</span>
                <div className="flex gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < stats.streak ? 'bg-brass' : 'bg-surface-2'}`}></div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">Keep it going to solidify long-term retention and build mastery momentum.</p>
            </div>
          </div>
        </div>

        {/* Mistakes Resolved Card */}
        <div className="group relative stagger-item md:col-span-2 xl:col-span-1">
          <div className="relative h-full glass-card rounded-2xl p-6 hover:border-brass/40 transition-colors hover-lift">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-brass font-mono font-bold flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Mistakes Resolved
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center">
                <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <p className="text-4xl sm:text-5xl font-bold text-ink font-mono">{stats.resolvedCount}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.bySubject).map(([subject, count]) => (
                  <span key={subject} className="px-3 py-1.5 rounded-lg bg-brass-soft border border-brass/20 text-xs font-mono font-medium text-brass">
                    {subject}: {count}
                  </span>
                ))}
                {Object.keys(stats.bySubject).length === 0 && (
                  <span className="text-xs text-ink-muted">No resolved mistakes yet</span>
                )}
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">Great progress this month! Keep tracking and resolving.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card rounded-2xl sm:rounded-2xl p-4 sm:p-6 fade-in-up">
        <h3 className="text-lg sm:text-xl font-bold text-ink font-display mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button 
            onClick={() => navigate('/formulas?intent=add-formula')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Add Formula</p>
            <p className="text-xs text-ink-muted mt-1">Capture a new derivation</p>
          </button>
          <button 
            onClick={() => navigate('/mistakes?intent=log-mistake')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Log Mistake</p>
            <p className="text-xs text-ink-muted mt-1">Record a learning moment</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/study-coach')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Study Coach</p>
            <p className="text-xs text-ink-muted mt-1">Chat with Study Guru</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/bookmarks')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Bookmarks</p>
            <p className="text-xs text-ink-muted mt-1">Review saved insights</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/remote-bridge')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Remote Call Hub</p>
            <p className="text-xs text-ink-muted mt-1">Control phone on iPad</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/ludo')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3h8l2 4-2 4H8L6 7l2-4zm0 10h8l2 4-2 4H8l-2-4 2-4zm-5-5h2m14 0h2M12 1v2m0 18v2" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">Ludo Arena</p>
            <p className="text-xs text-ink-muted mt-1">Play solo or with friends</p>
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/anatomy')}
            className="p-4 rounded-2xl border border-line hover:border-brass/50 bg-surface-2 hover:bg-surface transition-all duration-300 hover-lift text-left">
            <div className="w-10 h-10 rounded-xl bg-brass-soft flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="font-semibold text-ink text-sm">3D Anatomy</p>
            <p className="text-xs text-ink-muted mt-1">WebGL Explorer</p>
          </button>
        </div>
      </div>
    </section>
  );
};