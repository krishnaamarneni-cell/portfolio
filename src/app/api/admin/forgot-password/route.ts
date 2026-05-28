import { NextResponse } from "next/server";
import { useSupabaseAuth } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function POST(request: Request) {
  if (!useSupabaseAuth()) {
    return NextResponse.json(
      {
        error:
          "Email-based password reset requires Supabase. While Supabase is not configured, use scripts/set-admin-password.mjs from the terminal.",
      },
      { status: 400 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const expectedAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (expectedAdmin && email !== expectedAdmin) {
    // Don't reveal whether the address is admin or not — pretend success.
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/admin/reset-password`,
    });
    if (error) {
      console.error("[forgot-password] supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
