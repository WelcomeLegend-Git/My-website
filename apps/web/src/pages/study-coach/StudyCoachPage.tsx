import { useEffect, useState, useRef } from "react";
import { Send, Plus, MessageSquare, BookOpen, Trash2, Menu, X, Mic } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useShellContext } from "../../app/layouts/useShellContext";
import { useAuth } from "../../app/providers/AuthProvider";
import { trpc } from "../../lib/trpc";
import { useNavigate } from 'react-router-dom';
import { QuizConfigForm, type QuizConfig } from '../../features/quiz/components/QuizConfigForm';

export const StudyCoachPage = () => {
  const { setAiSection, setAiContext, setShowMentor } = useShellContext();

  useEffect(() => {
    setAiSection("study");
    setAiContext(undefined);
    setShowMentor(false);

    return () => {
      setShowMentor(true);
    };
  }, [setAiContext, setAiSection, setShowMentor]);

  // Wrapper component for Study Guru mobile/desktop layout
  return <StudyGuruInterface />;
};

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

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ConversationHistory = {
  messages: Message[];
  lastUpdated: number;
};

type ArchivedConversation = ConversationHistory & {
  id: string;
  archivedAt: number;
};

const StudyGuruInterface = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatHistory, setChatHistory] = useState<ArchivedConversation[]>([]);

  // Load conversation from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ai_conversation_v2');
      if (raw) {
        const parsed = JSON.parse(raw) as ConversationHistory;
        if (parsed.messages && Array.isArray(parsed.messages)) {
          setMessages(parsed.messages);
        }
      }
    } catch {}

    // Load conversation history
    try {
      const historyRaw = localStorage.getItem('ai_conversation_history_v1');
      if (historyRaw) {
        const history: ArchivedConversation[] = JSON.parse(historyRaw);
        setChatHistory(history);
      }
    } catch {}
  }, []);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const conversationData: ConversationHistory = {
          messages,
          lastUpdated: Date.now(),
        };
        localStorage.setItem('ai_conversation_v2', JSON.stringify(conversationData));
      } catch {}
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const mutation = trpc.studyApi.contextualAssistant.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: data.reply },
      ]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
        },
      ]);
    },
  });

  const quizMutation = trpc.quiz.generateQuiz.useMutation({
    onSuccess: (data) => {
      navigate(`/quiz/${data.quizId}`);
    },
  });

  const handleSend = async () => {
    if (!inputValue.trim() || mutation.isPending) return;

    const content = inputValue.trim();
    
    // Detect if user wants to practice
    const practiceKeywords = ['practice', 'quiz', 'test', 'questions', 'exam', 'solve'];
    const wantsPractice = practiceKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
    
    if (wantsPractice) {
      setShowQuizConfig(true);
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "user", content },
        {
          id: createId(),
          role: "assistant",
          content: "Great! Let's set up a practice quiz for you. Please configure your preferences below:",
        },
      ]);
      setInputValue("");
      return;
    }
    
    const message: Message = { 
      id: createId(), 
      role: "user", 
      content,
    };
    setMessages((prev) => [...prev, message]);
    setInputValue("");
    
    try {
      await mutation.mutateAsync({ 
        section: "study", 
        context: { type: "study_guru" }, 
        message: content 
      });
    } catch (error) {
      // Error already handled in onError
    }
  };

  const handleNewChat = () => {
    // Save current conversation to history before clearing
    if (messages.length > 0) {
      try {
        const existingHistory = localStorage.getItem('ai_conversation_history_v1');
        const history: ArchivedConversation[] = existingHistory ? JSON.parse(existingHistory) : [];
        
        const archivedConversation: ArchivedConversation = {
          id: createId(),
          messages,
          lastUpdated: Date.now(),
          archivedAt: Date.now(),
        };
        
        history.unshift(archivedConversation);
        
        // Keep only last 20 conversations
        if (history.length > 20) {
          history.splice(20);
        }
        
        localStorage.setItem('ai_conversation_history_v1', JSON.stringify(history));
        setChatHistory(history);
      } catch {}
    }
    
    setMessages([]);
    try { localStorage.removeItem('ai_conversation_v2'); } catch {}
    setSidebarOpen(false);
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
        content: `Perfect! Generating ${config.questionCount} ${config.examType === 'mains' ? 'JEE Mains' : 'JEE Advanced'} questions. This will take a moment...`,
      },
    ]);
    
    try {
      await quizMutation.mutateAsync({
        ...config,
        context: { type: "study_guru" } as any,
      });
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

  const loadArchivedConversation = (conversation: ArchivedConversation) => {
    setMessages(conversation.messages);
    setSidebarOpen(false);
  };

  const suggestions = [
    { icon: "🎨", label: "Explain concept", color: "text-emerald-400" },
    { icon: "💻", label: "Solve problem", color: "text-cyan-400" },
    { icon: "💡", label: "Study tips", color: "text-yellow-400" },
    { icon: "📝", label: "Practice quiz", color: "text-orange-400" },
    { icon: "✍️", label: "Help me write", color: "text-pink-400" },
    { icon: "➕", label: "More", color: "text-slate-400" },
  ];

  const isEmptyChat = messages.length === 0;
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return "U";
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex w-full min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] text-slate-100 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile & Desktop */}
      <div
        className={`
        fixed lg:relative inset-y-0 left-0 z-50
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        transition-transform duration-300 ease-in-out
        w-80 md:w-72 lg:w-80 xl:w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/50 flex flex-col shadow-2xl
      `}
      >
        {/* Mobile Sidebar Header */}
        <div className="lg:hidden p-4 border-b border-slate-800/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Study Guru</h2>
          <button 
            onClick={handleNewChat}
            className="p-2 hover:bg-slate-800 rounded-full text-emerald-400 transition-colors"
            title="New Chat"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Desktop New Chat Button */}
        <div className="hidden lg:block p-4 lg:p-5 border-b border-slate-800/50">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 hover:from-emerald-500/20 hover:to-cyan-500/20 rounded-xl transition-all duration-300 text-slate-100 border border-emerald-500/20 hover:border-emerald-500/30 shadow-lg hover:shadow-emerald-500/10"
          >
            <Plus size={20} className="text-emerald-400" />
            <span className="font-semibold">New Chat</span>
          </button>
        </div>


        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar">
          <div className="hidden lg:block mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">Recent</p>
          </div>
          {chatHistory.length > 0 ? (
            chatHistory.map((conv) => {
              const firstUserMsg = conv.messages.find(m => m.role === 'user');
              const msgCount = conv.messages.filter(m => m.role === 'user').length;
              const date = new Date(conv.archivedAt);
              const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              
              return (
                <div
                  key={conv.id}
                  onClick={() => loadArchivedConversation(conv)}
                  className="group flex items-center gap-3 px-3 py-3 mb-1.5 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-all duration-200 border border-transparent hover:border-slate-700/50"
                >
                  <MessageSquare size={18} className="text-slate-400 group-hover:text-emerald-400 flex-shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-slate-100">{firstUserMsg?.content || 'Empty conversation'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{msgCount} message{msgCount !== 1 ? 's' : ''} • {timeStr}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newHistory = chatHistory.filter(c => c.id !== conv.id);
                      setChatHistory(newHistory);
                      try {
                        localStorage.setItem('ai_conversation_history_v1', JSON.stringify(newHistory));
                      } catch {}
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={16} className="text-slate-500 hover:text-red-400 transition-colors" />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">No conversation history yet</p>
          )}
        </div>

        {/* User Profile */}
        <div className="p-4 lg:p-5 border-t border-slate-800/50 bg-slate-900/50">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-all duration-200 border border-transparent hover:border-slate-700/50">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-sm font-bold">{getUserInitials()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-100 block truncate">{user?.name || 'User'}</span>
              <span className="text-xs text-slate-400">{user?.isGuest ? 'Guest' : 'Student'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-slate-900/50 to-slate-900/30">
        {/* Header */}
        <div className="h-14 lg:h-20 border-b border-slate-800/50 flex items-center justify-between px-4 lg:px-8 flex-shrink-0 bg-slate-900/80 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-3 lg:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800/60 rounded-xl transition-all duration-200 text-slate-100 lg:hidden active:scale-95"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <BookOpen className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-base lg:text-xl font-bold text-slate-100">
                  Study Guru
                </h1>
                <p className="hidden lg:block text-xs text-slate-400">AI-Powered Learning Assistant</p>
              </div>
            </div>
          </div>
          <button className="p-2.5 hover:bg-slate-800/60 rounded-xl transition-all duration-200 text-slate-300 hover:text-slate-100 active:scale-95">
            <svg className="w-5 h-5 lg:w-6 lg:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M4.2 4.2l4.2 4.2m5.6 5.6l4.2 4.2M1 12h6m6 0h6M4.2 19.8l4.2-4.2m5.6-5.6l4.2-4.2" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 xl:px-12">
          <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto py-4 lg:py-8">
            {isEmptyChat ? (
              // Empty State with Suggestions
              <div className="flex flex-col items-center justify-center min-h-full py-8 lg:py-16">
                <div className="mb-6 lg:mb-8 w-20 h-20 lg:w-24 lg:h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center backdrop-blur-xl border border-emerald-500/30">
                  <BookOpen className="w-10 h-10 lg:w-12 lg:h-12 text-emerald-400" />
                </div>
                <h2 className="text-3xl lg:text-5xl xl:text-6xl font-bold text-center mb-3 lg:mb-4 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  What can I help with?
                </h2>
                <p className="text-sm lg:text-base text-slate-400 text-center mb-8 lg:mb-14 max-w-xl">Choose a topic below or ask me anything about your studies</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-3xl lg:max-w-4xl px-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="group flex items-center gap-3 lg:gap-4 px-5 lg:px-6 py-4 lg:py-5 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl lg:rounded-3xl transition-all duration-300 text-left border border-slate-700/50 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-95"
                    >
                      <span className="text-2xl lg:text-3xl group-hover:scale-110 transition-transform duration-300">{suggestion.icon}</span>
                      <span className="text-sm lg:text-base font-medium text-slate-200 group-hover:text-slate-50">{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Messages
              <div className="space-y-5 lg:space-y-8">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 lg:gap-5 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <BookOpen size={18} className="lg:w-6 lg:h-6 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] lg:max-w-3xl xl:max-w-4xl p-4 lg:p-5 xl:p-6 rounded-2xl lg:rounded-3xl shadow-lg transition-all duration-300 hover:shadow-xl ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-slate-800 to-slate-800/80 text-slate-50 border border-slate-700/50"
                          : "bg-slate-800/30 backdrop-blur-xl text-slate-100 border border-slate-700/40"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            className="text-slate-200 leading-relaxed"
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-lg font-bold text-emerald-400 mt-4 mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-base font-bold text-emerald-400 mt-3 mb-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-sm font-bold text-emerald-300 mt-2 mb-1" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
                              li: ({node, ...props}) => <li className="text-slate-200" {...props} />,
                              code: ({node, inline, ...props}) => 
                                inline 
                                  ? <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-xs font-mono" {...props} />
                                  : <code className="block px-3 py-2 rounded-lg bg-slate-800 text-emerald-300 text-xs font-mono overflow-x-auto" {...props} />,
                              p: ({node, ...props}) => <p className="text-slate-200 my-2" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold text-emerald-300" {...props} />,
                              em: ({node, ...props}) => <em className="italic text-slate-300" {...props} />,
                              hr: ({node, ...props}) => <hr className="my-4 border-slate-700" {...props} />,
                            }}
                          >
                            {ensureMathDelimiters(message.content)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm lg:text-base xl:text-lg leading-relaxed">{message.content}</p>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <span className="text-sm lg:text-base font-bold text-white">{getUserInitials()}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
                
                {/* Quiz Configuration Form */}
                {showQuizConfig && (
                  <div className="stagger-item">
                    <QuizConfigForm
                      onSubmit={handleQuizSubmit}
                      onCancel={() => setShowQuizConfig(false)}
                      isLoading={quizMutation.isPending}
                      section="study"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800/50 p-4 lg:p-6 xl:p-8 flex-shrink-0 bg-slate-900/95 backdrop-blur-xl shadow-2xl">
          <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
            <div className="flex gap-2 lg:gap-3 bg-slate-800/50 backdrop-blur-xl rounded-3xl lg:rounded-[2rem] p-2 lg:p-3 items-center border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300 shadow-lg focus-within:ring-2 focus-within:ring-emerald-500/20">
              <button className="lg:hidden p-2.5 hover:bg-slate-700/50 rounded-full transition-all duration-200 flex-shrink-0 text-slate-300 hover:text-slate-100 active:scale-95">
                <Plus size={20} />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Study Guru anything..."
                disabled={mutation.isPending || quizMutation.isPending}
                className="flex-1 bg-transparent px-4 lg:px-6 py-3 lg:py-4 focus:outline-none text-slate-100 placeholder-slate-400 text-sm lg:text-base xl:text-lg disabled:opacity-50"
              />
              <button 
                className="p-2.5 lg:p-3 hover:bg-slate-700/50 rounded-full transition-all duration-200 flex-shrink-0 text-slate-300 hover:text-emerald-400 active:scale-95"
                disabled={mutation.isPending || quizMutation.isPending}
              >
                <Mic size={20} className="lg:w-6 lg:h-6" />
              </button>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || mutation.isPending || quizMutation.isPending}
                className="p-2.5 lg:p-3 xl:px-6 xl:py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 rounded-full lg:rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/30 active:scale-95"
              >
                {mutation.isPending || quizMutation.isPending ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden xl:inline font-semibold">{quizMutation.isPending ? 'Generating...' : 'Thinking...'}</span>
                  </>
                ) : (
                  <>
                    <Send size={18} className="lg:w-5 lg:h-5" />
                    <span className="hidden xl:inline font-semibold">Send</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs lg:text-sm text-slate-500 text-center mt-3 lg:mt-4 px-2">
              Study Guru can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
