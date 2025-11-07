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
  const mutation = trpc.study.contextualAssistant.useMutation({
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
    <aside className="hidden w-96 flex-shrink-0 flex-col border-l border-slate-800 bg-slate-900/60 p-4 lg:flex">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-400">AI Mentor</p>
          <h2 className="text-lg font-semibold text-slate-100">Gemini 2.5 Pro</h2>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-slate-400">Ask anything about your current topic, mistakes, or practice plan.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-lg border border-slate-800 p-3 ${message.role === "assistant" ? "bg-slate-900" : "bg-slate-800/60"}`}
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{message.role === "assistant" ? "Mentor" : "You"}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-200">{message.content}</p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
          placeholder="Ask the mentor..."
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Thinking..." : "Send"}
        </button>
      </form>
    </aside>
  );
};