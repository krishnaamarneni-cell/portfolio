"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { FiSend, FiBox, FiTruck, FiActivity, FiArrowLeft, FiAlertTriangle } from "react-icons/fi";
import Link from "next/link";

/* ════════════════════ Types ════════════════════ */

type StockRow = {
  material: string;
  plant: string;
  storageLocation: string;
  quantity: number;
  unit: string;
};

type PORow = {
  poNumber: string;
  item: string;
  material: string;
  description: string;
  orderQuantity: number;
  unit: string;
  plant: string;
  netPrice: number;
  currency: string;
  deliveryDate: string;
};

type SapSummary = {
  totalOnHand: number;
  totalInbound: number;
  unit: string;
  status: "Healthy" | "Low" | "Critical";
};

type MessageData = {
  stock?: StockRow[];
  stockError?: string;
  pos?: PORow[];
  posError?: string;
  summary?: SapSummary;
  resolvedFrom?: { name: string; description: string };
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  data?: MessageData;
};

/* ════════════════════ Constants ════════════════════ */

const EXAMPLES = [
  { label: "Stock for TG10", text: "What's the stock level for material TG10?" },
  { label: "Open POs for TG10", text: "Show me open purchase orders for TG10" },
  { label: "Am I short on TG10?", text: "Am I running short on material TG10?" },
];

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Welcome! I can look up material stock levels, open purchase orders, and assess potential shortages — all from live SAP S/4HANA sandbox data. Try one of the examples below, or type your own question.",
};

const STATUS_COLORS: Record<
  SapSummary["status"],
  { bg: string; text: string; border: string }
> = {
  Healthy: {
    bg: "rgba(34,197,94,0.12)",
    text: "#22c55e",
    border: "rgba(34,197,94,0.25)",
  },
  Low: {
    bg: "rgba(245,158,11,0.12)",
    text: "#f59e0b",
    border: "rgba(245,158,11,0.25)",
  },
  Critical: {
    bg: "rgba(239,68,68,0.12)",
    text: "#ef4444",
    border: "rgba(239,68,68,0.25)",
  },
};

/* ════════════════════ Helpers ════════════════════ */

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/* ════════════════════ Sub-components ════════════════════ */

