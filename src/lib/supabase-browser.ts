import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(url && anonKey);
}

/**
 * Browser-side Supabase client. Use in client components.
 *
 * For server components / route handlers / server actions, import
 * `createSupabaseServerClient` from "./supabase-ssr" instead.
 */
export function createSupabaseBrowserClient() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Auth is not configured in the browser. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/PUBLISHABLE_KEY."
    );
  }
  return createBrowserClient(url, anonKey);
}
