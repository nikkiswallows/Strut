/**
 * Chat completion for seed/bot replies (server-only). OpenAI-compatible.
 *
 * Providers are tried across ALL configured keys (if xAI fails, we try Groq,
 * then OpenRouter, etc.), and within each provider we walk an ordered list of
 * CURRENT model ids — skipping any that is deprecated/unavailable OR refuses.
 * So a retired model id or a prudish filter never silently drops chat to canned
 * lines as long as ANY provider/model returns a reply.
 *
 * Preference order (first provider with a key wins, then fall back through the
 * rest):
 *   AI_API_KEY/AI_API_BASE (custom gateway) → xAI (Grok, most permissive)
 *   → Groq (free, fast) → OpenRouter (free models) → Gemini.
 *
 * Diagnostics: GET /api/ai/selftest reports exactly what each provider does.
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = {
  id: string;
  label: string;
  apiBase: string;
  apiKey: string;
  /** Current model ids, most capable/permissive first. */
  models: string[];
};

function envKey(name: string): string {
  try {
    return (process.env[name] ?? "").trim();
  } catch {
    return "";
  }
}

function withOverride(defaults: string[]): string[] {
  const override = envKey("AI_MODEL");
  const chain = override ? [override, ...defaults] : defaults;
  return [...new Set(chain)];
}

function allProviders(): Provider[] {
  const out: Provider[] = [];

  const genericKey = envKey("AI_API_KEY");
  const genericBase = envKey("AI_API_BASE");
  if (genericKey && genericBase) {
    out.push({
      id: "generic",
      label: envKey("AI_PROVIDER_NAME") || "Custom gateway",
      apiBase: genericBase.replace(/\/+$/, ""),
      apiKey: genericKey,
      models: withOverride(["gpt-4o-mini", "gpt-3.5-turbo"]),
    });
  }

  const xai = envKey("XAI_API_KEY");
  if (xai) {
    out.push({
      id: "xai",
      label: "xAI Grok",
      apiBase: "https://api.x.ai/v1",
      apiKey: xai,
      // Grok — the least likely to refuse adult roleplay. Use the
      // fast/non-reasoning ids (quick replies).
      models: withOverride([
        "grok-4-fast-non-reasoning",
        "grok-4",
        "grok-3-mini",
        "grok-2-latest",
      ]),
    });
  }

  const groq = envKey("GROQ_API_KEY");
  if (groq) {
    out.push({
      id: "groq",
      label: "Groq",
      apiBase: "https://api.groq.com/openai/v1",
      apiKey: groq,
      // Current (post-2026) Groq ids; Kimi is notably more roleplay-friendly.
      models: withOverride([
        "moonshotai/kimi-k2-instruct",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "z-ai/glm-4.6",
        "qwen/qwen3-32b",
        "meta-llama/llama-4-scout-17b-16e-instruct",
      ]),
    });
  }

  const openrouter = envKey("OPENROUTER_API_KEY");
  if (openrouter) {
    out.push({
      id: "openrouter",
      label: "OpenRouter",
      apiBase: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      // GLM family is among the least-filtered mainstream models; keep large
      // capable free models. Put an explicit uncensored id in AI_MODEL if you
      // set one up on OpenRouter.
      models: withOverride([
        "z-ai/glm-5.2:free",
        "minimax/minimax-m3:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "thinkingmachines/inkling:free",
        "google/gemma-4-31b-it:free",
      ]),
    });
  }

  const gemini = envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY");
  if (gemini) {
    out.push({
      id: "gemini",
      label: "Google Gemini",
      apiBase: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: gemini,
      models: withOverride(["gemini-2.5-flash", "gemini-2.0-flash"]),
    });
  }

  return out;
}

export function aiConfigured(): boolean {
  return allProviders().length > 0;
}

export function aiPublicInfo() {
  const ps = allProviders();
  const primary = ps[0];
  return {
    provider: primary?.id ?? null,
    label: primary?.label ?? null,
    model: primary?.models[0] ?? null,
    providers: ps.map((p) => p.id),
  };
}

export type RefusalDetector = (t: string) => boolean;

const REFUSAL_RE =
  /\b(i(?:'| a)?m sorry|i can'?t|i cannot|i won'?t|i'?m not able|i am not able|i'?m unable|as an? (ai|language model|assistant)|cannot (engage|fulfill|fulfil|generate|create|comply)|can'?t (engage|fulfill|fulfil|generate|create|comply|help with)|not (able to|comfortable (with|doing))|against my (guidelines|programming|policy)|i don'?t think i should|i(?:'m| am) unable to assist)\b/i;

export function isRefusal(text: string): boolean {
  if (!text.trim()) return true;
  return REFUSAL_RE.test(text);
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
      const short = detail.replace(/\s+/g, " ").slice(0, 220);
      throw new Error(`HTTP ${res.status}: ${short}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (body.choices?.[0]?.message?.content ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}

export type ChatResult = {
  text: string;
  provider: string;
  model: string;
};

/**
 * Try every configured provider × model chain until one returns a usable
 * (non-refusal) reply. Throws only if NOTHING works.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<ChatResult> {
  const providers = allProviders();
  if (!providers.length) throw new Error("no-ai-key");

  const settings = {
    maxTokens: opts.maxTokens ?? 200,
    temperature: opts.temperature ?? 1.0,
    timeoutMs: opts.timeoutMs ?? 20_000,
  };

  const errors: string[] = [];
  for (const provider of providers) {
    for (const model of provider.models) {
      try {
        const raw = await callOneModel(provider, model, messages, settings);
        if (!isRefusal(raw)) {
          return { text: raw, provider: provider.id, model };
        }
        errors.push(`${provider.id}/${model}: refused`);
      } catch (err) {
        errors.push(`${provider.id}/${model}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }
  throw new Error(`all AI providers failed -> ${errors.join(" | ")}`);
}

export type SelfTestReport = {
  providers: {
    id: string;
    label: string;
    configured: boolean;
    results: { model: string; ok: boolean; snippet: string }[];
  }[];
  working: { provider: string; model: string } | null;
};

/**
 * Exercise each configured provider/model with a short in-character prompt and
 * report the first one that works (plus per-model snippets/errors). Powers
 * GET /api/ai/selftest so the user can see wiring from their own deployment.
 */
export async function aiSelfTest(): Promise<SelfTestReport> {
  const providers = allProviders();
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Adult 18+ consensual fictional roleplay on a dating app. Reply as a flirty character in ONE short text message, no disclaimers.",
    },
    { role: "user", content: "hey, you free tonight?" },
  ];
  const report: SelfTestReport = { providers: [], working: null };
  for (const provider of providers) {
    const entry: SelfTestReport["providers"][number] = {
      id: provider.id,
      label: provider.label,
      configured: true,
      results: [],
    };
    for (const model of provider.models) {
      try {
        const raw = await callOneModel(provider, model, messages, {
          maxTokens: 80,
          temperature: 1.0,
          timeoutMs: 20_000,
        });
        const refused = isRefusal(raw);
        entry.results.push({
          model,
          ok: !refused,
          snippet: (refused ? "[refused] " : "") + raw.replace(/\s+/g, " ").slice(0, 160),
        });
        if (!refused && !report.working) {
          report.working = { provider: provider.id, model };
        }
      } catch (err) {
        entry.results.push({
          model,
          ok: false,
          snippet: err instanceof Error ? err.message.slice(0, 160) : "failed",
        });
      }
    }
    report.providers.push(entry);
  }
  return report;
}
