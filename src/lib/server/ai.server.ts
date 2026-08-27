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
      // Known Groq production ids (verified family). Runtime discovery appends
      // any other chat models your key can access and ranks them.
      models: withOverride([
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
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
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    const msg = body.choices?.[0]?.message;
    // Some reasoning models put text in content; if empty but there is
    // reasoning_content, use it (stripped of the think tags elsewhere).
    return (msg?.content ?? "").trim() || (msg?.reasoning_content ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a provider's LIVE model list (OpenAI-compatible GET /models). Model ids
 * churn constantly (Groq retires them), so discovering them at runtime means a
 * retired/renamed id never silently breaks chat.
 */
async function fetchRemoteModels(provider: Provider): Promise<string[]> {
  try {
    const res = await fetch(`${provider.apiBase}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: { id?: string }[];
      models?: { id?: string }[];
    };
    const list = body.data ?? body.models ?? [];
    return list
      .map((m) => m.id ?? "")
      .filter(Boolean)
      .filter((id) => !/whisper|tts|speech|embedding|rerank|guard|moderation|safety|transcri/i.test(id));
  } catch {
    return [];
  }
}

/**
 * Rank a model id by how likely it is to be a good, permissive CHAT model.
 * Higher = try first. Heavily-filtered or non-chat models rank low.
 */
const RP_PRIORITY = [
  "kimi", "llama-4", "llama4", "llama-3.3", "llama-3-70b", "3.3-70b",
  "mistral-large", "nemo", "magistral", "qwen3-coder", "qwen3-235", "qwen-2.5-7",
  "deepseek", "grok", "llama-3.1-70b", "70b", "minimax-m3", "glm",
  "llama-3.1-8b", "8b", "gpt-oss", "gemma", "compound",
];

function rankScore(id: string): number {
  const low = id.toLowerCase();
  for (let i = 0; i < RP_PRIORITY.length; i++) {
    if (low.includes(RP_PRIORITY[i]!)) return RP_PRIORITY.length - i;
  }
  return 0;
}

/** Candidate models for a provider: curated ids first, then live-discovered ones. */
async function candidateModels(
  provider: Provider,
  discover: boolean,
): Promise<string[]> {
  const ordered = [...provider.models];
  if (discover) {
    const remote = await fetchRemoteModels(provider);
    remote.sort((a, b) => rankScore(b) - rankScore(a));
    for (const id of remote) {
      if (!ordered.some((m) => m.toLowerCase() === id.toLowerCase())) ordered.push(id);
    }
  }
  return ordered;
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
    const tried = new Set<string>();
    // 1) curated model ids
    for (const model of provider.models) {
      tried.add(model.toLowerCase());
      try {
        const raw = await callOneModel(provider, model, messages, settings);
        if (!isRefusal(raw)) return { text: raw, provider: provider.id, model };
        errors.push(`${provider.id}/${model}: refused`);
      } catch (err) {
        errors.push(`${provider.id}/${model}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    // 2) if all curated ids failed, discover the provider's LIVE models and try
    //    the most roleplay-friendly ones (max 8) — survives model-id churn.
    const remote = (await candidateModels(provider, true)).filter(
      (m) => !tried.has(m.toLowerCase()),
    );
    for (const model of remote.slice(0, 8)) {
      try {
        const raw = await callOneModel(provider, model, messages, settings);
        if (!isRefusal(raw)) return { text: raw, provider: provider.id, model };
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
    // Curated ids first, then the provider's live-discovered chat models
    // (discovery runs in the self-test so we can see what actually answers).
    const candidates = await candidateModels(provider, true);
    for (const model of candidates.slice(0, 14)) {
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
