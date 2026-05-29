"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiSend,
  FiZap,
  FiTrash2,
  FiPlus,
  FiClock,
  FiStar,
} from "react-icons/fi";
import { modelsFor, DEFAULT_CHAT_MODEL } from "@/lib/groq-models";
import VoiceMic from "./VoiceMic";

type Message = { role: "user" | "assistant"; content: string };

type Thread = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

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
  const [model, setModel] = useState<string>(DEFAULT_CHAT_MODEL);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const chatOptions = modelsFor("chat");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("krishna_admin_chat_model");
      if (saved) setModel(saved);
    } catch {}
    void loadThreads();
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("krishna_admin_chat_model", model);
    } catch {}
  }, [model]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function loadThreads() {
    const r = await fetch("/api/admin/chat/threads", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.threads)) setThreads(j.threads);
  }

  async function openThread(id: string) {
    const r = await fetch(`/api/admin/chat/threads/${id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Could not load thread");
      return;
    }
    setThreadId(id);
    setMessages(
      (j.messages as Array<{ role: string; content: string | null }>)
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }))
    );
  }

  function newChat() {
    setThreadId(null);
    setMessages([]);
    setDraft("");
  }

  async function pinThread(id: string, pinned: boolean) {
    await fetch(`/api/admin/chat/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    void loadThreads();
  }

  async function deleteThread(id: string) {
    if (!confirm("Delete this conversation forever?")) return;
    await fetch(`/api/admin/chat/threads/${id}`, { method: "DELETE" });
    if (threadId === id) newChat();
    void loadThreads();
  }

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
        body: JSON.stringify({
          // Only send the newest user message — the server hydrates earlier
          // turns from the thread's persisted history.
          messages: [{ role: "user", content: text }],
          model,
          thread_id: threadId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Chat failed");
        setSending(false);
        setMessages(messages);
        return;
      }
      if (data.thread_id && data.thread_id !== threadId) {
        setThreadId(data.thread_id);
        // refresh sidebar so the new thread appears
        void loadThreads();
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

  return (
    <section
      className="grid lg:grid-cols-[240px_1fr] gap-4"
      style={{ height: "calc(100vh - 240px)", minHeight: 500 }}
    >
      {/* Sidebar: thread list */}
      <aside className="hidden lg:flex flex-col rounded-2xl bg-[#0a0a0a] border border-white/[0.06] overflow-hidden">
        <div className="p-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
            Threads
          </span>
          <button
            type="button"
            onClick={newChat}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ff6b00]/15 border border-[#ff6b00]/30 text-[#ff8c38] text-[10px] hover:bg-[#ff6b00]/25"
          >
            <FiPlus size={10} />
            New
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.length === 0 ? (
            <li className="p-3 text-[11px] text-[#555]">
              No history yet. Start a chat — it'll save here automatically.
            </li>
          ) : (
            threads.map((t) => {
              const active = t.id === threadId;
              return (
                <li key={t.id}>
                  <div
                    className={`group rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition-colors ${
                      active
                        ? "bg-[#ff6b00]/10 border border-[#ff6b00]/30"
                        : "bg-white/[0.02] border border-transparent hover:border-white/[0.08]"
                    }`}
                    onClick={() => openThread(t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate font-medium">
                        {t.title}
                      </div>
                      <div className="text-[9px] text-[#666] font-mono mt-0.5">
                        {new Date(t.updated_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          pinThread(t.id, !t.pinned);
                        }}
                        className={`w-6 h-6 rounded-md flex items-center justify-center ${t.pinned ? "text-[#ff8c38]" : "text-[#555] hover:text-white"}`}
                        title={t.pinned ? "Unpin" : "Pin"}
                      >
                        <FiStar size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteThread(t.id);
                        }}
                        className="w-6 h-6 rounded-md text-[#555] hover:text-red-400 flex items-center justify-center"
                        title="Delete"
                      >
                        <FiTrash2 size={10} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* Main pane */}
      <div className="flex flex-col min-w-0">
        {/* Minimal header — just title on desktop, hidden on mobile (the
            tab name shows in the global header on phones). */}
        <div className="hidden lg:flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-xl font-bold">Chat</h2>
            <p className="text-xs text-[#666] mt-1">
              Threads + facts auto-loaded. Pick a past conversation on the
              left to resume.
            </p>
          </div>
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
                  I can see your jobs, projects, published notes, your facts
                  table, and live data from any connectors you&apos;ve enabled.
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

        {threadId && messages.length > 0 && (
          <p className="mt-1 text-[10px] font-mono text-[#666] flex items-center gap-1.5">
            <FiClock size={10} />
            saved to thread {threadId.slice(0, 8)}…
          </p>
        )}

        {/* Composer — iMessage-style. Textarea, then a toolbar inside the
            same wrapper with [+] [model picker] ... [mic] [send]. Mic is
            always visible. New-chat + model live here on mobile because the
            top header used to push them off-screen. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="mt-3 rounded-2xl bg-[#1a1a1a] border border-white/[0.08] focus-within:border-[#ff6b00]/40 transition-colors"
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
            className="w-full px-4 pt-3 pb-2 bg-transparent focus:outline-none text-sm text-white placeholder:text-[#555] resize-none disabled:opacity-60"
            placeholder="Ask Lucy… or tap the mic"
          />
          <div className="flex items-center gap-1.5 px-2 py-2 border-t border-white/[0.05]">
            {/* New chat */}
            <button
              type="button"
              onClick={newChat}
              className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#888] hover:text-[#ff6b00] hover:border-[#ff6b00]/30 flex items-center justify-center shrink-0"
              title="New chat"
            >
              <FiPlus size={14} />
            </button>

            {/* Model picker */}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={sending}
              className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-[#bbb] focus:outline-none focus:border-[#ff6b00]/40 disabled:opacity-60 max-w-[180px] truncate"
              title="Model"
            >
              {chatOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label.replace(/Llama /, "").replace(/Versatile/, "")}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            <VoiceMic
              size="sm"
              mode="live"
              onText={(text, isFinal) => {
                if (isFinal) {
                  setDraft((d) => (d ? `${d} ${text}` : text));
                } else {
                  setDraft(text);
                }
              }}
              onError={(msg) => onError(msg)}
            />

            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_4px_15px_rgba(255,107,0,0.4)] hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-transform"
              title="Send"
            >
              <FiSend size={14} />
            </button>
          </div>
        </form>
      </div>
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
