"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FiLock,
  FiMail,
  FiArrowRight,
  FiArrowLeft,
  FiEye,
  FiEyeOff,
  FiHelpCircle,
} from "react-icons/fi";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // Trim accidental whitespace from autofill / copy-paste.
    const cleanedEmail = email.trim();
    const cleanedPassword = password.replace(/^\s+|\s+$/g, "");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanedEmail, password: cleanedPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed");
        setSubmitting(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[#050505] text-white relative overflow-hidden">
      {/* glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#ff6b00]/[0.06] rounded-full blur-[160px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#777] text-sm mb-8 hover:text-white transition-colors"
        >
          <FiArrowLeft size={14} />
          Back to site
        </Link>

        <div className="rounded-3xl bg-[#1a1a1a] border border-white/[0.06] p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="mb-8">
            <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
              ✦ Admin
            </p>
            <h1 className="text-3xl font-black tracking-tight">Sign in</h1>
            <p className="text-[#888] text-sm mt-2">
              Restricted area. Only the site owner has access.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono tracking-[0.2em] uppercase text-[#888] mb-2"
              >
                Email
              </label>
              <div className="relative">
                <FiMail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none transition-colors text-white placeholder:text-[#555]"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono tracking-[0.2em] uppercase text-[#888] mb-2"
              >
                Password
              </label>
              <div className="relative">
                <FiLock
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none transition-colors text-white placeholder:text-[#555]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-[#777] hover:text-white hover:bg-white/[0.04]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Always-visible forgot password link */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#666]">
                {submitting ? "Authenticating…" : ""}
              </span>
              <button
                type="button"
                onClick={() => setShowHelp((s) => !s)}
                className="inline-flex items-center gap-1.5 text-[#888] hover:text-[#ff8c38] transition-colors"
              >
                <FiHelpCircle size={12} />
                {showHelp ? "Hide help" : "Forgot password?"}
              </button>
            </div>

            {showHelp && (
              <div className="rounded-xl border border-[#ff6b00]/30 bg-[#ff6b00]/[0.06] p-4 text-xs leading-relaxed text-[#ccc] space-y-2.5">
                <div className="flex items-start gap-2">
                  <FiHelpCircle className="text-[#ff8c38] mt-0.5 shrink-0" size={14} />
                  <p className="font-bold text-[#ff8c38]">Reset your password</p>
                </div>
                <p>
                  Open a terminal in the project folder and run:
                </p>
                <pre className="bg-black/40 rounded-md p-2 font-mono text-[11px] text-[#ffaa66] overflow-x-auto">
                  node scripts/set-admin-password.mjs &quot;YourNewPassword&quot;
                </pre>
                <p>
                  Then restart <code className="text-[#ff8c38]">npm run dev</code> and sign in
                  with the new password.
                </p>
                <p className="pt-1 border-t border-white/[0.06] text-[#888]">
                  <strong className="text-[#ccc]">Common gotchas:</strong> the password is
                  case-sensitive, special characters like <code className="text-[#ff8c38]">#</code>
                  {" "}count, and browser autofill may be inserting a stale password — try an
                  incognito window if a saved password is interfering.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting && <FiArrowRight size={14} />}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
