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

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [images, setImages] = useState<{ data: string; mimeType: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
    setShowMentor(false);

    // Load messages and check verification
    try {
      const raw = sessionStorage.getItem("ai_messages_v1_study");
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        setMessages(parsed);
      }
    } catch {}

    const checkVerification = () => {
      try {
        const verified = sessionStorage.getItem("ai_access_verified") === "true";
        setIsVerified(verified);
        if (!verified) setShowVerification(true);
      } catch {
        setIsVerified(false);
        setShowVerification(true);
      }
    };

    checkVerification();
  }, [setAiSection, setAiContext, setShowMentor]);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem("ai_messages_v1_study", JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  const mutation = trpc.studyApi.contextualAssistant.useMutation({
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: createId(),
        role: "assistant",
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error("Chat error:", error);
    }
  });

  const quizMutation = trpc.studyApi.generateQuiz.useMutation({
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: createId(),
        role: "assistant", 
        content: `I've generated a quiz for you! It contains ${data.questions.length} questions. [View Quiz Results](/quiz-history)`
      };
      setMessages((prev) => [...prev, assistantMessage]);
      navigate("/quiz-history");
    }
  });

  const filteredHistory = useMemo(() => {
    if (!historyQuery.trim()) return messages.filter(m => m.role === "user").slice(-5);
    const query = historyQuery.toLowerCase();
    return messages.filter(m => 
      m.role === "user" && m.content.toLowerCase().includes(query)
    ).slice(-10);
  }, [messages, historyQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) return setShowVerification(true);

    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setImages([]);

    mutation.mutate({
      section: "study",
      message: trimmed,
      images: images.length > 0 ? images : undefined,
    });
  };

  const handleQuizGeneration = (config: QuizConfig) => {
    if (!isVerified) return setShowVerification(true);
    
    setShowQuizConfig(false);
    
    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: `Generate a quiz: ${config.subject} - ${config.difficulty} level, ${config.questionCount} questions`,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    quizMutation.mutate(config);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - images.length);
    if (!files.length) return;

    const readers = files.map(file => new Promise<{ data: string; mimeType: string }>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        data: reader.result as string,
        mimeType: file.type
      });
      reader.readAsDataURL(file);
    }));

    Promise.all(readers).then(results => 
      setImages(prev => [...prev, ...results].slice(0, 10))
    );
  };

  const promptChips = [
    "Help with Study Planning",
    "Explain Learning Strategies", 
    "Mental Health Tips",
    "Motivation Boost",
    "Time Management",
    "Exam Strategies"
  ];

  return (
    <div className="flex h-screen bg-[#131314]">
      {/* Left Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-72'} transition-all duration-300 bg-[#1e1e1f] border-r border-gray-800 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">JC</span>
                </div>
                <span className="text-white font-semibold text-lg">JEE Companion</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        {!sidebarCollapsed && (
          <div className="p-4">
            <button
              onClick={() => {
                setMessages([]);
                try {
                  sessionStorage.setItem("ai_messages_v1_study", JSON.stringify([]));
                } catch {}
              }}
              className="w-full flex items-center gap-3 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition text-white font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>
        )}

        {/* Chat History */}
        {!sidebarCollapsed && (
          <div className="flex-1 px-4">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Chat History</h3>
            <input
              type="text"
              placeholder="Search chats..."
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition mb-4"
            />
            <div className="space-y-1">
              {filteredHistory.map((m, idx) => (
                <div key={idx} className="p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition">
                  <p className="text-gray-300 text-sm line-clamp-1">{m.content}</p>
                  <p className="text-gray-500 text-xs mt-1">10 min ago</p>
                </div>
              ))}
              {filteredHistory.length === 0 && (
                <p className="text-gray-500 text-sm">No recent chats</p>
              )}
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-800 space-y-1">
            <button 
              onClick={() => navigate('/formula-library')}
              className="w-full flex items-center gap-3 p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Formula Library
            </button>
            <button 
              onClick={() => navigate('/mistakes')}
              className="w-full flex items-center gap-3 p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Mistake Log
            </button>
            <button 
              onClick={() => navigate('/quiz-history')}
              className="w-full flex items-center gap-3 p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Quiz History
            </button>
          </div>
        )}
      </aside>

      {/* Main Content - Centered Chat Column */}
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-4xl flex flex-col px-6 py-8">
          {/* Messages or Welcome */}
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
              {/* Simple Professional Greeting */}
              <div className="text-center mb-12">
                <h1 className="text-2xl text-white font-normal mb-2">
                  Hello. How can I help with your JEE preparation today?
                </h1>
                <p className="text-gray-400 text-sm">
                  Ask me anything about study strategies, concepts, or get personalized guidance.
                </p>
              </div>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-2 gap-3 mb-16 w-full max-w-2xl">
                {promptChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(chip)}
                    className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-left transition text-gray-200 text-sm"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto mb-6 space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-3xl ${message.role === "user" ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-200"} rounded-2xl px-4 py-3`}>
                    {message.role === "assistant" ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                          code: ({ children }) => <code className="bg-gray-700 px-1 py-0.5 rounded text-sm">{children}</code>,
                        }}
                      >
                        {ensureMathDelimiters(message.content)}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat Input - At bottom of content column */}
          <div className="mt-auto">
            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mb-3 flex gap-2 flex-wrap">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img 
                      src={img.data} 
                      alt="Upload preview" 
                      className="w-16 h-16 object-cover rounded-lg border border-gray-700"
                    />
                    <button
                      onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-end bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-purple-500 transition">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the coach anything..."
                  className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-gray-400 resize-none focus:outline-none min-h-[52px] max-h-32"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                />
                
                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-gray-400 hover:text-white transition"
                  title="Upload image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!input.trim() || mutation.isPending || quizMutation.isPending}
                  className="p-3 text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>
      </main>

      {showVerification && <AiAccessModal onVerified={() => { setIsVerified(true); setShowVerification(false); }} />}
      {showQuizConfig && (
        <QuizConfigForm 
          onGenerate={handleQuizGeneration}
          onCancel={() => setShowQuizConfig(false)}
        />
      )}
    </div>
  );
};
