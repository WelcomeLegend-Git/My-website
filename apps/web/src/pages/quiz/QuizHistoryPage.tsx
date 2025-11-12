import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import type { ShellOutletContext } from '../../app/layouts/ShellLayout';
import { GlowSelect, type GlowSelectOption } from '../../components/ui/GlowSelect';

type SortOption = 'newest' | 'oldest' | 'score-high' | 'score-low';
type ExamTypeFilter = 'all' | 'mains' | 'advanced';
type SourceTypeFilter = 'all' | 'formula' | 'mistake';

export const QuizHistoryPage = () => {
  const navigate = useNavigate();
  const { setAiContext, setAiSection } = useOutletContext<ShellOutletContext>();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [examTypeFilter, setExamTypeFilter] = useState<ExamTypeFilter>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: quizzes, isLoading } = trpc.quiz.listQuizzes.useQuery();

  // Define GlowSelect options
  const examTypeOptions: GlowSelectOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'mains', label: 'JEE Mains' },
    { value: 'advanced', label: 'JEE Advanced' },
  ];

  const sourceTypeOptions: GlowSelectOption[] = [
    { value: 'all', label: 'All Quizzes' },
    { value: 'formula', label: 'Formula Quizzes' },
    { value: 'mistake', label: 'Mistake Quizzes' },
  ];

  const sortByOptions: GlowSelectOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'score-high', label: 'Highest Score' },
    { value: 'score-low', label: 'Lowest Score' },
  ];

  // Filter and sort quizzes
  const filteredQuizzes = useMemo(() => {
    if (!quizzes) return [];

    let filtered = [...quizzes];

    // Apply exam type filter
    if (examTypeFilter !== 'all') {
      filtered = filtered.filter((q) => q.examType === examTypeFilter);
    }

    // Apply source type filter
    if (sourceTypeFilter !== 'all') {
      filtered = filtered.filter((q) => (q.sourceType || 'formula') === sourceTypeFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((q) =>
        q.title.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'score-high':
          return (b.score || 0) - (a.score || 0);
        case 'score-low':
          return (a.score || 0) - (b.score || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [quizzes, examTypeFilter, sourceTypeFilter, searchQuery, sortBy]);

  // Set AI context for quiz history analysis
  useEffect(() => {
    setAiSection('study');
    
    if (quizzes && quizzes.length > 0) {
      setAiContext({
        type: 'quiz_history',
        totalQuizzes: quizzes.length,
        quizzes: quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          examType: q.examType,
          answerType: q.answerType,
          questionCount: q._count.questions,
          score: q.score || 0,
          accuracy: q.accuracy || 0,
          timeSpent: q.timeSpent || 0,
          completedAt: q.completedAt,
          createdAt: q.createdAt,
        })),
      });
    }

    return () => {
      setAiContext(undefined);
    };
  }, [quizzes, setAiContext, setAiSection]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading quiz history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 min-w-0">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 min-w-0">
          <h1 className="text-3xl font-bold text-white mb-2">Quiz History</h1>
          <p className="text-slate-400">Track your practice sessions and analyze performance</p>
        </div>
        
        {/* Stats Summary */}
        {quizzes && quizzes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glass-card rounded-xl p-4 border border-slate-800/50">
              <p className="text-slate-400 text-sm mb-1">Total Quizzes</p>
              <p className="text-2xl font-bold text-white">{quizzes.length}</p>
            </div>
            <div className="glass-card rounded-xl p-4 border border-slate-800/50">
              <p className="text-slate-400 text-sm mb-1">Average Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(
                quizzes.reduce((acc, q) => acc + (q.score || 0), 0) / quizzes.length
              )}`}>
                {((quizzes.reduce((acc, q) => acc + (q.score || 0), 0) / quizzes.length) || 0).toFixed(1)}%
              </p>
            </div>
            <div className="glass-card rounded-xl p-4 border border-slate-800/50">
              <p className="text-slate-400 text-sm mb-1">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">
                {quizzes.filter((q) => q.completedAt).length}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4 border border-slate-800/50">
              <p className="text-slate-400 text-sm mb-1">Total Time</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatTime(quizzes.reduce((acc, q) => acc + (q.timeSpent || 0), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="flex flex-wrap gap-4 items-center min-w-0">
          {/* Search */}
          <div className="flex-1 min-w-0 sm:min-w-[200px] order-4 sm:order-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quizzes..."
              className="w-full px-4 py-2 rounded-xl border border-slate-800/50 glass text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Source Type Filter */}
          <GlowSelect
            value={sourceTypeFilter}
            onChange={(value) => setSourceTypeFilter(value as SourceTypeFilter)}
            options={sourceTypeOptions}
            placeholder="All Quizzes"
            className="min-w-0 flex-1 sm:flex-none md:w-56 order-2 sm:order-2"
          />

          {/* Exam Type Filter */}
          <GlowSelect
            value={examTypeFilter}
            onChange={(value) => setExamTypeFilter(value as ExamTypeFilter)}
            options={examTypeOptions}
            placeholder="All Types"
            className="min-w-0 flex-1 sm:flex-none md:w-56 order-3 sm:order-3"
          />

          {/* Sort By */}
          <GlowSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as SortOption)}
            options={sortByOptions}
            placeholder="Newest First"
            className="min-w-0 flex-1 sm:flex-none md:w-56 order-1 sm:order-4"
          />
        </div>
      </div>

      {/* Quiz List */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            {searchQuery ? 'No quizzes found' : 'No quiz history yet'}
          </h3>
          <p className="text-slate-500 mb-6">
            {searchQuery 
              ? 'Try adjusting your search or filters'
              : 'Start practicing to see your quiz history here'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate('/formulas')}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all"
            >
              Go to Formulas
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 min-w-0">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              onClick={() => navigate(`/quiz/${quiz.id}/results`)}
              className="glass-card rounded-xl p-6 border border-slate-800/50 hover:border-primary/30 transition-all cursor-pointer hover-lift"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{quiz.title}</h3>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      quiz.examType === 'mains'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {quiz.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'}
                    </span>
                    {quiz.completedAt && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {quiz._count.questions} questions • {quiz.answerType === 'single' ? 'Single' : 'Multiple'} correct • Created {formatDate(quiz.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {quiz.score !== null && quiz.score !== undefined && (
                    <div className="text-right">
                      <p className="text-sm text-slate-400 mb-1">Score</p>
                      <p className={`text-2xl font-bold ${getScoreColor(quiz.score)}`}>
                        {quiz.score.toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {quiz.timeSpent && (
                    <div className="text-right">
                      <p className="text-sm text-slate-400 mb-1">Time</p>
                      <p className="text-lg font-semibold text-purple-400">
                        {formatTime(quiz.timeSpent)}
                      </p>
                    </div>
                  )}
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {quiz.accuracy !== null && quiz.accuracy !== undefined && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{quiz.accuracy} correct out of {quiz._count.questions}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
