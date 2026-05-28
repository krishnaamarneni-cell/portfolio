"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FiLock,
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiCheck,
} from "react-icons/fi";
import { createSupabaseBrowserClient } from "@/lib/supabase-ssr";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  // If the email link arrived with `code`, Supabase already exchanged it via
  // /auth/callback before redirecting here. Otherwise, some flows put a
  // recovery token in the URL hash (#access_token=…) — handle that too.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // Hash-style recovery URLs (#access_token=…&type=recovery) need to be
        // pulled out manually on older Supabase email templates.
        if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) {
          const params = new URLSearchParams(window.location.hash.slice(1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            // Clean the URL.
            history.replaceState(null, "", window.location.pathname);
          }
        }
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setRecoveryReady(Boolean(data.user));
          setRecoveryChecked(true);
          if (!data.user) {
            setError(
              "This reset link is expired or invalid. Request a new one from the login page."
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load session");
          setRecoveryChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/admin");
        router.refresh();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[#050505] text-white relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#ff6b00]/[0.06] rounded-full blur-[160px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-2 text-[#777] text-sm mb-8 hover:text-white transition-colors"
        >
          <FiArrowLeft size={14} />
          Back to sign in
        </Link>

        <div className="rounded-3xl bg-[#1a1a1a] border border-white/[0.06] p-8 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="mb-8">
            <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
              ✦ Reset password
            </p>
            <h1 className="text-3xl font-black tracking-tight">Choose a new password</h1>
            <p className="text-[#888] text-sm mt-2">
              {recoveryChecked
                ? recoveryReady
                  ? "You're verified. Enter a new password below."
                  : "Reset link couldn't be verified."
                : "Verifying your reset link…"}
            </p>
          </div>

          {done ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-300 flex items-start gap-3">
              <FiCheck size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Password updated.</p>
                <p className="text-emerald-300/80 mt-1">
                  Redirecting you to the admin dashboard…
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-mono tracking-[0.2em] uppercase text-[#888] mb-2"
                >
                  New password
                </label>
                <div className="relative">
                  <FiLock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!recoveryReady}
                    className="w-full pl-11 pr-12 py-3 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none transition-colors text-white placeholder:text-[#555] disabled:opacity-50"
                    placeholder="At least 8 characters"
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

              <div>
                <label
                  htmlFor="confirm"
                  className="block text-xs font-mono tracking-[0.2em] uppercase text-[#888] mb-2"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <FiLock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]"
                  />
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={!recoveryReady}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none transition-colors text-white placeholder:text-[#555] disabled:opacity-50"
                    placeholder="Re-enter the same password"
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
                disabled={submitting || !recoveryReady}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving…" : "Update password"}
                {!submitting && <FiArrowRight size={14} />}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
