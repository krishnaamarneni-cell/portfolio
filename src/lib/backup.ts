import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

/**
 * Dump every admin-owned table to a single JSON blob. Sensitive fields are
 * preserved verbatim (the export is meant to be downloaded immediately by the
 * admin in their browser, never logged or stored remotely).
 *
 * Returns a structured object you can JSON.stringify and stream as a download.
 */

const TABLES = [
  "jobs",
  "projects",
  "site_content",
  "thoughts",
  "connectors",
  "gmail_tokens",
  "admin_settings",
  "personal_notes",
  "personal_facts",
  "habits",
  "habit_checkins",
  "reading_list",
  "chat_threads",
  "chat_messages",
] as const;

export type BackupBundle = {
  generated_at: string;
  schema_version: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
  warnings: string[];
};

export async function exportAllData(): Promise<BackupBundle> {
  const supabase = requireSupabaseAdmin();
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const warnings: string[] = [];

  await Promise.all(
    TABLES.map(async (t) => {
      try {
        const { data, error } = await supabase.from(t).select("*");
        if (error) {
          warnings.push(`${t}: ${error.message}`);
          tables[t] = [];
          counts[t] = 0;
          return;
        }
        tables[t] = data ?? [];
        counts[t] = (data ?? []).length;
      } catch (err) {
        warnings.push(`${t}: ${err instanceof Error ? err.message : "failed"}`);
        tables[t] = [];
        counts[t] = 0;
      }
    })
  );

  return {
    generated_at: new Date().toISOString(),
    schema_version: "1",
    tables,
    counts,
    warnings,
  };
}
