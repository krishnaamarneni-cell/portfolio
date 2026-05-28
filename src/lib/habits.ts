import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type Habit = {
  id: string;
  name: string;
  emoji: string | null;
  cadence: "daily" | "weekdays" | "weekly";
  archived: boolean;
  sort_order: number;
  created_at: string;
};

export type HabitCheckin = {
  id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  note: string | null;
  created_at: string;
};

export type HabitWithStreak = Habit & {
  streak: number;
  checkins: Record<string, boolean>; // ISO date → done
};

/** Local-day YYYY-MM-DD (no UTC drift). */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function listHabits(): Promise<Habit[]> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Habit[];
}

export async function createHabit(input: {
  name: string;
  emoji?: string;
  cadence?: Habit["cadence"];
}): Promise<Habit> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("habits")
    .insert({
      name: input.name,
      emoji: input.emoji ?? null,
      cadence: input.cadence ?? "daily",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Habit;
}

export async function updateHabit(
  id: string,
  patch: Partial<Habit>
): Promise<Habit> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("habits")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Habit;
}

export async function deleteHabit(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Toggle today's checkin for a habit — creates if missing, flips `done` otherwise. */
export async function toggleCheckin(habitId: string, date: string): Promise<HabitCheckin> {
  const supabase = requireSupabaseAdmin();
  const { data: existing } = await supabase
    .from("habit_checkins")
    .select("*")
    .eq("habit_id", habitId)
    .eq("date", date)
    .maybeSingle();
  if (existing) {
    const { data, error } = await supabase
      .from("habit_checkins")
      .update({ done: !(existing as HabitCheckin).done })
      .eq("id", (existing as HabitCheckin).id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as HabitCheckin;
  }
  const { data, error } = await supabase
    .from("habit_checkins")
    .insert({ habit_id: habitId, date, done: true })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HabitCheckin;
}

export async function recentCheckins(
  habitId: string,
  days: number = 30
): Promise<HabitCheckin[]> {
  const supabase = requireSupabaseAdmin();
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("habit_checkins")
    .select("*")
    .eq("habit_id", habitId)
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HabitCheckin[];
}

/** Count consecutive days done counting back from today. */
export function calcStreak(checkins: HabitCheckin[]): number {
  const map = new Map<string, boolean>();
  for (const c of checkins) map.set(c.date, c.done);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (map.get(key)) streak++;
    else break;
    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }
  return streak;
}

export async function habitsWithStreaks(): Promise<HabitWithStreak[]> {
  const habits = await listHabits();
  const out: HabitWithStreak[] = [];
  for (const h of habits) {
    const checkins = await recentCheckins(h.id, 30);
    const checkinMap: Record<string, boolean> = {};
    for (const c of checkins) checkinMap[c.date] = c.done;
    out.push({ ...h, streak: calcStreak(checkins), checkins: checkinMap });
  }
  return out;
}
