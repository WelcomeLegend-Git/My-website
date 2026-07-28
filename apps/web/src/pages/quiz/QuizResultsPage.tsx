import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { trpc } from '../../lib/trpc';
import { JeeDiagram } from '../../features/quiz/components/JeeDiagram';

const ReactMarkdownAny: any = ReactMarkdown;
const trpcAny: any = trpc as any;

const normalizeQuizMath = (text: string, opts?: { treatAsPureMath?: boolean }) => {
  if (!text) return text;

  let value = text;

  if (!value.includes('\\')) return value;

  value = value
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$/');

  // Soften problematic sizing/exponent patterns from the AI
  value = value
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '')
    .replace(/\)\s*\^/g, ')^');

  // Convert bracketed LaTeX-style segments like ( \\rho_e ) or ( \\frac{V^2}{R} ) into $...$
  value = value.replace(/\(\s*(\\[a-zA-Z][^)]*)\s*\)/g, (_match, inner) => `$${inner.trim()}$`);

  const hasDollar = value.includes('$');
  const hasMathMacro = /\\(frac|sqrt|sum|int|log|ln|sin|cos|tan|cot|sec|csc|theta|pi|mu|rho|alpha|beta|gamma|delta|lambda|omega|cdot|times|leq|geq|approx)/.test(
    value,
  );

  if (!hasDollar && hasMathMacro && (opts?.treatAsPureMath || !/[.?!]/.test(value))) {
    value = `$${value}$`;
  }

  return value;
};
import type { ShellOutletContext } from '../../app/layouts/ShellLayout';

type QuizResultsSectionBoundaryProps = {
  children: ReactNode;
};

type QuizResultsSectionBoundaryState = {
  hasError: boolean;
};

class QuizResultsSectionBoundary extends React.Component<
  QuizResultsSectionBoundaryProps,
  QuizResultsSectionBoundaryState
> {
  constructor(props: QuizResultsSectionBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Quiz results render error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          We couldn't render the detailed question analysis for this attempt. You can still review the
          score summary above or go back to Quiz History.
        </div>
      );
    }

    return this.props.children;
  }
}

