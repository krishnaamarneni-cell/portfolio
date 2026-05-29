"use client";

import { useEffect, useState } from "react";
import {
  FiSmile,
  FiAlertTriangle,
  FiTrash2,
  FiMonitor,
} from "react-icons/fi";

type Credential = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

type Device = {
  id: string;
  device_label: string | null;
  ip: string | null;
  user_agent: string | null;
  last_used_at: string;
  expires_at: string;
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555]";

export default function FaceLockCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [supported, setSupported] = useState(true);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.PublicKeyCredential) {
      setSupported(false);
    }
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [c, d] = await Promise.all([
      fetch("/api/admin/webauthn/credentials", { cache: "no-store" })
        .then((r) => r.json().catch(() => ({})))
        .catch(() => ({})),
      fetch("/api/admin/devices", { cache: "no-store" })
        .then((r) => r.json().catch(() => ({})))
        .catch(() => ({})),
    ]);
    setCredentials(Array.isArray(c.credentials) ? c.credentials : []);
    setDevices(Array.isArray(d.devices) ? d.devices : []);
    setLoading(false);
  }

  async function enrollFaceLock() {
    if (!supported) {
      onError("This device doesn't support Face Lock / passkeys.");
      return;
    }
    setEnrolling(true);
    try {
      // Step 1: fetch challenge from server.
      const r = await fetch("/api/admin/webauthn/register", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.options) {
        onError(j.error || "Setup failed");
        setEnrolling(false);
        return;
      }
      // Step 2: prompt the OS (Face ID / Touch ID / Windows Hello).
      const { startRegistration } = await import("@simplewebauthn/browser");
      const attestation = await startRegistration({ optionsJSON: j.options });
      // Step 3: send attestation back to verify.
      const r2 = await fetch("/api/admin/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: attestation,
          label: label.trim() || guessDeviceLabel(),
        }),
      });
      const j2 = await r2.json().catch(() => ({}));
      if (!r2.ok) {
        onError(j2.error || "Verify failed");
        setEnrolling(false);
        return;
      }
      onSuccess("Face Lock enrolled — you can sign in with Face ID next time.");
      setLabel("");
      void load();
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Face Lock cancelled"
          : err instanceof Error
          ? err.message
          : "Setup failed";
      onError(msg);
    }
    setEnrolling(false);
  }

  async function removeCredential(id: string) {
    if (!confirm("Remove this Face Lock from this account?")) return;
    const r = await fetch(`/api/admin/webauthn/credentials/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (r.ok) {
      onSuccess("Face Lock removed");
      void load();
    }
  }

  async function revokeDevice(id: string) {
    if (!confirm("Sign out this device? It'll need OTP next login.")) return;
    const r = await fetch(`/api/admin/devices/${id}`, { method: "DELETE" });
    if (r.ok) {
      onSuccess("Device signed out");
      void load();
    }
  }

  async function revokeAllDevices() {
    if (!confirm("Sign out every trusted device? Includes this one.")) return;
    const r = await fetch("/api/admin/devices", { method: "DELETE" });
    if (r.ok) {
      onSuccess("All trusted devices signed out");
      void load();
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.05] to-transparent p-5 mt-6 space-y-5">
      {/* Face Lock */}
      <div>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 text-blue-300 flex items-center justify-center shrink-0">
            <FiSmile size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white">Face Lock</h3>
              {credentials.length > 0 ? (
                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  {credentials.length} enrolled
                </span>
              ) : (
                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                  Not set up
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#888] mt-1 leading-relaxed">
              Sign in with Face ID / Touch ID / Windows Hello instead of typing
              password + OTP. One tap. The OS handles the biometric — we never
              see your face/fingerprint, only a signed proof.
            </p>
          </div>
        </div>

        {!supported && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] text-amber-300/90 flex items-start gap-2">
            <FiAlertTriangle size={12} className="mt-0.5 shrink-0" />
            <p>
              This browser/device doesn't expose passkey APIs. Try Safari on iOS
              16.4+, Chrome on macOS, or any device with Windows Hello.
            </p>
          </div>
        )}

        {/* Enrollment */}
        {supported && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='Device label (e.g. "iPhone 16 Pro")'
              className={inputClass + " flex-1 min-w-[180px] text-xs"}
            />
            <button
              type="button"
              onClick={enrollFaceLock}
              disabled={enrolling}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-black text-xs font-bold shadow-[0_4px_15px_rgba(59,130,246,0.35)] hover:scale-[1.03] disabled:opacity-60"
            >
              <FiSmile size={11} />
              {enrolling ? "Waiting for Face ID…" : "Add Face Lock"}
            </button>
          </div>
        )}

        {/* Enrolled credentials list */}
        {credentials.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {credentials.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <FiSmile size={12} className="text-blue-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">
                    {c.device_label || "Unnamed device"}
                  </p>
                  <p className="text-[10px] font-mono text-[#666]">
                    enrolled {new Date(c.created_at).toLocaleDateString()}
                    {c.last_used_at
                      ? ` · last used ${new Date(c.last_used_at).toLocaleDateString()}`
                      : " · never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCredential(c.id)}
                  className="w-7 h-7 rounded-md text-[#555] hover:text-red-400 flex items-center justify-center"
                >
                  <FiTrash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Trusted devices */}
      <div className="pt-5 border-t border-white/[0.06]">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
            <FiMonitor size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white">Trusted devices</h3>
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                {devices.length}
              </span>
            </div>
            <p className="text-[11px] text-[#888] mt-1 leading-relaxed">
              When you tick "Trust this device for 30 days" after entering your
              OTP, the device skips OTP until the cookie expires. Revoke any
              device here.
            </p>
          </div>
          {devices.length > 1 && (
            <button
              type="button"
              onClick={revokeAllDevices}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-red-500/30 text-red-300 text-xs"
            >
              <FiTrash2 size={11} />
              Sign out all
            </button>
          )}
        </div>

        {devices.length === 0 ? (
          <p className="text-[11px] text-[#666] mt-3">
            No trusted devices yet. Tick "Trust this device" on your next OTP
            login to stop typing codes.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <FiMonitor size={12} className="text-emerald-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">
                    {d.device_label || guessLabel(d.user_agent)}
                  </p>
                  <p className="text-[10px] font-mono text-[#666]">
                    last used {new Date(d.last_used_at).toLocaleString()} ·
                    expires {new Date(d.expires_at).toLocaleDateString()}
                    {d.ip ? ` · ${d.ip}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeDevice(d.id)}
                  className="w-7 h-7 rounded-md text-[#555] hover:text-red-400 flex items-center justify-center"
                >
                  <FiTrash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function guessDeviceLabel(): string {
  if (typeof navigator === "undefined") return "This device";
  return guessLabel(navigator.userAgent) ?? "This device";
}

function guessLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  return ua.split(" ").slice(0, 3).join(" ");
}
