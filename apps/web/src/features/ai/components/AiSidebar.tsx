import { useState } from "react";
import { trpc } from "../../../lib/trpc";

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
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const mutation = trpc.studyApi.contextualAssistant.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: data.reply },
      ]);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }
    const content = input.trim();
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

  if (!open) {
    return null;
  }

  return (
    <aside className="hidden w-96 xl:w-[420px] flex-shrink-0 flex-col border-l border-slate-800/50 glass-card p-5 lg:flex fade-in-right min-h-0 max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header with gradient accent */}
      <div className="relative mb-5">
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
              <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{message.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-3 shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Ask the mentor anything..."
          />
          <div className="absolute bottom-3 right-3 text-xs text-slate-500">
            {input.length}/500
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Thinking...
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
  );
};