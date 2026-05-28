import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type ReadingItem = {
  id: string;
  title: string;
  author: string | null;
  status: "wishlist" | "reading" | "done" | "abandoned";
  progress: number | null;
  rating: number | null;
  notes: string | null;
  cover_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingInput = Partial<Omit<ReadingItem, "id" | "created_at" | "updated_at">> & {
  title: string;
};

export async function listReading(): Promise<ReadingItem[]> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("reading_list")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReadingItem[];
}

export async function createReading(input: ReadingInput): Promise<ReadingItem> {
  const supabase = requireSupabaseAdmin();
  const row = {
    title: input.title,
    author: input.author ?? null,
    status: input.status ?? "reading",
    progress: input.progress ?? null,
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    cover_url: input.cover_url ?? null,
    started_at: input.started_at ?? null,
    finished_at: input.finished_at ?? null,
  };
  const { data, error } = await supabase
    .from("reading_list")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ReadingItem;
}

export async function updateReading(
  id: string,
  patch: Partial<ReadingInput>
): Promise<ReadingItem> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("reading_list")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ReadingItem;
}

export async function deleteReading(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("reading_list").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
