import { useState, useRef, useEffect, type SVGProps, type ChangeEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { trpc } from "../../lib/trpc";
import { useNavigate } from "react-router-dom";
import { QuizConfigForm, type QuizConfig } from "../../features/quiz/components/QuizConfigForm";
import { GlowSelect } from "../../components/ui/GlowSelect";

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

const Copy = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const Pencil = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const Volume2 = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const RefreshCw = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ensureMathDelimiters = (text: string): string => {
  if (!text) return text;
  let processed = text;
  processed = processed.replace(/\\\((.+?)\\\)/g, (_match, p1) => `$${p1}$`);
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_match, p1) => `$$${p1}$$`);
  return processed;
};

const buildChatTitleFromMessage = (text: string): string => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New Chat";
  const words = cleaned.split(" ");
  const wordLimited = words.slice(0, 8).join(" ");
  const charLimit = 48;
  const base = wordLimited.length > charLimit ? wordLimited.slice(0, charLimit) : wordLimited;
  return base.length < cleaned.length ? `${base}...` : base;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // Base64 data URLs
};

type Chat = {
  id: number;
  title: string;
  messages: ChatMessage[];
  recent?: boolean;
  pinned?: boolean;
  userRenamed?: boolean;
  serverId?: string;
};

type ModelId =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "openrouter/sherlock-think-alpha"
  | "tngtech/deepseek-r1t2-chimera:free"
  | "deepseek/deepseek-r1-0528:free"
  | "qwen/qwen3-coder:free"
  | "z-ai/glm-4.5-air:free";

type ModelConfig = {
  id: ModelId;
  label: string;
  supportsImages: boolean;
  maxImages: number;
};

const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  "gemini-2.5-flash": { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", supportsImages: true, maxImages: 10 },
  "gemini-2.5-pro": { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", supportsImages: true, maxImages: 10 },
  "openrouter/sherlock-think-alpha": { id: "openrouter/sherlock-think-alpha", label: "Sherlock Think Alpha", supportsImages: true, maxImages: 10 },
  "tngtech/deepseek-r1t2-chimera:free": { id: "tngtech/deepseek-r1t2-chimera:free", label: "DeepSeek R1T2 Chimera", supportsImages: false, maxImages: 0 },
  "deepseek/deepseek-r1-0528:free": { id: "deepseek/deepseek-r1-0528:free", label: "DeepSeek: R1 0528", supportsImages: false, maxImages: 0 },
  "qwen/qwen3-coder:free": { id: "qwen/qwen3-coder:free", label: "Qwen3 Coder 480B A35B", supportsImages: false, maxImages: 0 },
  "z-ai/glm-4.5-air:free": { id: "z-ai/glm-4.5-air:free", label: "GLM-4.5 Air", supportsImages: false, maxImages: 0 },
};

const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/xxx;base64, prefix
      const base64Data = result.split(",")[1];
      resolve({ data: base64Data, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?);/);
  const mimeType = mimeMatch?.[1] || "image/png";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
};

