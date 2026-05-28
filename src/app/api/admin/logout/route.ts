import { NextResponse } from "next/server";
import { clearSessionCookie, useSupabaseAuth } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function POST() {
  if (useSupabaseAuth()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // ignore — best-effort
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
