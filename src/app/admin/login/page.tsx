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
  FiCheck,
  FiShield,
} from "react-icons/fi";

type Mode = "sign-in" | "forgot" | "otp";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
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
      // If 2FA is on, the server granted a 5-minute pre-auth cookie and
      // told us to collect the 6-digit code before the session is real.
      if (data.requires_otp) {
        setMode("otp");
        setOtp("");
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

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Code didn't match");
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

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send reset email");
        setSubmitting(false);
        return;
      }
      setResetSent(true);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[#050505] text-white relative overflow-hidden">
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
          {mode === "sign-in" ? (
            <>
              <div className="mb-8">
                <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
                  ✦ Admin
                </p>
                <h1 className="text-3xl font-black tracking-tight">Sign in</h1>
                <p className="text-[#888] text-sm mt-2">
                  Restricted area. Only the site owner has access.
                </p>
              </div>

              <form onSubmit={onSignIn} className="space-y-5">
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
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="password"
                      className="block text-xs font-mono tracking-[0.2em] uppercase text-[#888]"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setResetSent(false);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#888] hover:text-[#ff8c38] transition-colors"
                    >
                      <FiHelpCircle size={11} />
                      Forgot?
                    </button>
                  </div>
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Signing in…" : "Sign in"}
                  {!submitting && <FiArrowRight size={14} />}
                </button>
              </form>
            </>
          ) : mode === "otp" ? (
            <>
              <div className="mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                    setOtp("");
                    setPassword("");
                  }}
                  className="inline-flex items-center gap-2 text-[#777] text-xs hover:text-white transition-colors mb-4"
                >
                  <FiArrowLeft size={12} />
                  Back to password
                </button>
                <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
                  ✦ Two-factor
                </p>
                <h1 className="text-3xl font-black tracking-tight">
                  Enter your code
                </h1>
                <p className="text-[#888] text-sm mt-2 leading-relaxed">
                  Password accepted. Now enter the 6-digit code from your
                  authenticator app to finish signing in.
                </p>
              </div>

              <form onSubmit={onVerifyOtp} className="space-y-5">
                <div>
                  <label
                    htmlFor="otp"
                    className="block text-xs font-mono tracking-[0.2em] uppercase text-[#888] mb-2"
                  >
                    Authenticator code
                  </label>
                  <div className="relative">
                    <FiShield
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]"
                    />
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      maxLength={11}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none transition-colors text-white placeholder:text-[#555] font-mono text-lg tracking-[0.4em]"
                      placeholder="123 456"
                    />
                  </div>
                  <p className="text-[10px] text-[#666] mt-2 leading-relaxed">
                    Lost your phone? Paste one of your backup codes here
                    instead (10 hex chars).
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !otp.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Verifying…" : "Verify"}
                  {!submitting && <FiArrowRight size={14} />}
                </button>

                <p className="text-[10px] text-[#666] leading-relaxed">
                  This pre-auth session lasts 5 minutes. If you take longer,
                  go back and enter your password again.
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                    setResetSent(false);
                  }}
                  className="inline-flex items-center gap-2 text-[#777] text-xs hover:text-white transition-colors mb-4"
                >
                  <FiArrowLeft size={12} />
                  Back to sign in
                </button>
                <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
                  ✦ Forgot password
                </p>
                <h1 className="text-3xl font-black tracking-tight">Reset your password</h1>
                <p className="text-[#888] text-sm mt-2">
                  Enter your admin email and we&apos;ll send you a secure reset link.
                </p>
              </div>

              {resetSent ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-300 flex items-start gap-3">
                  <FiCheck size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Check your inbox.</p>
                    <p className="text-emerald-300/80 mt-1 leading-relaxed">
                      If <span className="text-white">{email}</span> is the admin email, a
                      reset link is on its way. The link expires in 1 hour.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={onRequestReset} className="space-y-5">
                  <div>
                    <label
                      htmlFor="reset-email"
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
                        id="reset-email"
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

                  {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Sending…" : "Send reset link"}
                    {!submitting && <FiArrowRight size={14} />}
                  </button>

                  <p className="text-[11px] text-[#666] leading-relaxed">
                    Don&apos;t have email set up on your Supabase project yet? You can also
                    reset locally:
                    <code className="block mt-1 font-mono text-[10px] text-[#ff8c38] bg-black/40 rounded p-1.5 break-all">
                      node scripts/set-admin-password.mjs &quot;NewPassword&quot;
                    </code>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
