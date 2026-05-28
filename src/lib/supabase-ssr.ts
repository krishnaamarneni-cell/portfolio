import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(url && anonKey);
}

/**
 * Server-side Supabase client that reads/writes auth cookies through Next.js.
 * Use this in route handlers, server components, and server actions.
 *
 * For client components import from "./supabase-browser" instead — this file
 * pulls in next/headers and can't be bundled to the browser.
 */
export async function createSupabaseServerClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or _PUBLISHABLE_KEY)."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookieList) {
        try {
          cookieList.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Some contexts (e.g. React Server Components rendering pass) won't
          // allow cookie writes — Supabase handles refresh elsewhere.
        }
      },
    },
  });
}
