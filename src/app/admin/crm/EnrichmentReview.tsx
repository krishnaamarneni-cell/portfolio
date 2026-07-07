"use client";

import { useState, useEffect } from "react";
import {
  FiCheckCircle,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiUser,
} from "react-icons/fi";
import { type Enrichment, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

type EnrichmentWithContact = Enrichment & {
  contact_name?: string;
  contact_email?: string;
};

export default function EnrichmentReview({ onSuccess, onError }: Props) {
  const [items, setItems] = useState<EnrichmentWithContact[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/enrichment");
    const d = await r.json().catch(() => ({}));
    setItems(d.enrichments ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function review(id: string, status: "approved" | "rejected") {
    const r = await fetch("/api/admin/crm/enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", id, status }),
    });
    if (r.ok) {
      onSuccess(status === "approved" ? "Enrichment applied" : "Enrichment rejected");
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Review failed");
    }
  }

  async function batchAction(status: "approved" | "rejected") {
    const pending = items.filter((i) => i.status === "pending");
    if (!pending.length) return;
    const r = await fetch("/api/admin/crm/enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "batch-review",
        ids: pending.map((i) => i.id),
        status,
      }),
    });
    if (r.ok) {
      onSuccess(`${status === "approved" ? "Approved" : "Rejected"} ${pending.length} enrichments`);
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Batch action failed");
    }
  }

  const pending = items.filter((i) => i.status === "pending");
  const reviewed = items.filter((i) => i.status !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-[#ff6b00]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Pending" value={pending.length} />
        <Stat label="Approved" value={items.filter((i) => i.status === "approved").length} />
        <Stat label="Rejected" value={items.filter((i) => i.status === "rejected").length} />
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--admin-text-muted)]">Pending Review</h3>
            <div className="flex gap-2">
              <button
                onClick={() => batchAction("approved")}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
              >
                <FiCheck size={12} /> Approve All
              </button>
              <button
                onClick={() => batchAction("rejected")}
                className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-semibold border border-red-200 hover:bg-red-100 flex items-center gap-1"
              >
                <FiX size={12} /> Reject All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {pending.map((item) => (
              <div key={item.id} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  <FiUser size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--admin-text)]">{item.contact_name || item.contact_email || item.contact_id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">{item.field}</span>
                  </div>
                  <p className="text-sm text-[var(--admin-text-muted)] mt-0.5">{item.suggested_value}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[#bbb]">
                    <span>Source: {item.source}</span>
                    <span>{timeAgo(item.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => review(item.id, "approved")}
                    className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 hover:bg-emerald-100"
                  >
                    <FiCheck size={16} />
                  </button>
                  <button
                    onClick={() => review(item.id, "rejected")}
                    className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <FiCheckCircle size={18} className="text-emerald-500" />
          <p className="text-sm text-emerald-700">All enrichments reviewed. Sync contacts to discover new suggestions.</p>
        </div>
      )}

      {/* Reviewed history */}
      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--admin-text-muted)]">History</h3>
          <div className="space-y-1">
            {reviewed.slice(0, 20).map((item) => (
              <div key={item.id} className="bg-[var(--admin-bg)] rounded-xl p-3 flex items-center gap-3 text-sm">
                <span className={item.status === "approved" ? "text-emerald-500" : "text-red-400"}>
                  {item.status === "approved" ? <FiCheck size={14} /> : <FiX size={14} />}
                </span>
                <span className="text-[var(--admin-text)] truncate">{item.contact_name || item.contact_id}</span>
                <span className="text-[10px] text-[#bbb]">{item.field}</span>
                <span className="text-[#888] truncate flex-1">{item.suggested_value}</span>
                <span className="text-[10px] text-[#bbb] shrink-0">{timeAgo(item.reviewed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
      <p className="text-xl font-bold text-[var(--admin-text)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[#999] mt-0.5">{label}</p>
    </div>
  );
}
