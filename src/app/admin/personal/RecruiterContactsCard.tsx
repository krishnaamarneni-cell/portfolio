"use client";

import { useEffect, useState } from "react";
import { FiTrash2, FiStar, FiMail } from "react-icons/fi";

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role_pitched: string | null;
  match_pct: number | null;
  starred: boolean;
  emailed_at: string | null;
  source: string;
  created_at: string;
};

function ContactRow({
  contact: c,
  sending,
  onStar,
  onDelete,
  onSendEmail,
}: {
  contact: Contact;
  sending: boolean;
  onStar: () => void;
  onDelete: () => void;
  onSendEmail: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)]">
      <button type="button" onClick={onStar} className="shrink-0">
        <FiStar
          size={14}
          className={c.starred ? "text-amber-300" : "text-[var(--admin-text-muted)]"}
          fill={c.starred ? "currentColor" : "none"}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--admin-text)] truncate">
          {c.name || c.email}
          {c.company && (
            <span className="text-[var(--admin-text-muted)] ml-1">
              @ {c.company}
            </span>
          )}
        </p>
        <p className="text-[10px] text-[var(--admin-text-muted)] truncate">
          {c.email}
          {c.role_pitched && <span> - {c.role_pitched}</span>}
        </p>
      </div>
      {c.match_pct !== null && (
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            c.match_pct >= 70
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)]"
          }`}
        >
          {c.match_pct}%
        </span>
      )}
      {c.emailed_at ? (
        <span className="shrink-0 text-[9px] font-mono text-emerald-400/70 px-2">
          Sent
        </span>
      ) : (
        <button
          type="button"
          onClick={onSendEmail}
          disabled={sending}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 disabled:opacity-50"
        >
          <FiMail size={10} />
          {sending ? "..." : "Email"}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 w-7 h-7 rounded-md text-[var(--admin-text-muted)] hover:text-red-400 flex items-center justify-center"
      >
        <FiTrash2 size={11} />
      </button>
    </div>
  );
}

export default function RecruiterContactsCard({
  onError,
  onSuccess,
}: {
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/contacts");
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.contacts)) setContacts(j.contacts);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) load();
  }

  async function sendEmail(c: Contact) {
    setSending(c.id);
    try {
      const r = await fetch("/api/admin/contacts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: c.id,
          to: c.email,
          recruiterName: c.name || "Hiring Manager",
          company: c.company || undefined,
          rolePitched: c.role_pitched || undefined,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        onSuccess(`Email sent to ${c.name || c.email} via ${j.provider}`);
        load();
      } else {
        onError(j.error || "Send failed");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Send failed");
    }
    setSending(null);
  }

  const strong = contacts.filter((c) => (c.match_pct ?? 0) >= 70);
  const weak = contacts.filter((c) => (c.match_pct ?? 0) < 70);

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5"
      >
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center">
          <FiMail size={16} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-bold text-[var(--admin-text)]">
            Recruiter Contacts{" "}
            <span className="text-[10px] font-mono text-[var(--admin-text-muted)] ml-1">
              {contacts.length}
            </span>
          </h3>
          <p className="text-[11px] text-[var(--admin-text-muted)]">
            Extracted from your inbox by Email Intelligence. Send outreach with
            one tap.
          </p>
        </div>
        <span className="text-[10px] font-mono text-[var(--admin-text-muted)]">
          {open ? "HIDE" : "OPEN"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {contacts.length === 0 && (
            <p className="text-xs text-[var(--admin-text-muted)]">
              No contacts yet. Run the Email Intelligence agent in the Agents
              tab to extract recruiter contacts from your inbox.
            </p>
          )}

          {strong.length > 0 && (
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-2">
                Strong matches (&gt;70%)
              </h4>
              <div className="space-y-2">
                {strong.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    sending={sending === c.id}
                    onStar={() =>
                      act({
                        action: "star",
                        id: c.id,
                        starred: !c.starred,
                      })
                    }
                    onDelete={() => act({ action: "delete", id: c.id })}
                    onSendEmail={() => sendEmail(c)}
                  />
                ))}
              </div>
            </div>
          )}

          {weak.length > 0 && (
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-2">
                Other contacts
              </h4>
              <div className="space-y-2">
                {weak.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    sending={sending === c.id}
                    onStar={() =>
                      act({
                        action: "star",
                        id: c.id,
                        starred: !c.starred,
                      })
                    }
                    onDelete={() => act({ action: "delete", id: c.id })}
                    onSendEmail={() => sendEmail(c)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
