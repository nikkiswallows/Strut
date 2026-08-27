/**
 * Chat completion provider for seed/bot replies (server-only).
 *
 * Uses an OpenAI-compatible API so many backends work with one code path. The
 * provider is chosen automatically from whichever key is present, in order:
 *
 *   1. Generic OpenAI-compatible endpoint — AI_API_KEY + AI_API_BASE (+AI_MODEL)
 *   2. xAI Grok        — XAI_API_KEY   (most permissive for adult/edgy chat)
 *   3. Groq            — GROQ_API_KEY  (FREE tier, very fast; recommended)
 *   4. OpenRouter      — OPENROUTER_API_KEY (FREE models)
 *   5. Google Gemini   — GEMINI_API_KEY (free; filters explicit content hard)
 *
 * Each provider has an ordered list of CURRENT model IDs. We try them in turn
 * and move to the next when a model is deprecated/unavailable OR refuses/returns
 * empty — so a retired model ID never silently drops chat back to canned lines.
 * Override with AI_MODEL to force a specific model (tried first).
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = {
  id: string;
  label: string;
  apiBase: string;
  apiKey: string;
  /** Ordered fallback models. AI_MODEL (if set) is tried before these. */
  models: string[];
};

function envKey(name: string): string {
  try {
    return (process.env[name] ?? "").trim();
  } catch {
    return "";
  }
}

function modelChain(defaults: string[]): string[] {
  const override = envKey("AI_MODEL");
  const chain = override ? [override, ...defaults] : defaults;
  return [...new Set(chain)];
}

export function selectProvider(): Provider | null {
  const genericKey = envKey("AI_API_KEY");
  const genericBase = envKey("AI_API_BASE");
  if (genericKey && genericBase) {
    return {
      id: "generic",
      label: envKey("AI_PROVIDER_NAME") || "Custom AI",
      apiBase: genericBase.replace(/\/+$/, ""),
      apiKey: genericKey,
      models: modelChain(["gpt-4o-mini", "gpt-3.5-turbo"]),
    };
  }

  const xai = envKey("XAI_API_KEY");
  if (xai) {
    return {
      id: "xai",
      label: "xAI Grok",
      apiBase: "https://api.x.ai/v1",
      apiKey: xai,
      // grok-4 is current; fall back to grok-3-mini.
      models: modelChain(["grok-4", "grok-3-mini", "grok-2-latest"]),
    };
  }

  const groq = envKey("GROQ_API_KEY");
  if (groq) {
    return {
      id: "groq",
      label: "Groq",
      apiBase: "https://api.groq.com/openai/v1",
      apiKey: groq,
      // Current (post-2026 deprecation) Groq production model IDs, most
      // capable/permissive first. llama-3.3-70b-versatile was retired 08/16/26.
      models: modelChain([
        "openai/gpt-oss-120b",
        "moonshotai/kimi-k2-instruct",
        "openai/gpt-oss-20b",
        "qwen/qwen3-32b",
        "meta-llama/llama-4-scout-17b-16e-instruct",
      ]),
    };
  }

  const openrouter = envKey("OPENROUTER_API_KEY");
  if (openrouter) {
    return {
      id: "openrouter",
      label: "OpenRouter",
      apiBase: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      models: modelChain([
        "moonshotai/kimi-k2:free",
        "openai/gpt-oss-20b:free",
        "meta-llama/llama-3.3-70b-instruct:free",
      ]),
    };
  }

  const gemini = envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY");
  if (gemini) {
    return {
      id: "gemini",
      label: "Google Gemini",
      apiBase: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: gemini,
      models: modelChain(["gemini-2.5-flash", "gemini-2.0-flash"]),
    };
  }

  return null;
}

export function aiConfigured(): boolean {
  return selectProvider() !== null;
}

export function aiPublicInfo() {
  const p = selectProvider();
  return {
    provider: p?.id ?? null,
    label: p?.label ?? null,
    model: p?.models[0] ?? null,
  };
}

/** Detect a model "refusal" (empty or a can't-won't response) vs. real output. */
function isRefusal(text: string): boolean {
  if (!text.trim()) return true;
  return /\b(i(?:'| a)?m sorry|i can'?t|i cannot|i won'?t|i'?m not able|i am not able|i'?m unable|as an? (ai|language model|assistant)|cannot (engage|fulfill|generate|create|comply)|can'?t (engage|fulfill|generate|create|comply|help with)|not (able to|comfortable)|against my (guidelines|programming|policy)|i don'?t think i should)\b/i.test(
    text,
  );
}

async function callOneModel(
  provider: Provider,
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens: number; temperature: number; timeoutMs: number },
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };
    if (provider.id === "openrouter") {
      headers["HTTP-Referer"] = "https://strut.app";
      headers["X-Title"] = "Strut";
    }
    const res = await fetch(`${provider.apiBase}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[ai] ${provider.id} model ${model} HTTP ${res.status}`, detail.slice(0, 200));
      throw new Error(`http-${res.status}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call the configured provider, walking its model chain until one returns a
 * usable (non-refusal) reply. Throws only if NO model in the chain works —
 * callers then fall back to a canned line.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const provider = selectProvider();
  if (!provider) throw new Error("no-ai-key");

  const settings = {
    maxTokens: opts.maxTokens ?? 200,
    temperature: opts.temperature ?? 1.0,
    timeoutMs: opts.timeoutMs ?? 15_000,
  };

  let lastErr: unknown = null;
  for (const model of provider.models) {
    try {
      const raw = await callOneModel(provider, model, messages, settings);
      const trimmed = raw.trim();
      if (!isRefusal(trimmed)) return trimmed;
      console.error(`[ai] ${provider.id} ${model} refused/empty — trying next model`);
      lastErr = new Error("refusal");
    } catch (err) {
      lastErr = err;
      // Try the next model in the chain.
    }
  }
  console.error(`[ai] ${provider.id} all models failed:`, lastErr);
  throw lastErr instanceof Error ? lastErr : new Error("ai-all-failed");
}
