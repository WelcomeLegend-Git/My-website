import { useState, useRef, type SVGProps, type ChangeEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";

type IconProps = SVGProps<SVGSVGElement>;

const Menu = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const Mic = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M19 10a7 7 0 0 1-14 0" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
  </svg>
);

const Search = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="16.65" y1="16.65" x2="21" y2="21" />
  </svg>
);

const Plus = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const Send = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: number;
  title: string;
  recent: boolean;
  messages: ChatMessage[];
};

type ModelId = "gemini a" | "gemini b" | "gemini c";

export const StudyGuruChat = () => {
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState<Chat[]>([
    {
      id: 1,
      title: "History file 1",
      recent: true,
      messages: [
        { role: "user", content: "Tell me about the French Revolution" },
        {
          role: "assistant",
          content:
            "The French Revolution was a period of radical social and political change in France from 1789 to 1799. It led to the end of the monarchy and establishment of a republic.",
        },
      ],
    },
    {
      id: 2,
      title: "Helping HHR 2",
      recent: true,
      messages: [
        { role: "user", content: "What is HHR?" },
        {
          role: "assistant",
          content:
            "HHR can stand for different things depending on context. Could you provide more details about what you're referring to?",
        },
      ],
    },
    {
      id: 3,
      title: "Chat 3",
      recent: true,
      messages: [],
    },
  ]);
  const [activeChatId, setActiveChatId] = useState<number>(1);
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const { user } = useAuth();
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini a");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const modelOptions: ModelId[] = ["gemini a", "gemini b", "gemini c"];

  const displayName = user?.name || "Guest User";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "GU";

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now(),
      title: `New Chat ${chats.length + 1}`,
      recent: true,
      messages: [],
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
  };

  const handleDeleteChat = (id: number) => {
    setChats((prev) => {
      const updated = prev.filter((chat) => chat.id !== id);
      if (!updated.some((chat) => chat.id === activeChatId)) {
        setActiveChatId(updated.length ? updated[0].id : 0);
      }
      return updated;
    });
  };

  const handleSend = () => {
    if (!message.trim() || !activeChat) return;

    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== activeChatId) return chat;

        const newMessages: ChatMessage[] = [
          ...chat.messages,
          { role: "user", content: message },
          {
            role: "assistant",
            content:
              "This is a sample response from Study Guru. In a real application, this would be generated by AI.",
          },
        ];

        return {
          ...chat,
          messages: newMessages,
        };
      })
    );

    setMessage("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setAttachedFiles((prev) => {
      const combined = [...prev, ...files];
      return combined.slice(0, 10);
    });
    // Allow selecting the same file again by resetting the input
    event.target.value = "";
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const toggleRecording = () => {
    setIsRecording((prev) => !prev);
  };

  return (
    <div className="relative flex h-full min-h-0 w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "w-80" : "w-0"} bg-gradient-to-b from-slate-950/95 via-slate-900/95 to-slate-950/95 border-r border-slate-800/80 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800/80 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800/80 rounded-lg transition"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              onClick={() =>
                setHistorySearchOpen((prev) => {
                  const next = !prev;
                  if (!next) {
                    setHistorySearch("");
                  }
                  return next;
                })
              }
              className="p-2 hover:bg-slate-800/80 rounded-lg transition"
            >
              <Search className="w-6 h-6" />
            </button>
          </div>

          {historySearchOpen ? (

            <>
              <div className="mb-3">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search history"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/40 transition"
                />
              </div>

              {/* New Chat Button */}
              <button
                onClick={handleNewChat}
                className="w-full px-4 py-3 rounded-lg flex items-center gap-3 transition bg-gradient-to-r from-primary/20 via-blue-500/20 to-purple-500/20 hover:from-primary/30 hover:via-blue-500/30 hover:to-purple-500/30 border border-primary/40 shadow-md shadow-primary/30"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">New chat</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleNewChat}
              className="w-full px-4 py-3 rounded-lg flex items-center gap-3 transition bg-gradient-to-r from-primary/20 via-blue-500/20 to-purple-500/20 hover:from-primary/30 hover:via-blue-500/30 hover:to-purple-500/30 border border-primary/40 shadow-md shadow-primary/30"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">New chat</span>
            </button>
          )}
        </div>

        {/* Chat History - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {/* Recent Section */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Recent</h3>
            <div className="space-y-1">
              {chats
                .filter((chat) => chat.recent)
                .filter((chat) =>
                  historySearch.trim()
                    ? chat.title.toLowerCase().includes(historySearch.toLowerCase())
                    : true
                )
                .map((chat) => (
                  <div key={chat.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className={`flex-1 px-4 py-2.5 text-left rounded-lg text-sm transition ${
                        activeChatId === chat.id
                          ? "bg-slate-800/90 text-slate-100 border border-slate-600/80"
                          : "bg-slate-900/80 text-slate-300 hover:bg-slate-800/80 border border-slate-800/80"
                      }`}
                    >
                      {chat.title}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="p-1 text-[11px] text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition"
                      aria-label="Delete chat"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Other Chats */}
          <div className="p-4 border-t border-slate-800/80">
            <div className="space-y-1">
              {chats
                .filter((chat) => !chat.recent)
                .filter((chat) =>
                  historySearch.trim()
                    ? chat.title.toLowerCase().includes(historySearch.toLowerCase())
                    : true
                )
                .map((chat) => (
                  <div key={chat.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className={`flex-1 px-4 py-2.5 text-left hover:bg-zinc-800 rounded-lg transition text-sm ${
                        activeChatId === chat.id ? "bg-zinc-800" : ""
                      }`}
                    >
                      {chat.title}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="p-1 text-[11px] text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition"
                      aria-label="Delete chat"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800/80 flex-shrink-0">
          <button className="w-full px-4 py-3 hover:bg-zinc-800 rounded-lg transition flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <span className="font-medium truncate">{displayName}</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Header */}
        <div className="h-16 flex items-center px-4">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition mr-4"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          <div className="inline-flex items-center px-6 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 shadow-lg shadow-slate-900/60">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 leading-tight">Study guru</h1>
          </div>
        </div>

        {/* Scrollable Chat Section */}
        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-40 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {activeChat && activeChat.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">💡</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Start a new conversation
                  </h2>
                  <p className="text-slate-400">Ask me anything about your studies!</p>
                </div>
              </div>
            ) : (
              activeChat &&
              activeChat.messages.map((msg, index) =>
                msg.role === "user" ? (
                  <div key={index} className="flex justify-end">
                    <div className="bg-gradient-to-r from-primary/80 via-blue-500/80 to-purple-500/80 rounded-2xl rounded-tr-sm px-6 py-4 max-w-lg border border-primary/60 shadow-md shadow-primary/40">
                      <p className="text-slate-100">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="flex justify-start">
                    <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl rounded-tl-sm px-6 py-4 max-w-2xl shadow-lg shadow-slate-900/60">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary to-purple-600 rounded-full flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-slate-100 leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>

        {/* Input Area pinned to bottom of chat column */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-[0_18px_45px_rgba(15,23,42,0.9)] px-4 sm:px-6 py-3 sm:py-4 space-y-2">
              {/* Top row: input + send */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask study guru"
                  className="flex-1 bg-slate-950/70 border border-slate-800/80 rounded-full px-5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/30 transition"
                />
                <button
                  onClick={handleSend}
                  className="w-11 h-11 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 rounded-full flex items-center justify-center transition shadow-lg shadow-primary/30 flex-shrink-0"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Bottom row: attachments, model selector, voice */}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {/* Attachments */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAttachmentClick}
                    className="w-7 h-7 rounded-full border border-slate-700/80 flex items-center justify-center hover:bg-slate-800/80 hover:border-primary/60 transition"
                    title="Add photos (up to 10)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {attachedFiles.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      {attachedFiles.length} photo{attachedFiles.length > 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>

                {/* Model dropdown */}
                <div className="flex-1 flex justify-center">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                    className="min-w-[120px] bg-slate-900/90 border border-slate-700/80 rounded-full px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/40 appearance-none [background-image:linear-gradient(45deg,transparent_50%,#a5b4fc_50%),linear-gradient(135deg,#a5b4fc_50%,transparent_50%)],[background-position:calc(100%-14px)_50%,calc(100%-9px)_50%],[background-size:5px_5px,5px_5px,1.5rem_1.5rem]; [background-repeat:no-repeat]"
                  >
                    {modelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                      isRecording
                        ? "border-primary/70 bg-primary/10 text-primary"
                        : "border-slate-700/80 hover:bg-slate-800/80 hover:border-primary/60 text-slate-400"
                    }`}
                    title="Voice input (UI only)"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hidden file input for attachments */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-1 right-3 text-[10px] text-zinc-500/70 pointer-events-none select-none">
        SG v20
      </div>
    </div>
  );
};
