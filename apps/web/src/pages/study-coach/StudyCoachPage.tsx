import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useShellContext } from "../../app/layouts/useShellContext";
import { trpc } from "../../lib/trpc";
import { AiAccessModal } from "../../features/ai/components/AiAccessModal";
import { QuizConfigForm, type QuizConfig } from "../../features/quiz/components/QuizConfigForm";

type Message = { id: string; role: "user" | "assistant"; content: string };

const ensureMathDelimiters = (text: string): string => {
  if (!text) return text;
  let processed = text;
  processed = processed.replace(/\\\((.+?)\\\)/g, (_m, p1) => `$${p1}$`);
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_m, p1) => `$$${p1}$$`);
  return processed;
};

const createId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const StudyCoachPage = () => {
  const navigate = useNavigate();
  const { setAiSection, setAiContext, setShowMentor } = useShellContext();

  // Shared chat state (same format as AiSidebar) using the 'study' section key
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false); // mobile drawer
  const [sidebarVisible, setSidebarVisible] = useState(true); // desktop collapse/expand
  const [images, setImages] = useState<{ data: string; mimeType: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
    setShowMentor(false);

    // mount: load messages and check verification
    try {
      const raw = sessionStorage.getItem("ai_messages_v1_study");
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
    const verified = localStorage.getItem("ai_access_verified") === "true";
    setIsVerified(verified);
    if (!verified) setShowVerification(true);

    return () => setShowMentor(true);
  }, [setAiContext, setAiSection, setShowMentor]);

  useEffect(() => {
    try { sessionStorage.setItem("ai_messages_v1_study", JSON.stringify(messages)); } catch {}
  }, [messages]);

  const mutation = trpc.studyApi.contextualAssistant.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: data.reply }]);
    },
  });

  const quizMutation = trpc.quiz.generateQuiz.useMutation({
    onSuccess: (data) => {
      navigate(`/quiz/${data.quizId}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input.trim();

    const practiceKeywords = ["practice", "quiz", "test", "questions", "exam", "solve"];
    const wantsPractice = practiceKeywords.some((k) => content.toLowerCase().includes(k));
    if (wantsPractice) {
      setShowQuizConfig(true);
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "user", content },
        { id: createId(), role: "assistant", content: "Great! Let's set up a practice quiz for you. Configure your preferences below:" },
      ]);
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, { id: createId(), role: "user", content }]);
    setInput("");
    try {
      await mutation.mutateAsync({ section: "study", context: undefined, message: content, images: images.length ? images : undefined });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: error instanceof Error ? error.message : "Something went wrong. Try again." },
      ]);
    }
    setImages([]);
  };

  const handleQuizSubmit = async (config: QuizConfig) => {
    setShowQuizConfig(false);
    const generatingMsgId = createId();
    setMessages((prev) => [
      ...prev,
      { id: generatingMsgId, role: "assistant", content: `Perfect! Generating ${config.questionCount} ${config.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'} questions with ${config.answerType} correct answers. This will take a moment...` },
    ]);
    try {
      await quizMutation.mutateAsync({ ...config, context: undefined as any });
    } catch (error) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== generatingMsgId);
        return [...filtered, { id: createId(), role: "assistant", content: `Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}` }];
      });
    }
  };

  const filteredHistory = useMemo(() => {
    const list = messages.filter((m) => m.role === "user").slice().reverse();
    if (!historyQuery.trim()) return list;
    return list.filter((m) => m.content.toLowerCase().includes(historyQuery.toLowerCase()));
  }, [messages, historyQuery]);

  const prompts = [
    "Study Planning",
    "Learning Strategies",
    "Mental Health",
    "Motivation",
    "Time Management",
    "Exam Strategies",
  ];
  const bubblePrompt = "Ask about study planning, strategies, mental health...";

  const pastePrompt = (text: string) => {
    setInput(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const onPickImagesClick = () => fileInputRef.current?.click();
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, Math.max(0, 10 - images.length));
    const readers = await Promise.all(
      list.map(
        (file) =>
          new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve({ data: String(fr.result), mimeType: file.type || "image/*" });
            fr.onerror = reject;
            fr.readAsDataURL(file);
          })
      )
    );
    setImages((prev) => [...prev, ...readers].slice(0, 10));
  };

  return (
    <section className="flex gap-4 lg:gap-6 w-full min-h-[calc(100dvh-6rem)]">
      {/* Mobile history drawer */}
      {historyOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}>
          <aside className="absolute left-0 top-0 h-full w-72 sm:w-80 glass-card border-r border-slate-800/60 bg-slate-950/80" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">History</h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/60 text-slate-300 hover:border-primary/50 hover:text-primary transition"
              >Close</button>
            </div>
            <div className="p-3 border-b border-slate-800/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setMessages([]); try { sessionStorage.setItem("ai_messages_v1_study", JSON.stringify([])); } catch {} }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                New chat
              </button>
            </div>
            <div className="p-3">
              <div className="relative mb-3">
                <input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} placeholder="Search chats..." className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-1 overflow-y-auto max-h-[70vh]">
                {filteredHistory.map((m, idx) => (
                  <div key={`${m.id}-${idx}`} className="px-3 py-2 rounded-lg hover:bg-slate-800/60 cursor-default">
                    <p className="text-xs text-slate-300 line-clamp-2">{m.content}</p>
                  </div>
                ))}
                {filteredHistory.length === 0 && <p className="text-xs text-slate-500">No recent prompts.</p>}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop left history */}
      {sidebarVisible && (
      <aside className="hidden lg:block w-72 xl:w-80 glass-card border border-slate-800/60 bg-slate-950/80 rounded-2xl p-3 h-fit self-start -ml-3 sm:-ml-6 lg:-ml-8">
        <div className="p-3 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16"/></svg>
            <h3 className="text-sm font-semibold text-slate-200">New chat</h3>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setMessages([]); try { sessionStorage.setItem("ai_messages_v1_study", JSON.stringify([])); } catch {} }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition"
          >New</button>
          <button
            type="button"
            onClick={() => setSidebarVisible(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/60 text-slate-300 hover:border-slate-500/60 transition"
          >Hide</button>
          </div>
        </div>
        <div className="p-3">
          <div className="relative mb-3">
            <input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} placeholder="Search chats..." className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filteredHistory.map((m, idx) => (
              <div key={`${m.id}-${idx}`} className="px-3 py-2 rounded-lg hover:bg-slate-800/60 cursor-default">
                <p className="text-xs text-slate-300 line-clamp-2">{m.content}</p>
              </div>
            ))}
            {filteredHistory.length === 0 && <p className="text-xs text-slate-500">No recent prompts.</p>}
          </div>
        </div>
      </aside>
      )}

      {/* Main chat area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile history trigger) */}
        <div className="lg:hidden mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="px-3 py-2 rounded-lg border border-slate-700/60 text-slate-300 bg-slate-900/50"
            aria-label="Open history"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <h1 className="text-xl font-semibold text-slate-200">Study Coach</h1>
        </div>
        {/* Desktop show button when sidebar hidden */}
        {!sidebarVisible && (
          <div className="hidden lg:flex mb-3">
            <button
              type="button"
              onClick={() => setSidebarVisible(true)}
              className="px-3 py-2 rounded-lg border border-slate-700/60 text-slate-300 bg-slate-900/50"
              aria-label="Show history"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16"/></svg>
              <span className="ml-2 text-sm">Show history</span>
            </button>
          </div>
        )}

        {/* Messages or Hero */}
        {messages.length === 0 ? (
          <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center text-center relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-primary via-purple-400 to-pink-500 bg-clip-text text-transparent mb-6">
              Hey! What Can I Help You?
            </h2>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12">
              {prompts.map((p) => (
                <button key={p} onClick={() => pastePrompt(p)} className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs sm:text-sm transition">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  {p}
                </button>
              ))}
            </div>
            {/* Starting prompt bubble */}
            <button
              type="button"
              onClick={() => pastePrompt(bubblePrompt)}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-700/60 text-slate-300 text-xs shadow-lg"
            >
              {bubblePrompt}
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-slate-800/50 glass p-4 text-sm custom-scrollbar">
            {messages.map((message, index) => (
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
                      h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-emerald-400 mt-4 mb-2" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-base font-bold text-emerald-400 mt-3 mb-2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-sm font-bold text-emerald-300 mt-2 mb-1" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
                      li: ({ node, ...props }) => <li className="text-slate-200" {...props} />,
                      code: ({ node, inline, ...props }) => inline ? (
                        <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-xs font-mono" {...props} />
                      ) : (
                        <code className="block px-3 py-2 rounded-lg bg-slate-800 text-emerald-300 text-xs font-mono overflow-x-auto" {...props} />
                      ),
                      p: ({ node, ...props }) => <p className="text-slate-200 my-2" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-bold text-emerald-300" {...props} />,
                      em: ({ node, ...props }) => <em className="italic text-slate-300" {...props} />,
                      hr: ({ node, ...props }) => <hr className="my-4 border-slate-700" {...props} />,
                    }}
                  >
                    {ensureMathDelimiters(message.content)}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {showQuizConfig && (
              <div className="stagger-item">
                <QuizConfigForm onSubmit={handleQuizSubmit} onCancel={() => setShowQuizConfig(false)} isLoading={quizMutation.isPending} section="study" />
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3 flex-shrink-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              disabled={!isVerified || mutation.isPending || quizMutation.isPending}
              className="w-full resize-none rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={isVerified ? "Ask the coach anything..." : "Verify access to use Study Coach..."}
            />
            <div className="absolute bottom-3 right-3 text-xs text-slate-500">{input.length}/500</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={onPickImagesClick}
              className="px-3 py-2 rounded-lg border border-slate-700/60 bg-slate-900/50 text-slate-300 text-sm flex items-center gap-2"
              aria-label="Add images"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              <span className="hidden sm:inline">Add</span>
            </button>
            {!!images.length && (
              <div className="flex items-center gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-10 h-10 rounded-md overflow-hidden border border-slate-700/60">
                    <img src={img.data} alt="attachment" className="w-full h-full object-cover" />
                  </div>
                ))}
                <span className="text-xs text-slate-400">{images.length}/10</span>
                <button type="button" onClick={() => setImages([])} className="text-xs text-slate-300 underline">Clear</button>
              </div>
            )}
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
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
          </div>
        </form>
      </div>

      {showVerification && <AiAccessModal onVerified={() => { setIsVerified(true); setShowVerification(false); }} />}
    </section>
  );
};