export const StudyGuruChat = () => {
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number>(0);
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openMenuChatId, setOpenMenuChatId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini-2.5-flash");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQuizPanelOpen, setIsQuizPanelOpen] = useState(false);
  const [quizChapter, setQuizChapter] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const saveDebounceRef = useRef<number | null>(null);
  const generationCancelledRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    messageIndex: number;
    role: "user" | "assistant";
  } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [regeneratePopover, setRegeneratePopover] = useState<{
    userIndex: number;
    anchor: HTMLElement;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false; // Fix for repetition
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              // Fallback if interim is somehow true or for other browsers
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            const cleanTranscript = finalTranscript.trim();
            if (cleanTranscript) {
              setMessage((prev) => {
                const trailingSpace = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
                return prev + trailingSpace + cleanTranscript;
              });
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started or error
      }
    } else if (!isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }, [isRecording]);

  const studyAssistantMutation = trpc.studyApi.contextualAssistant.useMutation();
  const quizMutation = trpc.quiz.generateQuiz.useMutation({
    onSuccess: (data) => {
      navigate(`/quiz/${data.quizId}`);
    },
  });
  const listConversationsQuery = trpc.studyApi.listStudyGuruConversations.useQuery(
    { limit: 50 },
    {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    }
  );
  const saveConversationMutation = trpc.studyApi.saveStudyGuruConversation.useMutation();
  const deleteConversationMutation = trpc.studyApi.deleteStudyGuruConversation.useMutation();

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

  const storageKey = "study_guru_chats_v2";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        chats?: Chat[];
        activeChatId?: number | null;
        selectedModel?: ModelId;
      };
      if (parsed && Array.isArray(parsed.chats) && parsed.chats.length > 0) {
        setChats(parsed.chats);
        const nextActiveId = parsed.activeChatId ?? parsed.chats[0]?.id ?? 0;
        if (nextActiveId) {
          setActiveChatId(nextActiveId);
        }
        if (parsed.selectedModel) {
          setSelectedModel(parsed.selectedModel);
        }
      }
    } catch { }
  }, []);

  useEffect(() => {
    try {
      const payload = {
        chats,
        activeChatId,
        selectedModel,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch { }
  }, [chats, activeChatId, selectedModel]);

  useEffect(() => {
    if (!listConversationsQuery.data) return;
    const conversations = listConversationsQuery.data;
    setChats((prev) => {
      let updated = [...prev];
      let nextId =
        updated.length > 0 ? Math.max(...updated.map((c) => c.id)) + 1 : 1;

      conversations.forEach((conv) => {
        const existingIndex = updated.findIndex(
          (chat) => (chat as any).serverId === conv.id
        );
        const rawMessages = (conv as any).messages;
        const convMessages: ChatMessage[] = Array.isArray(rawMessages)
          ? (rawMessages as ChatMessage[])
          : [];
        if (existingIndex >= 0) {
          const existing = updated[existingIndex] as Chat & { serverId?: string };
          const mergedMessages =
            existing.messages && existing.messages.length > 0
              ? existing.messages
              : convMessages;
          updated[existingIndex] = {
            ...existing,
            title: existing.title || conv.title,
            messages: mergedMessages,
            serverId: conv.id,
          } as Chat;
        } else {
          updated.push({
            id: nextId++,
            title: conv.title,
            recent: true,
            messages: convMessages,
            pinned: false,
            serverId: conv.id,
          } as Chat);
        }
      });

      return updated;
    });
  }, [listConversationsQuery.data]);

  // Ensure at least one empty local chat when there are no server conversations
  // and no chats loaded from local storage.
  useEffect(() => {
    if (
      chats.length === 0 &&
      !listConversationsQuery.isLoading &&
      (listConversationsQuery.data?.length ?? 0) === 0
    ) {
      handleNewChat();
    }
  }, [chats.length, listConversationsQuery.isLoading, listConversationsQuery.data]);

  useEffect(() => {
    if (!activeChat || !activeChat.messages.length) return;

    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = window.setTimeout(() => {
      if (saveConversationMutation.isPending) {
        return;
      }

      saveConversationMutation.mutate(
        {
          id: (activeChat as any).serverId,
          title: activeChat.title || "Study Guru chat",
          messages: activeChat.messages,
          model: selectedModel,
        },
        {
          onSuccess: (conv) => {
            if (!(activeChat as any).serverId) {
              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === activeChat.id
                    ? ({ ...chat, serverId: conv.id } as any)
                    : chat
                )
              );
            }
          },
        }
      );
    }, 1000);

    return () => {
      if (saveDebounceRef.current !== null) {
        window.clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [activeChatId, activeChat?.messages.length, selectedModel, saveConversationMutation, setChats]);

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now(),
      title: `New Chat ${chats.length + 1}`,
      recent: true,
      messages: [],
      userRenamed: false,
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
  };

  const handleDeleteChat = (id: number) => {
    const chatToDelete = chats.find((chat) => chat.id === id) as any;
    if (chatToDelete?.serverId) {
      deleteConversationMutation.mutate({ id: chatToDelete.serverId });
    }
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
    const trimmedTitle = newTitle.trim();

    setChats((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
            ...c,
            title: trimmedTitle,
            userRenamed: true,
          }
          : c
      )
    );

    const serverId = (chat as any).serverId as string | undefined;
    if (serverId) {
      saveConversationMutation.mutate({
        id: serverId,
        title: trimmedTitle,
        messages: chat.messages,
        model: selectedModel,
      });
    }
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

  const handleCopyText = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => { });
    }
  };

  const handleEditMessage = (index: number) => {
    if (!activeChat) return;
    const msg = activeChat.messages[index];
    if (!msg || msg.role !== "user") return;
    setEditingIndex(index);
    setMessage(msg.content);

    if (msg.images && msg.images.length > 0) {
      const files = msg.images.map((url, i) => dataUrlToFile(url, `edited-image-${i}.png`));
      setAttachedFiles(files);
    } else {
      setAttachedFiles([]);
    }

    inputRef.current?.focus();
    setContextMenu(null);
  };

  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    const clean = text.replace(/[*#_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    window.speechSynthesis.speak(utterance);
  };

  const findUserIndexForAssistant = (assistantIndex: number): number | null => {
    if (!activeChat) return null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (activeChat.messages[i].role === "user") return i;
    }
    return null;
  };

  const handleRegenerateWithModel = async (userIndex: number, model: ModelId) => {
    if (!activeChat) return;

    const baseMessages = activeChat.messages.slice(0, userIndex);
    const userMessage = activeChat.messages[userIndex];
    if (!userMessage || userMessage.role !== "user") return;

    generationCancelledRef.current = false;
    setSelectedModel(model);

    let imagesPayload: { data: string; mimeType: string }[] | undefined;
    if (userMessage.images && userMessage.images.length > 0) {
      imagesPayload = userMessage.images.map((img) => {
        const [meta, data] = img.split(",");
        const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/png";
        return { data, mimeType };
      });
    }

    const truncatedMessages: ChatMessage[] = [...baseMessages, { ...userMessage }];

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId ? { ...chat, messages: truncatedMessages } : chat
      )
    );
    setRegeneratePopover(null);
    setIsGenerating(true);

    try {
      const response = await studyAssistantMutation.mutateAsync({
        section: "study",
        context: {
          mode: "study_guru",
          model,
          chatHistory: baseMessages,
        },
        message: userMessage.content,
        images: imagesPayload,
      });

      if (!generationCancelledRef.current) {
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== activeChatId) return chat;
            return {
              ...chat,
              messages: [
                ...chat.messages,
                { role: "assistant", content: response.reply },
              ],
            };
          })
        );
      }
    } catch (error) {
      if (!generationCancelledRef.current) {
        const fallbackMessage =
          error instanceof Error ? error.message : "Something went wrong.";
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== activeChatId) return chat;
            return {
              ...chat,
              messages: [
                ...chat.messages,
                { role: "assistant", content: fallbackMessage },
              ],
            };
          })
        );
      }
    } finally {
      if (!generationCancelledRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleRegenerateClick = (assistantIndex: number, anchor: HTMLElement) => {
    const userIndex = findUserIndexForAssistant(assistantIndex);
    if (userIndex === null) return;
    setRegeneratePopover({ userIndex, anchor });
  };

  const handleLongPressStart = (
    index: number,
    role: "user" | "assistant",
    e: React.TouchEvent<HTMLDivElement>
  ) => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    longPressTimerRef.current = window.setTimeout(() => {
      setContextMenu({ x: clientX, y: clientY, messageIndex: index, role });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !activeChat || isGenerating || quizMutation.isPending) return;

    const trimmed = message.trim();
    const isEditing =
      editingIndex !== null &&
      activeChat.messages[editingIndex] &&
      activeChat.messages[editingIndex].role === "user";

    const baseMessages = isEditing
      ? activeChat.messages.slice(0, editingIndex as number)
      : activeChat.messages;

    const lower = trimmed.toLowerCase();
    const practiceKeywords = ["practice", "quiz", "test", "questions", "exam", "solve"];
    const wantsPractice = practiceKeywords.some((keyword) => lower.includes(keyword));
    const willHaveMessagesCount = baseMessages.length + 1;
    const isDefaultTitle =
      !activeChat.title || activeChat.title.toLowerCase().startsWith("new chat ");
    const isFirstAutoTitleTrigger = isDefaultTitle && willHaveMessagesCount === 5;
    const isPeriodicTrigger = willHaveMessagesCount > 1 && willHaveMessagesCount % 20 === 0;
    const canAutoTitle = !activeChat.userRenamed;
    const shouldUpdateTitle = canAutoTitle && (isFirstAutoTitleTrigger || isPeriodicTrigger);
    const nextTitle = shouldUpdateTitle
      ? buildChatTitleFromMessage(trimmed)
      : activeChat.title;

    // Only trigger quiz flow for fresh messages, not when editing history
    if (wantsPractice && !isEditing) {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === activeChatId
            ? {
              ...chat,
              title: nextTitle,
              messages: [
                ...chat.messages,
                { role: "user", content: trimmed },
                {
                  role: "assistant",
                  content:
                    "Great! Let's set up a practice quiz for you. Please configure your preferences below:",
                },
              ],
            }
            : chat
        )
      );
      setMessage("");
      setIsQuizPanelOpen(true);
      return;
    }

    generationCancelledRef.current = false;

    // Process images for display and payload
    let imagesPayload: { data: string; mimeType: string }[] | undefined;
    let imagesDataUrls: string[] = [];

    if (attachedFiles.length > 0) {
      try {
        const processed = await Promise.all(attachedFiles.map(fileToBase64));
        imagesPayload = processed;
        // Reconstruct data URLs for local display
        imagesDataUrls = processed.map(p => `data:${p.mimeType};base64,${p.data}`);
      } catch (e) {
        console.error("Failed to process images", e);
      }
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      images: imagesDataUrls.length > 0 ? imagesDataUrls : undefined,
    };
    const nextMessages: ChatMessage[] = [...baseMessages, userMessage];

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === activeChatId
          ? {
            ...chat,
            title: nextTitle,
            messages: nextMessages,
          }
          : chat
      )
    );

    setMessage("");
    setAttachedFiles([]); // Clear images immediately
    setEditingIndex(null);
    setIsGenerating(true);

    try {
      const response = await studyAssistantMutation.mutateAsync({
        section: "study",
        context: {
          mode: "study_guru",
          model: selectedModel,
          // Only send messages before the current one as history; the
          // current message goes separately in `message`.
          chatHistory: baseMessages,
        },
        message: trimmed,
        images: imagesPayload,
      });

      if (!generationCancelledRef.current) {
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== activeChatId) return chat;
            const updatedMessages: ChatMessage[] = [
              ...chat.messages,
              { role: "assistant", content: response.reply },
            ];
            return {
              ...chat,
              messages: updatedMessages,
            };
          })
        );
      }
    } catch (error) {
      if (!generationCancelledRef.current) {
        const fallbackMessage =
          error instanceof Error ? error.message : "Something went wrong. Try again.";
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== activeChatId) return chat;
            const updatedMessages: ChatMessage[] = [
              ...chat.messages,
              { role: "assistant", content: fallbackMessage },
            ];
            return {
              ...chat,
              messages: updatedMessages,
            };
          })
        );
      }
    } finally {
      if (!generationCancelledRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleStopGeneration = () => {
    if (!isGenerating) return;
    generationCancelledRef.current = true;
    studyAssistantMutation.reset();
    setIsGenerating(false);
  };

  const handleQuizSubmit = (config: QuizConfig) => {
    if (!activeChat || quizMutation.isPending) return;
    const allMessages = activeChat.messages;
    const start = Math.max(0, allMessages.length - 20);
    const chatHistoryForQuiz = allMessages.slice(start);

    const safeConfig: QuizConfig = {
      ...config,
      questionCount: Math.min(50, Math.max(1, config.questionCount || 10)),
      pictureQuestionRatio:
        typeof config.pictureQuestionRatio === "number"
          ? Math.max(0, Math.min(1, config.pictureQuestionRatio))
          : config.examType === "advanced"
            ? 0.3
            : 0.2,
    };

    quizMutation.mutate({
      ...safeConfig,
      context: {
        entity: "study_guru",
        chapter: quizChapter,
        description: quizDescription,
        chatHistoryForQuiz,
      },
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const config = MODEL_CONFIGS[selectedModel];
    if (!config.supportsImages) {
      alert(`The selected model (${config.label}) does not support images.`);
      event.target.value = "";
      return;
    }

    setAttachedFiles((prev) => {
      const combined = [...prev, ...files];
      if (combined.length > config.maxImages) {
        alert(`You can only upload up to ${config.maxImages} images with this model.`);
        return combined.slice(0, config.maxImages);
      }
      return combined;
    });
    // Allow selecting the same file again by resetting the input
    event.target.value = "";
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser.");
      return;
    }
    setIsRecording((prev) => !prev);
  };

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    inputRef.current?.focus();
  };

  const modelOptions: ModelId[] = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "tngtech/deepseek-r1t2-chimera:free",
    "z-ai/glm-4.5-air:free",
    "deepseek/deepseek-r1-0528:free",
    "openrouter/sherlock-think-alpha",
  ];

  return (
    <div className="relative flex h-full min-h-0 w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${sidebarOpen
          ? "translate-x-0 w-72"
          : "-translate-x-full w-72 md:w-0 md:translate-x-0"
          } absolute md:relative z-50 h-full bg-gradient-to-b from-slate-950/95 via-slate-900/95 to-slate-950/95 border-r border-slate-800/80 flex flex-col transition-all duration-300 overflow-hidden shadow-2xl md:shadow-none`}
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
        < div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar" >
          {/* Recent Section */}
          < div className="p-4" >
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
                  <div
                    key={chat.id}
                    className={`group relative flex items-center rounded-full px-1 border transition-colors ${
                      activeChatId === chat.id
                        ? "bg-gradient-to-r from-primary/20 via-blue-500/15 to-purple-500/25 border-primary/50"
                        : "border-transparent hover:bg-gradient-to-r hover:from-primary/10 hover:via-blue-500/5 hover:to-purple-500/10 hover:border-primary/40"
                    }`}
                  >
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className="flex-1 flex items-center py-1.5 pl-3 pr-1 text-left text-sm rounded-full text-slate-200"
                    >
                      <span className="inline-flex items-center gap-1 min-w-0">
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
                      className="mr-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-100 transition"
                      aria-label="Chat options"
                    >
                      ...
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
          </div >

          {/* Other Chats */}
          < div className="p-4" >
            <div className="space-y-1">
              {chats
                .filter((chat) => !chat.recent)
                .filter((chat) =>
                  historySearch.trim()
                    ? chat.title.toLowerCase().includes(historySearch.toLowerCase())
                    : true
                )
                .map((chat) => (
                  <div
                    key={chat.id}
                    className={`group relative flex items-center rounded-full px-1 border transition-colors ${
                      activeChatId === chat.id
                        ? "bg-gradient-to-r from-primary/20 via-blue-500/15 to-purple-500/25 border-primary/50"
                        : "border-transparent hover:bg-gradient-to-r hover:from-primary/10 hover:via-blue-500/5 hover:to-purple-500/10 hover:border-primary/40"
                    }`}
                  >
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className="flex-1 flex items-center py-1.5 pl-3 pr-1 text-left text-sm rounded-full text-slate-200"
                    >
                      <span className="inline-flex items-center gap-1 min-w-0">
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
                      className="mr-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-100 transition"
                      aria-label="Chat options"
                    >
                      ...
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
          </div >
        </div >

        <div className="px-4 pt-1 pb-0 flex-shrink-0">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Model</label>
            <GlowSelect
              id="study-guru-model"
              value={selectedModel}
              onChange={(nextValue) => {
                const newModel = nextValue as ModelId;
                const config = MODEL_CONFIGS[newModel];
                if (!config.supportsImages && attachedFiles.length > 0) {
                  const confirm = window.confirm(
                    `The selected model (${config.label}) does not support images. Your attached images will be removed. Continue?`
                  );
                  if (!confirm) return;
                  setAttachedFiles([]);
                }
                setSelectedModel(newModel);
              }}
              options={modelOptions.map((option) => ({
                value: option,
                label: MODEL_CONFIGS[option]?.label ?? option,
              }))}
              placeholder="Select model"
              placement="top"
              className="min-w-0"
              listClassName="min-w-0 sm:min-w-[12rem]"
            />
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
      </div >

      {/* Main Chat Area */}
      < div className="flex-1 flex flex-col relative" >
        {/* Top Header */}
        < div className="h-16 flex items-center px-4" >
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
        </div >

        {/* Scrollable Chat Section */}
        < div className="flex-1 overflow-y-auto px-6 pt-8 pb-40 custom-scrollbar" >
          <div className="max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto space-y-6">
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
                  <div
                    key={index}
                    className="flex justify-end group"
                    onTouchStart={(e) => handleLongPressStart(index, "user", e)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchMove={handleLongPressEnd}
                  >
                    <div className="flex flex-col items-end w-full max-w-lg md:max-w-none">
                      {msg.images && msg.images.length > 0 && (
                        <div className="mb-2 flex flex-wrap justify-end gap-2">
                          {msg.images.map((imgSrc, idx) => (
                            <div
                              key={idx}
                              className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-slate-700/50 cursor-pointer hover:opacity-90 transition"
                              onClick={() => setViewingImage(imgSrc)}
                            >
                              <img src={imgSrc} alt="uploaded" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1 mr-1">
                          <button
                            onClick={() => handleCopyText(msg.content)}
                            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditMessage(index)}
                            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="bg-gradient-to-r from-primary/80 via-blue-500/80 to-purple-500/80 rounded-2xl rounded-tr-sm px-6 py-4 border border-primary/60 shadow-md shadow-primary/40">
                          <p className="text-slate-100">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={index}
                    className="flex justify-start group"
                    onTouchStart={(e) => handleLongPressStart(index, "assistant", e)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchMove={handleLongPressEnd}
                  >
                    <div className="w-full bg-slate-900/80 border border-slate-700/80 rounded-2xl rounded-tl-sm px-6 py-4 max-w-2xl md:max-w-none shadow-lg shadow-slate-900/60">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary to-purple-600 rounded-full flex-shrink-0 mt-1" />
                        <div>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
                            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            className="prose prose-invert prose-sm max-w-none text-slate-100 leading-relaxed"
                            components={{
                              h1: ({ node, ...props }) => (
                                <h1 className="text-lg font-bold text-emerald-400 mt-4 mb-2" {...props} />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 className="text-base font-bold text-emerald-400 mt-3 mb-2" {...props} />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3 className="text-sm font-bold text-emerald-300 mt-2 mb-1" {...props} />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul className="list-disc list-inside space-y-1 my-2" {...props} />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol className="list-decimal list-inside space-y-1 my-2" {...props} />
                              ),
                              li: ({ node, ...props }) => <li className="text-slate-200" {...props} />,
                              code: ({ node, inline, ...props }) =>
                                inline ? (
                                  <code
                                    className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-xs font-mono"
                                    {...props}
                                  />
                                ) : (
                                  <code
                                    className="block px-3 py-2 rounded-lg bg-slate-800 text-emerald-300 text-xs font-mono overflow-x-auto"
                                    {...props}
                                  />
                                ),
                              p: ({ node, ...props }) => (
                                <p className="text-slate-200 my-2" {...props} />
                              ),
                              strong: ({ node, ...props }) => (
                                <strong className="font-bold text-emerald-300" {...props} />
                              ),
                              em: ({ node, ...props }) => (
                                <em className="italic text-slate-300" {...props} />
                              ),
                              hr: ({ node, ...props }) => (
                                <hr className="my-4 border-slate-700" {...props} />
                              ),
                              table: ({ node, ...props }) => (
                                <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-950/60">
                                  <table className="w-full border-collapse text-xs sm:text-sm text-left" {...props} />
                                </div>
                              ),
                              thead: ({ node, ...props }) => (
                                <thead className="bg-slate-900/80" {...props} />
                              ),
                              tbody: ({ node, ...props }) => <tbody {...props} />,
                              tr: ({ node, ...props }) => (
                                <tr className="border-b border-slate-800/80 last:border-0" {...props} />
                              ),
                              th: ({ node, ...props }) => (
                                <th className="px-3 py-2 font-semibold text-slate-100" {...props} />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="px-3 py-2 align-top text-slate-200" {...props} />
                              ),
                            }}
                          >
                            {ensureMathDelimiters(msg.content)}
                          </ReactMarkdown>
                          <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleCopyText(msg.content)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
                              title="Copy"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleSpeak(msg.content)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
                              title="Read aloud"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleRegenerateClick(index, e.currentTarget)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
                              title="Regenerate"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
            {activeChat && isGenerating && (
              <div className="flex justify-start">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 animate-pulse"></div>
                  <div className="relative flex items-center gap-4 px-6 py-4 bg-slate-950/90 rounded-2xl border border-slate-800/50 shadow-2xl backdrop-blur-xl">
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 border-r-blue-500 animate-spin [animation-duration:1.5s]" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-l-purple-500 border-b-pink-500 animate-spin [animation-duration:1s] [animation-direction:reverse]" />
                      <div className="absolute inset-1.5 rounded-full bg-cyan-500/20 animate-pulse" />
                    </div>
                    <span className="text-sm font-medium bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent animate-pulse">
                      Study Guru is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
            {activeChat && isQuizPanelOpen && (
              <div className="mt-3">
                <QuizConfigForm
                  onSubmit={(config) => {
                    handleQuizSubmit(config);
                    setIsQuizPanelOpen(false);
                  }}
                  onCancel={() => setIsQuizPanelOpen(false)}
                  isLoading={quizMutation.isPending}
                  section="study"
                  studyChapter={quizChapter}
                  studyDescription={quizDescription}
                  onChangeStudyChapter={setQuizChapter}
                  onChangeStudyDescription={setQuizDescription}
                />
              </div>
            )}
          </div>
        </div >

        {/* Input Area pinned to bottom of chat column */}
        < div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 sm:pb-6" >
          <div className="max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto py-2 px-1">
                {attachedFiles.map((file, i) => (
                  <div key={i} className="relative group flex-shrink-0">
                    <div className="w-16 h-16 rounded-lg border border-slate-700 overflow-hidden bg-slate-900">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                      />
                    </div>
                    <button
                      onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                  disabled={quizMutation.isPending}
                  className="flex-1 bg-slate-950/70 border border-slate-800/80 rounded-full px-5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
                />

                {/* Mic (voice UI only) */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 shadow-sm ${isRecording
                    ? "border-red-500/80 bg-red-500/20 text-red-500 animate-pulse ring-2 ring-red-500/30"
                    : "border-slate-400/80 bg-slate-900/90 text-slate-100 hover:border-primary/70 hover:bg-slate-800/90"
                    }`}
                  title="Voice input"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Send / Stop button */}
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="w-24 h-11 rounded-full bg-slate-900/90 border border-primary/70 flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-slate-800 transition flex-shrink-0"
                  >
                    <span className="w-4 h-4 border-2 border-primary/70 border-t-transparent rounded-full animate-spin" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={quizMutation.isPending}
                    className="w-11 h-11 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 rounded-full flex items-center justify-center transition shadow-lg shadow-primary/30 flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5 text-white" />
                  </button>
                )}
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
        </div >
      </div >

      {/* Regenerate model chooser */}
      {regeneratePopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setRegeneratePopover(null)}
          />
          <div
            className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 min-w-[180px]"
            style={{
              top: Math.min(
                regeneratePopover.anchor.getBoundingClientRect().bottom + 8,
                window.innerHeight - 200,
              ),
              left: Math.min(
                regeneratePopover.anchor.getBoundingClientRect().left,
                window.innerWidth - 220,
              ),
            }}
          >
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Regenerate with
            </div>
            <div className="space-y-1">
              {modelOptions.map((id) => (
                <button
                  key={id}
                  onClick={() => handleRegenerateWithModel(regeneratePopover.userIndex, id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm text-slate-100 hover:bg-slate-800 transition"
                >
                  <span>{MODEL_CONFIGS[id].label}</span>
                  {id === selectedModel && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mobile / desktop long-press context menu */}
      {contextMenu && activeChat && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: window.innerWidth >= 640 ? "absolute" : "relative",
              left: window.innerWidth >= 640 ? contextMenu.x : undefined,
              top: window.innerWidth >= 640 ? contextMenu.y : undefined,
            }}
          >
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  const msg = activeChat.messages[contextMenu.messageIndex];
                  if (msg) handleCopyText(msg.content);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <Copy className="w-5 h-5 text-slate-400" />
                <span className="font-medium">Copy</span>
              </button>
              {contextMenu.role === "user" && (
                <button
                  onClick={() => handleEditMessage(contextMenu.messageIndex)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <Pencil className="w-5 h-5 text-slate-400" />
                  <span className="font-medium">Edit message</span>
                </button>
              )}
              {contextMenu.role === "assistant" && (
                <button
                  onClick={() => {
                    const msg = activeChat.messages[contextMenu.messageIndex];
                    if (msg) handleSpeak(msg.content);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <Volume2 className="w-5 h-5 text-slate-400" />
                  <span className="font-medium">Read aloud</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={viewingImage}
              alt="Full view"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full text-white flex items-center justify-center transition backdrop-blur-md"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
