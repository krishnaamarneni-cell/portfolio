import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type ChatThread = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: unknown | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: string;
};

export async function listThreads(opts: { includeArchived?: boolean } = {}): Promise<ChatThread[]> {
  const supabase = requireSupabaseAdmin();
  let q = supabase.from("chat_threads").select("*");
  if (!opts.includeArchived) q = q.eq("archived", false);
  const { data, error } = await q
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatThread[];
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ChatThread | null) ?? null;
}

export async function getThreadMessages(id: string): Promise<ChatMessage[]> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatMessage[];
}

export async function createThread(title: string): Promise<ChatThread> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ title: title.slice(0, 80) || "New chat" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ChatThread;
}

/** Find an existing thread by id, or create one. The first user message
 *  becomes the thread title if we create. */
export async function ensureThread(
  id: string | undefined | null,
  firstUserMessage: string
): Promise<ChatThread> {
  if (id) {
    const t = await getThread(id);
    if (t) return t;
  }
  return createThread(deriveTitle(firstUserMessage));
}

export function deriveTitle(s: string): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 60) return trimmed || "New chat";
  return trimmed.slice(0, 57) + "…";
}

export async function appendMessage(
  threadId: string,
  msg: {
    role: ChatMessage["role"];
    content?: string | null;
    tool_calls?: unknown;
    tool_call_id?: string;
    name?: string;
  }
): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: msg.role,
    content: msg.content ?? null,
    tool_calls: msg.tool_calls ?? null,
    tool_call_id: msg.tool_call_id ?? null,
    name: msg.name ?? null,
  });
  if (error) throw new Error(error.message);
  await supabase
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function updateThread(
  id: string,
  patch: Partial<Pick<ChatThread, "title" | "pinned" | "archived">>
): Promise<ChatThread> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ChatThread;
}

export async function deleteThread(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("chat_threads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
