import React, { useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { trpc } from '../../lib/trpc';
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
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
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

  const { data: quiz, isLoading } = trpc.quiz.getQuiz.useQuery(
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

  const questionInsights = useMemo<QuestionInsight[]>(() => {
    if (!quiz) return [];

    return quiz.questions.map((question, index) => {
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

  // Keep hooks above, and branch on loading / missing data after hooks
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <p className="text-red-400 text-lg">Results not found</p>
          <button
            onClick={() => navigate('/formulas')}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
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
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
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
        <div className="glass-card rounded-2xl p-8 border border-primary/20 mb-6 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-600/10"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="text-center mb-8">
              <div className="inline-block px-4 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold mb-4">
                Quiz Completed!
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">{quiz.title}</h1>
              <p className="text-slate-400">
                {quiz.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'} Practice
              </p>
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-card rounded-xl p-6 border border-slate-800/50 text-center">
                <p className="text-slate-400 text-sm mb-2">Your Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(score)}`}>
                  {score.toFixed(1)}%
                </p>
                <p className="text-slate-300 text-sm mt-2">{getScoreGrade(score)}</p>
              </div>

              <div className="glass-card rounded-xl p-6 border border-slate-800/50 text-center">
                <p className="text-slate-400 text-sm mb-2">Correct Answers</p>
                <p className="text-5xl font-bold text-primary">
                  {accuracy}
                </p>
                <p className="text-slate-300 text-sm mt-2">
                  out of {quiz.questions.length}
                </p>
              </div>

              <div className="glass-card rounded-xl p-6 border border-slate-800/50 text-center">
                <p className="text-slate-400 text-sm mb-2">Time Spent</p>
                <p className="text-5xl font-bold text-purple-400">
                  {formatTime(timeSpent)}
                </p>
                {quiz.includeTimer && quiz.timeMinutes && (
                  <p className="text-slate-300 text-sm mt-2">
                    Limit: {quiz.timeMinutes} min
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => navigate('/formulas')}
                className="px-6 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-all"
              >
                Back to Formulas
              </button>
              <button
                onClick={() => navigate(`/quiz/${id}`)}
                className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
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
            <h2 className="text-2xl font-bold text-white mb-4">Question Analysis</h2>
            
            {quiz.questions.map((question, index) => {
            const insight = questionInsights[index];
            const userAnswers = insight.userAnswers;
            const correctAnswers = insight.correctAnswers;
            const isUnanswered = insight.isUnanswered;
            const isCorrect = insight.isCorrect;
            const hasPartial = insight.hasPartial;

            return (
              <div
                key={question.id}
                className="glass-card rounded-xl p-6 border border-slate-800/50"
              >
                {/* Question Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold">
                      Q{index + 1}
                    </span>
                    {isUnanswered ? (
                      <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        Not Answered
                      </span>
                    ) : isCorrect ? (
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Correct
                      </span>
                    ) : hasPartial ? (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium">
                        Partial
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Incorrect
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                    {question.topic}
                  </span>
                </div>

                {/* Question Text */}
                <div className="prose prose-invert prose-sm max-w-none mb-4">
                  <ReactMarkdown
                    remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  >
                    {question.questionText}
                  </ReactMarkdown>
                </div>

                {/* Options */}
                <div className="space-y-2 mb-4">
                  {(question.options as string[]).map((option, optionIndex) => {
                    const isUserSelected = userAnswers.includes(optionIndex);
                    const isCorrectOption = correctAnswers.includes(optionIndex);
                    const optionLabel = String.fromCharCode(65 + optionIndex);

                    let optionClass = 'border-slate-700/50 bg-slate-800/30';
                    if (isCorrectOption) {
                      optionClass = 'border-emerald-500/50 bg-emerald-500/10';
                    } else if (isUserSelected && !isCorrectOption) {
                      optionClass = 'border-red-500/50 bg-red-500/10';
                    }

                    return (
                      <div
                        key={optionIndex}
                        className={`p-3 rounded-lg border-2 ${optionClass}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-semibold text-sm">
                              {optionLabel}
                            </span>
                            {isCorrectOption && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-emerald-400 font-medium">Correct</span>
                              </div>
                            )}
                            {isUserSelected && !isCorrectOption && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-red-400 font-medium">Your Answer</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 prose prose-invert prose-xs max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            >
                              {option}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {!isCorrect && (
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-blue-400 font-semibold text-sm mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Explanation
                    </p>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                      >
                        {question.explanation}
                      </ReactMarkdown>
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
