import { useEffect, useState } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";
import { trpc } from "../../lib/trpc";
import { JeeDiagram } from "../../features/quiz/components/JeeDiagram";

type QuizSession = any;
type QuizHistory = any;

export const StudyCoachPage = () => {
  const { setAiSection, setAiContext } = useShellContext();
  const utils = (trpc as any).useUtils();

  const [view, setView] = useState<"home" | "create" | "quiz" | "result">("home");
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Queries
  const { data: subjects } = (trpc as any).subjects.list.useQuery();
  const { data: history } = (trpc as any).studyApi.getHistory.useQuery({ limit: 10 });

  // Mutations
  const createSessionMutation = (trpc as any).studyApi.createSession.useMutation();
  const submitAnswerMutation = (trpc as any).studyApi.submitAnswer.useMutation();
  const completeSessionMutation = (trpc as any).studyApi.completeSession.useMutation();
  const deleteSessionMutation = (trpc as any).studyApi.deleteSession.useMutation();

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
  }, [setAiContext, setAiSection]);

  const startQuizCreation = () => {
    setView("create");
  };

  const handleCreateQuiz = async (data: {
    title: string;
    subjectId: string;
    chapterId?: string;
    questionCount: number;
  }) => {
    try {
      // Get all formulas for the selected subject/chapter
      const formulas = await utils.formulas.list.fetch({
        subjectId: data.subjectId,
        chapterId: data.chapterId,
      });

      if (!formulas || formulas.length === 0) {
        alert("No formulas found for this selection. Add some formulas first!");
        return;
      }

      const formulaIds = (formulas as any[]).map((f: any) => f.id);

      const session = await createSessionMutation.mutateAsync({
        title: data.title,
        type: "formula_based",
        subjectId: data.subjectId,
        chapterId: data.chapterId,
        formulaIds,
        questionCount: Math.min(data.questionCount, formulas.length * 2),
      });

      setActiveSession(session);
      setCurrentQuestionIndex(0);
      setScore({ correct: 0, total: 0 });
      setView("quiz");
    } catch (error) {
      console.error("Failed to create quiz:", error);
      alert("Failed to generate quiz. Please try again.");
    }
  };

  const handleAnswerSubmit = async (answerIndex: number) => {
    if (!activeSession) return;

    const currentQuestion = activeSession.questions[currentQuestionIndex];
    if (!currentQuestion || currentQuestion.userAnswer !== null) return;

    try {
      const result = await submitAnswerMutation.mutateAsync({
        questionId: currentQuestion.id,
        answerIndex,
      });

      if (result.isCorrect) {
        setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
      }
      setScore((prev) => ({ ...prev, total: prev.total + 1 }));

      // Update local session state
      const updatedQuestions = [...activeSession.questions];
      updatedQuestions[currentQuestionIndex] = {
        ...currentQuestion,
        userAnswer: answerIndex,
        isCorrect: result.isCorrect,
      };
      setActiveSession({ ...activeSession, questions: updatedQuestions });

      // Move to next question or show results
      setTimeout(() => {
        if (currentQuestionIndex + 1 < activeSession.questions.length) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
          completeSessionMutation.mutate({ sessionId: activeSession.id });
          setView("result");
        }
      }, 1500);
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;

    try {
      await deleteSessionMutation.mutateAsync({ sessionId });
      await utils.studyApi.getHistory.invalidate();
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const resetQuiz = () => {
    setActiveSession(null);
    setCurrentQuestionIndex(0);
    setScore({ correct: 0, total: 0 });
    setView("home");
    utils.studyApi.getHistory.invalidate();
  };

  if (view === "create") {
    return (
      <QuizCreationView
        subjects={(subjects as any[])}
        isCreating={createSessionMutation.isPending}
        onCancel={() => setView("home")}
        onCreate={handleCreateQuiz}
      />
    );
  }

  if (view === "quiz" && activeSession) {
    const currentQuestion = activeSession.questions[currentQuestionIndex];
    return (
      <QuizTakingView
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={activeSession.questions.length}
        score={score}
        isSubmitting={submitAnswerMutation.isPending}
        onSubmitAnswer={handleAnswerSubmit}
        onQuit={resetQuiz}
      />
    );
  }

  if (view === "result" && activeSession) {
    return (
      <QuizResultView
        session={activeSession}
        score={score}
        onRestart={resetQuiz}
      />
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-ink">Study Coach</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Generate AI-powered quizzes from your formulas and track your progress.
        </p>
      </header>

      <div className="rounded-2xl border border-line bg-paper/60 p-8 text-center">
        <h3 className="text-xl font-semibold text-ink">Ready to test your knowledge?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Create a custom quiz based on your saved formulas and let AI generate challenging questions.
        </p>
        <button
          type="button"
          className="mt-6 rounded-xl bg-brass px-6 py-3 text-sm font-semibold text-paper hover:bg-brass-soft"
          onClick={startQuizCreation}
        >
          Create New Quiz
        </button>
      </div>

      {history && history.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-ink">Recent Quizzes</h3>
          <div className="space-y-3">
            {history.map((session: any) => (
              <QuizHistoryCard
                key={session.id}
                session={session}
                onDelete={() => handleDeleteSession(session.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

// Sub-components
type QuizCreationViewProps = {
  subjects: any[];
  isCreating: boolean;
  onCancel: () => void;
  onCreate: (data: {
    title: string;
    subjectId: string;
    chapterId?: string;
    questionCount: number;
  }) => void;
};

const QuizCreationView = ({ subjects, isCreating, onCancel, onCreate }: QuizCreationViewProps) => {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [questionCount, setQuestionCount] = useState(5);

  const chapters = (subjects as any[]).find((s: any) => s.id === subjectId)?.chapters || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subjectId) return;

    onCreate({
      title,
      subjectId,
      chapterId: chapterId || undefined,
      questionCount,
    });
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-ink">Create Quiz</h2>
          <p className="mt-1 text-sm text-ink-muted">Configure your AI-generated quiz</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-line px-4 py-2 text-sm text-ink-muted hover:border-brass/40"
          onClick={onCancel}
        >
          Cancel
        </button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-line bg-paper/60 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-muted">Quiz Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g., Physics - Kinematics Practice"
            className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-sm text-ink"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink-muted">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setChapterId("");
              }}
              className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-sm text-ink"
              required
            >
              <option value="">Select subject</option>
              {(subjects as any[]).map((subject: any) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink-muted">
              Chapter <span className="text-ink-muted">(optional)</span>
            </label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-sm text-ink"
              disabled={!subjectId}
            >
              <option value="">All chapters</option>
              {chapters.map((chapter: any) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink-muted">
            Number of Questions: {questionCount}
          </label>
          <input
            type="range"
            min="3"
            max="15"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full"
          />
          <p className="mt-1 text-xs text-ink-muted">Generates 3-15 AI-powered questions</p>
        </div>

        <button
          type="submit"
          disabled={isCreating || !title || !subjectId}
          className="w-full rounded-xl bg-brass px-6 py-3 text-sm font-semibold text-paper hover:bg-brass-soft disabled:opacity-50"
        >
          {isCreating ? "Generating Quiz..." : "Generate Quiz with AI"}
        </button>
      </form>
    </section>
  );
};

type QuizTakingViewProps = {
  question: any;
  questionNumber: number;
  totalQuestions: number;
  score: { correct: number; total: number };
  isSubmitting: boolean;
  onSubmitAnswer: (answerIndex: number) => void;
  onQuit: () => void;
};

const QuizTakingView = ({
  question,
  questionNumber,
  totalQuestions,
  score,
  isSubmitting,
  onSubmitAnswer,
  onQuit,
}: QuizTakingViewProps) => {
  const hasAnswered = question.userAnswer !== null;
  const options = question.options as string[];

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-ink">
            Question {questionNumber} of {totalQuestions}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Score: {score.correct} / {score.total}
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-500 hover:border-red-500"
          onClick={onQuit}
        >
          Quit Quiz
        </button>
      </header>

      <div className="space-y-6 rounded-2xl border border-line bg-paper/60 p-8">
        <div className="text-lg text-ink">{question.questionText}</div>
        {/* Render diagram if available */}
        {question.diagram && (
          <div className="my-6">
            <JeeDiagram diagram={question.diagram as any} />
          </div>
        )}

        <div className="space-y-3">
          {options.map((option, index) => {
            const isSelected = question.userAnswer === index;
            const isCorrect = index === question.correctAnswer;
            const showResult = hasAnswered;

            let buttonClass =
              "w-full rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed";

            if (showResult) {
              if (isCorrect) {
                buttonClass += " border-green-500 bg-green-500/10 text-green-300";
              } else if (isSelected) {
                buttonClass += " border-red-500 bg-red-500/10 text-red-500";
              } else {
                buttonClass += " border-line bg-paper/40 text-ink-muted";
              }
            } else {
              buttonClass +=
                " border-line bg-paper text-ink hover:border-brass/40 hover:bg-brass-soft";
            }

            return (
              <button
                key={index}
                type="button"
                className={buttonClass}
                onClick={() => !hasAnswered && onSubmitAnswer(index)}
                disabled={hasAnswered || isSubmitting}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-sm font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        {hasAnswered && question.explanation && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <h4 className="text-sm font-semibold text-blue-300">Explanation</h4>
            <p className="mt-2 text-sm text-ink-muted">{question.explanation}</p>
          </div>
        )}
      </div>
    </section>
  );
};

type QuizResultViewProps = {
  session: QuizSession;
  score: { correct: number; total: number };
  onRestart: () => void;
};

const QuizResultView = ({ session, score, onRestart }: QuizResultViewProps) => {
  const percentage = (score.correct / score.total) * 100;
  const passed = percentage >= 60;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-ink">Quiz Completed!</h2>
        <p className="mt-1 text-sm text-ink-muted">{session.title}</p>
      </header>

      <div className="space-y-6 rounded-2xl border border-line bg-paper/60 p-8 text-center">
        <div className={`text-6xl font-bold ${passed ? "text-green-400" : "text-red-500"}`}>
          {score.correct}/{score.total}
        </div>
        <div className="text-xl text-ink-muted">{percentage.toFixed(0)}% Correct</div>

        <div className="mx-auto max-w-md space-y-3 text-sm text-ink-muted">
          <p>
            {passed
              ? "Great job! You're making excellent progress."
              : "Keep practicing! Review the formulas and try again."}
          </p>
        </div>

        <button
          type="button"
          className="rounded-xl bg-brass px-6 py-3 text-sm font-semibold text-paper hover:bg-brass-soft"
          onClick={onRestart}
        >
          Back to Study Coach
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-paper/60 p-6">
        <h3 className="text-lg font-semibold text-ink">Question Review</h3>
        <div className="space-y-3">
          {session.questions.map((q: any, index: number) => (
            <div
              key={q.id}
              className={`rounded-lg border p-4 ${
                q.isCorrect
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-red-500/20 bg-red-500/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    q.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-ink">{q.questionText}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Your answer: {(q.options as string[])[q.userAnswer!]} •{" "}
                    Correct: {(q.options as string[])[q.correctAnswer]}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

type QuizHistoryCardProps = {
  session: QuizHistory;
  onDelete: () => void;
};

const QuizHistoryCard = ({ session, onDelete }: QuizHistoryCardProps) => {
  const answeredCount = session.questions.filter((q: any) => q.isCorrect !== null).length;
  const correctCount = session.questions.filter((q: any) => q.isCorrect === true).length;
  const percentage = answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0;

  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-paper/60 p-4">
      <div>
        <h4 className="font-medium text-ink">{session.title}</h4>
        <p className="mt-1 text-xs text-ink-muted">
          {session.completedAt
            ? `Completed • ${percentage.toFixed(0)}% • ${correctCount}/${answeredCount}`
            : "In progress"}
        </p>
      </div>
      <button
        type="button"
        className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-500 hover:border-red-500"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
};
