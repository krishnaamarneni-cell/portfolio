"use client";

import { useEffect, useState } from "react";
import {
  FiShield,
  FiCopy,
  FiCheck,
  FiAlertTriangle,
  FiLock,
  FiUnlock,
  FiDownload,
} from "react-icons/fi";

type Status = {
  enabled: boolean;
  hasSecret: boolean;
  backupCodesRemaining: number;
  setupAt: string | null;
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";

export default function TwoFactorCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrDataUrl: string;
    uri: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [enabling, setEnabling] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/2fa/status", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.status) setStatus(j.status);
    setLoading(false);
  }

  async function startSetup() {
    setSetupBusy(true);
    setBackupCodes(null);
    setCode("");
    const r = await fetch("/api/admin/2fa/setup", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setSetupBusy(false);
    if (!r.ok) {
      onError(j.error || "Could not start setup");
      return;
    }
    setSetupData(j);
  }

  async function confirmEnable() {
    if (!code.trim()) return;
    setEnabling(true);
    const r = await fetch("/api/admin/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    setEnabling(false);
    if (!r.ok) {
      onError(j.error || "Could not enable");
      return;
    }
    setBackupCodes(j.backupCodes ?? []);
    setSetupData(null);
    setCode("");
    onSuccess("2FA enabled");
    void load();
  }

  async function confirmDisable() {
    if (!disableCode.trim()) return;
    if (!confirm("Disable 2FA? Your account will go back to password-only.")) return;
    setDisabling(true);
    const r = await fetch("/api/admin/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: disableCode.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    setDisabling(false);
    if (!r.ok) {
      onError(j.error || "Could not disable");
      return;
    }
    setDisableCode("");
    onSuccess("2FA disabled");
    void load();
  }

  function downloadBackupCodes() {
    if (!backupCodes) return;
    const text = [
      "Krishna Admin — Backup Codes",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Each code can be used once instead of your authenticator app.",
      "Store these somewhere safe. Don't share them.",
      "",
      ...backupCodes,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "krishna-admin-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySecret() {
    if (!setupData) return;
    await navigator.clipboard.writeText(setupData.secret).catch(() => undefined);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 1500);
  }

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] to-transparent p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
          {status?.enabled ? <FiLock size={18} /> : <FiUnlock size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Two-factor authentication</h3>
            {status?.enabled ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                On
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                Off — risk
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            Requires a 6-digit code from your authenticator app (Google
            Authenticator, Authy, 1Password) on every login.
          </p>
          {status?.enabled && status.setupAt && (
            <p className="text-[10px] font-mono text-[#666] mt-1">
              Enabled {new Date(status.setupAt).toLocaleString()} ·{" "}
              {status.backupCodesRemaining} backup codes remaining
            </p>
          )}
        </div>
      </div>

      {/* New backup codes — show once */}
      {backupCodes && backupCodes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-emerald-500/[0.15] space-y-3">
          <div className="flex items-start gap-2 text-amber-300 text-xs">
            <FiAlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              <strong>Write these down right now.</strong> They're the only way
              back in if you lose your phone — you won't see them again.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {backupCodes.map((c) => (
              <code
                key={c}
                className="text-xs font-mono text-center py-2 rounded-md bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300 tracking-widest"
              >
                {c}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadBackupCodes}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-emerald-500/40 hover:text-emerald-300"
          >
            <FiDownload size={11} />
            Download as .txt
          </button>
        </div>
      )}

      {/* Setup flow */}
      {!status?.enabled && !setupData && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={startSetup}
            disabled={setupBusy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-bold shadow-[0_4px_15px_rgba(16,185,129,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiShield size={14} />
            {setupBusy ? "Setting up…" : "Set up 2FA"}
          </button>
        </div>
      )}

      {setupData && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
          <ol className="list-decimal pl-5 text-xs text-[#bbb] space-y-1">
            <li>Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
            <li>Scan the QR code below. Or paste the secret manually.</li>
            <li>Type the 6-digit code your app generates to confirm.</li>
          </ol>

          <div className="flex items-start gap-5 flex-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setupData.qrDataUrl}
              alt="2FA QR code"
              className="w-[200px] h-[200px] rounded-lg bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            />
            <div className="flex-1 min-w-[240px] space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
                Manual entry
              </p>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-xs text-emerald-300 font-mono break-all">
                  {setupData.secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs hover:border-emerald-500/40 hover:text-emerald-300 inline-flex items-center gap-1.5"
                >
                  {secretCopied ? <FiCheck size={11} /> : <FiCopy size={11} />}
                  {secretCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] text-[#666]">
                Issuer: <code>Krishna Admin</code>. Algorithm: SHA-1, 30s, 6 digits.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
              Confirm with code from app
            </label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                className={inputClass + " flex-1 text-center font-mono text-base tracking-[0.4em]"}
              />
              <button
                type="button"
                onClick={confirmEnable}
                disabled={enabling || code.length < 6}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-bold hover:scale-[1.03] disabled:opacity-50"
              >
                <FiShield size={11} />
                {enabling ? "Enabling…" : "Confirm + enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable flow */}
      {status?.enabled && !backupCodes && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666]">
            Disable 2FA (requires a current code)
          </label>
          <div className="flex gap-2">
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="6-digit code or backup code"
              className={inputClass + " flex-1 text-center font-mono tracking-[0.3em]"}
            />
            <button
              type="button"
              onClick={confirmDisable}
              disabled={disabling || !disableCode.trim()}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-red-500/30 text-red-300 text-xs hover:bg-red-500/10 disabled:opacity-50"
            >
              <FiUnlock size={11} />
              {disabling ? "…" : "Disable"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
