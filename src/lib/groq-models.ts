/**
 * Single source of truth for which Groq models we expose in the admin UI.
 *
 * Defaults are deliberately mid-cheap:
 *   - writing (compose-post, format-thought) → 8B Instant (~10× cheaper than 70B)
 *   - chat (with tool calling) → Llama 4 Scout (~4× cheaper than 70B, supports tools)
 *
 * If a model the user picks isn't in the allowed list we silently fall back to
 * the default, so a stale localStorage value never blows up the request.
 */

export type GroqModelKind = "writing" | "chat";

export type GroqModelOption = {
  id: string;
  label: string;
  /** Short one-liner for the dropdown hover / description. */
  blurb: string;
  /** Per-1M-token prices, USD. */
  inputPerM: number;
  outputPerM: number;
  /** Which slot this model is appropriate for. */
  kinds: GroqModelKind[];
  /** Whether the model reliably supports OpenAI-style tool calling. */
  toolCalling: boolean;
};

export const GROQ_MODELS: GroqModelOption[] = [
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    blurb: "Cheapest · fast · good for short copy",
    inputPerM: 0.05,
    outputPerM: 0.08,
    kinds: ["writing", "chat"],
    toolCalling: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    blurb: "Cheap · balanced quality",
    inputPerM: 0.075,
    outputPerM: 0.3,
    kinds: ["writing", "chat"],
    toolCalling: true,
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    blurb: "Strong tool-calling · ~4× cheaper than 70B",
    inputPerM: 0.11,
    outputPerM: 0.34,
    kinds: ["writing", "chat"],
    toolCalling: true,
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    blurb: "Stronger reasoning · still ~3× cheaper than 70B",
    inputPerM: 0.15,
    outputPerM: 0.6,
    kinds: ["writing", "chat"],
    toolCalling: true,
  },
  {
    id: "qwen/qwen3-32b",
    label: "Qwen3 32B",
    blurb: "Solid mid-tier",
    inputPerM: 0.29,
    outputPerM: 0.59,
    kinds: ["writing", "chat"],
    toolCalling: true,
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    blurb: "Highest quality · most expensive",
    inputPerM: 0.59,
    outputPerM: 0.79,
    kinds: ["writing", "chat"],
    toolCalling: true,
  },
];

export const DEFAULT_WRITING_MODEL = "llama-3.1-8b-instant";
export const DEFAULT_CHAT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/** Validate a user-supplied model id; fall back to the kind's default. */
export function resolveModel(
  kind: GroqModelKind,
  requested?: string | null
): string {
  if (requested) {
    const ok = GROQ_MODELS.find((m) => m.id === requested && m.kinds.includes(kind));
    if (ok) return ok.id;
  }
  return kind === "chat" ? DEFAULT_CHAT_MODEL : DEFAULT_WRITING_MODEL;
}

export function modelsFor(kind: GroqModelKind): GroqModelOption[] {
  return GROQ_MODELS.filter((m) => m.kinds.includes(kind));
}
