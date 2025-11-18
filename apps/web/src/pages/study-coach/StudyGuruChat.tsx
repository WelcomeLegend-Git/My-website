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

const MoreVertical = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
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
  pinned?: boolean;
};

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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openMenuChatId, setOpenMenuChatId] = useState<number | null>(null);

  const displayName = user?.name || "Guest User";
  const firstName = displayName.split(" ")[0] || "legend";
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

  const handleRenameChat = (id: number) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;

    const newTitle = window.prompt("Rename chat", chat.title);
    if (!newTitle || !newTitle.trim()) return;

    setChats((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              title: newTitle.trim(),
            }
          : c
      )
    );
  };

  const togglePinChat = (id: number) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== id) return chat;
        const nextPinned = !chat.pinned;
        return {
          ...chat,
          pinned: nextPinned,
          // Ensure pinned chats stay in Recent
          recent: nextPinned ? true : chat.recent,
        };
      })
    );
  };

  const handleShareChat = (chat: Chat) => {
    const lines: string[] = [
      `Study Guru chat: ${chat.title}`,
      "",
      ...chat.messages.map((m) => `${m.role === "user" ? "You" : "Study Guru"}: ${m.content}`),
    ];

    const text = lines.join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch((error) => {
        console.error("Failed to copy chat to clipboard", error);
      });
    }
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

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex h-full min-h-0 w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "w-80" : "w-0"} bg-gradient-to-b from-slate-950/95 via-slate-900/95 to-slate-950/95 border-r border-slate-800/80 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex-shrink-0">
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition bg-gradient-to-r from-primary/20 via-blue-500/20 to-purple-500/20 hover:from-primary/30 hover:via-blue-500/30 hover:to-purple-500/30 border border-primary/40 shadow-md shadow-primary/30"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New chat</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition bg-gradient-to-r from-primary/20 via-blue-500/20 to-purple-500/20 hover:from-primary/30 hover:via-blue-500/30 hover:to-purple-500/30 border border-primary/40 shadow-md shadow-primary/30"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New chat</span>
            </button>
          )}
        </div>

        {/* Chat History - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {/* Recent Section */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Recent</h3>
            <div className="space-y-1">
              {[...chats]
                .filter((chat) => chat.recent)
                .filter((chat) =>
                  historySearch.trim()
                    ? chat.title.toLowerCase().includes(historySearch.toLowerCase())
                    : true
                )
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                .map((chat) => (
                  <div key={chat.id} className="group relative flex items-center gap-2">
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className={`flex-1 px-0 py-2 text-left text-sm rounded-md transition ${
                        activeChatId === chat.id
                          ? "bg-slate-800/80 text-slate-100"
                          : "text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {chat.pinned && <span className="text-xs">📌</span>}
                        <span className="truncate max-w-[150px] sm:max-w-[190px]">{chat.title}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuChatId((current) =>
                          current === chat.id ? null : chat.id
                        );
                      }}
                      className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 opacity-0 group-hover:opacity-100 transition"
                      aria-label="Chat options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuChatId === chat.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-lg shadow-slate-900/80 py-1 text-xs sm:text-sm z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareChat(chat);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-slate-100 hover:bg-slate-800/90 transition"
                        >
                          <span>🔗</span>
                          <span>Share</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChat(chat.id);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-slate-100 hover:bg-slate-800/90 transition"
                        >
                          <span>📌</span>
                          <span>{chat.pinned ? "Unpin" : "Pin"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameChat(chat.id);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-slate-100 hover:bg-slate-800/90 transition"
                        >
                          <span>✏️</span>
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-red-400 hover:bg-red-900/40 transition"
                        >
                          <span>🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Other Chats */}
          <div className="p-4">
            <div className="space-y-1">
              {chats
                .filter((chat) => !chat.recent)
                .filter((chat) =>
                  historySearch.trim()
                    ? chat.title.toLowerCase().includes(historySearch.toLowerCase())
                    : true
                )
                .map((chat) => (
                  <div key={chat.id} className="group relative flex items-center gap-2">
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className={`flex-1 px-0 py-2 text-left text-sm rounded-md transition ${
                        activeChatId === chat.id
                          ? "bg-slate-800/80 text-slate-100"
                          : "text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {chat.pinned && <span className="text-xs">📌</span>}
                        <span className="truncate max-w-[150px] sm:max-w-[190px]">{chat.title}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuChatId((current) =>
                          current === chat.id ? null : chat.id
                        );
                      }}
                      className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 opacity-0 group-hover:opacity-100 transition"
                      aria-label="Chat options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuChatId === chat.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-lg shadow-slate-900/80 py-1 text-xs sm:text-sm z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareChat(chat);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-slate-100 hover:bg-slate-800/90 transition"
                        >
                          <span>🔗</span>
                          <span>Share</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChat(chat.id);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-slate-100 hover:bg-slate-800/90 transition"
                        >
                          <span>📌</span>
                          <span>{chat.pinned ? "Unpin" : "Pin"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameChat(chat.id);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-slate-100 hover:bg-slate-800/90 transition"
                        >
                          <span>✏️</span>
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id);
                            setOpenMenuChatId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-red-400 hover:bg-red-900/40 transition"
                        >
                          <span>🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 flex-shrink-0">
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
                <div className="text-center space-y-6">
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-bold">
                      <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        Hello, {firstName}
                      </span>
                    </h2>
                    <p className="mt-2 text-slate-400 text-sm sm:text-base">How can I help you today?</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPrompt("Explain this concept in simple terms: ")
                      }
                      className="group rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-4 sm:px-4 sm:py-5 text-left hover:border-primary/60 hover:bg-slate-900 transition flex flex-col items-start gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                        <span className="group-hover:scale-110 transition-transform">🎨</span>
                      </div>
                      <span className="text-sm font-medium text-slate-100">Explain concept</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPrompt("Help me solve this problem step by step: ")
                      }
                      className="group rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-4 sm:px-4 sm:py-5 text-left hover:border-primary/60 hover:bg-slate-900 transition flex flex-col items-start gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                        <span className="group-hover:scale-110 transition-transform">💻</span>
                      </div>
                      <span className="text-sm font-medium text-slate-100">Solve problem</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPrompt("Give me study tips for: ")
                      }
                      className="group rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-4 sm:px-4 sm:py-5 text-left hover:border-primary/60 hover:bg-slate-900 transition flex flex-col items-start gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                        <span className="group-hover:scale-110 transition-transform">💡</span>
                      </div>
                      <span className="text-sm font-medium text-slate-100">Study tips</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuickPrompt("Create a practice quiz with answers on: ")
                      }
                      className="group rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-4 sm:px-4 sm:py-5 text-left hover:border-primary/60 hover:bg-slate-900 transition flex flex-col items-start gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                        <span className="group-hover:scale-110 transition-transform">📝</span>
                      </div>
                      <span className="text-sm font-medium text-slate-100">Practice quiz</span>
                    </button>
                  </div>
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
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-[0_18px_45px_rgba(15,23,42,0.9)] px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-3">
                {/* Plus (attachments) */}
                <button
                  type="button"
                  onClick={handleAttachmentClick}
                  className="w-8 h-8 rounded-full border border-slate-700/80 flex items-center justify-center hover:bg-slate-800/80 hover:border-primary/60 transition flex-shrink-0"
                  title={
                    attachedFiles.length
                      ? `${attachedFiles.length} photo${attachedFiles.length > 1 ? "s" : ""} selected`
                      : "Add photos (up to 10)"
                  }
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Message input */}
                <input
                  ref={inputRef}
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

                {/* Mic (voice UI only) */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 shadow-sm ${
                    isRecording
                      ? "border-primary/80 bg-primary/10 text-primary"
                      : "border-slate-400/80 bg-slate-900/90 text-slate-100 hover:border-primary/70 hover:bg-slate-800/90"
                  }`}
                  title="Voice input (UI only)"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  className="w-11 h-11 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 rounded-full flex items-center justify-center transition shadow-lg shadow-primary/30 flex-shrink-0"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
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
        SG v28
      </div>
    </div>
  );
};