export const QuizResultsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const attemptId = searchParams.get('attemptId');
  const { setAiContext, setAiSection } = useOutletContext<ShellOutletContext>();
  const utils = trpcAny.useUtils();

  const highlightQuiz = searchParams.get('highlight') === '1';
  const highlightQuestionId = searchParams.get('highlightQuestionId');
  const [highlightHeader, setHighlightHeader] = useState(false);

  const { data: quiz, isLoading } = trpcAny.quiz.getQuiz.useQuery(
    { id: id! },
    { 
      enabled: !!id,
      refetchOnMount: 'always', // Always fetch fresh data when results page loads
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    }
  );

  const score = quiz?.score ?? 0;
  const accuracy = quiz?.accuracy ?? 0;
  const timeSpent = (quiz as any)?.actualTimeSpent ?? quiz?.timeSpent ?? 0;

  type QuestionInsight = {
    id: string;
    index: number;
    topic: string | null;
    difficulty: string | null;
    isCorrect: boolean;
    hasPartial: boolean;
    isUnanswered: boolean;
    userAnswers: number[];
    correctAnswers: number[];
    explanation: string;
  };

  const userAnswersMap = quiz
    ? ((quiz as any).userAnswers as Record<string, number[]> | undefined)
    : undefined;

  const quizBookmarkStatusQuery = trpcAny.bookmarks.getStatusForEntities.useQuery(
    {
      entityType: 'practice_quiz',
      targets: quiz ? [{ entityId: quiz.id }] : [],
    },
    {
      enabled: !!quiz,
    },
  );

  const questionBookmarkStatusQuery = trpcAny.bookmarks.getStatusForEntities.useQuery(
    {
      entityType: 'practice_question',
      targets: quiz ? quiz.questions.map((q: any) => ({ entityId: q.id })) : [],
    },
    {
      enabled: !!quiz && quiz.questions.length > 0,
    },
  );

  const toggleBookmarkMutation = trpcAny.bookmarks.toggle.useMutation();

  const isQuizBookmarked = !!(quizBookmarkStatusQuery.data?.items ?? []).some(
    (item: any) => item && item.entityId === (quiz?.id ?? ''),
  );

  const bookmarkedQuestionIds = useMemo(() => {
    const set = new Set<string>();
    (questionBookmarkStatusQuery.data?.items ?? []).forEach((item: any) => {
      if (!item) return;
      set.add(item.entityId);
    });
    return set;
  }, [questionBookmarkStatusQuery.data]);

  const questionInsights = useMemo<QuestionInsight[]>(() => {
    if (!quiz) return [];

    return quiz.questions.map((question: any, index: number) => {
      const userAnswers = userAnswersMap?.[question.id] || [];
      const correctAnswers = (question.correctAnswers as number[]) || [];
      const isUnanswered = userAnswers.length === 0;
      const isCorrect =
        !isUnanswered &&
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((ans) => correctAnswers.includes(ans));
      const hasPartial =
        !isUnanswered && userAnswers.some((ans) => correctAnswers.includes(ans)) && !isCorrect;

      return {
        id: question.id,
        index: index + 1,
        topic: question.topic ?? null,
        difficulty: (question.difficulty as string | null) ?? null,
        isCorrect,
        hasPartial,
        isUnanswered,
        userAnswers,
        correctAnswers,
        explanation: question.explanation ?? '',
      };
    });
  }, [quiz, userAnswersMap]);

  useEffect(() => {
    if (!quiz) return;

    setAiSection('study');
    setAiContext({
      type: 'quiz_results',
      quizId: quiz.id,
      attemptId,
      title: quiz.title,
      examType: quiz.examType,
      answerType: quiz.answerType,
      totalQuestions: quiz.questions.length,
      score,
      correctCount: quiz.correctCount || 0,
      partialCount: quiz.partialCount || 0,
      attemptedCount: quiz.attemptedCount || 0,
      unattemptedCount: quiz.questions.length - (quiz.attemptedCount || 0),
      timeSpentSeconds: timeSpent,
      includeTimer: quiz.includeTimer,
      timeLimitMinutes: quiz.timeMinutes || null,
      questionInsights,
    });

    return () => {
      setAiContext(undefined);
    };
  }, [attemptId, questionInsights, quiz, score, setAiContext, setAiSection, timeSpent]);

  useEffect(() => {
    if (!highlightQuiz) return;
    setHighlightHeader(true);
    const timeout = window.setTimeout(() => setHighlightHeader(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [highlightQuiz]);

  const handleToggleQuizBookmark = async () => {
    if (!quiz) return;

    try {
      await toggleBookmarkMutation.mutateAsync({
        entityType: 'practice_quiz',
        entityId: quiz.id,
        metadata: {
          title: quiz.title,
          examType: quiz.examType,
          questionCount: quiz.questions.length,
          score,
          accuracy,
        },
      });

      await Promise.all([
        quizBookmarkStatusQuery.refetch(),
        utils.bookmarks.listByCategory.invalidate({ category: 'quizzes' }).catch(() => undefined),
      ]);
    } catch {
      // ignore for now
    }
  };

  const handleToggleQuestionBookmark = async (questionId: string, index: number) => {
    if (!quiz) return;

    const question = quiz.questions.find((q: any) => q.id === questionId);
    if (!question) return;

    try {
      await toggleBookmarkMutation.mutateAsync({
        entityType: 'practice_question',
        entityId: question.id,
        metadata: {
          quizId: quiz.id,
          quizTitle: quiz.title,
          questionIndex: index + 1,
          difficulty: question.difficulty,
          topic: question.topic,
        },
      });

      await Promise.all([
        questionBookmarkStatusQuery.refetch(),
        utils.bookmarks.listByCategory.invalidate({ category: 'quizzes' }).catch(() => undefined),
      ]);
    } catch {
      // ignore for now
    }
  };

  // Keep hooks above, and branch on loading / missing data after hooks
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brass border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink-muted">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <div className="text-center">
          <p className="text-red-500 text-lg">Results not found</p>
          <button
            onClick={() => navigate('/formulas')}
            className="mt-4 px-6 py-2 bg-brass text-white rounded-lg hover:bg-brass-strong transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-signal';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'Outstanding! 🎉';
    if (score >= 80) return 'Excellent! 🌟';
    if (score >= 70) return 'Very Good! 👍';
    if (score >= 60) return 'Good! 😊';
    if (score >= 50) return 'Fair 🤔';
    return 'Needs Improvement 📚';
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
        {/* Score Card */}
        <div
          className={
            "glass-card rounded-2xl p-8 border mb-6 relative overflow-hidden " +
            (highlightHeader
              ? "border-brass/70"
              : "border-line")
          }
        >
          <div className="relative">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brass-soft text-signal font-mono rounded-full text-sm font-semibold mb-4">
                <span>Quiz Completed!</span>
                <button
                  type="button"
                  onClick={handleToggleQuizBookmark}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-300 ${
                    isQuizBookmarked
                      ? 'bg-surface-2 border-brass/30 text-brass'
                      : 'bg-surface-2 border-line text-ink-muted hover:text-ink hover:bg-surface'
                  }`}
                  title={isQuizBookmarked ? 'Remove bookmark' : 'Bookmark quiz'}
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 ${isQuizBookmarked ? 'scale-110' : 'scale-90'}`}
                    fill={isQuizBookmarked ? 'currentColor' : 'none'}
                    stroke={isQuizBookmarked ? 'none' : 'currentColor'}
                    strokeWidth={isQuizBookmarked ? 0 : 2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                </button>
              </div>
              <h1 className="text-3xl font-bold text-ink font-display mb-2">{quiz.title}</h1>
              <p className="text-ink-muted font-mono">
                {quiz.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'} Practice
              </p>
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-card rounded-xl p-6 border border-line text-center">
                <p className="text-ink-muted text-sm mb-2">Your Score</p>
                <p className={`text-5xl font-bold font-mono ${getScoreColor(score)}`}>
                  {score.toFixed(1)}%
                </p>
                <p className="text-ink-muted text-sm mt-2">{getScoreGrade(score)}</p>
              </div>

              <div className="glass-card rounded-xl p-6 border border-line text-center">
                <p className="text-ink-muted text-sm mb-2">Correct Answers</p>
                <p className="text-5xl font-bold text-brass font-mono">
                  {accuracy}
                </p>
                <p className="text-ink-muted text-sm mt-2">
                  out of {quiz.questions.length}
                </p>
              </div>

              <div className="glass-card rounded-xl p-6 border border-line text-center">
                <p className="text-ink-muted text-sm mb-2">Time Spent</p>
                <p className="text-5xl font-bold text-brass font-mono">
                  {formatTime(timeSpent)}
                </p>
                {quiz.includeTimer && quiz.timeMinutes && (
                  <p className="text-ink-muted text-sm mt-2 font-mono">
                    Limit: {quiz.timeMinutes} min
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => navigate('/formulas')}
                className="px-6 py-2.5 rounded-lg bg-surface-2 text-ink font-medium hover:bg-surface transition-all"
              >
                Back to Formulas
              </button>
              <button
                onClick={() => navigate(`/quiz/${id}`)}
                className="px-6 py-2.5 rounded-lg bg-brass text-white font-medium hover:bg-brass-strong transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Quiz
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Question Analysis */}
        <QuizResultsSectionBoundary>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold font-display text-ink mb-4">Question Analysis</h2>
            
            {quiz.questions.map((question: any, index: number) => {
            const insight = questionInsights[index];
            const userAnswers = insight.userAnswers;
            const correctAnswers = insight.correctAnswers;
            const isUnanswered = insight.isUnanswered;
            const isCorrect = insight.isCorrect;
            const hasPartial = insight.hasPartial;

            const isQuestionHighlighted = highlightQuestionId === question.id;
            const isQuestionBookmarked = bookmarkedQuestionIds.has(question.id);

            return (
              <div
                key={question.id}
                className={
                  "glass-card rounded-xl p-6 border transition-shadow " +
                  (isQuestionHighlighted
                    ? "border-brass/70"
                    : "border-line")
                }
              >
                {/* Question Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-surface-2 text-ink-muted font-mono rounded-lg text-sm font-semibold">
                      Q{index + 1}
                    </span>
                    {isUnanswered ? (
                      <span className="px-3 py-1 bg-surface-2 text-ink-muted rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        Not Answered
                      </span>
                    ) : isCorrect ? (
                      <span className="px-3 py-1 bg-brass-soft text-signal rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Correct
                      </span>
                    ) : hasPartial ? (
                      <span className="px-3 py-1 bg-surface-2 text-amber-500 rounded-lg text-sm font-medium">
                        Partial
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-surface-2 text-red-500 rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Incorrect
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleQuestionBookmark(question.id, index)}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border text-xs transition-all duration-300 ${
                        isQuestionBookmarked
                          ? 'bg-surface-2 border-brass/30 text-brass'
                          : 'bg-surface-2 border-line text-ink-muted hover:text-ink hover:bg-surface'
                      }`}
                      title={isQuestionBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-300 ${
                          isQuestionBookmarked ? 'scale-110' : 'scale-90'
                        }`}
                        fill={isQuestionBookmarked ? 'currentColor' : 'none'}
                        stroke={isQuestionBookmarked ? 'none' : 'currentColor'}
                        strokeWidth={isQuestionBookmarked ? 0 : 2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                    </button>
                    <span className="text-xs text-ink-muted bg-surface-2 font-mono px-2 py-1 rounded">
                      {question.topic}
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="prose prose-invert prose-sm max-w-none mb-4">
                  <ReactMarkdownAny
                    remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  >
                    {normalizeQuizMath(question.questionText)}
                  </ReactMarkdownAny>
                </div>

                {question.diagram && (
                  <div className="mb-4">
                    <JeeDiagram diagram={question.diagram as any} />
                  </div>
                )}

                {/* Options */}
                <div className="space-y-2 mb-4">
                  {(question.options as string[]).map((option, optionIndex) => {
                    const isUserSelected = userAnswers.includes(optionIndex);
                    const isCorrectOption = correctAnswers.includes(optionIndex);
                    const optionLabel = String.fromCharCode(65 + optionIndex);

                    let optionClass = 'border-line bg-surface-2';
                    if (isCorrectOption) {
                      optionClass = 'border-brass/30 bg-brass-soft';
                    } else if (isUserSelected && !isCorrectOption) {
                      optionClass = 'border-red-500/30 bg-red-500/10';
                    }

                    return (
                      <div
                        key={optionIndex}
                        className={`p-3 rounded-lg border-2 ${optionClass}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-ink-muted font-semibold text-sm font-mono">
                              {optionLabel}
                            </span>
                            {isCorrectOption && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-signal" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-signal font-medium">Correct</span>
                              </div>
                            )}
                            {isUserSelected && !isCorrectOption && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-red-500 font-medium">Your Answer</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 prose prose-invert prose-xs max-w-none">
                            <ReactMarkdownAny
                              remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            >
                              {normalizeQuizMath(option, { treatAsPureMath: true })}
                            </ReactMarkdownAny>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {!isCorrect && (
                  <div className="p-4 rounded-lg bg-brass-soft border border-brass/30">
                    <p className="text-brass font-semibold text-sm mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Explanation
                    </p>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdownAny
                        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                      >
                        {normalizeQuizMath(question.explanation)}
                      </ReactMarkdownAny>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </QuizResultsSectionBoundary>
    </div>
  );
};
