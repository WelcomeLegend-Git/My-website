import { useEffect, useState } from "react";
import { Send, Plus, MessageSquare, BookOpen, Trash2, Menu, X, Search, Mic } from "lucide-react";
import { useShellContext } from "../../app/layouts/useShellContext";

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

  return <StudyGuruMobile />;
};

const StudyGuruMobile = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "assistant" as const,
      content:
        "Hello! I'm Study Guru, your AI learning assistant. How can I help you with your studies today?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [chatHistory] = useState([
    { id: 1, title: "Physics - Newton's Laws", timestamp: "2 hours ago" },
    { id: 2, title: "Mathematics - Calculus Help", timestamp: "Yesterday" },
    { id: 3, title: "Chemistry - Organic Reactions", timestamp: "2 days ago" },
    { id: 4, title: "Biology - Cell Structure", timestamp: "1 week ago" },
    { id: 5, title: "History - World War II", timestamp: "1 week ago" },
    { id: 6, title: "English - Shakespeare Analysis", timestamp: "2 weeks ago" },
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          type: "user" as const,
          content: inputValue,
        },
      ]);
      setInputValue("");

      // Simulate AI response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            type: "assistant" as const,
            content: "I understand your question. Let me help you with that...",
          },
        ]);
      }, 1000);
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: 1,
        type: "assistant" as const,
        content:
          "Hello! I'm Study Guru, your AI learning assistant. How can I help you with your studies today?",
      },
    ]);
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

  const isEmptyChat = messages.length === 1 && messages[0].type === "assistant";

  return (
    <div className="flex w-full min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-hidden rounded-xl lg:rounded-2xl border border-slate-800/60 shadow-xl">
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
        w-80 lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col
      `}
      >
        {/* Mobile Sidebar Header */}
        <div className="lg:hidden p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="relative flex-1 mr-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-slate-900 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none text-slate-100 placeholder-slate-500"
            />
          </div>
          <button className="p-2 hover:bg-slate-900 rounded-full text-slate-300">
            <Plus size={20} />
          </button>
        </div>

        {/* Desktop New Chat Button */}
        <div className="hidden lg:block p-4 border-b border-slate-800">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-slate-100"
          >
            <Plus size={20} />
            <span className="font-medium">New Chat</span>
          </button>
        </div>

        {/* Navigation Items - Mobile Only */}
        <div className="lg:hidden border-b border-slate-800">
          <button className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-900 transition-colors text-slate-100">
            <Plus size={20} />
            <span className="font-medium">New chat</span>
          </button>
          <button className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-900 transition-colors text-slate-100">
            <BookOpen size={20} />
            <span className="font-medium">Library</span>
          </button>
          <button className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-900 transition-colors text-slate-100">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className="font-medium">GPTs</span>
          </button>
          <button className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-900 transition-colors border-b border-slate-800 text-slate-100">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M3 9h18" />
            </svg>
            <span className="font-medium">New project</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className="group flex items-center gap-3 px-3 py-3 mb-1 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors"
            >
              <MessageSquare size={18} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-normal truncate text-slate-100">{chat.title}</p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16} className="text-slate-500 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-900 cursor-pointer">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold">SK</span>
            </div>
            <span className="text-sm font-medium text-slate-100">Suraj Kumar</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 lg:h-16 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-900 rounded-lg transition-colors text-slate-100 lg:hidden"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-base lg:text-xl font-medium bg-slate-900 px-4 py-2 rounded-full lg:rounded-lg text-slate-100 border border-slate-800">
              Study Guru
            </h1>
          </div>
          <button className="p-2 hover:bg-slate-900 rounded-full transition-colors text-slate-300">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M4.2 4.2l4.2 4.2m5.6 5.6l4.2 4.2M1 12h6m6 0h6M4.2 19.8l4.2-4.2m5.6-5.6l4.2-4.2" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6">
          <div className="max-w-3xl xl:max-w-4xl mx-auto py-4 lg:py-6">
            {isEmptyChat ? (
              // Empty State with Suggestions
              <div className="flex flex-col items-center justify-center min-h-full py-8">
                <h2 className="text-2xl lg:text-4xl font-normal text-center mb-8 lg:mb-12 text-slate-100">
                  What can I help with?
                </h2>
                <div className="grid grid-cols-2 gap-2 lg:gap-3 w-full max-w-2xl px-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="flex items-center gap-2 lg:gap-3 px-4 lg:px-5 py-3 lg:py-3.5 bg-slate-900 hover:bg-slate-800 rounded-2xl lg:rounded-3xl transition-colors text-left border border-slate-800"
                    >
                      <span className="text-lg lg:text-xl">{suggestion.icon}</span>
                      <span className="text-sm lg:text-base text-slate-200">{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Messages
              <div className="space-y-4 lg:space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 lg:gap-4 ${
                      message.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.type === "assistant" && (
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <BookOpen size={16} className="lg:w-5 lg:h-5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] lg:max-w-2xl p-3 lg:p-4 rounded-2xl ${
                        message.type === "user"
                          ? "bg-slate-800 text-slate-50"
                          : "bg-transparent text-slate-100 border border-slate-800/60"
                      }`}
                    >
                      <p className="text-sm lg:text-base leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800 p-3 lg:p-6 flex-shrink-0 bg-slate-900/95">
          <div className="max-w-3xl xl:max-w-4xl mx-auto">
            <div className="flex gap-2 lg:gap-3 bg-slate-900 rounded-3xl p-1.5 lg:p-2 items-center border border-slate-800">
              <button className="lg:hidden p-2 hover:bg-slate-800 rounded-full transition-colors flex-shrink-0 text-slate-100">
                <Plus size={20} />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask Study Guru"
                className="flex-1 bg-transparent px-3 lg:px-4 py-2.5 lg:py-3 focus:outline-none text-slate-100 placeholder-slate-500 text-sm lg:text-base"
              />
              <button className="p-2 hover:bg-slate-800 rounded-full transition-colors flex-shrink-0 text-slate-100">
                <Mic size={20} />
              </button>
              <button
                onClick={handleSend}
                className="p-2 lg:px-5 lg:py-2.5 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-full transition-colors flex items-center justify-center flex-shrink-0"
              >
                <Send size={18} className="lg:w-5 lg:h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center mt-2 lg:mt-3 px-2">
              Study Guru can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
