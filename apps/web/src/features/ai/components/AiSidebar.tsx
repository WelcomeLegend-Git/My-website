import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { trpc } from "../../../lib/trpc";
import { QuizConfigForm, type QuizConfig } from '../../quiz/components/QuizConfigForm';
import { AiAccessModal } from './AiAccessModal';

// Helper to ensure LaTeX delimiters are correct
const ensureMathDelimiters = (text: string): string => {
  if (!text) return text;
  
  let processed = text;
  
  // Convert \(...\) to $...$  (inline math)
  processed = processed.replace(/\\\((.+?)\\\)/g, (match, p1) => `$${p1}$`);
  
  // Convert \[...\] to $$...$$ (display math)
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (match, p1) => `$$${p1}$$`);
  
  return processed;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  open: boolean;
  section: "formulas" | "mistakes" | "study";
  context?: Record<string, unknown>;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export const AiSidebar = ({ open, section, context }: Props) => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  // Check if user has verified AI access on mount
  useEffect(() => {
    const verified = localStorage.getItem("ai_access_verified") === "true";
    setIsVerified(verified);
    if (!verified && open) {
      setShowVerification(true);
    }
  }, [open]);

  const handleVerified = () => {
    setIsVerified(true);
    setShowVerification(false);
  };

  const mutation = trpc.studyApi.contextualAssistant.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: data.reply },
      ]);
    },
  });

  const quizMutation = trpc.quiz.generateQuiz.useMutation({
    onSuccess: (data) => {
      // Navigate to quiz page
      navigate(`/quiz/${data.quizId}`);
    },
    // Don't use onError - we handle errors in handleQuizSubmit catch block
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }
    const content = input.trim();
    
    // Detect if user wants to practice
    const practiceKeywords = ['practice', 'quiz', 'test', 'questions', 'exam', 'solve'];
    const wantsPractice = practiceKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
    
    if (wantsPractice && (section === 'formulas' || section === 'mistakes')) {
      setShowQuizConfig(true);
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "user", content },
        {
          id: createId(),
          role: "assistant",
          content: section === 'mistakes' 
            ? "Great! Let's create a practice quiz targeting this mistake type. Configure your quiz below:"
            : "Great! Let's set up a practice quiz for you. Please configure your preferences below:",
        },
      ]);
      setInput("");
      return;
    }
    
    const message: Message = { id: createId(), role: "user", content };
    setMessages((prev) => [...prev, message]);
    setInput("");
    try {
      await mutation.mutateAsync({ section, context, message: content });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong. Try again.",
        },
      ]);
    }
  };

  const handleQuizSubmit = async (config: QuizConfig) => {
    setShowQuizConfig(false);
    
    // Add generating message
    const generatingMsgId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: generatingMsgId,
        role: "assistant",
        content: `Perfect! Generating ${config.questionCount} ${config.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'} questions with ${config.answerType} correct answers. This will take a moment...`,
      },
    ]);
    
    try {
      await quizMutation.mutateAsync({
        ...config,
        context: context as any,
      });
      // Success - remove generating message as we navigate away
    } catch (error) {
      // Remove the "generating" message and show error
      setMessages((prev) => {
        const filtered = prev.filter(m => m.id !== generatingMsgId);
        return [
          ...filtered,
          {
            id: createId(),
            role: "assistant",
            content: `Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ];
      });
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      {showVerification && <AiAccessModal onVerified={handleVerified} />}
      
      <aside className="hidden w-96 xl:w-[420px] flex-shrink-0 flex-col border-l border-slate-800/50 glass-card p-5 lg:flex fade-in-right sticky top-0 h-screen self-start">
      {/* Header with gradient accent - Fixed at top */}
      <div className="relative mb-5 flex-shrink-0">
        <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur-xl"></div>
        <div className="relative glass-card rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center float">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-400 font-bold">AI Mentor</p>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Gemini 2.5 Pro
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                </span>
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-slate-800/50 glass p-4 text-sm custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-slate-300 font-medium mb-2">Start a conversation</p>
            <p className="text-slate-400 text-xs max-w-xs">Ask anything about your current topic, mistakes, or practice plan.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`rounded-xl border p-4 transition-all duration-300 hover-lift stagger-item ${
                message.role === "assistant"
                  ? "bg-slate-950/80 border-emerald-500/25 shadow-[0_12px_40px_-20px_rgba(16,185,129,0.6)] backdrop-blur-sm"
                  : "bg-slate-800/40 border-slate-700/50"
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-2 mb-2">
                {message.role === "assistant" ? (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400 font-semibold">Mentor</p>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-primary font-semibold">You</p>
                  </>
                )}
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                  rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  className="text-slate-200 leading-relaxed"
                  components={{
                    // Style headings
                    h1: ({node, ...props}) => <h1 className="text-lg font-bold text-emerald-400 mt-4 mb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-base font-bold text-emerald-400 mt-3 mb-2" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-sm font-bold text-emerald-300 mt-2 mb-1" {...props} />,
                    // Style lists
                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
                    li: ({node, ...props}) => <li className="text-slate-200" {...props} />,
                    // Style code
                    code: ({node, inline, ...props}) => 
                      inline 
                        ? <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-xs font-mono" {...props} />
                        : <code className="block px-3 py-2 rounded-lg bg-slate-800 text-emerald-300 text-xs font-mono overflow-x-auto" {...props} />,
                    // Style paragraphs
                    p: ({node, ...props}) => <p className="text-slate-200 my-2" {...props} />,
                    // Style strong/bold
                    strong: ({node, ...props}) => <strong className="font-bold text-emerald-300" {...props} />,
                    // Style emphasis/italic
                    em: ({node, ...props}) => <em className="italic text-slate-300" {...props} />,
                    // Style horizontal rules
                    hr: ({node, ...props}) => <hr className="my-4 border-slate-700" {...props} />,
                  }}
                >
                  {ensureMathDelimiters(message.content)}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
        
        {/* Quiz Configuration Form */}
        {showQuizConfig && (
          <div className="stagger-item">
            <QuizConfigForm
              onSubmit={handleQuizSubmit}
              onCancel={() => setShowQuizConfig(false)}
              isLoading={quizMutation.isPending}
              section={section}
            />
          </div>
        )}
      </div>

      {/* Input Form - Fixed at bottom */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-3 flex-shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            disabled={!isVerified || mutation.isPending || quizMutation.isPending}
            className="w-full resize-none rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={isVerified ? "Ask the mentor anything..." : "Verify access to use AI Mentor..."}
          />
          <div className="absolute bottom-3 right-3 text-xs text-slate-500">
            {input.length}/500
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
          disabled={!isVerified || mutation.isPending || quizMutation.isPending}
        >
          {mutation.isPending || quizMutation.isPending ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {quizMutation.isPending ? 'Generating Quiz...' : 'Thinking...'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send Message
            </>
          )}
        </button>
      </form>
    </aside>
    </>
  );
};