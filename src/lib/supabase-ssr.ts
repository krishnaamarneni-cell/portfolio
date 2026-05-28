import { createServerClient, createBrowserClient } from "@supabase/ssr";
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

/**
 * Browser-side Supabase client. Use in client components.
 */
export function createSupabaseBrowserClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Auth is not configured in the browser. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/PUBLISHABLE_KEY."
    );
  }
  return createBrowserClient(url, anonKey);
}
