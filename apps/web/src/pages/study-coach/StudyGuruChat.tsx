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

export const StudyGuruChat = () => {
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
  });
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [regeneratingMessageIndex, setRegeneratingMessageIndex] = useState<number | null>(null);
  const [regeneratePopover, setRegeneratePopover] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleCopy = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(console.error);
    }
    setContextMenu(null);
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return;
      }
      // Strip markdown for cleaner speech
      const cleanText = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleEdit = (msg: ChatMessage, index: number) => {
    setMessage(msg.content);
    setEditingMessageIndex(index);

    // Restore images
    if (msg.images && msg.images.length > 0) {
      const restoredFiles = msg.images.map((img, i) =>
        dataURLtoFile(img, `restored-image-${i}.png`)
      );
      setAttachedFiles(restoredFiles);
    } else {
      setAttachedFiles([]);
    }

    inputRef.current?.focus();
    setContextMenu(null);
  };

  const handleRegenerate = (index: number, model?: ModelId) => {
    if (!activeChat) return;

    if (model) {
      setSelectedModel(model);
    }

    // Truncate history up to the user message at 'index'
    // The user message at 'index' is the one we want to regenerate a response FOR.
    // So we keep messages 0 to index (inclusive).
    const truncatedMessages = activeChat.messages.slice(0, index + 1);

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: truncatedMessages }
          : chat
      )
    );

    setRegeneratePopover(null);
    setIsGenerating(true);

    // Trigger generation for the last user message
    const lastUserMessage = truncatedMessages[index];
    // Images? If the user message had images, they are in the message object as data URLs.
    // We need to convert them back to the payload format { data: string; mimeType: string }
    let imagesPayload: { data: string; mimeType: string }[] | undefined;
    if (lastUserMessage.images) {
      imagesPayload = lastUserMessage.images.map(img => {
        const [meta, data] = img.split(',');
        const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
        return { data, mimeType };
      });
    }

    const historyForContext = truncatedMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    studyAssistantMutation.mutate(
      {
        section: "study",
        context: {
          mode: "study_guru",
          model: selectedModel,
          chatHistory: historyForContext,
        },
        message: lastUserMessage.content,
        images: imagesPayload,
      },
      {
        onSuccess: (response) => {
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
          setIsGenerating(false);
        },
        onError: (error) => {
          const fallbackMessage = error instanceof Error ? error.message : "Something went wrong.";
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
          setIsGenerating(false);
        },
      }
    );
  };

  const handleLongPressStart = (msg: ChatMessage, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ x: clientX, y: clientY, message: msg });
    }, 500); // 500ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

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

  const handleSend = async () => {
    if ((!message.trim() && attachedFiles.length === 0) || !activeChat) return;

    const trimmed = message.trim();
    setMessage("");
    setAttachedFiles([]);
    setIsGenerating(true);
    setHistorySearchOpen(false); // Close history search on send

    // Process images
    const imagesDataUrls: string[] = [];
    const imagesPayload: { data: string; mimeType: string }[] = [];

    for (const file of attachedFiles) {
      try {
        const { data, mimeType } = await fileToBase64(file);
        imagesDataUrls.push(`data:${mimeType};base64,${data}`);
        imagesPayload.push({ data, mimeType });
      } catch (e) {
        console.error("Failed to process image", e);
      }
    }

    // Update UI optimistically
    // If editing, we replace the history from the edit point.
    // If not editing, we append.
    let currentMessages: ChatMessage[] = [];

    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== activeChatId) return chat;

        let updatedMessages: ChatMessage[];

        if (editingMessageIndex !== null) {
          // Truncate and append new message
          updatedMessages = [
            ...chat.messages.slice(0, editingMessageIndex),
            {
              role: "user",
              content: trimmed,
              images: imagesDataUrls.length > 0 ? imagesDataUrls : undefined,
            },
          ];
        } else {
          // Append new message
          updatedMessages = [
            ...chat.messages,
            {
              role: "user",
              content: trimmed,
              images: imagesDataUrls.length > 0 ? imagesDataUrls : undefined,
            },
          ];
        }
        currentMessages = updatedMessages;
        return { ...chat, messages: updatedMessages };
      })
    );

    // Reset editing state immediately after updating UI
    if (editingMessageIndex !== null) {
      setEditingMessageIndex(null);
    }

    // Prepare context for API
    // We send the *entire* history (up to the new message) as context?
    // Or just the previous messages?
    // The API expects `chatHistory` which usually excludes the current message if it's passed separately.
    // But here we are passing `message` separately.
    // So context should be messages BEFORE the new one.
    // However, if we just edited, `currentMessages` includes the new one at the end.
    const historyForContext = currentMessages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }));

    studyAssistantMutation.mutate(
      {
        section: "study",
        context: {
          mode: "study_guru",
          model: selectedModel,
          chatHistory: historyForContext,
        },
        message: trimmed,
        images: imagesPayload.length > 0 ? imagesPayload : undefined,
      },
      {
        onSuccess: (response) => {
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
          setIsGenerating(false);
        },
        onError: (error) => {
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
          setIsGenerating(false);
        },
      }
    );
  };

  const handleStopGeneration = () => {
    if (isGenerating) {
      generationCancelledRef.current = true;
      setIsGenerating(false);
      // We can't easily cancel the HTTP request with TRPC without an AbortController hooked up,
      // but we can stop the UI from showing "Generating..."
    }
  };

  const handleQuizSubmit = (config: QuizConfig) => {
    setIsQuizPanelOpen(false);
    quizMutation.mutate({
      topic: quizChapter || "General Physics",
      difficulty: config.examType === 'advanced' ? 'hard' : 'medium',
      questionCount: config.questionCount,
      chapterId: quizChapter || undefined,
      description: quizDescription || undefined,
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    // Optional: auto-send?
    // handleSend();
  };

  const modelOptions = Object.values(MODEL_CONFIGS).map((cfg) => ({
    value: cfg.id,
    label: cfg.label,
  }));

  const renderSidebar = () => (
    <div
      className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col`}
    >
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={handleNewChat}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition font-medium shadow-lg shadow-indigo-900/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden ml-2 p-2 text-slate-400 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {chats
          .filter((chat) =>
            chat.title.toLowerCase().includes(historySearch.toLowerCase())
          )
          .map((chat) => (
            <div
              key={chat.id}
              className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border ${activeChatId === chat.id
                ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-100"
                : "hover:bg-slate-800 border-transparent text-slate-300"
                }`}
              onClick={() => {
                setActiveChatId(chat.id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">{chat.title}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {chat.messages.length > 0
                    ? chat.messages[chat.messages.length - 1].content
                    : "Empty chat"}
                </div>
              </div>

              {/* Chat Actions Dropdown Trigger (visible on hover or active) */}
              <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${openMenuChatId === chat.id ? 'opacity-100' : ''}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuChatId(openMenuChatId === chat.id ? null : chat.id);
                  }}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Dropdown Menu */}
              {openMenuChatId === chat.id && (
                <div className="absolute right-2 top-10 z-50 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameChat(chat.id);
                      setOpenMenuChatId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareChat(chat);
                      setOpenMenuChatId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                  >
                    Share
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinChat(chat.id);
                      setOpenMenuChatId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                  >
                    {chat.pinned ? "Unpin" : "Pin"}
                  </button>
                  <div className="h-px bg-slate-700 my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                      setOpenMenuChatId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {displayName}
            </div>
            <div className="text-xs text-slate-500 truncate">Pro Member</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMessages = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
      {!activeChat || activeChat.messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-indigo-500/30">
            <span className="text-4xl">🎓</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome back, {firstName}!
          </h2>
          <p className="text-slate-400 max-w-md mb-8">
            I'm your advanced AI study companion. Ask me anything about your
            courses, upload materials, or generate quizzes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
            {[
              "Explain quantum entanglement",
              "Generate a quiz on calculus",
              "Summarize this PDF",
              "Help me plan my study schedule",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleQuickPrompt(prompt)}
                className="p-3 text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-indigo-500/50 hover:text-indigo-200 transition text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        activeChat.messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
              } animate-in slide-in-from-bottom-2 duration-300`}
            onTouchStart={(e) => handleLongPressStart(msg, e)}
            onTouchEnd={handleLongPressEnd}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm relative group ${msg.role === "user"
                ? "bg-indigo-600 text-white rounded-br-none"
                : "bg-slate-900/80 border border-slate-800 text-slate-200 rounded-bl-none"
                }`}
            >
              {/* Images */}
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt="Attached"
                      className="w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border border-white/10"
                      onClick={() => setViewingImage(img)}
                    />
                  ))}
                </div>
              )}

              {/* Content */}
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <div className="relative group/code my-4">
                            <div className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition">
                              <button
                                onClick={() =>
                                  handleCopy(String(children).replace(/\n$/, ""))
                                }
                                className="p-1 bg-slate-700 rounded text-slate-300 hover:text-white"
                                title="Copy code"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                            <pre className="bg-slate-950 rounded-lg p-4 overflow-x-auto border border-slate-800">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        ) : (
                          <code
                            className="bg-slate-800/50 px-1.5 py-0.5 rounded text-indigo-200 font-mono text-sm"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {ensureMathDelimiters(msg.content)}
                  </ReactMarkdown>
                </div>
              )}

              {/* User Message Actions (Desktop Hover) */}
              {msg.role === "user" && (
                <div className="absolute -left-14 top-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex flex-col gap-1">
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(msg, index)}
                    className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* AI Message Actions (Always Visible) */}
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/50">
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-300 transition"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSpeak(msg.content)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-300 transition"
                    title="Read Aloud"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      setRegeneratePopover({ index, anchor: e.currentTarget });
                    }}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-300 transition"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
      {isGenerating && (
        <div className="flex justify-start animate-in fade-in duration-300">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
            </div>
            <span className="text-sm text-slate-400">Thinking...</span>
            <button
              onClick={handleStopGeneration}
              className="ml-2 text-xs text-red-400 hover:text-red-300 underline"
            >
              Stop
            </button>
          </div>
        </div>
      )}
      <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
    </div>
  );

  const renderInput = () => (
    <div className="p-4 bg-slate-950 border-t border-slate-800">
      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {attachedFiles.map((file, i) => (
            <div key={i} className="relative group flex-shrink-0">
              <div className="w-16 h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden">
                {file.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">File</span>
                )}
              </div>
              <button
                onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition">
        <button
          onClick={handleAttachmentClick}
          className="p-2 text-slate-400 hover:text-white transition"
          title="Attach file"
        >
          <Plus className="w-5 h-5 rotate-45" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
          accept="image/*"
        />

        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-500 resize-none py-2 max-h-32 min-h-[40px]"
          rows={1}
          style={{ height: 'auto', minHeight: '24px' }}
          onInput={(e) => {
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
          }}
        />

        <button
          onClick={toggleRecording}
          className={`p-2 rounded-lg transition ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-slate-400 hover:text-white'}`}
          title="Voice Input"
        >
          <Mic className="w-5 h-5" />
        </button>

        <button
          onClick={handleSend}
          disabled={!message.trim() && attachedFiles.length === 0}
          className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-900/20"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <div className="text-center mt-2">
        <p className="text-[10px] text-slate-600">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {renderSidebar()}

      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Header (Mobile only, mainly) */}
        <div className="md:hidden p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-medium truncate max-w-[200px]">
            {activeChat?.title || "Study Guru"}
          </span>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {renderMessages()}
        {renderInput()}
      </div>

      {/* Quiz Panel */}
      {isQuizPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-bold text-lg">Generate Quiz</h3>
              <button onClick={() => setIsQuizPanelOpen(false)} className="text-slate-400 hover:text-white">×</button>
            </div>
            <div className="p-6">
              <QuizConfigForm
                onSubmit={handleQuizSubmit}
                isGenerating={quizMutation.isPending}
              />
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Popover */}
      {regeneratePopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRegeneratePopover(null)} />
          <div
            className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-1 flex flex-col min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: regeneratePopover.anchor.getBoundingClientRect().bottom + 8,
              left: Math.min(regeneratePopover.anchor.getBoundingClientRect().left, window.innerWidth - 170),
            }}
          >
            <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Regenerate with
            </div>
            {modelOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleRegenerate(regeneratePopover.index, opt.value as ModelId)}
                className="text-left px-3 py-2 hover:bg-slate-700 rounded text-sm text-slate-200 transition flex items-center justify-between group"
              >
                <span>{opt.label}</span>
                {selectedModel === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Context Menu (Mobile) */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: window.innerWidth >= 640 ? "absolute" : "relative",
              left: window.innerWidth >= 640 ? contextMenu.x : undefined,
              top: window.innerWidth >= 640 ? contextMenu.y : undefined,
            }}
          >
            <div className="p-2 space-y-1">
              <button
                onClick={() => handleCopy(contextMenu.message.content)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <Copy className="w-5 h-5 text-slate-400" />
                <span className="font-medium">Copy</span>
              </button>
              {contextMenu.message.role === 'user' && (
                <button
                  onClick={() => handleEdit(contextMenu.message, activeChat.messages.indexOf(contextMenu.message))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-200 hover:bg-slate-800 rounded-lg transition"
                >
                  <Pencil className="w-5 h-5 text-slate-400" />
                  <span className="font-medium">Edit Message</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
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
