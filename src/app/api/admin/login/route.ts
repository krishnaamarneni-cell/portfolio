import { NextResponse } from "next/server";
import { verifyCredentials, setSessionCookie } from "@/lib/auth";

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

  if (!verifyCredentials(email, password)) {
    // Slow down brute-force attempts a touch.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  await setSessionCookie(email);
  return NextResponse.json({ ok: true });
}
