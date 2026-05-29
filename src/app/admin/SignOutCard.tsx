"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiLogOut, FiUser } from "react-icons/fi";

/**
 * Sign-out tile at the bottom of Settings. On mobile we hide the header
 * logout button (no room), so this is the primary way out from a phone.
 */
export default function SignOutCard({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (!confirm("Sign out of Lucy?")) return;
    setBusy(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent p-5 mt-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center shrink-0">
          <FiUser size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white">Signed in as</h3>
          <p className="text-xs text-[#aaa] mt-1 truncate font-mono">{email}</p>
          <p className="text-[10px] text-[#666] mt-1">
            Sign-out drops your session cookie. Trusted-device cookies on other
            devices keep working until you revoke them above.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/25 disabled:opacity-60"
        >
          <FiLogOut size={11} />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
