"use client";

import { useEffect, useRef, useState } from "react";
import { FiSend, FiZap, FiTrash2 } from "react-icons/fi";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarise my career in 3 bullet points",
  "What's my current net worth?",
  "Which of my positions has the strongest thesis?",
  "What should I write a note about next, based on my published ones?",
];

export default function AdminChat({
  onError,
}: {
  onError: (msg: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send(content: string) {
    const text = content.trim();
    if (!text || sending) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Chat failed");
        setSending(false);
        // Pop the user message so they can retry
        setMessages(messages);
        return;
      }
      setMessages([
        ...next,
        { role: "assistant", content: data.reply || "(no reply)" },
      ]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
      setMessages(messages);
    }
    setSending(false);
  }

  function clear() {
    if (messages.length === 0) return;
    if (!confirm("Clear the chat?")) return;
    setMessages([]);
  }

  return (
    <section className="flex flex-col" style={{ height: "calc(100vh - 240px)", minHeight: 500 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Chat</h2>
          <p className="text-xs text-[#666] mt-1">
            Ask anything about your work, your book, your notes, or your
            portfolio (via connected services).
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs hover:border-red-500/40 hover:text-red-400 transition-colors"
          >
            <FiTrash2 size={11} />
            Clear
          </button>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto rounded-2xl bg-[#0a0a0a] border border-white/[0.06] p-5 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center shadow-[0_8px_30px_rgba(255,107,0,0.35)]">
              <FiZap size={22} className="text-black" />
            </div>
            <div>
              <p className="text-white font-semibold">Hi Krishna.</p>
              <p className="text-[#888] text-sm mt-1 max-w-md">
                I can see your jobs, projects, published notes, and live data
                from any connectors you&apos;ve enabled. Try a prompt below.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 max-w-xl w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-xs text-[#bbb] bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-[#ff6b00]/30 hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-[#888] text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-[#ff6b00] animate-pulse" />
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="mt-4 flex items-end gap-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          disabled={sending}
          className="flex-1 px-4 py-3 rounded-2xl bg-[#1a1a1a] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] resize-none disabled:opacity-60"
          placeholder='Ask something… ("show my net worth", "summarise my work")'
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiSend size={14} />
          Send
        </button>
      </form>
    </section>
  );
}

function ChatBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] text-black"
            : "bg-[#1a1a1a] border border-white/[0.06] text-[#eee]"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
