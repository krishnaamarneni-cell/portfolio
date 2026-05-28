import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase renamed the public key from "anon" to "publishable" in late 2025.
// Accept either so existing and new projects both work.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Same story on the server side: service_role was renamed to "secret".
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL is not set — admin/jobs/projects will fail until .env.local is filled in."
  );
}

export const supabasePublic = url && anonKey ? createClient(url, anonKey) : null;

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
  return supabaseAdmin;
}

export function requireSupabasePublic() {
  if (!supabasePublic) {
    throw new Error(
      "Supabase public client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  return supabasePublic;
}