function SummaryCards({ summary }: { summary: SapSummary }) {
  const sc = STATUS_COLORS[summary.status];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
      {/* Total on hand */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3.5">
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-wider mb-1">
          <FiBox size={11} />
          Total on hand
        </div>
        <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
          {fmt(summary.totalOnHand)}{" "}
          <span className="text-xs font-normal text-[var(--text-muted)]">
            {summary.unit}
          </span>
        </div>
      </div>

      {/* Inbound on open POs */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3.5">
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-wider mb-1">
          <FiTruck size={11} />
          Inbound on open POs
        </div>
        <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
          {fmt(summary.totalInbound)}{" "}
          <span className="text-xs font-normal text-[var(--text-muted)]">
            {summary.unit}
          </span>
        </div>
      </div>

      {/* Status */}
      <div
        className="rounded-xl p-3.5"
        style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
      >
        <div
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-1"
          style={{ color: sc.text, opacity: 0.8 }}
        >
          <FiActivity size={11} />
          Status
        </div>
        <div className="text-xl font-bold" style={{ color: sc.text }}>
          {summary.status}
        </div>
      </div>
    </div>
  );
}

function StockTable({ rows }: { rows: StockRow[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.quantity, 0);
  const unit = rows[0]?.unit ?? "EA";
  return (
    <div className="mt-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">
        Stock by plant / storage location
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm border-collapse min-w-[420px]">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Material
              </th>
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Plant
              </th>
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Storage Loc.
              </th>
              <th className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Quantity
              </th>
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Unit
              </th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-secondary)]">
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)]/50 transition-colors"
              >
                <td className="py-2 px-3 font-mono text-xs">{r.material}</td>
                <td className="py-2 px-3">{r.plant}</td>
                <td className="py-2 px-3">{r.storageLocation || "—"}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {fmt(r.quantity)}
                </td>
                <td className="py-2 px-3">{r.unit}</td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="border-t-2 border-[var(--accent)]/20 bg-[var(--bg-secondary)]">
                <td
                  className="py-2.5 px-3 text-[10px] font-mono uppercase tracking-wider text-[var(--text-primary)] font-semibold"
                  colSpan={3}
                >
                  Total
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-primary)] tabular-nums">
                  {fmt(total)}
                </td>
                <td className="py-2.5 px-3 text-[var(--text-primary)]">
                  {unit}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function POTable({ rows }: { rows: PORow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">
        Open purchase orders
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm border-collapse min-w-[560px]">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                PO Number
              </th>
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Material
              </th>
              <th className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Quantity
              </th>
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Unit
              </th>
              <th className="text-left text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Del. Date
              </th>
              <th className="text-right text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] py-2.5 px-3">
                Net Price
              </th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-secondary)]">
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)]/50 transition-colors"
              >
                <td className="py-2 px-3 font-mono text-xs">{r.poNumber}</td>
                <td className="py-2 px-3 font-mono text-xs">{r.material}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {fmt(r.orderQuantity)}
                </td>
                <td className="py-2 px-3">{r.unit}</td>
                <td className="py-2 px-3">{r.deliveryDate}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {fmt(r.netPrice)} {r.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-3 text-xs"
      style={{
        background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.25)",
        color: "#f59e0b",
      }}
    >
      <FiAlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-black text-xs font-bold shrink-0 shadow-[0_2px_8px_rgba(255,107,0,0.3)]">
        S
      </div>
      <div className="rounded-2xl rounded-bl-md bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3.5">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
              style={{
                animation: "sapDotBounce 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Main Component ════════════════════ */

export default function SapChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/sap/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages
            .filter(
              (m) => m.role === "user" || (m.role === "assistant" && !m.data),
            )
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const json = await res.json();

      const botMsg: ChatMessage = res.ok
        ? { role: "assistant", content: json.answer, data: json.data }
        : {
            role: "assistant",
            content: json.error || "Something went wrong. Please try again.",
          };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Network error — please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const hasUserSent = messages.some((m) => m.role === "user");

  return (
    <>
      {/* Keyframe for typing dots */}
      <style>{`
        @keyframes sapDotBounce {
          0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col h-[100dvh]">
        {/* ── Header ── */}
        <header className="shrink-0 px-4 sm:px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mb-3"
            >
              <FiArrowLeft size={14} /> Back
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="text-gradient">SAP</span>{" "}
              <span className="text-[var(--text-primary)]">AI Assistant</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              One agent, multiple tools — ask questions about SAP data in plain
              English
            </p>
          </div>
        </header>

        {/* ── Chat messages ── */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
        >
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    msg.role === "user"
                      ? "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)]"
                      : "bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_2px_8px_rgba(255,107,0,0.3)]"
                  }`}
                >
                  {msg.role === "user" ? "U" : "S"}
                </div>

                {/* Bubble */}
                <div
                  className={`min-w-0 ${
                    msg.role === "user"
                      ? "max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md bg-[var(--accent)] text-black px-4 py-3"
                      : "max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-bl-md bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3"
                  }`}
                >
                  {/* Name-search resolution — shown when the question used a
                      product name/description instead of a material number */}
                  {msg.data?.resolvedFrom && (
                    <div className="mb-3 text-[11px] font-mono text-[var(--text-muted)]">
                      &ldquo;{msg.data.resolvedFrom.name}&rdquo; →{" "}
                      <span className="text-[var(--accent)]">
                        {msg.data.stock?.[0]?.material || msg.data.pos?.[0]?.material}
                      </span>{" "}
                      — {msg.data.resolvedFrom.description}
                    </div>
                  )}

                  {/* Summary cards */}
                  {msg.data?.summary && (
                    <SummaryCards summary={msg.data.summary} />
                  )}

                  {/* API error banners — a failed live call, distinct from a genuinely empty result */}
                  {msg.data?.stockError && (
                    <ErrorBanner message={`Stock lookup failed: ${msg.data.stockError}`} />
                  )}
                  {msg.data?.posError && (
                    <ErrorBanner message={`Purchase order lookup failed: ${msg.data.posError}`} />
                  )}

                  {/* Answer text */}
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user" ? "" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {msg.content}
                  </p>

                  {/* Data tables — source data always visible beside the answer */}
                  {msg.data?.stock && msg.data.stock.length > 0 && (
                    <StockTable rows={msg.data.stock} />
                  )}
                  {msg.data?.pos && msg.data.pos.length > 0 && (
                    <POTable rows={msg.data.pos} />
                  )}
                </div>
              </div>
            ))}

            {loading && <TypingIndicator />}
          </div>
        </div>

        {/* ── Example chips (only before first user message) ── */}
        {!hasUserSent && !loading && (
          <div className="shrink-0 px-4 sm:px-6 pb-3">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => send(ex.text)}
                  className="text-sm px-4 py-2 rounded-full border border-[var(--accent)]/30 text-[var(--accent)] bg-[var(--accent)]/[0.06] hover:bg-[var(--accent)] hover:text-black transition-all duration-200 hover:shadow-[0_4px_20px_rgba(255,107,0,0.3)]"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        <div className="shrink-0 px-4 sm:px-6 pt-2 pb-24 lg:pb-24">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about SAP data…"
                disabled={loading}
                className="flex-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-11 h-11 rounded-xl bg-[var(--accent)] text-black flex items-center justify-center hover:bg-[var(--accent-light)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                aria-label="Send"
              >
                <FiSend size={16} />
              </button>
            </form>
            <p className="text-[10px] text-[var(--text-muted)] text-center mt-2.5 font-mono tracking-wide">
              Live demo against SAP&apos;s public S/4HANA sandbox data
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
