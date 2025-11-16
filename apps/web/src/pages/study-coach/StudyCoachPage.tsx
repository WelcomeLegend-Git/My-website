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
    <section className="min-w-0">
      <div className="relative flex w-full text-slate-100 rounded-3xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
        {/* Sidebar Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Always visible on desktop, toggleable on mobile */}
        <div
          className={`
        fixed lg:relative inset-y-0 left-0 z-50 h-full
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        transition-transform duration-300 ease-in-out
        w-64 lg:w-72 xl:w-80 bg-slate-900 border-r border-slate-800 flex flex-col
      `}
        >
          {/* Sidebar Header with Hamburger and New Chat */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-800">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <Plus size={20} className="text-slate-300" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
          </div>


        {/* Chat History */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-4 py-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Chats</p>
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
                  className="group mx-2 px-4 py-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-all duration-200"
                >
                  <p className="text-sm truncate text-slate-300 group-hover:text-slate-100">
                    {firstUserMsg?.content || 'Empty conversation'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{msgCount} messages</p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">No recent chats</p>
          )}
        </div>

        {/* Bottom Section - User Profile */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">{getUserInitials()}</span>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-200">{user?.name || 'User'}</span>
              <p className="text-xs text-slate-400">{user?.isGuest ? 'Guest' : 'Student'}</p>
            </div>
          </div>
        </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative">
        {/* Header - Mobile only with hamburger */}
        <div className="lg:hidden h-14 border-b border-slate-800 flex items-center px-4 bg-slate-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <BookOpen size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-semibold">Study Guru</h1>
          </div>
        </div>

        {/* Messages Area - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 lg:py-8">
            {isEmptyChat ? (
              // Empty State
              <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
                <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Hello, {user?.name?.split(' ')[0] || 'legend'}
                </h1>
                <p className="text-slate-400 mb-12 text-lg">How can I help you today?</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-3xl">
                  {suggestions.slice(0, 4).map((suggestion, index) => (
                    <button
                      key={index}
                      className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 backdrop-blur-sm rounded-2xl transition-all duration-300 text-left border border-slate-700/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1"
                    >
                      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{suggestion.icon}</div>
                      <div className="text-sm font-medium text-slate-300 group-hover:text-slate-100">{suggestion.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Messages
              <div className="space-y-6">
                {messages.map((message) => (
                  // Skip page switch messages
                  message.content?.includes('You switched from') ? null : (
                    <div key={message.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        {message.role === "assistant" ? (
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                            <BookOpen size={18} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-slate-200">{getUserInitials()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-sm mb-2">
                          <span className={message.role === "assistant" ? "text-primary" : "text-slate-300"}>
                            {message.role === "assistant" ? "Study Guru" : (user?.name || "You")}
                          </span>
                        </div>
                      {message.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            className="text-slate-100"
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
                              li: ({node, ...props}) => <li className="text-slate-200" {...props} />,
                              code: ({node, inline, ...props}) => 
                                inline 
                                  ? <code className="px-1.5 py-0.5 rounded bg-slate-800/70 text-primary text-xs font-mono" {...props} />
                                  : <code className="block px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50 text-primary text-xs font-mono overflow-x-auto" {...props} />,
                              p: ({node, ...props}) => <p className="text-slate-200 my-2" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                              em: ({node, ...props}) => <em className="italic" {...props} />,
                              hr: ({node, ...props}) => <hr className="my-4 border-slate-700" {...props} />,
                            }}
                          >
                            {ensureMathDelimiters(message.content)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-slate-200">{message.content}</p>
                      )}
                      </div>
                    </div>
                  )
                ))}
                
                {/* Quiz Configuration Form */}
                {showQuizConfig && (
                  <div className="mt-6">
                    <QuizConfigForm
                      onSubmit={handleQuizSubmit}
                      onCancel={() => setShowQuizConfig(false)}
                      isLoading={quizMutation.isPending}
                      section="study"
                    />
                  </div>
                )}
                
                <div ref={messagesEndRef} className="h-20" />
              </div>
            )}
          </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/95 to-transparent pt-6 pb-4">
          <div className="max-w-4xl mx-auto px-4">
            <div className="relative">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Message Study Guru..."
                    disabled={mutation.isPending || quizMutation.isPending}
                    rows={1}
                    className="w-full resize-none bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50 transition-all"
                    style={{ minHeight: '52px', maxHeight: '200px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || mutation.isPending || quizMutation.isPending}
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    {mutation.isPending || quizMutation.isPending ? (
                      <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <Send size={20} className="text-white" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">
                Study Guru can make mistakes. Check important info.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
