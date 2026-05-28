import { NextResponse } from "next/server";
import {
  verifyCredentials,
  setSessionCookie,
  useSupabaseAuth,
} from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const expectedAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

  if (useSupabaseAuth()) {
    if (expectedAdmin && email.toLowerCase() !== expectedAdmin) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json(
        { error: "This email is not the admin." },
        { status: 403 }
      );
    }
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) {
        await new Promise((r) => setTimeout(r, 500));
        return NextResponse.json(
          { error: error?.message || "Invalid email or password" },
          { status: 401 }
        );
      }
      return NextResponse.json({ ok: true, source: "supabase" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Legacy env-based auth
  if (!verifyCredentials(email, password)) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }
  await setSessionCookie(email);
  return NextResponse.json({ ok: true, source: "env" });
}
