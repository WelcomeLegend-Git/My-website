import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { trpc } from '../../lib/trpc';
import { JeeDiagram } from '../../features/quiz/components/JeeDiagram';

const normalizeQuizMath = (text: string) => {
  if (!text || !text.includes('\\')) return text;
  // Convert bracketed LaTeX-style segments like ( \rho_e ) or ( \frac{V^2}{R} ) into $...$
  return text.replace(/\(\s*(\\[a-zA-Z][^)]*)\s*\)/g, (_match, inner) => `$${inner.trim()}$`);
};

type Answer = number[]; // Array of selected option indices

export const QuizPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: quiz, isLoading } = trpc.quiz.getQuiz.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const submitMutation = trpc.quiz.submitQuiz.useMutation({
    onSuccess: async (data) => {
      // Invalidate quiz cache so results page gets fresh data
      await utils.quiz.getQuiz.invalidate({ id: id! });
      navigate(`/quiz/${id}/results?attemptId=${data.attemptId}`);
    },
  });

  // Initialize timer
  useEffect(() => {
    if (quiz?.includeTimer && quiz.timeMinutes) {
      setTimeRemaining(quiz.timeMinutes * 60); // Convert to seconds
    }
  }, [quiz]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmit(); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const isMultipleCorrect = quiz?.answerType === 'multiple';

  const handleOptionClick = (optionIndex: number) => {
    if (!currentQuestion) return;

    setAnswers((prev) => {
      const current = prev[currentQuestion.id] || [];
      
      if (isMultipleCorrect) {
        // Toggle selection for multiple correct
        if (current.includes(optionIndex)) {
          return {
            ...prev,
            [currentQuestion.id]: current.filter((i) => i !== optionIndex),
          };
        } else {
          return {
            ...prev,
            [currentQuestion.id]: [...current, optionIndex],
          };
        }
      } else {
        // Single correct - replace selection
        return {
          ...prev,
          [currentQuestion.id]: [optionIndex],
        };
      }
    });
  };

  const handleSubmit = async () => {
    if (!quiz || isSubmitting) return;

    setIsSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      await submitMutation.mutateAsync({
        quizId: quiz.id,
        answers,
        timeSpent,
      });
    } catch (error) {
      alert('Failed to submit quiz. Please try again.');
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = useMemo(() => {
    if (!quiz) return 0;
    return (Object.keys(answers).length / quiz.questions.length) * 100;
  }, [answers, quiz]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz || !currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <p className="text-red-400 text-lg">Quiz not found</p>
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

  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const selectedOptions = answers[currentQuestion.id] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3 sm:p-6 pb-20 sm:pb-0">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-4 sm:mb-6">
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-primary/20">
          <div className="flex items-center justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 leading-tight">{quiz.title}</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                {quiz.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'} •{' '}
                {isMultipleCorrect ? 'Multiple Correct' : 'Single Correct'}
              </p>
            </div>
            {timeRemaining !== null && (
              <div className="text-center flex-shrink-0">
                <div className={`text-xl sm:text-3xl font-bold ${timeRemaining < 60 ? 'text-red-400' : 'text-primary'}`}>
                  {formatTime(timeRemaining)}
                </div>
                <p className="hidden sm:block text-xs text-slate-400 mt-1">Time Remaining</p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Answered: {Object.keys(answers).length} / {quiz.questions.length}
          </p>
        </div>
      </div>

      {/* Question Card */}
      <div className="max-w-5xl mx-auto">
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-slate-800/50">
          {/* Question Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="px-3 sm:px-4 py-1.5 bg-primary/20 text-primary rounded-lg font-semibold text-xs sm:text-sm">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </span>
              {isMultipleCorrect && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium">
                  Multiple Correct
                </span>
              )}
            </div>
          </div>

          {/* Question Text */}
          <div className="prose prose-invert prose-sm sm:prose-base lg:prose-lg max-w-none mb-6 sm:mb-8">
            <ReactMarkdown
              remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
            >
              {normalizeQuizMath(currentQuestion.questionText)}
            </ReactMarkdown>
          </div>

          {/* Optional diagram (JSXGraph via Gemini config) */}
          {currentQuestion.diagram && (
            <div className="mb-6 sm:mb-8">
              <JeeDiagram diagram={currentQuestion.diagram as any} />
            </div>
          )}

          {/* Options */}
          <div className="space-y-2 sm:space-y-3">
            {(currentQuestion.options as string[]).map((option, index) => {
              const isSelected = selectedOptions.includes(index);
              const optionLabel = String.fromCharCode(65 + index); // A, B, C, D

              return (
                <button
                  key={index}
                  onClick={() => handleOptionClick(index)}
                  className={`w-full text-left p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/25'
                      : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >
                      {optionLabel}
                    </div>
                    <div className="flex-1 prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                      >
                        {normalizeQuizMath(option)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-800">
            {/* Question Navigation - Desktop */}
            <div className="hidden sm:flex gap-2 flex-wrap">
              {quiz.questions.map((__unused: unknown, index: number) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                    index === currentQuestionIndex
                      ? 'bg-primary text-white shadow-lg shadow-primary/25'
                      : answers[quiz.questions[index].id]
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          
            {/* Previous/Next Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                ← Previous
              </button>

              {isLastQuestion ? (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 sm:px-8 py-2 sm:py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 flex items-center gap-2 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Quiz
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(quiz.questions.length - 1, prev + 1))}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all flex items-center gap-2 text-sm sm:text-base"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile sticky bottom question nav */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-3 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {quiz.questions.map((__unused: unknown, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`flex-shrink-0 w-9 h-9 rounded-lg font-medium text-xs transition-all ${
                  index === currentQuestionIndex
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : answers[quiz.questions[index].id]
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mobile-only sticky question nav
// Rendered via portal-like placement at the bottom of the page container
// to avoid overlapping content we added pb-20 to the main wrapper.

