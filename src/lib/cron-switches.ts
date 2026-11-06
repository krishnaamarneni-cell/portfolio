/**
 * On/off switches for the scheduled jobs.
 *
 * The switch that actually saves money is read by GitHub Actions before it
 * calls Vercel — see .github/workflows/*.yml. This module is the second line:
 * it gates the route itself, so a manual curl or a workflow that skipped its
 * pre-flight still respects the switch.
 *
 * Fails OPEN. An unreadable table means the jobs keep running, which is the
 * right direction to fail: a missed crawl is recoverable, and silently
 * stopping every automation because one query failed is not.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type CronKey =
  | "auto-reply"
  | "job-finder"
  | "social-drip"
  | "agents"
  | "warm-outreach";

export type CronSwitch = {
  key: string;
  label: string;
  schedule: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
};

export async function listCronSwitches(): Promise<{
  switches: CronSwitch[];
  error?: string;
}> {
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("cron_switches")
      .select("key,label,schedule,enabled,last_run_at,last_status")
      .order("key");
    if (error) {
      return {
        switches: [],
        error: /does not exist|schema cache|relation/i.test(error.message)
          ? "Run supabase/cron_switches.sql in Supabase to enable the switches."
          : error.message,
      };
    }
    return {
      switches: (data ?? []).map((r) => ({
        key: r.key,
        label: r.label,
        schedule: r.schedule,
        enabled: Boolean(r.enabled),
        lastRunAt: r.last_run_at,
        lastStatus: r.last_status,
      })),
    };
  } catch (err) {
    return { switches: [], error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function setCronSwitch(key: string, enabled: boolean): Promise<string | null> {
  try {
    const db = requireSupabaseAdmin();
    const { error } = await db
      .from("cron_switches")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("key", key);
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : "unknown";
  }
}

/** False only when the switch exists and is explicitly off. */
export async function isCronEnabled(key: CronKey): Promise<boolean> {
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("cron_switches")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return true; // fail open — see the note above
    return Boolean(data.enabled);
  } catch {
    return true;
  }
}

/**
 * Heartbeat, so the admin card can show whether a job is really running rather
 * than only what its switch says. Best-effort: never fail a run over telemetry.
 */
export async function recordCronRun(key: CronKey, status: string): Promise<void> {
  try {
    const db = requireSupabaseAdmin();
    await db
      .from("cron_switches")
      .update({ last_run_at: new Date().toISOString(), last_status: status.slice(0, 300) })
      .eq("key", key);
  } catch {
    // ignored
  }
}
